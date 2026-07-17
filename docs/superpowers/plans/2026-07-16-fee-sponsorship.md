# Fee Sponsorship (Gasless Onboarding) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a connected wallet's first N marketplace actions be fee-sponsored via Launchtube so new users need no XLM for fees.

**Architecture:** A frontend client module (`feeSponsor.ts`) signs a contract invoke and POSTs the signed XDR to a minimal Cloudflare Worker proxy. The Worker holds the Launchtube token secret, enforces an allowlist (marketplace contract + create/buy/settle) and per-address/per-IP rate limits via KV, then forwards to Launchtube which fee-bumps and submits. If sponsorship is disabled/blocked/errored, the frontend transparently falls back to the existing wallet-pays-fee path.

**Tech Stack:** TypeScript, React (Vite), `@stellar/stellar-sdk` v14 (`contract.AssembledTransaction`), Vitest + jsdom, Cloudflare Workers (`wrangler`, KV), Launchtube.

## Global Constraints

- Feature is env-gated by `VITE_SPONSOR_URL`; when unset, behavior is byte-for-byte the existing flow. (Spec §3.3, §5)
- The Launchtube token lives ONLY in Worker env, NEVER in frontend code/bundle. (Spec §4)
- Only `create_invoice` / `buy_invoice` / `settle` on the configured `MARKETPLACE_ID` may be sponsored; anything else → HTTP 403. (Spec §3.2, §4)
- Rate limits: `PER_ADDRESS_LIMIT` (default 3, lifetime) and `PER_IP_DAILY_LIMIT` (KV TTL 24h). Over limit → HTTP 429. (Spec §3.2, §4)
- Any sponsor failure (disabled/4xx/5xx/network) must fall back to the normal submit path so the tx still completes. (Spec §3.1, §4)
- Account creation / min-reserve funding is OUT OF SCOPE; assume the wallet has an existing account. (Spec §2)
- TDD: failing test first; small commits per task.

---

### Task 1: `feeSponsor.ts` client module

**Files:**
- Create: `frontend/src/lib/feeSponsor.ts`
- Test: `frontend/src/lib/feeSponsor.test.ts`

