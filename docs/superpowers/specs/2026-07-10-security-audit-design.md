# InvoiceChain — Pre-Mainnet Security Audit (Design / Spec)

- **Date:** 2026-07-10
- **Scope commit:** `475c411` (`475c41127e6c93ede44801b7cdb39ee1c156221b`)
- **Repo:** `BurcuMengu/invoicechain-mainnet`
- **Level 6 sub-project:** #1 — Security / Audit (prerequisite for mainnet deploy)
- **Master spec:** [`2026-07-10-level6-mainnet-launch-design.md`](2026-07-10-level6-mainnet-launch-design.md) (this is the detailed spec for WS0)

## 1. Objective

Before launching InvoiceChain onto Stellar **mainnet** (pubnet), put the three
Soroban contracts (`marketplace`, `reputation`, `test_token`) through a
production-grade audit. Because real money (real USDC) will be involved, the goal
is to detect all known vulnerability classes prior to deploy, fix the
critical/high findings, and lock the fixes down with regression tests. The
deliverable is a trustworthy, signable audit report suitable for the ecosystem
program.

## 2. Scope

**In scope (primary):**
- `contracts/marketplace` — the core create → buy → settle → default/cancel cycle, escrow, cross-contract calls.
- `contracts/reputation` — issuer trust score, marketplace-gating.
- `contracts/test_token` — SEP-41 mock token + faucet (to be removed/replaced on mainnet).

**In scope (secondary, lightweight):**
- Ops/mainnet security surface: admin key management, mainnet secret/env
  management, migration to real USDC SAC, upgrade/pause architecture decisions.

**Out of scope:**
- Deep frontend penetration testing (XSS/CSRF/supply chain) — only surface-level
  wallet/secret security notes are added.
