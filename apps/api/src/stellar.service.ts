import { Inject, Injectable } from "@nestjs/common";
import { Address, Horizon, StrKey, rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import { createHash } from "node:crypto";
import { CONFIG } from "./tokens";
import type { ApiConfig } from "./config";
import { ApiError } from "./common";
import { transactionHash } from "./validators";

export type ConfirmedTransaction = {
  hash: string;
  successful: boolean;
  ledger: number | null;
  sourceAccount: string | null;
  createdAt: Date | null;
  feeCharged: string | null;
};

export type RecoveredSubmitClaimTransaction = ConfirmedTransaction & {
  contractId: string;
  method: "submit_claim";
  researcher: string;
  researcherCommitment: string;
  claimCommitment: string;
  nullifier: string;
  explorerTransactionUrl: string;
  explorerAccountUrl: string;
  explorerRegistryUrl: string;
  explorerVerifierUrl: string;
};

export type RegistrationRecoveryOptions = {
  ledgerFrom?: number;
  ledgerTo?: number;
  confirmedAfter?: Date;
  confirmedBefore?: Date;
};

type HorizonTransactionsPage = {
  _embedded?: {
    records?: Array<{
      hash?: unknown;
      successful?: unknown;
      ledger?: unknown;
      source_account?: unknown;
      created_at?: unknown;
      fee_charged?: unknown;
      _links?: {
        operations?: {
          href?: unknown;
        };
      };
    }>;
  };
};

type HorizonOperationsPage = {
  _embedded?: {
    records?: Array<{
      type?: unknown;
      transaction_successful?: unknown;
      source_account?: unknown;
      parameters?: Array<{
        value?: unknown;
        type?: unknown;
      }>;
    }>;
  };
};

@Injectable()
export class StellarService {
  private readonly horizon: Horizon.Server;
  private readonly rpcServer: rpc.Server;

  constructor(@Inject(CONFIG) private readonly config: ApiConfig) {
    this.horizon = new Horizon.Server(config.STELLAR_HORIZON_URL);
    this.rpcServer = new rpc.Server(config.STELLAR_RPC_URL);
  }

  explorerTransactionUrl(hash: string): string {
    return `${this.config.EXPLORER_TRANSACTION_BASE_URL}/${hash}`;
  }

  explorerAccountUrl(account: string): string {
    return `${this.config.EXPLORER_ACCOUNT_BASE_URL}/${account}`;
  }

  explorerContractUrl(contractId: string): string {
    return `${this.config.EXPLORER_CONTRACT_BASE_URL}/${contractId}`;
  }

  validateTransactionHash(value: string): string {
    return transactionHash.parse(value);
  }

  rawDigest(value: unknown): string {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  async fetchTransaction(hash: string): Promise<ConfirmedTransaction | null> {
    const normalized = this.validateTransactionHash(hash);

    try {
      const tx = await this.horizon
        .transactions()
        .transaction(normalized)
        .call();

      return {
        hash: tx.hash,
        successful: tx.successful,
        ledger: typeof tx.ledger === "number" ? tx.ledger : null,
        sourceAccount:
          typeof tx.source_account === "string" ? tx.source_account : null,
        createdAt:
          typeof tx.created_at === "string" ? new Date(tx.created_at) : null,
        feeCharged:
          typeof tx.fee_charged === "string" ||
          typeof tx.fee_charged === "number"
            ? String(tx.fee_charged)
            : null,
      };
    } catch (error) {
      const status =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { status?: unknown } }).response
          ?.status === "number"
          ? (error as { response: { status: number } }).response.status
          : null;

      if (status === 404) {
        return null;
      }

      throw new ApiError(
        "STELLAR_UPSTREAM_UNAVAILABLE",
        "Stellar transaction status is temporarily unavailable.",
        503,
      );
    }
  }

  async fetchSubmitClaimInvocation(
    hash: string,
  ): Promise<RecoveredSubmitClaimTransaction | null> {
    const normalized = this.validateTransactionHash(hash);

    let tx: Awaited<ReturnType<rpc.Server["getTransaction"]>>;
    try {
      tx = await this.rpcServer.getTransaction(normalized);
    } catch {
      throw new ApiError(
        "STELLAR_UPSTREAM_UNAVAILABLE",
        "Stellar transaction status is temporarily unavailable.",
        503,
      );
    }

    if (tx.status === "NOT_FOUND") {
      return null;
    }

    if (tx.status !== "SUCCESS") {
      return null;
    }

    const envelope =
      typeof tx.envelopeXdr === "string"
        ? xdr.TransactionEnvelope.fromXDR(tx.envelopeXdr, "base64")
        : tx.envelopeXdr;
    const transaction = transactionFromEnvelope(envelope);
    if (!transaction) {
      return null;
    }

    const operations = transaction.operations();
    if (operations.length !== 1) {
      return null;
    }

    const body = operations[0].body();
    if (body.switch().name !== "invokeHostFunction") {
      return null;
    }

    const hostFunction = body.invokeHostFunctionOp().hostFunction();
    if (hostFunction.switch().name !== "hostFunctionTypeInvokeContract") {
      return null;
    }

    const invocation = hostFunction.invokeContract();
    const contractId = Address.fromScAddress(
      invocation.contractAddress(),
    ).toString();
    const method = invocation.functionName().toString();
    if (method !== "submit_claim") {
      return null;
    }

    const args = invocation.args();
    if (args.length !== 4) {
      return null;
    }

    const researcher = scValToNative(args[0]);
    const researcherCommitment = bytesHex(scValToNative(args[1]));
    const claimCommitment = bytesHex(scValToNative(args[2]));
    const nullifier = bytesHex(scValToNative(args[3]));

    if (
      typeof researcher !== "string" ||
      !researcherCommitment ||
      !claimCommitment ||
      !nullifier
    ) {
      return null;
    }

    const rpcFeeCharged = (tx as { feeCharged?: unknown }).feeCharged;

    return {
      hash: normalized,
      successful: true,
      ledger: typeof tx.ledger === "number" ? tx.ledger : null,
      sourceAccount: sourceAccountFromEnvelope(transaction.sourceAccount()),
      createdAt: rpcCreatedAt(tx.createdAt),
      feeCharged:
        typeof rpcFeeCharged === "number" ||
        typeof rpcFeeCharged === "string"
          ? String(rpcFeeCharged)
          : null,
      contractId,
      method: "submit_claim",
      researcher,
      researcherCommitment,
      claimCommitment,
      nullifier,
      explorerTransactionUrl: this.explorerTransactionUrl(normalized),
      explorerAccountUrl: this.explorerAccountUrl(researcher),
      explorerRegistryUrl: this.explorerContractUrl(contractId),
      explorerVerifierUrl: this.explorerContractUrl(
        this.config.VERIFIER_CONTRACT_ID,
      ),
    };
  }

  private decodeScVal(value: unknown): unknown {
    if (typeof value !== "string") {
      return null;
    }

    try {
      return scValToNative(xdr.ScVal.fromXDR(value, "base64"));
    } catch {
      return null;
    }
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new ApiError(
        "STELLAR_DATA_UNAVAILABLE",
        "Unable to query Stellar network data.",
        502,
      );
    }
    return (await response.json()) as T;
  }

  async recoverSubmitClaim(
    account: string,
    researcherCommitment?: string,
    claimCommitment?: string,
    nullifier?: string,
    options: RegistrationRecoveryOptions = {},
  ): Promise<RecoveredSubmitClaimTransaction | null> {
    const url = `${this.config.STELLAR_HORIZON_URL}/accounts/${account}/transactions?order=desc&limit=50`;
    const page = await this.fetchJson<HorizonTransactionsPage>(url);
    const records = page._embedded?.records ?? [];

    for (const transaction of records) {
      if (
        transaction.successful !== true ||
        transaction.source_account !== account ||
        typeof transaction.hash !== "string" ||
        !transaction._links?.operations ||
        typeof transaction._links.operations.href !== "string"
      ) {
        continue;
      }

      const ledger =
        typeof transaction.ledger === "number" ? transaction.ledger : null;
      const createdAt =
        typeof transaction.created_at === "string"
          ? new Date(transaction.created_at)
          : null;

      if (
        options.ledgerFrom &&
        ledger !== null &&
        ledger < options.ledgerFrom
      ) {
        continue;
      }

      if (options.ledgerTo && ledger !== null && ledger > options.ledgerTo) {
        continue;
      }

      if (
        options.confirmedAfter &&
        createdAt &&
        createdAt < options.confirmedAfter
      ) {
        continue;
      }

      if (
        options.confirmedBefore &&
        createdAt &&
        createdAt > options.confirmedBefore
      ) {
        continue;
      }

      const operationsUrl = transaction._links.operations.href.replace(
        "{?cursor,limit,order}",
        "?limit=10&order=asc",
      );
      const operations =
        await this.fetchJson<HorizonOperationsPage>(operationsUrl);

      for (const operation of operations._embedded?.records ?? []) {
        if (
          operation.type !== "invoke_host_function" ||
          operation.transaction_successful !== true ||
          operation.source_account !== account ||
          !Array.isArray(operation.parameters) ||
          operation.parameters.length < 6
        ) {
          continue;
        }

        const contract = this.decodeScVal(operation.parameters[0]?.value);
        const method = this.decodeScVal(operation.parameters[1]?.value);
        const researcher = this.decodeScVal(operation.parameters[2]?.value);
        const commitment = this.decodeScVal(operation.parameters[3]?.value);
        const claim = this.decodeScVal(operation.parameters[4]?.value);
        const nullifierValue = this.decodeScVal(operation.parameters[5]?.value);
        const commitmentHex = Buffer.isBuffer(commitment)
          ? commitment.toString("hex")
          : commitment instanceof Uint8Array
            ? Buffer.from(commitment).toString("hex")
            : null;
        const claimHex = Buffer.isBuffer(claim)
          ? claim.toString("hex")
          : claim instanceof Uint8Array
            ? Buffer.from(claim).toString("hex")
            : null;
        const nullifierHex = Buffer.isBuffer(nullifierValue)
          ? nullifierValue.toString("hex")
          : nullifierValue instanceof Uint8Array
            ? Buffer.from(nullifierValue).toString("hex")
            : null;

        if (
          contract !== this.config.REGISTRY_CONTRACT_ID ||
          method !== "submit_claim" ||
          researcher !== account ||
          !commitmentHex ||
          !claimHex ||
          !nullifierHex
        ) {
          continue;
        }

        if (
          researcherCommitment &&
          commitmentHex.toLowerCase() !== researcherCommitment.toLowerCase()
        ) {
          continue;
        }

        if (
          claimCommitment &&
          claimHex.toLowerCase() !== claimCommitment.toLowerCase()
        ) {
          continue;
        }

        if (
          nullifier &&
          nullifierHex.toLowerCase() !== nullifier.toLowerCase()
        ) {
          continue;
        }

        return {
          hash: transaction.hash,
          successful: true,
          ledger:
            ledger,
          sourceAccount: account,
          createdAt,
          feeCharged:
            typeof transaction.fee_charged === "string" ||
            typeof transaction.fee_charged === "number"
              ? String(transaction.fee_charged)
              : null,
          contractId: this.config.REGISTRY_CONTRACT_ID,
          method: "submit_claim",
          researcher: account,
          researcherCommitment: commitmentHex,
          claimCommitment: claimHex,
          nullifier: nullifierHex,
          explorerTransactionUrl: this.explorerTransactionUrl(transaction.hash),
          explorerAccountUrl: this.explorerAccountUrl(account),
          explorerRegistryUrl: this.explorerContractUrl(
            this.config.REGISTRY_CONTRACT_ID,
          ),
          explorerVerifierUrl: this.explorerContractUrl(
            this.config.VERIFIER_CONTRACT_ID,
          ),
        };
      }
    }

    return null;
  }
}

function transactionFromEnvelope(envelope: xdr.TransactionEnvelope) {
  switch (envelope.switch().name) {
    case "envelopeTypeTx":
      return envelope.v1().tx();
    case "envelopeTypeTxFeeBump":
      return envelope.feeBump().tx().innerTx().v1().tx();
    default:
      return null;
  }
}

function sourceAccountFromEnvelope(source: xdr.MuxedAccount): string | null {
  switch (source.switch().name) {
    case "keyTypeEd25519":
      return StrKey.encodeEd25519PublicKey(Buffer.from(source.ed25519()));
    case "keyTypeMuxedEd25519":
      return StrKey.encodeEd25519PublicKey(
        Buffer.from(source.med25519().ed25519()),
      );
    default:
      return null;
  }
}

function bytesHex(value: unknown): string | null {
  if (Buffer.isBuffer(value)) {
    return value.toString("hex");
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("hex");
  }
  return null;
}

function rpcCreatedAt(value: unknown): Date | null {
  if (typeof value === "number") {
    return new Date(value * 1000);
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}
