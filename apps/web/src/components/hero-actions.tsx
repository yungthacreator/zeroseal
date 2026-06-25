"use client";

import { useWallet } from "@/context/wallet-context";

const FREIGHTER_URL = "https://freighter.app/";

function ExternalLinkIcon() {
  return (
    <svg
      className="external-link"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M7.2 4.2H4.8a1.6 1.6 0 0 0-1.6 1.6v9.4a1.6 1.6 0 0 0 1.6 1.6h9.4a1.6 1.6 0 0 0 1.6-1.6v-2.4M9 11 16.5 3.5M11.8 3.2h5v5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HeroActions() {
  const { address, status, error, connect } = useWallet();
  const connecting =
    status === "detecting" || status === "requesting_access";

  if (address) {
    return (
      <div className="hero-onboarding">
        <div className="hero__actions">
          <a className="btn btn--primary" href="#proof-workspace">
            Open proof workspace
          </a>
          <a className="btn btn--outline" href="#network-activity">
            View live Testnet activity
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="hero-onboarding">
      <div className="hero__actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void connect()}
          disabled={connecting}
        >
          {connecting ? "Connecting..." : "Connect Freighter"}
        </button>
        <a className="btn btn--outline" href="#network-activity">
          View live Testnet activity
        </a>
      </div>

      <div className="wallet-setup">
        <div>
          <strong>Wallet required for Testnet transactions</strong>
          <p>
            Transactions are authorised in Freighter. ZeroSeal never receives
            your secret key.
          </p>
          {error ? <p className="wallet-setup__error">{error}</p> : null}
        </div>
        <div className="wallet-setup__actions">
          <a href={FREIGHTER_URL} target="_blank" rel="noreferrer">
            Get Freighter <ExternalLinkIcon />
          </a>
          <a href={FREIGHTER_URL} target="_blank" rel="noreferrer">
            Installation guide <ExternalLinkIcon />
          </a>
        </div>
      </div>
    </div>
  );
}
