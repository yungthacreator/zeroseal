"use client";

type PublicInput = {
  position: number;
  name: string;
  valueHex: string;
};

type CreateClaimInput = {
  walletAddress: string;
  researcherCommitment?: string;
  nullifier: string;
  publicInputs: PublicInput[];
  idempotencyKey: string;
  evidenceCommitment?: string;
};

type AttachEvidenceInput = {
  evidenceCommitment: string;
  manifestDigest: string;
  fileCount: number;
  totalBytes: number;
  canonicalisationVersion: string;
  contentTypes: string[];
};

type RecordTransactionInput = {
  transactionHash: string;
  walletAddress: string;
  network: "TESTNET";
  contractId: string;
  method: string;
  operationType: string;
  researcherCommitment?: string;
  claimCommitment?: string;
  nullifier?: string;
  idempotencyKey: string;
};

export type ApiClaim = {
  id: string;
  status: string;
  researcherCommitment: string;
  nullifier: string | null;
};

export type ApiTransaction = {
  id: string;
  transactionHash: string;
  status: string;
  ledgerNumber: number | null;
  sourceAccount: string | null;
  contractId?: string | null;
  method?: string | null;
  researcherCommitment?: string | null;
  confirmedAt: string | null;
};

export type ApiReceipt = {
  receiptId: string;
  claimId: string;
  transactionHash: string;
  ledgerNumber: number;
  registryContract: string;
  verifierContract: string;
  network: string;
  walletAddress: string;
  researcherCommitment: string;
  claimCommitment: string | null;
  nullifier: string | null;
  policyIdentifier: string;
  issuedAt: string;
  method?: string;
  actionLabel?: string;
  status?: string;
  explorerTransactionUrl: string;
  explorerAccountUrl?: string;
  explorerRegistryUrl?: string;
  explorerVerifierUrl?: string;
};

export type ApiVerificationResult = {
  status:
    | "VERIFIED"
    | "PENDING_CONFIRMATION"
    | "FAILED"
    | "NOT_FOUND"
    | "INVALID"
    | "MISMATCHED";
  inputType: "receipt" | "claim" | "transaction" | "unknown";
  identifier: string;
  message: string;
  receipt?: ApiReceipt | null;
  transaction?: ApiTransaction | null;
  chain?: {
    hash: string;
    successful: boolean;
    ledger: number | null;
    sourceAccount: string | null;
    createdAt: string | null;
    feeCharged: string | null;
  } | null;
  explorer?: {
    transaction?: string;
    account?: string;
    registry?: string;
    verifier?: string;
  } | null;
};

export type ApiReconciliationResponse = {
  status?: string;
  transaction?: ApiTransaction | null;
  claim?: ApiClaim | null;
  receipt?: ApiReceipt | null;
  invocation?: unknown;
};

export type ApiErrorState = {
  code: string;
  message: string;
};

export class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number | null,
    public readonly path: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function localApiBase(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname)
    ? "http://127.0.0.1:4000"
    : "";
}

function apiBase(): string {
  return (
    process.env.NEXT_PUBLIC_ZEROSEAL_API_URL?.replace(/\/$/, "") ??
    localApiBase()
  );
}

export function getConfiguredApiBase(): string {
  return apiBase();
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const base = apiBase();

  if (!base) {
    throw new ApiRequestError(
      "API_UNCONFIGURED",
      "Production API URL is missing",
      null,
      path,
    );
  }

  if (
    typeof window !== "undefined" &&
    !["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname) &&
    /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(base)
  ) {
    throw new ApiRequestError(
      "API_MISCONFIGURED",
      "Production API cannot point to localhost",
      null,
      path,
    );
  }

  let response: Response;

  try {
    response = await fetch(`${base}${path}`, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(options.headers ?? {}),
      },
    });
  } catch {
    throw new ApiRequestError(
      "API_UNAVAILABLE",
      "ZeroSeal could not reach the claim service. No transaction was submitted.",
      null,
      path,
    );
  }

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const error =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object"
        ? (payload.error as { code?: unknown; message?: unknown })
        : null;

    throw new ApiRequestError(
      typeof error?.code === "string" ? error.code : "API_ERROR",
      typeof error?.message === "string"
        ? error.message
        : "The backend request failed.",
      response.status,
      path,
      payload,
    );
  }

  return payload as T;
}

