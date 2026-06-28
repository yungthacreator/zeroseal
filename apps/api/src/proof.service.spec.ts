import assert from "node:assert/strict";
import test from "node:test";

import { ProofService } from "./proof.service";

void test("ProofService validates the supported browser claim artifact", async () => {
  const { readFile } = await import("node:fs/promises");
  const { default: path } = await import("node:path");
  const artifactPath = path.resolve(
    process.cwd(),
    "../web/public/zeroseal/browser-claim.json",
  );
  const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as unknown;

  const validated = new ProofService().validateArtifact(artifact);

  assert.equal(validated.schemaVersion, "zeroseal.browser-claim.v1");
  assert.equal(validated.proofEncoding, "hex");
  assert.equal(validated.publicInputByteLength, 224);
  assert.equal(validated.researcherCommitment.length, 64);
  assert.equal(validated.nullifier.length, 64);
  assert.equal(validated.publicInputs.length, 7);
  assert.deepEqual(
    validated.publicInputs.map((input) => input.name),
    [
      "program_id",
      "snapshot_id",
      "impact_rule_id",
      "minimum_loss",
      "state_commitment",
      "researcher_commitment",
      "nullifier",
    ],
  );
});

void test("ProofService rejects artifacts with unsupported public input shape", () => {
  const malformed = {
    schema: "zeroseal.browser-claim.v1",
    claim: {
      public_inputs_hex: `0x${"00".repeat(32)}`,
      proof_hex: `0x${"ab".repeat(64)}`,
      public_inputs_bytes: 32,
      proof_bytes: 64,
    },
    fields: {
      researcher_commitment: `0x${"11".repeat(32)}`,
      nullifier: `0x${"22".repeat(32)}`,
    },
  };

  assert.throws(
    () => new ProofService().validateArtifact(malformed),
    /Unsupported public input length/,
  );
});
