import { useState, useEffect, useCallback } from 'react'
import { getMarketplace } from '../lib/clients'
import { readTx } from '../lib/tx'
import { parseContractError } from '../lib/errors'
import { captureError } from '../lib/analytics'
import type { Invoice, Status } from '../contracts/marketplace/src'

export type { Invoice, Status }

/**
 * Maps a Status discriminated union to a human-readable label.
 * Status shape from the generated contract bindings:
 *   { tag: "Listed" | "Funded" | "Settled" | "Defaulted" | "Cancelled", values: void }
 */
export function statusLabel(status: Status): string {
  return status.tag
}

export interface UseInvoicesResult {
  invoices: Invoice[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useOpenInvoices(): UseInvoicesResult {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const mkt = getMarketplace()
        const result = await readTx(await mkt.list_open())
        if (!cancelled) setInvoices(result)
      } catch (e) {
        captureError(e)
        if (!cancelled) setError(parseContractError(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [tick])

  return { invoices, loading, error, refetch }
}

export function useInvoicesByOwner(addr: string | null): UseInvoicesResult {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!addr) {
      setInvoices([])
      return
    }
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const mkt = getMarketplace()
        const result = await readTx(await mkt.list_by_owner({ owner: addr }))
        if (!cancelled) setInvoices(result)
      } catch (e) {
        captureError(e)
        if (!cancelled) setError(parseContractError(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [addr, tick])

  return { invoices, loading, error, refetch }
}

export function useInvoicesBySeller(addr: string | null): UseInvoicesResult {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!addr) {
      setInvoices([])
      return
    }
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const mkt = getMarketplace()
        const result = await readTx(await mkt.list_by_seller({ seller: addr }))
        if (!cancelled) setInvoices(result)
      } catch (e) {
        captureError(e)
        if (!cancelled) setError(parseContractError(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [addr, tick])

  return { invoices, loading, error, refetch }
}
