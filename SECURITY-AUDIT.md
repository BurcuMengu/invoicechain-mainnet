# InvoiceChain — Pre-Mainnet Security Audit Report

- **Project:** InvoiceChain — Stellar Soroban invoice-factoring marketplace
- **Repo:** `BurcuMengu/invoicechain-mainnet`
- **Contracts audited:** `marketplace`, `reputation`, `test_token`
- **Base commit (audit scope):** `2de2fc4`
- **Date:** 2026-07
- **Methodology:** Multi-agent adversarial audit (6 attack-vector finders → dedup/severity → independent skeptical verification for each finding). Only CONFIRMED findings were included in the report.
- **Design spec:** [`docs/superpowers/specs/2026-07-10-security-audit-design.md`](docs/superpowers/specs/2026-07-10-security-audit-design.md)

> **Goal:** Before InvoiceChain goes live on Stellar mainnet (pubnet) with real USDC,
> detect all known vulnerability classes, fix the objective defects with regression
> tests, and document the design/risk decisions.

---

## 1. Summary

The multi-agent audit produced **20 raw findings**; after merging/dedup, **10 unique
findings** remained, and each was verified against the code by an independent skeptical
agent (**10/10 CONFIRMED, 0 false positives**).

**Key result:** No direct fund theft, unauthorized state mutation, or reentrancy was
**found**. The core value-transfer flow (create → buy → settle → default/cancel)
correctly follows the CEI (checks-effects-interactions) pattern, and all `require_auth`
gates are in place. The findings fall into three categories: **deploy hygiene**, **input
validation / arithmetic safety**, and **design/governance choices**.

All objective defects were fixed; the fixes are locked down with **37 unit tests** (30 marketplace +
3 reputation + 4 test_token). `cargo test` and `cargo clippy` are clean.

## 2. Severity Summary Table

| Severity | Count | Fixed | Acknowledged | Deferred to deploy |
|---|---|---|---|---|
| Critical | 1 | — | 1 (IC-01) | 1 (IC-01) |
| High | 2 | 2 (IC-02, IC-03) | — | — |
| Medium | 5 | 3 (IC-04, IC-08, IC-09) | 2 (IC-05, IC-06) | — |
| Low | 2 | 2 (IC-07, IC-10) | — | — |
| **Total** | **10** | **7** | **3** | — |

> Note: IC-01 is addressed both as "Acknowledged" (on mainnet, test_token is not deployed;
> the real USDC SAC is used) and on the code side with a defensive layer (init guard +
> testnet-only warning). The multisig dimension of IC-08 is operational (see DD-2).

## 3. Findings

### IC-01 — `test_token.faucet()` unauthorized/unbounded mint + 'USDC' identity spoofing
- **Severity:** Critical · **Status:** ✅ Mitigated + Acknowledged (deploy)
- **Location:** `contracts/test_token/src/lib.rs:81` (faucet), `:75` (`__constructor`)
- **Description:** `faucet(to)` mints tokens to anyone, an unlimited number of times, with no
  `require_auth`, admin gate, or upper bound. `__constructor` had no re-init guard, and the mock
  is deployed with `name="USD Coin"/symbol="USDC"`, making it visually indistinguishable from
  real USDC.
- **Exploit:** An attacker mints unlimited "USDC" via a `faucet(self)` loop, grants approval to
  the marketplace, and runs `buy/settle` with the worthless token to extract value from a trusting
  counterparty. If test_token reaches mainnet, the entire USDC-value assumption collapses.
- **Fix:**
  1. **Deploy (primary):** On mainnet, test_token is **not deployed**; the marketplace
     `__constructor` is given the **canonical USDC Stellar Asset Contract (SAC)** address.
     Because the marketplace already reads the token from storage, the marketplace code does not change.
     (WS1 — mainnet deploy).
  2. **Defense (code):** An `AlreadyInitialized` guard was added to `__constructor`, and a
     "TESTNET ONLY — do not deploy to mainnet" warning was written into the file.
  - **Test:** `test_token::constructor_rejects_reinitialization`.

