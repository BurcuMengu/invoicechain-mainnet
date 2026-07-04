import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
  type ModuleInterface,
} from '@creit.tech/stellar-wallets-kit'
import {
  WalletConnectModule,
  WalletConnectAllowedMethods,
} from '@creit.tech/stellar-wallets-kit/modules/walletconnect.module'

// WalletConnect lets mobile wallets (Lobstr, xBull, etc.) connect via QR /
// deep-link — needed because browser-extension wallets (Freighter) don't work
// in mobile browsers. Requires a free WalletConnect (Reown) Cloud project id,
// supplied at build time. When absent, we simply omit WalletConnect and the
// extension-based wallets keep working exactly as before.
const WC_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined

const modules: ModuleInterface[] = allowAllModules()

if (WC_PROJECT_ID) {
  modules.push(
    new WalletConnectModule({
      projectId: WC_PROJECT_ID,
      name: 'InvoiceChain',
      description: 'Invoice tokenization & factoring marketplace on Stellar',
      url: 'https://burcumengu.github.io/invoicechain/',
      icons: ['https://burcumengu.github.io/invoicechain/vite.svg'],
      method: WalletConnectAllowedMethods.SIGN,
      network: WalletNetwork.TESTNET,
    }),
  )
}

export const kit = new StellarWalletsKit({
  network: WalletNetwork.TESTNET,
  selectedWalletId: FREIGHTER_ID,
  modules,
})

export async function pickAndConnect(): Promise<{ address: string; walletId: string }> {
  return new Promise((resolve, reject) => {
    kit.openModal({
      onWalletSelected: async (option) => {
        try {
          kit.setWallet(option.id)
          const { address } = await kit.getAddress()
          resolve({ address, walletId: option.id })
        } catch (e) {
          reject(e)
        }
      },
      onClosed: (err) => reject(err ?? new Error('cancelled')),
    })
  })
}

export async function signTx(xdr: string, networkPassphrase: string): Promise<string> {
  const { signedTxXdr } = await kit.signTransaction(xdr, { networkPassphrase })
  return signedTxXdr
}