**Interfaces:**
- Produces:
  - `isSponsorEnabled(): boolean`
  - `type SponsorResult = { sponsored: true; hash: string } | { sponsored: false; reason: 'disabled' | 'unavailable' }`
  - `submitSponsored(signedXdr: string): Promise<SponsorResult>`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/lib/feeSponsor.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isSponsorEnabled, submitSponsored } from './feeSponsor'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('feeSponsor', () => {
  it('is disabled when VITE_SPONSOR_URL is unset', async () => {
    vi.stubEnv('VITE_SPONSOR_URL', '')
    expect(isSponsorEnabled()).toBe(false)
    expect(await submitSponsored('XDR')).toEqual({ sponsored: false, reason: 'disabled' })
  })

  it('returns hash on a 2xx sponsor response', async () => {
    vi.stubEnv('VITE_SPONSOR_URL', 'https://sponsor.example/submit')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ hash: 'abc123' }), { status: 200 })))
    expect(await submitSponsored('XDR')).toEqual({ sponsored: true, hash: 'abc123' })
  })

  it('falls back (unavailable) on 429/403/5xx', async () => {
    vi.stubEnv('VITE_SPONSOR_URL', 'https://sponsor.example/submit')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 429 })))
    expect(await submitSponsored('XDR')).toEqual({ sponsored: false, reason: 'unavailable' })
  })

  it('falls back (unavailable) on a network error', async () => {
    vi.stubEnv('VITE_SPONSOR_URL', 'https://sponsor.example/submit')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await submitSponsored('XDR')).toEqual({ sponsored: false, reason: 'unavailable' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/feeSponsor.test.ts`
Expected: FAIL — `Cannot find module './feeSponsor'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/lib/feeSponsor.ts
export type SponsorResult =
  | { sponsored: true; hash: string }
  | { sponsored: false; reason: 'disabled' | 'unavailable' }

const sponsorUrl = (): string => (import.meta.env.VITE_SPONSOR_URL as string | undefined) ?? ''

export function isSponsorEnabled(): boolean {
  return sponsorUrl() !== ''
}

/** POST a signed invoke XDR to the sponsor Worker. Never throws — any problem
 *  resolves to { sponsored: false } so the caller can fall back to normal submit. */
export async function submitSponsored(signedXdr: string): Promise<SponsorResult> {
  const url = sponsorUrl()
  if (url === '') return { sponsored: false, reason: 'disabled' }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ xdr: signedXdr }),
    })
    if (!res.ok) return { sponsored: false, reason: 'unavailable' }
    const data = (await res.json()) as { hash: string }
    return { sponsored: true, hash: data.hash }
  } catch {
    return { sponsored: false, reason: 'unavailable' }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/feeSponsor.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/feeSponsor.ts frontend/src/lib/feeSponsor.test.ts
git commit -m "feat(ws3): feeSponsor client module (env-gated, fail-safe fallback)"
```

---

### Task 2: Frontend submit integration + "⚡ Gasless" state

**Files:**
- Modify: `frontend/src/lib/tx.ts` (add `runTxSponsored`)
- Test: `frontend/src/lib/tx.test.ts` (create)

**Interfaces:**
- Consumes: `submitSponsored`, `isSponsorEnabled` from Task 1.
- Produces:
  - `type SubmitOutcome<T> = { result: T; sponsored: boolean }`
  - `runTxSponsored<T>(assembled: SponsorableTx<T>): Promise<SubmitOutcome<T>>`
  - where `SponsorableTx<T>` is the subset of `contract.AssembledTransaction` this uses:
    ```ts
    interface SponsorableTx<T> {
      signAuthEntries: () => Promise<void>        // no-op-safe; may be omitted by caller
      sign: (opts?: unknown) => Promise<void>     // populates .signed
      signed: { toXDR(): string } | null
      signAndSend: () => Promise<{ result: T }>   // existing fallback path
      result: T
    }
    ```

> **Binding note:** In `@stellar/stellar-sdk` v14 the contract client returns an
> `AssembledTransaction`. `signAndSend()` (used today in `runTx`) both signs and
> submits. To sponsor, we sign first (`await assembled.sign({ signTransaction })`),
> read the signed XDR (`assembled.signed!.toXDR()`), and hand it to the Worker.
> Confirm `sign`/`signed`/`toXDR` names against the installed SDK before Step 3; if
> the client instead exposes `assembled.built` + a `signTransaction` option, adapt
> the single call site accordingly. The fallback (`signAndSend()`) is unchanged.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/lib/tx.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as sponsor from './feeSponsor'
import { runTxSponsored } from './tx'

function fakeAssembled<T>(result: T, xdr = 'SIGNED_XDR') {
  return {
    sign: vi.fn(async () => {}),
    signed: { toXDR: () => xdr },
    signAndSend: vi.fn(async () => ({ result })),
    result,
  }
}

afterEach(() => vi.restoreAllMocks())

describe('runTxSponsored', () => {
  it('uses the sponsor path when it succeeds', async () => {
    vi.spyOn(sponsor, 'isSponsorEnabled').mockReturnValue(true)
    vi.spyOn(sponsor, 'submitSponsored').mockResolvedValue({ sponsored: true, hash: 'h1' })
    const asm = fakeAssembled('OK')
    const out = await runTxSponsored(asm)
    expect(out).toEqual({ result: 'OK', sponsored: true })
    expect(asm.sign).toHaveBeenCalledOnce()
    expect(asm.signAndSend).not.toHaveBeenCalled()
  })

  it('falls back to signAndSend when sponsor is unavailable', async () => {
    vi.spyOn(sponsor, 'isSponsorEnabled').mockReturnValue(true)
    vi.spyOn(sponsor, 'submitSponsored').mockResolvedValue({ sponsored: false, reason: 'unavailable' })
    const asm = fakeAssembled('OK')
    const out = await runTxSponsored(asm)
    expect(out).toEqual({ result: 'OK', sponsored: false })
    expect(asm.signAndSend).toHaveBeenCalledOnce()
  })

  it('uses normal path directly when sponsor disabled', async () => {
    vi.spyOn(sponsor, 'isSponsorEnabled').mockReturnValue(false)
    const spy = vi.spyOn(sponsor, 'submitSponsored')
    const asm = fakeAssembled('OK')
    const out = await runTxSponsored(asm)
    expect(out).toEqual({ result: 'OK', sponsored: false })
    expect(spy).not.toHaveBeenCalled()
    expect(asm.signAndSend).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/tx.test.ts`
Expected: FAIL — `runTxSponsored` is not exported.

- [ ] **Step 3: Write minimal implementation (append to `tx.ts`)**

```ts
// append to frontend/src/lib/tx.ts
import { isSponsorEnabled, submitSponsored } from './feeSponsor'

export interface SponsorableTx<T> {
  sign: (opts?: unknown) => Promise<void>
  signed: { toXDR(): string } | null
  signAndSend: () => Promise<{ result: T }>
  result: T
}

export type SubmitOutcome<T> = { result: T; sponsored: boolean }

/**
 * Submit an assembled contract call, preferring the fee-sponsor path when it is
 * enabled and succeeds; otherwise fall back to the normal wallet-pays-fee submit.
 * The returned `sponsored` flag drives the "⚡ Gasless" UI hint.
 */
export async function runTxSponsored<T>(assembled: SponsorableTx<T>): Promise<SubmitOutcome<T>> {
  try {
    if (isSponsorEnabled()) {
      await assembled.sign()
      const xdr = assembled.signed?.toXDR()
      if (xdr) {
        const res = await submitSponsored(xdr)
        if (res.sponsored) return { result: assembled.result, sponsored: true }
      }
      // Sponsor unavailable but tx already signed → submit via normal path.
      const sent = await assembled.signAndSend()
      return { result: sent.result, sponsored: false }
    }
    const sent = await assembled.signAndSend()
    return { result: sent.result, sponsored: false }
  } catch (e) {
    throw new TxError(parseContractError(e))
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/tx.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/tx.ts frontend/src/lib/tx.test.ts
git commit -m "feat(ws3): runTxSponsored — sponsor-first submit with fallback"
```

---

### Task 3: Wire `runTxSponsored` into create/buy/settle call sites + Gasless badge

**Files:**
- Modify: `frontend/src/pages/CreatePage.tsx` (create_invoice call site — also add the new `debtor` field required by audit IC-02)
- Modify: `frontend/src/pages/MarketplacePage.tsx` (buy_invoice call site)
- Modify: `frontend/src/pages/PortfolioPage.tsx` (settle call site, if present there)
- Modify: `frontend/src/lib/config.ts` (expose `sponsorEnabled` flag for UI)
- Test: covered by Task 1/2 unit tests + Task 5 manual e2e (UI wiring is thin glue).

**Interfaces:**
- Consumes: `runTxSponsored`, `SubmitOutcome` from Task 2; `getMarketplace` from `clients.ts`.

- [ ] **Step 1: Replace each `runTx(marketplace.create_invoice(...))` style call with `runTxSponsored(...)`**

For each call site currently shaped like:
```ts
const result = await runTx(marketplace.create_invoice({ /* args */ }))
```
change to:
```ts
const { result, sponsored } = await runTxSponsored(marketplace.create_invoice({ /* args */ }))
```
and use `sponsored` to toast/badge "⚡ Gasless" when true (reuse the existing `ToastContext`).

- [ ] **Step 2: Add the `debtor` field to the Create form (audit IC-02)**

`create_invoice` now takes `debtor: Address` before `debtor_name`. Add a required
"Debtor wallet address (G...)" input to `CreatePage.tsx`, validate it is a valid
`G...`/`C...` address via `StrKey.isValidEd25519PublicKey` (from `@stellar/stellar-sdk`),
and pass it as the `debtor` argument. Block submit if empty/invalid.

- [ ] **Step 3: Expose `sponsorEnabled` in config for conditional UI**

```ts
// in frontend/src/lib/config.ts — add to the exported config object:
sponsorEnabled: !!import.meta.env.VITE_SPONSOR_URL,
```

- [ ] **Step 4: Run the full frontend test suite (must stay green with sponsor unset)**

Run: `cd frontend && npm test`
Expected: PASS — all existing suites plus Task 1/2 suites; no regression (feature is env-gated off in tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/CreatePage.tsx frontend/src/pages/MarketplacePage.tsx frontend/src/pages/PortfolioPage.tsx frontend/src/lib/config.ts
git commit -m "feat(ws3): route create/buy/settle through sponsor path + debtor field + gasless badge"
```

---

### Task 4: Cloudflare Worker sponsor proxy — validation + rate-limit + forward

**Files:**
- Create: `sponsor-worker/src/index.ts`
- Create: `sponsor-worker/src/validate.ts` (XDR allowlist check — pure, unit-tested)
- Create: `sponsor-worker/wrangler.toml`
- Create: `sponsor-worker/package.json`
- Test: `sponsor-worker/test/validate.test.ts`, `sponsor-worker/test/worker.test.ts`

**Interfaces:**
- Produces:
  - `validateInvoke(xdr: string, networkPassphrase: string, marketplaceId: string): { ok: true; source: string; fn: string } | { ok: false; status: 403 | 400; msg: string }`
  - Worker `fetch(request, env)` where `env = { LAUNCHTUBE_URL, LAUNCHTUBE_TOKEN, MARKETPLACE_ID, NETWORK_PASSPHRASE, PER_ADDRESS_LIMIT, PER_IP_DAILY_LIMIT, RL: KVNamespace }`

- [ ] **Step 1: Write the failing validation test**

```ts
// sponsor-worker/test/validate.test.ts
import { describe, expect, it } from 'vitest'
import { TransactionBuilder, Networks, Operation, Account, Address, xdr, nativeToScVal } from '@stellar/stellar-sdk'
import { validateInvoke } from '../src/validate'

const PASS = Networks.TESTNET
const MKT = 'CDSLEGLUKSZ7X3M2I7DRP2PTKAGJOTAIZ5FVQVFJWTJBMZTJXRLDEUQD'
const SRC = 'GD5HVOD6ZANYONRKCCDNQSSOSF5NLVW5UFY4OD4WBXSVM6E43KUB5JY2'

function invokeXdr(contractId: string, fnName: string): string {
  const op = Operation.invokeContractFunction({
    contract: contractId,
    function: fnName,
    args: [],
  })
  const tx = new TransactionBuilder(new Account(SRC, '0'), { fee: '100', networkPassphrase: PASS })
    .addOperation(op).setTimeout(30).build()
  return tx.toXDR()
}

describe('validateInvoke', () => {
  it('accepts an allowlisted marketplace fn', () => {
    const r = validateInvoke(invokeXdr(MKT, 'buy_invoice'), PASS, MKT)
    expect(r).toEqual({ ok: true, source: SRC, fn: 'buy_invoice' })
  })
  it('rejects a non-marketplace contract', () => {
    const other = 'CAX2MPXBTI7QTHZ5G6IWXGLFMXDF2IMQIHSKYQRDNGAO3ZVMY6VBO3K3'
    const r = validateInvoke(invokeXdr(other, 'buy_invoice'), PASS, MKT)
    expect(r.ok).toBe(false)
  })
  it('rejects a non-allowlisted function', () => {
    const r = validateInvoke(invokeXdr(MKT, 'set_paused'), PASS, MKT)
    expect(r.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd sponsor-worker && npx vitest run test/validate.test.ts`
Expected: FAIL — `Cannot find module '../src/validate'` (after `npm i` of deps in Step 3's package.json; if deps missing, install first).

- [ ] **Step 3: Write `package.json`, `validate.ts`, and minimal deps**

```json
// sponsor-worker/package.json
{
  "name": "sponsor-worker",
  "private": true,
  "type": "module",
  "scripts": { "test": "vitest run", "deploy": "wrangler deploy" },
  "dependencies": { "@stellar/stellar-sdk": "^14.6.1" },
  "devDependencies": { "vitest": "^2.1.1", "wrangler": "^3.0.0", "@cloudflare/vitest-pool-workers": "^0.5.0" }
}
```

```ts
// sponsor-worker/src/validate.ts
import { TransactionBuilder, xdr, Address, StrKey } from '@stellar/stellar-sdk'

const ALLOWED_FNS = new Set(['create_invoice', 'buy_invoice', 'settle'])

type Ok = { ok: true; source: string; fn: string }
type Err = { ok: false; status: 403 | 400; msg: string }

/** Parse a signed tx XDR and confirm it is a single InvokeHostFunction calling an
 *  allowlisted function on the configured marketplace contract. Pure + testable. */
export function validateInvoke(txXdr: string, networkPassphrase: string, marketplaceId: string): Ok | Err {
  let tx
  try {
    tx = TransactionBuilder.fromXDR(txXdr, networkPassphrase)
  } catch {
    return { ok: false, status: 400, msg: 'unparseable xdr' }
  }
  const ops = (tx as unknown as { operations: xdr.Operation[] }).operations ?? []
  if (ops.length !== 1) return { ok: false, status: 403, msg: 'expected exactly one operation' }
  const op = ops[0] as unknown as { type: string; func?: xdr.HostFunction }
  if (op.type !== 'invokeHostFunction' || !op.func) return { ok: false, status: 403, msg: 'not an invoke' }
  const ic = op.func.invokeContract()
  const contractId = Address.fromScAddress(ic.contractAddress()).toString()
  const fn = ic.functionName().toString()
  if (contractId !== marketplaceId) return { ok: false, status: 403, msg: 'contract not allowlisted' }
  if (!ALLOWED_FNS.has(fn)) return { ok: false, status: 403, msg: 'function not allowlisted' }
  const source = (tx as unknown as { source: string }).source
  if (!StrKey.isValidEd25519PublicKey(source)) return { ok: false, status: 400, msg: 'bad source' }
  return { ok: true, source, fn }
}
```

> **SDK note:** the exact accessor for a tx's operations/source and the
> `invokeContract()` host-function shape are `@stellar/stellar-sdk` v14 APIs;
> confirm the property names against the installed version and adjust the two
> casts if needed. Logic and allowlist stay as written.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd sponsor-worker && npm i && npx vitest run test/validate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the Worker `fetch` (rate-limit + forward) and its test**

```ts
// sponsor-worker/src/index.ts
import { validateInvoke } from './validate'

interface Env {
  LAUNCHTUBE_URL: string
  LAUNCHTUBE_TOKEN: string
  MARKETPLACE_ID: string
  NETWORK_PASSPHRASE: string
  PER_ADDRESS_LIMIT: string
  PER_IP_DAILY_LIMIT: string
  RL: KVNamespace
}

async function bump(kv: KVNamespace, key: string, ttl?: number): Promise<number> {
  const n = Number((await kv.get(key)) ?? '0') + 1
  await kv.put(key, String(n), ttl ? { expirationTtl: ttl } : undefined)
  return n
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
    let body: { xdr?: string }
    try { body = await req.json() } catch { return new Response('bad json', { status: 400 }) }
    if (!body.xdr) return new Response('missing xdr', { status: 400 })

    const v = validateInvoke(body.xdr, env.NETWORK_PASSPHRASE, env.MARKETPLACE_ID)
    if (!v.ok) return new Response(v.msg, { status: v.status })

    // Per-address lifetime limit
    const addrKey = `addr:${v.source}`
    const addrCount = await bump(env.RL, addrKey)
    if (addrCount > Number(env.PER_ADDRESS_LIMIT)) return new Response('address limit', { status: 429 })

    // Per-IP daily limit (KV TTL 24h)
    const ip = req.headers.get('cf-connecting-ip') ?? 'unknown'
    const ipCount = await bump(env.RL, `ip:${ip}`, 86400)
    if (ipCount > Number(env.PER_IP_DAILY_LIMIT)) return new Response('ip limit', { status: 429 })

    // Forward to Launchtube (token stays server-side)
    const form = new URLSearchParams({ xdr: body.xdr })
    const res = await fetch(env.LAUNCHTUBE_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.LAUNCHTUBE_TOKEN}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    if (!res.ok) return new Response('launchtube error', { status: 502 })
    const data = await res.json() as { hash?: string }
    return new Response(JSON.stringify({ hash: data.hash ?? '' }), { status: 200, headers: { 'content-type': 'application/json' } })
  },
}
```

```ts
// sponsor-worker/test/worker.test.ts
import { describe, expect, it, vi } from 'vitest'
import worker from '../src/index'
// Reuse invokeXdr helper pattern from validate.test.ts (buy_invoice on MKT, source SRC).
// A minimal in-memory KV double:
function kv() {
  const m = new Map<string, string>()
  return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, val: string) => void m.set(k, val) } as unknown as KVNamespace
}
const baseEnv = () => ({
  LAUNCHTUBE_URL: 'https://lt.example', LAUNCHTUBE_TOKEN: 'dummy-not-a-real-token',
  MARKETPLACE_ID: 'CDSLEGLUKSZ7X3M2I7DRP2PTKAGJOTAIZ5FVQVFJWTJBMZTJXRLDEUQD',
  NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  PER_ADDRESS_LIMIT: '3', PER_IP_DAILY_LIMIT: '50', RL: kv(),
})
function post(xdr: string) {
  return new Request('https://w/', { method: 'POST', headers: { 'cf-connecting-ip': '1.2.3.4' }, body: JSON.stringify({ xdr }) })
}

describe('sponsor worker', () => {
  it('forwards a valid request and returns the hash', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ hash: 'h9' }), { status: 200 })))
    const res = await worker.fetch(post(/* valid buy_invoice xdr */ ''), baseEnv())
    // Build a real xdr in the test via the shared helper; expect 200 + { hash: 'h9' }.
    expect(res.status).toBe(200)
  })
  it('429s after PER_ADDRESS_LIMIT sponsored txs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ hash: 'h' }), { status: 200 })))
    const env = baseEnv()
    const xdr = '' // valid buy_invoice xdr from helper
    for (let i = 0; i < 3; i++) await worker.fetch(post(xdr), env)
    const res = await worker.fetch(post(xdr), env)
    expect(res.status).toBe(429)
  })
})
```

- [ ] **Step 6: Write `wrangler.toml` and run the Worker tests**

```toml
# sponsor-worker/wrangler.toml
name = "invoicechain-sponsor"
main = "src/index.ts"
compatibility_date = "2026-01-01"

