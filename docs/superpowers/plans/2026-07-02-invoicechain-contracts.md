# InvoiceChain Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and testnet-deploy the three Soroban contracts that power InvoiceChain — `test_token` (payment asset + faucet), `reputation` (on-chain trust score), and `marketplace` (create → sell → settle → default loop with cross-contract calls).

**Architecture:** A Cargo workspace with three contracts. `marketplace` is the core registry holding invoices in a `Map`; it calls the `test_token` client for value transfer and the `reputation` client to record settlement/default outcomes. TDD throughout using `soroban_sdk::testutils`.

**Tech Stack:** Rust, `soroban-sdk = "26"`, `stellar` CLI 27, wasm32v1-none target, testnet.

## Global Constraints

- `soroban-sdk = "26"` (workspace dependency, matches existing projects).
- Token decimals: **7** (Stellar standard).
- Faucet amount: **1000 USDC** = `10_000_000_000` (1000 × 10^7).
- Sale price formula: `face_value * (10000 - discount_bps) / 10000`.
- `discount_bps` valid range: `1..=9000` (0.01%–90%).
- Contract source layout per contract: `src/lib.rs`, `src/types.rs`, `src/events.rs`, `src/test.rs`.
- Every contract error is a `#[contracterror]` enum; no `panic!` with strings in production paths.
- Every state-changing entrypoint that spends a user's funds calls `require_auth` on that user.
- Build profile: workspace `release` profile from existing projects (opt-level "z", lto, panic=abort).

---

### Task 0: Workspace scaffold

**Files:**
- Create: `Cargo.toml` (workspace root)
- Create: `rust-toolchain.toml`
- Create: `README.md`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: nothing.
- Produces: a buildable (empty) Cargo workspace at `~/invoicechain`.

- [ ] **Step 1: Create workspace `Cargo.toml`**

```toml
[workspace]
resolver = "2"
members = [
  "contracts/*",
]

[workspace.dependencies]
soroban-sdk = "26"

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true

[profile.release-with-logs]
inherits = "release"
debug-assertions = true
```

- [ ] **Step 2: Pin the toolchain**

Create `rust-toolchain.toml`:

```toml
[toolchain]
channel = "1.96.0"
targets = ["wasm32v1-none"]
```

- [ ] **Step 3: Create README stub**

```markdown
# InvoiceChain
Invoice tokenization & factoring marketplace on Stellar (Soroban).
See `docs/superpowers/specs/2026-07-02-invoicechain-design.md`.

## Contracts
- `test_token` — SEP-41 test payment asset with a faucet.
- `reputation` — on-chain trust score.
- `marketplace` — create → sell → settle → default loop.
```

- [ ] **Step 4: Create CI skeleton**

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@1.96.0
        with:
          targets: wasm32v1-none
      - name: Test contracts
        run: cargo test
      - name: Build wasm
        run: cargo build --target wasm32v1-none --release
```

- [ ] **Step 5: Verify workspace resolves**

Run: `cd ~/invoicechain && cargo metadata --no-deps --format-version 1 > /dev/null && echo OK`
Expected: `OK` (no members yet is fine; if cargo errors on empty members, proceed — the next task adds one).

- [ ] **Step 6: Commit**

```bash
git add Cargo.toml rust-toolchain.toml README.md .github/workflows/ci.yml
git commit -m "chore: scaffold cargo workspace + CI"
```

---

### Task 1: `test_token` contract (SEP-41 + faucet)

**Files:**
- Create: `contracts/test_token/Cargo.toml`
- Create: `contracts/test_token/src/lib.rs`
- Create: `contracts/test_token/src/test.rs`

**Interfaces:**
- Consumes: nothing.
- Produces: a token contract with client methods used by `marketplace`:
  - `transfer(from: Address, to: Address, amount: i128)`
  - `transfer_from(spender: Address, from: Address, to: Address, amount: i128)`
  - `approve(from: Address, spender: Address, amount: i128, expiration_ledger: u32)`
  - `balance(id: Address) -> i128`
  - `faucet(to: Address)` — mints `1000e7` to `to`.
  - constructor: `__constructor(admin: Address, decimal: u32, name: String, symbol: String)`

- [ ] **Step 1: Create the contract Cargo.toml**

```toml
[package]
name = "test_token"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { workspace = true }

