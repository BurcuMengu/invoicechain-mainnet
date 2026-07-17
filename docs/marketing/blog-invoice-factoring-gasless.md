# How I built an invoice marketplace on Stellar (and made it work without XLM)

> **Ecosystem contribution (R11).** A ready-to-publish write-up. Good places to post it:
> dev.to, Medium, or the Stellar Developers Discord `#showcase`. All the code below is
> from the real project: `github.com/BurcuMengu/invoicechain-mainnet`.

Invoice factoring is a pretty old idea. A business is owed money on an invoice that
won't be paid for 30 to 90 days, but it needs cash now, so it sells that invoice to
someone else at a discount. I wanted to see if I could do the same thing on Stellar,
without the middlemen, and with one extra goal: a brand-new user should be able to make
their first transaction without holding any XLM.

This post covers the two parts I found most interesting to build: the on-chain
reputation system, and the gasless onboarding. I'll also share one bug the security
audit caught that I think is worth knowing about.

## The basic setup

InvoiceChain is three small Soroban contracts:

- **`marketplace`** — the main loop: create an invoice, buy it, settle it, or default it.
- **`reputation`** — a trust score for each seller.
- **`token`** — the money. On mainnet that's real USDC; on testnet it's a mock token.

An invoice moves through a few states: `Listed → Funded → Settled` (or `Defaulted`, or
`Cancelled`). The seller lists it, an investor pays the discounted price and becomes the
owner, and when the debtor finally pays, the invoice closes and the money goes to the
investor.

## Keeping the reputation score honest

A reputation score is only worth something if people can't just make it up. So the
score should only ever change because of a real settle or default — not because someone
called the contract directly.

The way I handle this in Soroban is simple: the reputation contract checks that the
caller is the marketplace, and nobody else.

```rust
fn require_marketplace(env: &Env) {
    let mkt: Address = env.storage().instance().get(&DataKey::Marketplace).unwrap();
    mkt.require_auth();
}

pub fn record_settled(env: Env, party: Address, amount: i128) {
    require_marketplace(&env);            // only the marketplace can get past this
    let mut s = read_score(&env, &party);
    s.settled_count = s.settled_count.saturating_add(1);
    s.volume = s.volume.saturating_add(amount);
    // ...
}
```

The marketplace calls into it through a generated client. I used `#[contractclient]`
instead of importing the reputation crate directly, because linking them caused
duplicate wasm symbols.

```rust
#[contractclient(name = "ReputationClient")]
pub trait ReputationInterface {
    fn record_settled(env: Env, party: Address, amount: i128);
    fn record_defaulted(env: Env, party: Address);
}
```

One small thing that turned out to matter: I use `saturating_add` on the counters. If a
counter ever overflowed, the contract would panic, and that panic would block settling
for that account. Saturating math avoids that.

## The bug the audit caught

Before touching mainnet, I ran a thorough audit on the contracts. The most useful thing
it found was this: at first, *anyone* could call `settle`, and the invoice didn't store
the debtor's real address — just a name to show in the UI.

That's a problem. A seller could use two wallets, "pay" their own invoice, and rack up a
great reputation without any real customer ever paying. Then real investors would see
that fake score and trust it.

The fix was to put the debtor's actual address on the invoice, and only let that address
settle it.

```rust
pub fn settle(env: Env, id: u64, payer: Address) {
    payer.require_auth();
    let mut inv = read_invoice(&env, id);
    if inv.status != Status::Funded { panic_with_error!(&env, MarketError::NotFunded); }
    // only the real debtor can pay, so the reputation actually means "the debtor paid"
    if payer != inv.debtor { panic_with_error!(&env, MarketError::NotDebtor); }
    // write the new state first, then move the money and update reputation
}
```

The takeaway I'd pass on: if you put any kind of "score" on-chain, assume people will try
to game it. Tie it to something real and costly — here, an actual payment from the actual
debtor.

## Making it work without XLM

The thing that stops most new users cold is "first, go buy some XLM for fees." I wanted
to skip that entirely.

On Stellar you can have one account pay the fee for another account's transaction, using
a fee-bump. I use [Launchtube](https://launchtube.xyz) to do the fee-bump and send the
transaction. But two problems come with it: the sponsor's token can't be sitting in the
frontend for anyone to grab, and I need some limit so people can't drain the sponsor.

A plain static site can't keep a secret or rate-limit anything, so I put a tiny
Cloudflare Worker in the middle:

```
Frontend  ──signed XDR──►  Cloudflare Worker  ──►  Launchtube  ──►  Stellar
          (env-gated)      (holds the token,       (fee-bump)
                            allowlist + rate-limit)
```

The frontend never touches the token, and it's written so that if anything goes wrong it
just falls back to the normal "you pay the fee" path. It never throws:

```ts
export async function submitSponsored(signedXdr: string): Promise<SponsorResult> {
  const url = sponsorUrl()
  if (url === '') return { sponsored: false, reason: 'disabled' }
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ xdr: signedXdr }) })
    if (!res.ok) return { sponsored: false, reason: 'unavailable' }  // caller falls back
    return { sponsored: true, hash: (await res.json()).hash }
  } catch { return { sponsored: false, reason: 'unavailable' } }     // never throws
}
```

The Worker reads the signed transaction, checks it's actually one of the calls I'm
willing to pay for (the marketplace's create/buy/settle, plus the USDC approve), rate
limits by address and IP, then adds the token and forwards it:

```ts
const v = validateInvoke(body.xdr, env.NETWORK_PASSPHRASE, { marketplaceId, tokenId })
if (!v.ok) return new Response(v.msg, { status: v.status })     // not on the allowlist → 403
if (await bump(env.RL, `addr:${v.source}`) > LIMIT) return new Response('...', { status: 429 })
```

Two things I only really understood once I tested it in a browser:

- The frontend calls the Worker cross-origin, so the browser sends a CORS preflight
  first. If the Worker doesn't answer that `OPTIONS` request with the right headers, the
  sponsor call quietly fails. Because of the fallback, the transaction still goes through
  — it just never gets sponsored, which is the worst kind of bug: silent.
- The whole feature is behind an env var. Turn it off and the app behaves exactly like
  it did before.

## Wrapping up

None of these pieces are huge on their own, but together they make the app feel a lot
more real: a reputation you can trust, and an onboarding that doesn't ask you to go buy
XLM before you can do anything.

If you're building on Stellar, the two ideas I'd steal from this are: check the caller on
any cross-contract state change, and don't trust a static frontend to hold secrets — a
small edge function goes a long way.

Code, the audit report, and a user guide are all in the repo:
**github.com/BurcuMengu/invoicechain-mainnet**. Questions and PRs welcome.
