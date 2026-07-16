# InvoiceChain Sponsor Worker

A minimal Cloudflare Worker that makes **onboarding gasless**: it fee-sponsors a
new user's first few marketplace actions via [Launchtube](https://launchtube.xyz),
so they never need XLM for transaction fees.

The frontend signs a Soroban transaction and POSTs the signed XDR here. The Worker:

1. **Validates** the tx is a single `InvokeHostFunction` calling an allowlisted
   function — the marketplace `create_invoice` / `buy_invoice` / `settle`, or the
   USDC token `approve` (needed before buy/settle). Anything else → `403`.
2. **Rate-limits** per source address (lifetime `PER_ADDRESS_LIMIT`) and per IP
   (daily `PER_IP_DAILY_LIMIT`) using a KV namespace. Over limit → `429`.
3. **Forwards** the tx to Launchtube with the secret token, which fee-bumps and
   submits it. Returns `{ hash }`.

The Launchtube token stays server-side; the frontend never sees it. If the Worker
is unreachable, over quota, or errors, the frontend falls back to the normal
wallet-pays-fee path, so transactions still complete.

## Local test

```bash
cd sponsor-worker
npm install
npx vitest run      # validate + worker unit tests (in-memory KV + stubbed fetch)
```

## Deploy (operator steps — `[U]`)

Requires a Cloudflare account, `wrangler`, and a Launchtube token.

```bash
cd sponsor-worker
npm install

# 1. Create the rate-limit KV namespace and paste the printed id into wrangler.toml (kv_namespaces.id)
npx wrangler kv namespace create RL

# 2. Fill wrangler.toml [vars]:
#    MARKETPLACE_ID  = your mainnet marketplace contract id (deployments/mainnet.json)
#    TOKEN_ID        = the canonical USDC SAC id (same value passed to deploy_mainnet.sh)
#    NETWORK_PASSPHRASE stays "Public Global Stellar Network ; September 2015" for mainnet
#    PER_ADDRESS_LIMIT / PER_IP_DAILY_LIMIT to taste

# 3. Set the secrets (NEVER commit these):
npx wrangler secret put LAUNCHTUBE_URL      # e.g. https://launchtube.xyz (mainnet endpoint)
npx wrangler secret put LAUNCHTUBE_TOKEN    # your Launchtube bearer token

# 4. Deploy
npx wrangler deploy
```

Then set the deployed Worker URL in the frontend build env:

```bash
# frontend/.env (or CI/Pages env)
VITE_SPONSOR_URL=https://invoicechain-sponsor.<your-subdomain>.workers.dev
```

With `VITE_SPONSOR_URL` set, the app routes create/buy/settle (and their `approve`
step) through the sponsor and shows a "⚡ Gasless" toast when a fee was sponsored.
Leave it unset to disable the feature entirely (behavior is identical to before).

## Config reference

| Var | Where | Meaning |
| --- | --- | --- |
| `MARKETPLACE_ID` | `wrangler.toml [vars]` | Allowlisted marketplace contract id |
| `TOKEN_ID` | `wrangler.toml [vars]` | Allowlisted USDC SAC id (for `approve`) |
| `NETWORK_PASSPHRASE` | `wrangler.toml [vars]` | Network the XDR is parsed against |
| `PER_ADDRESS_LIMIT` | `wrangler.toml [vars]` | Lifetime sponsored txs per address |
| `PER_IP_DAILY_LIMIT` | `wrangler.toml [vars]` | Daily sponsored txs per IP |
| `LAUNCHTUBE_URL` | **secret** | Launchtube submit endpoint |
| `LAUNCHTUBE_TOKEN` | **secret** | Launchtube bearer token (never committed) |

See [`docs/superpowers/specs/2026-07-16-fee-sponsorship-design.md`](../docs/superpowers/specs/2026-07-16-fee-sponsorship-design.md)
for the full design and abuse model.