[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }
```

- [ ] **Step 2: Write the failing test for faucet + transfer**

Create `contracts/test_token/src/test.rs`:

```rust
#![cfg(test)]
use crate::{TestToken, TestTokenClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup(env: &Env) -> (Address, TestTokenClient) {
    let admin = Address::generate(env);
    let contract_id = env.register(
        TestToken,
        (admin.clone(), 7u32, String::from_str(env, "USD Coin"), String::from_str(env, "USDC")),
    );
    (admin, TestTokenClient::new(env, &contract_id))
}

#[test]
fn faucet_mints_1000() {
    let env = Env::default();
    env.mock_all_auths();
    let (_admin, token) = setup(&env);
    let user = Address::generate(&env);
    token.faucet(&user);
    assert_eq!(token.balance(&user), 10_000_000_000i128);
}

#[test]
fn transfer_from_moves_funds_with_allowance() {
    let env = Env::default();
    env.mock_all_auths();
    let (_admin, token) = setup(&env);
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let dest = Address::generate(&env);
    token.faucet(&owner);
    token.approve(&owner, &spender, &5_000_000_000i128, &1000);
    token.transfer_from(&spender, &owner, &dest, &4_000_000_000i128);
    assert_eq!(token.balance(&dest), 4_000_000_000i128);
    assert_eq!(token.balance(&owner), 6_000_000_000i128);
}
```

- [ ] **Step 3: Run to verify it fails**

Run: `cargo test -p test_token`
Expected: FAIL — `TestToken` / `TestTokenClient` unresolved.

- [ ] **Step 4: Implement the token in `contracts/test_token/src/lib.rs`**

Use the standard Soroban token pattern (balances + allowances in storage). Complete implementation:

```rust
#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String,
};

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Balance(Address),
    Allowance(AllowanceKey),
    Meta, // (decimals, name, symbol)
}

#[contracttype]
#[derive(Clone)]
struct AllowanceKey {
    from: Address,
    spender: Address,
}

#[contracttype]
#[derive(Clone)]
struct AllowanceValue {
    amount: i128,
    expiration_ledger: u32,
}

#[contracttype]
#[derive(Clone)]
struct Meta {
    decimal: u32,
    name: String,
    symbol: String,
}

const FAUCET_AMOUNT: i128 = 10_000_000_000; // 1000 * 10^7

#[contract]
pub struct TestToken;

fn read_balance(env: &Env, addr: &Address) -> i128 {
    env.storage().persistent().get(&DataKey::Balance(addr.clone())).unwrap_or(0)
}
fn write_balance(env: &Env, addr: &Address, amount: i128) {
    env.storage().persistent().set(&DataKey::Balance(addr.clone()), &amount);
}
fn read_allowance(env: &Env, from: &Address, spender: &Address) -> i128 {
    let key = DataKey::Allowance(AllowanceKey { from: from.clone(), spender: spender.clone() });
    match env.storage().temporary().get::<_, AllowanceValue>(&key) {
        Some(v) if v.expiration_ledger >= env.ledger().sequence() => v.amount,
        _ => 0,
    }
}
fn write_allowance(env: &Env, from: &Address, spender: &Address, amount: i128, exp: u32) {
    let key = DataKey::Allowance(AllowanceKey { from: from.clone(), spender: spender.clone() });
    env.storage().temporary().set(&key, &AllowanceValue { amount, expiration_ledger: exp });
}

#[contractimpl]
impl TestToken {
    pub fn __constructor(env: Env, admin: Address, decimal: u32, name: String, symbol: String) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Meta, &Meta { decimal, name, symbol });
    }

    pub fn faucet(env: Env, to: Address) {
        let bal = read_balance(&env, &to);
        write_balance(&env, &to, bal + FAUCET_AMOUNT);
        env.events().publish((symbol_short!("faucet"), to.clone()), FAUCET_AMOUNT);
    }

    pub fn approve(env: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32) {
        from.require_auth();
        write_allowance(&env, &from, &spender, amount, expiration_ledger);
        env.events().publish((symbol_short!("approve"), from, spender), amount);
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        read_allowance(&env, &from, &spender)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        let fb = read_balance(&env, &from);
        assert!(fb >= amount, "insufficient balance");
        write_balance(&env, &from, fb - amount);
        write_balance(&env, &to, read_balance(&env, &to) + amount);
        env.events().publish((symbol_short!("transfer"), from, to), amount);
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        let allow = read_allowance(&env, &from, &spender);
        assert!(allow >= amount, "insufficient allowance");
        let fb = read_balance(&env, &from);
        assert!(fb >= amount, "insufficient balance");
        write_allowance(&env, &from, &spender, allow - amount, env.ledger().sequence() + 1);
        write_balance(&env, &from, fb - amount);
        write_balance(&env, &to, read_balance(&env, &to) + amount);
        env.events().publish((symbol_short!("transfer"), from, to), amount);
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        read_balance(&env, &id)
    }

    pub fn decimals(env: Env) -> u32 {
        let m: Meta = env.storage().instance().get(&DataKey::Meta).unwrap();
        m.decimal
    }
    pub fn name(env: Env) -> String {
        let m: Meta = env.storage().instance().get(&DataKey::Meta).unwrap();
        m.name
    }
    pub fn symbol(env: Env) -> String {
        let m: Meta = env.storage().instance().get(&DataKey::Meta).unwrap();
        m.symbol
    }
}

mod test;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cargo test -p test_token`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add contracts/test_token
git commit -m "feat(test_token): SEP-41 token with faucet"
```

---

### Task 2: `reputation` contract

