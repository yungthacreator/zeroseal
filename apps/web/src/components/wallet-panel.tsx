"use client";

import { readPublicStellarConfig } from "@/lib/stellar/config";
import { useWallet } from "@/context/wallet-context";

function shortenAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-8)}`;
}

export function WalletPanel() {
  const config = readPublicStellarConfig();
  const { address, network, status, error, connect, clearSession } =
    useWallet();

  const networkMatches =
    config.configured &&
    network?.networkPassphrase === config.value.networkPassphrase;

  return (
    <section className="wallet-card" aria-labelledby="wallet-heading">
      <div>
        <p className="eyebrow">Stellar identity</p>
        <h2 id="wallet-heading">Connect your wallet</h2>
        <p className="muted">
          ZeroSeal reads your public address and requests signatures through
          Freighter. Secret keys never enter the application.
        </p>
      </div>

      {!address ? (
        <button
          className="primary-button"
          type="button"
          onClick={() => void connect()}
          disabled={status === "connecting"}
        >
          {status === "connecting" ? "Connecting…" : "Connect Freighter"}
        </button>
      ) : (
        <div className="wallet-details">
          <div className="detail-row">
            <span>Account</span>
            <strong title={address}>{shortenAddress(address)}</strong>
          </div>

          <div className="detail-row">
            <span>Wallet network</span>
            <strong>{network?.network || "Unknown"}</strong>
          </div>

          <div className="detail-row">
            <span>Configuration</span>
            <strong>
              {!config.configured
                ? "Not configured"
                : networkMatches
                  ? "Network matched"
                  : "Wrong network"}
            </strong>
          </div>

          <button
            className="secondary-button"
            type="button"
            onClick={clearSession}
          >
            Clear local session
          </button>
        </div>
      )}

      {error ? <p className="error-message">{error}</p> : null}

      {!config.configured ? (
        <div className="notice">
          <strong>Runtime configuration required</strong>
          <p>
            Add the public RPC, network passphrase, verifier contract, and
            registry contract to a private local environment file.
          </p>
        </div>
      ) : null}

      {config.configured && address && !networkMatches ? (
        <p className="error-message">
          Switch Freighter to the configured ZeroSeal network before signing
          any transaction.
        </p>
      ) : null}
    </section>
  );
}
