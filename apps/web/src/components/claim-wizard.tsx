"use client";

import { Buffer } from "buffer";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useWallet } from "@/context/wallet-context";
import {
  buildPublicPayloadAsync,
  canContinueFromStep,
  createFictionalDemoDraft,
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
  "Reporting context",
  "Programme and target",
  "Finding",
  "Private evidence",
  "Public claim",
  "Generate private seal",
  "Review",
  "Publish",
  "Receipt",
] as const;

const REPORTING_CONTEXTS = [
  "Immunefi",
  "HackerOne",
  "Code4rena",
  "Sherlock",
  "Cantina",
  "HackenProof",
  "Directly to a project",
  "Other",
] as const;

const TARGET_TYPES = [
  "smart contract",
  "repository",
  "web application",
  "API",
  "mobile application",
] as const;

const SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;

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

export function ClaimWizard({ mode }: { mode: WizardMode }) {
  const [draft, setDraft] = useState<ClaimDraft>(() => createInitialClaimDraft());
  const [step, setStep] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [publishState, setPublishState] = useState<PublishState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [publicPayload, setPublicPayload] = useState<PublicPayload | null>(null);
  const { address, status, connect } = useWallet();

  const seal = draft.privateSeal ?? null;
  const registryContractId =
    process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID?.trim() ||
    DEFAULT_REGISTRY_CONTRACT_ID;
  const verifierContractId =
    process.env.NEXT_PUBLIC_VERIFIER_CONTRACT_ID?.trim() ||
    DEFAULT_VERIFIER_CONTRACT_ID;

  const ready = useMemo(() => {
    if (step === 6) {
      return reviewed;
    }
    if (step === 7) {
      return Boolean(seal && reviewed);
    }
    return canContinueFromStep(step, draft);
  }, [draft, reviewed, seal, step]);

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

  const updatePublicClaim = (
    key: keyof ClaimDraft["publicClaim"],
    value: string,
  ) => {
    setDraft((current) => ({
      ...current,
      publicClaim: { ...current.publicClaim, [key]: value },
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

  const loadFictionalDemo = () => {
    setDraft(createFictionalDemoDraft());
    setReviewed(false);
    setPublicPayload(null);
    setPublishState("idle");
    setMessage("Fictional example loaded. No real exploit is used.");
  };

  const clearPrivateEvidence = () => {
    setDraft((current) => ({
      ...current,
      privateEvidence: createInitialClaimDraft().privateEvidence,
      state: "DRAFT",
      researcherFingerprint: null,
      privateSeal: null,
    }));
    setReviewed(false);
    setPublicPayload(null);
    setMessage("Private evidence cleared from this browser form.");
  };

  const reset = () => {
    setDraft((current) =>
      mode === "demo" ? createInitialClaimDraft() : resetClaimDraft(current),
    );
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
      setMessage("Private seal generated in this browser.");
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
      setStep(8);
    } catch (error) {
      setPublishState("failed");
      update({ state: "FAILED" });
      setMessage(error instanceof Error ? error.message : "Publish failed.");
    }
  };

  return (
    <div className="claim-flow">
      <header className="claim-flow__hero">
        <Link className="receipt-page__back" href="/">
          &larr; ZeroSeal
        </Link>
        <p className="eyebrow">
          {mode === "demo" ? "SAFE FICTIONAL DEMO" : "CREATE PRIVATE CLAIM"}
        </p>
        <h1 className="display display--lg">
          {mode === "demo"
            ? "Try an example vulnerability."
            : "Create a private claim from the beginning."}
        </h1>
        <p className="lede">
          {mode === "demo"
            ? "ZeroSeal can fill the form with a fictional smart-contract finding. No real exploit is used."
            : "Build a claim locally, generate a private seal, review the public fields and approve the Testnet action only when ready."}
        </p>
      </header>

      <div className="claim-flow__shell">
        <aside className="claim-flow__progress" aria-label="Claim creation progress">
          {STEPS.map((label, index) => (
            <button
              key={label}
              type="button"
              aria-current={step === index ? "step" : undefined}
              onClick={() => setStep(index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {label}
            </button>
          ))}
        </aside>

        <main className="claim-flow__panel">
          <span className="claim-flow__state">{draft.state ?? "DRAFT"}</span>
          {mode === "demo" && step === 0 ? (
            <div className="claim-flow__demo-start">
              <strong>This demo starts untouched.</strong>
              <p>
                Load the fictional example when you are ready. It will not create
                a fingerprint, wallet request or receipt until you act.
              </p>
              <button className="btn btn--yellow" type="button" onClick={loadFictionalDemo}>
                Fill fictional example
              </button>
            </div>
          ) : null}

          {step === 0 ? (
            <section className="claim-step">
              <h2>Where do you plan to submit this finding?</h2>
              <p>Used only to describe the reporting context. ZeroSeal does not submit the report to this platform.</p>
              <div className="claim-choice-grid">
                {REPORTING_CONTEXTS.map((context) => (
                  <button
                    type="button"
                    data-selected={draft.reportingContext === context}
                    key={context}
                    onClick={() => update({ reportingContext: context })}
                  >
                    {context}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="claim-step">
              <h2>Programme and target</h2>
              <div className="claim-fields">
                <Field label="Programme or project name" value={draft.programmeName} onChange={(value) => update({ programmeName: value })} />
                <Field label="Programme URL" value={draft.programmeUrl} onChange={(value) => update({ programmeUrl: value })} />
                <SelectField label="Target type" value={draft.targetType} options={TARGET_TYPES} onChange={(value) => update({ targetType: value })} />
                <Field label="Contract address or repository URL" value={draft.targetLocator} onChange={(value) => update({ targetLocator: value })} />
                <Field label="Affected function or component" value={draft.affectedComponent} onChange={(value) => update({ affectedComponent: value })} />
                <Field label="Network or chain" value={draft.network} onChange={(value) => update({ network: value })} />
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="claim-step">
              <h2>Finding and severity</h2>
              <div className="claim-fields">
                <Field label="Finding title" value={draft.findingTitle} onChange={(value) => update({ findingTitle: value })} />
                <Field label="Bug category" value={draft.bugCategory} onChange={(value) => update({ bugCategory: value })} />
                <SelectField label="Claimed severity" value={draft.claimedSeverity} options={SEVERITIES} onChange={(value) => update({ claimedSeverity: value as ClaimDraft["claimedSeverity"] })} />
                <TextArea label="Short impact statement" value={draft.impactStatement} onChange={(value) => update({ impactStatement: value })} />
                <Field label="Estimated financial impact when applicable" value={draft.estimatedFinancialImpact} onChange={(value) => update({ estimatedFinancialImpact: value })} />
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="claim-step">
              <h2>Private evidence</h2>
              <p>This evidence stays on your device. It is not written to Stellar. Do not enter an unpatched real vulnerability in this public demo.</p>
              <div className="claim-fields">
                <TextArea label="Vulnerability description" value={draft.privateEvidence.vulnerabilityDescription} onChange={(value) => updatePrivateEvidence("vulnerabilityDescription", value)} />
                <TextArea label="Reproduction steps" value={draft.privateEvidence.reproductionSteps} onChange={(value) => updatePrivateEvidence("reproductionSteps", value)} />
                <Field label="PoC or evidence file reference" value={draft.privateEvidence.proofOfConcept} onChange={(value) => updatePrivateEvidence("proofOfConcept", value)} />
                <Field label="Affected code" value={draft.privateEvidence.affectedCode} onChange={(value) => updatePrivateEvidence("affectedCode", value)} />
                <TextArea label="Screenshots or logs" value={draft.privateEvidence.screenshotsOrLogs} onChange={(value) => updatePrivateEvidence("screenshotsOrLogs", value)} />
                <Field label="Expected result" value={draft.privateEvidence.expectedResult} onChange={(value) => updatePrivateEvidence("expectedResult", value)} />
                <Field label="Actual result" value={draft.privateEvidence.actualResult} onChange={(value) => updatePrivateEvidence("actualResult", value)} />
                <Field label="Private impact values" value={draft.privateEvidence.privateImpactValues} onChange={(value) => updatePrivateEvidence("privateImpactValues", value)} />
                <TextArea label="Private notes" value={draft.privateEvidence.privateNotes} onChange={(value) => updatePrivateEvidence("privateNotes", value)} />
              </div>
              <div className="claim-step__actions">
                <button className="btn btn--outline btn--sm" type="button" onClick={clearPrivateEvidence}>Clear private evidence</button>
              </div>
            </section>
          ) : null}

          {step === 4 ? (
            <section className="claim-step">
              <h2>Public claim</h2>
              <p>The supported MVP predicate is: private demonstrated impact meets or exceeds the programme&apos;s published threshold.</p>
              <div className="claim-fields">
                <Field label="Public threshold" value={draft.publicClaim.publicThreshold} onChange={(value) => updatePublicClaim("publicThreshold", value)} />
                <Field label="Policy identifier" value={draft.publicClaim.policyIdentifier} onChange={(value) => updatePublicClaim("policyIdentifier", value)} />
                <Field label="Policy version" value={draft.publicClaim.policyVersion} onChange={(value) => updatePublicClaim("policyVersion", value)} />
              </div>
              <details className="technical-details">
                <summary>Advanced details</summary>
                <p>The current demo performs local seal construction and API structural validation. It does not prove generic exploit validity.</p>
              </details>
            </section>
          ) : null}

          {step === 5 ? (
            <section className="claim-step">
              <h2>Generate private seal</h2>
              <p>ZeroSeal creates a unique fingerprint from your private claim. It can later show that the claim existed without revealing the private evidence.</p>
              <button className="btn btn--primary" type="button" onClick={() => void generateSeal()}>
                Generate private seal
              </button>
              <div className="claim-fingerprint">
                <span>Researcher fingerprint</span>
                <strong className="mono">{formatFingerprint(draft.researcherFingerprint)}</strong>
              </div>
              {seal ? (
                <button
                  className="btn btn--outline btn--sm"
                  type="button"
                  onClick={() => downloadJson(`${seal.claimIdentifier}-private-recovery.json`, seal.recoveryBundle)}
                >
                  Export private recovery bundle
                </button>
              ) : null}
            </section>
          ) : null}

          {step === 6 ? (
            <section className="claim-step">
              <h2>Review before wallet approval</h2>
              <div className="claim-review">
                <section>
                  <h3>Stays private</h3>
                  <ul>
                    <li>Exploit details</li>
                    <li>Reproduction steps</li>
                    <li>Private files and exact values</li>
                    <li>Secret salt and full witness</li>
                  </ul>
                </section>
                <section>
                  <h3>Becomes public</h3>
                  <ul>
                    <li>Programme context hash</li>
                    <li>Target snapshot hash</li>
                    <li>Public policy and threshold</li>
                    <li>Researcher fingerprint and nullifier</li>
                    <li>Researcher public key after wallet approval</li>
                  </ul>
                </section>
              </div>
              <label className="claim-confirm">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(event) => {
                    if (event.target.checked) {
                      void confirmReview();
                    } else {
                      setReviewed(false);
                    }
                  }}
                />
                I have reviewed the public fields.
              </label>
            </section>
          ) : null}

          {step === 7 ? (
            <section className="claim-step">
              <h2>Publish to Stellar Testnet</h2>
              <p>Only the approved public claim context and researcher fingerprint are used for the Testnet action. Freighter shows the exact transaction before submission.</p>
              <div className="claim-publish">
                <span>Wallet state</span>
                <strong>{address ? "Connected on Testnet" : status === "wrong_network" ? "Wrong network" : "Not connected"}</strong>
                <button className="btn btn--outline btn--sm" type="button" onClick={() => void connect()}>
                  Connect Freighter
                </button>
                <button className="btn btn--primary" type="button" disabled={!reviewed || publishState === "awaiting" || publishState === "submitting"} onClick={() => void publish()}>
                  {publishState === "awaiting" ? "Approve in Freighter" : "Publish public claim"}
                </button>
              </div>
            </section>
          ) : null}

          {step === 8 ? (
            <section className="claim-step">
              <h2>Receipt</h2>
              {draft.receipt?.transactionHash ? (
                <div className="claim-receipt">
                  <p>Confirmed real Testnet information is available.</p>
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
                    {publicPayload ? (
                      <button className="btn btn--outline btn--sm" type="button" onClick={() => downloadJson(`${publicPayload.claimIdentifier}-public-receipt.json`, publicPayload)}>
                        Download public receipt
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p>No transaction has been submitted from this browser.</p>
              )}
            </section>
          ) : null}

          {message ? <p className="claim-flow__message" aria-live="polite">{message}</p> : null}

          <footer className="claim-flow__nav">
            <button className="btn btn--outline" type="button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>
              Back
            </button>
            <button className="btn btn--outline" type="button" onClick={reset}>
              Reset claim
            </button>
            {step < 7 ? (
              <button className="btn btn--primary" type="button" disabled={!ready} onClick={continueStep}>
                Continue
              </button>
            ) : null}
          </footer>
        </main>
      </div>
    </div>
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
