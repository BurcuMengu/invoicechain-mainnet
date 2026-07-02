import { useEffect, useState, useCallback } from 'react'
import { useWallet } from '../lib/WalletContext'
import { getToken } from '../lib/clients'
import { readTx } from '../lib/tx'
import { fromStroops } from '../lib/format'

function truncate(addr: string) {
  return addr.slice(0, 4) + '…' + addr.slice(-4)
}

export default function WalletBar() {
  const { address, connect, disconnect } = useWallet()
  const [balance, setBalance] = useState<string | null>(null)
  const [balError, setBalError] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchBalance = useCallback(async (addr: string) => {
    setLoading(true)
    setBalError(false)
    try {
      const token = getToken()
      const assembled = await token.balance({ id: addr })
      const raw = await readTx(assembled)
      setBalance(fromStroops(raw as bigint))
    } catch {
      setBalError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (address) {
      void fetchBalance(address)
    } else {
      setBalance(null)
      setBalError(false)
    }
  }, [address, fetchBalance])

  if (!address) {
    return (
      <button
        onClick={() => void connect()}
        className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3 py-1.5 rounded transition-colors"
      >
        Connect Wallet
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-mono text-gray-700 dark:text-gray-300">{truncate(address)}</span>
      <span className="text-gray-400">|</span>
      {loading ? (
        <span className="text-gray-400 animate-pulse">…</span>
      ) : balError ? (
        <button
          onClick={() => void fetchBalance(address)}
          className="text-red-500 hover:text-red-600 text-xs"
          title="Failed to load balance — click to retry"
        >
          ↻ retry
        </button>
      ) : (
        <span className="text-gray-700 dark:text-gray-300">
          {balance ?? '—'} USDC
        </span>
      )}
      {!loading && !balError && balance !== null && (
        <button
          onClick={() => void fetchBalance(address)}
          className="text-gray-400 hover:text-gray-600 text-xs"
          title="Refresh balance"
        >
          ↻
        </button>
      )}
      <button
        onClick={disconnect}
        className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs px-2 py-1 rounded transition-colors"
      >
        Disconnect
      </button>
    </div>
  )
}
