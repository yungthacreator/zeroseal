import assert from "node:assert/strict";
import test from "node:test";

import {
  rejectPrivateEvidenceFields,
  sha256Hex,
  transactionHash,
} from "./validators";

void test("rejectPrivateEvidenceFields rejects common private evidence names", () => {
  for (const field of [
    "exploitDetails",
    "reproductionSteps",
    "secretKey",
    "seedPhrase",
    "completeWitness",
    "rawEvidence",
    "vulnerabilityFiles",
  ]) {
    assert.throws(
      () => rejectPrivateEvidenceFields({ [field]: "not allowed" }),
      /Private evidence fields are not accepted/,
      field,
    );
  }
});

void test("transactionHash accepts only 64-byte hex strings", () => {
  const valid = "a".repeat(64);
  assert.equal(transactionHash.parse(valid.toUpperCase()), valid);
  assert.throws(() => transactionHash.parse("not-a-hash"));
});

void test("sha256Hex is deterministic", () => {
  assert.equal(
    sha256Hex("zeroseal"),
    "e3807c159904932e1e7529b012a7460421813420b092058fb00ad6b02726743a",
  );
});
