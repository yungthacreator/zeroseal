import { Inject, Injectable } from "@nestjs/common";
import { ChainTransactionStatus, ClaimStatus } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import { StellarService } from "./stellar.service";
import type { RegistrationRecoveryOptions } from "./stellar.service";
import { ApiError } from "./common";
import { assertTransition } from "./lifecycle";
import { ReceiptsService } from "./receipts.service";
import {
  SECURITY_CIRCUIT_ID,
  SECURITY_POLICY_IDENTIFIER,
  SECURITY_PROGRAMME_IDENTIFIER,
  SECURITY_SNAPSHOT_IDENTIFIER,
} from "./programmes.service";
import { sha256Hex } from "./validators";

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(StellarService)
    private readonly stellar: StellarService,
    @Inject(ReceiptsService)
    private readonly receipts: ReceiptsService,
  ) {}

  async getTransaction(hash: string) {
    const normalized = this.stellar.validateTransactionHash(hash);
    const tx = await this.prisma.chainTransaction.findFirst({
      where: { transactionHash: normalized },
    });

    if (!tx) {
      throw new ApiError("TRANSACTION_NOT_FOUND", "Transaction not found.", 404);
    }

    return tx;
  }

  async transactionsForClaim(claimId: string) {
    return this.prisma.chainTransaction.findMany({
      where: { claimId },
      orderBy: { createdAt: "desc" },
    });
  }

  async walletActivity(address: string) {
    return this.prisma.chainTransaction.findMany({
      where: { walletAccount: { address } },
      orderBy: { createdAt: "desc" },
    });
  }

  async reconcileSubmitClaimHash(hash: string) {
    const normalized = this.stellar.validateTransactionHash(hash);
    const invocation = await this.stellar.fetchSubmitClaimInvocation(normalized);

    if (!invocation) {
      const chain = await this.stellar.fetchTransaction(normalized);
      if (chain && !chain.successful) {
        throw new ApiError(
          "TRANSACTION_NOT_SUCCESSFUL",
          "The Stellar transaction exists, but it did not succeed.",
          422,
        );
      }
      throw new ApiError(
        "SUBMIT_CLAIM_NOT_FOUND",
        "No successful submit_claim invocation was found for this transaction hash.",
        404,
      );
    }

    if (invocation.contractId !== invocation.contractId.toUpperCase()) {
      throw new ApiError(
        "INVALID_CONTRACT_ID",
        "The submit_claim invocation contract ID is invalid.",
        422,
      );
    }

    if (
      invocation.sourceAccount &&
      invocation.sourceAccount !== invocation.researcher
    ) {
      throw new ApiError(
        "TRANSACTION_SOURCE_MISMATCH",
        "Confirmed transaction source does not match the authenticated researcher.",
        422,
      );
    }

    const policy = await this.prisma.impactPolicy.findFirstOrThrow({
      where: {
        identifier: SECURITY_POLICY_IDENTIFIER,
        programme: { identifier: SECURITY_PROGRAMME_IDENTIFIER },
      },
      include: { programme: true },
    });

    if (invocation.contractId !== policy.registryContract) {
      throw new ApiError(
        "REGISTRY_CONTRACT_MISMATCH",
        "Confirmed transaction does not target the configured registry contract.",
        422,
      );
    }

    const snapshot = await this.prisma.programmeSnapshot.findFirstOrThrow({
      where: {
        programmeId: policy.programmeId,
        identifier: SECURITY_SNAPSHOT_IDENTIFIER,
      },
    });

    const { claim, transaction } = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.walletAccount.upsert({
        where: { address: invocation.researcher },
        update: { network: "TESTNET" },
        create: { address: invocation.researcher, network: "TESTNET" },
      });

      const existingClaim = await tx.claim.findFirst({
        where: {
          network: "TESTNET",
          circuitId: SECURITY_CIRCUIT_ID,
          nullifier: invocation.nullifier,
        },
        include: {
          walletAccount: true,
          publicInputs: true,
        },
      });

      if (
        existingClaim?.walletAccount &&
        existingClaim.walletAccount.address !== invocation.researcher
      ) {
        throw new ApiError(
          "CLAIM_WALLET_MISMATCH",
          "Existing claim nullifier belongs to a different wallet.",
          422,
        );
      }

      if (
        existingClaim?.researcherCommitment &&
        existingClaim.researcherCommitment !== invocation.researcherCommitment
      ) {
        throw new ApiError(
          "RESEARCHER_COMMITMENT_MISMATCH",
          "Existing claim researcher commitment does not match the confirmed transaction.",
          422,
        );
      }

      const existingClaimCommitment = existingClaim?.publicInputs.find(
        (input) => input.name === "claim_commitment",
      )?.valueHex;
      if (
        existingClaimCommitment &&
        existingClaimCommitment !== invocation.claimCommitment
      ) {
        throw new ApiError(
          "CLAIM_COMMITMENT_MISMATCH",
          "Existing claim commitment does not match the confirmed transaction.",
          422,
        );
      }

      const claim = existingClaim
        ? await tx.claim.update({
            where: { id: existingClaim.id },
            data: {
              status:
                existingClaim.status === ClaimStatus.RECEIPT_ISSUED
                  ? ClaimStatus.RECEIPT_ISSUED
                  : ClaimStatus.CONFIRMED,
              walletAccountId: wallet.id,
              researcherCommitment: invocation.researcherCommitment,
              nullifier: invocation.nullifier,
              evidenceBindingStatus: "LOCAL_ONLY",
            },
          })
        : await tx.claim.create({
            data: {
              status: ClaimStatus.CONFIRMED,
              idempotencyKey: `reconcile:submit_claim:${normalized}`,
              network: "TESTNET",
              programmeId: policy.programmeId,
              programmeSnapshotId: snapshot.id,
              impactPolicyId: policy.id,
              walletAccountId: wallet.id,
              circuitId: SECURITY_CIRCUIT_ID,
              researcherCommitment: invocation.researcherCommitment,
              nullifier: invocation.nullifier,
              evidenceBindingStatus: "LOCAL_ONLY",
            },
          });

      await tx.claimPublicInput.deleteMany({
        where: {
          claimId: claim.id,
          name: { in: ["researcher_commitment", "claim_commitment", "nullifier"] },
        },
      });
      await tx.claimPublicInput.createMany({
        data: [
          {
            claimId: claim.id,
            position: 0,
            name: "researcher_commitment",
            valueHex: invocation.researcherCommitment,
            digest: sha256Hex(invocation.researcherCommitment),
          },
          {
            claimId: claim.id,
            position: 1,
            name: "claim_commitment",
            valueHex: invocation.claimCommitment,
            digest: sha256Hex(invocation.claimCommitment),
          },
          {
            claimId: claim.id,
            position: 2,
            name: "nullifier",
            valueHex: invocation.nullifier,
            digest: sha256Hex(invocation.nullifier),
          },
        ],
      });

      const transaction = await tx.chainTransaction.upsert({
        where: {
          network_transactionHash: {
            network: "TESTNET",
            transactionHash: normalized,
          },
        },
        update: {
          claimId: claim.id,
          walletAccountId: wallet.id,
          ledgerNumber: invocation.ledger,
          sourceAccount: invocation.sourceAccount ?? invocation.researcher,
          contractId: invocation.contractId,
          method: invocation.method,
          operationType: "claim_submission",
          researcherCommitment: invocation.researcherCommitment,
          status: ChainTransactionStatus.CONFIRMED,
          feeCharged: invocation.feeCharged,
          confirmedAt: invocation.createdAt ?? new Date(),
          rawResponseDigest: this.stellar.rawDigest(invocation),
        },
        create: {
          network: "TESTNET",
          transactionHash: normalized,
          claimId: claim.id,
          walletAccountId: wallet.id,
          ledgerNumber: invocation.ledger,
          sourceAccount: invocation.sourceAccount ?? invocation.researcher,
          contractId: invocation.contractId,
          method: invocation.method,
          operationType: "claim_submission",
          researcherCommitment: invocation.researcherCommitment,
          status: ChainTransactionStatus.CONFIRMED,
          feeCharged: invocation.feeCharged,
          confirmedAt: invocation.createdAt ?? new Date(),
          rawResponseDigest: this.stellar.rawDigest(invocation),
          idempotencyKey: `reconcile:submit_claim:${normalized}`,
        },
      });

      return { claim, transaction };
    });

    const receipt = await this.receipts.issueIfReady(claim.id);

    return {
      status: "RECONCILED",
      invocation,
      claim,
      transaction,
      receipt,
    };
  }

  async recoverResearcherRegistration(
    address: string,
    researcherCommitment?: string,
    options: RegistrationRecoveryOptions = {},
  ) {
    const recovered = await this.stellar.recoverSubmitClaim(
      address,
      researcherCommitment,
      undefined,
      undefined,
      options,
    );

    if (!recovered) {
      return {
        status: "PROVENANCE_UNAVAILABLE",
        message: "Registry state may exist, but transaction provenance was not recovered.",
      };
    }

    const wallet = await this.prisma.walletAccount.upsert({
      where: { address },
      update: { network: "TESTNET" },
      create: { address, network: "TESTNET" },
    });

    const record = await this.prisma.chainTransaction.upsert({
      where: {
        network_transactionHash: {
          network: "TESTNET",
          transactionHash: recovered.hash,
        },
      },
      update: {
        walletAccountId: wallet.id,
        ledgerNumber: recovered.ledger,
        sourceAccount: recovered.sourceAccount,
        contractId: recovered.contractId,
        method: recovered.method,
        operationType: "claim_submission",
        researcherCommitment: recovered.researcherCommitment,
        status: ChainTransactionStatus.CONFIRMED,
        feeCharged: recovered.feeCharged,
        confirmedAt: recovered.createdAt,
        rawResponseDigest: this.stellar.rawDigest(recovered),
      },
      create: {
        network: "TESTNET",
        transactionHash: recovered.hash,
        walletAccountId: wallet.id,
        ledgerNumber: recovered.ledger,
        sourceAccount: recovered.sourceAccount,
        contractId: recovered.contractId,
        method: recovered.method,
        operationType: "claim_submission",
        researcherCommitment: recovered.researcherCommitment,
        status: ChainTransactionStatus.CONFIRMED,
        feeCharged: recovered.feeCharged,
        confirmedAt: recovered.createdAt,
        rawResponseDigest: this.stellar.rawDigest(recovered),
        idempotencyKey: `recover:submit_claim:${recovered.hash}`,
      },
    });

    return {
      status: "RECOVERED",
      transaction: record,
      researcherCommitment: recovered.researcherCommitment,
      explorer: {
        transaction: recovered.explorerTransactionUrl,
        account: recovered.explorerAccountUrl,
        registry: recovered.explorerRegistryUrl,
        verifier: recovered.explorerVerifierUrl,
      },
    };
  }

  async reconcile(transactionId: string) {
    const txRecord = await this.prisma.chainTransaction.findUnique({
      where: { id: transactionId },
      include: {
        claim: true,
        walletAccount: true,
      },
    });

    if (!txRecord) {
      throw new ApiError("TRANSACTION_NOT_FOUND", "Transaction not found.", 404);
    }

    if (txRecord.status === ChainTransactionStatus.CONFIRMED || txRecord.status === ChainTransactionStatus.FAILED) {
      return txRecord;
    }
    if (txRecord.method !== "submit_claim") {
      throw new ApiError(
        "UNSUPPORTED_TRANSACTION_METHOD",
        "Only submit_claim transactions are reconciled for claim receipts.",
        422,
      );
    }

    const chain = await this.stellar.fetchTransaction(txRecord.transactionHash);
    if (!chain) {
      return this.prisma.chainTransaction.update({
        where: { id: txRecord.id },
        data: { status: ChainTransactionStatus.PENDING },
      });
    }

    if (!chain.successful) {
      return this.prisma.$transaction(async (prisma) => {
        const updated = await prisma.chainTransaction.update({
          where: { id: txRecord.id },
          data: {
            status: ChainTransactionStatus.FAILED,
            failedAt: new Date(),
            rawResponseDigest: this.stellar.rawDigest(chain),
          },
        });

        if (txRecord.claim) {
          assertTransition(txRecord.claim.status, ClaimStatus.TRANSACTION_FAILED);
          await prisma.claim.update({
            where: { id: txRecord.claim.id },
            data: { status: ClaimStatus.TRANSACTION_FAILED },
          });
        }

        return updated;
      });
    }

    if (txRecord.walletAccount && chain.sourceAccount && chain.sourceAccount !== txRecord.walletAccount.address) {
      throw new ApiError("TRANSACTION_SOURCE_MISMATCH", "Confirmed transaction source does not match the claim wallet.", 422);
    }

    return this.prisma.$transaction(async (prisma) => {
      const updated = await prisma.chainTransaction.update({
        where: { id: txRecord.id },
        data: {
          status: ChainTransactionStatus.CONFIRMED,
          ledgerNumber: chain.ledger,
          sourceAccount: chain.sourceAccount ?? txRecord.sourceAccount,
          feeCharged: chain.feeCharged,
          confirmedAt: chain.createdAt ?? new Date(),
          rawResponseDigest: this.stellar.rawDigest(chain),
        },
      });

      if (txRecord.claim) {
        assertTransition(txRecord.claim.status, ClaimStatus.CONFIRMED);
        await prisma.claim.update({
          where: { id: txRecord.claim.id },
          data: { status: ClaimStatus.CONFIRMED },
        });
      }

      return updated;
    }).then(async (updated) => {
      if (updated.claimId) {
        try {
          await this.receipts.issueIfReady(updated.claimId);
        } catch (error) {
          if (!(error instanceof ApiError && error.code === "RECEIPT_NOT_READY")) {
            throw error;
          }
        }
      }
      return updated;
    });
  }
}
