import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { ApiError } from "./common";
import { sha256Hex } from "./validators";

const EXPECTED_PUBLIC_INPUTS = [
  "program_id",
  "snapshot_id",
  "impact_rule_id",
  "minimum_loss",
  "state_commitment",
  "researcher_commitment",
  "nullifier",
] as const;

const hex = z
  .string()
  .trim()
  .transform((value) => value.replace(/^0x/i, "").toLowerCase())
  .pipe(z.string().regex(/^[0-9a-f]+$/));

const artifactSchema = z.object({
  schema: z.literal("zeroseal.browser-claim.v1"),
  network: z.literal("TESTNET").optional(),
  generated_at: z.string().optional(),
  registry_contract_id: z.string().optional(),
  claim: z.object({
    public_inputs_hex: hex,
    proof_hex: hex,
    public_inputs_bytes: z.number().int().positive(),
    proof_bytes: z.number().int().positive(),
    public_inputs_sha256: z.string().regex(/^[0-9a-f]{64}$/i).optional(),
    proof_sha256: z.string().regex(/^[0-9a-f]{64}$/i).optional(),
  }),
  fields: z.object({
    researcher_commitment: hex,
    nullifier: hex,
  }),
});

export type ValidatedProofArtifact = {
  schemaVersion: "zeroseal.browser-claim.v1";
  proofEncoding: "hex";
  proofByteLength: number;
  publicInputByteLength: number;
  artifactDigest: string;
  proofDigest: string;
  publicInputDigest: string;
  researcherCommitment: string;
  nullifier: string;
  sanitizedMetadata: Record<string, unknown>;
  publicInputs: Array<{
    position: number;
    name: string;
    valueHex: string;
    digest: string;
  }>;
};

@Injectable()
export class ProofService {
  validateArtifact(value: unknown): ValidatedProofArtifact {
    const parsed = artifactSchema.safeParse(value);

    if (!parsed.success) {
      throw new ApiError(
        "PROOF_ARTIFACT_INVALID",
        "Proof artifact schema is not supported.",
        422,
      );
    }

    const artifact = parsed.data;
    const publicInputsHex = artifact.claim.public_inputs_hex;
    const proofHex = artifact.claim.proof_hex;
    const publicInputByteLength = publicInputsHex.length / 2;
    const proofByteLength = proofHex.length / 2;

    if (publicInputByteLength !== EXPECTED_PUBLIC_INPUTS.length * 32) {
      throw new ApiError(
        "PROOF_PUBLIC_INPUTS_UNSUPPORTED",
        "Unsupported public input length.",
        422,
      );
    }

    if (artifact.claim.public_inputs_bytes !== publicInputByteLength) {
      throw new ApiError(
        "PROOF_PUBLIC_INPUT_LENGTH_MISMATCH",
        "Proof artifact public input byte length does not match its payload.",
        422,
      );
    }

    if (artifact.claim.proof_bytes !== proofByteLength) {
      throw new ApiError(
        "PROOF_BYTE_LENGTH_MISMATCH",
        "Proof artifact byte length does not match its payload.",
        422,
      );
    }

    const proofDigest = sha256Hex(Buffer.from(proofHex, "hex"));
    const publicInputDigest = sha256Hex(Buffer.from(publicInputsHex, "hex"));

    if (
      artifact.claim.proof_sha256 &&
      artifact.claim.proof_sha256.toLowerCase() !== proofDigest
    ) {
      throw new ApiError(
        "PROOF_DIGEST_MISMATCH",
        "Proof digest does not match the artifact payload.",
        422,
      );
    }

    if (
      artifact.claim.public_inputs_sha256 &&
      artifact.claim.public_inputs_sha256.toLowerCase() !== publicInputDigest
    ) {
      throw new ApiError(
        "PUBLIC_INPUT_DIGEST_MISMATCH",
        "Public-input digest does not match the artifact payload.",
        422,
      );
    }

    const publicInputs = EXPECTED_PUBLIC_INPUTS.map((name, position) => {
      const valueHex = publicInputsHex.slice(position * 64, (position + 1) * 64);
      return {
        position,
        name,
        valueHex,
        digest: sha256Hex(valueHex),
      };
    });

    const researcherCommitment =
      publicInputs[5]?.valueHex ?? artifact.fields.researcher_commitment;
    const nullifier = publicInputs[6]?.valueHex ?? artifact.fields.nullifier;

    if (artifact.fields.researcher_commitment !== researcherCommitment) {
      throw new ApiError(
        "RESEARCHER_COMMITMENT_MISMATCH",
        "Proof artifact researcher commitment does not match public inputs.",
        422,
      );
    }

    if (artifact.fields.nullifier !== nullifier) {
      throw new ApiError(
        "NULLIFIER_MISMATCH",
        "Proof artifact nullifier does not match public inputs.",
        422,
      );
    }

    return {
      schemaVersion: artifact.schema,
      proofEncoding: "hex",
      proofByteLength,
      publicInputByteLength,
      artifactDigest: sha256Hex(JSON.stringify(value)),
      proofDigest,
      publicInputDigest,
      researcherCommitment,
      nullifier,
      sanitizedMetadata: {
        schema: artifact.schema,
        network: artifact.network ?? "TESTNET",
        generatedAt: artifact.generated_at ?? null,
        registryContractId: artifact.registry_contract_id ?? null,
        expectedPublicInputs: [...EXPECTED_PUBLIC_INPUTS],
      },
      publicInputs,
    };
  }
}
