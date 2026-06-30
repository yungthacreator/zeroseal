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

    const isRegistryReceipt = transaction.method === "register_researcher";
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
    const receipt = await this.prisma.claimReceipt.findUnique({
      where: { receiptId },
    });
    if (!receipt) {
      throw new ApiError("RECEIPT_NOT_FOUND", "Receipt not found.", 404);
    }
    return receipt;
  }

  async getForClaim(claimId: string) {
    const receipt = await this.prisma.claimReceipt.findUnique({
      where: { claimId },
    });
    if (!receipt) {
      throw new ApiError("RECEIPT_PENDING", "Receipt has not been issued.", 404);
    }
    return receipt;
  }
}

function digestJson(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}
