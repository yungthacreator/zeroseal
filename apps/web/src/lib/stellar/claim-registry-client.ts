import { signTransaction } from "@stellar/freighter-api";
import { Buffer } from "buffer";
import { Address, Networks, TransactionBuilder, scValToNative, xdr } from "@stellar/stellar-sdk";
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

export type SubmitClaimSignedXdrReadiness = {
  decoded: DecodedSubmitClaimArgs;
  signatureCount: number;
  feeStroops: string;
  sorobanResourceFee: string;
};

type ExpectedSubmitClaim = {
  contractId: string;
  researcher: string;
  researcherCommitment: string;
  claimCommitment: string;
  nullifier: string;
};

type ResearcherCommitmentLookupClient = {
  get_researcher_commitment: (
    args: { researcher: string },
  ) => Promise<{ result: unknown }>;
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

export async function resolveOnChainResearcherCommitment(
  client: ResearcherCommitmentLookupClient,
  researcher: string,
  sealFingerprint: string,
): Promise<string> {
  const firstClaimCommitment = normalizeBytesN32Hex(
    sealFingerprint,
    "Seal researcher fingerprint",
  );

  let lookup;
  try {
    lookup = await client.get_researcher_commitment({ researcher });
  } catch (error) {
    if (isResearcherNotRegisteredError(error)) {
      return firstClaimCommitment;
    }
    throw error;
  }

  let result: unknown;
  try {
    result = lookup.result;
  } catch (error) {
    if (isResearcherNotRegisteredError(error)) {
      return firstClaimCommitment;
    }
    throw error;
  }

  if (isRustResultLike(result) && result.isErr()) {
    const contractError = result.unwrapErr();
    if (isResearcherNotRegisteredError(contractError)) {
      return firstClaimCommitment;
    }
    throw new Error(
      `Claim Registry researcher commitment lookup failed: ${unknownErrorMessage(contractError) || "unknown contract error"}`,
    );
  }

  const commitment = isRustResultLike(result) ? result.unwrap() : result;
  return normalizeBytesN32Hex(
    commitment,
    "Claim Registry researcher commitment",
  );
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

export function assertSubmitClaimSignedXdrReady({
  signedXdr,
  networkPassphrase,
  expected,
}: {
  signedXdr: string;
  networkPassphrase: string;
  expected: ExpectedSubmitClaim;
}): SubmitClaimSignedXdrReadiness {
  if (networkPassphrase !== Networks.TESTNET) {
    throw new Error("Signed submit_claim XDR must target Stellar Testnet.");
  }

  const envelope = xdr.TransactionEnvelope.fromXDR(signedXdr, "base64");
  if (envelope.switch().name !== "envelopeTypeTx") {
    throw new Error("Signed submit_claim XDR must be a standard transaction envelope.");
  }

  const signatureCount = envelope.v1().signatures().length;
  if (signatureCount < 1) {
    throw new Error("Signed submit_claim XDR has no transaction signature.");
  }

  const transaction = envelope.v1().tx();
  const sorobanData = transaction.ext().value();
  const sorobanResourceFee =
    typeof sorobanData?.resourceFee === "function"
      ? sorobanData.resourceFee().toString()
      : "";

  if (!sorobanData || !sorobanResourceFee) {
    throw new Error("Signed submit_claim XDR is missing Soroban transaction data.");
  }

  if (BigInt(sorobanResourceFee) <= BigInt(0)) {
    throw new Error("Signed submit_claim XDR has an invalid Soroban resource fee.");
  }

  const parsed = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
  if (!("fee" in parsed)) {
    throw new Error("Signed submit_claim XDR must not be a fee-bump envelope.");
  }

  const feeStroops = parsed.fee;
  if (BigInt(feeStroops) <= BigInt(100)) {
    throw new Error("Signed submit_claim XDR still has only an unassembled base fee.");
  }

  const decoded = decodeSubmitClaimArgsFromXdr(signedXdr);
  if (
    decoded.contractId !== expected.contractId ||
    decoded.method !== "submit_claim" ||
    decoded.researcher !== expected.researcher ||
    decoded.researcherCommitment !== expected.researcherCommitment ||
    decoded.claimCommitment !== expected.claimCommitment ||
    decoded.nullifier !== expected.nullifier
  ) {
    throw new Error("Signed submit_claim XDR does not match the reviewed public commitments.");
  }

  return {
    decoded,
    signatureCount,
    feeStroops,
    sorobanResourceFee,
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

function normalizeBytesN32Hex(value: unknown, label: string): string {
  const hex =
    typeof value === "string"
      ? value.replace(/^0x/i, "").toLowerCase()
      : bytesHex(value);

  if (!hex || !/^[0-9a-f]{64}$/.test(hex)) {
    throw new Error(`${label} must be exactly 32 bytes.`);
  }

  return hex;
}

function isRustResultLike(
  value: unknown,
): value is { isErr: () => boolean; unwrapErr: () => unknown; unwrap: () => unknown } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const object = value as Record<string, unknown>;
  return (
    typeof object.isErr === "function" &&
    typeof object.unwrap === "function"
  );
}

function isResearcherNotRegisteredError(error: unknown): boolean {
  const message = unknownErrorMessage(error).toLowerCase();
  return (
    message.includes("researchernotregistered") ||
    message.includes("error(contract, #6)") ||
    message.includes("error(contract, 6)") ||
    message.includes("contract error #6") ||
    message.includes("contract error 6") ||
    message.includes("contract, #6") ||
    message.includes("contract, 6")
  );
}

function unknownErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error) ?? "";
  } catch {
    return "";
  }
}
