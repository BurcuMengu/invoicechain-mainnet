// @ts-nocheck — auto-generated file
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


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CAX2MPXBTI7QTHZ5G6IWXGLFMXDF2IMQIHSKYQRDNGAO3ZVMY6VBO3K3",
  }
} as const


export interface Score {
  defaulted_count: u32;
  settled_count: u32;
  volume: i128;
}

export type DataKey = {tag: "Marketplace", values: void} | {tag: "Score", values: readonly [string]};

export const RepError = {
  1: {message:"AlreadyInitialized"},
  2: {message:"Unauthorized"}
}

export interface Client {
  /**
   * Construct and simulate a get_score transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_score: ({party}: {party: string}, options?: MethodOptions) => Promise<AssembledTransaction<Score>>

  /**
   * Construct and simulate a record_settled transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  record_settled: ({party, amount}: {party: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a record_defaulted transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  record_defaulted: ({party}: {party: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {marketplace}: {marketplace: string},
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
    return ContractClient.deploy({marketplace}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAAAAAAAJZ2V0X3Njb3JlAAAAAAAAAQAAAAAAAAAFcGFydHkAAAAAAAATAAAAAQAAB9AAAAAFU2NvcmUAAAA=",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAAC21hcmtldHBsYWNlAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAOcmVjb3JkX3NldHRsZWQAAAAAAAIAAAAAAAAABXBhcnR5AAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
        "AAAAAAAAAAAAAAAQcmVjb3JkX2RlZmF1bHRlZAAAAAEAAAAAAAAABXBhcnR5AAAAAAAAEwAAAAA=",
        "AAAAAQAAAAAAAAAAAAAABVNjb3JlAAAAAAAAAwAAAAAAAAAPZGVmYXVsdGVkX2NvdW50AAAAAAQAAAAAAAAADXNldHRsZWRfY291bnQAAAAAAAAEAAAAAAAAAAZ2b2x1bWUAAAAAAAs=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAgAAAAAAAAAAAAAAC01hcmtldHBsYWNlAAAAAAEAAAAAAAAABVNjb3JlAAAAAAAAAQAAABM=",
        "AAAABAAAAAAAAAAAAAAACFJlcEVycm9yAAAAAgAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAAxVbmF1dGhvcml6ZWQAAAAC" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_score: this.txFromJSON<Score>,
        record_settled: this.txFromJSON<null>,
        record_defaulted: this.txFromJSON<null>
  }
}