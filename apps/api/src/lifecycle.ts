import { ClaimStatus } from "@prisma/client";
import { ApiError } from "./common";

const allowedTransitions: Record<ClaimStatus, ClaimStatus[]> = {
  DRAFT: ["AWAITING_PROOF", "CANCELLED", "EXPIRED"],
  AWAITING_PROOF: ["PROOF_RECEIVED", "SUBMITTED", "CANCELLED", "EXPIRED"],
  PROOF_RECEIVED: ["VERIFYING", "SUBMITTED", "PROOF_REJECTED", "CANCELLED", "EXPIRED"],
  VERIFYING: [
    "VERIFIED",
    "AWAITING_WALLET_SIGNATURE",
    "SUBMITTED",
    "PROOF_REJECTED",
    "CANCELLED",
    "EXPIRED",
  ],
  VERIFIED: ["AWAITING_WALLET_SIGNATURE", "CANCELLED", "EXPIRED"],
  AWAITING_WALLET_SIGNATURE: ["SUBMITTED", "CANCELLED", "EXPIRED"],
  SUBMITTED: ["CONFIRMED", "TRANSACTION_FAILED"],
  CONFIRMED: ["RECEIPT_ISSUED"],
  RECEIPT_ISSUED: [],
  PROOF_REJECTED: [],
  TRANSACTION_FAILED: [],
  EXPIRED: [],
  CANCELLED: [],
};

export function assertTransition(from: ClaimStatus, to: ClaimStatus) {
  if (!allowedTransitions[from].includes(to)) {
    throw new ApiError(
      "INVALID_LIFECYCLE_TRANSITION",
      `Cannot transition claim from ${from} to ${to}.`,
      409,
    );
  }
}

export { allowedTransitions };
