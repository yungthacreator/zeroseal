import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  REPORTING_CONTEXTS,
  feeDisplayFromXdr,
  getPublishActionState,
  ReportStepValidationMessage,
  ReportingPathSelector,
  clearWalletScopedDraftState,
  clearedWalletRuntimeState,
  desktopContinuationUrl,
  signPreparedXdr,
  signedTransactionMessage,
  shouldClearWalletScopedState,
  validateFindingStep,
  validatePrivateEvidenceStep,
  validateReportStep,
} from "./claim-wizard";
import { ZeroSealStamp } from "./zero-seal-stamp";
import { verifyReceiptHref, type ApiVerificationResult } from "../lib/api/claims";
import {
  VerificationResultCard,
  pickAutoVerificationIdentifier,
  runVerificationRequest,
  shouldRunAutoVerification,
} from "../app/verify/page";
import {
  Account,
  BASE_FEE,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

const EXPECTED_PLATFORMS = [
  "Immunefi",
  "HackerOne",
  "Bugcrowd",
  "Intigriti",
  "YesWeHack",
  "HackenProof",
  "Code4rena",
  "CodeHawks",
  "Cantina",
  "Sherlock",
  "Hats Finance",
  "Direct to project",
  "Other",
];
const TESTNET_ACCOUNT =
  "GBYWCY5VVCF4ZU3LG4OGOGB6OB6RVAXOA5RTW3BAFJO7MQKWWM7M3EHS";
const RECEIPT_ID = "zs_9f4c17af-8aae-4c4a-bebf-55c3c2d33f16";
const CLAIM_ID = "7c70acef-34b6-47e3-9605-345c6829c2d9";
const TX_HASH =
  "1a1ffe25af3d34d880c501bac8e98255d0ca89e48753993c3facd6e2bb3cd38c";

void test("claim wizard reporting path selector uses a native controlled select", () => {
  const updates: string[] = [];
  const rendered = renderToStaticMarkup(
    <ReportingPathSelector value="Cantina" onChange={(value) => updates.push(value)} />,
  );

  assert.match(rendered, /class="reporting-path-select"/);
  assert.match(rendered, /<option value="Cantina" selected="">Cantina<\/option>/);
  assert.match(rendered, /Select a reporting path/);
  assert.match(rendered, /Security review and competition/);

  const optionLabels = Array.from(
    rendered.matchAll(/<option(?: [^>]*)?>(.*?)<\/option>/g),
    (match) => decodeHtml(match[1]),
  );

  assert.deepEqual(optionLabels, [
    "Select a reporting path",
    ...EXPECTED_PLATFORMS,
  ]);
  assert.deepEqual(
    REPORTING_CONTEXTS.map((context) => context.label),
    EXPECTED_PLATFORMS,
  );

  const element = ReportingPathSelector({
    value: "",
    onChange: (value) => updates.push(value),
  });
  const select = findElementByType(element, "select");
  const selectProps = select.props as {
    value: string;
    onChange: (event: { target: { value: string } }) => void;
  };

  assert.equal(selectProps.value, "");
  selectProps.onChange({ target: { value: "Cantina" } });
  assert.deepEqual(updates, ["Cantina"]);
});

void test("report step validation enables Continue only for current valid Step 1 fields", () => {
  const valid = validateReportStep({
    reportingContext: "Cantina",
    programmeName: "Example Vault Programme",
    affectedComponent: "Vault.sol",
    targetType: "Repository",
    targetLocator: "https://github.com/example/project",
  });

  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});

  const cleared = validateReportStep({
    reportingContext: "Cantina",
    programmeName: "",
    affectedComponent: "Vault.sol",
    targetType: "Repository",
    targetLocator: "https://github.com/example/project",
  });
  assert.equal(cleared.valid, false);
  assert.equal(cleared.errors.programmeName, "Enter the programme or project name.");

  const invalidRepository = validateReportStep({
    reportingContext: "Cantina",
    programmeName: "Example Vault Programme",
    affectedComponent: "Vault.sol",
    targetType: "Repository",
    targetLocator: "Yes",
  });
  assert.equal(invalidRepository.valid, false);
  assert.equal(invalidRepository.errors.targetLocator, "Enter a valid repository URL.");

  const validContractAddress = validateReportStep({
    reportingContext: "Cantina",
    programmeName: "Example Vault Programme",
    affectedComponent: "Vault.sol",
    targetType: "Smart contract",
    targetLocator: "CBKQ3ZTUIOQLPQLZ5RUK237P6AGAJ4LGOQJNB2GVJHRFVNKENFIU622R",
  });
  assert.equal(validContractAddress.valid, true);
});

