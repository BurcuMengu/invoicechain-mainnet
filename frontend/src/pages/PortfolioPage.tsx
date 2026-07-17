import { useState, useEffect, useCallback } from 'react'
import { Server } from '@stellar/stellar-sdk/rpc'
import { useWallet } from '../lib/WalletContext'
import { useToast } from '../lib/ToastContext'
import { useBalanceCtx } from '../lib/BalanceContext'
import { getMarketplace, getToken, getReputation } from '../lib/clients'
import { runTx, readTx, runTxSponsored } from '../lib/tx'
import { config } from '../lib/config'
import { fromStroops } from '../lib/format'
import { useInvoicesBySeller, useInvoicesByOwner } from '../hooks/useInvoices'
import { track, captureError } from '../lib/analytics'
import { parseContractError } from '../lib/errors'
import InvoiceCard from '../components/InvoiceCard'
import type { Score } from '../contracts/reputation/src'

const GRACE_PERIOD_LEDGERS = 17_280n

async function getCurrentLedger(): Promise<number> {
  const server = new Server(config.rpcUrl)
  const info = await server.getLatestLedger()
  return info.sequence
}

function ratingLabel(score: Score): string {
  const total = score.settled_count + score.defaulted_count
  if (total === 0) return 'New'
  const ratio = score.settled_count / total
  if (ratio >= 0.9) return 'Excellent'
  if (ratio >= 0.75) return 'Good'
  if (ratio >= 0.5) return 'Fair'
  return 'Poor'
}

