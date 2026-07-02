import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server } from '@stellar/stellar-sdk/rpc'
import { useWallet } from '../lib/WalletContext'
import { useToast } from '../lib/ToastContext'
import { getMarketplace } from '../lib/clients'
import { toStroops } from '../lib/format'
import { runTx } from '../lib/tx'
import { config } from '../lib/config'

async function getCurrentLedger(): Promise<number> {
  const server = new Server(config.rpcUrl)
  const info = await server.getLatestLedger()
  return info.sequence
}

interface FieldErrors {
  debtorName?: string
  faceValue?: string
  discountPct?: string
  dueInDays?: string
}

export default function CreatePage() {
  const navigate = useNavigate()
  const { address, connect, signTransaction } = useWallet()
  const toast = useToast()

  const [debtorName, setDebtorName] = useState('')
  const [faceValue, setFaceValue] = useState('')
  const [discountPct, setDiscountPct] = useState('')
  const [dueInDays, setDueInDays] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [pending, setPending] = useState(false)

  // Plain decimal number, e.g. "1000" or "12.34". Rejects "1e3", "1,000",
  // hex, leading "+/-", and other forms that pass parseFloat but break toStroops.
  const DECIMAL_RE = /^\d+(\.\d+)?$/
  const INTEGER_RE = /^\d+$/

  const validate = (): boolean => {
    const errs: FieldErrors = {}
    if (!debtorName.trim()) {
      errs.debtorName = 'Debtor name is required.'
    }

    const fvStr = faceValue.trim()
    if (!DECIMAL_RE.test(fvStr) || parseFloat(fvStr) <= 0) {
      errs.faceValue = 'Face value must be a plain number greater than 0 (e.g. 1000 or 1000.50).'
    } else {
      // Guard against >7 decimal places, which toStroops would silently truncate.
      const [, frac = ''] = fvStr.split('.')
      if (frac.length > 7) {
        errs.faceValue = 'Face value supports at most 7 decimal places.'
      }
    }

    const pctStr = discountPct.trim()
    if (!DECIMAL_RE.test(pctStr)) {
      errs.discountPct = 'Discount must be a plain number between 0.01% and 90%.'
    } else {
      const pct = parseFloat(pctStr)
      if (pct < 0.01 || pct > 90) {
        errs.discountPct = 'Discount must be between 0.01% and 90%.'
      }
    }

    const daysStr = dueInDays.trim()
    if (!INTEGER_RE.test(daysStr) || parseInt(daysStr, 10) < 1) {
      errs.dueInDays = 'Due-in must be a whole number of at least 1 day.'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address) {
      try {
        await connect()
      } catch {
        toast.error('Please connect your wallet first.')
      }
      return
    }
    if (!validate()) return

    setPending(true)
    try {
      const currentLedger = await getCurrentLedger()
      const days = parseInt(dueInDays, 10)
      const due_ledger = BigInt(currentLedger + days * 17280)
      const face_value = toStroops(faceValue)
      const pct = parseFloat(discountPct)
      const discount_bps = Math.round(pct * 100)

      const mkt = getMarketplace(signTransaction, address)
      await runTx(
        await mkt.create_invoice({
          seller: address,
          debtor_name: debtorName.trim(),
          face_value,
          due_ledger,
          discount_bps,
        }),
      )
      toast.success('Invoice created successfully!')
      navigate('/portfolio')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transaction failed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Create Invoice</h1>

      {!address && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
          Connect your wallet to create an invoice.
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="debtor-name"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Debtor name
          </label>
          <input
            id="debtor-name"
            type="text"
            value={debtorName}
            onChange={(e) => setDebtorName(e.target.value)}
            placeholder="Acme Corp"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
          {errors.debtorName && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.debtorName}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="face-value"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Face value (USDC)
          </label>
          <input
            id="face-value"
            type="number"
            value={faceValue}
            onChange={(e) => setFaceValue(e.target.value)}
            placeholder="1000"
            min="0.0000001"
            step="any"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
          {errors.faceValue && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.faceValue}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="discount-pct"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Discount (%)
          </label>
          <input
            id="discount-pct"
            type="number"
            value={discountPct}
            onChange={(e) => setDiscountPct(e.target.value)}
            placeholder="5"
            min="0.01"
            max="90"
            step="0.01"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
          {errors.discountPct && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.discountPct}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="due-days"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Due in (days)
          </label>
          <input
            id="due-days"
            type="number"
            value={dueInDays}
            onChange={(e) => setDueInDays(e.target.value)}
            placeholder="30"
            min="1"
            step="1"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
          {errors.dueInDays && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.dueInDays}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={pending || !address}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create Invoice'}
        </button>
      </form>
    </div>
  )
}