**Files:**
- Create: `contracts/reputation/Cargo.toml`
- Create: `contracts/reputation/src/lib.rs`
- Create: `contracts/reputation/src/types.rs`
- Create: `contracts/reputation/src/test.rs`

**Interfaces:**
- Consumes: nothing.
- Produces: client methods used by `marketplace`:
  - `__constructor(marketplace: Address)`
  - `record_settled(party: Address, amount: i128)`
  - `record_defaulted(party: Address)`
  - `get_score(party: Address) -> Score`
  - `Score { settled_count: u32, defaulted_count: u32, volume: i128 }`
  - error enum `RepError { AlreadyInitialized = 1, Unauthorized = 2 }`

- [ ] **Step 1: Create Cargo.toml**

```toml
[package]
name = "reputation"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { workspace = true }

[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }
```

- [ ] **Step 2: Define types in `contracts/reputation/src/types.rs`**

```rust
use soroban_sdk::{contracterror, contracttype, Address};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Score {
    pub settled_count: u32,
    pub defaulted_count: u32,
    pub volume: i128,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Marketplace,
    Score(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum RepError {
    AlreadyInitialized = 1,
    Unauthorized = 2,
}
```

- [ ] **Step 3: Write failing tests in `contracts/reputation/src/test.rs`**

```rust
#![cfg(test)]
use crate::{types::Score, Reputation, ReputationClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

fn setup(env: &Env) -> (Address, ReputationClient) {
    let marketplace = Address::generate(env);
    let id = env.register(Reputation, (marketplace.clone(),));
    (marketplace, ReputationClient::new(env, &id))
}

#[test]
fn records_settled_and_defaulted() {
    let env = Env::default();
    env.mock_all_auths();
    let (_mkt, rep) = setup(&env);
    let party = Address::generate(&env);

    rep.record_settled(&party, &500i128);
    rep.record_settled(&party, &300i128);
    rep.record_defaulted(&party);

    let s: Score = rep.get_score(&party);
    assert_eq!(s.settled_count, 2);
    assert_eq!(s.defaulted_count, 1);
    assert_eq!(s.volume, 800);
}

#[test]
fn unknown_party_scores_zero() {
    let env = Env::default();
    let (_mkt, rep) = setup(&env);
    let s = rep.get_score(&Address::generate(&env));
    assert_eq!(s, Score { settled_count: 0, defaulted_count: 0, volume: 0 });
}
```

- [ ] **Step 4: Run to verify failure**

Run: `cargo test -p reputation`
Expected: FAIL — `Reputation` unresolved.

- [ ] **Step 5: Implement `contracts/reputation/src/lib.rs`**

```rust
#![no_std]
mod types;
mod test;

use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env};
use types::{DataKey, RepError, Score};

fn require_marketplace(env: &Env) {
    let mkt: Address = env.storage().instance().get(&DataKey::Marketplace).unwrap();
    mkt.require_auth();
}

fn read_score(env: &Env, party: &Address) -> Score {
    env.storage()
        .persistent()
        .get(&DataKey::Score(party.clone()))
        .unwrap_or(Score { settled_count: 0, defaulted_count: 0, volume: 0 })
}

#[contract]
pub struct Reputation;

#[contractimpl]
impl Reputation {
    pub fn __constructor(env: Env, marketplace: Address) {
        if env.storage().instance().has(&DataKey::Marketplace) {
            panic_with_error(&env, RepError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Marketplace, &marketplace);
    }

    pub fn record_settled(env: Env, party: Address, amount: i128) {
        require_marketplace(&env);
        let mut s = read_score(&env, &party);
        s.settled_count += 1;
        s.volume += amount;
        env.storage().persistent().set(&DataKey::Score(party.clone()), &s);
        env.events().publish((symbol_short!("rep_up"), party), s.settled_count);
    }

    pub fn record_defaulted(env: Env, party: Address) {
        require_marketplace(&env);
        let mut s = read_score(&env, &party);
        s.defaulted_count += 1;
        env.storage().persistent().set(&DataKey::Score(party.clone()), &s);
        env.events().publish((symbol_short!("rep_down"), party), s.defaulted_count);
    }

    pub fn get_score(env: Env, party: Address) -> Score {
        read_score(&env, &party)
    }
}

fn panic_with_error(env: &Env, e: RepError) -> ! {
    soroban_sdk::panic_with_error!(env, e)
}
```

Note: `require_marketplace` uses `require_auth` on the stored marketplace address so only the marketplace contract (or a mocked auth in tests) can write. This is the cross-contract authorization boundary.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cargo test -p reputation`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add contracts/reputation
git commit -m "feat(reputation): on-chain trust score, marketplace-gated writes"
```

---

### Task 3: `marketplace` — scaffold + `create_invoice`

**Files:**
- Create: `contracts/marketplace/Cargo.toml`
- Create: `contracts/marketplace/src/types.rs`
- Create: `contracts/marketplace/src/lib.rs`
- Create: `contracts/marketplace/src/test.rs`

