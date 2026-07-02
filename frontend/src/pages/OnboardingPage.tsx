import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '../lib/WalletContext'
import { useToast } from '../lib/ToastContext'
import { getToken } from '../lib/clients'
import { runTx } from '../lib/tx'
import { fromStroops } from '../lib/format'
import { useBalance } from '../hooks/useBalance'

export default function OnboardingPage() {
  const { address, connect, signTransaction } = useWallet()
  const toast = useToast()
  const { balance, loading: balanceLoading, refetch } = useBalance(address)
  const [claiming, setClaiming] = useState(false)

  const handleClaim = async () => {
    if (!address) return
    setClaiming(true)
    try {
      const token = getToken(signTransaction, address)
      const assembled = await token.faucet({ to: address })
      await runTx(assembled)
      toast.success('1000 USDC claimed successfully!')
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setClaiming(false)
    }
  }

  const hasBalance = balance !== null && balance > 0n

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to InvoiceChain</h1>
          <p className="mt-2 text-gray-500">Complete these steps to get started</p>
        </div>

        <div className="space-y-4">
          {/* Step 1: Connect Wallet */}
          <div className={`bg-white rounded-xl border p-6 ${address ? 'border-green-300' : 'border-gray-200'}`}>
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${address ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}>
                {address ? '✓' : '1'}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900">Connect your wallet</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Connect a Stellar testnet wallet to get started.
                </p>
                {address ? (
                  <p className="mt-3 text-sm font-mono text-green-700 bg-green-50 px-3 py-1.5 rounded break-all">
                    {address}
                  </p>
                ) : (
                  <button
                    onClick={connect}
                    className="mt-4 w-full bg-indigo-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Connect Wallet
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: Claim USDC */}
          <div className={`bg-white rounded-xl border p-6 ${hasBalance ? 'border-green-300' : 'border-gray-200'}`}>
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${hasBalance ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}>
                {hasBalance ? '✓' : '2'}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900">Claim 1000 test USDC</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Get test USDC from the faucet to use on the marketplace.
                </p>

                {balance !== null && (
                  <p className="mt-2 text-sm text-gray-700">
                    Current balance:{' '}
                    <span className="font-semibold text-indigo-700">
                      {balanceLoading ? '…' : `${fromStroops(balance)} USDC`}
                    </span>
                  </p>
                )}

                <button
                  onClick={handleClaim}
                  disabled={!address || claiming}
                  className="mt-4 w-full bg-indigo-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {claiming ? 'Claiming…' : 'Claim 1000 USDC'}
                </button>
              </div>
            </div>
          </div>

          {/* Step 3: Go to Marketplace */}
          <div className={`bg-white rounded-xl border p-6 ${hasBalance ? 'border-indigo-300' : 'border-gray-200 opacity-60'}`}>
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${hasBalance ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                3
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900">You're ready!</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Head to the marketplace to buy and sell invoices.
                </p>
                {hasBalance ? (
                  <Link
                    to="/"
                    className="mt-4 block w-full text-center bg-green-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors"
                  >
                    Go to Marketplace →
                  </Link>
                ) : (
                  <button
                    disabled
                    className="mt-4 w-full bg-gray-200 text-gray-400 py-2.5 px-4 rounded-lg font-medium cursor-not-allowed"
                  >
                    Go to Marketplace →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
