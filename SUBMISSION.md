# InvoiceChain — Level 6 (Black Belt) Submission

An **invoice factoring marketplace** on Stellar/Soroban: businesses tokenize unpaid
invoices and sell them at a discount, investors buy them for yield, and when the
debtor pays, the investor collects the full face value — with **gasless onboarding**.

- **Repo:** https://github.com/BurcuMengu/invoicechain-mainnet
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
| R3 | Contracts deployed on mainnet | ⏳ deploy-ready | `scripts/deploy_mainnet.sh`, `DEPLOY.md §1` |
| R4 | Mainnet contract addresses | ⏳ | `deployments/mainnet.json` after deploy |
| R5 | Live mainnet app | ⏳ deploy-ready | env-driven `frontend/src/lib/config.ts`, `DEPLOY.md §2` |
| R6 | 20+ verified mainnet users | ⏳ | onboarding form ready (R15); after mainnet |
| R7 | Real on-chain tx activity | ⏳ | after mainnet (explorer links) |
| R8 | Smart contract audit / security review | ✅ | [`SECURITY-AUDIT.md`](SECURITY-AUDIT.md) — 10 findings, 7 fixed / 3 acknowledged, 0 open |
| R9 | Twitter/X launch post | ✅ draft → publish | [`docs/marketing/twitter-launch-thread.md`](docs/marketing/twitter-launch-thread.md) |
| R10 | Demo/showcase video | ✅ script → record | [`docs/marketing/demo-video-script.md`](docs/marketing/demo-video-script.md) |
| R11 | Ecosystem contribution (blog/tutorial) | ✅ written → publish | [`docs/marketing/blog-invoice-factoring-gasless.md`](docs/marketing/blog-invoice-factoring-gasless.md) |
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
3. **R6/R7:** with the live app + onboarding form, gather 20+ real users + tx evidence.

## Publishing steps (R9–R11, free)
- **R9:** post `twitter-launch-thread.md` with Stellar tags → add the link here.
- **R10:** record/upload the video using `demo-video-script.md` → add the link.
- **R11:** publish `blog-invoice-factoring-gasless.md` on dev.to/Medium/Discord → add the link.

---

*This document is the living submission checklist; the `⏳` items will have their links filled in as they are completed.*
