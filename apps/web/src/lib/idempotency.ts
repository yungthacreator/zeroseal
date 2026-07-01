import { sha256Hex } from "@/lib/claim-flow";

type IdempotencyOperation =
  | "claim_submission"
  | "claim_transaction"
  | "researcher_registration_claim"
  | "researcher_registration_transaction";

const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

export async function createIdempotencyKey(
  operation: IdempotencyOperation,
  identifiers: readonly string[],
): Promise<string> {
  const digest = await sha256Hex([operation, ...identifiers].join("|"));
  const key = `zs:${operation}:${digest}`;

  if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw new Error("Generated idempotency key exceeds 128 characters.");
  }

  return key;
}
