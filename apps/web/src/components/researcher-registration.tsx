"use client";

import { Buffer } from "buffer";
import { useEffect, useMemo, useState } from "react";

import { DesktopSigningNotice } from "@/components/desktop-signing-notice";
import {
  EvidenceManifest,
  type EvidenceCommitmentPayload,
} from "@/components/evidence-manifest";
import { ReceiptPanel } from "@/components/receipt-panel";
import {
  VerifiedArtifactLoader,
  type VerifiedArtifact,
} from "@/components/verified-artifact-loader";
import { XlmPayment } from "@/components/xlm-payment";
import { useWallet } from "@/context/wallet-context";
import {
  attachClaimEvidence,
  createBackendClaim,
  getApiReadiness,
  getProgrammes,
  recoverResearcherRegistration,
  recordBackendTransaction,
  requestBackendVerification,
  submitBackendProof,
  type ApiErrorState,
} from "@/lib/api/claims";
import { shortenAddress } from "@/lib/presentation";
import { createClaimRegistryClient } from "@/lib/stellar/claim-registry-client";
import {
  DEFAULT_REGISTRY_CONTRACT_ID,
  DEFAULT_VERIFIER_CONTRACT_ID,
} from "@/lib/stellar/config";
import {
  persistReceipt,
  readReceipt,
  type StoredReceipt,
} from "@/lib/receipt-store";

type SubmissionState =
  | "idle"
  | "preparing"
  | "awaiting-signature"
  | "submitting"
  | "confirmed"
  | "error";

type RegistrationLookupState =
  | "idle"
  | "checking"
  | "available"
  | "matched"
  | "mismatch"
  | "error";

type NodeState = "pending" | "checking" | "verified" | "warning" | "failed";

type RailNode = {
  id: string;
  label: string;
  value: string;
  state: NodeState;
  full?: string;
};

const FINGERPRINT_SEGMENTS = 16;

function normalizeCommitment(value: string): string {
  return value.trim().replace(/^0x/i, "").toLowerCase();
}

function extractTransactionHash(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const object = value as Record<string, unknown>;

  for (const key of ["hash", "txHash", "transactionHash"]) {
    if (typeof object[key] === "string" && object[key]) {
      return object[key] as string;
    }
  }

  for (const key of [
    "sendTransactionResponse",
    "getTransactionResponse",
    "response",
  ]) {
    const nested = extractTransactionHash(object[key]);

    if (nested) {
      return nested;
    }
  }

  return null;
}

function extractLedger(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const object = value as Record<string, unknown>;

  for (const key of ["ledger", "ledgerSequence", "ledger_attr"]) {
    const ledger = object[key];

    if (typeof ledger === "string" || typeof ledger === "number") {
      return String(ledger);
    }
  }

  for (const key of [
    "sendTransactionResponse",
    "getTransactionResponse",
    "response",
  ]) {
    const nested = extractLedger(object[key]);

    if (nested) {
      return nested;
    }
  }

  return null;
}

function extractFinalStatus(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const object = value as Record<string, unknown>;

  if (typeof object.status === "string") {
    return object.status;
  }

  for (const key of [
    "getTransactionResponse",
    "sendTransactionResponse",
    "response",
  ]) {
    const nested = extractFinalStatus(object[key]);

    if (nested) {
      return nested;
    }
  }

  return null;
}

function contractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return String(error);
}

function isResearcherAlreadyRegistered(error: unknown): boolean {
  const message = contractErrorMessage(error);

  return (
    message.includes("Error(Contract, #6)") ||
    message.includes("ResearcherAlreadyRegistered")
  );
}

function isResearcherNotRegistered(error: unknown): boolean {
  const message = contractErrorMessage(error);

  return (
    message.includes("Error(Contract, #7)") ||
    message.includes("ResearcherNotRegistered")
  );
}

function isApiError(error: unknown): error is ApiErrorState {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  );
}

function readableWalletError(error: unknown): string {
  const message = contractErrorMessage(error);

  if (isResearcherAlreadyRegistered(error)) {
    return "This wallet already has a registered commitment.";
  }

  if (
    message.toLowerCase().includes("declined") ||
    message.toLowerCase().includes("rejected")
  ) {
    return "Approval was rejected in Freighter.";
  }

  return message || "The registration could not be completed.";
}

function buttonLabel(
  state: SubmissionState,
  lookupState: RegistrationLookupState,
): string {
  if (lookupState === "checking") {
    return "Checking Testnet";
  }

  if (lookupState === "matched") {
    return "Registration confirmed";
  }

  if (lookupState === "mismatch") {
    return "Commitment conflict";
  }

  if (lookupState === "error") {
    return "Verification unavailable";
  }

  switch (state) {
    case "preparing":
      return "Loading";
    case "awaiting-signature":
      return "Approve in Freighter";
    case "submitting":
      return "Confirming";
    case "confirmed":
      return "Registration confirmed";
    default:
      return "Register commitment";
  }
}