### IC-02 — `settle` writes reputation to the seller independently of the payer (reputation inflation)
- **Severity:** High · **Status:** ✅ Fixed
- **Location:** `contracts/marketplace/src/lib.rs` (settle), `contracts/reputation/src/lib.rs` (record_settled)
- **Description:** `Invoice` held only `debtor_name: String` (a label); there was no on-chain
  debtor address. `settle` only called `payer.require_auth()` and unconditionally wrote reputation
  to the `seller`. A seller controlling the seller/investor/payer addresses could produce fake
  `settled_count`/`volume` at net-zero cost.
- **Exploit:** The seller controls addresses A and B; A issues an invoice, B buys it, B pays
  (money cycles A↔B, only the fee is spent). Each round increases A's reputation → 1000 rounds of
  fake "1000 successful transactions". Real investors trust this fake score and get defrauded.
- **Decision:** User → **bind the debtor to an on-chain address** (IC-02 option 1).
- **Fix:** A `debtor: Address` field was added to `Invoice`; `create_invoice` takes it;
  `settle` verifies `payer == inv.debtor` (otherwise `NotDebtor`). Reputation now means
  "the debtor actually paid".
  - **Test:** `settle_rejects_non_debtor_payer` (+ `settle_pays_owner_face_value`,
    `settle_records_reputation` updated).

### IC-03 — `list_*` unbounded `0..NextId` scan + unbounded `debtor_name` → DoS brick
- **Severity:** High · **Status:** ✅ Fixed (+ off-chain indexing recommendation)
- **Location:** `contracts/marketplace/src/lib.rs` (filter, list_*)
- **Description:** `filter()` scanned the `0..NextId` range on every `list_*` call and performed a
  separate persistent read for each invoice. `NextId` increases monotonically and `debtor_name`
  length was unbounded; once enough invoices (or a few bloated names) exceeded the per-tx read limit,
  `list_*` was permanently broken with `ResourceLimitExceeded`.
- **Exploit:** An attacker creates many invoices (or ones with multi-kilobyte names) for only the tx
  fee; the order-book listing endpoints are permanently broken.
- **Fix:**
  - `debtor_name.len() > 64` → rejected with `NameTooLong` (per-entry cost bound).
  - `filter()` scans only the **last `MAX_LIST_SCAN=1000`** ids (`saturating_sub`), so a growing
    `NextId` cannot lock the list ("best-effort").
  - For full/paginated history, an **off-chain event indexer** is documented as the standard path
    (DD-5). A single invoice can always be read via `get_invoice`.
  - **Test:** `create_invoice_rejects_oversized_debtor_name`.

### IC-04 — `due_ledger + GRACE` u64 overflow permanently panics `mark_default`
- **Severity:** Medium (finder: High) · **Status:** ✅ Fixed
- **Location:** `contracts/marketplace/src/lib.rs` (create_invoice due check, mark_default)
- **Description:** `due_ledger` was only validated to be "in the future" and had no upper bound.
  Under `overflow-checks=true`, if `inv.due_ledger + GRACE_PERIOD_LEDGERS` overflows, it panics.
  A seller could use `due_ledger ≈ u64::MAX` to make `mark_default` permanently uncallable for that
  invoice, preventing their own default from being written to reputation (liveness/griefing).
- **Fix:** `create_invoice` imposes a `due_ledger <= sequence + MAX_INVOICE_HORIZON` (~1 year)
  bound (`DueTooFar`); `mark_default` uses `saturating_add`.
  - **Test:** `create_invoice_rejects_due_too_far`.

### IC-05 — Admin can swap reputation for a malicious contract via `set_reputation`
- **Severity:** Medium (finder: High) · **Status:** 🟨 Acknowledged
- **Location:** `contracts/marketplace/src/lib.rs` (set_reputation, cross-contract calls)
- **Description:** `set_reputation` only requires `admin.require_auth()`. A compromised/malicious
  admin could replace the reputation address that every `settle`/`mark_default` calls with an
  attacker contract. **Verification note:** This is **not fund theft** (token transfers are
  protected by marketplace-spender + user auth, CEI is correct) — the impact is limited to
  reputation-data integrity and settle/default **availability** (DoS if the malicious contract
  panics); a privileged-admin/centralization risk.
