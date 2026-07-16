#![no_std]
#![allow(deprecated)]
mod types;
mod test;

use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env};
use types::{DataKey, RepError, Score};

const DAY_IN_LEDGERS: u32 = 17_280;
const SCORE_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const SCORE_LIFETIME_THRESHOLD: u32 = SCORE_BUMP_AMOUNT - DAY_IN_LEDGERS;

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
        // IC-10: saturating_add so reputation accounting can never panic on an
        // i128/u32 overflow and DoS further settlements for a party.
        s.settled_count = s.settled_count.saturating_add(1);
        s.volume = s.volume.saturating_add(amount);
        env.storage().persistent().set(&DataKey::Score(party.clone()), &s);
        env.storage().persistent().extend_ttl(
            &DataKey::Score(party.clone()),
            SCORE_LIFETIME_THRESHOLD,
            SCORE_BUMP_AMOUNT,
        );
        env.storage().instance().extend_ttl(SCORE_LIFETIME_THRESHOLD, SCORE_BUMP_AMOUNT);
        env.events().publish((symbol_short!("rep_up"), party), s.settled_count);
    }

    pub fn record_defaulted(env: Env, party: Address) {
        require_marketplace(&env);
        let mut s = read_score(&env, &party);
        s.defaulted_count = s.defaulted_count.saturating_add(1); // IC-10
        env.storage().persistent().set(&DataKey::Score(party.clone()), &s);
        env.storage().persistent().extend_ttl(
            &DataKey::Score(party.clone()),
            SCORE_LIFETIME_THRESHOLD,
            SCORE_BUMP_AMOUNT,
        );
        env.storage().instance().extend_ttl(SCORE_LIFETIME_THRESHOLD, SCORE_BUMP_AMOUNT);
        env.events().publish((symbol_short!("rep_down"), party), s.defaulted_count);
    }

    pub fn get_score(env: Env, party: Address) -> Score {
        // IC-07: bump the Score TTL on reads so an actively-queried reputation
        // is not archived to a zero default after ~30 days of no writes (which
        // would silently erase a party's settled history on the next write).
        if env.storage().persistent().has(&DataKey::Score(party.clone())) {
            env.storage().persistent().extend_ttl(
                &DataKey::Score(party.clone()),
                SCORE_LIFETIME_THRESHOLD,
                SCORE_BUMP_AMOUNT,
            );
        }
        read_score(&env, &party)
    }
}

fn panic_with_error(env: &Env, e: RepError) -> ! {
    soroban_sdk::panic_with_error!(env, e)
}
