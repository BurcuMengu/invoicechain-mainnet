export const config = {
  network: 'testnet' as const,
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
  contractIds: {
    token: 'CA63PKCVFVYIHDVMRTRSK25E7YFBZGJWEXSCHUHM2LFCLSBFA7PEL7VK',
    marketplace: 'CAMG7TMIJ5FJ753ARMKBTFCLPBKX2GHESEQZLVAJO33AZTPNDNVBCXYR',
    reputation: 'CDEKX5WLSYOR54LUDEQ3UNIK7TDHEKE24U4FEA57XQBP7FGV3UVXIMCP',
  },
}
export type ContractName = keyof typeof config.contractIds
