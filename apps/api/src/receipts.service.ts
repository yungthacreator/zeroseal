import { Inject, Injectable } from "@nestjs/common";
import { ChainTransactionStatus, ClaimStatus, VerificationResultStatus } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "./prisma.service";
import { StellarService } from "./stellar.service";
import { ApiError } from "./common";
import { assertTransition } from "./lifecycle";

@Injectable()
export class ReceiptsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(StellarService)
    private readonly stellar: StellarService,
  ) {}

  async issueIfReady(claimId: string) {
    const claim = await this.prisma.claim.findUnique({
      where: { id: claimId },
      include: {
        programme: true,
        programmeSnapshot: true,
        impactPolicy: true,
        walletAccount: true,
        proofArtifacts: { orderBy: { createdAt: "desc" }, take: 1 },
        publicInputs: { orderBy: { position: "asc" } },
        transactions: {
          where: { status: ChainTransactionStatus.CONFIRMED },
          orderBy: { confirmedAt: "desc" },
          take: 1,
        },
        verificationResults: true,
        receipt: true,
      },
    });

    if (!claim) {
      throw new ApiError("CLAIM_NOT_FOUND", "Claim not found.", 404);
    }

    if (claim.receipt) {
      return claim.receipt;
    }

    const transaction = claim.transactions[0];
    const proof = claim.proofArtifacts[0];
    if (claim.status !== ClaimStatus.CONFIRMED || !transaction || !transaction.ledgerNumber || !transaction.confirmedAt) {
      throw new ApiError("RECEIPT_NOT_READY", "Receipt is pending real transaction confirmation.", 409);
    }

    const isRegistryReceipt = transaction.method === "submit_claim";
    const structural = claim.verificationResults.find(
      (result) => result.status === VerificationResultStatus.PASSED,
    );
    if (proof && !structural) {
      throw new ApiError("VERIFICATION_NOT_READY", "Verification result is not ready.", 409);
    }

    if (!proof && (!isRegistryReceipt || claim.publicInputs.length === 0)) {
      throw new ApiError("VERIFICATION_NOT_READY", "Verification result is not ready.", 409);
    }

    if (!claim.researcherCommitment || !claim.nullifier) {
      throw new ApiError(
        "CLAIM_PUBLIC_BINDING_INCOMPLETE",
        "Researcher commitment and nullifier are required before receipt issuance.",
        409,
      );
    }

    const receiptId = `zs_${randomUUID()}`;
    const publicInputDigest = proof?.publicInputDigest ?? digestJson(
      claim.publicInputs.map((input) => ({
        position: input.position,
        name: input.name,
        digest: input.digest,
      })),
    );
    const proofArtifactDigest = proof?.artifactDigest ?? digestJson({
      claimId: claim.id,
      transactionHash: transaction.transactionHash,
      publicInputDigest,
      type: "registry-action-public-inputs",
    });
    const receiptPayload = {
      receiptId,
      claimId: claim.id,
      programmeIdentifier: claim.programme.identifier,
      snapshotIdentifier: claim.programmeSnapshot.identifier,
      policyIdentifier: claim.impactPolicy.identifier,
      circuitId: claim.circuitId,
      walletAddress: claim.walletAccount.address,
      researcherCommitment: claim.researcherCommitment,
      evidenceBindingStatus: claim.evidenceBindingStatus,
      nullifier: claim.nullifier,
      publicInputDigest,
      proofArtifactDigest,
      transactionHash: transaction.transactionHash,
      ledgerNumber: transaction.ledgerNumber,
      registryContract: claim.impactPolicy.registryContract,
      verifierContract: claim.impactPolicy.verifierContract,
      network: claim.network,
    };
    const receiptDigest = createHash("sha256")
      .update(JSON.stringify(receiptPayload))
      .digest("hex");

    return this.prisma.$transaction(async (tx) => {
      assertTransition(claim.status, ClaimStatus.RECEIPT_ISSUED);
      const receipt = await tx.claimReceipt.create({
        data: {
          ...receiptPayload,
          evidenceCommitmentId: claim.evidenceCommitmentId,
          verificationResult: proof
            ? { structural: "PASSED", cryptographic: "PENDING", soroban: "PENDING" }
            : {
                structural: "PUBLIC_INPUTS_RECORDED",
                cryptographic: "PENDING",
                soroban: "REGISTRY_ACTION_CONFIRMED",
              },
          transactionId: transaction.id,
          explorerTransactionUrl: this.stellar.explorerTransactionUrl(transaction.transactionHash),
          explorerAccountUrl: this.stellar.explorerAccountUrl(claim.walletAccount.address),
          explorerRegistryUrl: this.stellar.explorerContractUrl(claim.impactPolicy.registryContract),
          explorerVerifierUrl: this.stellar.explorerContractUrl(claim.impactPolicy.verifierContract),
          receiptDigest,
        },
      });

      await tx.claim.update({
        where: { id: claim.id },
        data: { status: ClaimStatus.RECEIPT_ISSUED },
      });

      return receipt;
    });
  }

  async getByReceiptId(receiptId: string) {
    return this.getByIdentifier(receiptId);
  }

  async getByIdentifier(identifier: string) {
    const parsed = classifyReceiptIdentifier(identifier);
    let receipt: PublicReceiptModel | null = null;

    if (parsed.kind === "receiptId") {
      receipt = await this.prisma.claimReceipt.findUnique({
        where: { receiptId: parsed.value },
        include: publicReceiptInclude,
      });
    } else if (parsed.kind === "transactionHash") {
      receipt = await this.prisma.claimReceipt.findFirst({
        where: { transactionHash: parsed.value },
        include: publicReceiptInclude,
      });
    } else if (parsed.kind === "uuid") {
      receipt = await this.prisma.claimReceipt.findFirst({
        where: {
          OR: [
            { id: parsed.value },
            { claimId: parsed.value },
          ],
        },
        include: publicReceiptInclude,
      });
    } else {
      throw new ApiError(
        "INVALID_RECEIPT_IDENTIFIER",
        "Enter a valid ZeroSeal receipt ID, claim ID or Stellar transaction hash.",
        400,
      );
    }

    if (!receipt) {
      throw new ApiError("RECEIPT_NOT_FOUND", "Receipt not found.", 404);
    }
    return serializePublicReceipt(receipt);
  }

  async getForClaim(claimId: string) {
    const receipt = await this.prisma.claimReceipt.findUnique({
      where: { claimId },
      include: publicReceiptInclude,
    });
    if (!receipt) {
      throw new ApiError("RECEIPT_PENDING", "Receipt has not been issued.", 404);
    }
    return serializePublicReceipt(receipt);
  }

  async listPublicReceipts() {
    const receipts = await this.prisma.claimReceipt.findMany({
      where: {
        transaction: {
          status: ChainTransactionStatus.CONFIRMED,
          method: "submit_claim",
        },
      },
      include: publicReceiptInclude,
      orderBy: { issuedAt: "desc" },
      take: 25,
    });

    return receipts.map(serializePublicReceipt);
  }
}

