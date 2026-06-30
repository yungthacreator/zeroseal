"use client";

import { Buffer } from "buffer";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useWallet } from "@/context/wallet-context";
import {
  createBackendClaim,
  createBackendContinuation,
  getApiReadiness,
  getBackendContinuation,
  ApiRequestError,
  recordBackendTransaction,
  type ContinuationPayload,
  type ApiClaim,
} from "@/lib/api/claims";
import {
  buildPublicPayloadAsync,
  createExampleDemoDraft,
  createInitialClaimDraft,
  formatFingerprint,
  generatePrivateSeal,
  nextClaimState,
  resetClaimDraft,
  type ClaimDraft,
  type PublicPayload,
} from "@/lib/claim-flow";
import { persistReceipt } from "@/lib/receipt-store";
import { REPORTING_PATHS, findReportingPath } from "@/lib/reporting-paths";
import { createClaimRegistryClient } from "@/lib/stellar/claim-registry-client";
import {
  DEFAULT_REGISTRY_CONTRACT_ID,
  DEFAULT_VERIFIER_CONTRACT_ID,
} from "@/lib/stellar/config";
import { explorerTransactionUrl, fetchTestnetTransaction } from "@/lib/stellar/testnet";
import { VerifiedStamp } from "@/components/verified-stamp";

type WizardMode = "create" | "demo";
type PublishState = "idle" | "preparing" | "awaiting" | "submitting" | "confirmed" | "failed";

const STEPS = [
  "Report",
  "Finding",
  "Private evidence",
  "Seal and public claim",
  "Sign and receipt",
] as const;

const TARGET_TYPES = [
  "Smart contract",
  "Repository",
  "Web application",
  "API",
  "Mobile application",
] as const;

const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;

function isMobileViewport(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
}

function shortHash(value?: string | null): string {
  if (!value) {
    return "Not ready";
  }
  return `${value.slice(0, 8)}...${value.slice(-8)}`;
}

function explainPublishError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.code === "API_UNCONFIGURED" || error.code === "API_MISCONFIGURED") {
      return "ZeroSeal claim service is not configured. No transaction was submitted.";
    }
    if (error.code === "API_UNAVAILABLE") {
      return "ZeroSeal could not reach the claim service. No transaction was submitted.";
    }
    if (error.code.includes("DATABASE")) {
      return "ZeroSeal claim service is reachable, but the database is not ready. No transaction was submitted.";
    }
    return `${error.message} No transaction was submitted.`;
  }

  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();
  if (normalized.includes("reject") || normalized.includes("declin") || normalized.includes("cancel")) {
    return "Freighter rejected the request. Nothing was submitted.";
  }
  if (normalized.includes("simulate") || normalized.includes("simulation")) {
    return "The transaction could not be simulated. Nothing was submitted.";
  }
  if (message) {
    return message;
  }
  return "The publish flow failed before a confirmed receipt was created.";
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
  for (const key of ["sendTransactionResponse", "getTransactionResponse", "response"]) {
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
  for (const key of ["sendTransactionResponse", "getTransactionResponse", "response"]) {
    const nested = extractLedger(object[key]);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function storePublicReceipt(payload: PublicPayload): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    `zeroseal:public-claim:${payload.claimIdentifier}`,
    JSON.stringify(payload),
  );
}

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function isStepComplete(index: number, step: number, draft: ClaimDraft, reviewed: boolean): boolean {
  if (index < step) {
    return true;
  }
  if (index === 3) {
    return Boolean(draft.privateSeal);
  }
  if (index === 4) {
    return reviewed;
  }
  return false;
}

function publicInputRows(seal: NonNullable<ClaimDraft["privateSeal"]>) {
  return [
    {
      position: 0,
      name: "researcher_commitment",
      valueHex: seal.researcherFingerprint,
    },
    {
      position: 1,
      name: "claim_commitment",
      valueHex: seal.canonicalClaimHash,
    },
    {
      position: 2,
      name: "nullifier",
      valueHex: seal.nullifier,
    },
  ];
}

async function assertBackendReady(): Promise<void> {
  const readiness = await getApiReadiness();
  const database =
    typeof readiness.database === "string"
      ? readiness.database
      : readiness.database &&
          typeof readiness.database === "object" &&
          "status" in readiness.database
        ? String((readiness.database as { status?: unknown }).status)
        : null;

  if (database !== "ready") {
    throw new ApiRequestError(
      "DATABASE_UNAVAILABLE",
      "ZeroSeal claim service is reachable, but the database is not ready.",
      503,
      "/ready",
      readiness,
    );
  }
}

