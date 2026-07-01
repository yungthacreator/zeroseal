import { rpc, TransactionBuilder } from "@stellar/stellar-sdk";

export type StellarSubmissionServer = {
  sendTransaction: (transaction: unknown) => Promise<unknown>;
  getTransaction: (hash: string) => Promise<unknown>;
};

export type ConfirmedStellarSubmission = {
  hash: string;
  ledger: string | null;
};

type SubmitSignedXdrInput = {
  signedTxXdr: string;
  networkPassphrase: string;
  rpcUrl: string;
  server?: StellarSubmissionServer;
  sleep?: (milliseconds: number) => Promise<void>;
  maxPollAttempts?: number;
  pollIntervalMs?: number;
};

const DEFAULT_MAX_POLL_ATTEMPTS = 40;
const DEFAULT_POLL_INTERVAL_MS = 1_500;
const NESTED_RESPONSE_KEYS = [
  "sendTransactionResponse",
  "getTransactionResponse",
  "response",
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function responseStatus(value: unknown): string {
  const record = asRecord(value);
  const status = record?.status;
  return typeof status === "string" ? status.trim().toUpperCase() : "";
}

export function responseHash(value: unknown, depth = 0): string | null {
  if (depth > 3) {
    return null;
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  for (const key of ["hash", "txHash", "transactionHash"] as const) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  for (const key of NESTED_RESPONSE_KEYS) {
    const nested = responseHash(record[key], depth + 1);
    if (nested) {
      return nested;
    }
  }

  return null;
}

export function responseLedger(value: unknown, depth = 0): string | null {
  if (depth > 3) {
    return null;
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  for (const key of ["ledger", "ledgerSequence", "ledger_attr"] as const) {
    const candidate = record[key];
    if (typeof candidate === "string" || typeof candidate === "number") {
      return String(candidate);
    }
  }

  for (const key of NESTED_RESPONSE_KEYS) {
    const nested = responseLedger(record[key], depth + 1);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function rpcFailureDetails(value: unknown): string {
  const record = asRecord(value);
  if (!record) {
    return "";
  }

  const details: string[] = [];
  for (const key of [
    "status",
    "errorResult",
    "message",
    "error",
    "resultXdr",
    "latestLedger",
  ] as const) {
    const candidate = record[key];

    if (
      typeof candidate === "string" ||
      typeof candidate === "number" ||
      typeof candidate === "boolean" ||
      typeof candidate === "bigint"
    ) {
      details.push(`${key}=${String(candidate)}`);
      continue;
    }

    if (candidate && typeof candidate === "object") {
      try {
        const serialized = JSON.stringify(candidate, (_key, nested) =>
          typeof nested === "bigint" ? nested.toString() : nested,
        );
        if (serialized) {
          details.push(`${key}=${serialized}`);
        }
      } catch {
        // Ignore diagnostic values that cannot be serialised safely.
      }
    }
  }

  const joined = details.join("; ");
  return joined ? ` Stellar RPC details: ${joined.slice(0, 2000)}` : "";
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function submitSignedXdr({
  signedTxXdr,
  networkPassphrase,
  rpcUrl,
  server,
  sleep = defaultSleep,
  maxPollAttempts = DEFAULT_MAX_POLL_ATTEMPTS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: SubmitSignedXdrInput): Promise<ConfirmedStellarSubmission> {
  const attempts = Math.max(1, Math.trunc(maxPollAttempts));
  const interval = Math.max(0, Math.trunc(pollIntervalMs));
  const client =
    server ??
    (new rpc.Server(rpcUrl) as unknown as StellarSubmissionServer);
  const transaction = TransactionBuilder.fromXDR(
    signedTxXdr,
    networkPassphrase,
  );

  let sent: unknown;
  try {
    sent = await client.sendTransaction(transaction);
  } catch (error) {
    const detail =
      error instanceof Error && error.message ? ` Details: ${error.message}` : "";
    throw new Error(
      `Stellar RPC did not confirm whether it accepted the signed transaction. No ZeroSeal receipt was created. Check Freighter or Stellar Explorer before retrying.${detail}`,
    );
  }

  const initialStatus = responseStatus(sent);
  const hash = responseHash(sent);

  if (initialStatus === "ERROR") {
    throw new Error(
      `Stellar transaction submission failed before confirmation. No ZeroSeal receipt was created.${rpcFailureDetails(sent)}`,
    );
  }

  if (initialStatus === "TRY_AGAIN_LATER") {
    throw new Error(
      `Stellar RPC asked ZeroSeal to retry later. No transaction was confirmed and no receipt was created.${rpcFailureDetails(sent)}`,
    );
  }

  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
    throw new Error(
      "Stellar did not return a valid transaction hash. No ZeroSeal receipt was created.",
    );
  }

  let sawRpcError = false;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const confirmation = await client.getTransaction(hash);
      const status = responseStatus(confirmation);

      if (status === "SUCCESS") {
        return {
          hash,
          ledger: responseLedger(confirmation),
        };
      }

      if (status === "FAILED") {
        throw new Error(
          `Stellar Testnet transaction failed for ${hash}. No ZeroSeal receipt was created.${rpcFailureDetails(confirmation)}`,
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Stellar Testnet transaction failed")
      ) {
        throw error;
      }
      sawRpcError = true;
    }

    if (attempt < attempts - 1) {
      await sleep(interval);
    }
  }

  const timeoutSeconds = Math.max(
    1,
    Math.ceil((attempts * interval) / 1_000),
  );
  const rpcNote = sawRpcError
    ? " Stellar RPC also failed to answer at least one confirmation check."
    : "";

  throw new Error(
    `Stellar did not confirm transaction ${hash} within ${timeoutSeconds} seconds. No ZeroSeal receipt was created.${rpcNote} Check this hash in Stellar Explorer before retrying the Testnet action.`,
  );
}