const publicReceiptInclude = {
  claim: {
    include: {
      publicInputs: { orderBy: { position: "asc" } },
    },
  },
  transaction: true,
} as const;

type PublicReceiptModel = {
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
  transaction?: {
    method?: string | null;
    status?: string | null;
  };
};

type ReceiptIdentifier =
  | { kind: "receiptId"; value: string }
  | { kind: "transactionHash"; value: string }
  | { kind: "uuid"; value: string }
  | { kind: "unknown"; value: string };

function classifyReceiptIdentifier(input: string): ReceiptIdentifier {
  const value = extractIdentifier(input).trim();

  if (/^zs_[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)) {
    return { kind: "receiptId", value };
  }

  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return { kind: "transactionHash", value: value.toLowerCase() };
  }

  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value)) {
    return { kind: "uuid", value: value.toLowerCase() };
  }

  return { kind: "unknown", value };
}

function extractIdentifier(input: string): string {
  try {
    const parsed = new URL(input);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? input;
  } catch {
    return input;
  }
}

function serializePublicReceipt(receipt: PublicReceiptModel) {
  const claimCommitment =
    receipt.claim?.publicInputs?.find((input) => input.name === "claim_commitment")
      ?.valueHex ?? null;
  const method = receipt.transaction?.method ?? "submit_claim";

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
    issuedAt:
      receipt.issuedAt instanceof Date
        ? receipt.issuedAt.toISOString()
        : new Date(receipt.issuedAt).toISOString(),
    method,
    actionLabel:
      method === "submit_claim"
        ? "Claim stamped"
        : "Legacy researcher registration",
    status: "CONFIRMED",
    explorerTransactionUrl: receipt.explorerTransactionUrl,
    explorerAccountUrl: receipt.explorerAccountUrl,
    explorerRegistryUrl: receipt.explorerRegistryUrl,
    explorerVerifierUrl: receipt.explorerVerifierUrl,
  };
}

function digestJson(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}
