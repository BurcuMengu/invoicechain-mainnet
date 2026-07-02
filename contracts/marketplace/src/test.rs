#![cfg(test)]
use crate::{types::{MarketError, Status}, Marketplace, MarketplaceClient};
use soroban_sdk::{testutils::{Address as _, Ledger as _, MockAuth, MockAuthInvoke}, Address, Env, Error, IntoVal, String};

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
fn buy_invoice_rejects_past_due() {
    let s = setup(); // sequence = 100
    let market = MarketplaceClient::new(&s.env, &s.market_id);
    let token = test_token::TestTokenClient::new(&s.env, &s.token_id);
    let seller = Address::generate(&s.env);
    let investor = Address::generate(&s.env);

    // Create invoice with due_ledger = 500 (valid at sequence 100)
    let id = market.create_invoice(
        &seller, &String::from_str(&s.env, "ACME"),
        &1_000_000_000i128, &500u64, &1000u32,
    );

    // Advance ledger past due date
    s.env.ledger().set_sequence_number(600);

    token.faucet(&investor);
    token.approve(&investor, &market.address, &1_000_000_000i128, &10000);

    let res = market.try_buy_invoice(&id, &investor);
    assert_eq!(res, Err(Ok(Error::from_contract_error(MarketError::DueInPast as u32))));
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

#[test]
fn settle_pays_owner_face_value_and_bumps_reputation() {
    let s = setup();
    let market = MarketplaceClient::new(&s.env, &s.market_id);
    let token = test_token::TestTokenClient::new(&s.env, &s.token_id);
    let seller = Address::generate(&s.env);
    let investor = Address::generate(&s.env);
    let debtor = Address::generate(&s.env);

    let id = market.create_invoice(
        &seller, &String::from_str(&s.env, "ACME"),
        &1_000_000_000i128, &500u64, &1000u32,
    );
    token.faucet(&investor);
    token.approve(&investor, &market.address, &1_000_000_000i128, &10000);
    market.buy_invoice(&id, &investor);

    token.faucet(&debtor);
    token.approve(&debtor, &market.address, &1_000_000_000i128, &10000);
    market.settle(&id, &debtor);

    let inv = market.get_invoice(&id);
    assert_eq!(inv.status, Status::Settled);
    // investor received full face value (100 USDC) on top of prior balance (1000 - 90 = 910 USDC)
    assert_eq!(token.balance(&investor), 9_100_000_000i128 + 1_000_000_000i128);
}

#[test]
fn settle_rejects_non_funded() {
    let s = setup();
    let market = MarketplaceClient::new(&s.env, &s.market_id);
    let seller = Address::generate(&s.env);
    let debtor = Address::generate(&s.env);

    let id = market.create_invoice(
        &seller, &String::from_str(&s.env, "ACME"),
        &1_000_000_000i128, &500u64, &1000u32,
    );
    // Invoice is Listed (not Funded) — settle must reject
    let res = market.try_settle(&id, &debtor);
    assert_eq!(res, Err(Ok(Error::from_contract_error(MarketError::NotFunded as u32))));
}

#[test]
fn settle_records_reputation() {
    let s = setup();
    let market = MarketplaceClient::new(&s.env, &s.market_id);
    let token = test_token::TestTokenClient::new(&s.env, &s.token_id);
    let seller = Address::generate(&s.env);
    let investor = Address::generate(&s.env);
    let debtor = Address::generate(&s.env);

    let id = market.create_invoice(
        &seller, &String::from_str(&s.env, "ACME"),
        &1_000_000_000i128, &500u64, &1000u32,
    );
    token.faucet(&investor);
    token.approve(&investor, &market.address, &1_000_000_000i128, &10000);
    market.buy_invoice(&id, &investor);

    token.faucet(&debtor);
    token.approve(&debtor, &market.address, &1_000_000_000i128, &10000);
    market.settle(&id, &debtor);

    // Verify cross-contract call actually updated reputation
    let rep = reputation::ReputationClient::new(&s.env, &s.rep_id);
    let score = rep.get_score(&seller);
    assert_eq!(score.settled_count, 1);
    assert_eq!(score.volume, 1_000_000_000i128);
}

// ── Task 6: mark_default, cancel_invoice, list views ──────────────────────────

#[test]
fn mark_default_after_due_sets_defaulted_and_penalizes() {
    let s = setup();
    let market = MarketplaceClient::new(&s.env, &s.market_id);
    let token = test_token::TestTokenClient::new(&s.env, &s.token_id);
    let seller = Address::generate(&s.env);
    let investor = Address::generate(&s.env);
    let id = market.create_invoice(
        &seller, &String::from_str(&s.env, "ACME"),
        &1_000_000_000i128, &500u64, &1000u32,
    );
    token.faucet(&investor);
    token.approve(&investor, &market.address, &1_000_000_000i128, &10000);
    market.buy_invoice(&id, &investor);

    s.env.ledger().set_sequence_number(600); // past due 500
    market.mark_default(&id);
    assert_eq!(market.get_invoice(&id).status, Status::Defaulted);
}

#[test]
fn mark_default_rejects_before_due() {
    let s = setup();  // sequence = 100
    let market = MarketplaceClient::new(&s.env, &s.market_id);
    let token = test_token::TestTokenClient::new(&s.env, &s.token_id);
    let seller = Address::generate(&s.env);
    let investor = Address::generate(&s.env);
    let id = market.create_invoice(&seller, &String::from_str(&s.env, "ACME"), &1_000_000_000i128, &500u64, &1000u32);
    token.faucet(&investor);
    token.approve(&investor, &market.address, &1_000_000_000i128, &10000);
    market.buy_invoice(&id, &investor);
    // still at sequence 100, due is 500 → NotDueYet
    let res = market.try_mark_default(&id);
    assert_eq!(res, Err(Ok(Error::from_contract_error(MarketError::NotDueYet as u32))));
}

#[test]
fn cancel_listed_invoice() {
    let s = setup();
    let market = MarketplaceClient::new(&s.env, &s.market_id);
    let seller = Address::generate(&s.env);
    let id = market.create_invoice(
        &seller, &String::from_str(&s.env, "ACME"),
        &1_000_000_000i128, &500u64, &1000u32,
    );
    market.cancel_invoice(&id);
    assert_eq!(market.get_invoice(&id).status, Status::Cancelled);
}

#[test]
fn list_open_returns_only_listed() {
    let s = setup();
    let market = MarketplaceClient::new(&s.env, &s.market_id);
    let seller = Address::generate(&s.env);
    market.create_invoice(&seller, &String::from_str(&s.env, "A"), &1_000_000_000i128, &500u64, &1000u32);
    let id2 = market.create_invoice(&seller, &String::from_str(&s.env, "B"), &2_000_000_000i128, &500u64, &1000u32);
    market.cancel_invoice(&id2);
    assert_eq!(market.list_open().len(), 1);
}

// ── Extra tests (pre-empting review) ──────────────────────────────────────────

#[test]
fn mark_default_rejects_non_funded() {
    let s = setup();
    let market = MarketplaceClient::new(&s.env, &s.market_id);
    let seller = Address::generate(&s.env);
    let id = market.create_invoice(
        &seller, &String::from_str(&s.env, "ACME"),
        &1_000_000_000i128, &500u64, &1000u32,
    );
    // Invoice is Listed (never bought) — mark_default must reject with NotFunded
    s.env.ledger().set_sequence_number(600);
    let res = market.try_mark_default(&id);
    assert_eq!(res, Err(Ok(Error::from_contract_error(MarketError::NotFunded as u32))));
}

#[test]
fn mark_default_records_reputation() {
    let s = setup();
    let market = MarketplaceClient::new(&s.env, &s.market_id);
    let token = test_token::TestTokenClient::new(&s.env, &s.token_id);
    let seller = Address::generate(&s.env);
    let investor = Address::generate(&s.env);

    let id = market.create_invoice(
        &seller, &String::from_str(&s.env, "ACME"),
        &1_000_000_000i128, &500u64, &1000u32,
    );
    token.faucet(&investor);
    token.approve(&investor, &market.address, &1_000_000_000i128, &10000);
    market.buy_invoice(&id, &investor);

    s.env.ledger().set_sequence_number(600);
    market.mark_default(&id);

    let rep = reputation::ReputationClient::new(&s.env, &s.rep_id);
    let score = rep.get_score(&seller);
    assert_eq!(score.defaulted_count, 1);
}

#[test]
fn cancel_rejects_funded() {
    let s = setup();
    let market = MarketplaceClient::new(&s.env, &s.market_id);
    let token = test_token::TestTokenClient::new(&s.env, &s.token_id);
    let seller = Address::generate(&s.env);
    let investor = Address::generate(&s.env);

    let id = market.create_invoice(
        &seller, &String::from_str(&s.env, "ACME"),
        &1_000_000_000i128, &500u64, &1000u32,
    );
    token.faucet(&investor);
    token.approve(&investor, &market.address, &1_000_000_000i128, &10000);
    market.buy_invoice(&id, &investor);

    // Invoice is now Funded — cancel_invoice must reject with NotListed
    let res = market.try_cancel_invoice(&id);
    assert_eq!(res, Err(Ok(Error::from_contract_error(MarketError::NotListed as u32))));
}

#[test]
#[should_panic] // require_auth failure traps; should_panic is acceptable HERE because the panic is an auth failure, not a contract error code
fn cancel_rejects_non_seller() {
    // Build a dedicated env WITHOUT mock_all_auths so auth gates are real
    let env = Env::default();
    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register(
        test_token::TestToken,
        (token_admin, 7u32, String::from_str(&env, "USD Coin"), String::from_str(&env, "USDC")),
    );
    let market_id = env.register(
        Marketplace,
        (admin.clone(), token_id.clone(), token_id.clone()),
    );
    let rep_id = env.register(reputation::Reputation, (market_id.clone(),));
    let market = MarketplaceClient::new(&env, &market_id);

    // Authorize admin for set_reputation
    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &market_id,
            fn_name: "set_reputation",
            args: (rep_id.clone(),).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    market.set_reputation(&rep_id);
    env.ledger().set_sequence_number(100);

    let seller = Address::generate(&env);
    // Authorize seller for create_invoice
    env.mock_auths(&[MockAuth {
        address: &seller,
        invoke: &MockAuthInvoke {
            contract: &market_id,
            fn_name: "create_invoice",
            args: (seller.clone(), String::from_str(&env, "ACME"), 1_000_000_000i128, 500u64, 1000u32).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    let id = market.create_invoice(&seller, &String::from_str(&env, "ACME"), &1_000_000_000i128, &500u64, &1000u32);

    let intruder = Address::generate(&env);
    // Switch to explicit auth: authorize ONLY the intruder, NOT the seller
    env.mock_auths(&[MockAuth {
        address: &intruder,
        invoke: &MockAuthInvoke {
            contract: &market_id,
            fn_name: "cancel_invoice",
            args: (id,).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    market.cancel_invoice(&id); // inv.seller.require_auth() has no matching auth → panic
}

#[test]
fn list_by_seller_and_owner() {
    let s = setup();
    let market = MarketplaceClient::new(&s.env, &s.market_id);
    let token = test_token::TestTokenClient::new(&s.env, &s.token_id);
    let seller1 = Address::generate(&s.env);
    let seller2 = Address::generate(&s.env);
    let investor = Address::generate(&s.env);

    // seller1 creates two invoices, seller2 creates one
    market.create_invoice(&seller1, &String::from_str(&s.env, "A"), &1_000_000_000i128, &500u64, &1000u32);
    let id2 = market.create_invoice(&seller1, &String::from_str(&s.env, "B"), &2_000_000_000i128, &500u64, &1000u32);
    market.create_invoice(&seller2, &String::from_str(&s.env, "C"), &1_000_000_000i128, &500u64, &1000u32);

    assert_eq!(market.list_by_seller(&seller1).len(), 2);
    assert_eq!(market.list_by_seller(&seller2).len(), 1);

    // Investor buys id2 from seller1
    token.faucet(&investor);
    token.approve(&investor, &market.address, &2_000_000_000i128, &10000);
    market.buy_invoice(&id2, &investor);

    // After purchase investor owns id2
    assert_eq!(market.list_by_owner(&investor).len(), 1);
}
