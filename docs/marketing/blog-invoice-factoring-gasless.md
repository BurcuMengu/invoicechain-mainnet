# Invoice Factoring + Gasless Onboarding on Soroban: How I Built InvoiceChain

> **Ecosystem contribution (R11).** A publish-ready technical tutorial. Suggested venues:
> dev.to, Medium, the Stellar Developers Discord `#showcase`, or the repo `docs/`.
> The code snippets are from the real project: `github.com/BurcuMengu/invoicechain-mainnet`.

Invoice factoring is an old financial product: a business sells an invoice that will
be paid in 30–90 days to a financier at a discount, because it needs cash today. Can
we do this on Stellar/Soroban without intermediaries and with full transparency? And
can a brand-new user make their first transaction while holding **no XLM at all**? In
this post I walk through two of the more interesting pieces of InvoiceChain: the
**cross-contract reputation system** and the **gasless onboarding architecture** — plus
a concrete lesson a security audit taught us.

## 1. Three contracts, one loop

InvoiceChain is made up of three Soroban contracts:

- **`marketplace`** — the core `create → buy → settle → default` loop.
- **`reputation`** — a per-address on-chain trust score.
- **`token`** — the payment asset (the canonical **USDC SAC** on mainnet, a SEP-41 mock on testnet).

An invoice follows a state machine: `Listed → Funded → Settled | Defaulted | Cancelled`.
The seller lists it, the investor pays the discounted price and becomes the owner, and
when the debtor pays the full amount at maturity the invoice closes.

## 2. Cross-contract calls, safely: the "marketplace-only" gate

For a reputation score to be meaningful, it must change **only through real
settle/default events** — arbitrary callers must not be able to move the score. In
Soroban we solve this with cross-contract auth: the reputation contract verifies that
the caller is the configured marketplace.

```rust
fn require_marketplace(env: &Env) {
    let mkt: Address = env.storage().instance().get(&DataKey::Marketplace).unwrap();
    mkt.require_auth();
}

pub fn record_settled(env: Env, party: Address, amount: i128) {
    require_marketplace(&env);            // ← only the marketplace can pass
    let mut s = read_score(&env, &party);
    s.settled_count = s.settled_count.saturating_add(1);
    s.volume = s.volume.saturating_add(amount);
    // ...
}
```

On the marketplace side we call through a cross-contract client (using
`#[contractclient]` instead of linking the crate directly avoids wasm symbol clashes):

```rust
#[contractclient(name = "ReputationClient")]
pub trait ReputationInterface {
    fn record_settled(env: Env, party: Address, amount: i128);
    fn record_defaulted(env: Env, party: Address);
}
```

**Lesson:** on cross-contract mutations, always verify the caller's identity, and use
`saturating_add` on counters — a single overflow panic can DoS the entire flow.

## 3. The lesson from the audit: tying reputation to the *real* debtor

Before mainnet we ran a multi-agent adversarial audit. The most instructive finding
(IC-02) was this: in the initial design, **anyone** could call `settle`, and the
invoice didn't carry the debtor's real address (only a display label). The result: a
seller could pay themselves with two wallets and manufacture **fake reputation** (at
net-zero cost) — and then get real investors to trust that fake score.

The fix was to bind reputation to an on-chain identity: we added `debtor: Address` to
the invoice and required that `settle` be performed only by that debtor.

```rust
pub fn settle(env: Env, id: u64, payer: Address) {
    payer.require_auth();
    let mut inv = read_invoice(&env, id);
    if inv.status != Status::Funded { panic_with_error!(&env, MarketError::NotFunded); }
    // IC-02: only the real debtor can pay → reputation means "the debtor paid"
    if payer != inv.debtor { panic_with_error!(&env, MarketError::NotDebtor); }
    // ... CEI: write state, then transfer + reputation call
}
```

**Lesson:** on-chain signals like "reputation/score" can be Sybil-exploitable. Anchor
the signal to a real, costly action (here: the actual debtor's payment).

## 4. Gasless onboarding: removing the user's XLM wall

The biggest friction in front of a new user is "first, go get some XLM." On Stellar,
a transaction's fee can be charged to another account via a **fee-bump**. We do this
through [Launchtube](https://launchtube.xyz), but we had to solve two real problems:
(1) the sponsor token must not leak to the client, and (2) abuse must be limited. A
static frontend can't do that — so we put a **minimal Cloudflare Worker** in between.

The flow:

```
Frontend  ──signed XDR──►  Cloudflare Worker  ──►  Launchtube  ──►  Stellar
          (env-gated)      (token gizli,           (fee-bump)
                            allowlist + rate-limit)
```

The frontend **never sees the token** and always stays on the safe side — if the
sponsor fails, it falls back transparently to the normal "wallet pays" path:

```ts
export async function submitSponsored(signedXdr: string): Promise<SponsorResult> {
  const url = sponsorUrl()
  if (url === '') return { sponsored: false, reason: 'disabled' }
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ xdr: signedXdr }) })
    if (!res.ok) return { sponsored: false, reason: 'unavailable' }  // → caller falls back
    return { sponsored: true, hash: (await res.json()).hash }
  } catch { return { sponsored: false, reason: 'unavailable' } }     // asla throw etmez
}
```

The Worker **parses and allowlists** the signed transaction (it only sponsors the
marketplace's `create/buy/settle` + the USDC `approve`), applies a per-address and
per-IP rate limit via KV, then adds the token server-side and forwards it to
Launchtube:

```ts
const v = validateInvoke(body.xdr, env.NETWORK_PASSPHRASE, { marketplaceId, tokenId })
if (!v.ok) return new Response(v.msg, { status: v.status })     // not allowlisted → 403
if (await bump(env.RL, `addr:${v.source}`) > LIMIT) return new Response('...', { status: 429 })
```

**Two subtleties (surfaced by the audit):**
- A cross-origin `fetch` triggers a **CORS preflight**; the Worker must answer
  `OPTIONS` with 204 + `Access-Control-Allow-*` — otherwise the sponsor fails silently
  in the browser (since it's fail-safe, the tx still completes, but is never sponsored).
- Sponsorship is **env-gated** everywhere; when it's off, the behavior is byte-for-byte
  identical to the old flow.

## 5. Takeaways

- Use **cross-contract auth** to restrict state mutations; use `saturating_*` on
  counters to guard against overflow.
- **Harden on-chain signals against Sybil attacks** — anchor them to a real, costly
  action.
- **Gasless UX** is a powerful onboarding tool; but hide the sponsor's identity behind
  an edge proxy, add allowlist + rate-limit, and always leave a **safe fallback**.
- Run an **adversarial audit** before going to mainnet; the most valuable lessons come
  from breaking assumptions that are "plausible but wrong."

The code, the audit report, and the user guide are all in the repo:
**github.com/BurcuMengu/invoicechain-mainnet** — questions and PRs welcome. Hope it's
useful to those building on Stellar. 🚀
