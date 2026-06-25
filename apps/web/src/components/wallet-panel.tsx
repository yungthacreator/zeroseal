"use client";

import { useWallet } from "@/context/wallet-context";
import { readPublicStellarConfig } from "@/lib/stellar/config";
import { shortenAddress } from "@/lib/presentation";

export function WalletPanel() {
  const config = readPublicStellarConfig();
  const { address, network, status, error, connect, clearSession } =
    useWallet();

  const configured = config.configured;
  const matches =
    configured &&
    network?.networkPassphrase === config.value.networkPassphrase;

  const walletState =
    status === "unavailable"
      ? "unavailable"
      : status === "detecting" || status === "requesting_access"
        ? "connecting"
        : status === "wrong_network"
          ? "wrong network"
          : status === "rejected"
            ? "cancelled"
        : address
          ? "connected"
          : "not connected";
  const connecting =
    status === "detecting" || status === "requesting_access";

  const networkState = network?.network ?? "not detected";
  const verifierState = configured ? "ready" : "runtime pending";
  const registryState = configured ? "ready" : "runtime pending";

  return (
    <section className="wallet-section panel panel--ink" id="wallet">
      <div className="shell wallet">
        <div className="wallet__intro">
          <p className="eyebrow">Stellar account</p>
          <h2 className="display display--wallet">Connect with Freighter</h2>
          <p className="wallet__copy">
            Freighter provides the public address and selected Stellar network.
            ZeroSeal never requests or stores a secret key or seed phrase.
          </p>

          <dl className="wallet__summary">
            <div>
              <dt>Wallet</dt>
              <dd>Freighter</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>Stellar Testnet</dd>
            </div>
            <div>
              <dt>Signing</dt>
              <dd>Reviewed securely in Freighter</dd>
            </div>
          </dl>
        </div>

        <div className="terminal" aria-label="ZeroSeal wallet terminal">
          <div className="terminal__bar">
            <div className="terminal__lights" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <span>zeroseal://stellar-session</span>
          </div>

          <div className="terminal__body">
            <p className="terminal__command">
              <span>$</span> zeroseal wallet status
            </p>

            <TerminalLine label="wallet" value={walletState} />
            <TerminalLine label="network" value={networkState} />
            <TerminalLine label="verifier" value={verifierState} />
            <TerminalLine label="registry" value={registryState} />

            {address ? (
              <TerminalLine label="account" value={shortenAddress(address)} />
            ) : null}

            <div className="terminal__action">
              {!address ? (
                  <>
                <button
                  type="button"
                  className="btn btn--yellow btn--terminal"
                  onClick={() => void connect()}
                  disabled={connecting}
                >
                  {connecting
                    ? "Connecting..."
                    : "Connect Freighter"}
                </button>

                  </>
                ) : (
                <button
                  type="button"
                  className="btn btn--outline-light btn--terminal"
                  onClick={clearSession}
                >
                  Disconnect wallet
                </button>
              )}
            </div>

            {!configured ? (
              <div className="terminal__notice" role="status">
                <p>
                  <span>!</span> runtime values pending
                </p>
                <code>
                  add RPC URL, network passphrase, verifier ID and registry ID
                </code>
              </div>
            ) : null}

            {configured && address && !matches ? (
              <p className="terminal__warning" role="alert">
                Switch Freighter to Stellar Testnet to continue.
              </p>
            ) : null}

            {error ? (
              <p className="terminal__warning" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function TerminalLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="terminal__line">
      <span>{label}</span>
      <strong>{value}</strong>
    </p>
  );
}
