# InvoiceChain — WS3: Fee Sponsorship (Gasless Onboarding) — Design / Spec

- **Date:** 2026-07-16
- **Repo:** `BurcuMengu/invoicechain-mainnet`
- **Level 6 workstream:** WS3 — Advanced feature (R12)
- **Master spec:** [`2026-07-10-level6-mainnet-launch-design.md`](2026-07-10-level6-mainnet-launch-design.md)
- **Previous workstream:** WS0 (audit) ✅, WS1 (mainnet deploy script) ✅

## 1. Purpose

Enable a new user to perform their first marketplace actions **without holding any XLM**
(gasless onboarding). This removes the main friction — the "you must acquire XLM before
transacting" wall — for **R6 (20+ real mainnet users)**, Level 6's toughest requirement.
It is also the required **advanced feature (R12)** proof.

## 2. Scope

**In scope:**
- A connected wallet's (Stellar Wallets Kit) **first N marketplace transactions** (`create_invoice`,
  `buy_invoice`, `settle`) having their **transaction fee** paid by a sponsor via **fee-bump**.
  The user signs their transaction; the sponsor pays the network fee.
- Sponsorship is performed via **Launchtube** (Stellar's hosted submit/fee-bump service).
- A **minimal Cloudflare Worker proxy** that keeps the sponsor credential (Launchtube token)
  secret and enforces per-user limits.
- **Transparent fallback** when sponsorship is not available (feature disabled, limit reached, error):
  the existing "wallet pays the fee" path.

**Out of scope:**
- **Account creation / min-reserve funding.** The wallet the user connects is assumed to be an
  already-existing Stellar account (G-address). Here, gasless means "**you don't need to hold XLM
  for fees**", not "you don't need to have an account".
- Passkey / smart-wallet (contract account) integration.
- Sponsoring non-marketplace transactions.

## 3. Architecture

Three components; each with a single responsibility, a well-defined interface, and independently testable.

```
[Frontend]  build+sign invoke tx
     │  signed XDR (POST)
     ▼
[Cloudflare Worker proxy]  ── token secret, allowlist + rate-limit ──►  [Launchtube]  ──►  Stellar network
     │  (limit/allowlist rejection → 4xx)                                   fee-bump + submit
     ▼
[Frontend]  success → tx result;  rejection/error → fall back to normal wallet-pays path
```

### 3.1 Frontend client module — `frontend/src/lib/feeSponsor.ts`
A single public function, e.g.:
```ts
// enabled = !!import.meta.env.VITE_SPONSOR_URL
submitSponsored(signedXdr: string): Promise<{ hash: string } | SponsorUnavailable>
```
- If `VITE_SPONSOR_URL` is unset → returns `SponsorUnavailable` (the caller falls back to the normal path).
- POSTs the signed XDR to the Worker; 2xx → tx hash; 429/403/5xx → `SponsorUnavailable`.
- **Security/access logic is not kept on the client** (it can be bypassed); the client only
  does "try, and fall back if it fails". The real gate is in the Worker.

### 3.2 Cloudflare Worker proxy — `sponsor-worker/` (new, separate package)
A single `src/index.ts`. Its responsibilities:
1. **Parse & validate:** Decode the incoming signed XDR with `@stellar/stellar-sdk`. It must have
   exactly one `InvokeHostFunction` op; the invoked contract must be **`MARKETPLACE_ID`** and the
   function must be in the **allowlist** (`create_invoice`/`buy_invoice`/`settle`); otherwise `403`.
2. **Rate-limit:** Cloudflare **KV** counters keyed on the transaction's source account
   (the user's G-address) and the request IP:
   - **N (default 3)** sponsored transactions per address, lifetime,
   - a **daily** cap per IP (KV TTL 24h).
   - If exceeded, `429`.
3. **Forward:** POST the validated XDR to `LAUNCHTUBE_URL` with the secret `LAUNCHTUBE_TOKEN`;
   Launchtube fee-bumps + submits. Return the result to the client.
- **Secrets** (Worker env, never in the frontend): `LAUNCHTUBE_URL`, `LAUNCHTUBE_TOKEN`,
  `MARKETPLACE_ID`, `PER_ADDRESS_LIMIT`, `PER_IP_DAILY_LIMIT`.

### 3.3 Frontend integration
In the existing contract-invoke path (`frontend/src/lib/` / the relevant hook), after signing:
`submitSponsored(xdr)` is attempted; if it returns `SponsorUnavailable`, fall back to the existing
`rpc.sendTransaction` path. When applicable, show the user a **"⚡ Gasless"** badge; on fallback,
silently continue the normal flow. It is all env-gated by `VITE_SPONSOR_URL` — the feature can be
turned on and off, and it does not break existing behavior.

## 4. Abuse / security model

| Layer | Protection |
|---|---|
| Token secrecy | The Launchtube token lives only in the Worker env; never in the frontend. |
| Allowlist | Only `MARKETPLACE_ID` + `create/buy/settle`; any other contract/function is rejected. |
| Per-user limit | KV: N per address, lifetime; a daily cap per IP. |
| Global bound | Launchtube token quota (upper bound; when exhausted, fallback). |
| Fail-safe | Worker/limit/error → client falls back to the normal wallet-pays path; the tx still completes. |

**Residual risk (documented):** Due to KV eventual consistency, the per-address limit is "soft"
rather than hard (a few extras under a race). Acceptable; the true global cap is the Launchtube
quota. Sybil (many addresses) cannot be fully solved — it is bounded by the IP cap + a small N.

## 5. Configuration

- **Frontend:** `VITE_SPONSOR_URL` (Worker URL). If unset, the feature is disabled and the existing flow is unchanged.
- **Worker (secrets):** `LAUNCHTUBE_URL`, `LAUNCHTUBE_TOKEN`, `MARKETPLACE_ID`,
  `PER_ADDRESS_LIMIT=3`, `PER_IP_DAILY_LIMIT`. `wrangler.toml` + KV namespace binding.
- **[U] user steps:** Obtain a Launchtube token, set up a Cloudflare account + `wrangler deploy`,
  set the secrets, and add `VITE_SPONSOR_URL` to the frontend env.

## 6. Testing

- **`feeSponsor.ts`** (vitest + jsdom): (a) `SponsorUnavailable` when `VITE_SPONSOR_URL` is unset;
  (b) returns hash on 2xx; (c) fallback signal on 429/403/5xx; (d) fallback on a fetch error.
  (The Worker `fetch` is mocked.)
- **Worker** (vitest + Miniflare/`unstable_dev`): (a) non-marketplace contract → 403;
  (b) non-allowlisted function → 403; (c) forward under the limit (Launchtube mocked) → 2xx;
  (d) exceeding N → 429; (e) IP daily cap → 429.

## 7. Verification & Exit Criteria

- [ ] `feeSponsor.ts` + Worker implemented, all unit tests green.
- [ ] Feature env-gated by `VITE_SPONSOR_URL`; when off, existing frontend tests pass unchanged.
- [ ] Allowlist + rate-limit enforced in the Worker and tested.
- [ ] An end-to-end **real gasless invoke** works on testnet (ready for mainnet).
- [ ] The gasless flow and `[U]` setup steps are documented in the README/user-guide (WS5).

## 8. Relationship to next steps

The WS3 deliverable satisfies R12 (advanced feature) and directly supports R6 (20+ users).
Bringing the frontend to mainnet is completed in **WS2**, and the setup documentation in **WS5**.
`create_invoice` now taking `debtor: Address` (audit IC-02) also requires a frontend form change (WS2)
— the sponsored `create` flow must include this.
