import assert from "node:assert/strict";
import test from "node:test";

import { ClaimStatus } from "@prisma/client";

import { assertTransition } from "./lifecycle";

void test("claim lifecycle allows the expected proof path", () => {
  assert.doesNotThrow(() =>
    assertTransition(ClaimStatus.AWAITING_PROOF, ClaimStatus.PROOF_RECEIVED),
  );
  assert.doesNotThrow(() =>
    assertTransition(ClaimStatus.PROOF_RECEIVED, ClaimStatus.VERIFYING),
  );
  assert.doesNotThrow(() =>
    assertTransition(
      ClaimStatus.VERIFYING,
      ClaimStatus.AWAITING_WALLET_SIGNATURE,
    ),
  );
  assert.doesNotThrow(() =>
    assertTransition(
      ClaimStatus.AWAITING_WALLET_SIGNATURE,
      ClaimStatus.SUBMITTED,
    ),
  );
  assert.doesNotThrow(() =>
    assertTransition(ClaimStatus.SUBMITTED, ClaimStatus.CONFIRMED),
  );
});

void test("claim lifecycle rejects direct confirmation jumps", () => {
  assert.throws(
    () => assertTransition(ClaimStatus.DRAFT, ClaimStatus.CONFIRMED),
    /Cannot transition claim from DRAFT to CONFIRMED/,
  );
  assert.throws(
    () =>
      assertTransition(ClaimStatus.PROOF_RECEIVED, ClaimStatus.RECEIPT_ISSUED),
    /Cannot transition claim from PROOF_RECEIVED to RECEIPT_ISSUED/,
  );
});
