import { z } from "zod";
import {
  hex64,
  rejectPrivateEvidenceFields,
  stellarPublicKey,
  transactionHash,
} from "./validators";
import {
  SECURITY_CIRCUIT_ID,
  SECURITY_POLICY_IDENTIFIER,
  SECURITY_PROGRAMME_IDENTIFIER,
  SECURITY_SNAPSHOT_IDENTIFIER,
} from "./programmes.service";

export const createClaimSchema = z
  .object({
    programmeIdentifier: z
      .string()
      .default(SECURITY_PROGRAMME_IDENTIFIER),
    snapshotIdentifier: z
      .string()
      .default(SECURITY_SNAPSHOT_IDENTIFIER),
    policyIdentifier: z.string().default(SECURITY_POLICY_IDENTIFIER),
    circuitId: z.string().default(SECURITY_CIRCUIT_ID),
    walletAddress: stellarPublicKey,
    researcherCommitment: hex64.optional(),
    nullifier: hex64.optional(),
    evidenceCommitment: hex64.optional(),
    publicInputs: z
      .array(
        z.object({
          position: z.number().int().min(0),
          name: z.string().min(1),
          valueHex: hex64,
        }),
      )
      .default([]),
    idempotencyKey: z.string().min(8).max(128),
  })
  .strict()
  .superRefine((value, context) => {
    try {
      rejectPrivateEvidenceFields(value);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Private evidence is not accepted.",
      });
    }
  });

export const submitProofSchema = z
  .object({
    artifact: z.unknown(),
  })
  .strict();

export const requestVerificationSchema = z.object({}).strict();

export const recordTransactionSchema = z
  .object({
    transactionHash,
    walletAddress: stellarPublicKey,
    network: z.literal("TESTNET").default("TESTNET"),
    contractId: z.string().min(1),
    method: z.string().min(1),
    operationType: z.string().min(1),
    researcherCommitment: hex64.optional(),
    claimCommitment: hex64.optional(),
    nullifier: hex64.optional(),
    idempotencyKey: z.string().min(8).max(128),
  })
  .strict();

export const attachEvidenceSchema = z
  .object({
    evidenceCommitment: hex64,
    manifestDigest: hex64,
    fileCount: z.number().int().min(1).max(500),
    totalBytes: z.number().int().min(0).max(1024 * 1024 * 1024),
    canonicalisationVersion: z
      .string()
      .min(1)
      .max(64)
      .default("zeroseal.evidence-manifest.v1"),
    contentTypes: z.array(z.string().max(128)).max(64).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    try {
      rejectPrivateEvidenceFields(value);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message:
          error instanceof Error
            ? error.message
            : "Private evidence is not accepted.",
      });
    }
  });

export type CreateClaimInput = z.infer<typeof createClaimSchema>;
export type SubmitProofInput = z.infer<typeof submitProofSchema>;
export type RecordTransactionInput = z.infer<typeof recordTransactionSchema>;
export type AttachEvidenceInput = z.infer<typeof attachEvidenceSchema>;
