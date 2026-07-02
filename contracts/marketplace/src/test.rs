#![cfg(test)]
use crate::{types::{MarketError, Status}, Marketplace, MarketplaceClient};
use soroban_sdk::{testutils::{Address as _, Ledger as _}, Address, Env, Error, String};

/// Setup stores owned values only — no borrowing client.
/// MarketplaceClient<'a> borrows Env so it cannot be stored alongside it
/// in the same struct (self-referential). Clients are constructed on demand
/// inside each test via `MarketplaceClient::new(&s.env, &s.market_id)`.
#[allow(dead_code)]
pub struct Setup {
    pub env: Env,
    pub market_id: Address,
    pub token_id: Address,
    pub rep_id: Address,
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

    // Constructor cycle resolution:
    // 1. Register marketplace with token_id as a placeholder reputation address.
    // 2. Register reputation pointing at the real market_id.
    // 3. Call market.set_reputation(&rep_id) to fix the pointer.
    let market_id = env.register(
        Marketplace,
        (admin.clone(), token_id.clone(), token_id.clone()), // placeholder rep = token_id
    );
    let rep_id = env.register(reputation::Reputation, (market_id.clone(),));
    let market = MarketplaceClient::new(&env, &market_id);
    market.set_reputation(&rep_id);

    Setup { env, market_id, token_id, rep_id }
}

#[test]
fn create_invoice_stores_listed() {
    let s = setup();
    let market = MarketplaceClient::new(&s.env, &s.market_id);
    let seller = Address::generate(&s.env);
    let id = market.create_invoice(
        &seller,
        &String::from_str(&s.env, "ACME Corp"),
        &1_000_000_000i128, // 100 USDC face
        &500u64,            // due ledger
        &1000u32,           // 10% discount
    );
    let inv = market.get_invoice(&id);
    assert_eq!(inv.id, 0u64);
    assert_eq!(inv.status, Status::Listed);
    assert_eq!(inv.seller, seller);
    assert_eq!(inv.debtor_name, String::from_str(&s.env, "ACME Corp"));
    assert_eq!(inv.face_value, 1_000_000_000i128);
    assert_eq!(inv.due_ledger, 500u64);
    assert_eq!(inv.discount_bps, 1000u32);
    assert_eq!(inv.owner, seller);
}

#[test]
fn create_invoice_rejects_zero_face_value() {
    let s = setup();
    let market = MarketplaceClient::new(&s.env, &s.market_id);
    let seller = Address::generate(&s.env);
    let res = market.try_create_invoice(
        &seller,
        &String::from_str(&s.env, "ACME"),
        &0i128,
        &500u64,
        &1000u32,
    );
    assert_eq!(res, Err(Ok(Error::from_contract_error(MarketError::ZeroAmount as u32))));
}

#[test]
fn create_invoice_rejects_invalid_discount() {
    let s = setup();
    let market = MarketplaceClient::new(&s.env, &s.market_id);
    let seller = Address::generate(&s.env);

    // discount_bps = 0 → InvalidDiscount
    let res = market.try_create_invoice(
        &seller,
        &String::from_str(&s.env, "ACME"),
        &1_000_000i128,
        &500u64,
        &0u32,
    );
    assert_eq!(res, Err(Ok(Error::from_contract_error(MarketError::InvalidDiscount as u32))));

    // discount_bps = 9001 → InvalidDiscount
    let res = market.try_create_invoice(
        &seller,
        &String::from_str(&s.env, "ACME"),
        &1_000_000i128,
        &500u64,
        &9001u32,
    );
    assert_eq!(res, Err(Ok(Error::from_contract_error(MarketError::InvalidDiscount as u32))));
}

#[test]
fn create_invoice_accepts_boundary_discounts() {
    let s = setup();
    let market = MarketplaceClient::new(&s.env, &s.market_id);
    let seller = Address::generate(&s.env);

    // discount_bps = 1 (minimum) → ok
    let res = market.try_create_invoice(
        &seller,
        &String::from_str(&s.env, "ACME"),
        &1_000_000i128,
        &500u64,
        &1u32,
    );
    assert!(res.is_ok());

    // discount_bps = 9000 (maximum) → ok
    let res = market.try_create_invoice(
        &seller,
        &String::from_str(&s.env, "ACME"),
        &1_000_000i128,
        &500u64,
        &9000u32,
    );
    assert!(res.is_ok());
}

#[test]
fn create_invoice_rejects_due_in_past() {
    let s = setup();
    // Sequence number is 100; due_ledger <= 100 must be rejected.
    let market = MarketplaceClient::new(&s.env, &s.market_id);
    let seller = Address::generate(&s.env);

    // due_ledger == current sequence (100) → DueInPast
    let res = market.try_create_invoice(
        &seller,
        &String::from_str(&s.env, "ACME"),
        &1_000_000i128,
        &100u64,
        &1000u32,
    );
    assert_eq!(res, Err(Ok(Error::from_contract_error(MarketError::DueInPast as u32))));

    // due_ledger < current sequence (50) → DueInPast
    let res = market.try_create_invoice(
        &seller,
        &String::from_str(&s.env, "ACME"),
        &1_000_000i128,
        &50u64,
        &1000u32,
    );
    assert_eq!(res, Err(Ok(Error::from_contract_error(MarketError::DueInPast as u32))));
}

#[test]
fn buy_invoice_transfers_discounted_price_to_seller() {
    let s = setup();
    let market = MarketplaceClient::new(&s.env, &s.market_id);
    let token = test_token::TestTokenClient::new(&s.env, &s.token_id);
    let seller = Address::generate(&s.env);
    let investor = Address::generate(&s.env);

    let id = market.create_invoice(
        &seller, &String::from_str(&s.env, "ACME"),
        &1_000_000_000i128, &500u64, &1000u32, // 100 USDC, 10% discount → price 90 USDC
    );

    token.faucet(&investor); // 1000 USDC = 10_000_000_000
    token.approve(&investor, &market.address, &1_000_000_000i128, &10000);
    market.buy_invoice(&id, &investor);

    let inv = market.get_invoice(&id);
    assert_eq!(inv.status, Status::Funded);
    assert_eq!(inv.owner, investor);
    assert_eq!(token.balance(&seller), 900_000_000i128);    // 90 USDC
    assert_eq!(token.balance(&investor), 9_100_000_000i128); // 1000 - 90
}

#[test]
fn buy_invoice_rejects_non_listed() {
    let s = setup();
    let market = MarketplaceClient::new(&s.env, &s.market_id);
    let token = test_token::TestTokenClient::new(&s.env, &s.token_id);
    let seller = Address::generate(&s.env);
    let investor = Address::generate(&s.env);

    let id = market.create_invoice(
        &seller, &String::from_str(&s.env, "ACME"),
        &1_000_000_000i128, &500u64, &1000u32,
    );

    // First buy succeeds
    token.faucet(&investor);
    token.approve(&investor, &market.address, &2_000_000_000i128, &10000);
    market.buy_invoice(&id, &investor);

    // Second buy must fail with NotListed (invoice is now Funded)
    let res = market.try_buy_invoice(&id, &investor);
    assert_eq!(res, Err(Ok(Error::from_contract_error(MarketError::NotListed as u32))));
}

#[test]
fn buy_invoice_rejects_unknown_id() {
    let s = setup();
    let market = MarketplaceClient::new(&s.env, &s.market_id);
    let investor = Address::generate(&s.env);

    let res = market.try_buy_invoice(&999u64, &investor);
    assert_eq!(res, Err(Ok(Error::from_contract_error(MarketError::NotFound as u32))));
}
