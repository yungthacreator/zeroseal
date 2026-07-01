import assert from "node:assert/strict";
import test from "node:test";

import {
  RetryableTransactionReconciliationError,
  recoverQueueJobs,
  startWorkerRuntime,
  transactionQueueJobOptions,
  transactionQueueJobId,
  verificationQueueJobId,
} from "./worker-runtime";
import { TRANSACTION_QUEUE, VERIFICATION_QUEUE } from "./tokens";

void test("queue job ids avoid BullMQ separator characters", () => {
  assert.equal(verificationQueueJobId("verification-job-1").includes(":"), false);
  assert.equal(transactionQueueJobId("tx-1").includes(":"), false);
});

void test("transaction reconciliation jobs use bounded exponential retry options", () => {
  assert.deepEqual(transactionQueueJobOptions("tx-1"), {
    jobId: transactionQueueJobId("tx-1"),
    attempts: 12,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  });
});

void test("worker runtime starts enabled embedded workers on the API queue names", async () => {
  const started: Array<{ name: string }> = [];
  class FakeWorker {
    constructor(name: string) {
      started.push({ name });
    }
    close() {
      return Promise.resolve();
    }
  }

  const runtime = await startWorkerRuntime({
    enabled: true,
    redisUrl: "redis://127.0.0.1:6379",
    prisma: fakePrisma(),
    transactions: { reconcile: async () => undefined },
    WorkerClass: FakeWorker,
    recoverOnStart: false,
  });

  assert.deepEqual(
    started.map((item) => item.name),
    [VERIFICATION_QUEUE, TRANSACTION_QUEUE],
  );
  await runtime.close();
});

void test("worker runtime disabled mode does not start workers", async () => {
  const started: string[] = [];
  class FakeWorker {
    constructor(name: string) {
      started.push(name);
    }
    close() {
      return Promise.resolve();
    }
  }

  const runtime = await startWorkerRuntime({
    enabled: false,
    redisUrl: "redis://127.0.0.1:6379",
    prisma: fakePrisma(),
    transactions: { reconcile: async () => undefined },
    WorkerClass: FakeWorker,
  });

  assert.deepEqual(started, []);
  await runtime.close();
});

void test("worker runtime closes all workers gracefully", async () => {
  let closed = 0;
  class FakeWorker {
    close() {
      closed += 1;
      return Promise.resolve();
    }
  }

  const runtime = await startWorkerRuntime({
    enabled: true,
    redisUrl: "redis://127.0.0.1:6379",
    prisma: fakePrisma(),
    transactions: { reconcile: async () => undefined },
    WorkerClass: FakeWorker,
    recoverOnStart: false,
  });

  await runtime.close();

  assert.equal(closed, 2);
});

