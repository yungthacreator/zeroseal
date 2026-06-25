// Read-only helpers for confirming and displaying real Stellar Testnet
// activity. No secrets, no signing, no state changes. These only query
// the public Horizon Testnet endpoint to verify that a transaction hash
// corresponds to a real, successful ledger entry.

export const HORIZON_TESTNET_URL = "https://horizon-testnet.stellar.org";
export const STELLAR_EXPERT_TESTNET_URL =
  "https://stellar.expert/explorer/testnet";

export function explorerTransactionUrl(transactionHash: string): string {
  return `${STELLAR_EXPERT_TESTNET_URL}/tx/${transactionHash}`;
}

export function explorerContractUrl(contractId: string): string {
  return `${STELLAR_EXPERT_TESTNET_URL}/contract/${contractId}`;
}

export function explorerAccountUrl(accountId: string): string {
  return `${STELLAR_EXPERT_TESTNET_URL}/account/${accountId}`;
}

export type HorizonTransaction = {
  exists: boolean;
  successful: boolean;
  hash: string;
  ledger: string | null;
  sourceAccount: string | null;
  createdAt: string | null;
  operationCount: number | null;
  feeCharged: string | null;
};

const HASH_PATTERN = /^[0-9a-f]{64}$/i;

export function isLikelyTransactionHash(value: string): boolean {
  return HASH_PATTERN.test(value.trim());
}

/**
 * Query Horizon Testnet for a transaction by hash. Returns a normalised
 * result. Never throws for a missing transaction; callers branch on
 * `exists` and `successful`.
 */
export async function fetchTestnetTransaction(
  transactionHash: string,
  signal?: AbortSignal,
): Promise<HorizonTransaction> {
  const hash = transactionHash.trim();

  const empty: HorizonTransaction = {
    exists: false,
    successful: false,
    hash,
    ledger: null,
    sourceAccount: null,
    createdAt: null,
    operationCount: null,
    feeCharged: null,
  };

  if (!isLikelyTransactionHash(hash)) {
    return empty;
  }

  let response: Response;

  try {
    response = await fetch(`${HORIZON_TESTNET_URL}/transactions/${hash}`, {
      cache: "no-store",
      signal,
    });
  } catch {
    return empty;
  }

  if (response.status === 404) {
    return empty;
  }

  if (!response.ok) {
    return empty;
  }

  const data = (await response.json()) as Record<string, unknown>;

  const ledger =
    typeof data.ledger === "number" || typeof data.ledger === "string"
      ? String(data.ledger)
      : null;

  return {
    exists: true,
    successful: data.successful === true,
    hash: typeof data.hash === "string" ? data.hash : hash,
    ledger,
    sourceAccount:
      typeof data.source_account === "string" ? data.source_account : null,
    createdAt: typeof data.created_at === "string" ? data.created_at : null,
    operationCount:
      typeof data.operation_count === "number" ? data.operation_count : null,
    feeCharged:
      typeof data.fee_charged === "string" || typeof data.fee_charged === "number"
        ? String(data.fee_charged)
        : null,
  };
}
