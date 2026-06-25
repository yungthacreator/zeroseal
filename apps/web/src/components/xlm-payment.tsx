"use client";

import { signTransaction } from "@stellar/freighter-api";
import {
  Asset,
  BASE_FEE,
  Horizon,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { useMemo, useState } from "react";

import { useWallet } from "@/context/wallet-context";
import { shortenAddress } from "@/lib/presentation";
import {
  explorerTransactionUrl,
  fetchTestnetTransaction,
} from "@/lib/stellar/testnet";
import { persistReceipt } from "@/lib/receipt-store";

type PaymentState =
  | "idle"
  | "loading"
  | "awaiting-approval"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "rejected"
  | "failed";

type PaymentReceipt = {
  hash: string;
  ledger: string | null;
  source: string;
  destination: string;
  amount: string;
};

const HORIZON_TESTNET_URL = "https://horizon-testnet.stellar.org";

function readFeeAmount(): string {
  const configured =
    process.env.NEXT_PUBLIC_ZEROSEAL_VERIFICATION_FEE_XLM?.trim() || "1";

  if (!/^\d+(?:\.\d{1,7})?$/.test(configured)) {
    return "1";
  }

  return Number(configured) > 0 ? configured : "1";
}

function readTreasuryAddress(): string | null {
  const value = process.env.NEXT_PUBLIC_ZEROSEAL_TREASURY_ADDRESS?.trim();

  if (!value || !/^G[A-Z2-7]{55}$/.test(value)) {
    return null;
  }

  return value;
}

function paymentErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "The payment transaction could not be completed.";
}

function wasRejected(error: unknown): boolean {
  const message = paymentErrorMessage(error).toLowerCase();
  return message.includes("reject") || message.includes("declin");
}

function statusLabel(state: PaymentState, hasWallet: boolean): string {
  switch (state) {
    case "loading":
      return "Loading transaction";
    case "awaiting-approval":
      return "Awaiting approval";
    case "submitted":
      return "Submitted";
    case "confirming":
      return "Confirming";
    case "confirmed":
      return "Confirmed";
    default:
      return hasWallet ? "Pay 1 XLM" : "Connect Freighter";
  }
}

