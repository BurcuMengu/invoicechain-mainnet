import { useState, useEffect, useCallback } from 'react'
import { getToken } from '../lib/clients'
import { parseContractError } from '../lib/errors'
import { captureError } from '../lib/analytics'
import { readTx } from '../lib/tx'

export interface UseBalanceResult {
  balance: bigint | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useBalance(address: string | null): UseBalanceResult {
  const [balance, setBalance] = useState<bigint | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!address) {
      setBalance(null)
      setError(null)
      return
    }

    let cancelled = false

    const fetch = async () => {
      setLoading(true)
      setError(null)
      try {
        const token = getToken()
        const assembled = await token.balance({ id: address })
        const result = await readTx(assembled)
        if (!cancelled) setBalance(result as unknown as bigint)
      } catch (e) {
        captureError(e)
        if (!cancelled) setError(parseContractError(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [address, tick])

  return { balance, loading, error, refetch }
}