export default function PortfolioPage() {
  const { address, connect, signTransaction } = useWallet()
  const toast = useToast()
  const { refresh: refreshHeader } = useBalanceCtx()

  const {
    invoices: sellerInvoices,
    loading: sellerLoading,
    error: sellerError,
    refetch: refetchSeller,
  } = useInvoicesBySeller(address)

  const {
    invoices: ownerInvoices,
    loading: ownerLoading,
    error: ownerError,
    refetch: refetchOwner,
  } = useInvoicesByOwner(address)

  const [score, setScore] = useState<Score | null>(null)
  const [scoreLoading, setScoreLoading] = useState(false)
  const [scoreError, setScoreError] = useState<string | null>(null)
  const [currentLedger, setCurrentLedger] = useState<number | null>(null)
  const [pendingId, setPendingId] = useState<bigint | null>(null)
  const [scoreTick, setScoreTick] = useState(0)

  // Fetch current ledger sequence for past-due detection
  useEffect(() => {
    let cancelled = false
    getCurrentLedger()
      .then((seq) => { if (!cancelled) setCurrentLedger(seq) })
      .catch(() => { /* non-critical; past-due buttons just won't show */ })
    return () => { cancelled = true }
  }, [])

  // Fetch reputation score
  useEffect(() => {
    if (!address) {
      setScore(null)
      return
    }
    let cancelled = false
    setScoreLoading(true)
    setScoreError(null)
    const run = async () => {
      try {
        const rep = getReputation()
        const result = await readTx(await rep.get_score({ party: address }))
        if (!cancelled) setScore(result as unknown as Score)
      } catch (e) {
        captureError(e)
        if (!cancelled) setScoreError(parseContractError(e))
      } finally {
        if (!cancelled) setScoreLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [address, scoreTick])

  const refetchAll = useCallback(() => {
    refetchSeller()
    refetchOwner()
    setScoreTick((t) => t + 1)
  }, [refetchSeller, refetchOwner])

  const handleCancel = async (id: bigint) => {
    if (!address) return
    setPendingId(id)
    try {
      const mkt = getMarketplace(signTransaction, address)
      await runTx(await mkt.cancel_invoice({ id }))
      track('invoice_cancelled', { id: String(id) })
      toast.success('Invoice cancelled.')
      refetchAll()
    } catch (e) {
      captureError(e)
      toast.error(e instanceof Error ? e.message : 'Cancel failed.')
    } finally {
      setPendingId(null)
    }
  }

  const handleSettle = async (id: bigint, faceValue: bigint) => {
    if (!address) return
    setPendingId(id)
    try {
      // Fetch fresh ledger for a safe expiration
      const ledger = await getCurrentLedger()
      const expiration_ledger = ledger + 500_000

      // Step 1: approve marketplace to pull face_value from payer
      const token = getToken(signTransaction, address)
      await runTxSponsored(
        await token.approve({
          from: address,
          spender: config.contractIds.marketplace,
          amount: faceValue,
          expiration_ledger,
        }),
      )

      // Step 2: settle the invoice
      const mkt = getMarketplace(signTransaction, address)
      const { sponsored } = await runTxSponsored(await mkt.settle({ id, payer: address }))

      track('invoice_settled', { id: String(id) })
      toast.success(
        sponsored
          ? '⚡ Gasless — fee paid by sponsor'
          : 'Invoice settled successfully!',
      )
      refetchAll()
      refreshHeader()
    } catch (e) {
      captureError(e)
      toast.error(e instanceof Error ? e.message : 'Settle failed.')
    } finally {
      setPendingId(null)
    }
  }

  const handleMarkDefault = async (id: bigint) => {
    if (!address) return
    setPendingId(id)
    try {
      const mkt = getMarketplace(signTransaction, address)
      await runTx(await mkt.mark_default({ id }))
      track('invoice_defaulted', { id: String(id) })
      toast.success('Invoice marked as defaulted.')
      refetchAll()
    } catch (e) {
      captureError(e)
      toast.error(e instanceof Error ? e.message : 'Mark default failed.')
    } finally {
      setPendingId(null)
    }
  }

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          Connect your wallet to view your portfolio.
        </p>
        <button
          onClick={() => connect().catch(() => toast.error('Could not connect wallet.'))}
          className="inline-block rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          Connect wallet
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Portfolio</h1>

      {/* Reputation */}
      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">
          Reputation
        </h2>
        {scoreLoading && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        )}
        {scoreError && (
          <p className="text-sm text-red-600 dark:text-red-400">{scoreError}</p>
        )}
        {score && !scoreLoading && (
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Rating</dt>
              <dd className="font-semibold text-gray-900 dark:text-gray-100">
                {ratingLabel(score)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Settled</dt>
              <dd className="font-semibold text-gray-900 dark:text-gray-100">
                {score.settled_count}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Defaulted</dt>
              <dd className="font-semibold text-gray-900 dark:text-gray-100">
                {score.defaulted_count}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Volume</dt>
              <dd className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                {fromStroops(score.volume)} USDC
              </dd>
            </div>
          </dl>
        )}
      </section>

      {/* Selling section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Selling</h2>
        {sellerLoading && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        )}
        {!sellerLoading && sellerError && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-red-600 dark:text-red-400">
              Could not load your invoices. {sellerError}
            </p>
            <button
              onClick={() => refetchSeller()}
              className="rounded-lg border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Retry
            </button>
          </div>
        )}
        {!sellerLoading && !sellerError && sellerInvoices.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No invoices created yet.</p>
        )}
        {!sellerLoading && sellerInvoices.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sellerInvoices.map((inv) => (
              <InvoiceCard key={String(inv.id)} invoice={inv}>
                {inv.status.tag === 'Listed' && (
                  <button
                    onClick={() => handleCancel(inv.id)}
                    disabled={pendingId !== null}
                    className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pendingId === inv.id ? 'Cancelling…' : 'Cancel'}
                  </button>
                )}
              </InvoiceCard>
            ))}
          </div>
        )}
      </section>

      {/* Investing section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Investing</h2>
        {ownerLoading && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        )}
        {!ownerLoading && ownerError && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-red-600 dark:text-red-400">
              Could not load your investments. {ownerError}
            </p>
            <button
              onClick={() => refetchOwner()}
              className="rounded-lg border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Retry
            </button>
          </div>
        )}
        {!ownerLoading && !ownerError && ownerInvoices.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No investments yet.</p>
        )}
        {!ownerLoading && ownerInvoices.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ownerInvoices.map((inv) => {
              const isPastDue =
                currentLedger !== null &&
                BigInt(currentLedger) >= inv.due_ledger + GRACE_PERIOD_LEDGERS
              return (
                <InvoiceCard key={String(inv.id)} invoice={inv}>
                  {inv.status.tag === 'Funded' && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSettle(inv.id, inv.face_value)}
                          disabled={pendingId !== null}
                          title="Settle pays the invoice's full face value to you (the current owner) and marks it Settled — completing the deal and boosting the seller's reputation."
                          className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {pendingId === inv.id ? 'Processing…' : 'Settle'}
                        </button>
                        {isPastDue && (
                          <button
                            onClick={() => handleMarkDefault(inv.id)}
                            disabled={pendingId !== null}
                            title="This invoice is past due and unpaid. Marking it Defaulted closes it and lowers the seller's reputation."
                            className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Mark Default
                          </button>
                        )}
                      </div>
                      {/* Inline explainer (mobile-friendly — feedback: a tooltip on "settle" helps first-timers). */}
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        <strong className="font-medium">Settle</strong> pays the invoice's full
                        value to you and closes the deal.
                        {isPastDue && ' Mark Default flags an unpaid, past-due invoice.'}
                      </p>
                    </div>
                  )}
                </InvoiceCard>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
