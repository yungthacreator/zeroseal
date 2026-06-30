import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaService } from "./prisma.service";
import { parseOrThrow } from "./common";
import { ContinuationsService, continuationSchema } from "./continuations.service";

const PUBLIC_CONTINUATION = {
  publicPayload: {
    programmeIdentifier: "zeroseal-public-demo",
    policyIdentifier: "security-impact-v1",
  },
  publicClaim: {
    reportingContext: "HackerOne",
    programmeName: "ZeroSeal Test Programme",
    targetType: "Web application",
    targetLocator: "app.example.test",
    affectedComponent: "Authentication",
    findingTitle: "Impact threshold predicate",
    bugCategory: "Access control",
    claimedSeverity: "High",
    impactStatement: "Approved public impact summary only.",
    publicThreshold: "high-impact",
  },
  seal: {
    claimIdentifier: "zs_test_claim",
    researcherFingerprint: "1".repeat(64),
    nullifier: "2".repeat(64),
    canonicalClaimHash: "3".repeat(64),
    privateEvidenceDigest: "4".repeat(64),
  },
};

void test("continuations are persisted and consumed only once without private evidence", async () => {
  let stored: {
    tokenHash: string;
    expiresAt: Date;
    payload: unknown;
    consumedAt: Date | null;
  } | null = null;

  const prisma = {
    continuation: {
      create: ({ data }: { data: typeof stored }) => {
        stored = data;
        return Promise.resolve(data);
      },
      findUnique: () => Promise.resolve(stored),
      updateMany: ({ data }: { data: { consumedAt: Date } }) => {
        stored = stored ? { ...stored, consumedAt: data.consumedAt } : stored;
        return Promise.resolve({ count: stored ? 1 : 0 });
      },
      deleteMany: () => Promise.resolve({ count: 0 }),
    },
  } as unknown as PrismaService;

  const service = new ContinuationsService(prisma);
  const created = await service.create(PUBLIC_CONTINUATION);
  const consumed = await service.consume(created.token);

  assert.equal(consumed.token, created.token);
  assert.equal(consumed.publicClaim.findingTitle, "Impact threshold predicate");
  assert.equal(stored?.consumedAt instanceof Date, true);

  const serialized = JSON.stringify(stored?.payload).toLowerCase();
  assert.equal(serialized.includes("reproductionsteps"), false);
  assert.equal(serialized.includes("proofofconcept"), false);

  await assert.rejects(
    () => service.consume(created.token),
    /Continuation link has already been used/,
  );
});

void test("continuation schema rejects private evidence fields", () => {
  assert.throws(
    () =>
      parseOrThrow(continuationSchema, {
        ...PUBLIC_CONTINUATION,
        publicPayload: {
          ...PUBLIC_CONTINUATION.publicPayload,
          reproductionSteps: "do not send",
        },
      }),
    /Continuation payload cannot include reproductionsteps/,
  );
});
