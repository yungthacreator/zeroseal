"use client";

import { Buffer } from "buffer";
import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";

import { useWallet } from "@/context/wallet-context";
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
  "Target",
  "Finding",
  "Evidence",
  "Private seal",
  "Public claim",
  "Testnet action",
  "Receipt",
] as const;

const REPORTING_CONTEXTS = [
  { label: "HackerOne", logo: "/brands/hackerone.svg" },
  { label: "Immunefi", logo: "/brands/immunefi.svg" },
  { label: "Code4rena", logo: "/brands/code4rena.svg" },
  { label: "CodeHawks", logo: "/brands/codehawks.svg" },
  { label: "Cantina", logo: "/brands/cantina.svg" },
  { label: "HackenProof" },
  { label: "Sherlock" },
  { label: "Direct to project" },
  { label: "Other" },
] as const;

const TARGET_TYPES = [
  "Smart contract",
  "Repository",
  "Web application",
  "API",
  "Mobile application",
] as const;

const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;

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
  if (index === 4) {
    return Boolean(draft.privateSeal);
  }
  if (index === 5) {
    return reviewed;
  }
  if (index === 7) {
    return Boolean(draft.receipt?.transactionHash);
  }
  return false;
}

export function ClaimWizard({ mode }: { mode: WizardMode }) {
  const [draft, setDraft] = useState<ClaimDraft>(() => createInitialClaimDraft());
  const [step, setStep] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [publishState, setPublishState] = useState<PublishState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [publicPayload, setPublicPayload] = useState<PublicPayload | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
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

  const ready = useMemo(() => {
    switch (step) {
      case 0:
        return Boolean(draft.reportingContext);
      case 1:
        return Boolean(draft.programmeName && draft.targetType);
      case 2:
        return Boolean(draft.findingTitle && draft.claimedSeverity && draft.bugCategory);
      case 3:
        return Boolean(
          draft.privateEvidence.vulnerabilityDescription ||
            draft.privateEvidence.reproductionSteps ||
            draft.privateEvidence.proofOfConcept ||
            selectedFiles.length,
        );
      case 4:
        return Boolean(seal);
      case 5:
        return reviewed;
      case 6:
        return Boolean(seal && reviewed);
      default:
        return false;
    }
  }, [draft, reviewed, seal, selectedFiles.length, step]);

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
    if (step === 3) {
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
      setStep(7);
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
          <span aria-hidden="true">←</span>
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
                title="Choose the reporting path"
                text="This describes where the report will be handled. ZeroSeal does not submit the private report to the platform."
              />
              <div className="platform-grid">
                {REPORTING_CONTEXTS.map((context) => (
                  <button
                    type="button"
                    data-selected={draft.reportingContext === context.label}
                    key={context.label}
                    onClick={() => update({ reportingContext: context.label })}
                  >
                    {"logo" in context ? (
                      <Image src={context.logo} alt="" aria-hidden="true" width={96} height={28} />
                    ) : (
                      <span className="platform-grid__mark" aria-hidden="true" />
                    )}
                    <strong>{context.label}</strong>
                    <span className="platform-grid__check" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="claim-step">
              <StepHeader
                title="Describe the programme and target"
                text="Keep this short. The private evidence comes later and remains local."
              />
              <div className="claim-fields claim-fields--compact">
                <Field label="Programme or project" value={draft.programmeName} onChange={(value) => update({ programmeName: value })} />
                <Field label="Target name" value={draft.affectedComponent} onChange={(value) => update({ affectedComponent: value })} />
                <SelectField label="Target type" value={draft.targetType} options={TARGET_TYPES} onChange={(value) => update({ targetType: value })} />
                <Field label="Repository or contract address" value={draft.targetLocator} onChange={(value) => update({ targetLocator: value })} />
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="claim-step">
              <StepHeader
                title="Add the finding context"
                text="Use the public-facing description of the claim. Sensitive details still belong in private evidence."
              />
              <div className="claim-fields claim-fields--compact">
                <Field label="Finding title" value={draft.findingTitle} onChange={(value) => update({ findingTitle: value })} />
                <Field label="Vulnerability category" value={draft.bugCategory} onChange={(value) => update({ bugCategory: value })} />
              </div>
              <Segmented
                label="Severity"
                options={SEVERITIES}
                value={draft.claimedSeverity}
                onChange={(value) => update({ claimedSeverity: value as ClaimDraft["claimedSeverity"] })}
              />
              <TextArea label="Short summary" value={draft.impactStatement} onChange={(value) => update({ impactStatement: value })} />
            </section>
          ) : null}

          {step === 3 ? (
            <section className="claim-step">
              <StepHeader
                title="Add private evidence locally"
                text="Files and sensitive details remain on this device. ZeroSeal does not publish raw evidence."
              />
              <div className="privacy-callout">
                <span aria-hidden="true" />
                <strong>Private evidence is local until you decide otherwise.</strong>
              </div>
              <div className="claim-fields claim-fields--compact">
                <TextArea label="Report text" value={draft.privateEvidence.vulnerabilityDescription} onChange={(value) => updatePrivateEvidence("vulnerabilityDescription", value)} />
                <TextArea label="PoC notes" value={draft.privateEvidence.proofOfConcept} onChange={(value) => updatePrivateEvidence("proofOfConcept", value)} />
                <TextArea label="Reproduction steps" value={draft.privateEvidence.reproductionSteps} onChange={(value) => updatePrivateEvidence("reproductionSteps", value)} />
                <Field label="Private impact value" value={draft.privateEvidence.privateImpactValues} onChange={(value) => updatePrivateEvidence("privateImpactValues", value)} />
              </div>
              <label className="file-picker">
                <span>Attach local files</span>
                <input
                  type="file"
                  multiple
                  onChange={(event) =>
                    setSelectedFiles(
                      Array.from(event.target.files ?? []).map((file) => file.name),
                    )
                  }
                />
                <strong>{selectedFiles.length ? `${selectedFiles.length} selected` : "No files selected"}</strong>
              </label>
              <div className="claim-step__actions">
                <button className="btn btn--outline btn--sm" type="button" onClick={clearPrivateEvidence}>
                  Clear private evidence
                </button>
              </div>
            </section>
          ) : null}

          {step === 4 ? (
            <section className="claim-step">
              <StepHeader
                title="Generate the private seal"
                text="ZeroSeal creates the fingerprint only after you click the button."
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
            </section>
          ) : null}

          {step === 5 ? (
            <section className="claim-step">
              <StepHeader
                title="Review the approved public claim"
                text="This is the privacy boundary. Check it before asking Freighter to record anything."
              />
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
                Approve public claim
              </button>
            </section>
          ) : null}

          {step === 6 ? (
            <section className="claim-step">
              <StepHeader
                title="Review Testnet action"
                text="Freighter will show the exact Stellar Testnet transaction before submission."
              />
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
              <div className="claim-step__actions">
                <button className="btn btn--outline btn--sm" type="button" onClick={() => void connect()}>
                  Connect Freighter
                </button>
                <button className="btn btn--primary btn--sm" type="button" disabled={!reviewed || publishState === "awaiting" || publishState === "submitting"} onClick={() => void publish()}>
                  {publishState === "awaiting" ? "Approve in Freighter" : "Review Testnet action"}
                </button>
              </div>
            </section>
          ) : null}

          {step === 7 ? (
            <section className="claim-step">
              <StepHeader
                title="Receipt"
                text="ZeroSeal shows a public receipt only after a real confirmed Testnet transaction hash is available."
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
                <div className="receipt-empty">
                  <strong>No Testnet receipt yet</strong>
                  <p>Generate the private seal, approve the public claim and review the Freighter action to create a real receipt.</p>
                </div>
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
            {step < 6 ? (
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
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
}: {
  label: string;
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