void test("queue recovery requeues only persisted non-terminal work with deterministic IDs", async () => {
  const added: Array<{ queue: string; name: string; data: unknown; options: unknown }> = [];
  class FakeQueue {
    constructor(private readonly queue: string) {}
    add(name: string, data: unknown, options: { jobId?: string }) {
      added.push({ queue: this.queue, name, data, options });
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
  }

  await recoverQueueJobs({
    prisma: fakePrisma({
      verificationJobs: [
        { id: "verification-job-1", claimId: "claim-1" },
        { id: "verification-job-1", claimId: "claim-1" },
      ],
      transactions: [{ id: "tx-1" }],
    }),
    redisUrl: "redis://127.0.0.1:6379",
    QueueClass: FakeQueue,
  });

  assert.deepEqual(added, [
    {
      queue: VERIFICATION_QUEUE,
      name: "verify-claim",
      data: { jobId: "verification-job-1", claimId: "claim-1" },
      options: { jobId: verificationQueueJobId("verification-job-1") },
    },
    {
      queue: TRANSACTION_QUEUE,
      name: "reconcile-transaction",
      data: { transactionId: "tx-1" },
      options: transactionQueueJobOptions("tx-1"),
    },
  ]);
});

void test("queue recovery surfaces Redis failures without changing persisted state", async () => {
  class FailingQueue {
    add() {
      return Promise.reject(new Error("redis unavailable"));
    }
    close() {
      return Promise.resolve();
    }
  }

  await assert.rejects(
    () =>
      recoverQueueJobs({
        prisma: fakePrisma({
          verificationJobs: [{ id: "verification-job-1", claimId: "claim-1" }],
        }),
        redisUrl: "redis://127.0.0.1:6379",
        QueueClass: FailingQueue,
      }),
    /redis unavailable/,
  );
});

void test("worker retries PENDING transaction reconciliation", async () => {
  const processors: Record<string, (job: { name: string; data: Record<string, unknown> }) => Promise<unknown>> = {};
  class FakeWorker {
    constructor(
      name: string,
      processor: (job: { name: string; data: Record<string, unknown> }) => Promise<unknown>,
    ) {
      processors[name] = processor;
    }
    close() {
      return Promise.resolve();
    }
  }

  const runtime = await startWorkerRuntime({
    enabled: true,
    redisUrl: "redis://127.0.0.1:6379",
    prisma: fakePrisma(),
    transactions: { reconcile: async () => ({ status: "PENDING" }) },
    WorkerClass: FakeWorker,
    recoverOnStart: false,
  });

  await assert.rejects(
    () =>
      processors[TRANSACTION_QUEUE]({
        name: "reconcile-transaction",
        data: { transactionId: "tx-1" },
      }),
    RetryableTransactionReconciliationError,
  );

  await runtime.close();
});

void test("worker stops retrying CONFIRMED transaction reconciliation", async () => {
  const processors: Record<string, (job: { name: string; data: Record<string, unknown> }) => Promise<unknown>> = {};
  class FakeWorker {
    constructor(
      name: string,
      processor: (job: { name: string; data: Record<string, unknown> }) => Promise<unknown>,
    ) {
      processors[name] = processor;
    }
    close() {
      return Promise.resolve();
    }
  }

  const runtime = await startWorkerRuntime({
    enabled: true,
    redisUrl: "redis://127.0.0.1:6379",
    prisma: fakePrisma(),
    transactions: { reconcile: async () => ({ status: "CONFIRMED" }) },
    WorkerClass: FakeWorker,
    recoverOnStart: false,
  });

  await assert.doesNotReject(() =>
    processors[TRANSACTION_QUEUE]({
      name: "reconcile-transaction",
      data: { transactionId: "tx-1" },
    }),
  );

  await runtime.close();
});

void test("worker stops retrying FAILED transaction reconciliation", async () => {
  const processors: Record<string, (job: { name: string; data: Record<string, unknown> }) => Promise<unknown>> = {};
  class FakeWorker {
    constructor(
      name: string,
      processor: (job: { name: string; data: Record<string, unknown> }) => Promise<unknown>,
    ) {
      processors[name] = processor;
    }
    close() {
      return Promise.resolve();
    }
  }

  const runtime = await startWorkerRuntime({
    enabled: true,
    redisUrl: "redis://127.0.0.1:6379",
    prisma: fakePrisma(),
    transactions: { reconcile: async () => ({ status: "FAILED" }) },
    WorkerClass: FakeWorker,
    recoverOnStart: false,
  });

  await assert.doesNotReject(() =>
    processors[TRANSACTION_QUEUE]({
      name: "reconcile-transaction",
      data: { transactionId: "tx-1" },
    }),
  );

  await runtime.close();
});

function fakePrisma(input?: {
  verificationJobs?: Array<{ id: string; claimId: string }>;
  transactions?: Array<{ id: string }>;
}) {
  return {
    verificationJob: {
      findMany: async () => input?.verificationJobs ?? [],
      findFirst: async () => null,
    },
    chainTransaction: {
      findMany: async () => input?.transactions ?? [],
    },
  };
}