**Interfaces:**
- Consumes: `test_token` and `reputation` (as wasm imports in tests).
- Produces:
  - `__constructor(admin: Address, token: Address, reputation: Address)`
  - `create_invoice(seller: Address, debtor_name: String, face_value: i128, due_ledger: u64, discount_bps: u32) -> u64`
  - `get_invoice(id: u64) -> Invoice`
  - `Invoice`, `Status`, `MarketError` (see types).

- [ ] **Step 1: Create Cargo.toml (imports sibling contracts for tests)**

```toml
[package]
name = "marketplace"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { workspace = true }

[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }
test_token = { path = "../test_token", features = ["testutils"] }
reputation = { path = "../reputation", features = ["testutils"] }
```

Also add to `contracts/test_token/Cargo.toml` and `contracts/reputation/Cargo.toml` a `testutils` feature so they can be imported for cross-contract tests:

```toml
[features]
testutils = ["soroban-sdk/testutils"]
```

- [ ] **Step 2: Define types in `contracts/marketplace/src/types.rs`**

```rust
use soroban_sdk::{contracterror, contracttype, Address, String};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Status {
    Listed,
    Funded,
    Settled,
    Defaulted,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Invoice {
    pub id: u64,
    pub seller: Address,
    pub debtor_name: String,
    pub face_value: i128,
    pub discount_bps: u32,
    pub due_ledger: u64,
    pub owner: Address,
    pub status: Status,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token,
    Reputation,
    NextId,
    Invoice(u64),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum MarketError {
    AlreadyInitialized = 1,
    ZeroAmount = 2,
    InvalidDiscount = 3,
    DueInPast = 4,
    NotFound = 5,
    NotListed = 6,
    NotFunded = 7,
    NotSeller = 8,
    NotDueYet = 9,
}

pub fn sale_price(face_value: i128, discount_bps: u32) -> i128 {
    face_value * (10000 - discount_bps as i128) / 10000
}
```

- [ ] **Step 3: Write the failing test for create_invoice**

Create `contracts/marketplace/src/test.rs`:

```rust
#![cfg(test)]
use crate::{types::Status, Marketplace, MarketplaceClient};
use soroban_sdk::{testutils::{Address as _, Ledger as _}, Address, Env, String};

pub struct Setup {
    pub env: Env,
    pub market: MarketplaceClient<'static>,
    pub token_id: Address,
}

pub fn setup() -> Setup {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(100);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register(
        test_token::TestToken,
        (token_admin, 7u32, String::from_str(&env, "USD Coin"), String::from_str(&env, "USDC")),
    );

    // marketplace must be created first-ish, but reputation needs marketplace addr.
    // Deploy reputation with a placeholder, then marketplace, then we accept that
    // reputation is constructed with the marketplace id. To resolve the cycle we
    // pre-generate the marketplace id by registering marketplace first with a
    // placeholder reputation, then registering reputation with the real market id,
    // then re-pointing. Simpler: register reputation pointing at a known market id.
    let market_id = env.register(
        Marketplace,
        // temporary reputation placeholder = token_id, replaced below via set_reputation
        (admin.clone(), token_id.clone(), token_id.clone()),
    );
    let rep_id = env.register(reputation::Reputation, (market_id.clone(),));
    let market = MarketplaceClient::new(&env, &market_id);
    market.set_reputation(&rep_id);

    Setup { env, market, token_id }
}

#[test]
fn create_invoice_stores_listed() {
    let s = setup();
    let seller = Address::generate(&s.env);
    let id = s.market.create_invoice(
        &seller,
        &String::from_str(&s.env, "ACME Corp"),
        &1_000_000_000i128, // 100 USDC face
        &500u64,            // due ledger
        &1000u32,           // 10% discount
    );
    let inv = s.market.get_invoice(&id);
    assert_eq!(inv.status, Status::Listed);
    assert_eq!(inv.seller, seller);
    assert_eq!(inv.face_value, 1_000_000_000i128);
    assert_eq!(inv.owner, seller);
}
```

Note the constructor cycle resolution: `marketplace` gets a `set_reputation(addr)` admin-only setter so we can wire the two contracts after both are deployed. Add this to the interface.

- [ ] **Step 4: Run to verify failure**

Run: `cargo test -p marketplace`
Expected: FAIL — `Marketplace` unresolved.

- [ ] **Step 5: Implement `contracts/marketplace/src/lib.rs` (constructor + create + set_reputation + get)**

