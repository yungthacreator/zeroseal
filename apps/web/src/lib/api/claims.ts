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

export type ApiErrorState = {
  code: string;
  message: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_ZEROSEAL_API_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:4000";

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(options.headers ?? {}),
      },
    });
  } catch {
    throw {
      code: "API_UNAVAILABLE",
      message: "Backend unavailable",
    } satisfies ApiErrorState;
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

    throw {
      code: typeof error?.code === "string" ? error.code : "API_ERROR",
      message:
        typeof error?.message === "string"
          ? error.message
          : "The backend request failed.",
    } satisfies ApiErrorState;
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

export function getWalletActivity(address: string) {
  return request(`/api/v1/wallets/${address}/activity`);
}

export function getProgrammes() {
  return request<Array<Record<string, unknown>>>("/api/v1/programmes");
}

export function getCircuits() {
  return request<Array<Record<string, unknown>>>("/api/v1/circuits");
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
