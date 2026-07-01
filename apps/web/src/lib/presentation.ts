// Presentation-only helpers. No secrets, no network calls, no hardcoded
// Stellar identifiers. These derive display strings from state that the
// protected wallet context and Stellar config already expose.

export type WalletStatus =
  | "idle"
  | "detecting"
  | "requesting_access"
  | "connected"
  | "unavailable"
  | "wrong_network"
  | "rejected"
  | "locked"
  | "error";

export function shortenAddress(address: string): string {
  if (address.length <= 14) {
    return address;
  }
  return `${address.slice(0, 6)}\u2026${address.slice(-6)}`;
}

export type StatusTone = "neutral" | "active" | "good" | "warn" | "danger";

export type StatusCopy = {
  label: string;
  tone: StatusTone;
};

export function walletStatusCopy(status: WalletStatus): StatusCopy {
  switch (status) {
    case "connected":
      return { label: "Account connected", tone: "good" };
    case "detecting":
      return { label: "Detecting wallet", tone: "active" };
    case "requesting_access":
      return { label: "Connecting", tone: "active" };
    case "unavailable":
      return { label: "Freighter unavailable", tone: "warn" };
    case "wrong_network":
      return { label: "Wrong network", tone: "danger" };
    case "rejected":
      return { label: "Connection rejected", tone: "warn" };
    case "locked":
      return { label: "Freighter locked", tone: "warn" };
    case "error":
      return { label: "Permission required", tone: "danger" };
    default:
      return { label: "Wallet not connected", tone: "neutral" };
  }
}

export function networkMatchCopy(
  configured: boolean,
  hasAddress: boolean,
  matches: boolean,
): StatusCopy {
  if (!configured) {
    return { label: "Runtime configuration required", tone: "warn" };
  }
  if (!hasAddress) {
    return { label: "Configured network ready", tone: "neutral" };
  }
  return matches
    ? { label: "Network matched", tone: "good" }
    : { label: "Wrong network", tone: "danger" };
}
