"use client";

import { useEffect, useState } from "react";

import { useWallet } from "@/context/wallet-context";
import { getWalletActivity } from "@/lib/api/claims";
import { shortenAddress } from "@/lib/presentation";
import { readReceipt, type StoredReceipt } from "@/lib/receipt-store";
import {
  DEFAULT_REGISTRY_CONTRACT_ID,
  DEFAULT_VERIFIER_CONTRACT_ID,
} from "@/lib/stellar/config";
import {
  explorerContractUrl,
  explorerTransactionUrl,
} from "@/lib/stellar/testnet";

const LIFECYCLE = [
  {
    key: "connect",
    title: "CONNECT",
    body: "Freighter exposes a Testnet account for authorisation.",
  },
  {
    key: "commit",
    title: "COMMIT",
    body: "A researcher commitment is loaded from approved public inputs.",
  },
  {
    key: "prove",
    title: "PROVE",
    body: "The approved UltraHonk artifact supplies the proof material.",
  },
  {
    key: "authorise",
    title: "AUTHORISE",
    body: "Freighter signs the Claim Registry transaction.",
  },
  {
    key: "verify",
    title: "VERIFY",
    body: "Soroban verifier results are shown only after confirmed proof checks.",
  },
  {
    key: "record",
    title: "RECORD",
    body: "The Claim Registry stores the replay-protected receipt.",
  },
] as const;

export function StellarActivity() {
  const { address, network, status } = useWallet();
  const [registrationReceipt, setRegistrationReceipt] =
    useState<StoredReceipt | null>(null);
  const [apiState, setApiState] = useState<
    "idle" | "loading" | "ready" | "unavailable"
  >("idle");
  const [latestTransaction, setLatestTransaction] =
    useState<Record<string, unknown> | null>(null);

  const registryContractId =
    process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID?.trim() ||
    DEFAULT_REGISTRY_CONTRACT_ID;
  const verifierContractId =
    process.env.NEXT_PUBLIC_VERIFIER_CONTRACT_ID?.trim() ||
    DEFAULT_VERIFIER_CONTRACT_ID;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRegistrationReceipt(
        address ? readReceipt(address, "register_researcher") : null,
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, [address]);

  useEffect(() => {
    if (!address) {
      const timer = window.setTimeout(() => {
        setApiState("idle");
        setLatestTransaction(null);
      }, 0);

      return () => window.clearTimeout(timer);
    }

    let cancelled = false;
    const loadingTimer = window.setTimeout(() => {
      if (!cancelled) {
        setApiState("loading");
      }
    }, 0);

    getWalletActivity(address)
      .then((activity) => {
        if (cancelled) {
          return;
        }

        const rows = Array.isArray(activity) ? activity : [];
        setLatestTransaction(
          (rows[0] as Record<string, unknown> | undefined) ?? null,
        );
        setApiState("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setApiState("unavailable");
          setLatestTransaction(null);
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimer);
    };
  }, [address]);

  const connected = status === "connected" && Boolean(address);
  const hasCommitment = Boolean(registrationReceipt?.commitment);
  const hasRegistryReceipt = Boolean(registrationReceipt?.transactionHash);

  const stateByKey: Record<(typeof LIFECYCLE)[number]["key"], boolean> = {
    connect: connected,
    commit: hasCommitment,
    prove: false,
    authorise: hasRegistryReceipt,
    verify: false,
    record: hasRegistryReceipt,
  };

  const apiHash =
    typeof latestTransaction?.transactionHash === "string"
      ? latestTransaction.transactionHash
      : null;
  const latestHash = apiHash ?? registrationReceipt?.transactionHash ?? null;
  const latestTransactionUrl = latestHash
    ? explorerTransactionUrl(latestHash)
    : null;
  const apiLedger =
    typeof latestTransaction?.ledgerNumber === "number"
      ? String(latestTransaction.ledgerNumber)
      : null;
  const apiStatus =
    typeof latestTransaction?.status === "string"
      ? latestTransaction.status
      : null;

  return (
    <div className="network-lifecycle">
      <div className="network-lifecycle__steps" aria-label="ZeroSeal network lifecycle">
        {LIFECYCLE.map((stage) => (
          <article
            className="network-lifecycle__stage"
            data-active={stateByKey[stage.key]}
            key={stage.key}
          >
            <span>{stage.title}</span>
            <p>{stage.body}</p>
            {stage.key === "record" && latestTransactionUrl ? (
              <a href={latestTransactionUrl} target="_blank" rel="noreferrer">
                View transaction
              </a>
            ) : null}
            {stage.key === "verify" ? (
              <a
                href={explorerContractUrl(verifierContractId)}
                target="_blank"
                rel="noreferrer"
              >
                View verifier contract
              </a>
            ) : null}
          </article>
        ))}
      </div>

      <dl className="activity-ledger">
        <div>
          <dt>Connected account</dt>
          <dd title={address ?? undefined}>
            {address ? shortenAddress(address) : "No wallet connected"}
          </dd>
        </div>
        <div>
          <dt>Registry contract</dt>
          <dd title={registryContractId}>{shortenAddress(registryContractId)}</dd>
        </div>
        <div>
          <dt>Verifier contract</dt>
          <dd title={verifierContractId}>{shortenAddress(verifierContractId)}</dd>
        </div>
        <div>
          <dt>Latest registration status</dt>
          <dd>
            {apiStatus ??
              (apiState === "unavailable"
                ? "Backend unavailable"
                : registrationReceipt
                  ? "confirmed from retained receipt"
                  : "No transaction has been submitted for this claim")}
          </dd>
        </div>
        <div>
          <dt>Latest transaction hash</dt>
          <dd title={apiHash ?? registrationReceipt?.transactionHash ?? undefined}>
            {apiHash
              ? shortenAddress(apiHash)
              : registrationReceipt?.transactionHash
                ? shortenAddress(registrationReceipt.transactionHash)
                : "No transaction has been submitted for this claim"}
          </dd>
        </div>
        <div>
          <dt>Latest ledger</dt>
          <dd>{apiLedger ?? registrationReceipt?.ledger ?? "No ledger yet"}</dd>
        </div>
        <div>
          <dt>Current network</dt>
          <dd>
            {connected
              ? (network?.network ?? "Network unavailable")
              : "Wallet not connected"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
