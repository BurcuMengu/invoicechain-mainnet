# InvoiceChain — Level 6: Mainnet Launch (Master Spec / Roadmap)

- **Date:** 2026-07-10
- **Scope commit:** `475c411`
- **Repo:** `BurcuMengu/invoicechain-mainnet` (public)
- **Objective:** Launch InvoiceChain onto Stellar **mainnet** and satisfy all
  mandatory Level 6 (Black Belt) items: mainnet deploy + production app + real
  adoption + security + marketing + ecosystem contribution + advanced feature.

> This is a **master spec**: it breaks Level 6 into workstreams and tracks each
> requirement by status + owner + workstream. Every workstream that requires code
> has its own detailed spec/plan (e.g. Security → [security-audit spec](2026-07-10-security-audit-design.md)).

## 1. Ownership principle (who does what)

Level 6 items split into two groups:

- **[C] Claude-buildable** — I produce these as code/docs/drafts (audit, mainnet
  deploy scripts, USDC SAC migration, fee sponsorship, docs, launch/blog drafts,
  onboarding structure).
- **[U] User-action** — only you can do these (running the deploy with real XLM,
  finding 20+ real users, posting to Twitter/X, recording and uploading the demo
  video, publishing the blog/workshop, obtaining mentor approval).
- **[C→U]** — I prepare, you run/publish.

## 2. Requirement traceability matrix

| # | Level 6 requirement | Current status | Owner | Workstream |
|---|---|---|---|---|
| R1 | Public GitHub repo | ✅ Present | — | — |
| R2 | 30+ meaningful commits | ✅ 67 commits | — | — |
| R3 | Contracts deployed on mainnet | ❌ Testnet only | [C→U] | WS1 |
| R4 | Mainnet contract addresses | ❌ | [C→U] | WS1 |
| R5 | Public production app live | ❌ Testnet | [C→U] | WS2 |
| R6 | 20+ verified mainnet users | ❌ 3 testnet forms | [C→U] | WS4 |
| R7 | Real on-chain tx activity | ❌ | [U] | WS4 |
| R8 | Smart contract audit **OR** mentor security review | ⏳ Audit being set up | [C] | WS0 |
| R9 | Twitter/X launch post/thread | ❌ | [C→U] | WS6 |
| R10 | Demo/showcase content (video) | ⚠️ Demo GIF present, no video | [C→U] | WS6 |
| R11 | Ecosystem contribution (blog/workshop/tutorial/OSS/community — ≥1) | ❌ | [C→U] | WS6 |
| R12 | Advanced feature (≥1) → **Fee Sponsorship (gasless)** | ❌ | [C] | WS3 |
| R13 | Full documentation & production setup | ⚠️ README present, mainnet/prod missing | [C] | WS5 |
| R14 | User guide/documentation | ⚠️ Partial | [C] | WS5 |
| R15 | Onboarding: Google Form (wallet/email/name/rating) | ✅ Present | — | WS4 |
| R16 | Export responses to Excel + README link | ✅ Present (testnet) → to be updated for mainnet | [C→U] | WS4 |
| R17 | Feedback-based improvements in README + commit links | ✅ Present → to be updated for mainnet phase | [C] | WS4 |

## 3. Advanced feature decision — Fee Sponsorship (gasless)

Choice: **Fee Sponsorship** (gasless transactions via fee-bump). Rationale: it
directly supports the 20+ mainnet users (R6) goal — a new user doesn't have to
hold XLM to transact, lowering onboarding friction. It's the most tractable
option as code and the highest return on end-user UX.

**Approach (summary, details in the WS3 spec):** A **sponsor account** wraps the
user's transaction in a fee-bump transaction; the sponsor pays the network fee,
and the user's signature is preserved. Two possible implementation layers:
- Client side: the app sends the signed inner transaction to a sponsor service;
  the service fee-bumps it and submits it to the network (a Launchtube-like flow
  or our own sponsor endpoint).
- Sponsor key management and abuse limits (rate-limit, transaction-type allowlist)
  are addressed in the WS3 spec.

## 4. Workstreams and sequencing

The sequence is critical: **audit → mainnet deploy → advanced feature → live app →
real users/activity → marketing/ecosystem → submission**. Security and deploy must
be complete before real money and real users.

### WS0 — Security audit  `[C]`  (R8)
Multi-agent adversarial audit + severity report + fixes + tests.
**Detailed spec:** [`2026-07-10-security-audit-design.md`](2026-07-10-security-audit-design.md).
Output: `SECURITY-AUDIT.md`, all Critical/High Fixed, `cargo test` green.
This is the prerequisite for mainnet deploy and satisfies R8 (the audit path).