export function XlmPayment() {
  const { address, network, status, connect } = useWallet();
  const [paymentState, setPaymentState] = useState<PaymentState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const treasury = useMemo(() => readTreasuryAddress(), []);
  const feeAmount = useMemo(() => readFeeAmount(), []);
  const connectedToTestnet =
    status === "connected" && network?.network?.toUpperCase() === "TESTNET";
  const busy =
    paymentState === "loading" ||
    paymentState === "awaiting-approval" ||
    paymentState === "submitted" ||
    paymentState === "confirming";

  const flash = (key: string) => {
    setCopied(key);
    window.setTimeout(
      () => setCopied((current) => (current === key ? null : current)),
      1400,
    );
  };

  const copyValue = async (key: string, value: string) => {
    if (!navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      flash(key);
    } catch {
      // Value remains visible for manual copy.
    }
  };

  const payVerificationFee = async () => {
    if (!treasury) {
      return;
    }

    if (!address) {
      await connect();
      return;
    }

    if (!connectedToTestnet) {
      setPaymentState("failed");
      setMessage("Switch Freighter to Stellar Testnet.");
      return;
    }

    setReceipt(null);
    setPaymentState("loading");
    setMessage("Loading payment transaction.");

    try {
      const server = new Horizon.Server(HORIZON_TESTNET_URL);
      const source = await server.loadAccount(address);
      const transaction = new TransactionBuilder(source, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: treasury,
            asset: Asset.native(),
            amount: feeAmount,
          }),
        )
        .setTimeout(180)
        .build();

      setPaymentState("awaiting-approval");
      setMessage("Ready for wallet approval.");

      const signed = await signTransaction(transaction.toXDR(), {
        address,
        networkPassphrase: Networks.TESTNET,
      });

      if (signed.error) {
        throw new Error(signed.error.message);
      }

      const signedTransaction = TransactionBuilder.fromXDR(
        signed.signedTxXdr,
        Networks.TESTNET,
      );

      setPaymentState("submitted");
      setMessage("Submitted to Stellar Testnet.");

      const response = await server.submitTransaction(signedTransaction);
      const hash = response.hash;

      setPaymentState("confirming");
      setMessage("Confirming on Stellar Testnet.");

      // Confirm the payment independently against Horizon before showing a
      // confirmed receipt. Never present an unconfirmed submission as final.
      const confirmation = await fetchTestnetTransaction(hash);

      if (!confirmation.exists || !confirmation.successful) {
        setPaymentState("failed");
        setMessage("The payment could not be confirmed on Stellar Testnet.");
        return;
      }

      const confirmed: PaymentReceipt = {
        hash,
        ledger: confirmation.ledger,
        source: confirmation.sourceAccount ?? address,
        destination: treasury,
        amount: feeAmount,
      };

      setReceipt(confirmed);
      setPaymentState("confirmed");
      setMessage("Payment confirmed on Stellar Testnet.");

      persistReceipt({
        schemaVersion: 2,
        network: "TESTNET",
        action: "verification_payment",
        status: "confirmed",
        transactionHash: hash,
        ledger: confirmation.ledger,
        account: address,
        sourceAccount: confirmation.sourceAccount ?? address,
        contractFunction: "payment",
        confirmedAt: confirmation.createdAt,
        amount: feeAmount,
        destination: treasury,
        savedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (wasRejected(error)) {
        setPaymentState("rejected");
        setMessage("Approval was rejected in Freighter.");
        return;
      }

      setPaymentState("failed");
      setMessage(paymentErrorMessage(error));
    }
  };

  const explorerUrl = receipt ? explorerTransactionUrl(receipt.hash) : null;

  if (!treasury) {
    return null;
  }

  return (
    <div className="payment-inline">
      <div className="payment-card" data-state={paymentState}>
        <div className="payment-card__top">
          <span>Purchase verification credit</span>
          <strong>{feeAmount} test XLM</strong>
        </div>

        <dl className="payment-card__details">
          <div>
            <dt>Network</dt>
            <dd>Stellar Testnet</dd>
          </div>
          <div>
            <dt>Purpose</dt>
            <dd>Verification credit</dd>
          </div>
          <div>
            <dt>Destination</dt>
            <dd title={treasury}>{shortenAddress(treasury)}</dd>
          </div>
          <div>
            <dt>Wallet</dt>
            <dd title={address ?? undefined}>
              {address ? shortenAddress(address) : "Wallet required"}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          className="payment-card__button"
          onClick={() => void payVerificationFee()}
          disabled={busy}
        >
          {statusLabel(paymentState, Boolean(address)).replace(
            "Pay 1 XLM",
            `Pay ${feeAmount} XLM`,
          )}
        </button>

        {message ? (
          <p className="payment-card__status" role="status">
            {message}
          </p>
        ) : null}
      </div>

      {receipt ? (
        <section
          className="receipt-panel xlm-receipt"
              aria-label="XLM payment receipt"
            >
              <div className="receipt-panel__head">
                <div>
                  <p>XLM PAYMENT RECEIPT</p>
                  <h3>Payment confirmed</h3>
                </div>
                <span className="receipt-panel__status" data-confirmed="true">
                  Confirmed
                </span>
              </div>

              <dl className="receipt-panel__rows">
                <div className="receipt-panel__row">
                  <dt>Network</dt>
                  <dd>Stellar Testnet</dd>
                  <span />
                </div>
                <div className="receipt-panel__row">
                  <dt>Amount</dt>
                  <dd>{receipt.amount} XLM</dd>
                  <span />
                </div>
                <div className="receipt-panel__row">
                  <dt>Source</dt>
                  <dd title={receipt.source}>{shortenAddress(receipt.source)}</dd>
                  <span />
                </div>
                <div className="receipt-panel__row">
                  <dt>Destination</dt>
                  <dd title={receipt.destination}>
                    {shortenAddress(receipt.destination)}
                  </dd>
                  <span />
                </div>
                <div className="receipt-panel__row">
                  <dt>Transaction</dt>
                  <dd title={receipt.hash}>{shortenAddress(receipt.hash)}</dd>
                  <span>
                    <button
                      type="button"
                      onClick={() => void copyValue("hash", receipt.hash)}
                    >
                      {copied === "hash" ? "Copied" : "Copy"}
                    </button>
                  </span>
                </div>
                {receipt.ledger ? (
                  <div className="receipt-panel__row">
                    <dt>Ledger</dt>
                    <dd>{receipt.ledger}</dd>
                    <span />
                  </div>
                ) : null}
              </dl>

              <div className="receipt-panel__actions">
                {explorerUrl ? (
                  <a href={explorerUrl} target="_blank" rel="noreferrer">
                    View payment on Explorer
                  </a>
                ) : null}
                {explorerUrl ? (
                  <button
                    type="button"
                    onClick={() => void copyValue("link", explorerUrl)}
                  >
                    {copied === "link" ? "Copied" : "Copy transaction link"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void copyValue("hash2", receipt.hash)}
                >
                  {copied === "hash2" ? "Copied" : "Copy transaction hash"}
                </button>
              </div>
            </section>
          ) : null}
    </div>
  );
}
