import { Worker, type ConnectionOptions } from "bullmq";

import { loadConfig } from "./config";
import { PrismaService } from "./prisma.service";
import { ReceiptsService } from "./receipts.service";
import { StellarService } from "./stellar.service";
import { TransactionsService } from "./transactions.service";

async function main() {
  const config = loadConfig();
  const connection: ConnectionOptions = {
    url: config.REDIS_URL,
    maxRetriesPerRequest: null,
  };
  const prisma = new PrismaService();
  const stellar = new StellarService(config);
  const receipts = new ReceiptsService(prisma, stellar);
  const transactions = new TransactionsService(prisma, stellar, receipts);

  await prisma.$connect();

  const verificationWorker = new Worker(
    "verification",
    async (job) => {
      if (job.name !== "verify-claim") {
        return;
      }

      const claimId = String(job.data.claimId);
      const verificationJob = await prisma.verificationJob.findFirst({
        where: {
          claimId,
          status: {
            in: ["QUEUED", "RUNNING"],
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
          status: "RUNNING",
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
            status: "FAILED",
            completedAt: new Date(),
            errorCode: "PROOF_ARTIFACT_MISSING",
            sanitizedError: "No proof artifact has been submitted for the claim.",
          },
        });
        return;
      }

      /*
       * The current milestone validates the artifact boundary strictly but does
       * not run server-side UltraHonk verification. Keep cryptographic and
       * Soroban verification pending instead of turning structural validation
       * into a false acceptance.
       */
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
            status: "SUCCEEDED",
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
            status: "AWAITING_WALLET_SIGNATURE",
          },
        });
      });
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

  const reconciliationWorker = new Worker(
    "transaction-reconciliation",
    async (job) => {
      if (job.name !== "reconcile-transaction") {
        return;
      }

      const transactionId = String(job.data.transactionId);
      await transactions.reconcile(transactionId);
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

  const shutdown = async () => {
    await Promise.all([
      verificationWorker.close(),
      reconciliationWorker.close(),
    ]);
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

void main();
