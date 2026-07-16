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
    /// IC-02: on-chain address of the real debtor. settle() requires the payer
    /// to equal this address, so reputation reflects "paid by the debtor" and
    /// cannot be forged by a third party paying on the seller's behalf.
    pub debtor: Address,
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
    /// IC-08: circuit-breaker flag. When true, create_invoice/buy_invoice are
    /// blocked; settle/mark_default/cancel are always allowed so funds cannot
    /// be locked.
    Paused,
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
    NotDebtor = 10,     // IC-02: settle payer must be the invoice debtor
    DueTooFar = 11,     // IC-04: due_ledger beyond MAX_INVOICE_HORIZON
    NameTooLong = 12,   // IC-03: debtor_name exceeds MAX_DEBTOR_NAME_LEN
    FaceTooLarge = 13,  // IC-10: face_value exceeds MAX_FACE_VALUE
    Paused = 14,        // IC-08: contract is paused
}

pub fn sale_price(face_value: i128, discount_bps: u32) -> i128 {
    // IC-10: face_value is bounded by MAX_FACE_VALUE in create_invoice, so this
    // multiplication cannot overflow i128. checked_mul is defense-in-depth: it
    // traps instead of silently wrapping if that invariant is ever violated.
    face_value
        .checked_mul(10000 - discount_bps as i128)
        .unwrap()
        / 10000
}