```rust
#![no_std]
mod types;
mod test;

use soroban_sdk::{contract, contractimpl, panic_with_error, symbol_short, Address, Env, String};
use types::{sale_price, DataKey, Invoice, MarketError, Status};

fn read_invoice(env: &Env, id: u64) -> Invoice {
    env.storage()
        .persistent()
        .get(&DataKey::Invoice(id))
        .unwrap_or_else(|| panic_with_error!(env, MarketError::NotFound))
}
fn write_invoice(env: &Env, inv: &Invoice) {
    env.storage().persistent().set(&DataKey::Invoice(inv.id), inv);
}
fn admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

#[contract]
pub struct Marketplace;

#[contractimpl]
impl Marketplace {
    pub fn __constructor(env: Env, admin: Address, token: Address, reputation: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, MarketError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Reputation, &reputation);
        env.storage().instance().set(&DataKey::NextId, &0u64);
    }

    pub fn set_reputation(env: Env, reputation: Address) {
        admin(&env).require_auth();
        env.storage().instance().set(&DataKey::Reputation, &reputation);
    }

    pub fn create_invoice(
        env: Env,
        seller: Address,
        debtor_name: String,
        face_value: i128,
        due_ledger: u64,
        discount_bps: u32,
    ) -> u64 {
        seller.require_auth();
        if face_value <= 0 {
            panic_with_error!(&env, MarketError::ZeroAmount);
        }
        if discount_bps < 1 || discount_bps > 9000 {
            panic_with_error!(&env, MarketError::InvalidDiscount);
        }
        if due_ledger <= env.ledger().sequence() as u64 {
            panic_with_error!(&env, MarketError::DueInPast);
        }
        let id: u64 = env.storage().instance().get(&DataKey::NextId).unwrap();
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        let inv = Invoice {
            id,
            seller: seller.clone(),
            debtor_name,
            face_value,
            discount_bps,
            due_ledger,
            owner: seller.clone(),
            status: Status::Listed,
        };
        write_invoice(&env, &inv);
        env.events().publish((symbol_short!("created"), seller), (id, face_value));
        id
    }

    pub fn get_invoice(env: Env, id: u64) -> Invoice {
        read_invoice(&env, id)
    }

    // buy/settle/default/cancel/views added in later tasks.

    #[doc(hidden)]
    pub fn _sale_price(_env: Env, face_value: i128, discount_bps: u32) -> i128 {
        sale_price(face_value, discount_bps)
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cargo test -p marketplace`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
git add contracts/marketplace contracts/test_token/Cargo.toml contracts/reputation/Cargo.toml
git commit -m "feat(marketplace): scaffold + create_invoice"
```

---

### Task 4: `marketplace` — `buy_invoice`

**Files:**
- Modify: `contracts/marketplace/src/lib.rs`
- Modify: `contracts/marketplace/src/test.rs`

**Interfaces:**
- Consumes: `create_invoice`, `test_token` client (`faucet`, `approve`, `balance`).
- Produces: `buy_invoice(id: u64, investor: Address)`.

- [ ] **Step 1: Write the failing test**

Append to `contracts/marketplace/src/test.rs`:

```rust
#[test]
fn buy_invoice_transfers_discounted_price_to_seller() {
    let s = setup();
    let token = test_token::TestTokenClient::new(&s.env, &s.token_id);
    let seller = Address::generate(&s.env);
    let investor = Address::generate(&s.env);

    let id = s.market.create_invoice(
        &seller, &String::from_str(&s.env, "ACME"),
        &1_000_000_000i128, &500u64, &1000u32, // 100 USDC, 10% discount → price 90 USDC
    );

    token.faucet(&investor); // 1000 USDC
    token.approve(&investor, &s.market.address, &1_000_000_000i128, &10000);
    s.market.buy_invoice(&id, &investor);

    let inv = s.market.get_invoice(&id);
    assert_eq!(inv.status, Status::Funded);
    assert_eq!(inv.owner, investor);
    assert_eq!(token.balance(&seller), 900_000_000i128);   // 90 USDC
    assert_eq!(token.balance(&investor), 9_100_000_000i128); // 1000 - 90
}
```

- [ ] **Step 2: Run to verify failure**

Run: `cargo test -p marketplace buy_invoice`
Expected: FAIL — `buy_invoice` not found.

- [ ] **Step 3: Add `buy_invoice` to `lib.rs`**

Add these imports at the top (replace the existing `use` line for token client):

```rust
use soroban_sdk::token::TokenClient;
```

Add the method inside `impl Marketplace`:

```rust
    pub fn buy_invoice(env: Env, id: u64, investor: Address) {
        investor.require_auth();
        let mut inv = read_invoice(&env, id);
        if inv.status != Status::Listed {
            panic_with_error!(&env, MarketError::NotListed);
        }
        let price = sale_price(inv.face_value, inv.discount_bps);
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token = TokenClient::new(&env, &token_addr);
        token.transfer_from(&env.current_contract_address(), &investor, &inv.seller, &price);
        inv.owner = investor.clone();
        inv.status = Status::Funded;
        write_invoice(&env, &inv);
        env.events().publish((symbol_short!("funded"), investor), (id, price));
    }
