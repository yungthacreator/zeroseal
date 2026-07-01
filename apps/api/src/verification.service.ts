import { Inject, Injectable } from "@nestjs/common";
import { ChainTransactionStatus } from "@prisma/client";
import { ApiError } from "./common";
import { ClaimsService } from "./claims.service";
import { ReceiptsService } from "./receipts.service";
import { StellarService } from "./stellar.service";
import { TransactionsService } from "./transactions.service";
import { transactionHash } from "./validators";

export type VerificationStatus =
  | "VERIFIED"
  | "PENDING_CONFIRMATION"
  | "FAILED"
  | "NOT_FOUND"
  | "INVALID"
  | "MISMATCHED";

type VerificationInputType = "receipt" | "claim" | "transaction" | "unknown";

@Injectable()
export class VerificationService {
  constructor(
    @Inject(ClaimsService)
    private readonly claims: ClaimsService,
    @Inject(ReceiptsService)
    private readonly receipts: ReceiptsService,
    @Inject(TransactionsService)
    private readonly transactions: TransactionsService,
    @Inject(StellarService)
    private readonly stellar: StellarService,
  ) {}

  async verify(input: string) {
    const identifier = extractIdentifier(input);
    if (!identifier) {
      return this.invalid("", "Enter a receipt ID, claim ID, transaction hash or receipt URL.");
    }

    if (isReceiptId(identifier)) {
      return this.verifyReceiptIdentifier(identifier);
    }

    if (isTransactionHash(identifier)) {
      return this.verifyTransaction(identifier);
    }

    if (isUuid(identifier)) {
      return this.verifyClaim(identifier);
    }

    return this.invalid(
      identifier,
      "The input is not a supported ZeroSeal receipt ID, claim ID, transaction hash or receipt URL.",
    );
  }

  private async verifyReceiptIdentifier(receiptId: string) {
    const receipt = await this.resolveReceipt(receiptId);
    return this.verifyReceipt(receiptId, "receipt", receipt);
  }

  private async verifyClaim(claimId: string) {
    const claim = await this.resolveClaim(claimId);

    try {
      const receipt = await this.resolveReceipt(claimId);
      return this.verifyReceipt(claimId, "claim", receipt);
    } catch (error) {
      if (!isNotFoundApiError(error)) {
        throw error;
      }
    }

    const transaction = claim.transactions?.[0] ?? null;
    if (transaction?.status === ChainTransactionStatus.FAILED) {
      return this.failed(claimId, "claim", "The latest transaction for this claim failed.", transaction);
    }

    return {
      status: "PENDING_CONFIRMATION" as const,
      inputType: "claim" as const,
      identifier: claimId,
      message: transaction
        ? "The claim has a transaction record, but no verified receipt has been issued yet."
        : "The claim exists, but no Testnet transaction has been recorded yet.",
      claim: {
        id: claim.id,
        status: claim.status,
      },
      transaction: transaction ? serializeTransaction(transaction) : null,
    };
  }

  private async verifyTransaction(hash: string) {
    const normalized = transactionHash.parse(hash);
    let transaction: TransactionLike | null = null;
    try {
      transaction = await this.resolveTransaction(normalized);
    } catch (error) {
      if (!isNotFoundApiError(error)) {
        throw error;
      }
    }

    const chain = await this.stellar.fetchTransaction(normalized);
    if (!chain && !transaction) {
      return this.notFound(
        normalized,
        "transaction",
        "No Stellar Testnet transaction or ZeroSeal transaction record exists for this hash.",
      );
    }

    if (chain && !chain.successful) {
      return this.failed(
        normalized,
        "transaction",
        "The transaction exists on Stellar Testnet, but it did not succeed.",
        transaction,
        chain,
      );
    }

    try {
      const receipt = await this.resolveReceipt(normalized);
      return this.verifyReceipt(normalized, "transaction", receipt, chain);
    } catch (error) {
      if (!isNotFoundApiError(error)) {
        throw error;
      }
    }

    return {
      status: "PENDING_CONFIRMATION" as const,
      inputType: "transaction" as const,
      identifier: normalized,
      message: chain
        ? "The transaction succeeded on Stellar Testnet, but ZeroSeal has not issued a receipt for it yet."
        : "ZeroSeal has a transaction record, but Stellar confirmation is still pending.",
      transaction: transaction ? serializeTransaction(transaction) : null,
      chain: chain ? serializeChain(chain) : null,
      explorer: null,
    };
  }

  private resolveReceipt(identifier: string) {
    return this.receipts.getByIdentifier(identifier) as Promise<ReceiptLike>;
  }

  private resolveClaim(identifier: string) {
    return this.claims.getClaim(identifier) as Promise<ClaimLike>;
  }

  private resolveTransaction(identifier: string) {
    return this.transactions.getTransaction(identifier) as Promise<TransactionLike>;
  }

