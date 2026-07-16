import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export type Status = {tag: "Listed", values: void} | {tag: "Funded", values: void} | {tag: "Settled", values: void} | {tag: "Defaulted", values: void} | {tag: "Cancelled", values: void};

export type DataKey = {tag: "Admin", values: void} | {tag: "Token", values: void} | {tag: "Reputation", values: void} | {tag: "NextId", values: void} | {tag: "Paused", values: void} | {tag: "Invoice", values: readonly [u64]};


export interface Invoice {
  /**
 * IC-02: on-chain address of the real debtor. settle() requires the payer
 * to equal this address, so reputation reflects "paid by the debtor" and
 * cannot be forged by a third party paying on the seller's behalf.
 */
debtor: string;
  debtor_name: string;
  discount_bps: u32;
  due_ledger: u64;
  face_value: i128;
  id: u64;
  owner: string;
  seller: string;
  status: Status;
}

export const MarketError = {
  1: {message:"AlreadyInitialized"},
  2: {message:"ZeroAmount"},
  3: {message:"InvalidDiscount"},
  4: {message:"DueInPast"},
  5: {message:"NotFound"},
  6: {message:"NotListed"},
  7: {message:"NotFunded"},
  8: {message:"NotSeller"},
  9: {message:"NotDueYet"},
  10: {message:"NotDebtor"},
  11: {message:"DueTooFar"},
  12: {message:"NameTooLong"},
  13: {message:"FaceTooLarge"},
  14: {message:"Paused"}
}

