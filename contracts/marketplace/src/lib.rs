#![no_std]
#![allow(deprecated)]
mod types;
#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractclient, contractimpl, panic_with_error, symbol_short, token::TokenClient, Address, BytesN, Env, String, Vec};
use types::{sale_price, DataKey, Invoice, MarketError, Status};

/// Generated cross-contract client for the Reputation contract.
/// Using #[contractclient] instead of linking the reputation crate directly
/// avoids duplicate wasm symbol collisions at link time.
#[contractclient(name = "ReputationClient")]
pub trait ReputationInterface {
    fn record_settled(env: Env, party: Address, amount: i128);
    fn record_defaulted(env: Env, party: Address);
}

const DAY_IN_LEDGERS: u32 = 17_280;
const INVOICE_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const INVOICE_LIFETIME_THRESHOLD: u32 = INVOICE_BUMP_AMOUNT - DAY_IN_LEDGERS;
const GRACE_PERIOD_LEDGERS: u64 = 17_280; // ~1 day at 5s/ledger

// IC-04: cap how far in the future an invoice may be due (~1 year) so that
// `due_ledger + GRACE_PERIOD_LEDGERS` cannot overflow u64 and mark_default
// stays callable for every invoice.
const MAX_INVOICE_HORIZON: u64 = 365 * DAY_IN_LEDGERS as u64; // ~6.3M ledgers

// IC-10: cap face_value so `face_value * 10000` in sale_price cannot overflow
// i128 (10^24 * 10^4 = 10^28, far below i128::MAX ≈ 1.7e38). 10^24 base units
// is astronomically larger than any real 7-decimal USDC invoice.
const MAX_FACE_VALUE: i128 = 1_000_000_000_000_000_000_000_000; // 10^24

// IC-03: bound debtor_name length to cap the per-entry read-byte cost that
// list_* pays when scanning stored invoices.
const MAX_DEBTOR_NAME_LEN: u32 = 64;

// IC-03: bound how many invoice entries the on-chain list_* views will scan so
// an ever-growing NextId cannot push them past the per-tx read limit and
// permanently brick listing. This is best-effort convenience; full/paginated
// history should be served by an off-chain indexer built from contract events.
const MAX_LIST_SCAN: u64 = 1000;

fn require_not_paused(env: &Env) {
    let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap_or(false);
    if paused {
        panic_with_error!(env, MarketError::Paused);
    }
}

// IC-07: bump the shared instance entry (Admin/Token/Reputation/NextId/Paused)
// TTL. Called from read paths too, so a busy-but-read-only market does not let
// the instance entry archive after ~30 days of no writes.
fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INVOICE_LIFETIME_THRESHOLD, INVOICE_BUMP_AMOUNT);
}

fn read_invoice(env: &Env, id: u64) -> Invoice {
    env.storage()
        .persistent()
        .get(&DataKey::Invoice(id))
        .unwrap_or_else(|| panic_with_error!(env, MarketError::NotFound))
}

