"use client";

import { Buffer } from "buffer";
import { signTransaction as freighterSignTransaction } from "@stellar/freighter-api";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useWallet } from "@/context/wallet-context";
import {
  createBackendContinuation,
  createBackendClaim,
  getApiReadiness,
  getBackendContinuation,
  getBackendClaimReceipt,
  reconcileBackendTransaction,
  recordBackendTransaction,
  ApiRequestError,
  type ApiClaim,
  type ApiReconciliationResponse,
  type ApiReceipt,
  type ContinuationPayload,
  verifyReceiptHref,
} from "@/lib/api/claims";
import {
  buildPublicPayloadAsync,
  createExampleDemoDraft,
  createInitialClaimDraft,
  formatFingerprint,
  generatePrivateSeal,
  nextClaimState,
  resetClaimDraft,
  type ClaimDraft,
  type PublicPayload,
} from "@/lib/claim-flow";
import { persistReceipt } from "@/lib/receipt-store";
import { createIdempotencyKey } from "@/lib/idempotency";
import {
  assertSubmitClaimSignedXdrReady,
  createClaimRegistryClient,
  decodeSubmitClaimArgsFromXdr,
  readClaimRegistryRuntimeConfig,
  resolveOnChainResearcherCommitment,
  type ClaimRegistryClient,
  type SubmitClaimSignedXdrReadiness,
} from "@/lib/stellar/claim-registry-client";
import { submitSignedXdr } from "@/lib/stellar/submit-transaction";
import {
  DEFAULT_REGISTRY_CONTRACT_ID,
  DEFAULT_VERIFIER_CONTRACT_ID,
} from "@/lib/stellar/config";
import { explorerTransactionUrl } from "@/lib/stellar/testnet";

type WizardMode = "create" | "demo";
type PublishState =
  | "idle"
  | "checking_readiness"
  | "preparing"
  | "reviewing"
  | "wallet_retry"
  | "awaiting_wallet"
  | "signed"
  | "submitted"
  | "confirming"
  | "issuing_receipt"
  | "confirmed"
  | "backend_sync_failed"
  | "failed";

type PendingTransaction = {
  claimId: string;
  transactionHash: string;
  ledger: string | null;
  payload?: PublicPayload;
  review: PreparedReview;
};

type PendingReceiptSync = {
  schemaVersion: 1;
  claimId: string;
  transactionHash: string;
  walletAddress: string;
  ledger: string | null;
  contractId: string;
  researcherCommitment: string;
  claimCommitment: string;
  nullifier: string;
};

type PreparedSubmitClaimTransaction = Awaited<ReturnType<ClaimRegistryClient["submit_claim"]>>;
type SdkSignTransaction = NonNullable<
  Parameters<PreparedSubmitClaimTransaction["sign"]>[0]
>["signTransaction"];
type SdkPreparedSubmitClaimSigner = {
  signed?: { toXDR: () => string };
  sign: (options?: { signTransaction?: SdkSignTransaction }) => Promise<void>;
};

type PreparedRegistryAction = {
  claim: ApiClaim;
  payload: PublicPayload;
  review: PreparedReview;
  transaction: PreparedSubmitClaimTransaction;
  networkPassphrase: string;
  rpcUrl: string;
};

export type PreparedReview = {
  wallet: string;
  contractId: string;
  method: "submit_claim";
  researcherCommitment: string;
  claimCommitment: string;
  nullifier: string;
  simulatedFee: string;
  feeStroops: string;
  feeXlm: string;
  signableXdr: string;
};

type ReportStepField =
  | "reportingContext"
  | "programmeName"
  | "affectedComponent"
  | "targetType"
  | "targetLocator";

type ReportStepValues = Pick<
  ClaimDraft,
  ReportStepField
>;

type ReportStepValidation = {
  valid: boolean;
  errors: Partial<Record<ReportStepField, string>>;
};

type FindingStepField =
  | "findingTitle"
  | "bugCategory"
  | "publicThreshold"
  | "claimedSeverity"
  | "impactStatement";

type FindingStepValues = {
  findingTitle: string;
  bugCategory: string;
  publicThreshold: string;
  claimedSeverity: string;
  impactStatement: string;
};

type FindingStepValidation = {
  valid: boolean;
  errors: Partial<Record<FindingStepField, string>>;
};

type PrivateEvidenceStepField =
  | "vulnerabilityDescription"
  | "reproductionSteps"
  | "proofOfConcept"
  | "privateImpactValues";

type PrivateEvidenceStepValues = Pick<
  ClaimDraft["privateEvidence"],
  PrivateEvidenceStepField
>;

type PrivateEvidenceStepValidation = {
  valid: boolean;
  errors: Partial<Record<PrivateEvidenceStepField, string>>;
  publiclyExcludedFields: string[];
};

type PublishActionStateInput = {
  reviewed: boolean;
  hasWallet: boolean;
  walletStatus: string;
  publishState: PublishState;
  hasPreparedTransaction: boolean;
  hasPendingTransaction: boolean;
};

type PublishActionState = {
  disabled: boolean;
  label: string;
  reason: string | null;
};

const STEPS = [
  "Report",
  "Finding",
  "Private evidence",
  "Seal and public claim",
  "Sign and receipt",
] as const;

export const REPORTING_CONTEXTS = [
  { label: "Immunefi", category: "Web3 bug bounty", logo: "/brands/immunefi.svg" },
  { label: "HackerOne", category: "Bug bounty and vulnerability disclosure", logo: "/brands/hackerone.svg" },
  { label: "Bugcrowd", category: "Bug bounty and vulnerability disclosure" },
  { label: "Intigriti", category: "Bug bounty and vulnerability disclosure" },
  { label: "YesWeHack", category: "Bug bounty and vulnerability disclosure" },
  { label: "HackenProof", category: "Bug bounty and Web3 disclosure" },
  { label: "Code4rena", category: "Smart-contract audit competition", logo: "/brands/code4rena.svg" },
  { label: "CodeHawks", category: "Smart-contract audit competition", logo: "/brands/codehawks.svg" },
  { label: "Cantina", category: "Security review and competition", logo: "/brands/cantina.svg" },
  { label: "Sherlock", category: "Smart-contract audit competition" },
  { label: "Hats Finance", category: "Web3 bug bounty" },
  { label: "Direct to project", category: "Private report to the project security team" },
  { label: "Other", category: "Custom disclosure route" },
] as const;

const TARGET_TYPES = [
  "Smart contract",
  "Repository",
  "Web application",
  "API",
  "Mobile application",
] as const;

const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;

function isMobileViewport(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
}

function extractTransactionHash(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const object = value as Record<string, unknown>;
  for (const key of ["hash", "txHash", "transactionHash"]) {
    if (typeof object[key] === "string" && object[key]) {
      return object[key] as string;
    }
  }
  for (const key of ["sendTransactionResponse", "getTransactionResponse", "response"]) {
    const nested = extractTransactionHash(object[key]);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function extractLedger(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const object = value as Record<string, unknown>;
  for (const key of ["ledger", "ledgerSequence", "ledger_attr"]) {
    const ledger = object[key];
    if (typeof ledger === "string" || typeof ledger === "number") {
      return String(ledger);
    }
  }
  for (const key of ["sendTransactionResponse", "getTransactionResponse", "response"]) {
    const nested = extractLedger(object[key]);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function storePublicReceipt(payload: PublicPayload): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    `zeroseal:public-claim:${payload.claimIdentifier}`,
    JSON.stringify(payload),
  );
}

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function isStepComplete(index: number, step: number, draft: ClaimDraft, reviewed: boolean): boolean {
  if (index < step) {
    return true;
  }
  if (index === 3) {
    return Boolean(draft.privateSeal);
  }
  if (index === 4) {
    return reviewed;
  }
  return false;
}

export function publicInputRows(
  seal: NonNullable<ClaimDraft["privateSeal"]>,
  researcherCommitment = seal.researcherFingerprint,
) {
  return [
    {
      position: 0,
      name: "researcher_commitment",
      valueHex: researcherCommitment,
    },
    {
      position: 1,
      name: "claim_commitment",
      valueHex: seal.canonicalClaimHash,
    },
    {
      position: 2,
      name: "nullifier",
      valueHex: seal.nullifier,
    },
  ];
}

const PENDING_RECEIPT_SYNC_STORAGE_KEY = "zeroseal:pending-receipt-sync:v1";
const RECONCILIATION_RETRY_DELAYS_MS = [
  0,
  1500,
  2500,
  4000,
  6000,
  8000,
  8000,
  8000,
  8000,
  8000,
  8000,
] as const;
const RECONCILIATION_MAX_WAIT_MS = 60_000;
const RETRYABLE_RECONCILIATION_CODES = new Set([
  "SUBMIT_CLAIM_NOT_FOUND",
  "TRANSACTION_NOT_FOUND",
]);
const NON_RETRYABLE_RECONCILIATION_CODES = new Set([
  "TRANSACTION_NOT_SUCCESSFUL",
  "TRANSACTION_SOURCE_MISMATCH",
  "REGISTRY_CONTRACT_MISMATCH",
  "CLAIM_WALLET_MISMATCH",
  "RESEARCHER_COMMITMENT_MISMATCH",
  "CLAIM_COMMITMENT_MISMATCH",
  "NULLIFIER_MISMATCH",
]);
const RETRYABLE_TRANSACTION_STATUSES = new Set(["SUBMITTED", "PENDING", "UNKNOWN"]);

function pendingReceiptSyncFromTransaction(
  transaction: PendingTransaction,
  walletAddress: string,
): PendingReceiptSync {
  return {
    schemaVersion: 1,
    claimId: transaction.claimId,
    transactionHash: transaction.transactionHash,
    walletAddress,
    ledger: transaction.ledger,
    contractId: transaction.review.contractId,
    researcherCommitment: transaction.review.researcherCommitment,
    claimCommitment: transaction.review.claimCommitment,
    nullifier: transaction.review.nullifier,
  };
}

function pendingReceiptSyncToTransaction(
  pending: PendingReceiptSync,
): PendingTransaction {
  return {
    claimId: pending.claimId,
    transactionHash: pending.transactionHash,
    ledger: pending.ledger,
    review: {
      wallet: pending.walletAddress,
      contractId: pending.contractId,
      method: "submit_claim",
      researcherCommitment: pending.researcherCommitment,
      claimCommitment: pending.claimCommitment,
      nullifier: pending.nullifier,
      simulatedFee: "",
      feeStroops: "",
      feeXlm: "",
      signableXdr: "",
    },
  };
}

export function readPendingReceiptSync(
  walletAddress?: string | null,
): PendingReceiptSync | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(PENDING_RECEIPT_SYNC_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PendingReceiptSync>;
    if (
      parsed.schemaVersion !== 1 ||
      !parsed.claimId ||
      !parsed.transactionHash ||
      !parsed.walletAddress ||
      !parsed.contractId ||
      !parsed.researcherCommitment ||
      !parsed.claimCommitment ||
      !parsed.nullifier
    ) {
      return null;
    }

    if (walletAddress && parsed.walletAddress !== walletAddress) {
      return null;
    }

    return {
      schemaVersion: 1,
      claimId: parsed.claimId,
      transactionHash: parsed.transactionHash,
      walletAddress: parsed.walletAddress,
      ledger: parsed.ledger ?? null,
      contractId: parsed.contractId,
      researcherCommitment: parsed.researcherCommitment,
      claimCommitment: parsed.claimCommitment,
      nullifier: parsed.nullifier,
    };
  } catch {
    return null;
  }
}

export function writePendingReceiptSync(pending: PendingReceiptSync): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    PENDING_RECEIPT_SYNC_STORAGE_KEY,
    JSON.stringify(pending),
  );
}

