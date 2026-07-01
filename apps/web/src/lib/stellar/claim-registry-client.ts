import { signTransaction } from "@stellar/freighter-api";
import { Buffer } from "buffer";
import { Address, scValToNative, xdr } from "@stellar/stellar-sdk";
import { Client as ContractClient, type AssembledTransaction } from "@stellar/stellar-sdk/contract";
import { DEFAULT_REGISTRY_CONTRACT_ID } from "@/lib/stellar/config";

type ClaimRegistryRuntimeConfig = {
  contractId: string;
  networkPassphrase: string;
  rpcUrl: string;
};

export type ClaimReceipt = {
  accepted_ledger: number;
  researcher: string;
  researcher_commitment: Buffer;
  claim_commitment: Buffer;
  nullifier: Buffer;
};

type ResearcherCommitmentResult = {
  isErr: () => boolean;
  unwrapErr: () => unknown;
  unwrap: () => Buffer;
};

export type ClaimRegistryClient = ContractClient & {
  get_researcher_commitment: (
    args: { researcher: string },
    options?: { fee?: string; simulate?: boolean; timeoutInSeconds?: number },
  ) => Promise<AssembledTransaction<ResearcherCommitmentResult>>;
  register_researcher: (
    args: { researcher: string; researcher_commitment: Buffer },
    options?: { fee?: string; simulate?: boolean; timeoutInSeconds?: number },
  ) => Promise<AssembledTransaction<void>>;
  submit_claim: (
    args: {
      researcher: string;
      researcher_commitment: Buffer;
      claim_commitment: Buffer;
      nullifier: Buffer;
    },
    options?: { fee?: string; simulate?: boolean; timeoutInSeconds?: number },
  ) => Promise<AssembledTransaction<ClaimReceipt>>;
};

export type DecodedSubmitClaimArgs = {
  contractId: string;
  method: "submit_claim";
  researcher: string;
  researcherCommitment: string;
  claimCommitment: string;
  nullifier: string;
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
): Promise<ClaimRegistryClient> {
  const normalizedPublicKey = publicKey.trim();

  if (!normalizedPublicKey) {
    throw new Error("A connected Stellar public address is required.");
  }

  const config = readClaimRegistryRuntimeConfig();

  const client = await ContractClient.from({
    contractId: config.contractId,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
    publicKey: normalizedPublicKey,
    signTransaction,
  });

  return client as ClaimRegistryClient;
}

export function decodeSubmitClaimArgsFromXdr(
  signableXdr: string,
): DecodedSubmitClaimArgs {
  const envelope = xdr.TransactionEnvelope.fromXDR(signableXdr, "base64");
  const transaction =
    envelope.switch().name === "envelopeTypeTx"
      ? envelope.v1().tx()
      : envelope.switch().name === "envelopeTypeTxFeeBump"
        ? envelope.feeBump().tx().innerTx().v1().tx()
        : null;

  const operation = transaction?.operations()[0];
  const body = operation?.body();
  if (
    !transaction ||
    transaction.operations().length !== 1 ||
    !body ||
    body.switch().name !== "invokeHostFunction"
  ) {
    throw new Error("Signable XDR does not contain one submit_claim invocation.");
  }

  const hostFunction = body.invokeHostFunctionOp().hostFunction();
  if (hostFunction.switch().name !== "hostFunctionTypeInvokeContract") {
    throw new Error("Signable XDR does not contain a contract invocation.");
  }

  const invocation = hostFunction.invokeContract();
  const method = invocation.functionName().toString();
  if (method !== "submit_claim") {
    throw new Error("Signable XDR method is not submit_claim.");
  }

  const args = invocation.args();
  if (args.length !== 4) {
    throw new Error("submit_claim XDR must contain four public arguments.");
  }

  const researcher = scValToNative(args[0]);
  const researcherCommitment = bytesHex(scValToNative(args[1]));
  const claimCommitment = bytesHex(scValToNative(args[2]));
  const nullifier = bytesHex(scValToNative(args[3]));

  if (
    typeof researcher !== "string" ||
    !researcherCommitment ||
    !claimCommitment ||
    !nullifier
  ) {
    throw new Error("submit_claim XDR contains malformed public arguments.");
  }

  return {
    contractId: Address.fromScAddress(invocation.contractAddress()).toString(),
    method: "submit_claim",
    researcher,
    researcherCommitment,
    claimCommitment,
    nullifier,
  };
}

function bytesHex(value: unknown): string | null {
  if (Buffer.isBuffer(value)) {
    return value.toString("hex");
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("hex");
  }
  return null;
}
