#![cfg(test)]
use crate::{TestToken, TestTokenClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

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
    token.approve(&owner, &spender, &5_000_000_000i128, &1000);
    token.transfer_from(&spender, &owner, &dest, &4_000_000_000i128);
    assert_eq!(token.balance(&dest), 4_000_000_000i128);
    assert_eq!(token.balance(&owner), 6_000_000_000i128);
}
