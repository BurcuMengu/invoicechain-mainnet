import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Server } from '@stellar/stellar-sdk/rpc'
import { useOpenInvoices } from '../hooks/useInvoices'
import InvoiceCard from '../components/InvoiceCard'
import { useWallet } from '../lib/WalletContext'
import { useToast } from '../lib/ToastContext'
import { useBalanceCtx } from '../lib/BalanceContext'
import { getMarketplace, getToken } from '../lib/clients'
import { runTxSponsored } from '../lib/tx'
import { salePrice } from '../lib/format'
import { config } from '../lib/config'
import { track, captureError } from '../lib/analytics'

async function getCurrentLedger(): Promise<number> {
  const server = new Server(config.rpcUrl)
  const info = await server.getLatestLedger()
  return info.sequence
}

function SkeletonCard() {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm bg-white dark:bg-gray-900 flex flex-col gap-3 animate-pulse">
      <div className="flex items-start justify-between gap-2">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16" />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded" />
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded" />
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded" />
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded" />
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded" />
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
      <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  )
}

export default function MarketplacePage() {
  const { invoices, loading, error, refetch } = useOpenInvoices()
  const { address, connect, signTransaction } = useWallet()
  const toast = useToast()
  const { refresh: refreshHeader } = useBalanceCtx()
  const [pendingId, setPendingId] = useState<bigint | null>(null)

  // Sorting — added from user feedback ("sort/filter invoices by discount or amount").
  type SortKey = 'newest' | 'discount' | 'amount-desc' | 'amount-asc' | 'price-asc'
  const [sortBy, setSortBy] = useState<SortKey>('newest')

  const byBigint = (a: bigint, b: bigint) => (a > b ? 1 : a < b ? -1 : 0)
  const sortedInvoices = useMemo(() => {
    const arr = [...invoices]
    const comparators: Record<SortKey, (a: typeof arr[number], b: typeof arr[number]) => number> = {
      newest: (a, b) => byBigint(b.id, a.id),
      discount: (a, b) => b.discount_bps - a.discount_bps,
      'amount-desc': (a, b) => byBigint(b.face_value, a.face_value),
      'amount-asc': (a, b) => byBigint(a.face_value, b.face_value),
      'price-asc': (a, b) =>
        byBigint(salePrice(a.face_value, a.discount_bps), salePrice(b.face_value, b.discount_bps)),
    }
    return arr.sort(comparators[sortBy])
  }, [invoices, sortBy])

  const handleBuy = async (invoiceId: bigint, faceValue: bigint, discountBps: number) => {
    if (!address) {
      try {
        await connect()
      } catch {
        toast.error('Please connect your wallet to buy an invoice.')
      }
      return
    }

    const price = salePrice(faceValue, discountBps)
    setPendingId(invoiceId)
    try {
      // Step 1: approve the marketplace contract to spend the sale price
      const currentLedger = await getCurrentLedger()
      const expiration_ledger = currentLedger + 500_000
      const token = getToken(signTransaction, address)
      await runTxSponsored(
        await token.approve({
          from: address,
          spender: config.contractIds.marketplace,
          amount: price,
          expiration_ledger,
        }),
      )

      // Step 2: buy the invoice
      const mkt = getMarketplace(signTransaction, address)
      const { sponsored } = await runTxSponsored(
        await mkt.buy_invoice({ id: invoiceId, investor: address }),
      )

      track('invoice_bought', { id: String(invoiceId) })
      toast.success(
        sponsored
          ? '⚡ Gasless — ücret sponsor tarafından ödendi'
          : 'Invoice purchased successfully!',
      )
      refetch()
      refreshHeader()
    } catch (e) {
      captureError(e)
      toast.error(e instanceof Error ? e.message : 'Transaction failed.')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Marketplace</h1>
        <div className="flex items-center gap-3">
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {!loading && !error && invoices.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              Sort by
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                aria-label="Sort invoices"
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="newest">Newest</option>
                <option value="discount">Highest discount</option>
                <option value="amount-desc">Amount: high → low</option>
                <option value="amount-asc">Amount: low → high</option>
                <option value="price-asc">Price: low → high</option>
              </select>
            </label>
          )}
        </div>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <p className="text-red-600 dark:text-red-400 text-lg">
            Could not load the marketplace.
          </p>
          <button
            onClick={() => refetch()}
            className="inline-block px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && invoices.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            No open invoices — create one!
          </p>
          <Link
            to="/create"
            className="inline-block px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
          >
            Create invoice
          </Link>
        </div>
      )}

      {!loading && !error && invoices.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedInvoices.map((inv) => (
            <InvoiceCard key={String(inv.id)} invoice={inv}>
              {inv.status.tag === 'Listed' && (
                <button
                  onClick={() => handleBuy(inv.id, inv.face_value, inv.discount_bps)}
                  disabled={pendingId !== null || !address}
                  className="w-full py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                >
                  {pendingId !== null && pendingId === inv.id ? 'Processing…' : 'Buy'}
                </button>
              )}
            </InvoiceCard>
          ))}
        </div>
      )}
    </div>
  )
}
