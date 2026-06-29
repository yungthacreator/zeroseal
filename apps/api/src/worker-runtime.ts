import { Logger } from "@nestjs/common";
import {
  ChainTransactionStatus,
  ClaimStatus,
  VerificationJobStatus,
} from "@prisma/client";
import { Queue, Worker, type ConnectionOptions } from "bullmq";

import { TRANSACTION_QUEUE, VERIFICATION_QUEUE } from "./tokens";
import type { PrismaService } from "./prisma.service";
import type { TransactionsService } from "./transactions.service";

type WorkerInstance = {
  close: () => Promise<unknown>;
};

type WorkerConstructor = new (
  name: string,
  processor: (job: { name: string; data: Record<string, unknown> }) => Promise<unknown>,
  options: unknown,
) => WorkerInstance;

type QueueInstance = {
  add: (name: string, data: unknown, options: { jobId: string }) => Promise<unknown>;
  close: () => Promise<unknown>;
};

type QueueConstructor = new (name: string, options: unknown) => QueueInstance;

type RuntimePrisma = Pick<PrismaService, "$transaction"> & {
  verificationJob: PrismaService["verificationJob"];
  proofArtifact: PrismaService["proofArtifact"];
  verificationResult: PrismaService["verificationResult"];
  claim: PrismaService["claim"];
  chainTransaction: PrismaService["chainTransaction"];
};

export type WorkerRuntimeOptions = {
  enabled: boolean;
  redisUrl: string;
  prisma: RuntimePrisma;
  transactions: Pick<TransactionsService, "reconcile">;
  WorkerClass?: WorkerConstructor;
  recoverOnStart?: boolean;
  recoveryRetryMs?: number;
};

export type QueueRecoveryOptions = {
  prisma: Pick<RuntimePrisma, "verificationJob" | "chainTransaction">;
  redisUrl: string;
  QueueClass?: QueueConstructor;
};

const logger = new Logger("ZeroSealWorkerRuntime");

export function verificationQueueJobId(jobId: string): string {
  return `verify-claim:${jobId}`;
}

export function transactionQueueJobId(transactionId: string): string {
  return `reconcile-transaction:${transactionId}`;
}

