// Network + contract configuration.
//
// Defaults target Stellar TESTNET so local dev and the existing testnet
// deployment work with no env setup. To point the app at MAINNET (WS2), set the
// VITE_* vars below at build time (see frontend/.env.example) — no code change:
//   VITE_NETWORK=mainnet
//   VITE_RPC_URL=...            (optional; sensible mainnet default used otherwise)
//   VITE_MARKETPLACE_ID / VITE_TOKEN_ID / VITE_REPUTATION_ID  (from deployments/mainnet.json)
const env = import.meta.env

const TESTNET = {
  rpcUrl: 'https://soroban-testnet.stellar.org',
  passphrase: 'Test SDF Network ; September 2015',
  token: 'CBROMO54YLXSBAU2EDLJDJ7B2LNWGI366W4WMOULJVOFNBQDAZZLCAZA',
  marketplace: 'CDSLEGLUKSZ7X3M2I7DRP2PTKAGJOTAIZ5FVQVFJWTJBMZTJXRLDEUQD',
  reputation: 'CAX2MPXBTI7QTHZ5G6IWXGLFMXDF2IMQIHSKYQRDNGAO3ZVMY6VBO3K3',
}

const network: 'testnet' | 'mainnet' =
  (env.VITE_NETWORK as 'testnet' | 'mainnet' | undefined) === 'mainnet' ? 'mainnet' : 'testnet'
const isMainnet = network === 'mainnet'

export const config = {
  network,
  isMainnet,
  rpcUrl: (env.VITE_RPC_URL as string | undefined) ??
    (isMainnet ? 'https://mainnet.sorobanrpc.com' : TESTNET.rpcUrl),
  networkPassphrase: (env.VITE_NETWORK_PASSPHRASE as string | undefined) ??
    (isMainnet ? 'Public Global Stellar Network ; September 2015' : TESTNET.passphrase),
  contractIds: {
    // On mainnet these MUST come from env (deployments/mainnet.json); the testnet
    // constants are only a dev fallback and are never valid on mainnet.
    token: (env.VITE_TOKEN_ID as string | undefined) ?? TESTNET.token,
    marketplace: (env.VITE_MARKETPLACE_ID as string | undefined) ?? TESTNET.marketplace,
    reputation: (env.VITE_REPUTATION_ID as string | undefined) ?? TESTNET.reputation,
  },
  // Testnet-only faucet/ramp UI must be hidden on mainnet (real USDC, no faucet).
  faucetEnabled: !isMainnet,
  sponsorEnabled: !!env.VITE_SPONSOR_URL,
}
export type ContractName = keyof typeof config.contractIds
