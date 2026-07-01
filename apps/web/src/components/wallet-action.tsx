"use client";

import { useEffect, useRef, useState } from "react";

import { useWallet } from "@/context/wallet-context";
import { shortenAddress } from "@/lib/presentation";

const FREIGHTER_URL = "https://freighter.app/";

export function WalletAction() {
  const { address, network, status, error, connect, clearSession } =
    useWallet();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const connecting =
    status === "detecting" || status === "requesting_access";
  const statusMessage = walletStatusMessage(status, address, error);
  const buttonLabel = walletButtonLabel(status);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (address) {
    const networkLabel = network?.network ?? "Stellar";

    return (
      <div className="wallet-action" data-open={open} ref={rootRef}>
        <button
          type="button"
          className="wallet-pill"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="wallet-pill__dot" aria-hidden="true" />
          <span className="wallet-pill__addr">Connected: {shortenAddress(address)}</span>
          <span className="wallet-pill__net">{networkLabel}</span>
          <svg
            className="wallet-pill__chev"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m6 9 6 6 6-6"
            />
          </svg>
        </button>

        {open ? (
          <div className="wallet-menu" role="menu">
            <dl>
              <div className="wallet-menu__row">
                <dt>Account</dt>
                <dd>{address}</dd>
              </div>
              <div className="wallet-menu__row">
                <dt>Network</dt>
                <dd>{networkLabel}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="btn btn--outline btn--sm wallet-menu__disconnect"
              onClick={() => {
                clearSession();
                setOpen(false);
              }}
            >
              Disconnect wallet
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="wallet-action">
      <button
        type="button"
        className="btn btn--primary btn--sm"
        onClick={() => void connect()}
        disabled={connecting}
      >
        {buttonLabel}
      </button>
      {statusMessage ? (
        <div className="wallet-install" role="status" aria-live="polite">
          <strong>{walletStatusTitle(status)}</strong>
          <p>{statusMessage}</p>
          {!connecting ? (
            <div>
              {status === "unavailable" ? (
                <a href={FREIGHTER_URL} target="_blank" rel="noreferrer">
                  Install official Freighter
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => void connect()}
              >
                Retry connection
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function walletButtonLabel(status: string): string {
  if (status === "detecting") {
    return "Connecting...";
  }
  if (status === "requesting_access") {
    return "Waiting for Freighter approval...";
  }
  return "Connect Freighter";
}

function walletStatusTitle(status: string): string {
  if (status === "detecting") {
    return "Connecting...";
  }
  if (status === "requesting_access") {
    return "Waiting for Freighter approval...";
  }
  if (status === "unavailable") {
    return "Freighter extension not detected";
  }
  if (status === "rejected") {
    return "Connection rejected";
  }
  if (status === "locked") {
    return "Freighter is locked";
  }
  if (status === "wrong_network") {
    return "Switch Freighter to Stellar Testnet";
  }
  if (status === "error") {
    return "Connection failed";
  }
  return "Wallet connection";
}

function walletStatusMessage(
  status: string,
  address: string | null,
  error: string | null,
): string | null {
  if (status === "detecting") {
    return "Connecting...";
  }
  if (status === "requesting_access") {
    return "Waiting for Freighter approval...";
  }
  if (address) {
    return `Connected: ${shortenAddress(address)}`;
  }
  if (status === "unavailable") {
    return "Freighter extension not detected";
  }
  if (status === "rejected") {
    return "Connection rejected";
  }
  if (status === "locked") {
    return "Freighter is locked";
  }
  if (status === "wrong_network") {
    return "Switch Freighter to Stellar Testnet";
  }
  if (status === "error") {
    return `Connection failed: ${error ?? "The wallet request could not be completed."}`;
  }
  return null;
}
