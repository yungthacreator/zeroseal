import assert from "node:assert/strict";
import test from "node:test";

import { ProofService } from "./proof.service";

void test("public browser claim artifact contains only deadline-safe submit_claim metadata", async () => {
  const { readFile } = await import("node:fs/promises");
  const { default: path } = await import("node:path");
  const artifactPath = path.resolve(
    process.cwd(),
    "../web/public/zeroseal/browser-claim.json",
  );
  const artifactText = await readFile(artifactPath, "utf8");
  const artifact = JSON.parse(artifactText) as {
    schema: string;
    method: string;
    arguments: Record<string, string>;
  };

  assert.equal(artifact.schema, "zeroseal.browser-claim.v2");
  assert.equal(artifact.method, "submit_claim");
  assert.deepEqual(Object.keys(artifact.arguments).sort(), [
    "claim_commitment",
    "nullifier",
    "researcher",
    "researcher_commitment",
  ]);
  assert.doesNotMatch(artifactText, /proof_hex|proof_bytes|public_inputs_hex|vulnerability description/i);
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