kv_namespaces = [{ binding = "RL", id = "REPLACE_WITH_KV_ID" }]

[vars]
MARKETPLACE_ID = "REPLACE_WITH_MAINNET_MARKETPLACE_ID"
NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015"
PER_ADDRESS_LIMIT = "3"
PER_IP_DAILY_LIMIT = "50"
# LAUNCHTUBE_URL / LAUNCHTUBE_TOKEN set via `wrangler secret put` — NEVER here.
```

Run: `cd sponsor-worker && npx vitest run`
Expected: PASS (validate + worker suites). Fill the `xdr` helper placeholders in the worker test with the same builder used in `validate.test.ts` so both files construct real XDR.

- [ ] **Step 7: Commit**

```bash
git add sponsor-worker/
git commit -m "feat(ws3): cloudflare worker sponsor proxy (allowlist + kv rate-limit + launchtube forward)"
```

---

### Task 5: End-to-end verification + docs stub

**Files:**
- Create: `sponsor-worker/README.md` (deploy + secrets runbook)
- Modify: `README.md` (short "⚡ Gasless onboarding (WS3)" section linking the spec)

- [ ] **Step 1: Document the `[U]` setup runbook**

In `sponsor-worker/README.md` write the operator steps: obtain a Launchtube token;
`wrangler kv namespace create RL`; set `MARKETPLACE_ID`; `wrangler secret put LAUNCHTUBE_URL`
and `wrangler secret put LAUNCHTUBE_TOKEN`; `wrangler deploy`; set `VITE_SPONSOR_URL` in the
frontend build env to the deployed Worker URL.

- [ ] **Step 2: Manual e2e on testnet**

With the Worker deployed against the testnet marketplace and `VITE_SPONSOR_URL` set,
connect a wallet holding an account with **zero XLM**, perform a `buy_invoice`, and confirm:
(a) the tx succeeds, (b) the "⚡ Gasless" badge shows, (c) the user's XLM balance is
unchanged, (d) a 4th sponsored action returns 429 and transparently falls back.

- [ ] **Step 3: Commit**

```bash
git add README.md sponsor-worker/README.md
git commit -m "docs(ws3): gasless onboarding runbook + README section"
```

---

## Self-Review

**Spec coverage:**
- §3.1 client module → Task 1. §3.2 Worker (parse/validate/rate-limit/forward) → Task 4. §3.3 frontend integration + badge + env-gate → Tasks 2–3. §4 abuse model (allowlist, per-address/IP limits, token secrecy, fallback) → Tasks 1,2,4. §5 config → Tasks 3 (`VITE_SPONSOR_URL`), 4 (`wrangler.toml`), 5 (runbook). §6 tests → Tasks 1,2,4. §7 exit criteria (env-gated, e2e gasless) → Tasks 3,5. §8 IC-02 `debtor` form field → Task 3 Step 2. All covered.

**Placeholder scan:** The two `xdr: ''` spots in the Task 4 worker test are explicitly instructed to be filled with the shared XDR builder from `validate.test.ts` (not left blank); the `REPLACE_WITH_*` values in `wrangler.toml` are real operator-supplied deploy values, not code placeholders. No "TBD/TODO" in implementation code.

**Type consistency:** `SponsorResult` (Task 1) is consumed by `runTxSponsored` (Task 2). `SubmitOutcome<T>` returned by Task 2 is destructured (`{ result, sponsored }`) in Task 3. `validateInvoke` return shape (Task 4 Step 3) matches its test (Step 1) and its use in the Worker (Step 5). `env` fields in `index.ts` match `wrangler.toml` + secrets. Consistent.

**Binding caveats:** Two SDK-version notes (AssembledTransaction sign/xdr in Task 2; tx operation/host-function accessors in Task 4) flag the only spots to confirm against installed `@stellar/stellar-sdk` v14 — logic is fully specified, only property names may need adjustment.
