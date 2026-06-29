import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(process.cwd(), "..");

function readWebFile(path: string): string {
  return readFileSync(join(root, "web", path), "utf8");
}

void test("homepage keeps the final demo-first information order", () => {
  const page = readWebFile("src/app/page.tsx");
  const markers = [
    "<GuidedProofDemo />",
    "<CredibilityMarquee />",
    'id="why-zeroseal"',
    'id="zeroseal-layer"',
    'id="how-it-works"',
    "<OnChainActivity />",
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
    "homepage sections should match the final mission order",
  );
});

void test("homepage links to focused claim routes instead of embedding workspace", () => {
  const page = readWebFile("src/app/page.tsx");
  const heroActions = readWebFile("src/components/hero-actions.tsx");
  const createRoute = readWebFile("src/app/create/page.tsx");
  const demoRoute = readWebFile("src/app/demo/page.tsx");
  const verifyRoute = readWebFile("src/app/verify/page.tsx");

  assert.doesNotMatch(page, /ResearcherRegistration/);
  assert.match(heroActions, /href="\/create"/);
  assert.match(heroActions, /href="\/demo"/);
  assert.match(heroActions, /href="\/verify"/);
  assert.match(createRoute, /ClaimWizard mode="create"/);
  assert.match(demoRoute, /ClaimWizard mode="demo"/);
  assert.match(verifyRoute, /Check a ZeroSeal receipt/);
});

void test("ecosystem logos render once from verified local assets", () => {
  const component = readWebFile("src/components/credibility-marquee.tsx");

  assert.match(component, /ECOSYSTEMS = \[/);
  assert.doesNotMatch(component, /MarqueeTrack/);
  assert.doesNotMatch(component, /credibility-marquee__motion/);
  assert.match(component, /hackerone\.svg/);
  assert.doesNotMatch(component, /hackenproof/i);
  assert.doesNotMatch(component, /cantina\.svg/);
});