```

Note: `test_token`'s `transfer_from` signature is `(spender, from, to, amount)`; `TokenClient` (the standard SEP-41 client) matches this. The marketplace is the spender, so the investor must `approve` the marketplace. In tests `mock_all_auths` covers the spender auth.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test -p marketplace`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add contracts/marketplace/src
git commit -m "feat(marketplace): buy_invoice with token transfer_from"
```

---

### Task 5: `marketplace` — `settle` + reputation cross-call

**Files:**
- Modify: `contracts/marketplace/src/lib.rs`
- Modify: `contracts/marketplace/src/test.rs`

**Interfaces:**
- Consumes: `buy_invoice`, `reputation` client `record_settled`.
- Produces: `settle(id: u64, payer: Address)`.

- [ ] **Step 1: Write the failing test**

Append to `test.rs`:

```rust
#[test]
fn settle_pays_owner_face_value_and_bumps_reputation() {
    let s = setup();
    let token = test_token::TestTokenClient::new(&s.env, &s.token_id);
    let seller = Address::generate(&s.env);
    let investor = Address::generate(&s.env);
    let debtor = Address::generate(&s.env);

    let id = s.market.create_invoice(
        &seller, &String::from_str(&s.env, "ACME"),
        &1_000_000_000i128, &500u64, &1000u32,
    );
    token.faucet(&investor);
    token.approve(&investor, &s.market.address, &1_000_000_000i128, &10000);
    s.market.buy_invoice(&id, &investor);

    token.faucet(&debtor);
    token.approve(&debtor, &s.market.address, &1_000_000_000i128, &10000);
    s.market.settle(&id, &debtor);

    let inv = s.market.get_invoice(&id);
    assert_eq!(inv.status, Status::Settled);
    // investor received full face value (100 USDC) on top of prior balance
    assert_eq!(token.balance(&investor), 9_100_000_000i128 + 1_000_000_000i128);
}
```

- [ ] **Step 2: Run to verify failure**

Run: `cargo test -p marketplace settle`
Expected: FAIL — `settle` not found.

- [ ] **Step 3: Add `settle` and a reputation client helper to `lib.rs`**

Add a reputation contract client import. Because `reputation` is a sibling crate, generate its client via `contractimport` is unnecessary — use `reputation::ReputationClient` directly (available because the crate is a dev+build dependency). To call it from non-test wasm too, add `reputation` as a normal dependency:

In `contracts/marketplace/Cargo.toml`, move `reputation` and `test_token` to `[dependencies]` (they compile as rlibs):

```toml
[dependencies]
soroban-sdk = { workspace = true }
reputation = { path = "../reputation" }
```

Keep `test_token` under `[dev-dependencies]` only (marketplace calls the token via the generic `TokenClient`, so it doesn't need the concrete crate outside tests).

Add the method:

```rust
    pub fn settle(env: Env, id: u64, payer: Address) {
        payer.require_auth();
        let mut inv = read_invoice(&env, id);
        if inv.status != Status::Funded {
            panic_with_error!(&env, MarketError::NotFunded);
        }
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token = TokenClient::new(&env, &token_addr);
        token.transfer_from(&env.current_contract_address(), &payer, &inv.owner, &inv.face_value);
        inv.status = Status::Settled;
        write_invoice(&env, &inv);

        let rep_addr: Address = env.storage().instance().get(&DataKey::Reputation).unwrap();
        let rep = reputation::ReputationClient::new(&env, &rep_addr);
        rep.record_settled(&inv.seller, &inv.face_value);

        env.events().publish((symbol_short!("settled"), inv.seller.clone()), (id, inv.face_value));
    }
```

Note: the cross-contract `record_settled` call requires the marketplace to satisfy `reputation`'s `require_marketplace` auth. In on-chain execution the marketplace contract is the invoker, so its address is the authorizer automatically. In tests, `mock_all_auths` covers it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test -p marketplace`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add contracts/marketplace
git commit -m "feat(marketplace): settle + reputation cross-contract call"
```

---

### Task 6: `marketplace` — `mark_default` + `cancel_invoice` + views

**Files:**
- Modify: `contracts/marketplace/src/lib.rs`
- Modify: `contracts/marketplace/src/test.rs`

**Interfaces:**
- Produces:
  - `mark_default(id: u64)`
  - `cancel_invoice(id: u64)`
  - `list_open(env) -> Vec<Invoice>`
  - `list_by_owner(owner) -> Vec<Invoice>`
  - `list_by_seller(seller) -> Vec<Invoice>`

- [ ] **Step 1: Write failing tests**

Append to `test.rs`:

```rust
#[test]
fn mark_default_after_due_sets_defaulted_and_penalizes() {
    let s = setup();
    let token = test_token::TestTokenClient::new(&s.env, &s.token_id);
    let seller = Address::generate(&s.env);
    let investor = Address::generate(&s.env);
    let id = s.market.create_invoice(
        &seller, &String::from_str(&s.env, "ACME"),
        &1_000_000_000i128, &500u64, &1000u32,
    );
    token.faucet(&investor);
    token.approve(&investor, &s.market.address, &1_000_000_000i128, &10000);
    s.market.buy_invoice(&id, &investor);

    s.env.ledger().set_sequence_number(600); // past due 500
    s.market.mark_default(&id);
    assert_eq!(s.market.get_invoice(&id).status, Status::Defaulted);
}

