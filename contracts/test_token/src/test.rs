#![cfg(test)]
use crate::{TestToken, TestTokenClient};
use soroban_sdk::{testutils::{Address as _, Ledger as _}, Address, Env, String};

fn setup(env: &Env) -> (Address, TestTokenClient<'_>) {
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
    // Set min TTL high enough so the temporary allowance entry survives when we
    // later advance the ledger sequence to 500 (default min_temp_entry_ttl is 16).
    env.ledger().set_min_temp_entry_ttl(2000);
    // Approve with expiration_ledger = 1000 (well above the default starting sequence)
    token.approve(&owner, &spender, &5_000_000_000i128, &1000);
    token.transfer_from(&spender, &owner, &dest, &4_000_000_000i128);
    assert_eq!(token.balance(&dest), 4_000_000_000i128);
    assert_eq!(token.balance(&owner), 6_000_000_000i128);
    // Residual allowance must equal 1_000_000_000, not 0 or expired
    assert_eq!(token.allowance(&owner, &spender), 1_000_000_000i128);
    // Advance ledger to sequence 500, still BEFORE the original expiration of 1000.
    // With the old buggy code the residual would have expired at sequence+1, so this
    // second transfer_from would fail — proving the expiration was preserved.
    env.ledger().set_sequence_number(500);
    token.transfer_from(&spender, &owner, &dest, &1_000_000_000i128);
    assert_eq!(token.balance(&dest), 5_000_000_000i128);
    assert_eq!(token.balance(&owner), 5_000_000_000i128);
}

#[test]
fn transfer_moves_funds() {
    let env = Env::default();
    env.mock_all_auths();
    let (_admin, token) = setup(&env);
    let owner = Address::generate(&env);
    let dest = Address::generate(&env);
    token.faucet(&owner);
    token.transfer(&owner, &dest, &3_000_000_000i128);
    assert_eq!(token.balance(&owner), 7_000_000_000i128);
    assert_eq!(token.balance(&dest), 3_000_000_000i128);
}
