#![no_std]
#![allow(deprecated)]
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

const DAY_IN_LEDGERS: u32 = 17_280;
const BALANCE_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const BALANCE_LIFETIME_THRESHOLD: u32 = BALANCE_BUMP_AMOUNT - DAY_IN_LEDGERS;

#[contract]
pub struct TestToken;

fn read_balance(env: &Env, addr: &Address) -> i128 {
    env.storage().persistent().get(&DataKey::Balance(addr.clone())).unwrap_or(0)
}
fn write_balance(env: &Env, addr: &Address, amount: i128) {
    env.storage().persistent().set(&DataKey::Balance(addr.clone()), &amount);
    env.storage().persistent().extend_ttl(
        &DataKey::Balance(addr.clone()),
        BALANCE_LIFETIME_THRESHOLD,
        BALANCE_BUMP_AMOUNT,
    );
}
fn read_allowance_value(env: &Env, from: &Address, spender: &Address) -> Option<AllowanceValue> {
    let key = DataKey::Allowance(AllowanceKey { from: from.clone(), spender: spender.clone() });
    match env.storage().temporary().get::<_, AllowanceValue>(&key) {
        Some(v) if v.expiration_ledger >= env.ledger().sequence() => Some(v),
        _ => None,
    }
}
fn read_allowance(env: &Env, from: &Address, spender: &Address) -> i128 {
    read_allowance_value(env, from, spender).map(|v| v.amount).unwrap_or(0)
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
        env.storage().instance().extend_ttl(BALANCE_LIFETIME_THRESHOLD, BALANCE_BUMP_AMOUNT);
    }

    pub fn faucet(env: Env, to: Address) {
        let bal = read_balance(&env, &to);
        write_balance(&env, &to, bal + FAUCET_AMOUNT);
        env.storage().instance().extend_ttl(BALANCE_LIFETIME_THRESHOLD, BALANCE_BUMP_AMOUNT);
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
        let allow_val = read_allowance_value(&env, &from, &spender);
        assert!(allow_val.is_some(), "no valid allowance");
        let allow_val = allow_val.unwrap();
        assert!(allow_val.amount >= amount, "insufficient allowance");
        let fb = read_balance(&env, &from);
        assert!(fb >= amount, "insufficient balance");
        write_allowance(&env, &from, &spender, allow_val.amount - amount, allow_val.expiration_ledger);
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
