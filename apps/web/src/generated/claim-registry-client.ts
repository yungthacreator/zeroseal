/* eslint-disable */
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
    contractId: "CBKQ3ZTUIOQLPQLZ5RUK237P6AGAJ4LGOQJNB2GVJHRFVNKENFIU622R",
  }
} as const

export const Errors = {
  1: {message:"AlreadyInitialized"},
  2: {message:"InvalidPublicInputLength"},
  3: {message:"ZeroIdentifier"},
  4: {message:"ProgramAlreadyExists"},
  5: {message:"ProgramNotFound"},
  6: {message:"ResearcherAlreadyRegistered"},
  7: {message:"ResearcherNotRegistered"},
  8: {message:"SnapshotMismatch"},
  9: {message:"ImpactRuleMismatch"},
  10: {message:"MinimumLossMismatch"},
  11: {message:"StateCommitmentMismatch"},
  12: {message:"ResearcherCommitmentMismatch"},
  13: {message:"ZeroNullifier"},
  14: {message:"NullifierAlreadyUsed"},
  15: {message:"VerifierRejected"},
  16: {message:"ClaimNotFound"}
}


export interface ClaimReceipt {
  accepted_ledger: u32;
  impact_rule_id: Buffer;
  minimum_loss: Buffer;
  nullifier: Buffer;
  program_id: Buffer;
  researcher: string;
  researcher_commitment: Buffer;
  snapshot_id: Buffer;
  state_commitment: Buffer;
}


export interface DecodedClaim {
  impact_rule_id: Buffer;
  minimum_loss: Buffer;
  nullifier: Buffer;
  program_id: Buffer;
  researcher_commitment: Buffer;
  snapshot_id: Buffer;
  state_commitment: Buffer;
}


export interface ProgramConfig {
  impact_rule_id: Buffer;
  minimum_loss: Buffer;
  owner: string;
  program_id: Buffer;
  snapshot_id: Buffer;
  state_commitment: Buffer;
}


