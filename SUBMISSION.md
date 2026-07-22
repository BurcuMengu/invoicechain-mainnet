# InvoiceChain — Level 6 (Black Belt) Submission

An **invoice factoring marketplace** on Stellar/Soroban: businesses tokenize unpaid
invoices and sell them at a discount, investors buy them for yield, and when the
debtor pays, the investor collects the full face value — with **gasless onboarding**.

- **Repo:** https://github.com/BurcuMengu/invoicechain-mainnet
- **Live app (mainnet):** https://burcumengu.github.io/invoicechain-mainnet/
- **Live demo (testnet):** https://burcumengu.github.io/invoicechain
- **User guide:** [`docs/USER-GUIDE.md`](docs/USER-GUIDE.md)
- **Security audit:** [`SECURITY-AUDIT.md`](SECURITY-AUDIT.md)
- **Mainnet deploy runbook:** [`DEPLOY.md`](DEPLOY.md)

> **Status:** Code, security, documentation, and marketing materials are **ready**.
> The mainnet-live items (R3–R7) are parked "deploy-ready" via `DEPLOY.md`; once
> completed, the `[pending]` links below will be filled in.

## Requirement traceability matrix

| # | Requirement | Status | Evidence |
|---|---|---|---|
| R1 | Public GitHub repo | ✅ | [repo](https://github.com/BurcuMengu/invoicechain-mainnet) |
| R2 | 30+ meaningful commits | ✅ | **87 commits** (`git rev-list --count HEAD`) |
| R3 | Contracts deployed on mainnet | ✅ | live on Stellar mainnet — [marketplace tx](https://stellar.expert/explorer/public/tx/c20b4f1b2aafd4ebbd431e5ad85669e0e6c6a4bdb6dc20a6ee3e98ff97a56cff) |
| R4 | Mainnet contract addresses | ✅ | [`deployments/mainnet.json`](deployments/mainnet.json) — marketplace [`CD76…RI53F`](https://stellar.expert/explorer/public/contract/CD76S7XCNIC3Q64JKKX66YS4PQA4QLRKATRAGK6HZBC5KGKDSMFRI53F), reputation [`CBP6…NXX4F`](https://stellar.expert/explorer/public/contract/CBP63ILG2LEVJLQYADHZFNV3YDT4FRVG3O4E76ENNKMLI4XE54BNXX4F), token = canonical USDC SAC |
| R5 | Live mainnet app | ✅ | **[burcumengu.github.io/invoicechain-mainnet](https://burcumengu.github.io/invoicechain-mainnet/)** — live, built against the mainnet contract ids |
| R6 | 20+ verified mainnet users | ⏳ | onboarding form ready (R15), growth ongoing |
| R7 | Real on-chain tx activity | ✅ | mainnet USDC transfer via the marketplace — [buy_invoice tx](https://stellar.expert/explorer/public/tx/d10a037aff2c95aeb43055dc6ecf6470395e3e12d361cf05b9344d6f79c2b3e1) (0.9 USDC transferred), [create_invoice](https://stellar.expert/explorer/public/tx/9e314ad31e9dfa8d3d5ebe4f797880345a96e3da8b1041965e581612d6245000), [approve](https://stellar.expert/explorer/public/tx/df5b8f4d509c294212c3330c341468c44f4c7161ac6d4298e57dc6c96edab55f) |
| R8 | Smart contract audit / security review | ✅ | [`SECURITY-AUDIT.md`](SECURITY-AUDIT.md) — 10 findings, 7 fixed / 3 acknowledged, 0 open |
| R9 | Twitter/X launch post | ✅ published | [Launch post](https://x.com/i/status/2078129791467753970) · source [`docs/marketing/twitter-launch-thread.md`](docs/marketing/twitter-launch-thread.md) |
| R10 | Demo/showcase content (GIF) | ✅ | [`docs/demo.gif`](docs/demo.gif) (embedded in README) + shot list [`docs/marketing/demo-gif.md`](docs/marketing/demo-gif.md) |
| R11 | Ecosystem contribution (blog/tutorial) | ✅ published | [Medium article](https://medium.com/@burcumengu/how-i-built-an-invoice-marketplace-on-stellar-and-made-it-work-without-xlm-d95598416e6c) · source [`docs/marketing/blog-invoice-factoring-gasless.md`](docs/marketing/blog-invoice-factoring-gasless.md) |
| R12 | Advanced feature → **Fee Sponsorship (gasless)** | ✅ | `frontend/src/lib/feeSponsor.ts`, `sponsor-worker/`, [spec](docs/superpowers/specs/2026-07-16-fee-sponsorship-design.md) |
| R13 | Full technical documentation | ✅ | `README.md`, specs, `DEPLOY.md`, `sponsor-worker/README.md` |
| R14 | User guide / documentation | ✅ | [`docs/USER-GUIDE.md`](docs/USER-GUIDE.md) |
| R15 | Onboarding: Google Form (wallet/email/name/rating) | ✅ | README "User onboarding" section |
| R16 | Responses → Excel + README link | ✅ | `docs/user-responses.xlsx` (testnet) → to be updated for mainnet |
| R17 | README feedback-driven improvements + commit links | ✅ | README "How feedback drives the next iteration" |

## Highlights

### Security (R8)
A pre-mainnet **multi-agent adversarial audit** (6 finders → dedup → skeptical
verification): 20 raw → 10 unique findings, **10/10 CONFIRMED, 0 false positives**.
No fund theft / reentrancy / auth bypass. Objective findings fixed with TDD
(reputation inflation IC-02, DoS IC-03, arithmetic IC-04/IC-10, TTL IC-07,
upgrade/pause IC-08, deploy IC-09; test_token IC-01). Contract tests 31+3+4 green,
`clippy` clean.

### Advanced feature — Fee Sponsorship / gasless onboarding (R12)
A new user's first marketplace actions (create/buy/settle + approve) have their
network fees sponsored via **Launchtube** fee-bump. A minimal **Cloudflare Worker**
proxy keeps the sponsor token secret and enforces an allowlist and rate limits;
everything is env-gated with a safe fallback on failure. Tests: worker 9/9,
frontend 28/28.

### Architecture (R13)
3 Soroban contracts (`marketplace` / `reputation` / SEP-41 `token`) + React (Vite/TS)
+ Stellar Wallets Kit. Cross-contract reputation gating, CEI ordering, env-driven
mainnet config.

## Completing mainnet (R3–R7)
All steps are in `DEPLOY.md`. Approximate cost: a few XLM (deploy) + a small,
largely-recoverable USDC float (the gasless feature covers user fees).

1. **R3/R4:** `DEPLOY.md §1` — multisig admin + `deploy_mainnet.sh` → `mainnet.json`.
2. **R5:** `DEPLOY.md §2` — point the frontend env at the mainnet ids + deploy.
3. **R6/R7:** live app + onboarding form in place; growing toward 20+ users (tx evidence already captured).

## Publishing steps (R9–R11, free)
- **R9:** ✅ posted — https://x.com/i/status/2078129791467753970
- **R10:** demo GIF ships in the repo (`docs/demo.gif`, embedded in README). Optionally capture an updated GIF via `demo-gif.md` and drop it into the launch thread.
- **R11:** ✅ published on Medium — https://medium.com/@burcumengu/how-i-built-an-invoice-marketplace-on-stellar-and-made-it-work-without-xlm-d95598416e6c

---

*This document is the living submission checklist; the `⏳` items will have their links filled in as they are completed.*
