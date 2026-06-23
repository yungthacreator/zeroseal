"use client";

import { useWallet } from "@/context/wallet-context";
import { shortenAddress } from "@/lib/presentation";

export function WalletAction() {
  const { address, status, error, connect, clearSession } = useWallet();

  if (address) {
    return (
      <div className="wallet-action" data-state="connected">
        <span className="wallet-action__address" title={address}>
          <span className="wallet-action__dot" aria-hidden="true" />
          {shortenAddress(address)}
        </span>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={clearSession}
        >
          Clear session
        </button>
        <span className="visually-hidden" aria-live="polite">
          Stellar account connected.
        </span>
      </div>
    );
  }

  return (
    <div className="wallet-action">
      <button
        type="button"
        className="btn btn--solid btn--sm"
        onClick={() => void connect()}
        disabled={status === "connecting"}
      >
        {status === "connecting" ? "Connecting\u2026" : "Connect Freighter"}
      </button>
      <span className="visually-hidden" role="status" aria-live="polite">
        {error ?? ""}
      </span>
    </div>
  );
}
