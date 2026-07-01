"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  type ApiVerificationResult,
  verifyReceiptIdentifier,
} from "@/lib/api/claims";
import { shortenAddress } from "@/lib/presentation";
import { isLikelyTransactionHash } from "@/lib/stellar/testnet";
import { ZeroSealStamp } from "@/components/zero-seal-stamp";

const AUTO_VERIFY_QUERY_KEYS = ["receipt", "claim", "transaction", "identifier"] as const;
const VERIFICATION_TIMEOUT_MS = 15_000;
const REQUEST_FAILED_MESSAGE = "Receipt verification could not be completed.";

export function extractIdentifier(input: string): string {
  const value = input.trim();
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? value;
  } catch {
    return value;
  }
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<VerifyPageShell />}>
      <VerifyPageContent />
    </Suspense>
  );
}

function VerifyPageShell() {
  return (
    <div className="receipt-page verify-page">
      <main className="receipt-page__main">
        <Link className="receipt-page__back" href="/">
          &larr; ZeroSeal
        </Link>
        <section className="receipt-page__card">
          <div className="receipt-page__empty">
            <span className="receipt-page__state" data-tone="loading">
              Checking receipt
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}

function VerifyPageContent() {
  const searchParams = useSearchParams();
  const queryIdentifier = useMemo(
    () => pickAutoVerificationIdentifier(searchParams),
    [searchParams],
  );
  const [query, setQuery] = useState(() => queryIdentifier);
  const [result, setResult] = useState<ApiVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const autoCheckedRef = useRef<string | null>(null);
  const retryIdentifierRef = useRef("");
  const identifier = useMemo(() => extractIdentifier(query), [query]);
  const isTransaction = isLikelyTransactionHash(identifier);
  const canVerify = Boolean(identifier);

  const runVerification = useCallback(async (value: string) => {
    const normalized = extractIdentifier(value);
    retryIdentifierRef.current = normalized;
    return runVerificationRequest(value, {
      setIsChecking,
      setError,
      setResult,
    });
  }, []);

  useEffect(() => {
    const normalized = extractIdentifier(queryIdentifier);
    if (!shouldRunAutoVerification(queryIdentifier, autoCheckedRef.current)) {
      return;
    }

    autoCheckedRef.current = normalized;
    setQuery(queryIdentifier);
    void runVerification(queryIdentifier);
  }, [queryIdentifier, runVerification]);

  async function verify() {
    if (!canVerify || isChecking) {
      return;
    }
    await runVerification(identifier);
  }

  return (
    <div className="receipt-page verify-page">
      <main className="receipt-page__main">
        <Link className="receipt-page__back" href="/">
          &larr; ZeroSeal
        </Link>
        <section className="receipt-page__card">
          <div className="receipt-page__head">
            <p>VERIFY PUBLIC RECEIPT</p>
            <h1>Check a ZeroSeal receipt.</h1>
          </div>
          <p className="lede">
            Enter a ZeroSeal claim identifier, transaction hash or receipt URL.
            Private evidence is never shown here.
          </p>
          <label className="verify-page__field">
            <span>Receipt, claim identifier or transaction hash</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setResult(null);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void verify();
                }
              }}
              placeholder="Paste receipt URL or transaction hash"
            />
          </label>

          <div className="verify-page__result">
            <span>Detected input</span>
            <strong>{identifier ? shortenAddress(identifier) : "Waiting"}</strong>
            <p>
              {isTransaction
                ? "This Stellar Testnet transaction hash will be checked against the ZeroSeal receipt service."
                : identifier
                  ? "This identifier will be checked against issued ZeroSeal receipts."
                  : "No lookup has been requested."}
            </p>
          </div>

          <div className="receipt-page__actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => void verify()}
              aria-disabled={!canVerify}
              disabled={!canVerify || isChecking}
            >
              {isChecking ? "Checking receipt" : "Verify receipt"}
            </button>
            <Link className="btn btn--outline btn--sm" href="/create">
              Create a private claim
            </Link>
          </div>

          {error ? (
            <div className="verify-page__result" role="alert">
              <span>Verification error</span>
              <strong>Request failed</strong>
              <p>{error}</p>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => void runVerification(retryIdentifierRef.current || identifier)}
              >
                Retry verification
              </button>
            </div>
          ) : null}

          {result ? <VerificationResultCard result={result} /> : null}
        </section>
      </main>
    </div>
  );
}

