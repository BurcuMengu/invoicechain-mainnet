# InvoiceChain — User Guide

InvoiceChain is a **factoring marketplace** where invoices can be bought and sold
on-chain: a seller converts an invoice that will be paid in the future into cash
today at a discount; an investor buys it at the discounted price and collects the
full amount when the debtor pays. This guide walks you through how to use it step
by step.

> **Networks:** The app works on both **testnet** (trial, fake USDC) and **mainnet**
> (real USDC). On testnet the money is not real — start there to experiment safely.

---

## 1. Roles

| Role | What they do |
| --- | --- |
| **Seller** | Creates the invoice and lists it at a discount (for cash today) |
| **Investor** | Buys the listed invoice at the discounted price |
| **Debtor** | Pays (settles) the invoice at its full face value when it comes due |

You can take on different roles at different times with the same wallet.

---

## 2. Preparation: wallet and account

1. **Set up a Stellar wallet.** The [Freighter](https://www.freighter.app/) browser
   extension is recommended (the app also supports other wallets via Stellar Wallets Kit).
2. **Make sure you have a Stellar account.**
   - **Testnet:** The app automatically funds your account via Friendbot if needed;
     no extra steps required.
   - **Mainnet:** Your account must exist and meet the minimum XLM reserve (about 1 XLM).
     Send a little XLM from an exchange or another wallet.
3. **Connect your wallet.** In the app, click **Connect** in the top right to select
   your wallet and grant permission. Once connected, your address (starts with G…) and
   your balance appear at the top.

> **⚡ Gasless onboarding:** If the app is configured with fee-sponsorship, a new
> user's first few transactions have their **network fee paid by the sponsor** — so
> you don't need to hold XLM for fees. When a transaction is sponsored, you'll see a
> "⚡ Gasless" notification. If sponsorship is off or full, the transaction completes
> normally (with you paying the fee); no transaction fails because of this.

---

## 3. Obtaining USDC and a trustline

Invoices are bought and paid in **USDC**. To hold USDC, your wallet must have a
**trustline** for it.

- **Testnet:** Get trial USDC from the app's **Ramp / faucet** page; the trustline is
  set up automatically when needed. (This is entirely fake money and specific to testnet.)
- **Mainnet:** Add a trustline for **canonical USDC** in your wallet (in Freighter,
  "Add asset" → USDC). Then withdraw USDC to your Stellar address from an exchange or
  anchor. You need a USDC balance to make payments in the investor and debtor roles.

---

## 4. Creating an invoice (seller)

On the **Create** page:

1. **Debtor wallet address (G…):** The Stellar address of the actual debtor who will
   ultimately pay the invoice. **Required and validated** — only this address can
   `settle` the invoice, so the reputation score truly means "the debtor actually paid."
2. **Debtor name:** A display label (up to 64 characters).
3. **Face value:** The total USDC to be paid at maturity.
4. **Due:** The ledger by which the invoice must be paid. It must be in the future and
   within a reasonable horizon (about 1 year).
5. **Discount (%):** Determines the discounted price the investor pays. E.g. a 100 USDC
   face value + 10% discount → the investor pays **90 USDC**; the debtor pays **100 USDC**
   at maturity. (Allowed range: 0.01%–90%.)

Click **Create** and sign in your wallet. The invoice enters the marketplace in the
**Listed** state.

> Tip: `create_invoice` is a single transaction and requires no `approve` — so it's the
> flow that is **completely free** under a gasless configuration.

---

## 5. Buying an invoice (investor)

On the **Marketplace** page you see the listed invoices (face value, discount,
discounted price, due date). Select an invoice and click **Buy**. There are two signatures:

1. **Approve:** You grant the marketplace contract permission to pull the discounted
   price from your USDC balance.
2. **Buy:** The invoice becomes **Funded**, you become the owner, and the discounted
   price goes instantly to the seller.

You now own the invoice; when the debtor pays, you collect the **full face value**.

> **Risk note:** The money goes to the seller at the moment of purchase (there is no
> escrow — this is a factoring-advance model). If the debtor doesn't pay, the invoice
> is marked **Defaulted** and the seller's reputation drops, but the advance is not
> automatically returned. Assess the risk by looking at the seller's reputation score.

---

## 6. Settling / closing the invoice — settle (debtor)

When the invoice comes due, the **debtor address on the invoice** (see step 4) settles
the invoice from the **Portfolio** page. There are two signatures:

1. **Approve:** Permission for the marketplace to pull the face value from your USDC.
2. **Settle:** The face value is paid to the invoice owner (the investor), the invoice
   becomes **Settled**, and **the seller's reputation score increases**.

> Only the debtor address recorded on the invoice can settle. If another address tries,
> the transaction is rejected with `NotDebtor` — this prevents fabricating fake reputation.

---

## 7. Default — mark default (investor)

If the debtor still hasn't paid after the due date plus a short grace period (~1 day),
the invoice's **owner (investor)** can click **Mark default** from **Portfolio**. The
invoice becomes **Defaulted** and a default record is added to the seller's reputation.

---

## 8. Reputation

Every seller address has a **reputation score** on-chain:

- **Settled count / volume:** Invoices closed on time.
- **Defaulted count:** Invoices that went into default.

These values only change through real `settle`/`default` events (gated by the
marketplace contract; they cannot be written arbitrarily). Investors should look at the
seller's reputation before buying an invoice.

---

## 9. Invoice lifecycle (summary)

```
                 create_invoice (seller)
                        │
                        ▼
                    ┌────────┐   cancel_invoice (seller)
                    │ Listed │ ─────────────► Cancelled
                    └───┬────┘
              buy_invoice (investor: approve + buy)
                        │
                        ▼
                    ┌────────┐
                    │ Funded │
                    └───┬────┘
          ┌─────────────┴───────────────┐
   settle (debtor:            mark_default (investor,
   approve + settle)          after due + grace)
          │                             │
          ▼                             ▼
      ┌────────┐                   ┌───────────┐
      │Settled │                   │ Defaulted │
      └────────┘                   └───────────┘
   seller reputation ↑           seller reputation ↓
```

---

## 10. Common issues

| Symptom | Cause / fix |
| --- | --- |
| "Account not found" | (Mainnet) Your account hasn't been created yet — send some XLM. (Testnet) Refresh the page; Friendbot funding may be delayed. |
| Transaction "insufficient balance" | Your USDC balance, or (if gasless is off) your XLM for fees, is insufficient. |
| `NotDebtor` error (settle) | Only the **debtor address** on the invoice can settle. Make sure you're connected with the correct wallet. |
| `NotDueYet` (mark default) | The due date + grace period hasn't passed yet. |
| USDC not showing | Missing trustline — add a USDC trustline to your wallet (see step 3). |
| "⚡ Gasless" never appears | Sponsorship may not be configured or your quota may be used up; transactions still complete normally. |

---

## 11. Security notes

- App transactions are **signed in your wallet**; your private key is never shared with
  the app or the sponsor service.
- The contracts have passed an independent **security audit** before mainnet; see
  [`SECURITY-AUDIT.md`](../SECURITY-AUDIT.md).
- The gasless sponsor service only relays permitted marketplace transactions, and the
  Launchtube token never reaches the client; for details see
  [`sponsor-worker/README.md`](../sponsor-worker/README.md).
