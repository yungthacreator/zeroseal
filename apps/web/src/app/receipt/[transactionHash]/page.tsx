"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getBackendReceipt,
  type ApiReceipt,
  verifyReceiptHref,
} from "@/lib/api/claims";
import { shortenAddress } from "@/lib/presentation";
import { ZeroSealStamp } from "@/components/zero-seal-stamp";

type LoadState =
  | { phase: "loading" }
  | { phase: "invalid" }
  | { phase: "missing" }
  | { phase: "backend-receipt"; receipt: ApiReceipt };

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

  const identifierIsValid = hash.length > 0;

  // Initial state is derived synchronously from hash validity so the effect
  // never has to call setState in its body. Invalid links render immediately;
  // valid links start in the loading phase and resolve asynchronously.
  const [state, setState] = useState<LoadState>(() =>
    identifierIsValid ? { phase: "loading" } : { phase: "invalid" },
  );

  useEffect(() => {
    const controller = new AbortController();

    getBackendReceipt(hash)
      .then((receipt) => {
        if (!controller.signal.aborted) {
          setState({ phase: "backend-receipt", receipt });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState(identifierIsValid ? { phase: "missing" } : { phase: "invalid" });
        }
      });

    return () => controller.abort();
  }, [hash, identifierIsValid]);

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

        {state.phase === "backend-receipt" ? (
          <div className="receipt-page__card receipt-page__document">
            <div className="receipt-page__head">
              <p>ZeroSeal public receipt</p>
              <h1>Stamp confirmed</h1>
            </div>
            <div className="receipt-page__stamp-row">
              <ZeroSealStamp
                receiptId={state.receipt.receiptId}
                ledgerNumber={state.receipt.ledgerNumber}
                network={state.receipt.network}
                transactionHash={state.receipt.transactionHash}
              />
            </div>
            <dl className="receipt-page__rows">
              <ReceiptRow label="Network" value={state.receipt.network} />
              <ReceiptRow label="Status" value="Stamp confirmed" tone="ok" />
              <ReceiptRow label="Receipt ID" value={state.receipt.receiptId} mono copy />
              <ReceiptRow label="Claim ID" value={state.receipt.claimId} mono />
              <ReceiptRow label="Transaction" value={state.receipt.transactionHash} mono />
              <ReceiptRow label="Ledger" value={String(state.receipt.ledgerNumber)} mono />
              <ReceiptRow label="Wallet" value={state.receipt.walletAddress} mono />
              <ReceiptRow label="Registry contract" value={state.receipt.registryContract} mono />
              <ReceiptRow label="Method" value={state.receipt.method ?? "submit_claim"} />
              <ReceiptRow label="Researcher commitment" value={state.receipt.researcherCommitment} mono />
              {state.receipt.claimCommitment ? (
                <ReceiptRow label="Claim commitment" value={state.receipt.claimCommitment} mono />
              ) : null}
              {state.receipt.nullifier ? (
                <ReceiptRow label="Nullifier" value={state.receipt.nullifier} mono />
              ) : null}
              <ReceiptRow label="Public rule" value={state.receipt.policyIdentifier} />
              <ReceiptRow label="Confirmed at" value={formatCreatedAt(state.receipt.issuedAt) ?? state.receipt.issuedAt} />
            </dl>
            <p className="receipt-page__privacy">
              Private exploit evidence remains sealed and is not included in this public receipt.
            </p>
            <div className="receipt-page__qr" aria-label="Public verification link">
              <span className="receipt-page__qr-mark" aria-hidden="true" />
              <div>
                <strong>Verification URL</strong>
                <p className="mono">/verify?receipt={state.receipt.receiptId}</p>
              </div>
            </div>
            <div className="receipt-page__actions">
              <a
                className="btn btn--primary btn--sm"
                href={state.receipt.explorerTransactionUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                View stamped transaction
              </a>
              <Link className="btn btn--outline btn--sm" href={verifyReceiptHref(state.receipt.receiptId)}>
                Verify receipt
              </Link>
              <button className="btn btn--outline btn--sm" type="button" onClick={() => window.print()}>
                Print stamped receipt
              </button>
            </div>
          </div>
        ) : null}


        {state.phase === "missing" ? (
          <div className="receipt-page__card">
            <div className="receipt-page__empty">
              <h1>No confirmed transaction</h1>
              <p>
                No transaction with this hash was found on Stellar Testnet. It
                may be confirmed on Stellar but not reconciled into a ZeroSeal receipt yet.
              </p>
              <p className="mono" style={{ marginTop: 12, fontSize: "0.8rem" }}>
                {shortenAddress(hash)}
              </p>
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
  copy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "ok" | "bad";
  copy?: boolean;
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
          <>
            {value}
            {copy ? (
              <button
                className="copy-inline"
                type="button"
                onClick={() => navigator.clipboard?.writeText(value)}
              >
                Copy
              </button>
            ) : null}
          </>
        )}
      </dd>
    </div>
  );
}
