#![no_std]
#![allow(deprecated)]
mod types;
#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, panic_with_error, symbol_short, Address, Env, String};
use types::{sale_price, DataKey, Invoice, MarketError, Status};

const DAY_IN_LEDGERS: u32 = 17_280;
const INVOICE_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const INVOICE_LIFETIME_THRESHOLD: u32 = INVOICE_BUMP_AMOUNT - DAY_IN_LEDGERS;

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
        env.storage().instance().extend_ttl(INVOICE_LIFETIME_THRESHOLD, INVOICE_BUMP_AMOUNT);
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
        env.storage().instance().extend_ttl(INVOICE_LIFETIME_THRESHOLD, INVOICE_BUMP_AMOUNT);
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
