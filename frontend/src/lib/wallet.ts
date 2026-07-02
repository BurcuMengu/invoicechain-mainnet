import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
} from '@creit.tech/stellar-wallets-kit'

export const kit = new StellarWalletsKit({
  network: WalletNetwork.TESTNET,
  selectedWalletId: FREIGHTER_ID,
  modules: allowAllModules(),
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
