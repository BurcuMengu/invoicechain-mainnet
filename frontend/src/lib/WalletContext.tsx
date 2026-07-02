import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { pickAndConnect, signTx } from './wallet'
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

  const connect = useCallback(async () => {
    const a = await pickAndConnect()
    localStorage.setItem('ic_addr', a)
    setAddress(a)
  }, [])

  const disconnect = useCallback(() => {
    localStorage.removeItem('ic_addr')
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
