"use client";

import { useWallet } from "@/context/wallet-context";
import { readPublicStellarConfig } from "@/lib/stellar/config";
import {
  networkMatchCopy,
  walletStatusCopy,
  type StatusTone,
} from "@/lib/presentation";

type Chip = {
  key: string;
  label: string;
  value: string;
  tone: StatusTone;
};

export function RuntimeStatus() {
  const config = readPublicStellarConfig();
  const { address, network, status } = useWallet();

  const wallet = walletStatusCopy(status);

  const configured = config.configured;
  const matches =
    configured &&
    network?.networkPassphrase === config.value.networkPassphrase;

  const networkState = networkMatchCopy(
    configured,
    Boolean(address),
    Boolean(matches),
  );

  const chips: Chip[] = [
    { key: "wallet", label: "Wallet", value: wallet.label, tone: wallet.tone },
    {
      key: "wallet-network",
      label: "Wallet network",
      value: network?.network ?? "Not detected",
      tone: network?.network ? "active" : "neutral",
    },
    {
      key: "config",
      label: "Configured network",
      value: configured ? "Loaded" : "Not provided",
      tone: configured ? "good" : "warn",
    },
    {
      key: "match",
      label: "Network state",
      value: networkState.label,
      tone: networkState.tone,
    },
  ];

  return (
    <dl className="runtime" aria-label="Live runtime status">
      {chips.map((chip) => (
        <div className="runtime__chip" key={chip.key} data-tone={chip.tone}>
          <dt>{chip.label}</dt>
          <dd>
            <span className="runtime__beacon" aria-hidden="true" />
            {chip.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
