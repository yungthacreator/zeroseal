import assert from "node:assert/strict";
import test from "node:test";

import { sha256Hex } from "./validators";

void test("identifier digests remain separate concepts", () => {
  const researcherCommitment = "04365013fb23d445d933eb47b2491088199eb4a60712bb1673a9d8ee448751d0";
  const evidenceCommitment = "925d2d0000000000000000000000000000000000000000000000000000000000";
  const proofArtifactDigest = sha256Hex("proof-artifact");
  const publicInputDigest = sha256Hex("public-inputs");
  const nullifier = sha256Hex("nullifier");
  const transactionHash = "200414937c44753e24c5d79450ad6eb57e267940def01eab6105246ab39f970b";
  const receiptId = "zs_receipt_identifier";

  assert.notEqual(evidenceCommitment, researcherCommitment);
  assert.notEqual(proofArtifactDigest, evidenceCommitment);
  assert.notEqual(publicInputDigest, proofArtifactDigest);
  assert.notEqual(nullifier, evidenceCommitment);
  assert.notEqual(transactionHash, receiptId);
});

void test("current public claim artifact has only submit_claim commitments", async () => {
  const { readFile } = await import("node:fs/promises");
  const { default: path } = await import("node:path");
  const artifactPath = path.resolve(
    process.cwd(),
    "../web/public/zeroseal/browser-claim.json",
  );
  const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
    arguments: Record<string, string>;
  };
  const names = Object.keys(artifact.arguments);

  assert.deepEqual(names.sort(), [
    "claim_commitment",
    "nullifier",
    "researcher",
    "researcher_commitment",
  ]);
  assert.equal(names.includes("evidence_commitment"), false);
});
