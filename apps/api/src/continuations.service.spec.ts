import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, parseOrThrow } from "./common";
import {
  ContinuationsService,
  continuationSchema,
  type ContinuationInput,
} from "./continuations.service";

const validContinuation: ContinuationInput = {
  publicPayload: {
    claimIdentifier: "zs_claim_example",
    reportingContext: "Immunefi",
    researcherFingerprint: "aa".repeat(32),
    nullifier: "bb".repeat(32),
    network: "TESTNET",
  },
  publicClaim: {
    reportingContext: "Immunefi",
    programmeName: "Example Vault Programme",
    targetType: "Smart contract",
    targetLocator: "ExampleVault.sol",
    affectedComponent: "withdraw()",
    findingTitle: "Unauthorised withdrawal may exceed the programme threshold",
    bugCategory: "Access control",
    claimedSeverity: "Critical",
    impactStatement: "Public threshold claim only.",
    publicThreshold: "50000",
  },
  seal: {
    claimIdentifier: "zs_claim_example",
    researcherFingerprint: "aa".repeat(32),
    nullifier: "bb".repeat(32),
    canonicalClaimHash: "cc".repeat(32),
    privateEvidenceDigest: "dd".repeat(32),
  },
};

void test("continuation tokens are opaque, single use and public only", () => {
  const service = new ContinuationsService();
  const created = service.create(validContinuation);

  assert.match(created.token, /^[A-Za-z0-9_-]+$/);
  assert.match(created.linkPath, /^\/create\?continue=/);

  const consumed = service.consume(created.token);
  assert.equal(consumed.publicClaim.programmeName, "Example Vault Programme");
  assert.equal(consumed.seal.researcherFingerprint, "aa".repeat(32));

  assert.throws(
    () => service.consume(created.token),
    (error) => error instanceof ApiError && error.code === "CONTINUATION_NOT_FOUND",
  );
});

void test("continuation schema rejects private fields", () => {
  assert.throws(
    () =>
      parseOrThrow(continuationSchema, {
        ...validContinuation,
        publicPayload: {
          ...validContinuation.publicPayload,
          privateEvidence: "do not send",
        },
      }),
    /Continuation payload cannot include privateevidence/,
  );
});
