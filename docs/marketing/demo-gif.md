# Demo GIF — Shot List (R10)

R10 (demo/showcase content) is delivered as a **demo GIF** — lightweight, auto-playing,
and embeddable directly in the README, the Twitter/X thread, and the submission (no
hosting or audio needed).

## Current artifact
A product-tour GIF already ships in the repo and is embedded in the README:

- **[`docs/demo.gif`](../demo.gif)** — the baseline R10 showcase artifact.

This satisfies R10 as-is. The shot list below is for capturing an **updated** GIF that
also shows the new `debtor` field and the **⚡ Gasless** badge.

## How to capture (zero budget)
- **Tools:** [Kap](https://getkap.co/) or LICEcap or ScreenToGif (record a region
  straight to `.gif`); or record a screen video and convert with
  [`gifski`](https://gif.ski/) for crisp output.
- **Source:** the live testnet app — [burcumengu.github.io/invoicechain](https://burcumengu.github.io/invoicechain)
  (mainnet not required for the demo).
- **Format:** ~10–20 s loop, no audio, on-screen captions, ≤ ~5 MB so it embeds well.
- **Prep:** two test wallets (seller + investor), USDC from the faucet, a clean
  browser window, notifications off. (The create/buy/settle steps need a wallet to
  sign, so these are captured with your own wallet.)

## Flow (scene by scene — keep it tight for a loop)

| # | Screen | On-screen caption |
|---|---|---|
| 1 | Landing page, logo | "Tokenize & factor invoices on Stellar" |
| 2 | **Create**: debtor address, face value 100 USDC, 10% discount → Create → sign | "List an invoice — only the named debtor can settle it" |
| 3 | Transaction confirmation with the **⚡ Gasless** badge (zoom in) | "⚡ Fee paid by a sponsor — no XLM needed" |
| 4 | (Investor wallet) **Marketplace** → **Buy** at 90 USDC → owner changes | "Buy at a discount; the seller gets cash instantly" |
| 5 | **Portfolio** → **Settle** (debtor) → Settled; reputation +1 | "Debtor pays face value; seller's reputation rises" |
| 6 | Closing frame: logo + demo link | "Invoices, on-chain — #Stellar #Soroban" |

## Shot notes
- Fill forms **slowly** so the fields are readable in a short loop.
- **Zoom in** on the ⚡ Gasless badge — it's the strongest differentiator.
- Keep amounts small (100 USDC testnet) so numbers read clearly.
- Once mainnet is live, re-capture the same flow and add a "real USDC" caption.

## Publishing
- The GIF is already embedded in the README "Live demo" section (`docs/demo.gif`).
- Drop the updated GIF into tweet 1 of the launch thread (see `twitter-launch-thread.md`).
- Reference it from `SUBMISSION.md` (R10).
