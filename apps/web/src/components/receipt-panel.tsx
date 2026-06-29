"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { shortenAddress } from "@/lib/presentation";
import {
  explorerAccountUrl,
  explorerContractUrl,
  explorerTransactionUrl,
  fetchTestnetTransaction,
} from "@/lib/stellar/testnet";

export { explorerTransactionUrl };

export type ReceiptData = {
  title?: string;
  statusLabel?: string;
  action: string;
  // When transactionHash is null the receipt represents verified contract
  // state without an identifiable original transaction. No explorer link
  // or transaction hash is shown, and none is fabricated.
  transactionHash: string | null;
  ledger?: string | number | null;
  researcher?: string | null;
  contractId: string;
  commitment?: string | null;
  nullifier?: string | null;
  confirmedAt?: string | null;
  verifierContractId?: string | null;
};

export function ReceiptPanel({ receipt }: { receipt: ReceiptData }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [chainMeta, setChainMeta] = useState<{
    ledger: string | null;
    confirmedAt: string | null;
  }>({
    ledger: null,
    confirmedAt: receipt.confirmedAt ?? null,
  });

  const hasTransaction = Boolean(receipt.transactionHash);
  const explorerUrl = receipt.transactionHash
    ? explorerTransactionUrl(receipt.transactionHash)
    : null;
  const registryUrl = explorerContractUrl(receipt.contractId);
  const verifierUrl = receipt.verifierContractId
    ? explorerContractUrl(receipt.verifierContractId)
    : null;
  const researcherUrl = receipt.researcher
    ? explorerAccountUrl(receipt.researcher)
    : null;
  const receiptUrl =
    typeof window !== "undefined" && receipt.transactionHash
      ? `${window.location.origin}/receipt/${receipt.transactionHash}`
      : null;

  useEffect(() => {
    if (!receipt.transactionHash) {
      return;
    }

    const controller = new AbortController();

    fetchTestnetTransaction(receipt.transactionHash, controller.signal)
      .then((tx) => {
        if (controller.signal.aborted || !tx.exists || !tx.successful) {
          return;
        }
        setChainMeta({
          ledger: tx.ledger ?? (receipt.ledger ? String(receipt.ledger) : null),
          confirmedAt: tx.createdAt ?? receipt.confirmedAt ?? null,
        });
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [receipt.confirmedAt, receipt.ledger, receipt.transactionHash]);

  const displayLedger = chainMeta.ledger ?? (receipt.ledger ? String(receipt.ledger) : null);
  const displayConfirmedAt = chainMeta.confirmedAt ?? receipt.confirmedAt ?? null;

  const receiptJson = useMemo(
    () =>
      JSON.stringify(
        {
          network: "Stellar Testnet",
          status:
            receipt.statusLabel ??
            (hasTransaction ? "Confirmed" : "Transaction provenance unavailable"),
          action: receipt.action,
          transaction: receipt.transactionHash ?? null,
          ledger: displayLedger,
          confirmed_at: displayConfirmedAt,
          researcher: receipt.researcher ?? null,
          registry: receipt.contractId,
          commitment: receipt.commitment ?? null,
          nullifier: receipt.nullifier ?? null,
          explorer: explorerUrl,
          researcher_explorer: researcherUrl,
          registry_explorer: registryUrl,
          verifier_explorer: verifierUrl,
        },
        null,
        2,
      ),
    [
      displayConfirmedAt,
      displayLedger,
      explorerUrl,
      hasTransaction,
      receipt,
      registryUrl,
      researcherUrl,
      verifierUrl,
    ],
  );

  const copyValue = async (key: string, value: string) => {
    if (!navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => {
        setCopied((current) => (current === key ? null : current));
      }, 1400);
    } catch {
      // Values stay visible when clipboard permission is unavailable.
    }
  };

  const shareReceipt = async () => {
    if (!receiptUrl) {
      return;
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "ZeroSeal receipt",
          url: receiptUrl,
        });
        return;
      } catch {
        // Fall through to clipboard copy when share is dismissed.
      }
    }
    await copyValue("share", receiptUrl);
  };

  return (
    <section
      className="receipt-panel"
      id="receipt-explorer"
      aria-labelledby="receipt-heading"
    >
      <div className="receipt-panel__head">
        <div>
          <p>{receipt.title ?? "Researcher registration"}</p>
          <h3 id="receipt-heading">
            {hasTransaction
              ? "Confirmed on Stellar Testnet"
              : "Registry state found"}
          </h3>
        </div>
        <span className="receipt-panel__status" data-confirmed={hasTransaction}>
          {hasTransaction
            ? (receipt.statusLabel ?? "Confirmed")
            : "No local transaction hash"}
        </span>
      </div>

      <dl className="receipt-panel__rows">
        <ReceiptRow label="Network" value="Stellar Testnet" />
        <ReceiptRow
          label="Status"
          value={
            receipt.statusLabel ??
            (hasTransaction ? "Confirmed" : "Transaction provenance unavailable")
          }
        />
        <ReceiptRow label="Action" value={receipt.action} />

        {receipt.researcher ? (
          <ReceiptRow
            label="Researcher"
            value={shortenAddress(receipt.researcher)}
            title={receipt.researcher}
          />
        ) : null}

        <ReceiptRow
          label="Registry contract"
          value={shortenAddress(receipt.contractId)}
          title={receipt.contractId}
        />

        {receipt.commitment ? (
          <ReceiptRow
            label="Commitment"
            value={shortenAddress(receipt.commitment)}
            title={receipt.commitment}
          />
        ) : null}

        {receipt.transactionHash ? (
          <ReceiptRow
            label="Transaction hash"
            value={shortenAddress(receipt.transactionHash)}
            title={receipt.transactionHash}
            action={
              <button
                type="button"
                onClick={() =>
                  void copyValue("transaction", receipt.transactionHash ?? "")
                }
              >
                {copied === "transaction" ? "Copied" : "Copy"}
              </button>
            }
          />
        ) : (
          <ReceiptRow
            label="Transaction hash"
            value="Registration exists on-chain. The original transaction was not retained by this browser."
          />
        )}

        {displayLedger ? (
          <ReceiptRow label="Ledger number" value={displayLedger} />
        ) : null}

        {displayConfirmedAt ? (
          <ReceiptRow label="Confirmed time" value={displayConfirmedAt} />
        ) : null}

        {receipt.nullifier ? (
          <ReceiptRow
            label="Nullifier"
            value={shortenAddress(receipt.nullifier)}
            title={receipt.nullifier}
          />
        ) : null}
      </dl>

      <div className="receipt-panel__actions">
        {explorerUrl ? (
          <a
            className="receipt-panel__primary-action"
            href={explorerUrl}
            target="_blank"
            rel="noreferrer"
          >
            View transaction on Stellar Expert
          </a>
        ) : null}
        <a href={registryUrl} target="_blank" rel="noreferrer">
          View registry contract
        </a>
        {verifierUrl ? (
          <a href={verifierUrl} target="_blank" rel="noreferrer">
            View verifier contract
          </a>
        ) : null}
        {researcherUrl ? (
          <a href={researcherUrl} target="_blank" rel="noreferrer">
            View researcher account
          </a>
        ) : null}
        {receipt.transactionHash ? (
          <button
            type="button"
            onClick={() =>
              void copyValue("hash", receipt.transactionHash ?? "")
            }
          >
            {copied === "hash" ? "Copied" : "Copy transaction hash"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void copyValue("json", receiptJson)}
        >
          {copied === "json" ? "Copied" : "Copy public receipt"}
        </button>
        {receiptUrl ? (
          <button type="button" onClick={() => void shareReceipt()}>
            {copied === "share" ? "Link copied" : "Share receipt"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ReceiptRow({
  label,
  value,
  title,
  action,
}: {
  label: string;
  value: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <div className="receipt-panel__row">
      <dt>{label}</dt>
      <dd title={title}>{value}</dd>
      <span>{action}</span>
    </div>
  );
}