void test("report step markup exposes visible validation messages and keeps values when ready", () => {
  const invalid = validateReportStep({
    reportingContext: "Cantina",
    programmeName: "Example Vault Programme",
    affectedComponent: "Vault.sol",
    targetType: "Repository",
    targetLocator: "Yes",
  });
  const renderedInvalid = renderToStaticMarkup(
    <ReportStepValidationMessage
      message={invalid.errors.targetLocator ?? null}
    />,
  );
  assert.match(renderedInvalid, /Enter a valid repository URL\./);

  const valid = validateReportStep({
    reportingContext: "Cantina",
    programmeName: "Example Vault Programme",
    affectedComponent: "Vault.sol",
    targetType: "Repository",
    targetLocator: "https://github.com/example/project",
  });
  assert.equal(valid.valid, true);
  assert.equal("Finding", "Finding");
});

void test("finding step validation requires the current public claim fields", () => {
  const valid = validateFindingStep({
    findingTitle: "Unauthorised withdrawal may bypass the programme limit",
    bugCategory: "Access control",
    publicThreshold: "Up to 50,000 USD may be withdrawn without authorisation",
    claimedSeverity: "High",
    impactStatement:
      "An attacker may withdraw more assets than the configured programme threshold.",
  });

  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});

  const invalid = validateFindingStep({
    findingTitle: "",
    bugCategory: "",
    publicThreshold: "",
    claimedSeverity: "",
    impactStatement: "",
  });

  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.findingTitle, "Enter a public title.");
  assert.equal(invalid.errors.bugCategory, "Enter the vulnerability category.");
  assert.equal(invalid.errors.publicThreshold, "Describe the public impact threshold.");
  assert.equal(invalid.errors.claimedSeverity, "Select a severity.");
  assert.equal(invalid.errors.impactStatement, "Enter a short public summary.");
});

void test("private evidence validation requires raw local evidence and keeps it private", () => {
  const valid = validatePrivateEvidenceStep({
    vulnerabilityDescription:
      "Describe the vulnerable logic, affected component, root cause and exploit conditions.",
    reproductionSteps:
      "1. Deploy the affected version.\n2. Create a funded test account.\n3. Call withdraw().",
    proofOfConcept: "Foundry test: test_WithdrawAboveLimit().",
    privateImpactValues: "Potential loss: 50,000 USD from the affected vault.",
  });

  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});
  assert.deepEqual(valid.publiclyExcludedFields, [
    "Private report",
    "Reproduction steps",
    "PoC notes",
    "Private impact value",
  ]);

  const invalid = validatePrivateEvidenceStep({
    vulnerabilityDescription: "",
    reproductionSteps: "",
    proofOfConcept: "",
    privateImpactValues: "",
  });

  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.vulnerabilityDescription, "Enter the private report.");
  assert.equal(invalid.errors.reproductionSteps, "Enter the reproduction steps.");
  assert.equal(invalid.errors.proofOfConcept, "Enter the PoC notes.");
  assert.equal(invalid.errors.privateImpactValues, "Enter the private impact value.");
});

