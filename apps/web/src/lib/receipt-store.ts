// Local persistence for real confirmed ZeroSeal transactions. Receipts are
// keyed by network, connected account and transaction hash. Legacy single-action
// receipts are still readable so a returning browser can explain that an
// on-chain registration exists even when an older record lacks full metadata.

"use client";

export type ReceiptAction =
  | "register_researcher"
  | "submit_claim"
  | "proof_acceptance"
  | "verification_payment";

export type StoredReceipt = {
  schemaVersion: 2;
  network: "TESTNET";
  action: ReceiptAction;
  status: "confirmed" | "pending" | "failed";
  transactionHash: string;
  ledger: string | null;
  account: string;
  sourceAccount?: string | null;
  contractId?: string;
  verifierContractId?: string | null;
  contractFunction?: string | null;
  commitment?: string | null;
  nullifier?: string | null;
  receiptId?: string | null;
  confirmedAt?: string | null;
  amount?: string | null;
  destination?: string | null;
  savedAt: string;
};

const V2_PREFIX = "zeroseal:receipt:v2";
const V2_INDEX_PREFIX = "zeroseal:receipt-index:v2";
const LEGACY_PREFIX = "zeroseal:receipt:testnet";

function indexKey(network: StoredReceipt["network"], account: string): string {
  return `${V2_INDEX_PREFIX}:${network.toLowerCase()}:${account}`;
}

function receiptKey(receipt: StoredReceipt): string {
  return `${V2_PREFIX}:${receipt.network.toLowerCase()}:${receipt.account}:${receipt.transactionHash}`;
}

function legacyKey(account: string, action: ReceiptAction): string {
  return `${LEGACY_PREFIX}:${account}:${action}`;
}

function normalizeReceipt(parsed: unknown): StoredReceipt | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const value = parsed as Record<string, unknown>;

  if (
    value.network !== "TESTNET" ||
    typeof value.transactionHash !== "string" ||
    typeof value.account !== "string" ||
    typeof value.action !== "string"
  ) {
    return null;
  }

  if (
    value.schemaVersion === 2 &&
    (value.status === "confirmed" ||
      value.status === "pending" ||
      value.status === "failed")
  ) {
    return value as unknown as StoredReceipt;
  }

  return {
    schemaVersion: 2,
    network: "TESTNET",
    action: value.action as ReceiptAction,
    status: "confirmed",
    transactionHash: value.transactionHash,
    ledger:
      typeof value.ledger === "string" || typeof value.ledger === "number"
        ? String(value.ledger)
        : null,
    account: value.account,
    sourceAccount:
      typeof value.sourceAccount === "string" ? value.sourceAccount : value.account,
    contractId:
      typeof value.contractId === "string" ? value.contractId : undefined,
    verifierContractId:
      typeof value.verifierContractId === "string"
        ? value.verifierContractId
        : null,
    contractFunction:
      typeof value.contractFunction === "string"
        ? value.contractFunction
        : value.action,
    commitment:
      typeof value.commitment === "string" ? value.commitment : null,
    nullifier: typeof value.nullifier === "string" ? value.nullifier : null,
    receiptId: typeof value.receiptId === "string" ? value.receiptId : null,
    confirmedAt:
      typeof value.confirmedAt === "string" ? value.confirmedAt : null,
    amount: typeof value.amount === "string" ? value.amount : null,
    destination:
      typeof value.destination === "string" ? value.destination : null,
    savedAt:
      typeof value.savedAt === "string"
        ? value.savedAt
        : new Date(0).toISOString(),
  };
}

function readJson(key: string): StoredReceipt | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? normalizeReceipt(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function persistReceipt(receipt: StoredReceipt): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const key = receiptKey(receipt);
    window.localStorage.setItem(key, JSON.stringify(receipt));

    const indexStorageKey = indexKey(receipt.network, receipt.account);
    const current = window.localStorage.getItem(indexStorageKey);
    const keys = current ? (JSON.parse(current) as string[]) : [];
    const next = Array.from(new Set([key, ...keys]));
    window.localStorage.setItem(indexStorageKey, JSON.stringify(next));

    window.localStorage.setItem(
      legacyKey(receipt.account, receipt.action),
      JSON.stringify(receipt),
    );
  } catch {
    // Storage may be unavailable. The receipt still renders in memory.
  }
}

export function readReceipts(account: string): StoredReceipt[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(indexKey("TESTNET", account));
    const keys = raw ? (JSON.parse(raw) as string[]) : [];
    return keys
      .map((key) => readJson(key))
      .filter((receipt): receipt is StoredReceipt => Boolean(receipt))
      .sort(
        (a, b) =>
          new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
      );
  } catch {
    return [];
  }
}

export function readReceipt(
  account: string,
  action: ReceiptAction,
): StoredReceipt | null {
  if (typeof window === "undefined") {
    return null;
  }

  const current = readReceipts(account).find(
    (receipt) => receipt.action === action,
  );

  if (current) {
    return current;
  }

  const legacy = readJson(legacyKey(account, action));
  return legacy && legacy.account === account ? legacy : null;
}

export function clearReceipt(account: string, action: ReceiptAction): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const receipts = readReceipts(account).filter(
      (receipt) => receipt.action === action,
    );
    for (const receipt of receipts) {
      window.localStorage.removeItem(receiptKey(receipt));
    }
    window.localStorage.removeItem(legacyKey(account, action));

    const remaining = readReceipts(account).map((receipt) =>
      receiptKey(receipt),
    );
    window.localStorage.setItem(
      indexKey("TESTNET", account),
      JSON.stringify(remaining),
    );
  } catch {
    // No-op when storage is unavailable.
  }
}
