import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(__dirname, "../../..");

function readWebFile(path: string): string {
  return readFileSync(resolve(repositoryRoot, "apps/web", path), "utf8");
}

void test("homepage keeps the competition-ready product section order", () => {
  const page = readWebFile("src/app/page.tsx");
  const markers = [
    "<GuidedProofDemo />",
    "<CredibilityMarquee />",
    'id="why-zeroseal"',
    'id="zeroseal-layer"',
    "<CompactClaimWorkspace />",
    'id="how-it-works"',
    'id="network-activity"',
    'id="use-cases"',
    'id="business"',
    'id="product-status"',
  ];

  const positions = markers.map((marker) => {
    const index = page.indexOf(marker);
    assert.notEqual(index, -1, `${marker} should be present`);
    return index;
  });

  assert.deepEqual(
    positions,
    [...positions].sort((a, b) => a - b),
    "homepage sections should match the required final mission order",
  );
});

void test("homepage exposes focused routes and restores a clean workspace preview", () => {
  const page = readWebFile("src/app/page.tsx");
  const heroActions = readWebFile("src/components/hero-actions.tsx");
  const workspace = readWebFile("src/components/compact-claim-workspace.tsx");
  const createRoute = readWebFile("src/app/create/page.tsx");
  const demoRoute = readWebFile("src/app/demo/page.tsx");
  const verifyRoute = readWebFile("src/app/verify/page.tsx");

  assert.match(page, /CompactClaimWorkspace/);
  assert.match(heroActions, /href="\/create"/);
  assert.match(heroActions, /href="\/demo"/);
  assert.match(heroActions, /href="\/verify"/);
  assert.match(workspace, /Reporting path/i);
  assert.match(workspace, /Severity/i);
  assert.match(workspace, /Continue creating claim/i);
  assert.doesNotMatch(workspace, /sample proof package loaded/i);
  assert.doesNotMatch(workspace, /ZeroSeal Security Impact Demo/i);
  assert.match(createRoute, /ClaimWizard mode="create"/);
  assert.match(demoRoute, /ClaimWizard mode="demo"/);
  assert.match(verifyRoute, /Check a ZeroSeal receipt/);
  assert.match(verifyRoute, /verifyReceiptIdentifier/);
  assert.match(verifyRoute, /Pending confirmation/);
  assert.match(verifyRoute, /Invalid or mismatched/);
});

void test("walkthrough controls are compact icons and ecosystem logos move", () => {
  const walkthrough = readWebFile("src/components/guided-proof-demo.tsx");
  const component = readWebFile("src/components/credibility-marquee.tsx");
  const paths = readWebFile("src/lib/reporting-paths.ts");
  const css = readWebFile("src/app/globals.css");
  const stamp = readWebFile("src/components/verified-stamp.tsx");

  assert.match(walkthrough, /aria-label="Play walkthrough"/);
  assert.match(walkthrough, /aria-label="Pause walkthrough"/);
  assert.match(walkthrough, /guided-demo__control-icon/);
  assert.match(walkthrough, /<svg viewBox="0 0 24 24"/);
  assert.doesNotMatch(walkthrough, />Start</);
  assert.doesNotMatch(walkthrough, />Previous</);
  assert.match(component, /function Track/);
  assert.match(component, /zs-marquee__motion/);
  assert.match(css, /@keyframes\s+ecosystemScroll/);
  assert.match(paths, /hackerone\.svg/);
  assert.match(component, /PLATFORMS/);
  assert.match(component, /zs-marquee__logo/);
  assert.match(component, /zs-marquee__word/);
  assert.match(paths, /cantina\.svg/);
  assert.match(stamp, /<path/);
  assert.doesNotMatch(stamp, /linear-gradient|rotate\(45deg\)|rotate\(-45deg\)/);
});