  private async verifyReceipt(
    identifier: string,
    inputType: VerificationInputType,
    receipt: ReceiptLike,
    knownChain?: Awaited<ReturnType<StellarService["fetchTransaction"]>>,
  ) {
    const chain = knownChain ?? await this.stellar.fetchTransaction(receipt.transactionHash);

    if (!chain) {
      return {
        status: "PENDING_CONFIRMATION" as const,
        inputType,
        identifier,
        message: "A ZeroSeal receipt exists, but the Stellar transaction could not be confirmed right now.",
        receipt: serializeReceipt(receipt),
        chain: null,
        explorer: receiptExplorer(receipt),
      };
    }

    if (!chain.successful) {
      return this.failed(
        identifier,
        inputType,
        "The Stellar transaction attached to this receipt failed.",
        null,
        chain,
        receipt,
      );
    }

    const mismatches = [
      chain.ledger !== null && receipt.ledgerNumber !== chain.ledger ? "ledger" : null,
      chain.sourceAccount && receipt.walletAddress !== chain.sourceAccount ? "source account" : null,
    ].filter(Boolean);

    if (mismatches.length > 0) {
      return {
        status: "MISMATCHED" as const,
        inputType,
        identifier,
        message: `The receipt does not match the confirmed Stellar transaction (${mismatches.join(", ")}).`,
        receipt: serializeReceipt(receipt),
        chain: serializeChain(chain),
        explorer: receiptExplorer(receipt),
      };
    }

    return {
      status: "VERIFIED" as const,
      inputType,
      identifier,
      message: "Verified against ZeroSeal persistence and the confirmed Stellar Testnet transaction.",
      receipt: serializeReceipt(receipt),
      chain: serializeChain(chain),
      explorer: receiptExplorer(receipt),
    };
  }

  private invalid(identifier: string, message: string) {
    return {
      status: "INVALID" as const,
      inputType: "unknown" as const,
      identifier,
      message,
    };
  }

  private notFound(identifier: string, inputType: VerificationInputType, message: string) {
    return {
      status: "NOT_FOUND" as const,
      inputType,
      identifier,
      message,
    };
  }

  private failed(
    identifier: string,
    inputType: VerificationInputType,
    message: string,
    transaction?: TransactionLike | null,
    chain?: ChainLike | null,
    receipt?: ReceiptLike,
  ) {
    return {
      status: "FAILED" as const,
      inputType,
      identifier,
      message,
      receipt: receipt ? serializeReceipt(receipt) : null,
      transaction: transaction ? serializeTransaction(transaction) : null,
      chain: chain ? serializeChain(chain) : null,
      explorer: receipt ? receiptExplorer(receipt) : null,
    };
  }
}

type ReceiptLike = {
  receiptId: string;
  claimId: string;
  transactionHash: string;
  ledgerNumber: number;
  registryContract: string;
  verifierContract: string;
  network: string;
  walletAddress: string;
  researcherCommitment: string;
  nullifier: string | null;
  claimCommitment?: string | null;
  policyIdentifier: string;
  issuedAt: Date | string;
  explorerTransactionUrl: string;
  explorerAccountUrl: string;
  explorerRegistryUrl: string;
  explorerVerifierUrl: string;
  claim?: {
    publicInputs?: Array<{
      name: string;
      valueHex: string;
    }>;
  };
};

type ClaimLike = {
  id: string;
  status: string;
  transactions?: TransactionLike[];
};

type TransactionLike = {
  id: string;
  transactionHash: string;
  status: ChainTransactionStatus | string;
  ledgerNumber: number | null;
  sourceAccount: string | null;
  contractId: string | null;
  method: string;
  researcherCommitment: string | null;
  confirmedAt: Date | string | null;
};

type ChainLike = {
  hash: string;
  successful: boolean;
  ledger: number | null;
  sourceAccount: string | null;
  createdAt: Date | null;
  feeCharged: string | null;
};

function extractIdentifier(input: string): string {
  const value = input.trim();
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? value;
  } catch {
    return value;
  }
}

function isReceiptId(value: string): boolean {
  return /^zs_[a-z0-9-]{8,}$/i.test(value);
}

function isTransactionHash(value: string): boolean {
  return transactionHash.safeParse(value).success;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function serializeReceipt(receipt: ReceiptLike) {
  const claimCommitment =
    receipt.claimCommitment ??
    receipt.claim?.publicInputs?.find((input) => input.name === "claim_commitment")
      ?.valueHex ??
    null;

  return {
    receiptId: receipt.receiptId,
    claimId: receipt.claimId,
    transactionHash: receipt.transactionHash,
    ledgerNumber: receipt.ledgerNumber,
    registryContract: receipt.registryContract,
    verifierContract: receipt.verifierContract,
    network: receipt.network,
    walletAddress: receipt.walletAddress,
    researcherCommitment: receipt.researcherCommitment,
    claimCommitment,
    nullifier: receipt.nullifier,
    policyIdentifier: receipt.policyIdentifier,
    issuedAt: toIso(receipt.issuedAt),
  };
}

function serializeTransaction(transaction: TransactionLike) {
  return {
    id: transaction.id,
    transactionHash: transaction.transactionHash,
    status: transaction.status,
    ledgerNumber: transaction.ledgerNumber,
    sourceAccount: transaction.sourceAccount,
    contractId: transaction.contractId,
    method: transaction.method,
    researcherCommitment: transaction.researcherCommitment,
    confirmedAt: transaction.confirmedAt ? toIso(transaction.confirmedAt) : null,
  };
}

function isNotFoundApiError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

function serializeChain(chain: ChainLike) {
  return {
    hash: chain.hash,
    successful: chain.successful,
    ledger: chain.ledger,
    sourceAccount: chain.sourceAccount,
    createdAt: chain.createdAt ? chain.createdAt.toISOString() : null,
    feeCharged: chain.feeCharged,
  };
}

function receiptExplorer(receipt: ReceiptLike) {
  return {
    transaction: receipt.explorerTransactionUrl,
    account: receipt.explorerAccountUrl,
    registry: receipt.explorerRegistryUrl,
    verifier: receipt.explorerVerifierUrl,
  };
}

function toIso(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError("INVALID_RECEIPT_TIMESTAMP", "Stored receipt timestamp is invalid.", 500);
  }
  return parsed.toISOString();
}