export interface Client {
  /**
   * Construct and simulate a verifier transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  verifier: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a get_claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_claim: ({nullifier}: {nullifier: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<ClaimReceipt>>>

  /**
   * Construct and simulate a get_program transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_program: ({program_id}: {program_id: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<ProgramConfig>>>

  /**
   * Construct and simulate a submit_claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  submit_claim: ({researcher, public_inputs, proof_bytes}: {researcher: string, public_inputs: Buffer, proof_bytes: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<ClaimReceipt>>>

  /**
   * Construct and simulate a register_program transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  register_program: ({owner, program_id, snapshot_id, impact_rule_id, minimum_loss, state_commitment}: {owner: string, program_id: Buffer, snapshot_id: Buffer, impact_rule_id: Buffer, minimum_loss: Buffer, state_commitment: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a is_nullifier_used transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_nullifier_used: ({nullifier}: {nullifier: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a register_researcher transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  register_researcher: ({researcher, researcher_commitment}: {researcher: string, researcher_commitment: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a decode_public_inputs transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  decode_public_inputs: ({public_inputs}: {public_inputs: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<DecodedClaim>>>

  /**
   * Construct and simulate a get_researcher_commitment transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_researcher_commitment: ({researcher}: {researcher: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Buffer>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {verifier}: {verifier: string},
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
    return ContractClient.deploy({verifier}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAEAAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAABhJbnZhbGlkUHVibGljSW5wdXRMZW5ndGgAAAACAAAAAAAAAA5aZXJvSWRlbnRpZmllcgAAAAAAAwAAAAAAAAAUUHJvZ3JhbUFscmVhZHlFeGlzdHMAAAAEAAAAAAAAAA9Qcm9ncmFtTm90Rm91bmQAAAAABQAAAAAAAAAbUmVzZWFyY2hlckFscmVhZHlSZWdpc3RlcmVkAAAAAAYAAAAAAAAAF1Jlc2VhcmNoZXJOb3RSZWdpc3RlcmVkAAAAAAcAAAAAAAAAEFNuYXBzaG90TWlzbWF0Y2gAAAAIAAAAAAAAABJJbXBhY3RSdWxlTWlzbWF0Y2gAAAAAAAkAAAAAAAAAE01pbmltdW1Mb3NzTWlzbWF0Y2gAAAAACgAAAAAAAAAXU3RhdGVDb21taXRtZW50TWlzbWF0Y2gAAAAACwAAAAAAAAAcUmVzZWFyY2hlckNvbW1pdG1lbnRNaXNtYXRjaAAAAAwAAAAAAAAADVplcm9OdWxsaWZpZXIAAAAAAAANAAAAAAAAABROdWxsaWZpZXJBbHJlYWR5VXNlZAAAAA4AAAAAAAAAEFZlcmlmaWVyUmVqZWN0ZWQAAAAPAAAAAAAAAA1DbGFpbU5vdEZvdW5kAAAAAAAAEA==",
        "AAAAAQAAAAAAAAAAAAAADENsYWltUmVjZWlwdAAAAAkAAAAAAAAAD2FjY2VwdGVkX2xlZGdlcgAAAAAEAAAAAAAAAA5pbXBhY3RfcnVsZV9pZAAAAAAD7gAAACAAAAAAAAAADG1pbmltdW1fbG9zcwAAA+4AAAAgAAAAAAAAAAludWxsaWZpZXIAAAAAAAPuAAAAIAAAAAAAAAAKcHJvZ3JhbV9pZAAAAAAD7gAAACAAAAAAAAAACnJlc2VhcmNoZXIAAAAAABMAAAAAAAAAFXJlc2VhcmNoZXJfY29tbWl0bWVudAAAAAAAA+4AAAAgAAAAAAAAAAtzbmFwc2hvdF9pZAAAAAPuAAAAIAAAAAAAAAAQc3RhdGVfY29tbWl0bWVudAAAA+4AAAAg",
        "AAAAAQAAAAAAAAAAAAAADERlY29kZWRDbGFpbQAAAAcAAAAAAAAADmltcGFjdF9ydWxlX2lkAAAAAAPuAAAAIAAAAAAAAAAMbWluaW11bV9sb3NzAAAD7gAAACAAAAAAAAAACW51bGxpZmllcgAAAAAAA+4AAAAgAAAAAAAAAApwcm9ncmFtX2lkAAAAAAPuAAAAIAAAAAAAAAAVcmVzZWFyY2hlcl9jb21taXRtZW50AAAAAAAD7gAAACAAAAAAAAAAC3NuYXBzaG90X2lkAAAAA+4AAAAgAAAAAAAAABBzdGF0ZV9jb21taXRtZW50AAAD7gAAACA=",
        "AAAAAQAAAAAAAAAAAAAADVByb2dyYW1Db25maWcAAAAAAAAGAAAAAAAAAA5pbXBhY3RfcnVsZV9pZAAAAAAD7gAAACAAAAAAAAAADG1pbmltdW1fbG9zcwAAA+4AAAAgAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAACnByb2dyYW1faWQAAAAAA+4AAAAgAAAAAAAAAAtzbmFwc2hvdF9pZAAAAAPuAAAAIAAAAAAAAAAQc3RhdGVfY29tbWl0bWVudAAAA+4AAAAg",
        "AAAABQAAAAAAAAAAAAAADUNsYWltQWNjZXB0ZWQAAAAAAAABAAAADmNsYWltX2FjY2VwdGVkAAAAAAAJAAAAAAAAAApwcm9ncmFtX2lkAAAAAAPuAAAAIAAAAAAAAAAAAAAACnJlc2VhcmNoZXIAAAAAABMAAAAAAAAAAAAAAAtzbmFwc2hvdF9pZAAAAAPuAAAAIAAAAAAAAAAAAAAADmltcGFjdF9ydWxlX2lkAAAAAAPuAAAAIAAAAAAAAAAAAAAADG1pbmltdW1fbG9zcwAAA+4AAAAgAAAAAAAAAAAAAAAQc3RhdGVfY29tbWl0bWVudAAAA+4AAAAgAAAAAAAAAAAAAAAVcmVzZWFyY2hlcl9jb21taXRtZW50AAAAAAAD7gAAACAAAAAAAAAAAAAAAAludWxsaWZpZXIAAAAAAAPuAAAAIAAAAAAAAAAAAAAAD2FjY2VwdGVkX2xlZGdlcgAAAAAEAAAAAAAAAAI=",
        "AAAAAAAAAAAAAAAIdmVyaWZpZXIAAAAAAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAJZ2V0X2NsYWltAAAAAAAAAQAAAAAAAAAJbnVsbGlmaWVyAAAAAAAD7gAAACAAAAABAAAD6QAAB9AAAAAMQ2xhaW1SZWNlaXB0AAAAAw==",
        "AAAAAAAAAAAAAAALZ2V0X3Byb2dyYW0AAAAAAQAAAAAAAAAKcHJvZ3JhbV9pZAAAAAAD7gAAACAAAAABAAAD6QAAB9AAAAANUHJvZ3JhbUNvbmZpZwAAAAAAAAM=",
        "AAAAAAAAAAAAAAAMc3VibWl0X2NsYWltAAAAAwAAAAAAAAAKcmVzZWFyY2hlcgAAAAAAEwAAAAAAAAANcHVibGljX2lucHV0cwAAAAAAAA4AAAAAAAAAC3Byb29mX2J5dGVzAAAAAA4AAAABAAAD6QAAB9AAAAAMQ2xhaW1SZWNlaXB0AAAAAw==",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAACHZlcmlmaWVyAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAQcmVnaXN0ZXJfcHJvZ3JhbQAAAAYAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAKcHJvZ3JhbV9pZAAAAAAD7gAAACAAAAAAAAAAC3NuYXBzaG90X2lkAAAAA+4AAAAgAAAAAAAAAA5pbXBhY3RfcnVsZV9pZAAAAAAD7gAAACAAAAAAAAAADG1pbmltdW1fbG9zcwAAA+4AAAAgAAAAAAAAABBzdGF0ZV9jb21taXRtZW50AAAD7gAAACAAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAARaXNfbnVsbGlmaWVyX3VzZWQAAAAAAAABAAAAAAAAAAludWxsaWZpZXIAAAAAAAPuAAAAIAAAAAEAAAAB",
        "AAAAAAAAAAAAAAATcmVnaXN0ZXJfcmVzZWFyY2hlcgAAAAACAAAAAAAAAApyZXNlYXJjaGVyAAAAAAATAAAAAAAAABVyZXNlYXJjaGVyX2NvbW1pdG1lbnQAAAAAAAPuAAAAIAAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAAUZGVjb2RlX3B1YmxpY19pbnB1dHMAAAABAAAAAAAAAA1wdWJsaWNfaW5wdXRzAAAAAAAADgAAAAEAAAPpAAAH0AAAAAxEZWNvZGVkQ2xhaW0AAAAD",
        "AAAAAAAAAAAAAAAZZ2V0X3Jlc2VhcmNoZXJfY29tbWl0bWVudAAAAAAAAAEAAAAAAAAACnJlc2VhcmNoZXIAAAAAABMAAAABAAAD6QAAA+4AAAAgAAAAAw==" ]),
      options
    )
  }
  public readonly fromJSON = {
    verifier: this.txFromJSON<string>,
        get_claim: this.txFromJSON<Result<ClaimReceipt>>,
        get_program: this.txFromJSON<Result<ProgramConfig>>,
        submit_claim: this.txFromJSON<Result<ClaimReceipt>>,
        register_program: this.txFromJSON<Result<void>>,
        is_nullifier_used: this.txFromJSON<boolean>,
        register_researcher: this.txFromJSON<Result<void>>,
        decode_public_inputs: this.txFromJSON<Result<DecodedClaim>>,
        get_researcher_commitment: this.txFromJSON<Result<Buffer>>
  }
}