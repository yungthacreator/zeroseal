import { Inject, Injectable } from "@nestjs/common";
import { Horizon, scValToNative, xdr } from "@stellar/stellar-sdk";
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

export type RecoveredRegistrationTransaction = ConfirmedTransaction & {
  contractId: string;
  method: "register_researcher";
  researcherCommitment: string;
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

  constructor(@Inject(CONFIG) private readonly config: ApiConfig) {
    this.horizon = new Horizon.Server(config.STELLAR_HORIZON_URL);
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

  async recoverResearcherRegistration(
    account: string,
    researcherCommitment?: string,
    options: RegistrationRecoveryOptions = {},
  ): Promise<RecoveredRegistrationTransaction | null> {
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
          operation.parameters.length < 4
        ) {
          continue;
        }

        const contract = this.decodeScVal(operation.parameters[0]?.value);
        const method = this.decodeScVal(operation.parameters[1]?.value);
        const researcher = this.decodeScVal(operation.parameters[2]?.value);
        const commitment = this.decodeScVal(operation.parameters[3]?.value);
        const commitmentHex = Buffer.isBuffer(commitment)
          ? commitment.toString("hex")
          : commitment instanceof Uint8Array
            ? Buffer.from(commitment).toString("hex")
            : null;

        if (
          contract !== this.config.REGISTRY_CONTRACT_ID ||
          method !== "register_researcher" ||
          researcher !== account ||
          !commitmentHex
        ) {
          continue;
        }

        if (
          researcherCommitment &&
          commitmentHex.toLowerCase() !== researcherCommitment.toLowerCase()
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
          method: "register_researcher",
          researcherCommitment: commitmentHex,
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