async function waitForSuccessfulTransaction(hash: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const tx = await fetchTestnetTransaction(hash);
    if (tx.exists && tx.successful) {
      return tx;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1800));
  }
  throw new Error("The transaction hash was returned, but Stellar confirmation was not proven yet.");
}

export function ClaimWizard({ mode }: { mode: WizardMode }) {
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<ClaimDraft>(() => {
    const initial = createInitialClaimDraft();
    const path = searchParams.get("path");
    const severity = searchParams.get("severity");
    return {
      ...initial,
      reportingContext: path ?? initial.reportingContext,
      claimedSeverity: SEVERITIES.includes(severity as (typeof SEVERITIES)[number])
        ? (severity as ClaimDraft["claimedSeverity"])
        : initial.claimedSeverity,
    };
  });
  const [step, setStep] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [publishState, setPublishState] = useState<PublishState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [publicPayload, setPublicPayload] = useState<PublicPayload | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [backendClaim, setBackendClaim] = useState<ApiClaim | null>(null);
  const [mobileSigning, setMobileSigning] = useState(() => isMobileViewport());
  const [continuationToken, setContinuationToken] = useState<string | null>(null);
  const [continuationLink, setContinuationLink] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [backendReady, setBackendReady] = useState<"unknown" | "ready" | "blocked">("unknown");
  const { address, status, connect } = useWallet();

  const seal = draft.privateSeal ?? null;
  const registryContractId =
    process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID?.trim() ||
    DEFAULT_REGISTRY_CONTRACT_ID;
  const verifierContractId =
    process.env.NEXT_PUBLIC_VERIFIER_CONTRACT_ID?.trim() ||
    DEFAULT_VERIFIER_CONTRACT_ID;

  const isTryMode = mode === "demo";
  const pageTitle = isTryMode ? "Try ZeroSeal" : "Create a private claim";
  const currentStep = STEPS[step];
  const selectedReportingPath = findReportingPath(draft.reportingContext);
  const connectedWallet = address ? `${address.slice(0, 6)}...${address.slice(-6)}` : null;

  useEffect(() => {
    const onResize = () => setMobileSigning(isMobileViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const token = searchParams.get("continue");
    if (!token) {
      return;
    }

    let cancelled = false;

    getBackendContinuation(token)
      .then((continuation) => {
        if (cancelled) {
          return;
        }

        const publicClaim = continuation.publicClaim;
        setDraft((current) => ({
          ...current,
          state: "PUBLIC_CLAIM_REVIEWED",
          reportingContext: publicClaim.reportingContext ?? current.reportingContext,
          programmeName: publicClaim.programmeName ?? current.programmeName,
          targetType: publicClaim.targetType ?? current.targetType,
          targetLocator: publicClaim.targetLocator ?? current.targetLocator,
          affectedComponent: publicClaim.affectedComponent ?? current.affectedComponent,
          findingTitle: publicClaim.findingTitle ?? current.findingTitle,
          bugCategory: publicClaim.bugCategory ?? current.bugCategory,
          claimedSeverity: (
            SEVERITIES.includes(publicClaim.claimedSeverity as (typeof SEVERITIES)[number])
              ? publicClaim.claimedSeverity
              : current.claimedSeverity
          ) as ClaimDraft["claimedSeverity"],
          impactStatement: publicClaim.impactStatement ?? current.impactStatement,
          publicClaim: {
            ...current.publicClaim,
            publicThreshold: publicClaim.publicThreshold ?? current.publicClaim.publicThreshold,
          },
          researcherFingerprint: continuation.seal.researcherFingerprint,
          privateSeal: {
            ...continuation.seal,
            saltHex: "",
            recoveryBundle: {
              schema: "zeroseal.private-recovery.v1",
              createdAt: new Date().toISOString(),
              privateEvidence: createInitialClaimDraft().privateEvidence,
              saltHex: "",
              canonicalClaimHash: continuation.seal.canonicalClaimHash,
              researcherFingerprint: continuation.seal.researcherFingerprint,
              nullifier: continuation.seal.nullifier,
            },
          },
        }));
        setPublicPayload(continuation.publicPayload as PublicPayload);
        setReviewed(true);
        setStep(4);
        setMessage("Desktop continuation loaded. It contains only approved public claim fields and seal identifiers.");
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(explainPublishError(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const ready = useMemo(() => {
    switch (step) {
      case 0:
        return Boolean(draft.reportingContext && draft.programmeName && draft.affectedComponent);
      case 1:
        return Boolean(
          draft.findingTitle &&
            draft.claimedSeverity &&
            draft.bugCategory &&
            draft.impactStatement &&
            draft.publicClaim.publicThreshold,
        );
      case 2:
        return Boolean(
          draft.privateEvidence.vulnerabilityDescription ||
            draft.privateEvidence.reproductionSteps ||
            draft.privateEvidence.proofOfConcept ||
            selectedFiles.length,
        );
      case 3:
        return reviewed;
      default:
        return false;
    }
  }, [draft, reviewed, selectedFiles.length, step]);

  const update = (patch: Partial<ClaimDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const updatePrivateEvidence = (
    key: keyof ClaimDraft["privateEvidence"],
    value: string,
  ) => {
    setDraft((current) => ({
      ...current,
      privateEvidence: { ...current.privateEvidence, [key]: value },
    }));
  };

  const continueStep = () => {
    setMessage(null);
    if (step === 2) {
      update({ state: nextClaimState("DRAFT", "privateEvidenceReady") });
    }
    if (step < STEPS.length - 1) {
      setStep((value) => value + 1);
    }
  };

  const loadExample = () => {
    setDraft(createExampleDemoDraft());
    setSelectedFiles(["impact-notes.txt", "poc-outline.md"]);
    setReviewed(false);
    setPublicPayload(null);
    setPublishState("idle");
    setMessage("Example claim added. No fingerprint, wallet request or receipt was created.");
  };

  const clearPrivateEvidence = () => {
    setDraft((current) => ({
      ...current,
      privateEvidence: createInitialClaimDraft().privateEvidence,
      state: "DRAFT",
      researcherFingerprint: null,
      privateSeal: null,
    }));
    setSelectedFiles([]);
    setReviewed(false);
    setPublicPayload(null);
    setMessage("Private evidence cleared from this browser form.");
  };

  const reset = () => {
    setDraft((current) =>
      isTryMode ? createInitialClaimDraft() : resetClaimDraft(current),
    );
    setSelectedFiles([]);
    setStep(0);
    setReviewed(false);
    setPublicPayload(null);
    setPublishState("idle");
    setMessage(null);
  };

  const generateSeal = async () => {
    setMessage(null);
    update({ state: nextClaimState("PRIVATE_EVIDENCE_READY", "startSeal") });
    try {
      const nextSeal = await generatePrivateSeal(draft);
      setDraft((current) => ({
        ...current,
        state: nextClaimState("SEAL_GENERATING", "sealGenerated"),
        researcherFingerprint: nextSeal.researcherFingerprint,
        privateSeal: nextSeal,
      }));
      setMessage("ZeroSeal created this fingerprint automatically from the approved claim and private evidence.");
    } catch (error) {
      update({ state: "FAILED" });
      setMessage(error instanceof Error ? error.message : "Private seal failed.");
    }
  };

  const confirmReview = async () => {
    if (!seal) {
      return;
    }
    const payload = await buildPublicPayloadAsync(draft, seal, {
      researcherPublicKey: address,
    });
    storePublicReceipt(payload);
    setPublicPayload(payload);
    setReviewed(true);
    update({ state: nextClaimState("SEAL_GENERATED", "reviewPublicClaim") });
    setMessage("Approved public claim prepared. Private evidence remains local.");
  };

  const createContinuation = async () => {
    if (!seal || !publicPayload) {
      setMessage("Generate the seal and approve the public claim first.");
      return;
    }
    const payload: ContinuationPayload = {
      publicPayload,
      publicClaim: {
        reportingContext: draft.reportingContext,
        programmeName: draft.programmeName,
        targetType: draft.targetType,
        targetLocator: draft.targetLocator,
        affectedComponent: draft.affectedComponent,
        findingTitle: draft.findingTitle,
        bugCategory: draft.bugCategory,
        claimedSeverity: draft.claimedSeverity,
        impactStatement: draft.impactStatement,
        publicThreshold: draft.publicClaim.publicThreshold,
      },
      seal: {
        claimIdentifier: seal.claimIdentifier,
        researcherFingerprint: seal.researcherFingerprint,
        nullifier: seal.nullifier,
        canonicalClaimHash: seal.canonicalClaimHash,
        privateEvidenceDigest: seal.privateEvidenceDigest,
      },
    };
    try {
      const continuation = await createBackendContinuation(payload);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setContinuationToken(continuation.token);
      setContinuationLink(`${origin}${continuation.linkPath}`);
      setMessage("Desktop continuation link created. It contains only approved public claim data and expires in 20 minutes.");
    } catch (error) {
      setMessage(explainPublishError(error));
    }
  };

  const publish = async () => {
    if (!seal) {
      setMessage("Generate the private seal before publishing.");
      return;
    }
    if (!address) {
      setMessage("Connect Freighter on Stellar Testnet before publishing.");
      await connect();
      return;
    }

    setPublishState("preparing");
    update({ state: nextClaimState("PUBLIC_CLAIM_REVIEWED", "requestWallet") });
    setMessage("Checking backend readiness before transaction submission.");

    try {
      await assertBackendReady();
      setBackendReady("ready");

      const payload = await buildPublicPayloadAsync(draft, seal, {
        researcherPublicKey: address,
      });
      storePublicReceipt(payload);
      setPublicPayload(payload);

      const claim =
        backendClaim ??
        (await createBackendClaim({
          walletAddress: address,
          researcherCommitment: seal.researcherFingerprint,
          nullifier: seal.nullifier,
          evidenceCommitment: seal.privateEvidenceDigest,
          publicInputs: publicInputRows(seal),
          idempotencyKey: `${seal.claimIdentifier}:${address}`,
        }));
      setBackendClaim(claim);

      const client = await createClaimRegistryClient(address);
      const transaction = await client.register_researcher({
        researcher: address,
        researcher_commitment: Buffer.from(seal.researcherFingerprint, "hex"),
      });

      setPublishState("awaiting");
      setMessage("Review the exact Testnet transaction in Freighter.");

      const response = await transaction.signAndSend();
      setPublishState("submitting");
      const hash = extractTransactionHash(response);
      const responseLedger = extractLedger(response);

      if (!hash) {
        setPublishState("failed");
        update({ state: "FAILED" });
        setMessage("Freighter returned no transaction hash. Nothing was recorded as confirmed.");
        return;
      }

      const chain = await waitForSuccessfulTransaction(hash);
      const ledger = chain.ledger ?? responseLedger;

      try {
        await recordBackendTransaction(claim.id, {
          transactionHash: hash,
          walletAddress: address,
          network: "TESTNET",
          contractId: registryContractId,
          method: "register_researcher",
          operationType: "researcher_registration",
          researcherCommitment: seal.researcherFingerprint,
          idempotencyKey: `register:${hash}`,
        });
      } catch (error) {
        persistReceipt({
          schemaVersion: 2,
          network: "TESTNET",
          action: "register_researcher",
          status: "confirmed",
          transactionHash: hash,
          ledger,
          account: address,
          sourceAccount: chain.sourceAccount ?? address,
          contractId: registryContractId,
          verifierContractId,
          contractFunction: "register_researcher",
          commitment: seal.researcherFingerprint,
          nullifier: seal.nullifier,
          receiptId: payload.claimIdentifier,
          confirmedAt: chain.createdAt,
          savedAt: new Date().toISOString(),
        });
        setDraft((current) => ({
          ...current,
          receipt: { transactionHash: hash, ledger },
        }));
        setPublishState("failed");
        setMessage(`Confirmed on Stellar, but backend sync is pending. ${explainPublishError(error)}`);
        return;
      }

      persistReceipt({
        schemaVersion: 2,
        network: "TESTNET",
        action: "register_researcher",
        status: "confirmed",
        transactionHash: hash,
        ledger,
        account: address,
        sourceAccount: chain.sourceAccount ?? address,
        contractId: registryContractId,
        verifierContractId,
        contractFunction: "register_researcher",
        commitment: seal.researcherFingerprint,
        nullifier: seal.nullifier,
        receiptId: payload.claimIdentifier,
        confirmedAt: chain.createdAt,
        savedAt: new Date().toISOString(),
      });

      setDraft((current) => ({
        ...current,
        state: "RECEIPT_ISSUED",
        receipt: { transactionHash: hash, ledger },
      }));
      setPublishState("confirmed");
      setMessage("Confirmed on Stellar Testnet. Public receipt is ready.");
      setStep(4);
    } catch (error) {
      setPublishState("failed");
      setBackendReady(error instanceof ApiRequestError ? "blocked" : backendReady);
      update({ state: "FAILED" });
      setMessage(explainPublishError(error));
    }
  };

  return (
    <div className="claim-flow claim-flow--try">
      <div className="claim-flow__topbar">
        <Link className="claim-flow__back" href="/">
          <span aria-hidden="true">{"<-"}</span>
          Back to ZeroSeal
        </Link>
        <div className="claim-flow__top-actions">
          {isTryMode ? (
            <button className="btn btn--outline btn--sm" type="button" onClick={loadExample}>
              Load example
            </button>
          ) : null}
          <Link className="btn btn--outline btn--sm" href="/verify">
            Verify receipt
          </Link>
        </div>
      </div>

      <header className="claim-flow__hero claim-flow__hero--compact">
        <p className="eyebrow">{isTryMode ? "TRY ZEROSEAL" : "CREATE CLAIM"}</p>
        <h1>{isTryMode ? "Create an example security claim" : pageTitle}</h1>
        <p>
          {isTryMode
            ? "Use an example claim or enter your own test details. ZeroSeal only records a Testnet action after wallet approval."
            : "Create a private claim, generate a seal, approve the public fields and record a Testnet action."}
        </p>
      </header>

      <div className="claim-flow__shell claim-flow__shell--app">
        <div className="claim-flow__mobile-progress" aria-label="Claim creation progress">
          <span>Step {step + 1} of {STEPS.length}</span>
          <strong>{currentStep}</strong>
          <i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>

        <aside className="claim-flow__progress claim-flow__progress--rail" aria-label="Claim creation progress">
          {STEPS.map((label, index) => {
            const complete = isStepComplete(index, step, draft, reviewed);
            return (
              <button
                key={label}
                type="button"
                data-complete={complete}
                aria-current={step === index ? "step" : undefined}
                onClick={() => setStep(index)}
              >
                <span>
                  {complete ? (
                    <VerifiedStamp className="verified-stamp verified-stamp--step" />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                {label}
              </button>
            );
          })}
        </aside>

        <main className="claim-flow__panel claim-flow__panel--work">
          <div className="claim-flow__panel-top">
            <span>{currentStep}</span>
            <strong>Step {step + 1} of {STEPS.length}</strong>
          </div>

          {step === 0 ? (
            <section className="claim-step">
              <StepHeader
                title="Report"
                text="This describes where the report will be handled. ZeroSeal does not submit the private report to the platform."
              />
              {selectedReportingPath ? (
                <p className="claim-step__context">
                  {selectedReportingPath.name}: <em>{selectedReportingPath.shortCategory}</em>
                </p>
              ) : null}
              <div className="platform-grid">
                {REPORTING_PATHS.map((context) => (
                  <button
                    type="button"
                    aria-label={context.accessibleLabel}
                    data-selected={draft.reportingContext === context.name}
                    key={context.id}
                    onClick={() => update({ reportingContext: context.name })}
                  >
                    {context.logo ? (
                      <Image src={context.logo} alt="" aria-hidden="true" width={96} height={28} />
                    ) : (
                      <span className="platform-grid__wordmark" aria-hidden="true">{context.name}</span>
                    )}
                    <strong>{context.name}</strong>
                    <em>{context.shortCategory}</em>
                    {draft.reportingContext === context.name ? (
                      <VerifiedStamp className="platform-grid__check" />
                    ) : (
                      <span className="platform-grid__check" aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
              <div className="claim-fields claim-fields--compact">
                <Field label="Programme or project" helper="Example: Example Vault Programme or the protocol name" value={draft.programmeName} onChange={(value) => update({ programmeName: value })} />
                <Field label="Target name" helper="Example: Vault.sol, withdraw(), payments API or mobile app" value={draft.affectedComponent} onChange={(value) => update({ affectedComponent: value })} />
                <SelectField label="Target type" helper="Example: smart contract, repository, API or web application" value={draft.targetType} options={TARGET_TYPES} onChange={(value) => update({ targetType: value })} />
                <Field label="Repository or contract address" helper="Example: repository URL or deployed contract address" value={draft.targetLocator} onChange={(value) => update({ targetLocator: value })} />
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="claim-step">
              <StepHeader
                title="Finding"
                text="Use the public-facing description of the claim. Sensitive mechanics stay in private evidence."
              />
              <div className="claim-fields claim-fields--compact">
                <Field label="Public title" helper="Example: Unauthorised withdrawal may exceed the programme threshold" value={draft.findingTitle} onChange={(value) => update({ findingTitle: value })} />
                <Field label="Category" helper="Example: access control, reentrancy or arithmetic error" value={draft.bugCategory} onChange={(value) => update({ bugCategory: value })} />
                <Field label="Public impact threshold" helper="Example: 50,000 USD" value={draft.publicClaim.publicThreshold} onChange={(value) => update({ publicClaim: { ...draft.publicClaim, publicThreshold: value } })} />
              </div>
              <Segmented
                label="Severity"
                options={SEVERITIES}
                value={draft.claimedSeverity}
                onChange={(value) => update({ claimedSeverity: value as ClaimDraft["claimedSeverity"] })}
              />
              <TextArea label="Short public summary" helper="Describe only what the programme may safely review publicly." value={draft.impactStatement} onChange={(value) => update({ impactStatement: value })} />
            </section>
          ) : null}

          {step === 2 ? (
            <section className="claim-step">
              <StepHeader
                title="Private evidence"
                text="Nothing on this step leaves your device."
              />
              <div className="claim-fields claim-fields--compact">
                <TextArea label="Private report" helper="Add the sensitive vulnerability explanation here." value={draft.privateEvidence.vulnerabilityDescription} onChange={(value) => updatePrivateEvidence("vulnerabilityDescription", value)} />
                <TextArea label="Reproduction steps" helper="Add the private steps required to reproduce the issue." value={draft.privateEvidence.reproductionSteps} onChange={(value) => updatePrivateEvidence("reproductionSteps", value)} />
              </div>
              <details className="technical-details technical-details--compact">
                <summary>Optional private details</summary>
                <div className="claim-fields claim-fields--compact">
                  <TextArea label="PoC notes" helper="Private notes stay in this browser and are never sent to the API." value={draft.privateEvidence.proofOfConcept} onChange={(value) => updatePrivateEvidence("proofOfConcept", value)} />
                <Field label="Private impact value" helper="Example: 100,000 USD. This value is never published." value={draft.privateEvidence.privateImpactValues} onChange={(value) => updatePrivateEvidence("privateImpactValues", value)} />
              </div>
              </details>
              <label className="file-picker">
                <span>Drag files here or choose files</span>
                <input
                  type="file"
                  multiple
                  onChange={(event) =>
                    setSelectedFiles(
                      Array.from(event.target.files ?? []).map((file) => file.name),
                    )
                  }
                />
                <strong>{selectedFiles.length ? `${selectedFiles.length} local file${selectedFiles.length === 1 ? "" : "s"}` : "No local files added"}</strong>
              </label>
              {selectedFiles.length ? (
                <div className="file-chip-row">
                  {selectedFiles.map((file) => (
                    <span className="file-chip" key={file}>
                      {file}
                      <button type="button" aria-label={`Remove ${file}`} onClick={() => setSelectedFiles((files) => files.filter((item) => item !== file))}>x</button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="claim-step__actions">
                <button className="btn btn--outline btn--sm" type="button" onClick={clearPrivateEvidence}>
                  Clear private evidence
                </button>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="claim-step">
              <StepHeader
                title="Seal and public claim"
                text="Generate a local commitment, then approve the exact public fields."
              />
              <div className="seal-panel" data-ready={Boolean(seal)}>
                <div>
                  <span>Researcher fingerprint</span>
                  <strong className="mono">{formatFingerprint(draft.researcherFingerprint)}</strong>
                  <p>
                    {seal
                      ? "ZeroSeal created this fingerprint automatically from the approved claim and private evidence."
                      : "Not generated. No fingerprint or private seal output exists yet."}
                  </p>
                </div>
                <button className="btn btn--primary btn--sm" type="button" onClick={() => void generateSeal()}>
                  Generate private seal
                </button>
              </div>
              {seal ? (
                <div className="claim-step__actions">
                  <button
                    className="btn btn--outline btn--sm"
                    type="button"
                    onClick={() => downloadJson(`${seal.claimIdentifier}-private-recovery.json`, seal.recoveryBundle)}
                  >
                    Export private recovery bundle
                  </button>
                </div>
              ) : null}
              <details className="technical-details">
                <summary>Technical details</summary>
                <p>The browser uses canonical claim data, a private evidence digest and secure random salt to create the local seal. The current circuit proves the supported private impact threshold predicate, not arbitrary exploit validity.</p>
              </details>
              <div className="claim-review claim-review--split">
                <section>
                  <h3>Private and not published</h3>
                  <ul>
                    <li>Exploit details</li>
                    <li>Private files</li>
                    <li>Reproduction steps</li>
                    <li>Sensitive witness values</li>
                  </ul>
                </section>
                <section>
                  <h3>Included in public claim</h3>
                  <ul>
                    <li>Reporting context</li>
                    <li>Target and severity claim</li>
                    <li>Approved impact statement</li>
                    <li>Fingerprint and policy identifier</li>
                  </ul>
                </section>
              </div>
              <button className="btn btn--primary btn--sm" type="button" disabled={!seal} onClick={() => void confirmReview()}>
                {reviewed ? "Public claim approved" : "Approve public claim"}
              </button>
            </section>
          ) : null}

          {step === 4 ? (
            <section className="claim-step">
              <StepHeader
                title="Sign and receipt"
                text="Create a real Stellar Testnet receipt only after wallet approval and confirmation."
              />
              {draft.receipt?.transactionHash ? (
                <div className="claim-receipt">
                  <dl>
                    <div><dt>Claim identifier</dt><dd>{publicPayload?.claimIdentifier ?? seal?.claimIdentifier}</dd></div>
                    <div><dt>Researcher fingerprint</dt><dd className="mono">{formatFingerprint(seal?.researcherFingerprint)}</dd></div>
                    <div><dt>Transaction hash</dt><dd className="mono">{draft.receipt.transactionHash}</dd></div>
                    <div><dt>Ledger</dt><dd>{draft.receipt.ledger ?? "Confirmed, ledger unavailable"}</dd></div>
                    <div><dt>Registry contract</dt><dd className="mono">{registryContractId}</dd></div>
                    <div><dt>Verifier contract</dt><dd className="mono">{verifierContractId}</dd></div>
                  </dl>
                  <div className="claim-step__actions">
                    <Link className="btn btn--primary btn--sm" href={`/receipt/${draft.receipt.transactionHash}`}>Open receipt page</Link>
                    <a className="btn btn--outline btn--sm" href={explorerTransactionUrl(draft.receipt.transactionHash)} target="_blank" rel="noreferrer">Open Stellar explorer</a>
                  </div>
                </div>
              ) : (
                <>
                  {seal ? (
                    <div className="seal-ready-strip">
                      <div>
                        <span>Seal ready</span>
                        <strong className="mono">{shortHash(seal.researcherFingerprint)}</strong>
                      </div>
                      <div>
                        <span>Created locally</span>
                        <strong>Private evidence unchanged</strong>
                      </div>
                    </div>
                  ) : null}
                  <div className="publish-summary">
                    <div>
                      <span>Seal</span>
                      <strong className="mono">{shortHash(seal?.researcherFingerprint)}</strong>
                    </div>
                    <div>
                      <span>Public claim</span>
                      <strong>{reviewed ? "Approved" : "Not approved"}</strong>
                    </div>
                    <div>
                      <span>Wallet</span>
                      <strong>{connectedWallet ? `Connected: ${connectedWallet}` : status === "wrong_network" ? "Wrong network" : "Not connected"}</strong>
                    </div>
                    <div>
                      <span>Network</span>
                      <strong>Stellar Testnet</strong>
                    </div>
                    <div>
                      <span>Backend</span>
                      <strong>{backendReady === "ready" ? "Ready" : backendReady === "blocked" ? "Blocked" : "Checked before signing"}</strong>
                    </div>
                    <div>
                      <span>Registry action</span>
                      <strong>Not submitted</strong>
                    </div>
                  </div>
                  <details className="technical-details technical-details--compact">
                    <summary>View public fields</summary>
                    <dl className="claim-mini-list">
                      <div><dt>Reporting path</dt><dd>{draft.reportingContext || "Not set"}</dd></div>
                      <div><dt>Programme</dt><dd>{draft.programmeName || "Not set"}</dd></div>
                      <div><dt>Target</dt><dd>{draft.affectedComponent || "Not set"}</dd></div>
                      <div><dt>Severity</dt><dd>{draft.claimedSeverity || "Not set"}</dd></div>
                      <div><dt>Public rule</dt><dd>{draft.publicClaim.publicThreshold || "Not set"}</dd></div>
                    </dl>
                  </details>
                  <details className="technical-details technical-details--compact">
                    <summary>View seal details</summary>
                    <dl className="claim-mini-list">
                      <div><dt>Claim identifier</dt><dd>{seal?.claimIdentifier ?? "Not ready"}</dd></div>
                      <div><dt>Researcher fingerprint</dt><dd className="mono">{seal?.researcherFingerprint ?? "Not ready"}</dd></div>
                      <div><dt>Nullifier</dt><dd className="mono">{seal?.nullifier ?? "Not ready"}</dd></div>
                    </dl>
                  </details>
                  {reviewOpen ? (
                    <div className="transaction-review" role="region" aria-label="Transaction review">
                      <h3>Review transaction</h3>
                      <dl>
                        <div><dt>Network</dt><dd>Stellar Testnet</dd></div>
                        <div><dt>Contract</dt><dd className="mono">{registryContractId}</dd></div>
                        <div><dt>Method</dt><dd>register_researcher</dd></div>
                        <div><dt>Wallet</dt><dd>{connectedWallet ?? "Connect Freighter first"}</dd></div>
                        <div><dt>Seal</dt><dd className="mono">{shortHash(seal?.researcherFingerprint)}</dd></div>
                        <div><dt>Estimated fee</dt><dd>Shown by Freighter before approval</dd></div>
                      </dl>
                      <p>Raw evidence, PoC, private files, salt and witness values are excluded.</p>
                    </div>
                  ) : null}
                  {mobileSigning ? (
                    <div className="mobile-handoff">
                      <strong>Continue signing on desktop</strong>
                      <p>Freighter extension signing is available on desktop. This continuation contains only the approved public claim and expires in 20 minutes.</p>
                      <button className="btn btn--primary btn--sm" type="button" onClick={() => void createContinuation()}>
                        Create desktop continuation
                      </button>
                      {continuationToken ? (
                        <div className="mobile-handoff__link">
                          <code>{continuationLink}</code>
                          <button
                            className="btn btn--outline btn--sm"
                            type="button"
                            onClick={() => continuationLink ? navigator.clipboard?.writeText(continuationLink) : undefined}
                          >
                            Copy desktop continuation link
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="claim-step__actions">
                      {address ? (
                        <span className="wallet-connected">Connected: {connectedWallet} - Stellar Testnet</span>
                      ) : (
                        <button className="btn btn--outline btn--sm" type="button" onClick={() => void connect()}>
                          Connect Freighter
                        </button>
                      )}
                      <button
                        className="btn btn--outline btn--sm"
                        type="button"
                        disabled={!reviewed}
                        onClick={() => setReviewOpen(true)}
                      >
                        Review transaction
                      </button>
                      <button className="btn btn--primary btn--sm" type="button" disabled={!reviewed || !address || !reviewOpen || publishState === "awaiting" || publishState === "submitting"} onClick={() => void publish()}>
                        Approve in Freighter
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          ) : null}

          {message ? <p className="claim-flow__message" aria-live="polite">{message}</p> : null}

          <footer className="claim-flow__nav claim-flow__nav--compact">
            <button className="btn btn--outline btn--sm" type="button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>
              Previous
            </button>
            <button className="btn btn--outline btn--sm" type="button" onClick={reset}>
              Reset
            </button>
            {step < 4 ? (
              <button className="btn btn--primary btn--sm" type="button" disabled={!ready} onClick={continueStep}>
                Continue
              </button>
            ) : null}
          </footer>
        </main>
      </div>
    </div>
  );
}

function StepHeader({ title, text }: { title: string; text: string }) {
  return (
    <header className="claim-step__head">
      <h2>{title}</h2>
      <p>{text}</p>
    </header>
  );
}

function Field({
  label,
  helper,
  value,
  onChange,
}: {
  label: string;
  helper?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
      {helper ? <em className="field-helper">{helper}</em> : null}
    </label>
  );
}

function TextArea({
  label,
  helper,
  value,
  onChange,
}: {
  label: string;
  helper?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
      {helper ? <em className="field-helper">{helper}</em> : null}
    </label>
  );
}

function SelectField({
  label,
  helper,
  value,
  options,
  onChange,
}: {
  label: string;
  helper?: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose one</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      {helper ? <em className="field-helper">{helper}</em> : null}
    </label>
  );
}

function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="severity-control">
      <legend>{label}</legend>
      <div>
        {options.map((option) => (
          <button
            type="button"
            key={option}
            data-selected={value === option}
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
