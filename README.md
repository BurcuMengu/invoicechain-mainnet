# InvoiceChain

InvoiceChain is an invoice tokenization and factoring marketplace built on
Stellar (Soroban). Businesses tokenize an unpaid invoice on-chain and sell it at
a discount to a buyer who wants yield; the buyer fronts cash today and collects
the full face value when the invoice settles. The full lifecycle lives on
chain — **create → sell at a discount → settle → reputation** — with explicit
handling for invoices that **default** (go unpaid past their due date). Every
settle or default updates the issuer's on-chain trust score, so good payers earn
a better reputation over time. A React frontend ties it together with a
Freighter wallet connection and a testnet faucet for demo USDC.

## Live demo

**https://burcumengu.github.io/invoicechain/** — running on Stellar **testnet**.
Connect a Freighter wallet, claim test USDC from the in-app faucet, then create,
buy, and settle invoices. (No real funds — testnet only.)

![InvoiceChain demo](docs/demo.gif)

## Screenshots

### Desktop

| Marketplace | Create invoice | Fiat ramp (mock) |
|---|---|---|
| ![Marketplace](docs/screenshots/desktop-marketplace.png) | ![Create invoice](docs/screenshots/desktop-create.png) | ![Fiat ramp](docs/screenshots/desktop-ramp.png) |

### Mobile responsive

| Marketplace | Create | Fiat ramp |
|---|---|---|
| ![Marketplace mobile](docs/screenshots/mobile-marketplace.png) | ![Create mobile](docs/screenshots/mobile-create.png) | ![Ramp mobile](docs/screenshots/mobile-ramp.png) |

## Architecture

Three Soroban contracts and a React single-page app:

- **`marketplace`** (core) — the create → buy → settle → default loop. Holds
  invoice records, escrows the buyer's payment, transfers the settlement, and
  calls into the reputation contract on each terminal outcome. Admin-configured
  with the payment token and the reputation contract address (`set_reputation`).
- **`reputation`** — an on-chain trust score per issuer. Score-mutating entry
  points are **gated to the marketplace contract** (it checks the caller is the
  configured marketplace), so scores can only move as a result of real
  settle/default events, never by arbitrary callers.
- **`test_token`** — a SEP-41 fungible token used as the payment asset (a mock
  "USDC") plus a `faucet` function so anyone can claim demo funds on testnet.

```
                         ┌─────────────────────┐
     create / buy /      │                     │  set_reputation (admin)
     settle / default    │     marketplace     │◄───────────────┐
   ┌────────────────────►│       (core)        │                │
   │                     │                     │                │
   │                     └──────┬──────────┬───┘                │
   │                            │          │                    │
 ┌─┴──────┐   SEP-41 transfer   │          │ cross-contract     │
 │ React  │◄────────────────────┘          │ score updates      │
 │  app   │      ┌──────────────┐          ▼                    │
 │(browser│─────►│  test_token  │   ┌──────────────┐            │
 │ + wallet)     │ (SEP-41 +    │   │  reputation  │────────────┘
 └────────┘ faucet│  faucet)    │   │ (gated to    │  caller must be
                  └──────────────┘   │  marketplace)│  marketplace
                                     └──────────────┘
```

- **Create**: an issuer registers an invoice (face value, discount, due date).
- **Buy**: a buyer pays the discounted price; `test_token` moves funds via
  SEP-41 `transfer`, and the marketplace records the buyer as the holder.
- **Settle**: the issuer repays face value; the buyer collects, and the
  marketplace calls `reputation` to raise the issuer's score.
- **Default**: if the due date passes unpaid, the invoice is marked defaulted
  and the marketplace calls `reputation` to lower the issuer's score.

The **frontend** (React + Vite + TypeScript + Tailwind) talks to all three
contracts through generated TypeScript bindings and signs transactions with the
Freighter wallet.

## Deployed on Stellar testnet

| Component   | Contract ID / Address                                      |
| ----------- | ---------------------------------------------------------- |
| token       | `CBROMO54YLXSBAU2EDLJDJ7B2LNWGI366W4WMOULJVOFNBQDAZZLCAZA` |
| marketplace | `CDSLEGLUKSZ7X3M2I7DRP2PTKAGJOTAIZ5FVQVFJWTJBMZTJXRLDEUQD` |
| reputation  | `CAX2MPXBTI7QTHZ5G6IWXGLFMXDF2IMQIHSKYQRDNGAO3ZVMY6VBO3K3` |
| admin       | `GD5HVOD6ZANYONRKCCDNQSSOSF5NLVW5UFY4OD4WBXSVM6E43KUB5JY2` |

- **Network:** testnet
- **RPC:** `https://soroban-testnet.stellar.org`

## Prerequisites

- **Rust 1.96.0** with the `wasm32v1-none` target (pinned in
  `rust-toolchain.toml`)
- **Stellar CLI** (`stellar`) for building, deploying, and generating bindings
- **Node.js 18+** and **npm** for the frontend

## Contracts: build & test

From the repo root:

```bash
# Run the contract unit tests
cargo test

# Build the optimized wasm for all three contracts
stellar contract build

# Deploy all three to testnet and record IDs in deployments/testnet.json.
# <identity> is a funded testnet key; create one with:
#   stellar keys generate deployer --network testnet --fund
./scripts/deploy_testnet.sh <identity>
```

The deploy script builds and optimizes the wasm, deploys `test_token`,
`marketplace`, and `reputation`, wires the marketplace to the reputation
contract, and writes the resulting IDs to `deployments/testnet.json`.

## Frontend: run

```bash
cd frontend
npm install
npm run dev      # start the Vite dev server
```

Other useful scripts:

```bash
npm run build    # type-check and produce a production build in dist/
npm test         # run the Vitest suite
npm run lint     # ESLint
```

The TypeScript contract bindings under `frontend/src/contracts/` are generated
with `frontend/scripts/gen-bindings.sh` but are **committed**, so no
regeneration is needed to run the app. Re-run that script only if you redeploy
the contracts.

## How to use the app

1. **Connect a wallet** — use the [Freighter](https://www.freighter.app/) wallet
   set to the Stellar **testnet**.
2. **Claim demo USDC** — on the onboarding page (or the ramp page), claim test
   USDC from the faucet so you have funds to trade with.
3. **Create, buy, and settle invoices** — create an invoice as an issuer, buy a
   discounted invoice from the marketplace as a buyer, and settle it to release
   funds and update the issuer's reputation.

The on/off-ramp page is a **mock ramp**: deposits mint test USDC via the faucet
and withdrawals are **simulated** — this is testnet only, so no real fiat ever
moves.

## Repo layout

```
invoicechain/
├── contracts/          # Soroban (Rust) contracts
│   ├── marketplace/    #   core create→buy→settle→default loop
│   ├── reputation/     #   trust score, gated to the marketplace
│   └── test_token/     #   SEP-41 token + faucet
├── frontend/           # React + Vite + TypeScript + Tailwind app
│   ├── src/            #   pages, components, hooks, lib
│   └── src/contracts/  #   committed generated TS bindings
├── scripts/            # deploy_testnet.sh
├── deployments/        # testnet.json (deployed contract IDs)
└── docs/               # design notes and specs
```

## License

MIT — see [LICENSE](LICENSE).
