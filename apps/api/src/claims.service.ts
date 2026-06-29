import { Inject, Injectable } from "@nestjs/common";
import {
  ChainTransactionStatus,
  ClaimStatus,
  Prisma,
  VerificationBoundary,
  VerificationJobStatus,
  VerificationResultStatus,
} from "@prisma/client";
import type { ApiConfig } from "./config";
import { CONFIG, TRANSACTION_QUEUE, VERIFICATION_QUEUE } from "./tokens";
import { PrismaService } from "./prisma.service";
import { ApiError } from "./common";
import { assertTransition } from "./lifecycle";
import { sha256Hex } from "./validators";
import { ProgrammesService } from "./programmes.service";
import { ProofService } from "./proof.service";
import {
  AttachEvidenceInput,
  RecordTransactionInput,
  CreateClaimInput,
} from "./claims.schemas";
import { Queue, type ConnectionOptions } from "bullmq";
import {
  transactionQueueJobId,
  verificationQueueJobId,
} from "./worker-runtime";

@Injectable()
export class ClaimsService {
  private readonly verificationQueue: Queue;
  private readonly transactionQueue: Queue;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ProgrammesService)
    private readonly programmes: ProgrammesService,
    @Inject(ProofService)
    private readonly proofService: ProofService,
    @Inject(CONFIG) private readonly config: ApiConfig,
  ) {
    const connection: ConnectionOptions = {
      url: config.REDIS_URL,
      maxRetriesPerRequest: null,
    };
    this.verificationQueue = new Queue(VERIFICATION_QUEUE, { connection });
    this.transactionQueue = new Queue(TRANSACTION_QUEUE, { connection });
  }

  async createClaim(input: CreateClaimInput) {
    const policy = await this.programmes.getSecurityPolicy();

    if (
      input.programmeIdentifier !== policy.programme.identifier ||
      input.policyIdentifier !== policy.identifier ||
      input.circuitId !== policy.circuitId
    ) {
      throw new ApiError("UNSUPPORTED_CLAIM_POLICY", "Unsupported programme, policy or circuit.", 422);
    }

    const snapshot = await this.prisma.programmeSnapshot.findFirst({
      where: {
        programmeId: policy.programmeId,
        identifier: input.snapshotIdentifier,
      },
    });

    if (!snapshot) {
      throw new ApiError("UNKNOWN_SNAPSHOT", "Programme snapshot is not recognised.", 404);
    }

    const now = new Date();
    if (snapshot.expiresAt && snapshot.expiresAt < now) {
      throw new ApiError("EXPIRED_SNAPSHOT", "Programme snapshot is expired.", 422);
    }

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.walletAccount.upsert({
        where: { address: input.walletAddress },
        update: { network: this.config.STELLAR_NETWORK },
        create: {
          address: input.walletAddress,
          network: this.config.STELLAR_NETWORK,
        },
      });

      const existing = await tx.claim.findUnique({
        where: {
          walletAccountId_idempotencyKey: {
            walletAccountId: wallet.id,
            idempotencyKey: input.idempotencyKey,
          },
        },
        include: { publicInputs: true, receipt: true },
      });

      if (existing) {
        return existing;
      }

      let evidenceCommitmentId: string | undefined;
      if (input.evidenceCommitment) {
        const evidence = await tx.evidenceCommitment.upsert({
          where: {
            network_commitment: {
              network: this.config.STELLAR_NETWORK,
              commitment: input.evidenceCommitment,
            },
          },
          update: {},
          create: {
            network: this.config.STELLAR_NETWORK,
            commitment: input.evidenceCommitment,
            manifestDigest: input.evidenceCommitment,
            fileCount: 0,
            metadata: {
              note: "local integrity manifest only; not bound by current circuit",
            },
            circuitBound: false,
          },
        });
        evidenceCommitmentId = evidence.id;
      }

      const claim = await tx.claim.create({
        data: {
          status: ClaimStatus.AWAITING_PROOF,
          idempotencyKey: input.idempotencyKey,
          network: this.config.STELLAR_NETWORK,
          programmeId: policy.programmeId,
          programmeSnapshotId: snapshot.id,
          impactPolicyId: policy.id,
          walletAccountId: wallet.id,
          circuitId: policy.circuitId,
          researcherCommitment: input.researcherCommitment ?? null,
          nullifier: input.nullifier,
          evidenceCommitmentId,
          evidenceBindingStatus: evidenceCommitmentId
            ? "ATTACHED_TO_CLAIM"
            : "LOCAL_ONLY",
          publicInputs: {
            create: input.publicInputs.map((item) => ({
              position: item.position,
              name: item.name,
              valueHex: item.valueHex,
              digest: sha256Hex(item.valueHex),
            })),
          },
        },
        include: { publicInputs: true, receipt: true },
      });

      await tx.programmeSnapshot.update({
        where: { id: snapshot.id },
        data: { immutableAt: snapshot.immutableAt ?? now },
      });

      return claim;
    });
  }

  async getClaim(claimId: string) {
    const claim = await this.prisma.claim.findUnique({
      where: { id: claimId },
      include: {
        programme: true,
        programmeSnapshot: true,
        impactPolicy: true,
        walletAccount: true,
        publicInputs: { orderBy: { position: "asc" } },
        proofArtifacts: { orderBy: { createdAt: "desc" } },
        verificationJobs: { orderBy: { createdAt: "desc" } },
        verificationResults: true,
        transactions: { orderBy: { createdAt: "desc" } },
        receipt: true,
      },
    });

    if (!claim) {
      throw new ApiError("CLAIM_NOT_FOUND", "Claim not found.", 404);
    }

    return claim;
  }

  async getStatus(claimId: string) {
    const claim = await this.getClaim(claimId);
    return {
      claimId: claim.id,
      status: claim.status,
      evidenceBindingStatus: claim.evidenceBindingStatus,
      lifecycleError: claim.currentLifecycleError,
      latestTransaction: claim.transactions[0] ?? null,
      receipt: claim.receipt ?? null,
    };
  }

  async attachEvidence(claimId: string, input: AttachEvidenceInput) {
    const claim = await this.getClaim(claimId);

    if (
      claim.status !== ClaimStatus.AWAITING_PROOF &&
      claim.status !== ClaimStatus.PROOF_RECEIVED
    ) {
      throw new ApiError(
        "CLAIM_EVIDENCE_LOCKED",
        "Evidence commitments can only be attached before verification.",
        409,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const evidence = await tx.evidenceCommitment.upsert({
        where: {
          network_commitment: {
            network: this.config.STELLAR_NETWORK,
            commitment: input.evidenceCommitment,
          },
        },
        update: {
          manifestDigest: input.manifestDigest,
          fileCount: input.fileCount,
          metadata: {
            canonicalisationVersion: input.canonicalisationVersion,
            totalBytes: input.totalBytes,
            contentTypes: input.contentTypes,
          },
          circuitBound: false,
        },
        create: {
          network: this.config.STELLAR_NETWORK,
          commitment: input.evidenceCommitment,
          manifestDigest: input.manifestDigest,
          fileCount: input.fileCount,
          metadata: {
            canonicalisationVersion: input.canonicalisationVersion,
            totalBytes: input.totalBytes,
            contentTypes: input.contentTypes,
          },
          circuitBound: false,
        },
      });

      await tx.claim.update({
        where: { id: claimId },
        data: {
          evidenceCommitmentId: evidence.id,
          evidenceBindingStatus:
            claim.status === ClaimStatus.PROOF_RECEIVED
              ? "CIRCUIT_UNSUPPORTED"
              : "ATTACHED_TO_CLAIM",
        },
      });

      return evidence;
    });
  }

  async submitProof(claimId: string, artifactInput: unknown) {
    const claim = await this.getClaim(claimId);
    const artifact = this.proofService.validateArtifact(artifactInput);

    if (claim.status !== ClaimStatus.AWAITING_PROOF) {
      assertTransition(claim.status, ClaimStatus.PROOF_RECEIVED);
    }

    if (
      claim.researcherCommitment &&
      artifact.researcherCommitment !== claim.researcherCommitment
    ) {
      throw new ApiError("RESEARCHER_COMMITMENT_MISMATCH", "Proof artifact commitment does not match the claim.", 422);
    }

    return this.prisma.$transaction(async (tx) => {
      const proof = await tx.proofArtifact.upsert({
        where: {
          claimId_artifactDigest: {
            claimId,
            artifactDigest: artifact.artifactDigest,
          },
        },
        update: {},
        create: {
          claimId,
          schemaVersion: artifact.schemaVersion,
          proofEncoding: artifact.proofEncoding,
          proofByteLength: artifact.proofByteLength,
          publicInputByteLength: artifact.publicInputByteLength,
          artifactDigest: artifact.artifactDigest,
          proofDigest: artifact.proofDigest,
          publicInputDigest: artifact.publicInputDigest,
          sanitizedMetadata:
            artifact.sanitizedMetadata as Prisma.InputJsonValue,
        },
      });

      await tx.claimPublicInput.deleteMany({ where: { claimId } });
      await tx.claimPublicInput.createMany({
        data: artifact.publicInputs.map((input) => ({
          claimId,
          position: input.position,
          name: input.name,
          valueHex: input.valueHex,
          digest: input.digest,
        })),
      });

      await tx.claim.update({
        where: { id: claimId },
        data: {
          status: ClaimStatus.PROOF_RECEIVED,
          researcherCommitment: artifact.researcherCommitment,
          nullifier: artifact.nullifier,
          evidenceBindingStatus: claim.evidenceCommitmentId
            ? "CIRCUIT_UNSUPPORTED"
            : "LOCAL_ONLY",
        },
      });

      await tx.verificationResult.upsert({
        where: {
          claimId_boundary: {
            claimId,
            boundary: VerificationBoundary.STRUCTURAL,
          },
        },
        update: {
          status: VerificationResultStatus.PASSED,
          inputDigest: artifact.publicInputDigest,
          outputDigest: artifact.artifactDigest,
        },
        create: {
          claimId,
          boundary: VerificationBoundary.STRUCTURAL,
          status: VerificationResultStatus.PASSED,
          inputDigest: artifact.publicInputDigest,
          outputDigest: artifact.artifactDigest,
        },
      });

      return proof;
    });
  }

  async requestVerification(claimId: string) {
    const claim = await this.getClaim(claimId);
    assertTransition(claim.status, ClaimStatus.VERIFYING);

    const latestProof = claim.proofArtifacts[0];
    if (!latestProof) {
      throw new ApiError("PROOF_REQUIRED", "A proof artifact must be submitted before verification.", 409);
    }

    const job = await this.prisma.$transaction(async (tx) => {
      await tx.claim.update({
        where: { id: claimId },
        data: { status: ClaimStatus.VERIFYING },
      });

      return tx.verificationJob.create({
        data: {
          claimId,
          proofArtifactId: latestProof.id,
          status: VerificationJobStatus.QUEUED,
          proofArtifactDigest: latestProof.artifactDigest,
          publicInputDigest: latestProof.publicInputDigest,
        },
      });
    });

    await this.verificationQueue.add(
      "verify-claim",
      { jobId: job.id, claimId },
      { jobId: verificationQueueJobId(job.id) },
    );
    return job;
  }

  async recordTransaction(claimId: string, input: RecordTransactionInput) {
    const claim = await this.getClaim(claimId);
    const wallet = claim.walletAccount;

    if (wallet.address !== input.walletAddress) {
      throw new ApiError("WALLET_MISMATCH", "Transaction wallet does not match the claim wallet.", 422);
    }

    const recordableStatuses: ClaimStatus[] = [
      ClaimStatus.VERIFIED,
      ClaimStatus.AWAITING_WALLET_SIGNATURE,
      ClaimStatus.SUBMITTED,
    ];
    const isRegistrationTransaction = input.method === "register_researcher";
    const registrationStatuses: ClaimStatus[] = [
      ClaimStatus.AWAITING_PROOF,
      ClaimStatus.PROOF_RECEIVED,
      ClaimStatus.VERIFYING,
      ClaimStatus.AWAITING_WALLET_SIGNATURE,
      ClaimStatus.SUBMITTED,
    ];

    if (isRegistrationTransaction) {
      if (!input.researcherCommitment) {
        throw new ApiError(
          "RESEARCHER_COMMITMENT_REQUIRED",
          "Registration transactions must include the researcher commitment from the proof artifact.",
          422,
        );
      }

      if (
        claim.researcherCommitment &&
        input.researcherCommitment !== claim.researcherCommitment
      ) {
        throw new ApiError(
          "RESEARCHER_COMMITMENT_MISMATCH",
          "Registration transaction commitment does not match the active claim.",
          422,
        );
      }
    }

    if (
      !recordableStatuses.includes(claim.status) &&
      !(isRegistrationTransaction && registrationStatuses.includes(claim.status))
    ) {
      throw new ApiError("CLAIM_NOT_READY_FOR_TRANSACTION", "Claim is not ready for transaction recording.", 409);
    }

    const txRecord = await this.prisma.$transaction(async (tx) => {
      const record = await tx.chainTransaction.upsert({
        where: {
          network_transactionHash: {
            network: input.network,
            transactionHash: input.transactionHash,
          },
        },
        update: {
          claimId,
          walletAccountId: wallet.id,
          contractId: input.contractId,
          method: input.method,
          operationType: input.operationType,
          researcherCommitment: isRegistrationTransaction
            ? input.researcherCommitment
            : undefined,
        },
        create: {
          network: input.network,
          transactionHash: input.transactionHash,
          claimId,
          walletAccountId: wallet.id,
          sourceAccount: input.walletAddress,
          contractId: input.contractId,
          method: input.method,
          operationType: input.operationType,
          researcherCommitment: isRegistrationTransaction
            ? input.researcherCommitment
            : undefined,
          idempotencyKey: input.idempotencyKey,
          status: ChainTransactionStatus.SUBMITTED,
        },
      });

      if (!isRegistrationTransaction && claim.status !== ClaimStatus.SUBMITTED) {
        await tx.claim.update({
          where: { id: claimId },
          data: { status: ClaimStatus.SUBMITTED },
        });
      }

      return record;
    });

    await this.transactionQueue.add(
      "reconcile-transaction",
      { transactionId: txRecord.id },
      { jobId: transactionQueueJobId(txRecord.id) },
    );
    return txRecord;
  }

  async claimsForWallet(address: string) {
    return this.prisma.claim.findMany({
      where: { walletAccount: { address } },
      orderBy: { createdAt: "desc" },
      include: {
        transactions: { orderBy: { createdAt: "desc" } },
        receipt: true,
      },
    });
  }
}