fn write_invoice(env: &Env, inv: &Invoice) {
    env.storage().persistent().set(&DataKey::Invoice(inv.id), inv);
    env.storage().persistent().extend_ttl(
        &DataKey::Invoice(inv.id),
        INVOICE_LIFETIME_THRESHOLD,
        INVOICE_BUMP_AMOUNT,
    );
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
        env.storage().instance().extend_ttl(INVOICE_LIFETIME_THRESHOLD, INVOICE_BUMP_AMOUNT);
    }

    pub fn set_reputation(env: Env, reputation: Address) {
        admin(&env).require_auth();
        env.storage().instance().set(&DataKey::Reputation, &reputation);
        bump_instance(&env);
    }

    /// IC-08 (DD-1): admin-gated in-place upgrade. Lets a discovered bug in the
    /// money-moving flows be patched without a full redeploy + state migration.
    /// The admin SHOULD be a multisig/timelock account on mainnet (see DD-2).
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        admin(&env).require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    /// IC-08 (DD-3): admin-gated circuit breaker. Only blocks NEW activity
    /// (create_invoice / buy_invoice); settle, mark_default and cancel remain
    /// available while paused so no funded invoice can ever be locked.
    pub fn set_paused(env: Env, paused: bool) {
        admin(&env).require_auth();
        env.storage().instance().set(&DataKey::Paused, &paused);
        bump_instance(&env);
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }

    /// IC-09: expose the wired reputation/token addresses so a deploy script can
    /// assert the marketplace is correctly configured (reputation != token) and
    /// the frontend can read them without a hardcoded config.
    pub fn reputation(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Reputation).unwrap()
    }

    pub fn token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Token).unwrap()
    }

    pub fn create_invoice(
        env: Env,
        seller: Address,
        debtor: Address,
        debtor_name: String,
        face_value: i128,
        due_ledger: u64,
        discount_bps: u32,
    ) -> u64 {
        seller.require_auth();
        require_not_paused(&env);
        if face_value <= 0 {
            panic_with_error!(&env, MarketError::ZeroAmount);
        }
        // IC-10: reject absurd face_value so sale_price cannot overflow i128.
        if face_value > MAX_FACE_VALUE {
            panic_with_error!(&env, MarketError::FaceTooLarge);
        }
        if !(1..=9000).contains(&discount_bps) {
            panic_with_error!(&env, MarketError::InvalidDiscount);
        }
        // IC-03: reject oversized debtor_name to bound per-entry read cost.
        if debtor_name.len() > MAX_DEBTOR_NAME_LEN {
            panic_with_error!(&env, MarketError::NameTooLong);
        }
        let seq = env.ledger().sequence() as u64;
        if due_ledger <= seq {
            panic_with_error!(&env, MarketError::DueInPast);
        }
        // IC-04: reject due dates so far out that due_ledger + GRACE would
        // overflow u64 and permanently break mark_default.
        if due_ledger > seq + MAX_INVOICE_HORIZON {
            panic_with_error!(&env, MarketError::DueTooFar);
        }
        let id: u64 = env.storage().instance().get(&DataKey::NextId).unwrap();
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        let inv = Invoice {
            id,
            seller: seller.clone(),
            debtor,
            debtor_name,
            face_value,
            discount_bps,
            due_ledger,
            owner: seller.clone(),
            status: Status::Listed,
        };
        write_invoice(&env, &inv);
        bump_instance(&env);
        env.events().publish((symbol_short!("created"), seller), (id, face_value));
        id
    }

    pub fn get_invoice(env: Env, id: u64) -> Invoice {
        bump_instance(&env); // IC-07
        read_invoice(&env, id)
    }

    pub fn buy_invoice(env: Env, id: u64, investor: Address) {
        investor.require_auth();
        require_not_paused(&env);
        let mut inv = read_invoice(&env, id);
        if inv.status != Status::Listed {
            panic_with_error!(&env, MarketError::NotListed);
        }
        // Fix 1: reject invoices that are already past due
        if inv.due_ledger <= env.ledger().sequence() as u64 {
            panic_with_error!(&env, MarketError::DueInPast);
        }
        // Fix 2: CEI — compute price, write state BEFORE external token call
        let price = sale_price(inv.face_value, inv.discount_bps);
        inv.owner = investor.clone();
        inv.status = Status::Funded;
        write_invoice(&env, &inv);
        env.storage().instance().extend_ttl(INVOICE_LIFETIME_THRESHOLD, INVOICE_BUMP_AMOUNT);
        // Interaction: transfer discounted price from investor to seller
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token = TokenClient::new(&env, &token_addr);
        token.transfer_from(&env.current_contract_address(), &investor, &inv.seller, &price);
        env.events().publish((symbol_short!("funded"), investor), (id, price));
    }

    pub fn settle(env: Env, id: u64, payer: Address) {
        payer.require_auth();
        let mut inv = read_invoice(&env, id);
        if inv.status != Status::Funded {
            panic_with_error!(&env, MarketError::NotFunded);
        }
        // IC-02: only the real debtor may settle, so reputation credited on
        // settlement genuinely means "the debtor paid" and cannot be forged by
        // a third party (or the seller self-dealing) fronting the face value.
        if payer != inv.debtor {
            panic_with_error!(&env, MarketError::NotDebtor);
        }
        // CEI: capture values, write state BEFORE external interactions
        let seller = inv.seller.clone();
        let owner = inv.owner.clone();
        let face_value = inv.face_value;
        inv.status = Status::Settled;
        write_invoice(&env, &inv);
        env.storage().instance().extend_ttl(INVOICE_LIFETIME_THRESHOLD, INVOICE_BUMP_AMOUNT);

        // Interactions: token transfer then cross-contract reputation call
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token = TokenClient::new(&env, &token_addr);
        token.transfer_from(&env.current_contract_address(), &payer, &owner, &face_value);

        let rep_addr: Address = env.storage().instance().get(&DataKey::Reputation).unwrap();
        let rep = ReputationClient::new(&env, &rep_addr);
        rep.record_settled(&seller, &face_value);

        env.events().publish((symbol_short!("settled"), seller), (id, face_value));
    }

    pub fn cancel_invoice(env: Env, id: u64) {
        let mut inv = read_invoice(&env, id);
        inv.seller.require_auth();
        if inv.status != Status::Listed {
            panic_with_error!(&env, MarketError::NotListed);
        }
        inv.status = Status::Cancelled;
        write_invoice(&env, &inv);
        env.storage().instance().extend_ttl(INVOICE_LIFETIME_THRESHOLD, INVOICE_BUMP_AMOUNT);
        env.events().publish((symbol_short!("cancelled"), inv.seller.clone()), id);
    }

    pub fn mark_default(env: Env, id: u64) {
        let mut inv = read_invoice(&env, id);
        // Only the invoice owner (the investor, the harmed party) may default it.
        inv.owner.require_auth();
        if inv.status != Status::Funded {
            panic_with_error!(&env, MarketError::NotFunded);
        }
        // Grace period: default is only allowed once the invoice is past due
        // by at least GRACE_PERIOD_LEDGERS, so a barely-late invoice cannot be
        // defaulted the instant it crosses due_ledger.
        // IC-04: saturating_add so an extreme due_ledger cannot overflow u64
        // and panic here — mark_default must stay callable for every invoice.
        if (env.ledger().sequence() as u64) < inv.due_ledger.saturating_add(GRACE_PERIOD_LEDGERS) {
            panic_with_error!(&env, MarketError::NotDueYet);
        }
        // CEI: write state + bump TTL BEFORE cross-contract call and event
        inv.status = Status::Defaulted;
        write_invoice(&env, &inv);
        env.storage().instance().extend_ttl(INVOICE_LIFETIME_THRESHOLD, INVOICE_BUMP_AMOUNT);
        let rep_addr: Address = env.storage().instance().get(&DataKey::Reputation).unwrap();
        let rep = ReputationClient::new(&env, &rep_addr);
        rep.record_defaulted(&inv.seller);
        env.events().publish((symbol_short!("defaulted"), inv.seller.clone()), id);
    }

    pub fn list_open(env: Env) -> Vec<Invoice> {
        bump_instance(&env); // IC-07
        Self::filter(&env, |i| i.status == Status::Listed)
    }

    pub fn list_by_owner(env: Env, owner: Address) -> Vec<Invoice> {
        bump_instance(&env); // IC-07
        Self::filter(&env, |i| i.owner == owner)
    }

    pub fn list_by_seller(env: Env, seller: Address) -> Vec<Invoice> {
        bump_instance(&env); // IC-07
        Self::filter(&env, |i| i.seller == seller)
    }

    #[doc(hidden)]
    pub fn _sale_price(_env: Env, face_value: i128, discount_bps: u32) -> i128 {
        sale_price(face_value, discount_bps)
    }
}

// Private helper — separate impl block (no #[contractimpl]) so it is NOT exported to the client.
impl Marketplace {
    fn filter(env: &Env, pred: impl Fn(&Invoice) -> bool) -> Vec<Invoice> {
        let next: u64 = env.storage().instance().get(&DataKey::NextId).unwrap_or(0);
        // IC-03: only scan the most recent MAX_LIST_SCAN ids so an unbounded
        // NextId cannot push this past the per-tx read limit and brick listing.
        // Older invoices are still readable individually via get_invoice and
        // should be indexed off-chain from events for full history.
        let mut i = next.saturating_sub(MAX_LIST_SCAN);
        let mut out = Vec::new(env);
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
