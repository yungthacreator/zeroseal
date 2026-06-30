"use client";

import { Buffer } from "buffer";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useWallet } from "@/context/wallet-context";
import {
  createBackendClaim,
  recordBackendTransaction,
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
import { createClaimRegistryClient } from "@/lib/stellar/claim-registry-client";
import {
  DEFAULT_REGISTRY_CONTRACT_ID,
  DEFAULT_VERIFIER_CONTRACT_ID,
} from "@/lib/stellar/config";
import { explorerTransactionUrl } from "@/lib/stellar/testnet";

type WizardMode = "create" | "demo";
type PublishState = "idle" | "preparing" | "awaiting" | "submitting" | "confirmed" | "failed";

const STEPS = [
  "Report",
  "Finding",
  "Private evidence",
  "Seal and public claim",
  "Sign and receipt",
] as const;

const REPORTING_CONTEXTS = [
  { label: "Immunefi", category: "Web3 bug bounty", logo: "/brands/immunefi.svg" },
  { label: "HackerOne", category: "Bug bounty and vulnerability disclosure", logo: "/brands/hackerone.svg" },
  { label: "Bugcrowd", category: "Bug bounty and vulnerability disclosure" },
  { label: "Intigriti", category: "Bug bounty and vulnerability disclosure" },
  { label: "YesWeHack", category: "Bug bounty and vulnerability disclosure" },
  { label: "HackenProof", category: "Bug bounty and Web3 disclosure" },
  { label: "Code4rena", category: "Smart-contract audit competition", logo: "/brands/code4rena.svg" },
  { label: "CodeHawks", category: "Smart-contract audit competition", logo: "/brands/codehawks.svg" },
  { label: "Cantina", category: "Security review and competition", logo: "/brands/cantina.svg" },
  { label: "Sherlock", category: "Smart-contract audit competition" },
  { label: "Hats Finance", category: "Web3 bug bounty" },
  { label: "Direct to project", category: "Private report to the project security team" },
  { label: "Other", category: "Custom disclosure route" },
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

function randomToken(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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

  useEffect(() => {
    const onResize = () => setMobileSigning(isMobileViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
    const token = randomToken();
    const payload = {
      expiresAt: new Date(Date.now() + 1000 * 60 * 20).toISOString(),
      publicPayload,
      seal: {
        claimIdentifier: seal.claimIdentifier,
        researcherFingerprint: seal.researcherFingerprint,
        nullifier: seal.nullifier,
        canonicalClaimHash: seal.canonicalClaimHash,
        privateEvidenceDigest: seal.privateEvidenceDigest,
      },
    };
    window.sessionStorage.setItem(`zeroseal:continuation:${token}`, JSON.stringify(payload));
    setContinuationToken(token);
    setMessage("Desktop continuation link created. It contains only approved public claim data.");
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
    setMessage("Preparing the Claim Registry action.");

    try {
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
      const ledger = extractLedger(response);

      if (!hash) {
        setPublishState("failed");
        update({ state: "FAILED" });
        setMessage("Freighter returned no confirmed transaction hash.");
        return;
      }

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

      persistReceipt({
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
        commitment: seal.researcherFingerprint,
        nullifier: seal.nullifier,
        receiptId: payload.claimIdentifier,
        confirmedAt: null,
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
      update({ state: "FAILED" });
      setMessage(error instanceof Error ? error.message : "Publish failed.");
    }
  };

  return (
    <div className="claim-flow claim-flow--try">
      <div className="claim-flow__topbar">
        <Link className="claim-flow__back" href="/">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5 L8 12 L15 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
                <span>{complete ? "" : String(index + 1).padStart(2, "0")}</span>
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
              <ReportingPathSelector
                value={draft.reportingContext}
                onChange={(value) => update({ reportingContext: value })}
              />
              <div className="claim-fields claim-fields--compact">
                <Field label="Programme or project" value={draft.programmeName} onChange={(value) => update({ programmeName: value })} hint="Example: Example Vault Programme or the protocol name" />
                <Field label="Target name" value={draft.affectedComponent} onChange={(value) => update({ affectedComponent: value })} hint="Example: Vault.sol, withdraw(), payments API or mobile app" />
                <SelectField label="Target type" value={draft.targetType} options={TARGET_TYPES} onChange={(value) => update({ targetType: value })} hint="Example: smart contract, repository, API or web application" />
                <Field label="Repository or contract address" value={draft.targetLocator} onChange={(value) => update({ targetLocator: value })} hint="Example: repository URL or deployed contract address" />
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
                <Field label="Public title" value={draft.findingTitle} onChange={(value) => update({ findingTitle: value })} />
                <Field label="Category" value={draft.bugCategory} onChange={(value) => update({ bugCategory: value })} />
                <Field label="Public impact threshold" value={draft.publicClaim.publicThreshold} onChange={(value) => update({ publicClaim: { ...draft.publicClaim, publicThreshold: value } })} />
              </div>
              <Segmented
                label="Severity"
                options={SEVERITIES}
                value={draft.claimedSeverity}
                onChange={(value) => update({ claimedSeverity: value as ClaimDraft["claimedSeverity"] })}
              />
              <TextArea label="Short public summary" value={draft.impactStatement} onChange={(value) => update({ impactStatement: value })} />
            </section>
          ) : null}

          {step === 2 ? (
            <section className="claim-step">
              <StepHeader
                title="Private evidence"
                text="Nothing on this step leaves your device."
              />
              <div className="claim-fields claim-fields--compact">
                <TextArea label="Private report" value={draft.privateEvidence.vulnerabilityDescription} onChange={(value) => updatePrivateEvidence("vulnerabilityDescription", value)} />
                <TextArea label="Reproduction steps" value={draft.privateEvidence.reproductionSteps} onChange={(value) => updatePrivateEvidence("reproductionSteps", value)} />
              </div>
              <details className="technical-details technical-details--compact">
                <summary>Optional private details</summary>
                <div className="claim-fields claim-fields--compact">
                  <TextArea label="PoC notes" value={draft.privateEvidence.proofOfConcept} onChange={(value) => updatePrivateEvidence("proofOfConcept", value)} />
                <Field label="Private impact value" value={draft.privateEvidence.privateImpactValues} onChange={(value) => updatePrivateEvidence("privateImpactValues", value)} />
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
                  <div className="publish-summary">
                    <div>
                      <span>Recorded on Testnet</span>
                      <strong>Researcher fingerprint and registry action</strong>
                    </div>
                    <div>
                      <span>Never recorded</span>
                      <strong>Raw evidence, PoC, private files, salts or witness values</strong>
                    </div>
                    <div>
                      <span>Wallet</span>
                      <strong>{address ? "Connected" : status === "wrong_network" ? "Wrong network" : "Not connected"}</strong>
                    </div>
                  </div>
                  {mobileSigning ? (
                    <div className="mobile-handoff">
                      <strong>Continue signing on desktop</strong>
                      <p>Freighter extension signing is available on desktop. This continuation contains only the approved public claim and expires in 20 minutes.</p>
                      <button className="btn btn--primary btn--sm" type="button" onClick={() => void createContinuation()}>
                        Create desktop continuation
                      </button>
                      {continuationToken ? (
                        <div className="mobile-handoff__link">
                          <code>{`${typeof window !== "undefined" ? window.location.origin : ""}/create?continue=${continuationToken}`}</code>
                          <button
                            className="btn btn--outline btn--sm"
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/create?continue=${continuationToken}`)}
                          >
                            Copy desktop continuation link
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="claim-step__actions">
                      <button className="btn btn--outline btn--sm" type="button" onClick={() => void connect()}>
                        Connect Freighter
                      </button>
                      <button className="btn btn--primary btn--sm" type="button" disabled={!reviewed || publishState === "awaiting" || publishState === "submitting"} onClick={() => void publish()}>
                        {publishState === "awaiting" ? "Approve in Freighter" : "Review Testnet action"}
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
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
      {hint ? <em className="field-hint">{hint}</em> : null}
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  hint?: string;
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
      {hint ? <em className="field-hint">{hint}</em> : null}
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
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function PathMark({ logo, label }: { logo?: string; label: string }) {
  if (logo) {
    return (
      <span className="path-select__logo">
        <Image src={logo} alt="" aria-hidden="true" width={88} height={24} unoptimized />
      </span>
    );
  }
  return (
    <span className="path-select__mark" aria-hidden="true">
      {label.charAt(0)}
    </span>
  );
}

function ReportingPathSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected =
    REPORTING_CONTEXTS.find((context) => context.label === value) ?? null;

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return REPORTING_CONTEXTS;
    }
    return REPORTING_CONTEXTS.filter(
      (context) =>
        context.label.toLowerCase().includes(term) ||
        context.category.toLowerCase().includes(term),
    );
  }, [query]);

  const choose = (label: string) => {
    onChange(label);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="path-select" data-open={open}>
      <span className="path-select__label">Reporting path</span>
      <button
        type="button"
        className="path-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {selected ? (
          <>
            <PathMark logo={"logo" in selected ? selected.logo : undefined} label={selected.label} />
            <span className="path-select__trigger-text">
              <strong>{selected.label}</strong>
              <small>{selected.category}</small>
            </span>
          </>
        ) : (
          <span className="path-select__trigger-text">
            <strong>Select a reporting path</strong>
            <small>Where the full report will eventually be handled</small>
          </span>
        )}
        <svg className="path-select__chev" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9 L12 15 L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div className="path-select__panel" role="listbox" aria-label="Reporting paths">
          <input
            className="path-select__search"
            type="text"
            value={query}
            autoFocus
            placeholder="Search platforms"
            onChange={(event) => setQuery(event.target.value)}
          />
          <ul className="path-select__options">
            {results.length === 0 ? (
              <li className="path-select__empty">No matching reporting paths.</li>
            ) : (
              results.map((context) => (
                <li key={context.label}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={context.label === value}
                    data-selected={context.label === value}
                    onClick={() => choose(context.label)}
                  >
                    <PathMark logo={"logo" in context ? context.logo : undefined} label={context.label} />
                    <span className="path-select__option-text">
                      <strong>{context.label}</strong>
                      <small>{context.category}</small>
                    </span>
                    {context.label === value ? (
                      <svg className="path-select__tick" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 12.5 L10 17.5 L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