- **Decision (Acknowledged):** Admin authority was kept narrow. Mitigation: on mainnet the admin
  will be a **multisig/hardware wallet** (DD-2). The permanent-lockdown option is to make reputation
  immutable (constructor-only) — this requires redesigning the deploy cycle and will be evaluated in
  WS1 together with IC-09.

### IC-06 — No escrow: `buy` pays the seller instantly, default is cosmetic
- **Severity:** Medium · **Status:** 🟨 Acknowledged (business-model decision)
- **Location:** `contracts/marketplace/src/lib.rs` (buy_invoice, mark_default)
- **Description:** `buy_invoice` sends the discounted amount to the seller instantly; the contract
  holds no escrow. If the debtor does not pay, `mark_default` only writes a negative to reputation;
  there is no clawback, so all counterparty risk sits with the investor. Because reputation is
  address-based, a defaulting seller can start from scratch with a new address. **This is not a code
  bug** — all auth/state-machine gates are correct; this is the nature of the instant-advance
  factoring model.
- **Decision (Acknowledged):** User → **the instant-advance model is retained** (IC-06 option 1);
  in real factoring too, the factor provides the advance upfront and assumes the risk. Hardening: a
  durable/non-resettable reputation + (post-mainnet) a KYC/whitelist layer is recommended.

### IC-07 — Instance/Score TTL bumped only on write → archived and reset while idle
- **Severity:** Low (finder: Medium) · **Status:** ✅ Fixed
- **Location:** `contracts/marketplace/src/lib.rs` (read paths), `contracts/reputation/src/lib.rs` (get_score)
- **Description:** The marketplace instance entry and the reputation `Score` were TTL-bumped only on
  write paths. After ~30 days of read-only/idle time the entry is archived; on the reputation side,
  `read_score` confuses "archived" with "never existed" and returns a zero Score → the next write
  erases a good actor's history (data loss).
- **Fix:** `get_invoice`/`list_*` now bump the instance TTL; `get_score` bumps the `Score` TTL on
  the read path. (Residual risk: long full-idle; a restore runbook + longer TTL are recommended for
  mainnet.)

### IC-08 — Single hot-key admin, no upgrade, no pause
- **Severity:** Medium · **Status:** ✅ Fixed (code) + 🟨 Acknowledged (multisig=ops)
- **Location:** All contracts (governance surface)
- **Description:** The contracts had no upgrade entry point, no pause/circuit-breaker, and no admin
  rotation/multisig; if a bug were found, it could not be patched in place, and an ongoing exploit
  could not be stopped on-chain.
- **Decision:** DD-1 (upgrade) + DD-3 (pause) were **added**; DD-2 (multisig) is operational.
- **Fix:**
  - **`upgrade(new_wasm_hash)`** — admin-gated, `update_current_contract_wasm` (DD-1).
  - **`set_paused(bool)` + `is_paused()`** — admin-gated circuit breaker. **Only**
    `create_invoice`/`buy_invoice` are blocked; `settle`/`mark_default`/`cancel` always stay open →
    no funded invoice can be locked (DD-3).
  - **Multisig (DD-2):** On mainnet, the admin will be a **multisig/hardware wallet** instead of the
    deployer hot-key (deploy-time/operational; the contract's `admin.require_auth()` enforces this
    automatically).
  - **Test:** `upgrade_rejects_non_admin`, `set_paused_rejects_non_admin`,
    `paused_blocks_buy_invoice`, `paused_blocks_create_and_buy_but_allows_settle`.

### IC-09 — Deploy `reputation=token` placeholder + manual `set_reputation` fragility
- **Severity:** Medium · **Status:** ✅ Fixed (`deploy_mainnet.sh` + verification getters)
- **Location:** `scripts/deploy_testnet.sh` (placeholder), consumption: marketplace `settle`
- **Description:** The testnet deploy set up the marketplace with a `--reputation $TOKEN_ID`
  placeholder and called `set_reputation` in a separate tx. If this second tx is skipped/fails, the
  marketplace stays live with `reputation==token` and every `settle` reverts (the token has no
  `record_settled`) → all funded invoices freeze.