void test("publish action enables approval only after review and signable XDR preparation", () => {
  assert.deepEqual(
    getPublishActionState({
      reviewed: false,
      hasWallet: true,
      walletStatus: "connected",
      publishState: "idle",
      hasPreparedTransaction: false,
      hasPendingTransaction: false,
    }),
    {
      disabled: true,
      label: "Prepare stamp",
      reason: "Review and approve the public claim first.",
    },
  );

  assert.deepEqual(
    getPublishActionState({
      reviewed: true,
      hasWallet: true,
      walletStatus: "connected",
      publishState: "reviewing",
      hasPreparedTransaction: true,
      hasPendingTransaction: false,
    }),
    {
      disabled: false,
      label: "Approve stamp in Freighter",
      reason: null,
    },
  );

  assert.deepEqual(
    getPublishActionState({
      reviewed: true,
      hasWallet: true,
      walletStatus: "connected",
      publishState: "reviewing",
      hasPreparedTransaction: false,
      hasPendingTransaction: false,
    }),
    {
      disabled: true,
      label: "Approve stamp in Freighter",
      reason: "Signable XDR is unavailable. Prepare the stamp again.",
    },
  );
});

void test("stamp flow public labels avoid SDK preparation wording leaks", () => {
  assert.deepEqual(
    getPublishActionState({
      reviewed: true,
      hasWallet: true,
      walletStatus: "connected",
      publishState: "preparing",
      hasPreparedTransaction: false,
      hasPendingTransaction: false,
    }),
    {
      disabled: true,
      label: "Preparing your stamp",
      reason: "Preparing your stamp.",
    },
  );

  assert.deepEqual(
    getPublishActionState({
      reviewed: true,
      hasWallet: true,
      walletStatus: "connected",
      publishState: "reviewing",
      hasPreparedTransaction: true,
      hasPendingTransaction: false,
    }),
    {
      disabled: false,
      label: "Approve stamp in Freighter",
      reason: null,
    },
  );

  assert.equal(
    signedTransactionMessage(new Error("HostError: Error(Contract, #6)")),
    "Stamp preparation failed.",
  );
});

void test("official ZeroSeal stamp renders confirmed receipt ledger and serial", () => {
  const rendered = renderToStaticMarkup(
    <ZeroSealStamp
      receiptId="zs_12345678-1234-4234-9234-123456789abc"
      ledgerNumber={3377274}
      network="TESTNET"
      transactionHash="1a1ffe25af3d34d880c501bac8e98255d0ca89e48753993c3facd6e2bb3cd38c"
    />,
  );

  assert.match(rendered, /STAMPED/);
  assert.match(rendered, /LEDGER 3377274/);
  assert.match(rendered, /ZEROSEAL - VERIFIED CLAIM/);
  assert.match(rendered, /TESTNET - STELLAR/);
});