export function clearPendingReceiptSync(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(PENDING_RECEIPT_SYNC_STORAGE_KEY);
}

function isRetryableReconciliationStatus(status: string | null | undefined): boolean {
  return Boolean(status && RETRYABLE_TRANSACTION_STATUSES.has(status));
}

function isRetryableReconciliationError(error: unknown): boolean {
  if (error instanceof ApiRequestError) {
    if (NON_RETRYABLE_RECONCILIATION_CODES.has(error.code)) {
      return false;
    }
    return (
      RETRYABLE_RECONCILIATION_CODES.has(error.code) ||
      error.status === 404
    );
  }
  return false;
}

function reconciliationStatus(
  response: ApiReconciliationResponse,
): string | null {
  return response.transaction?.status ?? response.status ?? null;
}

export async function reconcileUntilReceipt({
  transactionHash,
  claimId,
  reconcile = reconcileBackendTransaction,
  getReceipt = getBackendClaimReceipt,
  wait = sleep,
  retryDelays = RECONCILIATION_RETRY_DELAYS_MS,
  maxWaitMs = RECONCILIATION_MAX_WAIT_MS,
}: {
  transactionHash: string;
  claimId: string;
  reconcile?: (transactionHash: string) => Promise<ApiReconciliationResponse>;
  getReceipt?: (claimId: string) => Promise<ApiReceipt>;
  wait?: (ms: number) => Promise<void>;
  retryDelays?: readonly number[];
  maxWaitMs?: number;
}): Promise<ApiReceipt> {
  let elapsedMs = 0;

  for (let attempt = 0; attempt < retryDelays.length && elapsedMs <= maxWaitMs; attempt += 1) {
    const delay = retryDelays[attempt] ?? retryDelays[retryDelays.length - 1] ?? 0;
    if (delay > 0) {
      await wait(delay);
      elapsedMs += delay;
    }

    try {
      const response = await reconcile(transactionHash);
      if (response.receipt) {
        return response.receipt;
      }

      const status = reconciliationStatus(response);
      if (status === "FAILED") {
        throw new Error("Stellar Testnet reported the transaction as failed. No receipt was issued.");
      }

      try {
        return await getReceipt(claimId);
      } catch (receiptError) {
        if (!isRetryableReconciliationError(receiptError)) {
          throw receiptError;
        }
      }

      if (
        !isRetryableReconciliationStatus(status) &&
        status !== "RECONCILED" &&
        status !== "CONFIRMED"
      ) {
        continue;
      }
    } catch (error) {
      if (!isRetryableReconciliationError(error)) {
        throw error;
      }
    }
  }

  throw new Error("The Stellar transaction is preserved. Receipt finalisation is delayed.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function publishButtonLabel(
  state: PublishState,
  address: string | null,
  walletStatus: string,
): string {
  if (!address) {
    if (walletStatus === "wrong_network") {
      return "Switch to Testnet";
    }
    return "Connect wallet";
  }

  switch (state) {
    case "checking_readiness":
      return "Checking backend";
    case "preparing":
      return "Preparing your stamp";
    case "reviewing":
      return "Approve stamp in Freighter";
    case "wallet_retry":
      return "Retry wallet approval";
    case "awaiting_wallet":
      return "Waiting for wallet approval";
    case "signed":
      return "Stamp signed";
    case "submitted":
      return "Stamp submitted";
    case "confirming":
      return "Waiting for Stellar confirmation";
    case "issuing_receipt":
      return "Issuing receipt";
    case "confirmed":
      return "Stamp confirmed";
    case "backend_sync_failed":
      return "Retry backend sync";
    case "failed":
      return "Retry Testnet action";
    case "idle":
      return "Prepare stamp";
  }
}

export function getPublishActionState(
  input: PublishActionStateInput,
): PublishActionState {
  const label = publishButtonLabel(
    input.publishState,
    input.hasWallet ? "connected" : null,
    input.walletStatus,
  );

  if (!input.reviewed) {
    return {
      disabled: true,
      label,
      reason: "Review and approve the public claim first.",
    };
  }

  if (!input.hasWallet) {
    return {
      disabled: false,
      label,
      reason: "Connect a wallet first.",
    };
  }

  if (input.walletStatus === "wrong_network") {
    return {
      disabled: false,
      label,
      reason: "Switch Freighter to Testnet.",
    };
  }

  if (input.publishState === "reviewing" || input.publishState === "wallet_retry") {
    if (!input.hasPreparedTransaction) {
      return {
        disabled: true,
        label,
        reason: "Signable XDR is unavailable. Prepare the stamp again.",
      };
    }

    return {
      disabled: false,
      label,
      reason: null,
    };
  }

  if (input.publishState === "backend_sync_failed") {
    return {
      disabled: !input.hasPendingTransaction,
      label,
      reason: input.hasPendingTransaction
        ? "Retry backend sync with the preserved transaction hash."
        : "Transaction hash is unavailable. Prepare the stamp again.",
    };
  }

  if (
    input.publishState === "checking_readiness" ||
    input.publishState === "preparing"
  ) {
    return {
      disabled: true,
      label,
      reason: "Preparing your stamp.",
    };
  }

  if (input.publishState === "awaiting_wallet") {
    return {
      disabled: true,
      label,
      reason: "Waiting for wallet approval.",
    };
  }

  if (input.publishState === "submitted") {
    return {
      disabled: true,
      label,
      reason: "Stamping transaction.",
    };
  }

  if (input.publishState === "confirming") {
    return {
      disabled: true,
      label,
      reason: "Waiting for Stellar confirmation.",
    };
  }

  if (input.publishState === "issuing_receipt") {
    return {
      disabled: true,
      label,
      reason: "Synchronising receipt.",
    };
  }

  if (input.publishState === "confirmed") {
    return {
      disabled: true,
      label,
      reason: "Receipt issued.",
    };
  }

  return {
    disabled: false,
    label,
    reason: null,
  };
}

export function clearWalletScopedDraftState(draft: ClaimDraft): ClaimDraft {
  return {
    ...draft,
    state: "DRAFT",
    researcherFingerprint: null,
    privateSeal: null,
    receipt: null,
  };
}

export function shouldClearWalletScopedState(
  previousWallet: string | null,
  nextWallet: string | null,
): boolean {
  return Boolean(previousWallet) && previousWallet !== nextWallet;
}

export function clearedWalletRuntimeState() {
  return {
    reviewed: false,
    publishState: "idle" as PublishState,
    publicPayload: null as PublicPayload | null,
    pendingTransaction: null as PendingTransaction | null,
    backendReceipt: null as ApiReceipt | null,
    preparedReview: null as PreparedReview | null,
    hasPreparedTransaction: false,
    technicalError: null as string | null,
    continuationLinkPath: null as string | null,
  };
}

export function desktopContinuationUrl(path: string, origin?: string): string {
  const configuredOrigin = process.env.NEXT_PUBLIC_ZEROSEAL_PUBLIC_URL?.replace(/\/$/, "");
  const runtimeOrigin = origin?.replace(/\/$/, "") ?? "";
  const publicOrigin =
    configuredOrigin ||
    (
      runtimeOrigin.includes("localhost") || runtimeOrigin.includes("127.0.0.1")
        ? ""
        : runtimeOrigin
    );
  return `${publicOrigin}${path}`;
}

function errorMessage(error: unknown): string {
  return (
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : ""
  );
}

export function signedTransactionMessage(error: unknown): string {
  const message = errorMessage(error);
  const normalized = message.toLowerCase();

  if (normalized.includes("freighter did not respond")) {
    return "Freighter did not respond. Open and unlock Freighter, confirm Testnet, then retry wallet approval.";
  }

  if (
    normalized.includes("freighter approval was rejected") ||
    normalized.includes("user rejected") ||
    normalized.includes("user declined") ||
    normalized.includes("user denied") ||
    normalized.includes("user cancelled") ||
    normalized.includes("user canceled") ||
    normalized.includes("request rejected by user") ||
    normalized.includes("request denied by user")
  ) {
    return "Freighter approval was rejected. The claim is preserved and no transaction was submitted.";
  }

  if (
    normalized.includes("stellar rejected the transaction before confirmation") ||
    normalized.includes("stellar transaction submission failed")
  ) {
    return "Wallet approval succeeded, but Stellar submission failed. No receipt was created. Open Technical details for the RPC response.";
  }

  if (
    normalized.includes("stellar testnet rejected transaction") ||
    normalized.includes("stellar testnet transaction failed")
  ) {
    return "Wallet approval succeeded, but Stellar confirmed that the transaction failed. No receipt was created. Open Technical details.";
  }

  if (
    normalized.includes("stellar did not confirm transaction") ||
    normalized.includes("stellar rpc did not confirm")
  ) {
    return "The transaction was signed, but Stellar confirmation could not be completed. No receipt was created. Open Technical details before retrying.";
  }

  if (
    normalized.includes("researchercommitmentmismatch") ||
    normalized.includes("error(contract, #2)") ||
    normalized.includes("error(contract, 2)") ||
    normalized.includes("contract error #2") ||
    normalized.includes("contract error 2") ||
    normalized.includes("contract, #2") ||
    normalized.includes("contract, 2")
  ) {
    return "Claim Registry identity mismatch. ZeroSeal could not reuse the researcher commitment already registered for this wallet.";
  }

  if (normalized.includes("hosterror") || normalized.includes("host error")) {
    return "Stamp preparation failed.";
  }

  return message || "Stamp preparation failed.";
}

function simulatedFee(transaction: { built?: { fee?: string }; raw?: { baseFee?: string } }): string {
  return transaction.built?.fee ?? transaction.raw?.baseFee ?? "Unavailable";
}

export function feeDisplayFromXdr(
  signableXdr: string,
  networkPassphrase: string,
): { stroops: string; xlm: string } {
  const transaction = TransactionBuilder.fromXDR(signableXdr, networkPassphrase);
  const stroops = BigInt(transaction.fee);
  const stroopsPerXlm = BigInt(10_000_000);
  const whole = stroops / stroopsPerXlm;
  const fraction = (stroops % stroopsPerXlm).toString().padStart(7, "0");
  return {
    stroops: stroops.toString(),
    xlm: `${whole}.${fraction}`,
  };
}

type FreighterSignResult = {
  signedTxXdr: string;
  signerAddress: string;
  error?: { message?: string; code?: number };
};

export async function signPreparedXdr({
  signableXdr,
  walletAddress,
  networkPassphrase,
  signTransaction = freighterSignTransaction,
}: {
  signableXdr: string;
  walletAddress: string;
  networkPassphrase: string;
  signTransaction?: (
    transactionXdr: string,
    opts?: { networkPassphrase?: string; address?: string },
  ) => Promise<FreighterSignResult>;
}): Promise<{ signedTxXdr: string; signerAddress: string }> {
  const response = await signTransaction(signableXdr, {
    networkPassphrase,
    address: walletAddress,
  });

  if (response.error) {
    throw new Error(walletApprovalFailureMessage(response.error.message ?? ""));
  }

  if (!response.signedTxXdr) {
    throw new Error("Freighter did not return a signed transaction.");
  }

  if (response.signerAddress && response.signerAddress !== walletAddress) {
    throw new Error("Freighter signed with a different wallet.");
  }

  return {
    signedTxXdr: response.signedTxXdr,
    signerAddress: response.signerAddress,
  };
}

export async function signSdkPreparedSubmitClaim({
  transaction,
  review,
  networkPassphrase,
  signTransaction = freighterSignTransaction,
}: {
  transaction: SdkPreparedSubmitClaimSigner;
  review: PreparedReview;
  networkPassphrase: string;
  signTransaction?: SdkSignTransaction;
}): Promise<{
  signedTxXdr: string;
  readiness: SubmitClaimSignedXdrReadiness;
}> {
  try {
    await transaction.sign({ signTransaction });
  } catch (error) {
    throw new Error(walletApprovalFailureMessage(errorMessage(error)));
  }

  const signedTxXdr = transaction.signed?.toXDR();
  if (!signedTxXdr) {
    throw new Error("Freighter did not return a signed transaction.");
  }

  const readiness = assertSubmitClaimSignedXdrReady({
    signedXdr: signedTxXdr,
    networkPassphrase,
    expected: {
      contractId: review.contractId,
      researcher: review.wallet,
      researcherCommitment: review.researcherCommitment,
      claimCommitment: review.claimCommitment,
      nullifier: review.nullifier,
    },
  });

  return { signedTxXdr, readiness };
}

function walletApprovalFailureMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("timeout") || normalized.includes("transport")) {
    return "Freighter did not respond. Open and unlock Freighter, confirm Testnet, then retry wallet approval.";
  }

  if (
    normalized.includes("user rejected") ||
    normalized.includes("user declined") ||
    normalized.includes("user denied") ||
    normalized.includes("user cancelled") ||
    normalized.includes("user canceled") ||
    normalized.includes("request rejected by user") ||
    normalized.includes("request denied by user")
  ) {
    return "Freighter approval was rejected. The claim is preserved and no transaction was submitted.";
  }

  return message
    ? `Freighter signing failed: ${message}`
    : "Freighter did not return a signed transaction.";
}

