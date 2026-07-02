export const config = {
  network: 'testnet' as const,
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
  contractIds: {
    token: 'CBROMO54YLXSBAU2EDLJDJ7B2LNWGI366W4WMOULJVOFNBQDAZZLCAZA',
    marketplace: 'CDSLEGLUKSZ7X3M2I7DRP2PTKAGJOTAIZ5FVQVFJWTJBMZTJXRLDEUQD',
    reputation: 'CAX2MPXBTI7QTHZ5G6IWXGLFMXDF2IMQIHSKYQRDNGAO3ZVMY6VBO3K3',
  },
}
export type ContractName = keyof typeof config.contractIds
