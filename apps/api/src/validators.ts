import { StrKey } from "@stellar/stellar-sdk";
import { createHash } from "node:crypto";
import { z } from "zod";

export const hex64 = z
  .string()
  .transform((value) => value.trim().replace(/^0x/i, "").toLowerCase())
  .pipe(z.string().regex(/^[0-9a-f]{64}$/));

export const stellarPublicKey = z
  .string()
  .trim()
  .refine((value) => StrKey.isValidEd25519PublicKey(value), {
    message: "Must be a valid Stellar public key",
  });

export const stellarContractId = z
  .string()
  .trim()
  .refine((value) => StrKey.isValidContract(value), {
    message: "Must be a valid Stellar contract ID",
  });

export const transactionHash = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{64}$/i)
  .transform((value) => value.toLowerCase());

export const forbiddenPrivateEvidenceFields = [
  "exploitDetails",
  "reproductionSteps",
  "secretKey",
  "seedPhrase",
  "completeWitness",
  "rawEvidence",
  "vulnerabilityFiles",
] as const;

export function rejectPrivateEvidenceFields(value: unknown) {
  if (!value || typeof value !== "object") {
    return;
  }

  const object = value as Record<string, unknown>;
  const present = forbiddenPrivateEvidenceFields.filter(
    (field) => field in object,
  );

  if (present.length > 0) {
    throw new Error(`Private evidence fields are not accepted: ${present.join(", ")}`);
  }
}

export function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function jsonDigest(value: unknown): string {
  return sha256Hex(JSON.stringify(value));
}