export interface Client {
  /**
   * Construct and simulate a token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  token: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a settle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  settle: ({id, payer}: {id: u64, payer: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * IC-08 (DD-1): admin-gated in-place upgrade. Lets a discovered bug in the
   * money-moving flows be patched without a full redeploy + state migration.
   * The admin SHOULD be a multisig/timelock account on mainnet (see DD-2).
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a is_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_paused: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a list_open transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  list_open: (options?: MethodOptions) => Promise<AssembledTransaction<Array<Invoice>>>

  /**
   * Construct and simulate a reputation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * IC-09: expose the wired reputation/token addresses so a deploy script can
   * assert the marketplace is correctly configured (reputation != token) and
   * the frontend can read them without a hardcoded config.
   */
  reputation: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a set_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * IC-08 (DD-3): admin-gated circuit breaker. Only blocks NEW activity
   * (create_invoice / buy_invoice); settle, mark_default and cancel remain
   * available while paused so no funded invoice can ever be locked.
   */
  set_paused: ({paused}: {paused: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a _sale_price transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  _sale_price: ({face_value, discount_bps}: {face_value: i128, discount_bps: u32}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a buy_invoice transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  buy_invoice: ({id, investor}: {id: u64, investor: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_invoice transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_invoice: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Invoice>>

  /**
   * Construct and simulate a mark_default transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  mark_default: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a list_by_owner transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  list_by_owner: ({owner}: {owner: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Invoice>>>

  /**
   * Construct and simulate a cancel_invoice transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  cancel_invoice: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a create_invoice transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_invoice: ({seller, debtor, debtor_name, face_value, due_ledger, discount_bps}: {seller: string, debtor: string, debtor_name: string, face_value: i128, due_ledger: u64, discount_bps: u32}, options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a list_by_seller transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  list_by_seller: ({seller}: {seller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Invoice>>>

  /**
   * Construct and simulate a set_reputation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_reputation: ({reputation}: {reputation: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, token, reputation}: {admin: string, token: string, reputation: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, token, reputation}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAAAAAAAFdG9rZW4AAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAGc2V0dGxlAAAAAAACAAAAAAAAAAJpZAAAAAAABgAAAAAAAAAFcGF5ZXIAAAAAAAATAAAAAA==",
        "AAAAAAAAANhJQy0wOCAoREQtMSk6IGFkbWluLWdhdGVkIGluLXBsYWNlIHVwZ3JhZGUuIExldHMgYSBkaXNjb3ZlcmVkIGJ1ZyBpbiB0aGUKbW9uZXktbW92aW5nIGZsb3dzIGJlIHBhdGNoZWQgd2l0aG91dCBhIGZ1bGwgcmVkZXBsb3kgKyBzdGF0ZSBtaWdyYXRpb24uClRoZSBhZG1pbiBTSE9VTEQgYmUgYSBtdWx0aXNpZy90aW1lbG9jayBhY2NvdW50IG9uIG1haW5uZXQgKHNlZSBERC0yKS4AAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAA",
        "AAAAAAAAAAAAAAAJaXNfcGF1c2VkAAAAAAAAAAAAAAEAAAAB",
        "AAAAAAAAAAAAAAAJbGlzdF9vcGVuAAAAAAAAAAAAAAEAAAPqAAAH0AAAAAdJbnZvaWNlAA==",
        "AAAAAAAAAMlJQy0wOTogZXhwb3NlIHRoZSB3aXJlZCByZXB1dGF0aW9uL3Rva2VuIGFkZHJlc3NlcyBzbyBhIGRlcGxveSBzY3JpcHQgY2FuCmFzc2VydCB0aGUgbWFya2V0cGxhY2UgaXMgY29ycmVjdGx5IGNvbmZpZ3VyZWQgKHJlcHV0YXRpb24gIT0gdG9rZW4pIGFuZAp0aGUgZnJvbnRlbmQgY2FuIHJlYWQgdGhlbSB3aXRob3V0IGEgaGFyZGNvZGVkIGNvbmZpZy4AAAAAAAAKcmVwdXRhdGlvbgAAAAAAAAAAAAEAAAAT",
        "AAAAAAAAAMpJQy0wOCAoREQtMyk6IGFkbWluLWdhdGVkIGNpcmN1aXQgYnJlYWtlci4gT25seSBibG9ja3MgTkVXIGFjdGl2aXR5CihjcmVhdGVfaW52b2ljZSAvIGJ1eV9pbnZvaWNlKTsgc2V0dGxlLCBtYXJrX2RlZmF1bHQgYW5kIGNhbmNlbCByZW1haW4KYXZhaWxhYmxlIHdoaWxlIHBhdXNlZCBzbyBubyBmdW5kZWQgaW52b2ljZSBjYW4gZXZlciBiZSBsb2NrZWQuAAAAAAAKc2V0X3BhdXNlZAAAAAAAAQAAAAAAAAAGcGF1c2VkAAAAAAABAAAAAA==",
        "AAAAAAAAAAAAAAALX3NhbGVfcHJpY2UAAAAAAgAAAAAAAAAKZmFjZV92YWx1ZQAAAAAACwAAAAAAAAAMZGlzY291bnRfYnBzAAAABAAAAAEAAAAL",
        "AAAAAAAAAAAAAAALYnV5X2ludm9pY2UAAAAAAgAAAAAAAAACaWQAAAAAAAYAAAAAAAAACGludmVzdG9yAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAALZ2V0X2ludm9pY2UAAAAAAQAAAAAAAAACaWQAAAAAAAYAAAABAAAH0AAAAAdJbnZvaWNlAA==",
        "AAAAAAAAAAAAAAAMbWFya19kZWZhdWx0AAAAAQAAAAAAAAACaWQAAAAAAAYAAAAA",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAApyZXB1dGF0aW9uAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAANbGlzdF9ieV9vd25lcgAAAAAAAAEAAAAAAAAABW93bmVyAAAAAAAAEwAAAAEAAAPqAAAH0AAAAAdJbnZvaWNlAA==",
        "AAAAAAAAAAAAAAAOY2FuY2VsX2ludm9pY2UAAAAAAAEAAAAAAAAAAmlkAAAAAAAGAAAAAA==",
        "AAAAAAAAAAAAAAAOY3JlYXRlX2ludm9pY2UAAAAAAAYAAAAAAAAABnNlbGxlcgAAAAAAEwAAAAAAAAAGZGVidG9yAAAAAAATAAAAAAAAAAtkZWJ0b3JfbmFtZQAAAAAQAAAAAAAAAApmYWNlX3ZhbHVlAAAAAAALAAAAAAAAAApkdWVfbGVkZ2VyAAAAAAAGAAAAAAAAAAxkaXNjb3VudF9icHMAAAAEAAAAAQAAAAY=",
        "AAAAAAAAAAAAAAAObGlzdF9ieV9zZWxsZXIAAAAAAAEAAAAAAAAABnNlbGxlcgAAAAAAEwAAAAEAAAPqAAAH0AAAAAdJbnZvaWNlAA==",
        "AAAAAAAAAAAAAAAOc2V0X3JlcHV0YXRpb24AAAAAAAEAAAAAAAAACnJlcHV0YXRpb24AAAAAABMAAAAA",
        "AAAAAgAAAAAAAAAAAAAABlN0YXR1cwAAAAAABQAAAAAAAAAAAAAABkxpc3RlZAAAAAAAAAAAAAAAAAAGRnVuZGVkAAAAAAAAAAAAAAAAAAdTZXR0bGVkAAAAAAAAAAAAAAAACURlZmF1bHRlZAAAAAAAAAAAAAAAAAAACUNhbmNlbGxlZAAAAA==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABgAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAFVG9rZW4AAAAAAAAAAAAAAAAAAApSZXB1dGF0aW9uAAAAAAAAAAAAAAAAAAZOZXh0SWQAAAAAAAAAAACYSUMtMDg6IGNpcmN1aXQtYnJlYWtlciBmbGFnLiBXaGVuIHRydWUsIGNyZWF0ZV9pbnZvaWNlL2J1eV9pbnZvaWNlIGFyZQpibG9ja2VkOyBzZXR0bGUvbWFya19kZWZhdWx0L2NhbmNlbCBhcmUgYWx3YXlzIGFsbG93ZWQgc28gZnVuZHMgY2Fubm90CmJlIGxvY2tlZC4AAAAGUGF1c2VkAAAAAAABAAAAAAAAAAdJbnZvaWNlAAAAAAEAAAAG",
        "AAAAAQAAAAAAAAAAAAAAB0ludm9pY2UAAAAACQAAAM9JQy0wMjogb24tY2hhaW4gYWRkcmVzcyBvZiB0aGUgcmVhbCBkZWJ0b3IuIHNldHRsZSgpIHJlcXVpcmVzIHRoZSBwYXllcgp0byBlcXVhbCB0aGlzIGFkZHJlc3MsIHNvIHJlcHV0YXRpb24gcmVmbGVjdHMgInBhaWQgYnkgdGhlIGRlYnRvciIgYW5kCmNhbm5vdCBiZSBmb3JnZWQgYnkgYSB0aGlyZCBwYXJ0eSBwYXlpbmcgb24gdGhlIHNlbGxlcidzIGJlaGFsZi4AAAAABmRlYnRvcgAAAAAAEwAAAAAAAAALZGVidG9yX25hbWUAAAAAEAAAAAAAAAAMZGlzY291bnRfYnBzAAAABAAAAAAAAAAKZHVlX2xlZGdlcgAAAAAABgAAAAAAAAAKZmFjZV92YWx1ZQAAAAAACwAAAAAAAAACaWQAAAAAAAYAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAGc2VsbGVyAAAAAAATAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAGU3RhdHVzAAA=",
        "AAAABAAAAAAAAAAAAAAAC01hcmtldEVycm9yAAAAAA4AAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAQAAAAAAAAAKWmVyb0Ftb3VudAAAAAAAAgAAAAAAAAAPSW52YWxpZERpc2NvdW50AAAAAAMAAAAAAAAACUR1ZUluUGFzdAAAAAAAAAQAAAAAAAAACE5vdEZvdW5kAAAABQAAAAAAAAAJTm90TGlzdGVkAAAAAAAABgAAAAAAAAAJTm90RnVuZGVkAAAAAAAABwAAAAAAAAAJTm90U2VsbGVyAAAAAAAACAAAAAAAAAAJTm90RHVlWWV0AAAAAAAACQAAAAAAAAAJTm90RGVidG9yAAAAAAAACgAAAAAAAAAJRHVlVG9vRmFyAAAAAAAACwAAAAAAAAALTmFtZVRvb0xvbmcAAAAADAAAAAAAAAAMRmFjZVRvb0xhcmdlAAAADQAAAAAAAAAGUGF1c2VkAAAAAAAO" ]),
      options
    )
  }
  public readonly fromJSON = {
    token: this.txFromJSON<string>,
        settle: this.txFromJSON<null>,
        upgrade: this.txFromJSON<null>,
        is_paused: this.txFromJSON<boolean>,
        list_open: this.txFromJSON<Array<Invoice>>,
        reputation: this.txFromJSON<string>,
        set_paused: this.txFromJSON<null>,
        _sale_price: this.txFromJSON<i128>,
        buy_invoice: this.txFromJSON<null>,
        get_invoice: this.txFromJSON<Invoice>,
        mark_default: this.txFromJSON<null>,
        list_by_owner: this.txFromJSON<Array<Invoice>>,
        cancel_invoice: this.txFromJSON<null>,
        create_invoice: this.txFromJSON<u64>,
        list_by_seller: this.txFromJSON<Array<Invoice>>,
        set_reputation: this.txFromJSON<null>
  }
}