export function VerificationResultCard({
  result,
}: {
  result: ApiVerificationResult;
}) {
  const tone =
    result.status === "VERIFIED"
      ? "ok"
      : result.status === "FAILED" ||
          result.status === "INVALID" ||
          result.status === "MISMATCHED"
        ? "bad"
        : "loading";
  const receiptPath = result.receipt?.receiptId
    ? `/receipt/${encodeURIComponent(result.receipt.receiptId)}`
    : result.transaction?.transactionHash
      ? `/receipt/${encodeURIComponent(result.transaction.transactionHash)}`
      : result.chain?.hash
        ? `/receipt/${encodeURIComponent(result.chain.hash)}`
        : null;

  return (
    <div className="verify-page__result" role="status" aria-live="polite">
      <span>Verification result</span>
      <strong>
        <span className="receipt-page__state" data-tone={tone}>
          {labelForStatus(result.status)}
        </span>
      </strong>
      <p>{result.message}</p>

      {result.status === "VERIFIED" && result.receipt ? (
        <div className="receipt-page__stamp-row">
          <ZeroSealStamp
            receiptId={result.receipt.receiptId}
            ledgerNumber={result.receipt.ledgerNumber}
            network={result.receipt.network}
            transactionHash={result.receipt.transactionHash}
          />
        </div>
      ) : null}

      <dl className="receipt-page__rows">
        <VerificationRow label="Input type" value={result.inputType} />
        {result.receipt?.receiptId ? (
          <VerificationRow label="Receipt ID" value={result.receipt.receiptId} mono />
        ) : null}
        {result.receipt?.claimId ? (
          <VerificationRow label="Claim ID" value={result.receipt.claimId} mono />
        ) : null}
        {result.receipt?.transactionHash ? (
          <VerificationRow label="Transaction" value={result.receipt.transactionHash} mono />
        ) : result.transaction?.transactionHash ? (
          <VerificationRow label="Transaction" value={result.transaction.transactionHash} mono />
        ) : result.chain?.hash ? (
          <VerificationRow label="Transaction" value={result.chain.hash} mono />
        ) : null}
        {result.receipt?.ledgerNumber ? (
          <VerificationRow label="Ledger" value={String(result.receipt.ledgerNumber)} mono />
        ) : result.transaction?.ledgerNumber ? (
          <VerificationRow label="Ledger" value={String(result.transaction.ledgerNumber)} mono />
        ) : result.chain?.ledger ? (
          <VerificationRow label="Ledger" value={String(result.chain.ledger)} mono />
        ) : null}
        {result.receipt?.walletAddress ? (
          <VerificationRow label="Wallet" value={result.receipt.walletAddress} mono />
        ) : result.transaction?.sourceAccount ? (
          <VerificationRow label="Wallet" value={result.transaction.sourceAccount} mono />
        ) : result.chain?.sourceAccount ? (
          <VerificationRow label="Wallet" value={result.chain.sourceAccount} mono />
        ) : null}
        {result.receipt?.registryContract ? (
          <VerificationRow label="Registry contract" value={result.receipt.registryContract} mono />
        ) : null}
        {result.receipt?.network ? (
          <VerificationRow label="Network" value={result.receipt.network} />
        ) : null}
        {result.receipt?.researcherCommitment ? (
          <VerificationRow label="Researcher commitment" value={result.receipt.researcherCommitment} mono />
        ) : null}
        {result.receipt?.claimCommitment ? (
          <VerificationRow label="Claim commitment" value={result.receipt.claimCommitment} mono />
        ) : null}
        {result.receipt?.nullifier ? (
          <VerificationRow label="Nullifier" value={result.receipt.nullifier} mono />
        ) : null}
      </dl>

      <div className="receipt-page__actions">
        {receiptPath ? (
          <Link className="btn btn--outline btn--sm" href={receiptPath}>
            Open receipt
          </Link>
        ) : null}
        {result.explorer?.transaction ? (
          <a
            className="btn btn--primary btn--sm"
            href={result.explorer.transaction}
            target="_blank"
            rel="noreferrer noopener"
          >
            Open in Stellar Explorer
          </a>
        ) : null}
      </div>
    </div>
  );
}

function VerificationRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="receipt-page__row">
      <dt>{label}</dt>
      <dd className={mono ? "mono" : undefined}>
        {mono ? shortenAddress(value) : value}
      </dd>
    </div>
  );
}

export function labelForStatus(status: ApiVerificationResult["status"]): string {
  switch (status) {
    case "VERIFIED":
      return "VALID ZEROSEAL STAMP";
    case "PENDING_CONFIRMATION":
      return "Pending confirmation";
    case "FAILED":
      return "Failed";
    case "NOT_FOUND":
      return "Not found";
    case "INVALID":
      return "Invalid";
    case "MISMATCHED":
      return "Invalid or mismatched";
  }
}

export function pickAutoVerificationIdentifier(
  params: Pick<URLSearchParams, "get">,
): string {
  for (const key of AUTO_VERIFY_QUERY_KEYS) {
    const value = params.get(key)?.trim();
    if (value) {
      return value;
    }
  }
  return "";
}

export function shouldRunAutoVerification(
  value: string,
  previousValue: string | null,
): boolean {
  const normalized = extractIdentifier(value);
  return Boolean(normalized) && normalized !== previousValue;
}

export async function runVerificationRequest(
  value: string,
  handlers: {
    setIsChecking: (value: boolean) => void;
    setError: (value: string | null) => void;
    setResult: (value: ApiVerificationResult | null) => void;
  },
  options: {
    verifyIdentifier?: (
      identifier: string,
      requestOptions?: RequestInit,
    ) => Promise<ApiVerificationResult>;
    timeoutMs?: number;
  } = {},
): Promise<{ status: "invalid" | "success" | "failed"; identifier: string }> {
  const normalized = extractIdentifier(value);
  if (!normalized) {
    handlers.setResult(null);
    handlers.setError("Invalid identifier.");
    handlers.setIsChecking(false);
    return { status: "invalid", identifier: "" };
  }

  const verifyIdentifier = options.verifyIdentifier ?? verifyReceiptIdentifier;
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? VERIFICATION_TIMEOUT_MS,
  );

  handlers.setIsChecking(true);
  handlers.setError(null);
  handlers.setResult(null);

  try {
    const result = await verifyIdentifier(normalized, {
      signal: controller.signal,
    });
    handlers.setResult(result);
    return { status: "success", identifier: normalized };
  } catch {
    handlers.setError(REQUEST_FAILED_MESSAGE);
    return { status: "failed", identifier: normalized };
  } finally {
    globalThis.clearTimeout(timeout);
    handlers.setIsChecking(false);
  }
}