function SealMark({ state }: { state: NodeState }) {
  return (
    <span className="zs-seal" data-state={state}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          className="zs-seal__edge"
          d="M12 3 L19.04 6.39 L20.77 14 L15.9 20.11 L8.1 20.11 L3.23 14 L4.96 6.39 Z"
        />
        {state === "verified" ? (
          <path className="zs-seal__check" d="M7.9 12.3 L10.7 15.1 L16.1 8.9" />
        ) : null}
        {state === "failed" ? (
          <path
            className="zs-seal__x"
            d="M8.7 8.7 L15.3 15.3 M15.3 8.7 L8.7 15.3"
          />
        ) : null}
        {state === "warning" ? (
          <>
            <path className="zs-seal__bang" d="M12 7.7 L12 12.9" />
            <circle className="zs-seal__bang-dot" cx="12" cy="15.5" r="0.95" />
          </>
        ) : null}
        {state === "checking" ? (
          <circle className="zs-seal__pulse" cx="12" cy="12" r="2.6" />
        ) : null}
        {state === "pending" ? (
          <circle className="zs-seal__dot" cx="12" cy="12" r="1.7" />
        ) : null}
      </svg>
    </span>
  );
}

export function ResearcherRegistration() {
  const {
    address,
    network,
    status: walletStatus,
    error: walletError,
    connect,
  } = useWallet();

  const [commitment, setCommitment] = useState("");
  const [loadedArtifact, setLoadedArtifact] =
    useState<VerifiedArtifact | null>(null);
  const [claimId, setClaimId] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [evidenceCommitment, setEvidenceCommitment] = useState<string | null>(null);
  const [evidenceBindingStatus, setEvidenceBindingStatus] =
    useState<string>("LOCAL_ONLY");
  const [programmes, setProgrammes] = useState<Array<Record<string, unknown>>>([]);
  const [programmeMessage, setProgrammeMessage] = useState<string | null>(null);
  const [programmeRetryNonce, setProgrammeRetryNonce] = useState(0);
  const [programmeCanRetry, setProgrammeCanRetry] = useState(false);
  const [backendMessage, setBackendMessage] = useState<string | null>(null);
  const [submissionState, setSubmissionState] =
    useState<SubmissionState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [transactionLedger, setTransactionLedger] = useState<string | null>(
    null,
  );
  const [restoredReceipt, setRestoredReceipt] =
    useState<StoredReceipt | null>(null);
  const [reconciliationNonce, setReconciliationNonce] = useState(0);
  const [registrationLookup, setRegistrationLookup] = useState<{
    key: string;
    state: RegistrationLookupState;
  }>({
    key: "",
    state: "idle",
  });

  const registryContractId =
    process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID?.trim() ||
    DEFAULT_REGISTRY_CONTRACT_ID;
  const verifierContractId =
    process.env.NEXT_PUBLIC_VERIFIER_CONTRACT_ID?.trim() ||
    DEFAULT_VERIFIER_CONTRACT_ID;

  const normalizedCommitment = useMemo(
    () => normalizeCommitment(commitment),
    [commitment],
  );

  const selectedProgramme = programmes[0] ?? null;
  const selectedSnapshot =
    selectedProgramme &&
    Array.isArray(selectedProgramme.snapshots) &&
    typeof selectedProgramme.snapshots[0] === "object" &&
    selectedProgramme.snapshots[0] !== null
      ? (selectedProgramme.snapshots[0] as Record<string, unknown>)
      : null;
  const selectedPolicy =
    selectedProgramme &&
    Array.isArray(selectedProgramme.policies) &&
    typeof selectedProgramme.policies[0] === "object" &&
    selectedProgramme.policies[0] !== null
      ? (selectedProgramme.policies[0] as Record<string, unknown>)
      : null;
  const programmeName =
    typeof selectedProgramme?.name === "string"
      ? selectedProgramme.name
      : "ZeroSeal Security Impact Demo";
  const programmeIdentifier =
    typeof selectedProgramme?.identifier === "string"
      ? selectedProgramme.identifier
      : "zeroseal-security-impact-demo";
  const snapshotIdentifier =
    typeof selectedSnapshot?.identifier === "string"
      ? selectedSnapshot.identifier
      : "security-impact-demo-v1";
  const snapshotExpiry =
    typeof selectedSnapshot?.expiresAt === "string"
      ? selectedSnapshot.expiresAt
      : "2030-01-01T00:00:00.000Z";
  const policyIdentifier =
    typeof selectedPolicy?.identifier === "string"
      ? selectedPolicy.identifier
      : "published-impact-threshold-v1";
  const policyRule =
    typeof selectedPolicy?.rule === "string"
      ? selectedPolicy.rule
      : "private demonstrated loss is greater than or equal to the public minimum loss threshold";
  const circuitIdentifier =
    typeof selectedPolicy?.circuitId === "string"
      ? selectedPolicy.circuitId
      : "security-impact-v1";

  const validCommitment = /^[0-9a-f]{64}$/.test(normalizedCommitment);
  const correctNetwork = network?.network?.toUpperCase() === "TESTNET";
  const walletConnected = walletStatus === "connected" && Boolean(address);
  const walletReady = walletConnected && correctNetwork;
  const walletConnecting =
    walletStatus === "detecting" || walletStatus === "requesting_access";

  const lookupKey =
    walletReady && address && validCommitment
      ? `${address}:${normalizedCommitment}`
      : "";

  const registrationState: RegistrationLookupState = lookupKey
    ? registrationLookup.key === lookupKey
      ? registrationLookup.state
      : "checking"
    : "idle";

  const busy =
    submissionState === "preparing" ||
    submissionState === "awaiting-signature" ||
    submissionState === "submitting";

  const canRegister =
    walletReady &&
    validCommitment &&
    Boolean(loadedArtifact) &&
    registrationState === "available" &&
    !busy;

  const ensureBackendClaim = async (): Promise<string | null> => {
    if (!address || !loadedArtifact) {
      return null;
    }

    if (claimId) {
      return claimId;
    }

    try {
      setBackendMessage("Creating persistent claim.");
      const claim = await createBackendClaim({
        walletAddress: address,
        researcherCommitment: loadedArtifact.commitment,
        nullifier: loadedArtifact.nullifier,
        evidenceCommitment: evidenceCommitment ?? undefined,
        publicInputs: loadedArtifact.publicInputs,
        idempotencyKey: [
          "security-impact",
          address,
          loadedArtifact.commitment,
          loadedArtifact.nullifier,
        ].join(":"),
      });

      setClaimId(claim.id);
      setClaimStatus(claim.status);
      setBackendMessage("Claim persisted.");

      try {
        await submitBackendProof(claim.id, loadedArtifact.rawArtifact);
        setClaimStatus("PROOF_RECEIVED");
        setBackendMessage("Proof artifact structurally validated.");

        await requestBackendVerification(claim.id);
        setClaimStatus("VERIFYING");
        setBackendMessage("Verification job queued.");
      } catch (error) {
        setBackendMessage(
          isApiError(error)
            ? error.message
            : "Backend verification queue unavailable",
        );
      }

      return claim.id;
    } catch (error) {
      const message = isApiError(error)
        ? error.message
        : "Backend unavailable";
      setBackendMessage(message);
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    const delays = [900, 1600, 2800, 4500];

    const loadProgrammes = async (attempt = 0) => {
      try {
        setProgrammeCanRetry(false);
        setProgrammeMessage(
          attempt > 0 ? "Starting ZeroSeal verification service" : null,
        );
        await getApiReadiness();
        const items = await getProgrammes();
        if (!cancelled) {
          setProgrammes(items);
          setProgrammeMessage(null);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        const apiError = isApiError(error) ? error : null;
        if (
          apiError?.code !== "API_UNCONFIGURED" &&
          attempt < delays.length
        ) {
          setProgrammeMessage("Starting ZeroSeal verification service");
          timer = window.setTimeout(() => {
            void loadProgrammes(attempt + 1);
          }, delays[attempt]);
          return;
        }
        if (!cancelled) {
          setProgrammeCanRetry(true);
          setProgrammeMessage(
            apiError?.code === "API_UNCONFIGURED"
              ? "Production API is not configured"
              : "Verification service is not ready",
          );
        }
      }
    };

    void loadProgrammes();

    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [programmeRetryNonce]);

  const attachEvidence = async (payload: EvidenceCommitmentPayload) => {
    setEvidenceCommitment(payload.evidenceCommitment);

    if (!claimId) {
      setEvidenceBindingStatus("LOCAL_ONLY");
      return;
    }

    try {
      await attachClaimEvidence(claimId, payload);
      setEvidenceBindingStatus("ATTACHED_TO_CLAIM");
      setBackendMessage("Evidence commitment attached to claim.");
    } catch (error) {
      setEvidenceBindingStatus("LOCAL_ONLY");
      setBackendMessage(
        isApiError(error)
          ? error.message
          : "Evidence commitment could not be attached.",
      );
    }
  };

  useEffect(() => {
    if (!lookupKey || !address) {
      return;
    }

    let cancelled = false;

    const reconcileRegistration = async () => {
      try {
        const client = await createClaimRegistryClient(address);
        const transaction = await client.get_researcher_commitment({
          researcher: address,
        });

        if (cancelled) {
          return;
        }

        if (transaction.result.isErr()) {
          const contractError = transaction.result.unwrapErr();

          if (isResearcherNotRegistered(contractError)) {
            setRegistrationLookup({
              key: lookupKey,
              state: "available",
            });
            setSubmissionState((current) =>
              current === "confirmed" || current === "error"
                ? "idle"
                : current,
            );
            setMessage(null);
            return;
          }

          throw new Error(contractErrorMessage(contractError));
        }

        const registeredCommitment = Buffer.from(
          transaction.result.unwrap(),
        )
          .toString("hex")
          .toLowerCase();

        if (registeredCommitment === normalizedCommitment) {
          // Revalidate any persisted receipt before showing a confirmed
          // state. A stored receipt is only trusted when its commitment
          // still matches live contract state for this account.
          const stored = readReceipt(address, "register_researcher");
          setRestoredReceipt(
            stored && stored.commitment === normalizedCommitment
              ? stored
              : null,
          );

          if (!stored || stored.commitment !== normalizedCommitment) {
            recoverResearcherRegistration(address, normalizedCommitment)
              .then((recovered) => {
                if (cancelled || recovered.status !== "RECOVERED") {
                  return;
                }

                const transaction = recovered.transaction as
                  | Record<string, unknown>
                  | undefined;
                const hash =
                  typeof transaction?.transactionHash === "string"
                    ? transaction.transactionHash
                    : null;

                if (!hash) {
                  return;
                }

                const recoveredReceipt: StoredReceipt = {
                  schemaVersion: 2,
                  network: "TESTNET",
                  action: "register_researcher",
                  status: "confirmed",
                  transactionHash: hash,
                  ledger:
                    typeof transaction?.ledgerNumber === "number"
                      ? String(transaction.ledgerNumber)
                      : null,
                  account: address,
                  sourceAccount:
                    typeof transaction?.sourceAccount === "string"
                      ? transaction.sourceAccount
                      : address,
                  contractId: registryContractId,
                  verifierContractId,
                  contractFunction: "register_researcher",
                  commitment: normalizedCommitment,
                  confirmedAt:
                    typeof transaction?.confirmedAt === "string"
                      ? transaction.confirmedAt
                      : null,
                  savedAt: new Date().toISOString(),
                };
                persistReceipt(recoveredReceipt);
                setRestoredReceipt(recoveredReceipt);
                setMessage("Researcher registration transaction recovered.");
              })
              .catch(() => {
                if (!cancelled) {
                  setMessage(
                    "Registry state found. Transaction provenance unavailable.",
                  );
                }
              });
          }

          setRegistrationLookup({
            key: lookupKey,
            state: "matched",
          });
          setSubmissionState("confirmed");
          setMessage("Researcher registration confirmed on Stellar Testnet.");
          return;
        }

        setRegistrationLookup({
          key: lookupKey,
          state: "mismatch",
        });
        setSubmissionState("error");
        setMessage(
          "This wallet is registered with a different commitment.",
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (isResearcherNotRegistered(error)) {
          setRegistrationLookup({
            key: lookupKey,
            state: "available",
          });
          setSubmissionState("idle");
          setMessage(null);
          return;
        }

        setRegistrationLookup({
          key: lookupKey,
          state: "error",
        });
        setMessage(
          "Unable to verify the current registration on Stellar Testnet.",
        );

        console.error(
          "[zeroseal] Registration reconciliation failed:",
          error,
        );
      }
    };

    const timer = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      setRegistrationLookup({
        key: lookupKey,
        state: "checking",
      });
      setSubmissionState((current) =>
        current === "confirmed" || current === "error"
          ? "idle"
          : current,
      );
      setTransactionHash(null);
      setTransactionLedger(null);
      setMessage(null);

      void reconcileRegistration();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    address,
    lookupKey,
    normalizedCommitment,
    reconciliationNonce,
    registryContractId,
    verifierContractId,
  ]);

  const fingerprint = useMemo(() => {
    const segments: number[] = [];

    for (let index = 0; index < FINGERPRINT_SEGMENTS; index += 1) {
      const slice = normalizedCommitment.slice(index * 4, index * 4 + 4);

      if (slice.length < 4) {
        segments.push(0);
        continue;
      }

      const parsed = Number.parseInt(slice, 16);
      segments.push(Number.isNaN(parsed) ? 0 : parsed / 0xffff);
    }

    return segments;
  }, [normalizedCommitment]);

  const walletNode: RailNode = (() => {
    if (walletConnected && address) {
      return {
        id: "wallet",
        label: "Wallet connected",
        value: shortenAddress(address),
        full: address,
        state: "verified",
      };
    }

    if (walletStatus === "unavailable") {
      return {
        id: "wallet",
        label: "Wallet connected",
        value: "Desktop signing required",
        state: "warning",
      };
    }

    if (walletStatus === "wrong_network" || walletStatus === "error") {
      return {
        id: "wallet",
        label: "Wallet connected",
        value: "Wallet unavailable",
        state: "failed",
      };
    }

    if (walletStatus === "rejected") {
      return {
        id: "wallet",
        label: "Wallet connected",
        value: "Connection cancelled",
        state: "warning",
      };
    }

    if (walletConnecting) {
      return {
        id: "wallet",
        label: "Wallet connected",
        value: "Connecting",
        state: "checking",
      };
    }

    return {
      id: "wallet",
      label: "Wallet connected",
      value: "Connect wallet",
      state: "pending",
    };
  })();

  const networkNode: RailNode = (() => {
    if (!walletConnected) {
      return {
        id: "network",
        label: "Network confirmed",
        value: "Stellar Testnet",
        state: "pending",
      };
    }

    return correctNetwork
      ? {
          id: "network",
          label: "Network confirmed",
          value: "Stellar Testnet",
          state: "verified",
        }
      : {
          id: "network",
          label: "Network confirmed",
          value: "Wrong network",
          state: "warning",
        };
  })();

  const registryNode: RailNode = {
    id: "registry",
    label: "Registry configured",
    value: shortenAddress(registryContractId),
    full: registryContractId,
    state: "verified",
  };

  const commitmentNode: RailNode = (() => {
    if (registrationState === "matched") {
      return {
        id: "commitment",
        label: "Proof artifact status",
        value: "Registered",
        state: "verified",
      };
    }

    if (registrationState === "mismatch") {
      return {
        id: "commitment",
        label: "Proof artifact status",
        value: "Different value registered",
        state: "failed",
      };
    }

    if (validCommitment) {
      return {
        id: "commitment",
        label: "Proof artifact status",
        value:
          registrationState === "checking"
            ? "Checking registry"
            : "64 hex loaded",
        state:
          registrationState === "checking"
            ? "checking"
            : "verified",
      };
    }

    if (normalizedCommitment.length > 0) {
      return {
        id: "commitment",
        label: "Proof artifact status",
        value: `${normalizedCommitment.length}/64 hex`,
        state: "warning",
      };
    }

    return {
      id: "commitment",
      label: "Proof artifact status",
      value: "Not loaded",
      state: "pending",
    };
  })();

  const signatureNode: RailNode = (() => {
    if (
      registrationState === "matched" ||
      submissionState === "submitting" ||
      submissionState === "confirmed"
    ) {
      return {
        id: "signature",
        label: "Registration transaction",
        value: "Authorised",
        state: "verified",
      };
    }

    if (submissionState === "awaiting-signature") {
      return {
        id: "signature",
        label: "Registration transaction",
        value: "Awaiting approval",
        state: "checking",
      };
    }

    return {
      id: "signature",
      label: "Registration transaction",
      value: "Pending",
      state: "pending",
    };
  })();

  const confirmationNode: RailNode = (() => {
    if (registrationState === "matched" || submissionState === "confirmed") {
      return {
        id: "confirmation",
        label: "Transaction confirmation",
        value: "Registration confirmed",
        state: "verified",
      };
    }

    if (registrationState === "checking") {
      return {
        id: "confirmation",
        label: "Transaction confirmation",
        value: "Checking Testnet",
        state: "checking",
      };
    }

    if (registrationState === "mismatch") {
      return {
        id: "confirmation",
        label: "Transaction confirmation",
        value: "Commitment conflict",
        state: "failed",
      };
    }

    if (registrationState === "error") {
      return {
        id: "confirmation",
        label: "Transaction confirmation",
        value: "Verification unavailable",
        state: "warning",
      };
    }

    if (submissionState === "submitting") {
      return {
        id: "confirmation",
        label: "Transaction confirmation",
        value: "Confirming",
        state: "checking",
      };
    }

    if (submissionState === "error") {
      return {
        id: "confirmation",
        label: "Transaction confirmation",
        value: "Failed",
        state: "failed",
      };
    }

    return {
      id: "confirmation",
      label: "Transaction confirmation",
      value: "Pending",
      state: "pending",
    };
  })();

  const backendNode: RailNode = {
    id: "claim",
    label: "Backend claim",
    value: claimId
      ? claimStatus
        ? `${claimStatus} · ${claimId.slice(0, 8)}`
        : claimId.slice(0, 8)
      : backendMessage === "Backend unavailable"
        ? "Backend unavailable"
        : "Not created",
    full: claimId ?? undefined,
    state: claimId
      ? claimStatus === "CONFIRMED" || claimStatus === "RECEIPT_ISSUED"
        ? "verified"
        : "checking"
      : backendMessage
        ? "warning"
        : "pending",
  };

  const rail: RailNode[] = [
    walletNode,
    networkNode,
    registryNode,
    commitmentNode,
    backendNode,
    signatureNode,
    confirmationNode,
  ];

  const inputState = validCommitment
    ? "valid"
    : normalizedCommitment.length > 0
      ? "invalid"
      : "idle";

  const statusTone: "info" | "warn" | "ok" | "error" = (() => {
    if (registrationState === "mismatch" || submissionState === "error") {
      return "error";
    }

    if (registrationState === "matched" || submissionState === "confirmed") {
      return "ok";
    }

    if (registrationState === "error") {
      return "warn";
    }

    if (submissionState === "idle" && (!walletConnected || !correctNetwork)) {
      return "warn";
    }

    return "info";
  })();

  const statusLine = (() => {
    if (registrationState === "matched") {
      return "Researcher registration confirmed on Stellar Testnet.";
    }

    if (registrationState === "mismatch") {
      return "This wallet is registered with a different commitment.";
    }

    if (registrationState === "checking") {
      return "Checking the connected wallet on Stellar Testnet.";
    }

    if (registrationState === "error") {
      return "Unable to verify the current registration. Refresh to retry.";
    }

    if (message) {
      return message;
    }

    if (submissionState === "confirmed") {
      return "Researcher registration confirmed on Stellar Testnet.";
    }

    if (!walletConnected) {
      return "Connect a Testnet wallet to continue.";
    }

    if (!correctNetwork) {
      return "Switch Freighter to Stellar Testnet.";
    }

    if (!validCommitment) {
      return "Load the matching proof artifact to read the researcher commitment.";
    }

    return registrationState === "available"
      ? "Ready to register on Stellar Testnet."
      : "Checking the connected wallet on Stellar Testnet.";
  })();

  const readyDot = walletReady && Boolean(registryContractId);
  const showDesktopSigningNotice =
    !walletConnected &&
    (walletStatus === "unavailable" || walletStatus === "error");

  const submitRegistration = async () => {
    if (!address) {
      setSubmissionState("error");
      setMessage("Connect Freighter before registering.");
      return;
    }

    if (!correctNetwork) {
      setSubmissionState("error");
      setMessage("Switch Freighter to Stellar Testnet.");
      return;
    }

    if (!validCommitment) {
      setSubmissionState("error");
      setMessage("Enter a valid 64 character hexadecimal commitment.");
      return;
    }

    if (registrationState === "matched") {
      setSubmissionState("confirmed");
      setMessage("Researcher registration confirmed on Stellar Testnet.");
      return;
    }

    if (registrationState !== "available") {
      setMessage(
        registrationState === "mismatch"
          ? "This wallet is registered with a different commitment."
          : "Wait for the Testnet registration check to complete.",
      );
      return;
    }

    setTransactionHash(null);
    setTransactionLedger(null);
    setMessage("Loading transaction request.");
    setSubmissionState("preparing");

    try {
      const backendClaimId = await ensureBackendClaim();
      const client = await createClaimRegistryClient(address);

      const transaction = await client.register_researcher({
        researcher: address,
        researcher_commitment: Buffer.from(normalizedCommitment, "hex"),
      });

      setSubmissionState("awaiting-signature");
      setMessage("Transaction ready. Review and approve in Freighter.");

      const response = await transaction.signAndSend();

      setSubmissionState("submitting");
      setMessage("Transaction submitted. Waiting for Testnet confirmation.");

      const finalStatus = extractFinalStatus(response);

      // signAndSend resolves only after the network returns a final result.
      // If that result is present and not successful, surface it as an error
      // rather than presenting an unconfirmed transaction as accepted.
      if (finalStatus && finalStatus.toUpperCase() !== "SUCCESS") {
        setSubmissionState("error");
        setMessage(
          "The registration transaction did not reach a successful final status.",
        );
        return;
      }

      const hash = extractTransactionHash(response);
      const ledger = extractLedger(response);

      setTransactionHash(hash);
      setTransactionLedger(ledger);

      if (hash) {
        if (backendClaimId) {
          try {
            const recorded = await recordBackendTransaction(backendClaimId, {
              transactionHash: hash,
              walletAddress: address,
              network: "TESTNET",
              contractId: registryContractId,
              method: "register_researcher",
              operationType: "researcher_registration",
              researcherCommitment: normalizedCommitment,
              idempotencyKey: `register_researcher:${hash}`,
            });
            setClaimStatus(recorded.status);
            setBackendMessage("Transaction recorded for reconciliation.");
          } catch (error) {
            setBackendMessage(
              isApiError(error)
                ? error.message
                : "Backend unavailable",
            );
          }
        }

        const receipt: StoredReceipt = {
          schemaVersion: 2,
          network: "TESTNET",
          action: "register_researcher",
          status: "confirmed",
          transactionHash: hash,
          ledger,
          account: address,
          sourceAccount: address,
          contractId: registryContractId,
          verifierContractId,
          contractFunction: "register_researcher",
          commitment: normalizedCommitment,
          confirmedAt: null,
          savedAt: new Date().toISOString(),
        };
        persistReceipt(receipt);
        setRestoredReceipt(receipt);
      }

      setRegistrationLookup({
        key: lookupKey,
        state: "matched",
      });
      setSubmissionState("confirmed");
      setMessage("Researcher registration confirmed on Stellar Testnet.");
    } catch (error) {
      if (isResearcherAlreadyRegistered(error)) {
        setSubmissionState("idle");
        setMessage("Checking the existing registration on Stellar Testnet.");
        setRegistrationLookup({
          key: lookupKey,
          state: "checking",
        });
        setReconciliationNonce((current) => current + 1);
        return;
      }

      setSubmissionState("error");
      setMessage(readableWalletError(error));
    }
  };

  return (
    <section
      className="zs-workstation-section"
      id="proof-workspace"
      aria-labelledby="zs-reg-heading"
    >
      <div className="shell">
        <header className="zs-reg-intro">
          <p className="zs-reg-intro__eyebrow zs-intro-kicker">Live proof workspace</p>
          <h2 className="zs-reg-intro__title zs-intro-title" id="zs-reg-heading">From private witness to public receipt</h2>
          <p className="zs-reg-intro__lede zs-intro-note">Connect a Testnet wallet, load the approved proof artifact and authorise the Claim Registry transaction through Freighter.</p>
        </header>

        <section className="programme-selector" aria-label="Selected programme">
          <div>
            <p className="eyebrow">Programme</p>
            <h3>{programmeName}</h3>
            <p>
              Demo programme. The selected policy proves a published impact
              threshold without exposing exploit details or complete witness
              values.
            </p>
          </div>
          <dl>
            <div>
              <dt>Programme ID</dt>
              <dd>{programmeIdentifier}</dd>
            </div>
            <div>
              <dt>Snapshot</dt>
              <dd>{snapshotIdentifier}</dd>
            </div>
            <div>
              <dt>Policy</dt>
              <dd>{policyIdentifier}</dd>
            </div>
            <div>
              <dt>Circuit</dt>
              <dd>{circuitIdentifier}</dd>
            </div>
            <div>
              <dt>Snapshot expiry</dt>
              <dd>{snapshotExpiry}</dd>
            </div>
            <div>
              <dt>Public impact rule</dt>
              <dd>{policyRule}</dd>
            </div>
            <div>
              <dt>Evidence binding</dt>
              <dd>claim-attached, circuit binding pending</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>Stellar Testnet</dd>
            </div>
          </dl>
          {programmeMessage ? (
            <div className="programme-selector__warning">
              <p>{programmeMessage}</p>
              {programmeCanRetry ? (
                <button
                  type="button"
                  className="btn btn--sm btn--outline"
                  onClick={() => setProgrammeRetryNonce((value) => value + 1)}
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="zs-ws">
          <div className="zs-ws__bar">
            <div className="zs-ws__route">
              <span
                className="zs-ws__route-dot"
                data-on={readyDot}
                aria-hidden="true"
              />
              zeroseal://identity-registry
            </div>

            <div className="zs-ws__bar-meta">
              <span className="zs-ws__env">TESTNET</span>
              <span className="zs-ws__registry" title={registryContractId}>
                {shortenAddress(registryContractId)}
              </span>
            </div>
          </div>

          <div className="zs-ws__body">
            <ol
              className="zs-spine"
              aria-label="Registration verification status"
            >
              {rail.map((node) => (
                <li className="zs-node" data-state={node.state} key={node.id}>
                  <span className="zs-node__seal">
                    <SealMark state={node.state} />
                  </span>
                  <span className="zs-node__main">
                    <span className="zs-node__label">{node.label}</span>
                    <span className="zs-node__value" title={node.full}>
                      {node.value}
                    </span>
                  </span>
                </li>
              ))}
            </ol>

            <div className="zs-action">
              <VerifiedArtifactLoader
                onLoad={(artifact) => {
                  setLoadedArtifact(artifact);
                  setCommitment(artifact.commitment);
                  setClaimId(null);
                  setClaimStatus(null);
                  setBackendMessage(null);
                  setMessage(null);
                  setTransactionHash(null);
                  setTransactionLedger(null);
                  setSubmissionState("idle");
                }}
              />

              <details className="zs-advanced-evidence">
                <summary>Advanced: local evidence manifest</summary>
                <p>
                  Files stay local. The current circuit does not include this
                  manifest commitment as a proof public input. This commitment
                  is not an on-chain proof until a compatible circuit binds it.
                </p>
                <EvidenceManifest
                  compact
                  bindingStatus={evidenceBindingStatus}
                  onClear={() => {
                    setEvidenceCommitment(null);
                    setEvidenceBindingStatus("LOCAL_ONLY");
                  }}
                  onCommitment={(payload) => {
                    void attachEvidence(payload);
                  }}
                />
              </details>

              {!walletConnected ? (
                <div className="zs-wallet-required">
                  <strong>Wallet authorisation required</strong>
                  <p>
                    Connect Freighter to load the active Testnet account and
                    authorise the Claim Registry transaction.
                  </p>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => void connect()}
                    disabled={walletConnecting}
                  >
                    {walletConnecting
                      ? "Connecting..."
                      : "Connect Freighter"}
                  </button>
                  {walletError ? <span>{walletError}</span> : null}
                </div>
              ) : null}

              {showDesktopSigningNotice ? <DesktopSigningNotice /> : null}

              <div className="zs-field" data-valid={validCommitment}>
                <div className="zs-field__top">
                  <label
                    className="zs-field__label"
                    htmlFor="researcher-commitment"
                  >
                    researcher commitment from proof artifact
                  </label>
                  <span className="zs-field__count" data-valid={validCommitment}>
                    {normalizedCommitment.length}/64
                  </span>
                </div>

                <div className="zs-input" data-state={inputState}>
                  <input
                    id="researcher-commitment"
                    className="zs-input__field"
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder="Load the approved proof artifact"
                    value={commitment}
                    readOnly
                    disabled={busy}
                  />

                </div>

                <div
                  className="zs-fp"
                  role="img"
                  aria-label="Visual fingerprint of the entered commitment. Display only, not a cryptographic value."
                >
                  {fingerprint.map((value, index) => (
                    <span
                      className="zs-fp__bar"
                      key={index}
                      style={{ height: `${16 + value * 84}%` }}
                    />
                  ))}
                </div>

                <p className="zs-field__hint">
                  This stable registration commitment is loaded from the proof
                  artifact. Evidence file changes do not modify it.
                </p>
              </div>

              <button
                type="button"
                className="zs-submit"
                onClick={() => void submitRegistration()}
                disabled={!canRegister}
              >
                {buttonLabel(submissionState, registrationState)}
              </button>

              <p className="zs-status" data-tone={statusTone} aria-live="polite">
                {statusLine}
              </p>
              {backendMessage ? (
                <p className="zs-status" data-tone="info" aria-live="polite">
                  {backendMessage}
                </p>
              ) : null}

              <XlmPayment />

            </div>
          </div>
        </div>

        <div className="zs-state-summary" aria-label="ZeroSeal workflow states">
          <div>
            <span>Registration status</span>
            <strong>
              {registrationState === "matched"
                ? "Researcher registration confirmed"
                : registrationState === "available"
                  ? "Researcher not registered"
                  : registrationState === "mismatch"
                    ? "Different researcher commitment registered"
                    : "Pending"}
            </strong>
          </div>
          <div>
            <span>Proof validation status</span>
            <strong>
              {claimStatus === "PROOF_RECEIVED" ||
              claimStatus === "VERIFYING" ||
              claimStatus === "AWAITING_WALLET_SIGNATURE"
                ? "Proof structurally validated"
                : loadedArtifact
                  ? "Artifact loaded"
                  : "Pending proof artifact"}
            </strong>
          </div>
          <div>
            <span>Claim submission status</span>
            <strong>
              {claimStatus === "SUBMITTED" ||
              claimStatus === "CONFIRMED" ||
              claimStatus === "RECEIPT_ISSUED"
                ? "Claim transaction submitted"
                : "No confirmed claim transaction"}
            </strong>
          </div>
          <div>
            <span>Receipt status</span>
            <strong>
              {claimStatus === "RECEIPT_ISSUED"
                ? "Claim receipt issued"
                : "No claim receipt issued"}
            </strong>
          </div>
        </div>

        {(() => {
          const liveHash = transactionHash ?? restoredReceipt?.transactionHash ?? null;
          const liveLedger = transactionHash
            ? transactionLedger
            : (restoredReceipt?.ledger ?? null);

          if (liveHash) {
            return (
              <ReceiptPanel
                receipt={{
                  title: "Researcher registration",
                  action: "register_researcher",
                  transactionHash: liveHash,
                  ledger: liveLedger,
                  researcher: address,
                  contractId: registryContractId,
                  verifierContractId,
                  commitment: normalizedCommitment || null,
                }}
              />
            );
          }

          if (registrationState === "matched") {
            return (
              <ReceiptPanel
                receipt={{
                  title: "Researcher registration",
                  statusLabel: "Confirmed",
                  action: "register_researcher",
                  transactionHash: null,
                  researcher: address,
                  contractId: registryContractId,
                  verifierContractId,
                  commitment: normalizedCommitment || null,
                }}
              />
            );
          }

          return null;
        })()}
      </div>
    </section>
  );
}
