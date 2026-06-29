"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getBackendReceipt,
  getBackendTransaction,
  type ApiReceipt,
  type ApiTransaction,
} from "@/lib/api/claims";
import type { PublicPayload } from "@/lib/claim-flow";
import { shortenAddress } from "@/lib/presentation";
import {
  explorerTransactionUrl,
  fetchTestnetTransaction,
  isLikelyTransactionHash,
  type HorizonTransaction,
} from "@/lib/stellar/testnet";

type LoadState =
  | { phase: "loading" }
  | { phase: "invalid" }
  | { phase: "missing" }
  | { phase: "public-claim"; payload: PublicPayload }
  | { phase: "backend-receipt"; receipt: ApiReceipt }
  | { phase: "backend-transaction"; transaction: ApiTransaction }
  | { phase: "failed"; tx: HorizonTransaction }
  | { phase: "confirmed"; tx: HorizonTransaction };

function formatCreatedAt(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString().replace("T", " ").replace(".000Z", " UTC");
}

export default function ReceiptPage() {
  const params = useParams<{ transactionHash: string }>();
  const rawHash = Array.isArray(params.transactionHash)
    ? params.transactionHash[0]
    : params.transactionHash;
  const hash = (rawHash ?? "").trim();

  const hashIsValid = isLikelyTransactionHash(hash);

  // Initial state is derived synchronously from hash validity so the effect
  // never has to call setState in its body. Invalid links render immediately;
  // valid links start in the loading phase and resolve asynchronously.
  const [state, setState] = useState<LoadState>(() =>
    hashIsValid ? { phase: "loading" } : { phase: "invalid" },
  );
  const [copied, setCopied] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hashIsValid) {
      let cancelled = false;
      const timer = window.setTimeout(async () => {
        try {
          const receipt = await getBackendReceipt(hash);
          if (!cancelled) {
            setState({ phase: "backend-receipt", receipt });
            return;
          }
        } catch {
          // Continue to the local unconfirmed public-claim explanation.
        }

        try {
          const raw = window.localStorage.getItem(`zeroseal:public-claim:${hash}`);
          if (!cancelled && raw) {
            setState({
              phase: "public-claim",
              payload: JSON.parse(raw) as PublicPayload,
            });
          }
        } catch {
          if (!cancelled) {
            setState({ phase: "invalid" });
          }
        }
      }, 0);

      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    const controller = new AbortController();

    getBackendTransaction(hash)
      .then((transaction) => {
        if (!controller.signal.aborted && transaction.status === "CONFIRMED") {
          setState({ phase: "backend-transaction", transaction });
        }
      })
      .catch(() => undefined);

    fetchTestnetTransaction(hash, controller.signal)
      .then((tx) => {
        if (controller.signal.aborted) {
          return;
        }
        if (!tx.exists) {
          setState({ phase: "missing" });
          return;
        }
        if (!tx.successful) {
          setState({ phase: "failed", tx });
          return;
        }
        setState({ phase: "confirmed", tx });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ phase: "missing" });
        }
      });

    return () => controller.abort();
  }, [hash, hashIsValid]);

  useEffect(
    () => () => {
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
    },
    [],
  );

  const copy = useCallback((label: string, value: string) => {
    if (!navigator.clipboard) {
      return;
    }
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(label);
        if (copyTimer.current) {
          clearTimeout(copyTimer.current);
        }
        copyTimer.current = setTimeout(() => setCopied(null), 1600);
      })
      .catch(() => undefined);
  }, []);

  const publicUrl =
    typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="receipt-page">
      <main className="receipt-page__main">
        <Link className="receipt-page__back" href="/">
          &larr; ZeroSeal
        </Link>

        {state.phase === "loading" ? (
          <div className="receipt-page__card">
            <div className="receipt-page__empty">
              <span
                className="receipt-page__state"
                data-tone="loading"
              >
                Loading
              </span>
              <p style={{ marginTop: 14 }}>
                Querying Stellar Testnet for this transaction.
              </p>
            </div>
          </div>
        ) : null}

        {state.phase === "invalid" ? (
          <div className="receipt-page__card">
            <div className="receipt-page__empty">
              <h1>Invalid receipt link</h1>
              <p>
                This link does not contain a valid Stellar transaction hash.
              </p>
            </div>
          </div>
        ) : null}

        {state.phase === "public-claim" ? (
          <div className="receipt-page__card">
            <div className="receipt-page__head">
              <p>ZeroSeal public claim</p>
              <h1>No confirmed transaction yet</h1>
            </div>
            <p>
              This browser has a public claim record for the identifier, but no
              confirmed Stellar transaction hash is attached.
            </p>
            <dl className="receipt-page__rows">
              <ReceiptRow label="Claim identifier" value={state.payload.claimIdentifier} />
              <ReceiptRow label="Network" value={state.payload.network} />
              <ReceiptRow label="Programme context" value={state.payload.programmeContext} />
              <ReceiptRow label="Policy" value={state.payload.publicPolicyIdentifier} />
              <ReceiptRow label="Public threshold" value={state.payload.publicThreshold} />
              <ReceiptRow label="Researcher fingerprint" value={state.payload.researcherFingerprint} mono />
              <ReceiptRow label="Nullifier" value={state.payload.nullifier} mono />
              <ReceiptRow label="Verifier version" value={state.payload.verifierVersion} />
              <ReceiptRow label="Verification state" value={state.payload.verificationResult} />
            </dl>
            <div className="receipt-page__actions">
              <button
                type="button"
                className={`btn btn--outline btn--sm${
                  copied === "url" ? " copied-flash" : ""
                }`}
                onClick={() => copy("url", publicUrl)}
              >
                {copied === "url" ? "Copied" : "Copy receipt URL"}
              </button>
            </div>
          </div>
        ) : null}

        {state.phase === "backend-receipt" ? (
          <div className="receipt-page__card">
            <div className="receipt-page__head">
              <p>ZeroSeal public receipt</p>
              <h1>Confirmed on Stellar Testnet</h1>
            </div>
            <dl className="receipt-page__rows">
              <ReceiptRow label="Network" value={state.receipt.network} />
              <ReceiptRow label="Status" value="Confirmed" tone="ok" />
              <ReceiptRow label="Claim ID" value={state.receipt.claimId} mono />
              <ReceiptRow label="Transaction" value={state.receipt.transactionHash} mono />
              <ReceiptRow label="Ledger" value={String(state.receipt.ledgerNumber)} mono />
              <ReceiptRow label="Contract ID" value={state.receipt.registryContract} mono />
              <ReceiptRow label="Shortened seal" value={shortenAddress(state.receipt.researcherCommitment)} mono />
              <ReceiptRow label="Public rule" value={state.receipt.policyIdentifier} />
              <ReceiptRow label="Confirmed at" value={formatCreatedAt(state.receipt.issuedAt) ?? state.receipt.issuedAt} />
            </dl>
            <div className="receipt-page__actions">
              <a
                className="btn btn--primary btn--sm"
                href={state.receipt.explorerTransactionUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                View on Stellar Explorer
              </a>
            </div>
          </div>
        ) : null}

        {state.phase === "backend-transaction" ? (
          <div className="receipt-page__card">
            <div className="receipt-page__head">
              <p>ZeroSeal transaction record</p>
              <h1>Confirmed transaction found</h1>
            </div>
            <dl className="receipt-page__rows">
              <ReceiptRow label="Network" value="Stellar Testnet" />
              <ReceiptRow label="Status" value="Confirmed" tone="ok" />
              <ReceiptRow label="Transaction" value={state.transaction.transactionHash} mono />
              {state.transaction.ledgerNumber ? (
                <ReceiptRow label="Ledger" value={String(state.transaction.ledgerNumber)} mono />
              ) : null}
              {state.transaction.contractId ? (
                <ReceiptRow label="Contract ID" value={state.transaction.contractId} mono />
              ) : null}
              {state.transaction.researcherCommitment ? (
                <ReceiptRow label="Shortened seal" value={shortenAddress(state.transaction.researcherCommitment)} mono />
              ) : null}
              {state.transaction.confirmedAt ? (
                <ReceiptRow label="Confirmed at" value={formatCreatedAt(state.transaction.confirmedAt) ?? state.transaction.confirmedAt} />
              ) : null}
            </dl>
          </div>
        ) : null}

        {state.phase === "missing" ? (
          <div className="receipt-page__card">
            <div className="receipt-page__empty">
              <h1>No confirmed transaction</h1>
              <p>
                No transaction with this hash was found on Stellar Testnet. It
                may not have been submitted or confirmed.
              </p>
              <p className="mono" style={{ marginTop: 12, fontSize: "0.8rem" }}>
                {shortenAddress(hash)}
              </p>
            </div>
          </div>
        ) : null}

        {state.phase === "failed" ? (
          <div className="receipt-page__card">
            <div className="receipt-page__head">
              <p>ZeroSeal receipt</p>
              <h1>Transaction did not succeed</h1>
            </div>
            <dl className="receipt-page__rows">
              <ReceiptRow label="Network" value="Stellar Testnet" />
              <ReceiptRow
                label="Status"
                value="Failed on Testnet"
                tone="bad"
              />
              <ReceiptRow label="Transaction" value={state.tx.hash} mono />
              {state.tx.ledger ? (
                <ReceiptRow label="Ledger" value={state.tx.ledger} mono />
              ) : null}
            </dl>
            <div className="receipt-page__actions">
              <a
                className="btn btn--outline btn--sm"
                href={explorerTransactionUrl(state.tx.hash)}
                target="_blank"
                rel="noreferrer noopener"
              >
                View on Stellar Explorer
              </a>
            </div>
          </div>
        ) : null}

        {state.phase === "confirmed" ? (
          <div className="receipt-page__card">
            <div className="receipt-page__head">
              <p>ZeroSeal public receipt</p>
              <h1>Confirmed on Stellar Testnet</h1>
            </div>
            <dl className="receipt-page__rows">
              <ReceiptRow label="Network" value="Stellar Testnet" />
              <ReceiptRow
                label="Status"
                value="Confirmed"
                tone="ok"
              />
              <ReceiptRow label="Transaction" value={state.tx.hash} mono />
              {state.tx.ledger ? (
                <ReceiptRow label="Ledger" value={state.tx.ledger} mono />
              ) : null}
              {state.tx.sourceAccount ? (
                <ReceiptRow
                  label="Source account"
                  value={state.tx.sourceAccount}
                  mono
                />
              ) : null}
              {formatCreatedAt(state.tx.createdAt) ? (
                <ReceiptRow
                  label="Confirmed at"
                  value={formatCreatedAt(state.tx.createdAt) as string}
                />
              ) : null}
              {state.tx.operationCount !== null ? (
                <ReceiptRow
                  label="Operations"
                  value={String(state.tx.operationCount)}
                />
              ) : null}
            </dl>
            <div className="receipt-page__actions">
              <a
                className="btn btn--primary btn--sm"
                href={explorerTransactionUrl(state.tx.hash)}
                target="_blank"
                rel="noreferrer noopener"
              >
                View on Stellar Explorer
              </a>
              <button
                type="button"
                className={`btn btn--outline btn--sm${
                  copied === "url" ? " copied-flash" : ""
                }`}
                onClick={() => copy("url", publicUrl)}
              >
                {copied === "url" ? "Copied" : "Copy receipt URL"}
              </button>
              <button
                type="button"
                className={`btn btn--outline btn--sm${
                  copied === "hash" ? " copied-flash" : ""
                }`}
                onClick={() => copy("hash", state.tx.hash)}
              >
                {copied === "hash" ? "Copied" : "Copy transaction hash"}
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function ReceiptRow({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "ok" | "bad";
}) {
  return (
    <div className="receipt-page__row">
      <dt>{label}</dt>
      <dd
        className={mono ? "mono" : undefined}
        style={
          mono
            ? undefined
            : { fontFamily: "var(--font-sans)" }
        }
      >
        {tone ? (
          <span className="receipt-page__state" data-tone={tone}>
            {value}
          </span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