- **Fix:**
  - `reputation()` and `token()` view getters were added to the marketplace (deploy verifiability +
    frontend config). **Test:** `getters_return_wired_addresses`.
  - `scripts/deploy_mainnet.sh` was written: on mainnet, token = **real USDC SAC** (the mock is not
    deployed, IC-01), **admin** is used as the placeholder instead of the token, and after deploy it
    asserts `reputation() == REP_ID`, `token() == USDC_SAC`, `reputation() != token()`; if any step
    fails (`set -euo pipefail`), `deployments/mainnet.json` is **not written**. This prevents the
    placeholder from leaking to mainnet.

### IC-10 — Unchecked i128 for `sale_price`/`volume` → per-invoice DoS
- **Severity:** Low · **Status:** ✅ Fixed
- **Location:** `contracts/marketplace/src/types.rs` (sale_price), `contracts/reputation/src/lib.rs` (volume)
- **Description:** `sale_price = face_value*(10000-bps)/10000` was unchecked; `face_value` had no
  upper bound. With `face_value > ~1.7e34`, `buy_invoice` panicked on overflow, making that invoice
  unbuyable. The reputation `volume += amount` was also unchecked.
- **Fix:** A `MAX_FACE_VALUE=10^24` bound (`FaceTooLarge`); `sale_price` now uses `checked_mul`, and
  reputation `volume`/counters use `saturating_add`.
  - **Test:** `create_invoice_rejects_face_too_large`.

## 4. Fix Summary

| Area | Change |
|---|---|
| `marketplace/types.rs` | `Invoice.debtor: Address`; `DataKey::Paused`; new errors (`NotDebtor`, `DueTooFar`, `NameTooLong`, `FaceTooLarge`, `Paused`); `sale_price` `checked_mul` |
| `marketplace/lib.rs` | `create_invoice` debtor param + face/name/due upper-bound checks + pause; `settle` debtor-binding; `mark_default` `saturating_add`; `upgrade()`, `set_paused()`, `is_paused()`; read-path TTL bump; `filter()` bounded scan |
| `reputation/lib.rs` | `saturating_add` counters/volume; `get_score` read-path TTL bump |
| `test_token/lib.rs` | `__constructor` re-init guard; TESTNET-ONLY warning |
| Tests | +7 new regression tests; existing tests adapted to the new signature — **37/37 green**, `clippy` clean |

## 5. Residual Risks & Pre-Mainnet Recommendations

1. **IC-09 (Fixed):** `deploy_mainnet.sh` asserts the wiring with getters after deploy; on failure,
   `mainnet.json` is not written. The operator must use this script.
2. **IC-01 (deploy):** `deploy_mainnet.sh` does **not deploy** test_token; token = real
   **USDC SAC** (derived from/overridden by the asset). The operator must never deploy the mock.
3. **IC-05/IC-08/DD-2 (ops):** The admin must be a **multisig/hardware wallet**, not the deployer
   hot-key; the upgrade/pause key must be under the same protection.
4. **IC-06 (product):** The instant-advance model must be documented; the counterparty risk must be
   clearly communicated to the user; the non-resettability of reputation should be strengthened over time.
5. **IC-07 (ops):** A restore runbook must be prepared for mainnet; TTL archival should be monitored
   in a low-volume market.

## 6. Green-Light Status

All **Critical/High** findings were addressed (IC-02, IC-03 **Fixed**; IC-01 mitigated + enforced in
the deploy script). The objective Medium/Low defects (IC-04, IC-07, IC-08, IC-09, IC-10) are
**Fixed**. The remaining Medium findings are deliberate design decisions (IC-05, IC-06 — Acknowledged).

> **Conclusion:** The contract codebase and `deploy_mainnet.sh` are **ready** for mainnet deploy,
> provided the operator satisfies the following **operational preconditions**:
> (1) token = real **USDC SAC** (the script derives/verifies this — IC-01),
> (2) admin = **multisig/hardware wallet** (DD-2/IC-05/IC-08). 37/37 tests green, `clippy` clean.
