import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useWallet } from './WalletContext'
import { getToken } from './clients'
import { readTx } from './tx'
import { parseContractError } from './errors'
import { captureError } from './analytics'

type BalanceState = {
  balance: bigint | null
  loading: boolean
  error: string | null
  refresh: () => void
}

const Ctx = createContext<BalanceState | null>(null)

export function BalanceProvider({ children }: { children: ReactNode }) {
  const { address } = useWallet()
  const [balance, setBalance] = useState<bigint | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!address) {
      setBalance(null)
      setError(null)
      return
    }

    let cancelled = false

    const run = async () => {
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

    run()
    return () => { cancelled = true }
  }, [address, tick])

  return (
    <Ctx.Provider value={{ balance, loading, error, refresh }}>
      {children}
    </Ctx.Provider>
  )
}

export function useBalanceCtx(): BalanceState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useBalanceCtx must be used within BalanceProvider')
  return v
}
