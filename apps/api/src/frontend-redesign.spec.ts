import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(process.cwd(), "..");

function readWebFile(path: string): string {
  return readFileSync(join(root, "web", path), "utf8");
}

void test("homepage keeps the competition-ready product section order", () => {
  const page = readWebFile("src/app/page.tsx");
  const markers = [
    "<GuidedProofDemo />",
    "<CredibilityMarquee />",
    'id="why-zeroseal"',
    'id="zeroseal-layer"',
    "<ResearcherRegistration />",
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
  const workspace = readWebFile("src/components/researcher-registration.tsx");
  const createRoute = readWebFile("src/app/create/page.tsx");
  const demoRoute = readWebFile("src/app/demo/page.tsx");
  const verifyRoute = readWebFile("src/app/verify/page.tsx");

  assert.match(page, /ResearcherRegistration/);
  assert.match(heroActions, /href="\/create"/);
  assert.match(heroActions, /href="\/demo"/);
  assert.match(heroActions, /href="\/verify"/);
  assert.match(workspace, /Select programme/i);
  assert.match(workspace, /Add finding/i);
  assert.match(workspace, /Generate seal/i);
  assert.match(workspace, /ZeroSeal Security Impact Registry/i);
  assert.doesNotMatch(workspace, /sample proof package loaded/i);
  assert.doesNotMatch(workspace, /ZeroSeal Security Impact Demo/i);
  assert.match(createRoute, /ClaimWizard mode="create"/);
  assert.match(demoRoute, /ClaimWizard mode="demo"/);
  assert.match(verifyRoute, /Check a ZeroSeal receipt/);
});

void test("walkthrough controls are compact icons and ecosystem logos move", () => {
  const walkthrough = readWebFile("src/components/guided-proof-demo.tsx");
  const component = readWebFile("src/components/credibility-marquee.tsx");
  const css = readWebFile("src/app/globals.css");

  assert.match(walkthrough, /aria-label="Play walkthrough"/);
  assert.match(walkthrough, /aria-label="Pause walkthrough"/);
  assert.match(walkthrough, /guided-demo__control-icon/);
  assert.doesNotMatch(walkthrough, />Start</);
  assert.doesNotMatch(walkthrough, />Previous</);
  assert.match(component, /ECOSYSTEMS = \[/);
  assert.match(component, /MarqueeTrack/);
  assert.match(component, /credibility-marquee__motion/);
  assert.match(css, /@keyframes\s+ecosystemScroll/);
  assert.match(component, /hackerone\.svg/);
  assert.doesNotMatch(component, /hackenproof/i);
  assert.match(component, /cantina\.svg/);
});

void test("Try ZeroSeal copy avoids preloaded or toy-like language", () => {
  const wizard = readWebFile("src/components/claim-wizard.tsx");
  const walkthrough = readWebFile("src/components/guided-proof-demo.tsx");
  const workspace = readWebFile("src/components/researcher-registration.tsx");
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

void test("trust gap section is a product comparison, not a generic card stack", () => {
  const page = readWebFile("src/app/page.tsx");
  const css = readWebFile("src/app/globals.css");

  assert.match(page, /trust-gap__matrix/);
  assert.match(page, /Close the trust gap before the exploit moves/);
  assert.match(page, /Traditional path/);
  assert.match(page, /ZeroSeal path/);
  assert.match(css, /trust-gap__matrix/);
});