export function createBackendClaim(input: CreateClaimInput) {
  return request<ApiClaim>("/api/v1/claims", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function attachClaimEvidence(claimId: string, input: AttachEvidenceInput) {
  return request(`/api/v1/claims/${claimId}/evidence`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function submitBackendProof(claimId: string, artifact: unknown) {
  return request(`/api/v1/claims/${claimId}/proof`, {
    method: "POST",
    body: JSON.stringify({ artifact }),
  });
}

export function requestBackendVerification(claimId: string) {
  return request(`/api/v1/claims/${claimId}/verification`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function recordBackendTransaction(
  claimId: string,
  input: RecordTransactionInput,
) {
  return request<ApiTransaction>(`/api/v1/claims/${claimId}/transactions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getBackendClaim(claimId: string) {
  return request<ApiClaim>(`/api/v1/claims/${claimId}`);
}

export function getBackendClaimReceipt(claimId: string) {
  return request<ApiReceipt>(`/api/v1/claims/${claimId}/receipt`);
}

export function getBackendReceipt(receiptId: string) {
  return request<ApiReceipt>(`/api/v1/receipts/${receiptId}`);
}

export function getPublicReceipts() {
  return request<ApiReceipt[]>("/api/v1/receipts");
}

export function getBackendTransaction(transactionHash: string) {
  return request<ApiTransaction>(`/api/v1/transactions/${transactionHash}`);
}

export function reconcileBackendTransaction(transactionHash: string) {
  return request<ApiReconciliationResponse>(
    `/api/v1/transactions/${encodeURIComponent(transactionHash)}/reconcile`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export function verifyReceiptHref(receiptId: string) {
  return `/verify?receipt=${encodeURIComponent(receiptId)}`;
}

export function verifyReceiptIdentifier(
  identifier: string,
  options: RequestInit = {},
) {
  return request<ApiVerificationResult>(
    `/api/v1/verify/${encodeURIComponent(identifier)}`,
    options,
  );
}

export function getWalletActivity(address: string) {
  return request(`/api/v1/wallets/${address}/activity`);
}

export function getProgrammes() {
  return request<Array<Record<string, unknown>>>("/api/v1/programmes");
}

export function getCircuits() {
  return request<Array<Record<string, unknown>>>("/api/v1/circuits");
}

export function getApiReadiness() {
  return request<Record<string, unknown>>("/ready");
}

export type ContinuationPublicPayload = {
  claimIdentifier: string;
  reportingContext: string;
  programmeContext: string;
  programmeHash: string;
  targetSnapshotHash: string;
  publicPolicyIdentifier: string;
  publicPolicyVersion: string;
  publicThreshold: string;
  researcherFingerprint: string;
  researcherPublicKey: string | null;
  proofDigest: string;
  nullifier: string;
  verifierVersion: string;
  verificationResult: "structural_only" | "verified";
  network: "TESTNET";
  timestamp: string;
};

export type ContinuationPublicClaim = {
  reportingContext: string | null;
  programmeName: string | null;
  targetType: string | null;
  targetLocator: string | null;
  affectedComponent: string | null;
  findingTitle: string | null;
  bugCategory: string | null;
  claimedSeverity: string | null;
  impactStatement: string | null;
  publicThreshold: string | null;
};

export type ContinuationPayload = {
  publicPayload: ContinuationPublicPayload;
  publicClaim: ContinuationPublicClaim;
  seal: {
    claimIdentifier: string;
    researcherFingerprint: string;
    nullifier: string;
    canonicalClaimHash: string;
    privateEvidenceDigest: string;
  };
};

export function createBackendContinuation(input: ContinuationPayload) {
  return request<{ token: string; expiresAt: string; linkPath: string }>(
    "/api/v1/continuations",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function getBackendContinuation(token: string) {
  return request<ContinuationPayload & { token: string; expiresAt: string }>(
    `/api/v1/continuations/${encodeURIComponent(token)}`,
  );
}

export function recoverResearcherRegistration(
  address: string,
  researcherCommitment?: string,
) {
  const query = researcherCommitment
    ? `?researcherCommitment=${encodeURIComponent(researcherCommitment)}`
    : "";
  return request<Record<string, unknown>>(
    `/api/v1/wallets/${address}/researcher-registration${query}`,
  );
}
