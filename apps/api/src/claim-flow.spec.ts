import assert from "node:assert/strict";
import test from "node:test";

import {
  CLAIM_STATES,
  buildPublicPayloadAsync,
  canonicalizeClaim,
  createInitialClaimDraft,
  createExampleDemoDraft,
  generatePrivateSeal,
  nextClaimState,
  publicPayloadContainsOnlyAllowedFields,
  resetClaimDraft,
  type ClaimDraft,
} from "../../web/src/lib/claim-flow";

const completeDraft: ClaimDraft = {
  reportingContext: "Immunefi",
  programmeName: "Example Vault Programme",
  programmeUrl: "https://example.invalid/security",
  targetType: "smart contract",
  targetLocator: "0x0000000000000000000000000000000000000000",
  affectedComponent: "withdraw(uint256)",
  network: "Stellar Testnet",
  findingTitle: "Example rounding issue",
  bugCategory: "Accounting",
  claimedSeverity: "High",
  impactStatement: "An example vault can report a threshold-level loss.",
  estimatedFinancialImpact: "250000",
  privateEvidence: {
    vulnerabilityDescription: "Private example description",
    reproductionSteps: "1. Deploy example vault\n2. Trigger example path",
    proofOfConcept: "example-poc.js",
    affectedCode: "contracts/ExampleVault.sol",
    screenshotsOrLogs: "example-log",
    expectedResult: "No loss",
    actualResult: "Threshold loss",
    privateImpactValues: "250000.00",
    privateNotes: "Secret salt should never leave browser",
  },
  publicClaim: {
    policyIdentifier: "published-impact-threshold-v1",
    policyVersion: "security-impact-v1",
    publicThreshold: "100000",
    verifierVersion: "structural-browser-testnet-v1",
  },
};

void test("new claim draft starts untouched with no package or fingerprint", () => {
  const draft = createInitialClaimDraft();

  assert.equal(draft.state, "DRAFT");
  assert.equal(draft.researcherFingerprint, null);
  assert.equal(draft.loadedPackage, false);
  assert.equal(draft.receipt, null);
});

void test("Try ZeroSeal example data is explicit and still starts unsealed", () => {
  const draft = createExampleDemoDraft();

  assert.equal(draft.demoMode, true);
  assert.match(draft.findingTitle, /Example/i);
  assert.equal(draft.researcherFingerprint, null);
  assert.equal(draft.state, "DRAFT");
});

void test("private seal generation is deterministic with supplied salt", async () => {
  const seal = await generatePrivateSeal(completeDraft, {
    saltHex: "11".repeat(32),
  });
  const repeat = await generatePrivateSeal(completeDraft, {
    saltHex: "11".repeat(32),
  });

  assert.equal(seal.researcherFingerprint, repeat.researcherFingerprint);
  assert.equal(seal.privateEvidenceDigest, repeat.privateEvidenceDigest);
  assert.equal(seal.nullifier, repeat.nullifier);
  assert.match(seal.researcherFingerprint, /^[0-9a-f]{64}$/);
});

void test("secure salt generation does not expose Math.random state", async () => {
  const first = await generatePrivateSeal(completeDraft);
  const second = await generatePrivateSeal(completeDraft);

  assert.notEqual(first.saltHex, second.saltHex);
  assert.match(first.saltHex, /^[0-9a-f]{64}$/);
});

void test("canonical claim hashing is stable across object key order", () => {
  assert.equal(
    canonicalizeClaim({ b: 2, a: { z: true, c: "x" } }),
    canonicalizeClaim({ a: { c: "x", z: true }, b: 2 }),
  );
});

void test("public payload allowlist excludes private evidence and salt", async () => {
  const seal = await generatePrivateSeal(completeDraft, {
    saltHex: "22".repeat(32),
  });
  const payload = await buildPublicPayloadAsync(completeDraft, seal, {
    researcherPublicKey: "G_PUBLIC_TEST_KEY",
  });

  assert.equal(publicPayloadContainsOnlyAllowedFields(payload), true);
  assert.equal("privateEvidence" in payload, false);
  assert.equal("reproductionSteps" in payload, false);
  assert.equal("saltHex" in payload, false);
  assert.equal("secretSalt" in payload, false);
});

void test("claim state machine permits only forward user actions", () => {
  assert.deepEqual(CLAIM_STATES, [
    "DRAFT",
    "PRIVATE_EVIDENCE_READY",
    "SEAL_GENERATING",
    "SEAL_GENERATED",
    "PUBLIC_CLAIM_REVIEWED",
    "AWAITING_WALLET",
    "SUBMITTING",
    "CONFIRMED",
    "RECEIPT_ISSUED",
    "FAILED",
  ]);
  assert.equal(nextClaimState("DRAFT", "privateEvidenceReady"), "PRIVATE_EVIDENCE_READY");
  assert.equal(nextClaimState("PRIVATE_EVIDENCE_READY", "startSeal"), "SEAL_GENERATING");
  assert.equal(nextClaimState("SEAL_GENERATING", "sealGenerated"), "SEAL_GENERATED");
  assert.equal(nextClaimState("SEAL_GENERATED", "reviewPublicClaim"), "PUBLIC_CLAIM_REVIEWED");
  assert.equal(nextClaimState("PUBLIC_CLAIM_REVIEWED", "requestWallet"), "AWAITING_WALLET");
  assert.equal(nextClaimState("AWAITING_WALLET", "submit"), "SUBMITTING");
  assert.equal(nextClaimState("SUBMITTING", "confirm"), "CONFIRMED");
  assert.equal(nextClaimState("CONFIRMED", "issueReceipt"), "RECEIPT_ISSUED");
  assert.equal(nextClaimState("DRAFT", "submit"), "DRAFT");
});

void test("reset clears private evidence, seal and receipt", async () => {
  const seal = await generatePrivateSeal(completeDraft, {
    saltHex: "33".repeat(32),
  });
  const reset = resetClaimDraft({
    ...completeDraft,
    state: "RECEIPT_ISSUED",
    researcherFingerprint: seal.researcherFingerprint,
    privateSeal: seal,
    receipt: { transactionHash: "ab".repeat(32), ledger: "123" },
  });

  assert.equal(reset.state, "DRAFT");
  assert.equal(reset.researcherFingerprint, null);
  assert.equal(reset.privateSeal, null);
  assert.equal(reset.receipt, null);
  assert.equal(reset.privateEvidence.vulnerabilityDescription, "");
});