#[test]
#[should_panic]
fn mark_default_before_due_panics() {
    let s = setup();
    let token = test_token::TestTokenClient::new(&s.env, &s.token_id);
    let seller = Address::generate(&s.env);
    let investor = Address::generate(&s.env);
    let id = s.market.create_invoice(
        &seller, &String::from_str(&s.env, "ACME"),
        &1_000_000_000i128, &500u64, &1000u32,
    );
    token.faucet(&investor);
    token.approve(&investor, &s.market.address, &1_000_000_000i128, &10000);
    s.market.buy_invoice(&id, &investor);
    s.market.mark_default(&id); // still ledger 100 < 500
}

#[test]
fn cancel_listed_invoice() {
    let s = setup();
    let seller = Address::generate(&s.env);
    let id = s.market.create_invoice(
        &seller, &String::from_str(&s.env, "ACME"),
        &1_000_000_000i128, &500u64, &1000u32,
    );
    s.market.cancel_invoice(&id);
    assert_eq!(s.market.get_invoice(&id).status, Status::Cancelled);
}

#[test]
fn list_open_returns_only_listed() {
    let s = setup();
    let seller = Address::generate(&s.env);
    s.market.create_invoice(&seller, &String::from_str(&s.env, "A"), &1_000_000_000i128, &500u64, &1000u32);
    let id2 = s.market.create_invoice(&seller, &String::from_str(&s.env, "B"), &2_000_000_000i128, &500u64, &1000u32);
    s.market.cancel_invoice(&id2);
    assert_eq!(s.market.list_open().len(), 1);
}
```

- [ ] **Step 2: Run to verify failure**

Run: `cargo test -p marketplace`
Expected: FAIL — `mark_default` / `cancel_invoice` / `list_open` not found.

- [ ] **Step 3: Add methods to `lib.rs`**

Add `Vec` to imports: `use soroban_sdk::{..., Vec};`

```rust
    pub fn cancel_invoice(env: Env, id: u64) {
        let mut inv = read_invoice(&env, id);
        inv.seller.require_auth();
        if inv.status != Status::Listed {
            panic_with_error!(&env, MarketError::NotListed);
        }
        inv.status = Status::Cancelled;
        write_invoice(&env, &inv);
        env.events().publish((symbol_short!("cancelled"), inv.seller.clone()), id);
    }

    pub fn mark_default(env: Env, id: u64) {
        let mut inv = read_invoice(&env, id);
        if inv.status != Status::Funded {
            panic_with_error!(&env, MarketError::NotFunded);
        }
        if (env.ledger().sequence() as u64) < inv.due_ledger {
            panic_with_error!(&env, MarketError::NotDueYet);
        }
        inv.status = Status::Defaulted;
        write_invoice(&env, &inv);
        let rep_addr: Address = env.storage().instance().get(&DataKey::Reputation).unwrap();
        let rep = reputation::ReputationClient::new(&env, &rep_addr);
        rep.record_defaulted(&inv.seller);
        env.events().publish((symbol_short!("defaulted"), inv.seller.clone()), id);
    }

    pub fn list_open(env: Env) -> Vec<Invoice> {
        Self::filter(&env, |i| i.status == Status::Listed)
    }
    pub fn list_by_owner(env: Env, owner: Address) -> Vec<Invoice> {
        Self::filter(&env, |i| i.owner == owner)
    }
    pub fn list_by_seller(env: Env, seller: Address) -> Vec<Invoice> {
        Self::filter(&env, |i| i.seller == seller)
    }
```

Add a private helper (outside `#[contractimpl]`, as an inherent impl or free fn). Use a free function to avoid exporting it:

```rust
impl Marketplace {
    fn filter(env: &Env, pred: impl Fn(&Invoice) -> bool) -> Vec<Invoice> {
        let next: u64 = env.storage().instance().get(&DataKey::NextId).unwrap_or(0);
        let mut out = Vec::new(env);
        let mut i = 0u64;
        while i < next {
            if let Some(inv) = env.storage().persistent().get::<_, Invoice>(&DataKey::Invoice(i)) {
                if pred(&inv) {
                    out.push_back(inv);
                }
            }
            i += 1;
        }
        out
    }
}
```

Place this second `impl Marketplace` block (without `#[contractimpl]`) below the exported one.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test -p marketplace`
Expected: PASS (7 tests total).

- [ ] **Step 5: Commit**

```bash
git add contracts/marketplace
git commit -m "feat(marketplace): mark_default, cancel, list views"
```

---

### Task 7: WASM build verification + optimization

**Files:**
- None (build only).

- [ ] **Step 1: Build all contracts to wasm**

Run: `cd ~/invoicechain && stellar contract build`
Expected: three `.wasm` files under `target/wasm32v1-none/release/`: `test_token.wasm`, `reputation.wasm`, `marketplace.wasm`.

- [ ] **Step 2: Optimize each wasm**

```bash
for c in test_token reputation marketplace; do
  stellar contract optimize --wasm target/wasm32v1-none/release/$c.wasm
