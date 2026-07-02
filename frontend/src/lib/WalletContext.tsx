import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { pickAndConnect, signTx, kit } from './wallet'
import { config } from './config'

type WalletState = {
  address: string | null
  connect: () => Promise<void>
  disconnect: () => void
  signTransaction: (xdr: string) => Promise<string>
}

const Ctx = createContext<WalletState | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(
    () => localStorage.getItem('ic_addr'),
  )

  // On mount, if a wallet was previously selected, restore it on the kit so
  // that signing after a page reload targets the correct wallet/account.
  useEffect(() => {
    const savedId = localStorage.getItem('ic_wallet_id')
    const savedAddr = localStorage.getItem('ic_addr')
    if (savedId && savedAddr) {
      kit.setWallet(savedId)
    }
  }, [])

  const connect = useCallback(async () => {
    const { address: a, walletId } = await pickAndConnect()
    localStorage.setItem('ic_addr', a)
    localStorage.setItem('ic_wallet_id', walletId)
    setAddress(a)
  }, [])

  const disconnect = useCallback(() => {
    localStorage.removeItem('ic_addr')
    localStorage.removeItem('ic_wallet_id')
    setAddress(null)
  }, [])

  const signTransaction = useCallback(
    (xdr: string) => signTx(xdr, config.networkPassphrase),
    [],
  )

  return (
    <Ctx.Provider value={{ address, connect, disconnect, signTransaction }}>
      {children}
    </Ctx.Provider>
  )
}

export function useWallet(): WalletState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useWallet must be used within WalletProvider')
  return v
}
