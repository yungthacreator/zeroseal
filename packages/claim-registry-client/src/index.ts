/* eslint-disable */
import { Buffer } from "buffer";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Spec as ContractSpec,
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
    contractId: "CD6MKUVXB7ZTZQCGNMBVHMU4PGT2SEKS6Z5LF53HXDOAVCO3LGKGQ3JU",
  },
} as const;

export const Errors = {
  1: { message: "ResearcherCommitmentMismatch" },
  2: { message: "ClaimCommitmentAlreadyUsed" },
  3: { message: "NullifierAlreadyUsed" },
  4: { message: "ClaimNotFound" },
} as const;

export interface ClaimReceipt {
  accepted_ledger: number;
  researcher: string;
  researcher_commitment: Buffer;
  claim_commitment: Buffer;
  nullifier: Buffer;
}

export interface Client {
  submit_claim: (
    args: {
      researcher: string;
      researcher_commitment: Buffer;
      claim_commitment: Buffer;
      nullifier: Buffer;
    },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<ClaimReceipt>>;
}

export class Client extends ContractClient {
  constructor(public readonly options: ContractClientOptions) {
    super(new ContractSpec([]), options);
  }

  public readonly fromJSON = {
    submit_claim: this.txFromJSON<ClaimReceipt>,
  };
}
