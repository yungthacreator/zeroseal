"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { getPublicReceipts, verifyReceiptHref } from "@/lib/api/claims";
import { shortenAddress } from "@/lib/presentation";
import {
  explorerTransactionUrl,
} from "@/lib/stellar/testnet";
import { ZeroSealStamp } from "@/components/zero-seal-stamp";

type ActivityRow = {
  action: string;
  status: string;
  transactionHash: string;
  ledger: string | null;
  date: string | null;
  claimId: string | null;
  receiptId: string;
  network: string;
};

const ACTION_LABELS: Record<string, string> = {
  submit_claim: "Claim stamped",
  proof_acceptance: "proof acceptance",
  verification_payment: "XLM verification payment",
};

function actionLabel(action: string): string {
  return action in ACTION_LABELS
    ? ACTION_LABELS[action]
    : action.replaceAll("_", " ");
}

export function OnChainActivity() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [state, setState] = useState<
    "idle" | "loading" | "backend" | "unavailable"
  >("idle");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState("loading");

      try {
        const receipts = await getPublicReceipts();
        const nextRows = (Array.isArray(receipts) ? receipts : [])
          .filter((row) => typeof row.transactionHash === "string")
          .filter((row) => row.status === "CONFIRMED" || row.status === undefined)
          .map((row): ActivityRow => ({
            action: row.actionLabel ?? row.method ?? "submit_claim",
            status: "CONFIRMED",
            transactionHash: row.transactionHash ?? "",
            ledger:
              typeof row.ledgerNumber === "number"
                ? String(row.ledgerNumber)
                : null,
            date: row.issuedAt ?? null,
            claimId: row.claimId ?? null,
            receiptId: row.receiptId,
            network: row.network,
          }));

        if (!cancelled) {
          setRows(nextRows);
          setState("backend");
        }
      } catch {
        if (!cancelled) {
          setRows([]);
          setState("unavailable");
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          new Date(b.date ?? 0).getTime() -
          new Date(a.date ?? 0).getTime(),
      ),
    [rows],
  );

  const copyHash = async (hash: string) => {
    if (!navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(hash);
      setCopied(hash);
      window.setTimeout(() => {
        setCopied((current) => (current === hash ? null : current));
      }, 1400);
    } catch {
      // Hash remains visible through the title attribute.
    }
  };

  return (
    <section className="section section--paper" id="verified-activity">
      <div className="shell">
        <header className="section__head section__head--split">
          <div>
            <p className="eyebrow">On-chain activity</p>
            <h2 className="display display--lg">Network activity and public receipts</h2>
          </div>
          <p className="lede">
            ZeroSeal shows only confirmed and reconciled receipts from the
            backend.
          </p>
        </header>

        {visibleRows.length > 0 ? (
          <div className="activity-table" role="table" aria-label="Verified ZeroSeal transactions">
            <div className="activity-table__head" role="row">
              <span role="columnheader">Action</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Transaction</span>
              <span role="columnheader">Ledger</span>
              <span role="columnheader">Date</span>
              <span role="columnheader">Actions</span>
            </div>
            {visibleRows.map((row) => (
              <div
                className="activity-table__row"
                role="row"
                key={row.transactionHash}
              >
                <span role="cell" className="activity-table__action">
                  <ZeroSealStamp
                    receiptId={row.receiptId}
                    ledgerNumber={Number(row.ledger ?? 0)}
                    network={row.network}
                    transactionHash={row.transactionHash}
                    compact
                  />
                  {actionLabel(row.action)}
                </span>
                <span role="cell">{row.status}</span>
                <span role="cell" className="mono" title={row.transactionHash}>
                  {shortenAddress(row.transactionHash)}
                </span>
                <span role="cell">{row.ledger ?? "unavailable"}</span>
                <span role="cell">
                  {row.date
                    ? new Date(row.date).toLocaleString()
                    : "unavailable"}
                </span>
                <span role="cell" className="activity-table__actions">
                  <a
                    href={explorerTransactionUrl(row.transactionHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View transaction on Stellar Expert
                  </a>
                  <Link href={`/receipt/${encodeURIComponent(row.receiptId)}`}>
                    View stamped receipt
                  </Link>
                  <Link href={verifyReceiptHref(row.receiptId)}>
                    Verify receipt
                  </Link>
                  <button
                    type="button"
                    onClick={() => void copyHash(row.transactionHash)}
                  >
                    {copied === row.transactionHash ? "Copied" : "Copy hash"}
                  </button>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="activity-empty">
            <p>
              {state === "unavailable"
                ? "Receipt service is temporarily unavailable. No unverified records are being displayed."
                : "No confirmed public receipts are available yet."}
            </p>
            <a className="btn btn--outline btn--sm" href="#proof-workspace">
              Open live workspace
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