void test("Try ZeroSeal copy avoids preloaded or belittling language", () => {
  const wizard = readWebFile("src/components/claim-wizard.tsx");
  const walkthrough = readWebFile("src/components/guided-proof-demo.tsx");
  const workspace = readWebFile("src/components/compact-claim-workspace.tsx");
  const heroActions = readWebFile("src/components/hero-actions.tsx");
  const siteHeader = readWebFile("src/components/site-header.tsx");

  assert.doesNotMatch(
    `${wizard}\n${walkthrough}\n${workspace}`,
    new RegExp("fiction" + "al", "i"),
  );
  assert.doesNotMatch(`${wizard}\n${walkthrough}\n${workspace}`, /sample proof package loaded/i);
  assert.doesNotMatch(`${wizard}\n${walkthrough}\n${workspace}`, /PROOF PACKAGE/i);
  assert.match(`${wizard}\n${heroActions}\n${siteHeader}`, /Try ZeroSeal/);
  assert.doesNotMatch(
    `${wizard}\n${heroActions}\n${siteHeader}`,
    new RegExp("safe" + " demo", "i"),
  );
  assert.match(wizard, /Load example/);
  assert.match(wizard, /Generate private seal/);
});

void test("claim creator is a five-step product flow with mobile continuation", () => {
  const wizard = readWebFile("src/components/claim-wizard.tsx");
  const apiClient = readWebFile("src/lib/api/claims.ts");
  const controller = readFileSync(
    resolve(repositoryRoot, "apps/api/src/claims.controller.ts"),
    "utf8",
  );

  assert.match(wizard, /"Report"/);
  assert.match(wizard, /"Finding"/);
  assert.match(wizard, /"Private evidence"/);
  assert.match(wizard, /"Seal and public claim"/);
  assert.match(wizard, /"Sign and receipt"/);
  assert.doesNotMatch(wizard, /"Testnet action"/);
  assert.match(wizard, /Continue securely on desktop/);
  assert.match(wizard, /Copy desktop continuation link/);
  assert.match(wizard, /createBackendContinuation/);
  assert.match(wizard, /getBackendContinuation/);
  assert.doesNotMatch(wizard, /sessionStorage/);
  assert.match(wizard, /createBackendClaim/);
  assert.match(wizard, /recordBackendTransaction/);
  assert.match(wizard, /getApiReadiness/);
  assert.match(wizard, /Backend readiness failed/);
  assert.match(apiClient, /class ApiRequestError extends Error/);
  assert.match(controller, /continuations/);
});

void test("shared reporting paths cover all required options", () => {
  const paths = readWebFile("src/lib/reporting-paths.ts");
  const workspace = readWebFile("src/components/compact-claim-workspace.tsx");
  const wizard = readWebFile("src/components/claim-wizard.tsx");

  for (const name of [
    "HackerOne",
    "Bugcrowd",
    "Intigriti",
    "YesWeHack",
    "Immunefi",
    "HackenProof",
    "Code4rena",
    "CodeHawks",
    "Cantina",
    "Sherlock",
    "Hats Finance",
    "Direct to project",
    "Other",
  ]) {
    assert.match(paths, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(workspace, /REPORTING_PATHS/);
  assert.match(wizard, /REPORTING_CONTEXTS/);
  assert.match(workspace, /"Low", "Medium", "High", "Critical"/);
  assert.match(workspace, /aria-pressed/);
});

void test("frontend API client rejects localhost production configuration", () => {
  const apiClient = readWebFile("src/lib/api/claims.ts");

  assert.match(apiClient, /API_MISCONFIGURED/);
  assert.match(apiClient, /Production API cannot point to localhost/);
  assert.match(apiClient, /localhost\|127\\\.0\\\.0\\\.1\|0\\\.0\\\.0\\\.0/);
  assert.match(apiClient, /verifyReceiptIdentifier/);
});

void test("receipt page shows only confirmed backend receipts", () => {
  const receiptPage = readWebFile("src/app/receipt/[transactionHash]/page.tsx");

  assert.match(receiptPage, /getBackendReceipt/);
  assert.match(receiptPage, /backend-receipt/);
  assert.doesNotMatch(receiptPage, /public-claim/);
  assert.doesNotMatch(receiptPage, /getBackendTransaction/);
});

void test("trust gap section is a two-party bridge, not a generic card stack", () => {
  const page = readWebFile("src/app/page.tsx");
  const css = readWebFile("src/app/globals.css");

  assert.match(page, /trust-gap__bridge/);
  assert.match(page, /Researcher/);
  assert.match(page, /Security programme/);
  assert.match(page, /Close the gap before the exploit moves/);
  assert.match(page, /Early disclosure/);
  assert.match(css, /trust-gap__bridge/);
});