done
```
Expected: `*.optimized.wasm` produced; sizes reported.

- [ ] **Step 3: Run the full test suite once more**

Run: `cargo test`
Expected: all tests PASS across the three crates.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: verify wasm build + optimize"
```

---

### Task 8: Testnet deployment script

**Files:**
- Create: `scripts/deploy_testnet.sh`
- Create: `deployments/testnet.json` (written by the script)

**Interfaces:**
- Consumes: built wasm from Task 7.
- Produces: on-chain contract IDs recorded in `deployments/testnet.json` (consumed later by the frontend plan).

- [ ] **Step 1: Write the deploy script**

Create `scripts/deploy_testnet.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

NET=testnet
SRC=${1:-deployer}   # a funded testnet identity: stellar keys generate deployer --network testnet --fund

echo "Building..."
stellar contract build
for c in test_token reputation marketplace; do
  stellar contract optimize --wasm target/wasm32v1-none/release/$c.wasm
done

WASM_DIR=target/wasm32v1-none/release

echo "Deploying test_token..."
TOKEN_ID=$(stellar contract deploy --wasm $WASM_DIR/test_token.optimized.wasm \
  --source "$SRC" --network $NET -- \
  --admin "$(stellar keys address "$SRC")" --decimal 7 --name "USD Coin" --symbol "USDC")

echo "Deploying marketplace (reputation placeholder = token)..."
MARKET_ID=$(stellar contract deploy --wasm $WASM_DIR/marketplace.optimized.wasm \
  --source "$SRC" --network $NET -- \
  --admin "$(stellar keys address "$SRC")" --token "$TOKEN_ID" --reputation "$TOKEN_ID")

echo "Deploying reputation (points at marketplace)..."
REP_ID=$(stellar contract deploy --wasm $WASM_DIR/reputation.optimized.wasm \
  --source "$SRC" --network $NET -- \
  --marketplace "$MARKET_ID")

echo "Wiring marketplace -> reputation..."
stellar contract invoke --id "$MARKET_ID" --source "$SRC" --network $NET -- \
  set_reputation --reputation "$REP_ID"

mkdir -p deployments
cat > deployments/testnet.json <<EOF
{
  "network": "testnet",
  "token": "$TOKEN_ID",
  "marketplace": "$MARKET_ID",
  "reputation": "$REP_ID"
}
EOF
echo "Wrote deployments/testnet.json"
cat deployments/testnet.json
```

- [ ] **Step 2: Make it executable and create a funded identity**

```bash
chmod +x scripts/deploy_testnet.sh
stellar keys generate deployer --network testnet --fund || true
```
Expected: identity `deployer` exists and is funded (friendbot).

- [ ] **Step 3: Run the deployment**

Run: `./scripts/deploy_testnet.sh deployer`
Expected: three contract IDs printed and `deployments/testnet.json` written with `token`, `marketplace`, `reputation` addresses (each starts with `C...`).

- [ ] **Step 4: Smoke-test on testnet**

```bash
source <(python3 -c "import json;d=json.load(open('deployments/testnet.json'));print(f'export TOKEN={d[\"token\"]} MARKET={d[\"marketplace\"]}')")
stellar keys generate alice --network testnet --fund || true
ALICE=$(stellar keys address alice)
stellar contract invoke --id "$TOKEN" --source alice --network testnet -- faucet --to "$ALICE"
stellar contract invoke --id "$TOKEN" --source alice --network testnet -- balance --id "$ALICE"
```
Expected: balance returns `"10000000000"`.

- [ ] **Step 5: Commit**

```bash
git add scripts/deploy_testnet.sh deployments/testnet.json
git commit -m "feat: testnet deploy script + recorded contract IDs"
```

---

## Self-Review

**Spec coverage:**
- test_token + faucet → Task 1 ✅
- reputation (settled/defaulted, marketplace-gated) → Task 2 ✅
- marketplace create → Task 3 ✅; buy → Task 4 ✅; settle + cross-call → Task 5 ✅; default + cancel + views → Task 6 ✅
- cross-contract calls (marketplace→token, marketplace→reputation) → Tasks 4/5/6 ✅
- testnet deployment → Task 8 ✅
- Mock Anchor, frontend, monitoring, analytics, feedback → **out of scope for this plan** (frontend + production plans, written next).

**Placeholder scan:** no TBD/TODO; all code shown. The constructor cycle (marketplace↔reputation) is resolved explicitly via `set_reputation`.

**Type consistency:** `Invoice`, `Status`, `Score`, `MarketError`, `RepError` defined once in their `types.rs`; `sale_price` shared; `transfer_from(spender, from, to, amount)` consistent between `test_token` and the standard `TokenClient` used by `marketplace`; `record_settled(party, amount)` / `record_defaulted(party)` consistent between reputation impl and marketplace calls.

## Execution Handoff

This is Plan 1 of 3 (Contracts → Frontend → Production). After the contracts are green and deployed, Plan 2 (frontend) will be written against the concrete contract IDs in `deployments/testnet.json`.