- The mainnet deploy itself (separate sub-project #2).

## 3. Methodology — Multi-Agent Adversarial Audit

Orchestration runs deterministically via the **Workflow** tool. All subagents run
on **Opus** (quality > token cost).

### 3.1 Finder fan-out (parallel)
Each agent tries to "break" all three contracts through the lens of a single
attack vector and returns a structured finding:

| Agent | Vector | Examples sought |
|---|---|---|
| F1 | Access control / auth | missing `require_auth`, faulty `require_marketplace` gating, admin privilege escalation, auth bypass |
| F2 | Arithmetic / overflow | `sale_price` i128 overflow, `volume += amount` overflow, negative/precision, division losses |
| F3 | Storage / TTL / DoS | unbounded `filter()` loop, data loss via TTL expiry, key bloat, gas/limit exploitation |
| F4 | Cross-contract / reentrancy | marketplace↔reputation flow, CEI violations, malicious token callback |
| F5 | Economic / logic | `settle` payer semantics, default grace period, discount bounds, escrow accounting, state-machine transitions |
| F6 | Mainnet / ops | test_token faucet removal, real USDC SAC migration, admin key/multisig, absence of upgrade/pause, deploy config |

### 3.2 Finding pipeline
```
finders (parallel) → merge + dedup findings → assign severity
→ independent adversarial verification of each finding (skeptical Opus agent)
→ only CONFIRMED findings go into the report
```
The adversarial verification step asks a separate skeptical agent, for each
finding: "Is this really exploitable? Show a concrete input/state → wrong output;
if you're not sure, REFUTED." This weeds out plausible-but-wrong findings.

### 3.3 Severity scale
- **Critical** — loss/theft of funds, unauthorized state mutation, directly exploitable.
- **High** — conditional fund risk, permanent DoS, serious accounting error.
- **Medium** — risk under limited conditions, scaling/limit issue.
- **Low** — minor logic/UX-security deviation, missing defense in depth.
- **Info** — style/documentation/observation, no security impact.

## 4. Deliverable — `SECURITY-AUDIT.md`

In the format of a real Soroban audit report, at the repo root. Sections:

1. **Summary** — scope, commit hash, date, audited contracts, methodology overview.
2. **Severity summary table** — finding count per class and Fixed/Acknowledged status.
3. **Findings** — for each:
   - ID (e.g. `IC-01`), title, severity
   - Location: `file:line`
   - Description + exploit scenario (concrete input/state → result)
   - Recommendation
   - **Status:** Fixed (commit) / Acknowledged (design decision)
4. **Fix summary** — patches applied, tests added.
5. **Remaining risks & recommendations** — operational recommendations before mainnet deploy.

## 5. Fix + Test Loop (TDD)

For each **CONFIRMED, objective** finding, in the main session:
1. Write a **failing regression test** that demonstrates the flaw (`contracts/<c>/src/test.rs`).
2. Fix the contract.
3. Turn the test green; run the full suite.

The fix updates the corresponding finding's status in `SECURITY-AUDIT.md` to
"Fixed" + commit reference.

## 6. Design-Decision Findings (Acknowledged) — With Rationale

The following topics are not objective "bugs"; they are **choices** that depend on
mainnet risk appetite. They are made concrete during the audit; for each one, a
clear "add / don't add" option is presented to the user **each time with its
rationale**, and the choice is recorded in the report. Nothing is applied
automatically.

### DD-1 — Upgradeability
Contracts are fixed after deploy; if a bug is found, it cannot be patched.

- **Why it SHOULD be added:** On mainnet, with real money at stake, being able to
  fix a discovered bug via `update_current_contract_wasm` can prevent fund loss.
  Migration (new contract + data transfer) would be far more expensive and
  disruptive. In an early-stage product, the probability of a bug is high.
- **Why it should NOT be added:** Upgrade authority gives the admin unilateral
  power to change user funds/logic — a centralization and trust concern. If the
  key is stolen, an attacker could upgrade the contract to malicious code.
  Immutability is a trust feature for some users.
- **Recommendation:** If added, it must be placed behind a multisig/timelock (see DD-2).

### DD-2 — Admin key management (single key vs multisig)
Privileges like `set_reputation` are tied to a single admin key.

- **Why to move to MULTISIG:** A single key is a single point of failure; if
  stolen, the admin privileges (changing the reputation address, upgrade if present)
  are compromised. Multisig blocks the attack from a single device/key leak and
  increases operational trust.
- **Why a single key should STAY:** Multisig adds operational complexity, signer
  coordination, and delay in emergency response. Since the admin authority is
  relatively narrow (`set_reputation`), the attack surface is limited; for a solo
  founder, multisig may be overkill.
- **Recommendation:** At minimum a hardware wallet; if upgrade is added, multisig should be considered mandatory.

### DD-3 — Pause / emergency stop (circuit breaker)
There is no switch to halt `create/buy/settle` the moment a problem arises.

- **Why it SHOULD be added:** When an active exploit/bug is noticed, being able to
  freeze the contract and stop further damage is a fundamental tool of incident
  response. The ability to cut off fund flow overnight is valuable on mainnet.
- **Why it should NOT be added:** Pause gives the admin the power to block users'
  funds/transactions (perception of censorship/rug risk). If misused, a user
  cannot `settle`. Additional state + control complexity at every entry point.
- **Recommendation:** If added, only "new transactions" (create/buy) should be
  haltable; settling existing funded invoices (`settle`) must never be blocked (so
  funds don't get locked).

### DD-4 — `settle` payer semantics
Currently *anyone* can settle a funded invoice as the payer by paying face_value.

- **Why it should be LEFT OPEN:** A third-party payment is not to the owner's
  detriment — the owner receives face_value and the seller gains reputation. In the
  real world, a debt can be paid by a guarantor/factor; the flexibility is useful.
  Restricting it adds complexity and unnecessary rejection.
- **Why it should be RESTRICTED:** The ambiguity of "why would someone other than
  the debtor pay?"; reputation is always written to the `seller`, yet the payer may
  be different — the meaning of reputation can become blurred. Unexpected payment
  flows can complicate accounting.
- **Recommendation:** Leave it open; but document that reputation means "the
  seller's invoice was closed on time" (independent of the payer's identity).

### DD-5 — Unbounded `filter()` loop (indexing vs off-chain)
`list_open`/`list_by_owner`/`list_by_seller` traverse the `0..NextId` range on-chain.

- **Why ON-CHAIN INDEX/PAGINATION SHOULD be added:** As the invoice count grows,
  these functions read all invoices — read cost and limit risk increase; past a
  certain point the call may hit limits and turn into a DoS (functional breakage).
- **Why it should NOT be added (leave it off-chain):** The frontend already exists
  and can aggregate chain events (created/funded/settled...) via an indexer/RPC;
  doing list queries off-chain reduces on-chain complexity and storage cost. The
  on-chain list functions are mostly for convenience.
- **Recommendation:** Mark the on-chain list functions as "best-effort/limited";
  make the event-based off-chain indexer the standard path for production listing.
  (This item is also treated as a severity-rated DoS **finding**.)

## 7. Verification & Exit Criteria

The audit counts as "done" only when the following hold:
- [ ] `cargo test` green across all contracts (including the new regression tests).
- [ ] `cargo clippy` warning-free (or a justified `allow`).
- [ ] All **Critical** and **High** findings **Fixed**.
- [ ] All **Medium+** design-decision findings presented to the user with their
      rationale, and the decision recorded in the report (Fixed or Acknowledged).
- [ ] `SECURITY-AUDIT.md` written and committed.
- [ ] The report documents a "green light" status for the mainnet deploy sub-project (#2).

## 8. Relationship of This Sub-Project to the Next Steps

This audit is the first step of the Level 6 sequence:
`audit (#1) → mainnet deploy (#2) → real user adoption (#3) → launch/marketing (#4)`.
The audit's "green light" and the DD decisions (especially upgrade/admin/pause)
directly shape the deploy architecture in #2.