export async function recoverQueueJobs({
  prisma,
  redisUrl,
  QueueClass = Queue as unknown as QueueConstructor,
}: QueueRecoveryOptions): Promise<{ verification: number; transactions: number }> {
  const connection: ConnectionOptions = {
    url: redisUrl,
    maxRetriesPerRequest: null,
  };
  const verificationQueue = new QueueClass(VERIFICATION_QUEUE, { connection });
  const transactionQueue = new QueueClass(TRANSACTION_QUEUE, { connection });
  const seenVerification = new Set<string>();
  const seenTransactions = new Set<string>();

  try {
    const verificationJobs = await prisma.verificationJob.findMany({
      where: {
        status: {
          in: [VerificationJobStatus.QUEUED, VerificationJobStatus.RUNNING],
        },
        claim: {
          status: {
            in: [ClaimStatus.PROOF_RECEIVED, ClaimStatus.VERIFYING],
          },
        },
      },
      select: {
        id: true,
        claimId: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    for (const job of verificationJobs) {
      if (seenVerification.has(job.id)) {
        continue;
      }
      seenVerification.add(job.id);
      await verificationQueue.add(
        "verify-claim",
        { jobId: job.id, claimId: job.claimId },
        { jobId: verificationQueueJobId(job.id) },
      );
    }

    const transactions = await prisma.chainTransaction.findMany({
      where: {
        status: {
          in: [
            ChainTransactionStatus.SUBMITTED,
            ChainTransactionStatus.PENDING,
            ChainTransactionStatus.UNKNOWN,
          ],
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    for (const transaction of transactions) {
      if (seenTransactions.has(transaction.id)) {
        continue;
      }
      seenTransactions.add(transaction.id);
      await transactionQueue.add(
        "reconcile-transaction",
        { transactionId: transaction.id },
        { jobId: transactionQueueJobId(transaction.id) },
      );
    }

    logger.log(
      `Recovered ${seenVerification.size} verification jobs and ${seenTransactions.size} transaction jobs from PostgreSQL.`,
    );

    return {
      verification: seenVerification.size,
      transactions: seenTransactions.size,
    };
  } finally {
    await Promise.allSettled([verificationQueue.close(), transactionQueue.close()]);
  }
}

export async function startWorkerRuntime({
  enabled,
  redisUrl,
  prisma,
  transactions,
  WorkerClass = Worker as unknown as WorkerConstructor,
  recoverOnStart = true,
  recoveryRetryMs = 60_000,
}: WorkerRuntimeOptions): Promise<{ close: () => Promise<void> }> {
  if (!enabled) {
    logger.log("Embedded worker mode disabled.");
    return {
      close: async () => undefined,
    };
  }

  const connection: ConnectionOptions = {
    url: redisUrl,
    maxRetriesPerRequest: null,
  };

  let recoveryTimer: NodeJS.Timeout | null = null;
  const recover = async () => {
    try {
      await recoverQueueJobs({ prisma, redisUrl });
      if (recoveryTimer) {
        clearInterval(recoveryTimer);
        recoveryTimer = null;
      }
    } catch (error) {
      logger.warn(
        `Queue recovery unavailable: ${
          error instanceof Error ? error.message : "unknown Redis error"
        }`,
      );
      if (!recoveryTimer && recoveryRetryMs > 0) {
        recoveryTimer = setInterval(() => {
          void recover();
        }, recoveryRetryMs);
        recoveryTimer.unref?.();
      }
    }
  };

  if (recoverOnStart) {
    await recover();
  }

  const verificationWorker = new WorkerClass(
    VERIFICATION_QUEUE,
    async (job) => {
      if (job.name !== "verify-claim") {
        return undefined;
      }
      const claimId = String(job.data.claimId);
      await processVerificationJob(prisma, claimId);
      logger.log(`Processed verification job for claim ${claimId}.`);
      return undefined;
    },
    {
      connection,
      concurrency: 1,
      limiter: {
        max: 10,
        duration: 60_000,
      },
    },
  );

  const reconciliationWorker = new WorkerClass(
    TRANSACTION_QUEUE,
    async (job) => {
      if (job.name !== "reconcile-transaction") {
        return undefined;
      }
      const transactionId = String(job.data.transactionId);
      await transactions.reconcile(transactionId);
      logger.log(`Processed transaction reconciliation job ${transactionId}.`);
      return undefined;
    },
    {
      connection,
      concurrency: 2,
      limiter: {
        max: 30,
        duration: 60_000,
      },
    },
  );

  logger.log("Embedded worker mode started.");

  return {
    close: async () => {
      if (recoveryTimer) {
        clearInterval(recoveryTimer);
      }
      await Promise.all([verificationWorker.close(), reconciliationWorker.close()]);
      logger.log("Embedded worker mode stopped.");
    },
  };
}

async function processVerificationJob(
  prisma: RuntimePrisma,
  claimId: string,
): Promise<void> {
  const verificationJob = await prisma.verificationJob.findFirst({
    where: {
      claimId,
      status: {
        in: [VerificationJobStatus.QUEUED, VerificationJobStatus.RUNNING],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!verificationJob) {
    return;
  }

  const startedAt = new Date();
  await prisma.verificationJob.update({
    where: {
      id: verificationJob.id,
    },
    data: {
      status: VerificationJobStatus.RUNNING,
      attemptCount: {
        increment: 1,
      },
      startedAt,
    },
  });

  const proof = await prisma.proofArtifact.findFirst({
    where: {
      claimId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!proof) {
    await prisma.verificationJob.update({
      where: {
        id: verificationJob.id,
      },
      data: {
        status: VerificationJobStatus.FAILED,
        completedAt: new Date(),
        errorCode: "PROOF_ARTIFACT_MISSING",
        sanitizedError: "No proof artifact has been submitted for the claim.",
      },
    });
    return;
  }

  const completedAt = new Date();
  await prisma.$transaction(async (tx) => {
    for (const result of [
      {
        boundary: "CRYPTOGRAPHIC" as const,
        verifierVersion: "adapter.ultrahonk.pending",
      },
      {
        boundary: "SOROBAN" as const,
        verifierVersion: "adapter.soroban.pending",
      },
    ]) {
      await tx.verificationResult.upsert({
        where: {
          claimId_boundary: {
            claimId,
            boundary: result.boundary,
          },
        },
        update: {
          status: "PENDING",
          inputDigest: proof.publicInputDigest,
          outputDigest: proof.artifactDigest,
          verifierVersion: result.verifierVersion,
        },
        create: {
          claimId,
          boundary: result.boundary,
          status: "PENDING",
          inputDigest: proof.publicInputDigest,
          outputDigest: proof.artifactDigest,
          verifierVersion: result.verifierVersion,
        },
      });
    }
    await tx.verificationJob.update({
      where: {
        id: verificationJob.id,
      },
      data: {
        status: VerificationJobStatus.SUCCEEDED,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        verifierVersion: "zeroseal-structural-v1",
        proofArtifactDigest: proof.artifactDigest,
        publicInputDigest: proof.publicInputDigest,
      },
    });
    await tx.claim.update({
      where: {
        id: claimId,
      },
      data: {
        status: ClaimStatus.AWAITING_WALLET_SIGNATURE,
      },
    });
  });
}
