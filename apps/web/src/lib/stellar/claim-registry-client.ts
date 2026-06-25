import { signTransaction } from "@stellar/freighter-api";
import { Client } from "@/generated/claim-registry-client";
import { DEFAULT_REGISTRY_CONTRACT_ID } from "@/lib/stellar/config";

type ClaimRegistryRuntimeConfig = {
  contractId: string;
  networkPassphrase: string;
  rpcUrl: string;
};

function requirePublicEnvironmentValue(
  name:
    | "NEXT_PUBLIC_REGISTRY_CONTRACT_ID"
    | "NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE"
    | "NEXT_PUBLIC_STELLAR_RPC_URL",
  value: string | undefined,
): string {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(`${name} requires a runtime value.`);
  }

  return normalized;
}

export function readClaimRegistryRuntimeConfig(): ClaimRegistryRuntimeConfig {
  return {
    contractId: requirePublicEnvironmentValue(
      "NEXT_PUBLIC_REGISTRY_CONTRACT_ID",
      process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID ??
        DEFAULT_REGISTRY_CONTRACT_ID,
    ),
    networkPassphrase: requirePublicEnvironmentValue(
      "NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE",
      process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE,
    ),
    rpcUrl: requirePublicEnvironmentValue(
      "NEXT_PUBLIC_STELLAR_RPC_URL",
      process.env.NEXT_PUBLIC_STELLAR_RPC_URL,
    ),
  };
}

export async function createClaimRegistryClient(
  publicKey: string,
): Promise<Client> {
  const normalizedPublicKey = publicKey.trim();

  if (!normalizedPublicKey) {
    throw new Error("A connected Stellar public address is required.");
  }

  const config = readClaimRegistryRuntimeConfig();

  const client = await Client.from({
    contractId: config.contractId,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
    publicKey: normalizedPublicKey,
    signTransaction,
  });

  // Client.from() is typed by the SDK as its base contract client even
  // though it constructs this generated Claim Registry client at runtime.
  return client as unknown as Client;
}