function isWalletApprovalFailure(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("freighter did not respond") ||
    message.includes("freighter approval was rejected") ||
    message.includes("user rejected") ||
    message.includes("user declined") ||
    message.includes("user denied") ||
    message.includes("user cancelled") ||
    message.includes("user canceled") ||
    message.includes("request rejected by user") ||
    message.includes("request denied by user") ||
    message.includes("freighter did not return") ||
    message.includes("different wallet")
  );
}


export function validateReportStep(values: ReportStepValues): ReportStepValidation {
  const errors: Partial<Record<ReportStepField, string>> = {};
  const reportingPath = values.reportingContext.trim();
  const programmeName = values.programmeName.trim();
  const targetName = values.affectedComponent.trim();
  const targetType = values.targetType.trim();
  const targetLocator = values.targetLocator.trim();

  if (!REPORTING_CONTEXTS.some((context) => context.label === reportingPath)) {
    errors.reportingContext = "Select a reporting path.";
  }

  if (!programmeName) {
    errors.programmeName = "Enter the programme or project name.";
  }

  if (!targetName) {
    errors.affectedComponent = "Enter the target name.";
  }

  if (!TARGET_TYPES.includes(targetType as (typeof TARGET_TYPES)[number])) {
    errors.targetType = "Select a target type.";
  }

  if (!targetLocator) {
    errors.targetLocator = locatorMessageForTargetType(targetType);
  } else if (!isValidLocatorForTargetType(targetType, targetLocator)) {
    errors.targetLocator = locatorMessageForTargetType(targetType);
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateFindingStep(
  values: FindingStepValues,
): FindingStepValidation {
  const errors: Partial<Record<FindingStepField, string>> = {};

  if (!values.findingTitle.trim()) {
    errors.findingTitle = "Enter a public title.";
  }

  if (!values.bugCategory.trim()) {
    errors.bugCategory = "Enter the vulnerability category.";
  }

  if (!values.publicThreshold.trim()) {
    errors.publicThreshold = "Describe the public impact threshold.";
  }

  if (!SEVERITIES.includes(values.claimedSeverity as (typeof SEVERITIES)[number])) {
    errors.claimedSeverity = "Select a severity.";
  }

  if (!values.impactStatement.trim()) {
    errors.impactStatement = "Enter a short public summary.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validatePrivateEvidenceStep(
  values: PrivateEvidenceStepValues,
): PrivateEvidenceStepValidation {
  const errors: Partial<Record<PrivateEvidenceStepField, string>> = {};

  if (!values.vulnerabilityDescription.trim()) {
    errors.vulnerabilityDescription = "Enter the private report.";
  }

  if (!values.reproductionSteps.trim()) {
    errors.reproductionSteps = "Enter the reproduction steps.";
  }

  if (!values.proofOfConcept.trim()) {
    errors.proofOfConcept = "Enter the PoC notes.";
  }

  if (!values.privateImpactValues.trim()) {
    errors.privateImpactValues = "Enter the private impact value.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    publiclyExcludedFields: [
      "Private report",
      "Reproduction steps",
      "PoC notes",
      "Private impact value",
    ],
  };
}

function isValidLocatorForTargetType(targetType: string, value: string): boolean {
  if (targetType === "Smart contract") {
    return isValidContractAddress(value) || isValidHttpUrl(value);
  }

  if (
    targetType === "Repository" ||
    targetType === "API" ||
    targetType === "Web application" ||
    targetType === "Mobile application"
  ) {
    return isValidHttpUrl(value);
  }

  return false;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isValidContractAddress(value: string): boolean {
  const trimmed = value.trim();
  return /^C[A-Z2-7]{55}$/.test(trimmed) || /^0x[a-f0-9]{40}$/i.test(trimmed);
}

function locatorMessageForTargetType(targetType: string): string {
  if (targetType === "Repository") {
    return "Enter a valid repository URL.";
  }
  if (targetType === "Smart contract") {
    return "Enter a valid contract address or URL.";
  }
  if (
    targetType === "API" ||
    targetType === "Web application" ||
    targetType === "Mobile application"
  ) {
    return "Enter a valid URL.";
  }
  return "Select a target type before entering the repository or contract.";
}

export function ReportStepValidationMessage({
  message,
}: {
  message: string | null;
}) {
  return message ? <em className="field-error">{message}</em> : null;
}

function publicClaimFromDraft(draft: ClaimDraft): ContinuationPayload["publicClaim"] {
  return {
    reportingContext: draft.reportingContext || null,
    programmeName: draft.programmeName || null,
    targetType: draft.targetType || null,
    targetLocator: draft.targetLocator || null,
    affectedComponent: draft.affectedComponent || null,
    findingTitle: draft.findingTitle || null,
    bugCategory: draft.bugCategory || null,
    claimedSeverity: draft.claimedSeverity || null,
    impactStatement: draft.impactStatement || null,
    publicThreshold: draft.publicClaim.publicThreshold || null,
  };
}

function draftFromContinuation(payload: ContinuationPayload): ClaimDraft {
  const initial = createInitialClaimDraft();
  const severity = payload.publicClaim.claimedSeverity;
  return {
    ...initial,
    reportingContext: payload.publicClaim.reportingContext ?? "",
    programmeName: payload.publicClaim.programmeName ?? payload.publicPayload.programmeContext ?? "",
    targetType: payload.publicClaim.targetType ?? "",
    targetLocator: payload.publicClaim.targetLocator ?? "",
    affectedComponent: payload.publicClaim.affectedComponent ?? "",
    network: payload.publicPayload.network,
    findingTitle: payload.publicClaim.findingTitle ?? "",
    bugCategory: payload.publicClaim.bugCategory ?? "",
    claimedSeverity: SEVERITIES.includes(severity as (typeof SEVERITIES)[number])
      ? (severity as ClaimDraft["claimedSeverity"])
      : "",
    impactStatement: payload.publicClaim.impactStatement ?? "",
    publicClaim: {
      ...initial.publicClaim,
      publicThreshold: payload.publicClaim.publicThreshold ?? payload.publicPayload.publicThreshold,
      policyIdentifier: payload.publicPayload.publicPolicyIdentifier,
      policyVersion: payload.publicPayload.publicPolicyVersion,
      verifierVersion: payload.publicPayload.verifierVersion,
    },
    state: "PUBLIC_CLAIM_REVIEWED",
    researcherFingerprint: payload.seal.researcherFingerprint,
    privateSeal: {
      claimIdentifier: payload.seal.claimIdentifier,
      canonicalClaimHash: payload.seal.canonicalClaimHash,
      privateEvidenceDigest: payload.seal.privateEvidenceDigest,
      saltHex: "",
      researcherFingerprint: payload.seal.researcherFingerprint,
      nullifier: payload.seal.nullifier,
      recoveryBundle: {
        schema: "zeroseal.private-recovery.v1",
        createdAt: payload.publicPayload.timestamp,
        privateEvidence: initial.privateEvidence,
        saltHex: "",
        canonicalClaimHash: payload.seal.canonicalClaimHash,
        researcherFingerprint: payload.seal.researcherFingerprint,
        nullifier: payload.seal.nullifier,
      },
    },
  };
}

async function assertBackendReady(): Promise<void> {
  const readiness = await getApiReadiness();
  const status = readiness.status;
  const checks =
    readiness.checks && typeof readiness.checks === "object"
      ? (readiness.checks as Record<string, unknown>)
      : {};
  const unavailable = Object.entries(checks)
    .filter(([, value]) => value === "unavailable" || value === "unknown")
    .map(([key, value]) => `${key}: ${String(value)}`);

  if (status !== "ready" || unavailable.length > 0) {
    throw new Error(
      `Backend readiness failed. ${unavailable.length ? unavailable.join(", ") : "The API is not ready."} Retry readiness before opening Freighter.`,
    );
  }
}

export function ClaimWizard({ mode }: { mode: WizardMode }) {
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<ClaimDraft>(() => {
    const initial = createInitialClaimDraft();
    const path = searchParams.get("path");
    const severity = searchParams.get("severity");
    return {
      ...initial,
      reportingContext: path ?? initial.reportingContext,
      claimedSeverity: SEVERITIES.includes(severity as (typeof SEVERITIES)[number])
        ? (severity as ClaimDraft["claimedSeverity"])
        : initial.claimedSeverity,
    };
  });
  const [step, setStep] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [publishState, setPublishState] = useState<PublishState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [publicPayload, setPublicPayload] = useState<PublicPayload | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [backendClaim, setBackendClaim] = useState<ApiClaim | null>(null);
  const [pendingTransaction, setPendingTransaction] =
    useState<PendingTransaction | null>(null);
  const [backendReceipt, setBackendReceipt] = useState<ApiReceipt | null>(null);
  const [preparedReview, setPreparedReview] = useState<PreparedReview | null>(null);
  const [hasPreparedTransaction, setHasPreparedTransaction] = useState(false);
  const [touchedReportFields, setTouchedReportFields] = useState<
    Partial<Record<ReportStepField, boolean>>
  >({});
  const [touchedFindingFields, setTouchedFindingFields] = useState<
    Partial<Record<FindingStepField, boolean>>
  >({});
  const [touchedPrivateEvidenceFields, setTouchedPrivateEvidenceFields] =
    useState<Partial<Record<PrivateEvidenceStepField, boolean>>>({});
  const preparedActionRef = useRef<PreparedRegistryAction | null>(null);
  const approvalInFlightRef = useRef(false);
  const previousWalletRef = useRef<string | null>(null);
  const [mobileSigning, setMobileSigning] = useState(() => isMobileViewport());
  const [continuationLinkPath, setContinuationLinkPath] = useState<string | null>(null);
  const { address, status, connect } = useWallet();

  const seal = draft.privateSeal ?? null;
  const registryContractId =
    process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID?.trim() ||
    DEFAULT_REGISTRY_CONTRACT_ID;
  const verifierContractId =
    process.env.NEXT_PUBLIC_VERIFIER_CONTRACT_ID?.trim() ||
    DEFAULT_VERIFIER_CONTRACT_ID;

  const isTryMode = mode === "demo";
  const pageTitle = isTryMode ? "Try ZeroSeal" : "Create a private claim";
  const currentStep = STEPS[step];
  const publishAction = getPublishActionState({
    reviewed,
    hasWallet: Boolean(address),
    walletStatus: status,
    publishState,
    hasPreparedTransaction,
    hasPendingTransaction: Boolean(pendingTransaction),
  });
  const stepOneValidation = useMemo(
    () =>
      validateReportStep({
        reportingContext: draft.reportingContext,
        programmeName: draft.programmeName,
        affectedComponent: draft.affectedComponent,
        targetType: draft.targetType,
        targetLocator: draft.targetLocator,
      }),
    [
      draft.reportingContext,
      draft.programmeName,
      draft.affectedComponent,
      draft.targetType,
      draft.targetLocator,
    ],
  );

  const markReportFieldTouched = (field: ReportStepField) => {
    setTouchedReportFields((current) => ({ ...current, [field]: true }));
  };

  const reportFieldError = (field: ReportStepField): string | null =>
    touchedReportFields[field] ? stepOneValidation.errors[field] ?? null : null;
  const findingStepValidation = useMemo(
    () =>
      validateFindingStep({
        findingTitle: draft.findingTitle,
        bugCategory: draft.bugCategory,
        publicThreshold: draft.publicClaim.publicThreshold,
        claimedSeverity: draft.claimedSeverity,
        impactStatement: draft.impactStatement,
      }),
    [
      draft.findingTitle,
      draft.bugCategory,
      draft.publicClaim.publicThreshold,
      draft.claimedSeverity,
      draft.impactStatement,
    ],
  );
  const privateEvidenceValidation = useMemo(
    () =>
      validatePrivateEvidenceStep({
        vulnerabilityDescription: draft.privateEvidence.vulnerabilityDescription,
        reproductionSteps: draft.privateEvidence.reproductionSteps,
        proofOfConcept: draft.privateEvidence.proofOfConcept,
        privateImpactValues: draft.privateEvidence.privateImpactValues,
      }),
    [
      draft.privateEvidence.vulnerabilityDescription,
      draft.privateEvidence.reproductionSteps,
      draft.privateEvidence.proofOfConcept,
      draft.privateEvidence.privateImpactValues,
    ],
  );

  const markFindingFieldTouched = (field: FindingStepField) => {
    setTouchedFindingFields((current) => ({ ...current, [field]: true }));
  };

  const findingFieldError = (field: FindingStepField): string | null =>
    touchedFindingFields[field]
      ? findingStepValidation.errors[field] ?? null
      : null;

  const markPrivateEvidenceFieldTouched = (field: PrivateEvidenceStepField) => {
    setTouchedPrivateEvidenceFields((current) => ({ ...current, [field]: true }));
  };

  const privateEvidenceFieldError = (
    field: PrivateEvidenceStepField,
  ): string | null =>
    touchedPrivateEvidenceFields[field]
      ? privateEvidenceValidation.errors[field] ?? null
      : null;
  const continueReason = useMemo(() => {
    if (step === 0 && !stepOneValidation.valid) {
      return Object.values(stepOneValidation.errors)[0] ?? "Complete the report fields.";
    }
    if (step === 1 && !findingStepValidation.valid) {
      return Object.values(findingStepValidation.errors)[0] ?? "Complete the finding fields.";
    }
    if (step === 2 && !privateEvidenceValidation.valid) {
      return (
        Object.values(privateEvidenceValidation.errors)[0] ??
        "Complete the required private evidence fields."
      );
    }
    if (step === 3 && !reviewed) {
      return "Approve the public claim before continuing.";
    }
    return null;
  }, [
    findingStepValidation.errors,
    findingStepValidation.valid,
    privateEvidenceValidation.errors,
    privateEvidenceValidation.valid,
    reviewed,
    step,
    stepOneValidation.errors,
    stepOneValidation.valid,
  ]);

  useEffect(() => {
    const onResize = () => setMobileSigning(isMobileViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const previousWallet = previousWalletRef.current;
    const nextWallet = address ?? null;
    previousWalletRef.current = nextWallet;

    if (!shouldClearWalletScopedState(previousWallet, nextWallet)) {
      return;
    }

    const cleared = clearedWalletRuntimeState();
    preparedActionRef.current = null;
    approvalInFlightRef.current = false;
    setDraft((current) => clearWalletScopedDraftState(current));
    setReviewed(cleared.reviewed);
    setPublicPayload(cleared.publicPayload);
    setPublishState(cleared.publishState);
    setPendingTransaction(cleared.pendingTransaction);
    setBackendReceipt(cleared.backendReceipt);
    setPreparedReview(cleared.preparedReview);
    setHasPreparedTransaction(cleared.hasPreparedTransaction);
    setTechnicalError(cleared.technicalError);
    setContinuationLinkPath(cleared.continuationLinkPath);
    setMessage("Wallet changed. Prepare a new stamp for the connected Testnet wallet.");
  }, [address]);

  useEffect(() => {
    if (!address || pendingTransaction || backendReceipt) {
      return;
    }

    const pending = readPendingReceiptSync(address);
    if (!pending) {
      return;
    }

    const transaction = pendingReceiptSyncToTransaction(pending);
    setPendingTransaction(transaction);
    setPublishState("backend_sync_failed");
    setStep(4);
    setDraft((current) => ({
      ...current,
      receipt: {
        transactionHash: pending.transactionHash,
        ledger: pending.ledger,
      },
    }));
    setMessage("The Stellar transaction is preserved. Receipt finalisation is delayed.");
  }, [address, backendReceipt, pendingTransaction]);

  useEffect(() => {
    const token = searchParams.get("continue")?.trim();
    if (!token) {
      return;
    }

    let cancelled = false;

    getBackendContinuation(token)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setDraft(draftFromContinuation(payload));
        setSelectedFiles([]);
        setPublicPayload(payload.publicPayload);
        setReviewed(true);
        setStep(4);
        setMessage("Desktop continuation loaded. Private evidence was not included in this handoff.");
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Continuation link could not be loaded.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const ready = useMemo(() => {
    switch (step) {
      case 0:
        return stepOneValidation.valid;
      case 1:
        return findingStepValidation.valid;
      case 2:
        return privateEvidenceValidation.valid;
      case 3:
        return reviewed;
      default:
        return false;
    }
  }, [
    findingStepValidation.valid,
    privateEvidenceValidation.valid,
    reviewed,
    step,
    stepOneValidation.valid,
  ]);

  const update = (patch: Partial<ClaimDraft>) => {
    if (preparedActionRef.current || preparedReview) {
      preparedActionRef.current = null;
      setPreparedReview(null);
      setHasPreparedTransaction(false);
      setPublishState((current) => (current === "reviewing" ? "idle" : current));
      setMessage("Claim changed after preparation. Prepare the stamp again before approval.");
    }
    setDraft((current) => ({ ...current, ...patch }));
  };

  const updatePrivateEvidence = (
    key: keyof ClaimDraft["privateEvidence"],
    value: string,
  ) => {
    if (preparedActionRef.current || preparedReview) {
      preparedActionRef.current = null;
      setPreparedReview(null);
      setHasPreparedTransaction(false);
      setPublishState((current) => (current === "reviewing" ? "idle" : current));
      setMessage("Private evidence changed after preparation. Prepare the stamp again before approval.");
    }
    setDraft((current) => ({
      ...current,
      privateEvidence: { ...current.privateEvidence, [key]: value },
    }));
  };

  const continueStep = () => {
    setMessage(null);
    if (step === 0 && !stepOneValidation.valid) {
      setTouchedReportFields({
        reportingContext: true,
        programmeName: true,
        affectedComponent: true,
        targetType: true,
        targetLocator: true,
      });
      setMessage("Complete the required report fields before continuing.");
      return;
    }
    if (step === 1 && !findingStepValidation.valid) {
      setTouchedFindingFields({
        findingTitle: true,
        bugCategory: true,
        publicThreshold: true,
        claimedSeverity: true,
        impactStatement: true,
      });
      setMessage("Complete the public finding fields before continuing.");
      return;
    }
    if (step === 2 && !privateEvidenceValidation.valid) {
      setTouchedPrivateEvidenceFields({
        vulnerabilityDescription: true,
        reproductionSteps: true,
        proofOfConcept: true,
        privateImpactValues: true,
      });
      setMessage("Complete the required private evidence fields before sealing.");
      return;
    }
    if (step === 2) {
      update({ state: nextClaimState("DRAFT", "privateEvidenceReady") });
    }
    if (step < STEPS.length - 1) {
      setStep((value) => value + 1);
    }
  };

  const loadExample = () => {
    setDraft(createExampleDemoDraft());
    setSelectedFiles(["impact-notes.txt", "poc-outline.md"]);
    setReviewed(false);
    setPublicPayload(null);
    setPublishState("idle");
    setPendingTransaction(null);
    setBackendReceipt(null);
    setPreparedReview(null);
    setHasPreparedTransaction(false);
    preparedActionRef.current = null;
    setTouchedReportFields({});
    setTouchedFindingFields({});
    setTouchedPrivateEvidenceFields({});
    setMessage("Example claim added. No fingerprint, wallet request or receipt was created.");
  };

  const clearPrivateEvidence = () => {
    setDraft((current) => ({
      ...current,
      privateEvidence: createInitialClaimDraft().privateEvidence,
      state: "DRAFT",
      researcherFingerprint: null,
      privateSeal: null,
    }));
    setSelectedFiles([]);
    setReviewed(false);
    setPublicPayload(null);
    setPreparedReview(null);
    setHasPreparedTransaction(false);
    preparedActionRef.current = null;
    setMessage("Private evidence cleared from this browser form.");
  };

  const reset = () => {
    setDraft((current) =>
      isTryMode ? createInitialClaimDraft() : resetClaimDraft(current),
    );
    setSelectedFiles([]);
    setStep(0);
    setReviewed(false);
    setPublicPayload(null);
    setPublishState("idle");
    setPendingTransaction(null);
    setBackendReceipt(null);
    setPreparedReview(null);
    setHasPreparedTransaction(false);
    setTechnicalError(null);
    setContinuationLinkPath(null);
    setTouchedReportFields({});
    setTouchedFindingFields({});
    setTouchedPrivateEvidenceFields({});
    preparedActionRef.current = null;
    approvalInFlightRef.current = false;
    setMessage(null);
  };

  const generateSeal = async () => {
    setMessage(null);
    update({ state: nextClaimState("PRIVATE_EVIDENCE_READY", "startSeal") });
    try {
      const nextSeal = await generatePrivateSeal(draft);
      setDraft((current) => ({
        ...current,
        state: nextClaimState("SEAL_GENERATING", "sealGenerated"),
        researcherFingerprint: nextSeal.researcherFingerprint,
        privateSeal: nextSeal,
      }));
      setMessage("ZeroSeal created this fingerprint automatically from the approved claim and private evidence.");
    } catch (error) {
      update({ state: "FAILED" });
      setMessage(error instanceof Error ? error.message : "Private seal failed.");
    }
  };

  const confirmReview = async () => {
    if (!seal) {
      return;
    }
    const payload = await buildPublicPayloadAsync(draft, seal, {
      researcherPublicKey: address,
    });
    storePublicReceipt(payload);
    setPublicPayload(payload);
    setReviewed(true);
    update({ state: nextClaimState("SEAL_GENERATED", "reviewPublicClaim") });
    setMessage("Approved public claim prepared. Private evidence remains local.");
  };

  const createContinuation = async () => {
    if (!seal || !publicPayload) {
      setMessage("Generate the seal and approve the public claim first.");
      return;
    }
    const continuation = await createBackendContinuation({
      publicPayload,
      publicClaim: publicClaimFromDraft(draft),
      seal: {
        claimIdentifier: seal.claimIdentifier,
        researcherFingerprint: seal.researcherFingerprint,
        nullifier: seal.nullifier,
        canonicalClaimHash: seal.canonicalClaimHash,
        privateEvidenceDigest: seal.privateEvidenceDigest,
      },
    });
    setContinuationLinkPath(continuation.linkPath);
    setMessage("Desktop continuation link created. It contains only approved public claim data and expires in 20 minutes.");
  };

  const preserveSignedTransaction = (transaction: PendingTransaction) => {
    setPendingTransaction(transaction);
    persistReceipt({
      schemaVersion: 2,
      network: "TESTNET",
      action: "submit_claim",
      status: "confirmed",
      transactionHash: transaction.transactionHash,
      ledger: transaction.ledger,
      account: address ?? "",
      sourceAccount: address ?? "",
      contractId: transaction.review.contractId,
      verifierContractId,
      contractFunction: "submit_claim",
      commitment: transaction.review.researcherCommitment,
      nullifier: transaction.review.nullifier,
      receiptId: transaction.payload?.claimIdentifier ?? transaction.claimId,
      confirmedAt: null,
      savedAt: new Date().toISOString(),
    });
    setDraft((current) => ({
      ...current,
      receipt: {
        transactionHash: transaction.transactionHash,
        ledger: transaction.ledger,
      },
    }));
  };

  const syncBackendTransaction = async (transaction: PendingTransaction) => {
    if (!address) {
      throw new Error("Reconnect the original Testnet wallet before retrying backend sync.");
    }

    setPublishState("confirming");
    setMessage("Stellar confirmed your transaction. ZeroSeal is finalising the receipt.");
    writePendingReceiptSync(pendingReceiptSyncFromTransaction(transaction, address));
    setPendingTransaction(transaction);

    await recordBackendTransaction(transaction.claimId, {
      transactionHash: transaction.transactionHash,
      walletAddress: address,
      network: "TESTNET",
      contractId: transaction.review.contractId,
      method: "submit_claim",
      operationType: "claim_submission",
      researcherCommitment: transaction.review.researcherCommitment,
      claimCommitment: transaction.review.claimCommitment,
      nullifier: transaction.review.nullifier,
      idempotencyKey: await createIdempotencyKey("claim_transaction", [
        transaction.claimId,
        address,
        transaction.transactionHash,
        transaction.review.contractId,
        transaction.review.claimCommitment,
      ]),
    });

    setPublishState("issuing_receipt");
    const receipt = await reconcileUntilReceipt({
      transactionHash: transaction.transactionHash,
      claimId: transaction.claimId,
    });

    setBackendReceipt(receipt);
    setDraft((current) => ({
      ...current,
      state: "RECEIPT_ISSUED",
      receipt: {
        transactionHash: receipt.transactionHash,
        ledger: String(receipt.ledgerNumber),
      },
    }));
    setPublishState("confirmed");
    setPendingTransaction(null);
    clearPendingReceiptSync();
    setMessage("Receipt ready. ZeroSeal confirmed the Stellar ledger and issued the public receipt.");
  };

  const approvePreparedTransaction = async () => {
    const prepared = preparedActionRef.current;
    if (!prepared) {
      setPublishState("failed");
      setMessage("Prepare the stamp again before opening Freighter.");
      return;
    }

    if (approvalInFlightRef.current) {
      return;
    }
    approvalInFlightRef.current = true;
    let signedTransactionForRetry: PendingTransaction | null = null;

    try {
      setTechnicalError(null);
      setPublishState("awaiting_wallet");
      setMessage("Waiting for Freighter. Rejecting the request will not submit a transaction.");

      const signed = await signSdkPreparedSubmitClaim({
        transaction: prepared.transaction,
        review: prepared.review,
        networkPassphrase: prepared.networkPassphrase,
      });
      setPublishState("signed");
      setMessage("Stamp signed. Submitting the signed transaction to Stellar Testnet.");

      const response = await submitSignedXdr({
        signedTxXdr: signed.signedTxXdr,
        networkPassphrase: prepared.networkPassphrase,
        rpcUrl: prepared.rpcUrl,
      });
      setPublishState("submitted");
      const hash = extractTransactionHash(response);
      const ledger = extractLedger(response);

      if (!hash) {
        setPublishState("failed");
        update({ state: "FAILED" });
        setMessage("Freighter returned no confirmed transaction hash.");
        return;
      }

      const signedTransaction = {
        claimId: prepared.claim.id,
        transactionHash: hash,
        ledger,
        payload: prepared.payload,
        review: prepared.review,
      };
      signedTransactionForRetry = signedTransaction;
      preserveSignedTransaction(signedTransaction);
      preparedActionRef.current = null;
      setPreparedReview(null);
      setHasPreparedTransaction(false);
      setMessage(`Stamp submitted. Hash preserved: ${hash}. Syncing ZeroSeal receipt now.`);
      await syncBackendTransaction(signedTransaction);
      setStep(4);
    } catch (error) {
      const approvalError =
        errorMessage(error) || "Unknown wallet or Stellar submission error.";
      setTechnicalError(approvalError);

      if (isWalletApprovalFailure(error)) {
        setPublishState("wallet_retry");
        setMessage(errorMessage(error));
        return;
      }
      const retryableTransaction = signedTransactionForRetry ?? pendingTransaction;
      if (retryableTransaction) {
        setPendingTransaction(retryableTransaction);
        setPublishState("backend_sync_failed");
        setMessage(error instanceof Error ? error.message : "Backend sync could not be completed. Retry backend sync.");
        return;
      }
      setPublishState("failed");
      update({ state: "FAILED" });
      setMessage(signedTransactionMessage(error));
    } finally {
      approvalInFlightRef.current = false;
    }
  };

  const publish = async () => {
    if (!seal) {
      setMessage("Generate the private seal before publishing.");
      return;
    }

    if ((publishState === "reviewing" || publishState === "wallet_retry") && preparedActionRef.current) {
      await approvePreparedTransaction();
      return;
    }

    if (publishState === "backend_sync_failed" && pendingTransaction) {
      try {
        await assertBackendReady();
        await syncBackendTransaction(pendingTransaction);
      } catch (error) {
        setPublishState("backend_sync_failed");
        setMessage(error instanceof Error ? error.message : "Backend sync could not be completed. Retry backend sync.");
      }
      return;
    }

    if (!address) {
      setMessage("Connect Freighter on Stellar Testnet before publishing.");
      await connect();
      return;
    }

    setPublishState("checking_readiness");
    update({ state: nextClaimState("PUBLIC_CLAIM_REVIEWED", "requestWallet") });
    setMessage("Checking backend readiness before opening Freighter.");
    setTechnicalError(null);
    setPreparedReview(null);
    setHasPreparedTransaction(false);
    preparedActionRef.current = null;

    try {
      await assertBackendReady();
      setPublishState("preparing");
      setMessage("Preparing the Claim Registry action.");

      const payload = await buildPublicPayloadAsync(draft, seal, {
        researcherPublicKey: address,
      });
      storePublicReceipt(payload);
      setPublicPayload(payload);

      const runtimeConfig = readClaimRegistryRuntimeConfig();
      const client = await createClaimRegistryClient(address);
      const researcherCommitment = await resolveOnChainResearcherCommitment(
        client,
        address,
        seal.researcherFingerprint,
      );
      const claimIdempotencyKey = await createIdempotencyKey("claim_submission", [
        seal.claimIdentifier,
        address,
        seal.canonicalClaimHash,
        researcherCommitment,
        seal.nullifier,
      ]);
      const claim =
        backendClaim?.researcherCommitment === researcherCommitment
          ? backendClaim
          : await createBackendClaim({
              walletAddress: address,
              researcherCommitment,
              nullifier: seal.nullifier,
              evidenceCommitment: seal.privateEvidenceDigest,
              publicInputs: publicInputRows(seal, researcherCommitment),
              idempotencyKey: claimIdempotencyKey,
            });
      setBackendClaim(claim);

      const transaction = await client.submit_claim({
        researcher: address,
        researcher_commitment: Buffer.from(researcherCommitment, "hex"),
        claim_commitment: Buffer.from(seal.canonicalClaimHash, "hex"),
        nullifier: Buffer.from(seal.nullifier, "hex"),
      });
      const signableXdr = transaction.toXDR();
      const decoded = decodeSubmitClaimArgsFromXdr(signableXdr);
      const fee = feeDisplayFromXdr(signableXdr, runtimeConfig.networkPassphrase);
      const review: PreparedReview = {
        wallet: decoded.researcher,
        contractId: decoded.contractId,
        method: decoded.method,
        researcherCommitment: decoded.researcherCommitment,
        claimCommitment: decoded.claimCommitment,
        nullifier: decoded.nullifier,
        simulatedFee: simulatedFee(transaction),
        feeStroops: fee.stroops,
        feeXlm: fee.xlm,
        signableXdr,
      };

      if (
        review.wallet !== address ||
        review.contractId !== registryContractId ||
        review.researcherCommitment !== researcherCommitment ||
        review.claimCommitment !== seal.canonicalClaimHash ||
        review.nullifier !== seal.nullifier
      ) {
        throw new Error("Stamp preparation failed. Signable XDR does not match the reviewed public commitments.");
      }

      preparedActionRef.current = {
        claim,
        payload,
        review,
        transaction,
        networkPassphrase: runtimeConfig.networkPassphrase,
        rpcUrl: runtimeConfig.rpcUrl,
      };
      setHasPreparedTransaction(true);
      setPreparedReview(review);
      setPublishState("reviewing");
      setMessage(`Stamp ready: contract ${registryContractId}, method submit_claim, wallet ${address}. Private evidence is excluded. Approve stamp in Freighter only if these details match.`);
      return;
    } catch (error) {
      setTechnicalError(errorMessage(error));
      if (pendingTransaction) {
        setPublishState("backend_sync_failed");
        setMessage(error instanceof Error ? error.message : "Backend sync could not be completed. Retry backend sync.");
        return;
      }
      setPublishState("failed");
      update({ state: "FAILED" });
      setMessage(signedTransactionMessage(error));
    }
  };

  return (
    <div className="claim-flow claim-flow--try">
      <div className="claim-flow__topbar">
        <Link className="claim-flow__back" href="/">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5 L8 12 L15 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to ZeroSeal
        </Link>
        <div className="claim-flow__top-actions">
          {isTryMode ? (
            <button className="btn btn--outline btn--sm" type="button" onClick={loadExample}>
              Load example
            </button>
          ) : null}
          <Link className="btn btn--outline btn--sm" href="/verify">
            Verify receipt
          </Link>
        </div>
      </div>

      <header className="claim-flow__hero claim-flow__hero--compact">
        <p className="eyebrow">{isTryMode ? "TRY ZEROSEAL" : "CREATE CLAIM"}</p>
        <h1>{isTryMode ? "Create an example security claim" : pageTitle}</h1>
        <p>
          {isTryMode
            ? "Use an example claim or enter your own test details. ZeroSeal only records a Testnet action after wallet approval."
            : "Create a private claim, generate a seal, approve the public fields and record a Testnet action."}
        </p>
      </header>

      <div className="claim-flow__shell claim-flow__shell--app">
        <aside className="claim-flow__progress claim-flow__progress--rail" aria-label="Claim creation progress">
          {STEPS.map((label, index) => {
            const complete = isStepComplete(index, step, draft, reviewed);
            return (
              <button
                key={label}
                type="button"
                data-complete={complete}
                aria-current={step === index ? "step" : undefined}
                onClick={() => setStep(index)}
              >
                <span>{complete ? "" : String(index + 1).padStart(2, "0")}</span>
                {label}
              </button>
            );
          })}
        </aside>

        <main className="claim-flow__panel claim-flow__panel--work">
          <div className="claim-flow__panel-top">
            <span>{currentStep}</span>
            <strong>Step {step + 1} of {STEPS.length}</strong>
          </div>

          {step === 0 ? (
            <section className="claim-step">
              <StepHeader
                title="Report"
                text="This describes where the report will be handled. ZeroSeal does not submit the private report to the platform."
              />
              <ReportingPathSelector
                value={draft.reportingContext}
                onChange={(value) => {
                  markReportFieldTouched("reportingContext");
                  update({ reportingContext: value });
                }}
                onBlur={() => markReportFieldTouched("reportingContext")}
                error={reportFieldError("reportingContext")}
              />
              <div className="claim-fields claim-fields--compact">
                <Field
                  label="Programme or project"
                  value={draft.programmeName}
                  onChange={(value) => {
                    markReportFieldTouched("programmeName");
                    update({ programmeName: value });
                  }}
                  onBlur={() => markReportFieldTouched("programmeName")}
                  hint="Example: Example Vault Programme or the protocol name"
                  error={reportFieldError("programmeName")}
                />
                <Field
                  label="Target name"
                  value={draft.affectedComponent}
                  onChange={(value) => {
                    markReportFieldTouched("affectedComponent");
                    update({ affectedComponent: value });
                  }}
                  onBlur={() => markReportFieldTouched("affectedComponent")}
                  hint="Example: Vault.sol, withdraw(), payments API or mobile app"
                  error={reportFieldError("affectedComponent")}
                />
                <SelectField
                  label="Target type"
                  value={draft.targetType}
                  options={TARGET_TYPES}
                  onChange={(value) => {
                    markReportFieldTouched("targetType");
                    update({ targetType: value });
                  }}
                  onBlur={() => markReportFieldTouched("targetType")}
                  hint="Example: smart contract, repository, API or web application"
                  error={reportFieldError("targetType")}
                />
                <Field
                  label="Repository or contract address"
                  value={draft.targetLocator}
                  onChange={(value) => {
                    markReportFieldTouched("targetLocator");
                    update({ targetLocator: value });
                  }}
                  onBlur={() => markReportFieldTouched("targetLocator")}
                  hint="Example: repository URL or deployed contract address"
                  error={reportFieldError("targetLocator")}
                />
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="claim-step">
              <StepHeader
                title="Finding"
                text="Use the public-facing description of the claim. Sensitive mechanics stay in private evidence."
              />
              <div className="claim-fields claim-fields--compact claim-fields--finding">
                <Field
                  label="Public title"
                  value={draft.findingTitle}
                  onChange={(value) => {
                    markFindingFieldTouched("findingTitle");
                    update({ findingTitle: value });
                  }}
                  onBlur={() => markFindingFieldTouched("findingTitle")}
                  hint="Example: Unauthorised withdrawal may bypass the programme limit"
                  error={findingFieldError("findingTitle")}
                />
                <Field
                  label="Category"
                  value={draft.bugCategory}
                  onChange={(value) => {
                    markFindingFieldTouched("bugCategory");
                    update({ bugCategory: value });
                  }}
                  onBlur={() => markFindingFieldTouched("bugCategory")}
                  hint="Example: Access control, reentrancy, authentication bypass or arithmetic error"
                  error={findingFieldError("bugCategory")}
                />
                <Field
                  label="Public impact threshold"
                  value={draft.publicClaim.publicThreshold}
                  onChange={(value) => {
                    markFindingFieldTouched("publicThreshold");
                    update({ publicClaim: { ...draft.publicClaim, publicThreshold: value } });
                  }}
                  onBlur={() => markFindingFieldTouched("publicThreshold")}
                  hint="Example: Up to 50,000 USD may be withdrawn without authorisation"
                  error={findingFieldError("publicThreshold")}
                />
              </div>
              <Segmented
                label="Severity"
                options={SEVERITIES}
                value={draft.claimedSeverity}
                onChange={(value) => {
                  markFindingFieldTouched("claimedSeverity");
                  update({ claimedSeverity: value as ClaimDraft["claimedSeverity"] });
                }}
                error={findingFieldError("claimedSeverity")}
              />
              <TextArea
                label="Short public summary"
                value={draft.impactStatement}
                onChange={(value) => {
                  markFindingFieldTouched("impactStatement");
                  update({ impactStatement: value });
                }}
                onBlur={() => markFindingFieldTouched("impactStatement")}
                hint="Example: An attacker may withdraw more assets than the configured programme threshold. Sensitive reproduction details remain private."
                error={findingFieldError("impactStatement")}
              />
            </section>
          ) : null}

          {step === 2 ? (
            <section className="claim-step">
              <StepHeader
                title="Private evidence"
                text="Nothing on this step leaves your device."
              />
              <div className="privacy-callout privacy-callout--evidence">
                <p>Stored locally for sealing. These raw values are never placed on Stellar or included in the public receipt.</p>
              </div>
              <div className="claim-fields claim-fields--compact claim-fields--evidence">
                <TextArea
                  label="Private report"
                  value={draft.privateEvidence.vulnerabilityDescription}
                  onChange={(value) => {
                    markPrivateEvidenceFieldTouched("vulnerabilityDescription");
                    updatePrivateEvidence("vulnerabilityDescription", value);
                  }}
                  onBlur={() => markPrivateEvidenceFieldTouched("vulnerabilityDescription")}
                  hint="Describe the vulnerable logic, affected component, root cause and exploit conditions."
                  error={privateEvidenceFieldError("vulnerabilityDescription")}
                />
                <TextArea
                  label="Reproduction steps"
                  value={draft.privateEvidence.reproductionSteps}
                  onChange={(value) => {
                    markPrivateEvidenceFieldTouched("reproductionSteps");
                    updatePrivateEvidence("reproductionSteps", value);
                  }}
                  onBlur={() => markPrivateEvidenceFieldTouched("reproductionSteps")}
                  hint="Example: 1. Deploy the affected version. 2. Create a funded test account. 3. Call withdraw() with the crafted input."
                  error={privateEvidenceFieldError("reproductionSteps")}
                />
              </div>
              <div className="claim-subsection">
                <h3>Additional private evidence</h3>
                <div className="claim-fields claim-fields--compact claim-fields--evidence">
                  <TextArea
                    label="PoC notes"
                    value={draft.privateEvidence.proofOfConcept}
                    onChange={(value) => {
                      markPrivateEvidenceFieldTouched("proofOfConcept");
                      updatePrivateEvidence("proofOfConcept", value);
                    }}
                    onBlur={() => markPrivateEvidenceFieldTouched("proofOfConcept")}
                    hint="Example: Foundry test: test_WithdrawAboveLimit(). Expected revert, but the withdrawal succeeds."
                    error={privateEvidenceFieldError("proofOfConcept")}
                  />
                  <Field
                    label="Private impact value"
                    value={draft.privateEvidence.privateImpactValues}
                    onChange={(value) => {
                      markPrivateEvidenceFieldTouched("privateImpactValues");
                      updatePrivateEvidence("privateImpactValues", value);
                    }}
                    onBlur={() => markPrivateEvidenceFieldTouched("privateImpactValues")}
                    hint="Example: Potential loss: 50,000 USD from the affected vault."
                    error={privateEvidenceFieldError("privateImpactValues")}
                  />
                </div>
              </div>
              <label className="file-picker">
                <span>Optional attachments</span>
                <input
                  type="file"
                  multiple
                  onChange={(event) =>
                    setSelectedFiles(
                      Array.from(event.target.files ?? []).map((file) => file.name),
                    )
                  }
                />
                <strong>{selectedFiles.length ? `${selectedFiles.length} local file${selectedFiles.length === 1 ? "" : "s"}` : "No local files added"}</strong>
              </label>
              {selectedFiles.length ? (
                <div className="file-chip-row">
                  {selectedFiles.map((file) => (
                    <span className="file-chip" key={file}>
                      {file}
                      <button type="button" aria-label={`Remove ${file}`} onClick={() => setSelectedFiles((files) => files.filter((item) => item !== file))}>x</button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="claim-step__actions">
                <button className="btn btn--outline btn--sm" type="button" onClick={clearPrivateEvidence}>
                  Clear private evidence
                </button>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="claim-step">
              <StepHeader
                title="Seal and public claim"
                text="Generate a local commitment, then approve the exact public fields."
              />
              <div className="seal-panel" data-ready={Boolean(seal)}>
                <div>
                  <span>Researcher fingerprint</span>
                  <strong className="mono">{formatFingerprint(draft.researcherFingerprint)}</strong>
                  <p>
                    {seal
                      ? "ZeroSeal created this fingerprint automatically from the approved claim and private evidence."
                      : "Not generated. No fingerprint or private seal output exists yet."}
                  </p>
                </div>
                <button className="btn btn--primary btn--sm" type="button" onClick={() => void generateSeal()}>
                  Generate private seal
                </button>
              </div>
              {seal ? (
                <div className="claim-step__actions">
                  <button
                    className="btn btn--outline btn--sm"
                    type="button"
                    onClick={() => downloadJson(`${seal.claimIdentifier}-private-recovery.json`, seal.recoveryBundle)}
                  >
                    Export private recovery bundle
                  </button>
                </div>
              ) : null}
              <details className="technical-details">
                <summary>Technical details</summary>
                <p>The browser uses canonical claim data, a private evidence digest and secure random salt to create the local seal. The current circuit proves the supported private impact threshold predicate, not arbitrary exploit validity.</p>
              </details>
              <div className="claim-review claim-review--split">
                <section>
                  <h3>Private and not published</h3>
                  <ul>
                    <li>Exploit details</li>
                    <li>Private files</li>
                    <li>Reproduction steps</li>
                    <li>Sensitive witness values</li>
                  </ul>
                </section>
                <section>
                  <h3>Included in public claim</h3>
                  <ul>
                    <li>Reporting context</li>
                    <li>Target and severity claim</li>
                    <li>Approved impact statement</li>
                    <li>Fingerprint and policy identifier</li>
                  </ul>
                </section>
              </div>
              <button className="btn btn--primary btn--sm" type="button" disabled={!seal} onClick={() => void confirmReview()}>
                {reviewed ? "Public claim approved" : "Approve public claim"}
              </button>
            </section>
          ) : null}

          {step === 4 ? (
            <section className="claim-step">
              <StepHeader
                title="Sign and receipt"
                text="Create a real Stellar Testnet receipt only after wallet approval and confirmation."
              />
              {draft.receipt?.transactionHash ? (
                <div className="claim-receipt">
                  <div className="receipt-badge">{backendReceipt ? "Confirmed" : "Receipt finalising"}</div>
                  <dl>
                    <div><dt>Claim identifier</dt><dd><CopyableValue value={publicPayload?.claimIdentifier ?? seal?.claimIdentifier ?? ""} /></dd></div>
                    <div><dt>Researcher commitment</dt><dd><CopyableValue value={backendReceipt?.researcherCommitment ?? preparedReview?.researcherCommitment ?? seal?.researcherFingerprint ?? ""} /></dd></div>
                    <div><dt>Transaction hash</dt><dd><CopyableValue value={draft.receipt.transactionHash} /></dd></div>
                    <div><dt>Ledger</dt><dd>{draft.receipt.ledger ?? "Confirmed, ledger unavailable"}</dd></div>
                    {backendReceipt ? (
                      <div><dt>Receipt ID</dt><dd><CopyableValue value={backendReceipt.receiptId} /></dd></div>
                    ) : null}
                    <div><dt>Wallet</dt><dd><CopyableValue value={address ?? ""} /></dd></div>
                    <div><dt>Registry contract</dt><dd><CopyableValue value={registryContractId} /></dd></div>
                  </dl>
                  <div className="claim-step__actions">
                    {backendReceipt ? (
                      <Link className="btn btn--primary btn--sm" href={`/receipt/${draft.receipt.transactionHash}`}>Open receipt page</Link>
                    ) : null}
                    {pendingTransaction ? (
                      <button className="btn btn--primary btn--sm" type="button" onClick={() => void publish()}>
                        Retry receipt sync
                      </button>
                    ) : null}
                    <a className="btn btn--outline btn--sm" href={explorerTransactionUrl(draft.receipt.transactionHash)} target="_blank" rel="noreferrer">Open Stellar explorer</a>
                    <button className="btn btn--outline btn--sm" type="button" onClick={() => navigator.clipboard?.writeText(draft.receipt?.transactionHash ?? "")}>
                      Copy transaction hash
                    </button>
                    {backendReceipt ? (
                      <Link className="btn btn--outline btn--sm" href={verifyReceiptHref(backendReceipt.receiptId)}>Verify this receipt</Link>
                    ) : null}
                  </div>
                </div>
              ) : (
                <>
                  <div className="transaction-readiness" aria-label="Transaction readiness">
                    <StatusPill label="Seal ready" active={Boolean(seal)} />
                    <StatusPill label="Public claim approved" active={reviewed} />
                    <StatusPill label="Wallet connected" active={Boolean(address)} />
                    <StatusPill label="Stellar Testnet" active={status !== "wrong_network"} />
                    <StatusPill label="Private evidence excluded" active />
                  </div>
                  {preparedReview ? (
                    <div className="transaction-review" role="status" aria-live="polite">
                      <div>
                        <span>Method</span>
                        <strong>{preparedReview.method}</strong>
                      </div>
                      <div>
                        <span>Registry contract</span>
                        <CopyableValue value={preparedReview.contractId} />
                      </div>
                      <div>
                        <span>Connected wallet</span>
                        <CopyableValue value={preparedReview.wallet} />
                      </div>
                      <div>
                        <span>Researcher commitment</span>
                        <CopyableValue value={preparedReview.researcherCommitment} />
                      </div>
                      <div>
                        <span>Claim commitment</span>
                        <CopyableValue value={preparedReview.claimCommitment} />
                      </div>
                      <div>
                        <span>Nullifier</span>
                        <CopyableValue value={preparedReview.nullifier} />
                      </div>
                      <div>
                        <span>Network</span>
                        <strong>Stellar Testnet</strong>
                      </div>
                      <div>
                        <span>Maximum network fee</span>
                        <strong>{preparedReview.feeXlm} XLM</strong>
                        <strong>{preparedReview.feeStroops} stroops</strong>
                      </div>
                      <div>
                        <span>Signable XDR</span>
                        <strong>{preparedReview.signableXdr ? "Created" : "Missing"}</strong>
                      </div>
                      <div>
                        <span>Excluded</span>
                        <strong>Private evidence, PoC, files, salts and witness values</strong>
                      </div>
                    </div>
                  ) : null}
                  {!preparedReview ? (
                    <div className="transaction-review transaction-review--empty">
                      <div>
                        <span>Stamp review</span>
                        <strong>Prepare stamp to create a signable XDR.</strong>
                      </div>
                      <div>
                        <span>Private fields excluded</span>
                        <strong>Raw evidence, PoC, private files, salts and witness values</strong>
                      </div>
                    </div>
                  ) : null}
                  {mobileSigning ? (
                    <div className="mobile-handoff">
                      <strong>Continue securely on desktop</strong>
                      <p>Freighter approval is not available in this mobile browser. Continue securely on desktop without publishing your private evidence.</p>
                      <p>This continuation contains only the approved public claim state and expires in 20 minutes. Raw reports, PoC notes, private files, salts and witness values stay off the continuation link.</p>
                      <button className="btn btn--primary btn--sm" type="button" onClick={() => void createContinuation()}>
                        Continue securely on desktop
                      </button>
                      {continuationLinkPath ? (
                        <div className="mobile-handoff__link">
                          <div className="mobile-handoff__qr" aria-label="Desktop continuation QR code">
                            <span className="mobile-handoff__qr-mark" aria-hidden="true" />
                            <p>Open this link on a desktop browser with Freighter unlocked on Stellar Testnet.</p>
                          </div>
                          <code>{desktopContinuationUrl(continuationLinkPath, typeof window !== "undefined" ? window.location.origin : undefined)}</code>
                          <button
                            className="btn btn--outline btn--sm"
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(desktopContinuationUrl(continuationLinkPath, window.location.origin))}
                          >
                            Copy desktop continuation link
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="claim-step__actions">
                      <button className="btn btn--primary btn--sm" type="button" disabled={publishAction.disabled} onClick={() => void publish()}>
                        {publishAction.label}
                      </button>
                      {publishAction.reason ? (
                        <span className="claim-action-hint">{publishAction.reason}</span>
                      ) : null}
                    </div>
                  )}
                </>
              )}
            </section>
          ) : null}

          {message ? (
            <div className="claim-flow__message" aria-live="polite">
              <p>{message}</p>
              {technicalError ? (
                <details className="technical-details">
                  <summary>Technical details</summary>
                  <p>{technicalError}</p>
                </details>
              ) : null}
            </div>
          ) : null}

          <footer className="claim-flow__nav claim-flow__nav--compact">
            <button className="btn btn--outline btn--sm" type="button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>
              Previous
            </button>
            <button className="btn btn--outline btn--sm" type="button" onClick={reset}>
              Reset
            </button>
            {step < 4 ? (
              <div className="claim-flow__continue">
                <button className="btn btn--primary btn--sm" type="button" disabled={!ready} onClick={continueStep}>
                  Continue
                </button>
                {!ready && continueReason ? (
                  <span className="claim-action-hint">{continueReason}</span>
                ) : null}
              </div>
            ) : null}
          </footer>
        </main>
      </div>
    </div>
  );
}

function StepHeader({ title, text }: { title: string; text: string }) {
  return (
    <header className="claim-step__head">
      <h2>{title}</h2>
      <p>{text}</p>
    </header>
  );
}

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return (
    <span className="status-pill" data-active={active}>
      {label}
    </span>
  );
}

function CopyableValue({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false);
  const displayValue = expanded ? value : shortenLongValue(value);

  if (!value) {
    return <strong>Unavailable</strong>;
  }

  return (
    <span className="copyable-value">
      <code title={value}>{displayValue}</code>
      <span>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(value)}
        >
          Copy
        </button>
        <button type="button" onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Shorten" : "Expand"}
        </button>
      </span>
    </span>
  );
}

function shortenLongValue(value: string): string {
  if (value.length <= 24) {
    return value;
  }
  return `${value.slice(0, 10)}...${value.slice(-10)}`;
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  hint,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  hint?: string;
  error?: string | null;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-invalid={Boolean(error)}
      />
      {hint ? <em className="field-hint">{hint}</em> : null}
      <ReportStepValidationMessage message={error ?? null} />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  onBlur,
  hint,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  hint?: string;
  error?: string | null;
}) {
  return (
    <label>
      <span>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-invalid={Boolean(error)}
      />
      {hint ? <em className="field-hint">{hint}</em> : null}
      <ReportStepValidationMessage message={error ?? null} />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  onBlur,
  hint,
  error,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  onBlur?: () => void;
  hint?: string;
  error?: string | null;
}) {
  return (
    <label>
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-invalid={Boolean(error)}
      >
        <option value="">Choose one</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      {hint ? <em className="field-hint">{hint}</em> : null}
      <ReportStepValidationMessage message={error ?? null} />
    </label>
  );
}

function Segmented({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}) {
  return (
    <fieldset className="severity-control">
      <legend>{label}</legend>
      <div>
        {options.map((option) => (
          <button
            type="button"
            key={option}
            data-selected={value === option}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
      <ReportStepValidationMessage message={error ?? null} />
    </fieldset>
  );
}

export function ReportingPathSelector({
  value,
  onChange,
  onBlur,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string | null;
}) {
  const selected =
    REPORTING_CONTEXTS.find((context) => context.label === value) ?? null;

  return (
    <label className="reporting-path-field">
      <span>Reporting path</span>
      <select
        className="reporting-path-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-invalid={Boolean(error)}
      >
        <option value="">Select a reporting path</option>
        {REPORTING_CONTEXTS.map((context) => (
          <option key={context.label} value={context.label}>
            {context.label}
          </option>
        ))}
      </select>
      <small>
        {selected
          ? selected.category
          : "Where the full report will eventually be handled"}
      </small>
      <ReportStepValidationMessage message={error ?? null} />
    </label>
  );
}
