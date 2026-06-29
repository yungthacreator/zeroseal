"use client";

import { useEffect, useMemo, useState } from "react";

import { useWallet } from "@/context/wallet-context";
import { getWalletActivity } from "@/lib/api/claims";
import { shortenAddress } from "@/lib/presentation";
import { readReceipts, type StoredReceipt } from "@/lib/receipt-store";
import {
  explorerTransactionUrl,
} from "@/lib/stellar/testnet";

type ApiActivityRow = {
  id?: string;
  transactionHash?: string;
  status?: string;
  ledgerNumber?: number | null;
  sourceAccount?: string | null;
  contractId?: string | null;
  method?: string | null;
  operationType?: string | null;
  confirmedAt?: string | null;
  submittedAt?: string | null;
  claimId?: string | null;
};

type ActivityRow = {
  source: "api" | "local";
  action: string;
  status: string;
  transactionHash: string;
  ledger: string | null;
  date: string | null;
  sourceAccount: string | null;
  contractId: string | null;
  claimId: string | null;
};

const ACTION_LABELS: Record<StoredReceipt["action"], string> = {
  register_researcher: "researcher registration",
  submit_claim: "claim submission",
  proof_acceptance: "proof acceptance",
  verification_payment: "XLM verification payment",
};

function actionLabel(action: string): string {
  return action in ACTION_LABELS
    ? ACTION_LABELS[action as StoredReceipt["action"]]
    : action.replaceAll("_", " ");
}

export function OnChainActivity() {
  const { address } = useWallet();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [state, setState] = useState<
    "idle" | "loading" | "backend" | "fallback" | "unavailable"
  >("idle");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!address) {
        setRows([]);
        setState("idle");
        return;
      }

      setState("loading");

      try {
        const activity = await getWalletActivity(address);
        const apiRows = Array.isArray(activity) ? (activity as ApiActivityRow[]) : [];
        const nextRows = apiRows
          .filter((row) => typeof row.transactionHash === "string")
          .map((row): ActivityRow => ({
            source: "api",
            action: row.method ?? row.operationType ?? "transaction",
            status: row.status ?? "UNKNOWN",
            transactionHash: row.transactionHash ?? "",
            ledger:
              typeof row.ledgerNumber === "number"
                ? String(row.ledgerNumber)
                : null,
            date: row.confirmedAt ?? row.submittedAt ?? null,
            sourceAccount: row.sourceAccount ?? null,
            contractId: row.contractId ?? null,
            claimId: row.claimId ?? null,
          }));

        if (!cancelled) {
          setRows(nextRows);
          setState("backend");
        }
      } catch {
        const receipts = readReceipts(address);
        const fallbackRows = receipts.map(
          (receipt): ActivityRow => ({
            source: "local",
            action: receipt.action,
            status: "LOCAL_CACHE",
            transactionHash: receipt.transactionHash,
            ledger: receipt.ledger ?? null,
            date: receipt.confirmedAt ?? receipt.savedAt,
            sourceAccount: receipt.sourceAccount ?? receipt.account,
            contractId: receipt.contractId ?? null,
            claimId: null,
          }),
        );

        if (!cancelled) {
          setRows(fallbackRows);
          setState(fallbackRows.length > 0 ? "fallback" : "unavailable");
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [address]);

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
            ZeroSeal loads persisted wallet activity from the backend. Browser
            cache is used only as a fallback when the API is unavailable.
          </p>
        </header>

        {state === "fallback" ? (
          <p className="activity-empty">
            Backend unavailable. Showing locally retained transaction metadata.
          </p>
        ) : null}

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
                <span role="cell">{actionLabel(row.action)}</span>
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
                ? "Backend unavailable. No local transaction metadata was found."
                : "No transaction has been submitted from this browser."}
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