### WS1 — Mainnet contract deployment  `[C→U]`  (R3, R4)
- Marketplace config to use the **real USDC SAC** (Stellar Asset Contract) address
  instead of `test_token` (deploy-time `token` argument).
- `deploy_mainnet.sh` script: pubnet passphrase, real RPC, USDC SAC id,
  admin/multisig decision (see audit DD-2), results to `deployments/mainnet.json`.
- Faucet flow disabled on mainnet (real USDC is acquired, not minted).
- **[U]:** running the script with a deployer key funded with real XLM.
- Output: `deployments/mainnet.json` + mainnet addresses in the README.

### WS2 — Production-ready frontend  `[C→U]`  (R5)
- Env-based structure to move the frontend network config to mainnet (pubnet
  passphrase, mainnet RPC/Horizon, mainnet contract ids); testnet fallback preserved.
- Testnet faucet UI hidden on mainnet; real USDC balance/trustline flow.
- Production build + hosting (existing GitHub Pages or a suitable host), monitoring
  (PostHog/Sentry) connected to the mainnet environment.
- **[U]:** production secrets (WalletConnect id, PostHog key) and the deploy trigger.

### WS3 — Advanced feature: Fee Sponsorship  `[C]`  (R12)
Will have its own detailed spec. Gasless transaction flow, sponsor service/endpoint,
abuse protections, frontend integration, tests.

### WS4 — Real adoption & onboarding  `[C→U]`  (R6, R7, R15–R17)
- The existing Google Form + Excel + README improvement structure is **adapted to
  mainnet** (mainnet wallet addresses, rating, feedback).
- A new "mainnet feedback → next-phase improvements" section in the README, with a
  **git commit link** for each improvement (R17 mandatory).
- 20+ **mainnet** users and real on-chain tx (R6/R7) — **[U]** brings the users; I
  prepare helper scripts/docs to gather the tx activity proof (explorer links,
  event dumps).
- Output: updated `docs/user-responses.xlsx` (mainnet), README onboarding section,
  tx activity proof page.

### WS5 — Documentation & production setup  `[C]`  (R13, R14)
- README: mainnet section, mainnet addresses, production setup (env, deploy,
  monitoring, sponsor service).
- A separate **user guide** (step by step: wallet, USDC trustline, invoice create/buy/settle).
- `SECURITY-AUDIT.md` link, architecture/limits.

### WS6 — Marketing & ecosystem contribution  `[C→U]`  (R9, R10, R11)
- **[C]** Twitter/X launch thread draft (with Stellar ecosystem tags), demo video
  script/shot list, and a **technical blog/tutorial draft** for the ecosystem
  contribution (e.g. "invoice factoring + gasless UX on Soroban").
- **[U]** Posting the thread, recording and uploading the video, publishing the blog/tutorial.
- Output: Twitter link, demo video link, blog/tutorial link (for submission).

### WS7 — Submission assembly  `[C→U]`
Collecting all the submission checklist's evidence into a single `SUBMISSION.md`
(repo link, commit count, mainnet app link, mainnet addresses, 20+ user proof, tx
activity proof, audit proof, Twitter link, demo video, docs, user guide, ecosystem
contribution link).

## 5. Dependency graph

```
WS0 (audit) ──► WS1 (mainnet deploy) ──► WS2 (prod app) ──┐
                       │                                  │
                       └──► WS3 (fee sponsorship) ────────┤
                                                          ▼
                                        [U] app live ───► WS4 (20+ user + tx)
                                                          │
                                          WS5 (docs) ◄────┤
                                                          ▼
                                        WS6 (marketing/ecosystem) ──► WS7 (submission)
```

## 6. Exit criteria = Submission Checklist

Level 6 counts as "done" only when **all** of the following hold:

- [ ] Public GitHub repo (R1) ✅
- [ ] 30+ meaningful commits (R2) ✅ (67)
- [ ] Live mainnet application (R5)
- [ ] Mainnet contract addresses (R3/R4)
- [ ] 20+ mainnet user proof (R6)
- [ ] Transaction activity proof (R7)
- [ ] Audit/security review proof (R8) — `SECURITY-AUDIT.md`
- [ ] Twitter/X launch post link (R9)
- [ ] Demo video link (R10)
- [ ] Advanced feature: Fee Sponsorship (R12)
- [ ] Technical documentation (R13)
- [ ] User guide/documentation (R14)
- [ ] Community/ecosystem contribution link (R11)
- [ ] Onboarding form + Excel + README improvement (with commit links) (R15–R17)

## 7. What we're doing now

Per the sequence, we start with **WS0 (security audit)** — its details were
approved in a separate spec. After WS0 is done, WS1 (mainnet deploy) and WS3 (fee
sponsorship) open up with their own specs/plans. This master spec tracks the status
of all workstreams from one place.