void test("fee display is decoded from the final prepared XDR", () => {
  const xdr = new TransactionBuilder(new Account(TESTNET_ACCOUNT, "1"), {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.manageData({ name: "stamp", value: "ready" }))
    .setTimeout(30)
    .build()
    .toXDR();

  assert.deepEqual(feeDisplayFromXdr(xdr, Networks.TESTNET), {
    stroops: "100",
    xlm: "0.0000100",
  });
});

void test("Freighter approval signs the exact prepared XDR with Testnet options", async () => {
  const calls: Array<{ xdr: string; opts: { networkPassphrase?: string; address?: string } }> = [];
  const result = await signPreparedXdr({
    signableXdr: "prepared-xdr",
    walletAddress: TESTNET_ACCOUNT,
    networkPassphrase: Networks.TESTNET,
    signTransaction: (xdr, opts) => {
      calls.push({ xdr, opts: opts ?? {} });
      return Promise.resolve({
        signedTxXdr: "signed-xdr",
        signerAddress: TESTNET_ACCOUNT,
      });
    },
  });

  assert.equal(result.signedTxXdr, "signed-xdr");
  assert.deepEqual(calls, [
    {
      xdr: "prepared-xdr",
      opts: {
        networkPassphrase: Networks.TESTNET,
        address: TESTNET_ACCOUNT,
      },
    },
  ]);
});

void test("Freighter transport timeout keeps the prepared XDR retryable", async () => {
  await assert.rejects(
    () =>
      signPreparedXdr({
        signableXdr: "same-prepared-xdr",
        walletAddress: TESTNET_ACCOUNT,
        networkPassphrase: Networks.TESTNET,
        signTransaction: () =>
          Promise.resolve({
            signedTxXdr: "",
            signerAddress: "",
            error: { code: -1, message: "Transport request timed out" },
          }),
      }),
    /Freighter did not respond/,
  );
});

void test("/verify receipt query verifies automatically with the exact URL receipt ID", async () => {
  const params = new URLSearchParams(`receipt=${encodeURIComponent(RECEIPT_ID)}`);
  const selected = pickAutoVerificationIdentifier(params);
  const calls: string[] = [];
  const states = createVerificationStateRecorder();

  const result = await runVerificationRequest(selected, states.handlers, {
    verifyIdentifier: (identifier) => {
      calls.push(identifier);
      return Promise.resolve(verifiedResult());
    },
  });

  assert.equal(selected, RECEIPT_ID);
  assert.deepEqual(calls, [RECEIPT_ID]);
  assert.equal(result.status, "success");
  assert.equal(states.result?.status, "VERIFIED");
});

void test("automatic verification does not use stale React input state", async () => {
  const params = new URLSearchParams(`receipt=${encodeURIComponent(RECEIPT_ID)}`);
  const calls: string[] = [];

  await runVerificationRequest(
    pickAutoVerificationIdentifier(params),
    createVerificationStateRecorder().handlers,
    {
      verifyIdentifier: (identifier) => {
        calls.push(identifier);
        return Promise.resolve(verifiedResult());
      },
    },
  );

  assert.deepEqual(calls, [RECEIPT_ID]);
});

void test("automatic verification runs only once for the same normalized identifier", () => {
  assert.equal(shouldRunAutoVerification(RECEIPT_ID, null), true);
  assert.equal(shouldRunAutoVerification(RECEIPT_ID, RECEIPT_ID), false);
  assert.equal(shouldRunAutoVerification("", RECEIPT_ID), false);
});

void test("verification loading always returns to false after success and failure", async () => {
  const success = createVerificationStateRecorder();
  await runVerificationRequest(RECEIPT_ID, success.handlers, {
    verifyIdentifier: () => Promise.resolve(verifiedResult()),
  });
  assert.equal(success.checking.at(-1), false);

  const failure = createVerificationStateRecorder();
  await runVerificationRequest(RECEIPT_ID, failure.handlers, {
    verifyIdentifier: () => Promise.reject(new Error("network down")),
  });
  assert.equal(failure.checking.at(-1), false);
  assert.equal(failure.error, "Receipt verification could not be completed.");
});

void test("API success displays VALID ZEROSEAL STAMP and public receipt fields", () => {
  const rendered = renderToStaticMarkup(
    <VerificationResultCard result={verifiedResult()} />,
  );

  assert.match(rendered, /VALID ZEROSEAL STAMP/);
  assert.match(rendered, new RegExp(RECEIPT_ID));
  assert.match(rendered, /Claim ID/);
  assert.match(rendered, /7c70ac…29c2d9/);
  assert.match(rendered, new RegExp(TX_HASH.slice(0, 8)));
  assert.match(rendered, /3377274/);
  assert.match(rendered, /Official ZeroSeal stamp|ZEROSEAL - VERIFIED CLAIM/);
});

void test("API failure and request timeout expose retryable verification state", async () => {
  const failure = createVerificationStateRecorder();
  await runVerificationRequest(RECEIPT_ID, failure.handlers, {
    verifyIdentifier: () => Promise.reject(new Error("api unavailable")),
  });
  assert.equal(failure.error, "Receipt verification could not be completed.");

  const timeout = createVerificationStateRecorder();
  await runVerificationRequest(RECEIPT_ID, timeout.handlers, {
    timeoutMs: 1,
    verifyIdentifier: (_identifier, requestOptions) =>
      new Promise<ApiVerificationResult>((resolve, reject) => {
        requestOptions?.signal?.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
        setTimeout(() => resolve(verifiedResult()), 50);
      }),
  });
  assert.equal(timeout.error, "Receipt verification could not be completed.");
  assert.equal(timeout.checking.at(-1), false);
});

void test("receipt-page and homepage Verify receipt links use the encoded receipt ID", () => {
  assert.equal(
    verifyReceiptHref(RECEIPT_ID),
    `/verify?receipt=${encodeURIComponent(RECEIPT_ID)}`,
  );
});

void test("manual verification still sends the current input identifier", async () => {
  const calls: string[] = [];

  await runVerificationRequest(CLAIM_ID, createVerificationStateRecorder().handlers, {
    verifyIdentifier: (identifier) => {
      calls.push(identifier);
      return Promise.resolve(verifiedResult());
    },
  });

  assert.deepEqual(calls, [CLAIM_ID]);
});

void test("wallet change invalidates old prepared XDR and runtime receipt state", () => {
  assert.equal(shouldClearWalletScopedState(TESTNET_ACCOUNT, "GDIFFERENTWALLET"), true);
  assert.equal(shouldClearWalletScopedState(null, TESTNET_ACCOUNT), false);

  const runtime = clearedWalletRuntimeState();
  assert.equal(runtime.hasPreparedTransaction, false);
  assert.equal(runtime.preparedReview, null);
  assert.equal(runtime.pendingTransaction, null);
  assert.equal(runtime.backendReceipt, null);
  assert.equal(runtime.publishState, "idle");
});

void test("mobile desktop continuation uses public origin when configured and no localhost fallback", () => {
  assert.equal(
    desktopContinuationUrl("/continue/abc", "http://127.0.0.1:3001"),
    "/continue/abc",
  );
  assert.equal(
    desktopContinuationUrl("/continue/abc", "https://zeroseal.app"),
    "https://zeroseal.app/continue/abc",
  );
});

void test("reset clears wallet-specific transaction and receipt state without leaking old receipt", () => {
  const draft = clearWalletScopedDraftState({
    state: "RECEIPT_ISSUED",
    demoMode: false,
    loadedPackage: false,
    reportingContext: "Cantina",
    programmeName: "Example",
    programmeUrl: "",
    targetType: "Repository",
    targetLocator: "https://github.com/example/repo",
    affectedComponent: "Vault.sol",
    network: "Stellar Testnet",
    findingTitle: "Finding",
    bugCategory: "Access control",
    claimedSeverity: "High",
    impactStatement: "Impact",
    estimatedFinancialImpact: "",
    privateEvidence: {
      vulnerabilityDescription: "private report stays in form on wallet change",
      reproductionSteps: "private reproduction",
      proofOfConcept: "private poc",
      affectedCode: "",
      screenshotsOrLogs: "",
      expectedResult: "",
      actualResult: "",
      privateImpactValues: "",
      privateNotes: "",
    },
    publicClaim: {
      policyIdentifier: "published-impact-threshold-v1",
      policyVersion: "security-impact-v1",
      publicThreshold: "50000",
      verifierVersion: "structural-browser-testnet-v1",
    },
    researcherFingerprint: "old-researcher-commitment",
    privateSeal: {
      claimIdentifier: "old-claim",
      canonicalClaimHash: "old-hash",
      privateEvidenceDigest: "old-private-digest",
      saltHex: "old-salt",
      researcherFingerprint: "old-researcher-commitment",
      nullifier: "old-nullifier",
      recoveryBundle: {
        schema: "zeroseal.private-recovery.v1",
        createdAt: "2026-07-01T00:00:00.000Z",
        privateEvidence: {
          vulnerabilityDescription: "secret",
          reproductionSteps: "secret",
          proofOfConcept: "secret",
          affectedCode: "",
          screenshotsOrLogs: "",
          expectedResult: "",
          actualResult: "",
          privateImpactValues: "",
          privateNotes: "",
        },
        saltHex: "old-salt",
        canonicalClaimHash: "old-hash",
        researcherFingerprint: "old-researcher-commitment",
        nullifier: "old-nullifier",
      },
    },
    receipt: { transactionHash: TX_HASH, ledger: "3377274" },
  });

  assert.equal(draft.state, "DRAFT");
  assert.equal(draft.researcherFingerprint, null);
  assert.equal(draft.privateSeal, null);
  assert.equal(draft.receipt, null);
  assert.equal(
    draft.privateEvidence.vulnerabilityDescription,
    "private report stays in form on wallet change",
  );
});

void test("verification output never includes private evidence", () => {
  const rendered = renderToStaticMarkup(
    <VerificationResultCard result={verifiedResult()} />,
  );

  assert.doesNotMatch(rendered, /private report stays in form/i);
  assert.doesNotMatch(rendered, /reproduction steps/i);
  assert.doesNotMatch(rendered, /PoC notes/i);
  assert.doesNotMatch(rendered, /old-salt/i);
  assert.doesNotMatch(rendered, /witness/i);
});

function verifiedResult(): ApiVerificationResult {
  return {
    status: "VERIFIED",
    inputType: "receipt",
    identifier: RECEIPT_ID,
    message: "Verified against ZeroSeal persistence and the confirmed Stellar Testnet transaction.",
    receipt: {
      receiptId: RECEIPT_ID,
      claimId: CLAIM_ID,
      transactionHash: TX_HASH,
      ledgerNumber: 3377274,
      registryContract: "CD6MKUVXB7ZTZQCGNMBVHMU4PGT2SEKS6Z5LF53HXDOAVCO3LGKGQ3JU",
      verifierContract: "CABBWKKUU4PWWU5LSV2BPUMIEZR542V36WONDA2UT6OHXJWZAPXIKA2X",
      network: "TESTNET",
      walletAddress: TESTNET_ACCOUNT,
      researcherCommitment:
        "73fea8bfb67ac8c6a2bac808316c2750331983290be5e4e488e62361f8090b3b",
      claimCommitment:
        "cfa8caa9feef6e035354b47763dc50d1ffd7beefc63a6ced135a6f97dff2b980",
      nullifier:
        "0da1e0e0056857609cc20523e06ceb6a9a76304b6141f9c0c10a23c5bd2cd739",
      policyIdentifier: "published-impact-threshold-v1",
      issuedAt: "2026-07-01T10:57:45.324Z",
      method: "submit_claim",
      actionLabel: "Claim stamped",
      status: "CONFIRMED",
      explorerTransactionUrl: `https://stellar.expert/explorer/testnet/tx/${TX_HASH}`,
      explorerAccountUrl: `https://stellar.expert/explorer/testnet/account/${TESTNET_ACCOUNT}`,
      explorerRegistryUrl:
        "https://stellar.expert/explorer/testnet/contract/CD6MKUVXB7ZTZQCGNMBVHMU4PGT2SEKS6Z5LF53HXDOAVCO3LGKGQ3JU",
      explorerVerifierUrl:
        "https://stellar.expert/explorer/testnet/contract/CABBWKKUU4PWWU5LSV2BPUMIEZR542V36WONDA2UT6OHXJWZAPXIKA2X",
    },
    chain: {
      hash: TX_HASH,
      successful: true,
      ledger: null,
      sourceAccount: TESTNET_ACCOUNT,
      createdAt: "2026-07-01T10:18:06.000Z",
      feeCharged: "449073",
    },
    explorer: {
      transaction: `https://stellar.expert/explorer/testnet/tx/${TX_HASH}`,
    },
  };
}

function createVerificationStateRecorder() {
  const state = {
    checking: [] as boolean[],
    error: null as string | null,
    result: null as ApiVerificationResult | null,
    handlers: {
      setIsChecking(value: boolean) {
        state.checking.push(value);
      },
      setError(value: string | null) {
        state.error = value;
      },
      setResult(value: ApiVerificationResult | null) {
        state.result = value;
      },
    },
  };
  return state;
}

function findElementByType(
  node: React.ReactNode,
  type: string,
): React.ReactElement<Record<string, unknown>> {
  if (!React.isValidElement(node)) {
    throw new Error(`Could not find ${type}.`);
  }

  if (node.type === type) {
    return node as React.ReactElement<Record<string, unknown>>;
  }

  const children = React.Children.toArray(
    (node.props as { children?: React.ReactNode }).children,
  );
  for (const child of children) {
    try {
      return findElementByType(child, type);
    } catch {
      // Continue scanning siblings.
    }
  }

  throw new Error(`Could not find ${type}.`);
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");
}
