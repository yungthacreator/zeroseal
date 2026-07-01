import assert from "node:assert/strict";
import test from "node:test";

import { createClaimSchema } from "./claims.schemas";

void test("create claim schema still rejects arbitrary idempotency keys over 128 characters", () => {
  const result = createClaimSchema.safeParse({
    walletAddress: "GBYWCY5VVCF4ZU3LG4OGOGB6OB6RVAXOA5RTW3BAFJO7MQKWWM7M3EHS",
    researcherCommitment:
      "73fea8bfb67ac8c6a2bac808316c2750331983290be5e4e488e62361f8090b3b",
    nullifier:
      "0da1e0e0056857609cc20523e06ceb6a9a76304b6141f9c0c10a23c5bd2cd739",
    publicInputs: [],
    idempotencyKey: "x".repeat(129),
  });

  assert.equal(result.success, false);
  assert.match(
    JSON.stringify(result.error.issues),
    /expected string to have <=128 characters|Too big/i,
  );
});
