import { BusinessModelCarousel } from "@/components/business-model-carousel";
import { CompactClaimWorkspace } from "@/components/compact-claim-workspace";
import { CredibilityMarquee } from "@/components/credibility-marquee";
import { GuidedProofDemo } from "@/components/guided-proof-demo";
import { HeroActions } from "@/components/hero-actions";
import { HowItWorksTerminal } from "@/components/how-it-works-terminal";
import { OnChainActivity } from "@/components/on-chain-activity";
import { ProductStatusTerminal } from "@/components/product-status-terminal";
import { RoadmapColumns } from "@/components/roadmap-columns";
import { SiteHeader } from "@/components/site-header";
import { StellarActivity } from "@/components/stellar-activity";
import { UseCaseEngine } from "@/components/use-case-engine";
import { SealCheck, StampSeal } from "@/components/zeroseal-seal";
import { shortenAddress } from "@/lib/presentation";
import { explorerContractUrl } from "@/lib/stellar/testnet";
import {
  DEFAULT_REGISTRY_CONTRACT_ID,
  DEFAULT_VERIFIER_CONTRACT_ID,
} from "@/lib/stellar/config";

const registryContractId =
  process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID ?? DEFAULT_REGISTRY_CONTRACT_ID;

const verifierContractId =
  process.env.NEXT_PUBLIC_VERIFIER_CONTRACT_ID ?? DEFAULT_VERIFIER_CONTRACT_ID;

const TECH_PIPELINE = [
  "Keep evidence private",
  "Prove an approved public claim",
  "Record a Testnet receipt",
] as const;

const TRUST_POINTS = [
  "Evidence remains local",
  "You approve every public field",
  "Receipt appears after Testnet confirmation",
] as const;

const TRUST_CONFLICTS = [
  "Early disclosure",
  "Duplicate disagreement",
  "Severity disagreement",
] as const;

const ZEROSEAL_STAGES = [
  {
    title: "Report",
    text: "Report detail stays local.",
  },
  {
    title: "PoC",
    text: "A commitment is created in the browser.",
  },
  {
    title: "Notes",
    text: "Only selected fields move forward.",
  },
  {
    title: "Private Seal",
    text: "The current circuit checks the public threshold.",
  },
  {
    title: "Verified Public Record",
    text: "A confirmed Testnet record can be inspected later.",
  },
] as const;

const TRADITIONAL_DISCLOSURE = [
  "Share the report first",
  "Rely heavily on private trust",
  "Negotiate impact after exposure",
  "Keep the record inside one platform",
] as const;

const ZEROSEAL_DISCLOSURE = [
  "Keep sensitive evidence local",
  "Present only permitted public claim data",
  "Create a policy-linked verification path",
  "Record confirmed actions on Stellar Testnet",
] as const;

const FOOTER_PRODUCT_LINKS = [
  { label: "Why ZeroSeal", href: "#why-zeroseal" },
  { label: "Try ZeroSeal", href: "/demo" },
  { label: "Create claim", href: "/create" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Network activity", href: "#network-activity" },
] as const;

const FOOTER_DEVELOPER_LINKS = [
  { label: "Registry contract", href: explorerContractUrl(registryContractId) },
  { label: "Verifier contract", href: explorerContractUrl(verifierContractId) },
  { label: "GitHub", href: "https://github.com/yungthacreator/zeroseal" },
] as const;

export default function Home() {
  return (
    <div id="top">
      <SiteHeader />

      <main>
        <section className="hero" id="hero">
          <div className="shell hero__inner">
            <StampSeal size={104} className="hero__seal" />
            <p className="eyebrow">
              PROVE THE APPROVED CLAIM. KEEP THE EXPLOIT PRIVATE.
            </p>
            <h1 className="display display--hero hero__headline">
              Keep the exploit
              <br />
              <em>private.</em>
            </h1>
            <p className="lede hero__lede">
              Seal sensitive evidence, approve the public claim and create a
              verifiable Stellar Testnet receipt.
            </p>
            <HeroActions />
            <ul className="hero__trust" aria-label="ZeroSeal trust points">
              {TRUST_POINTS.map((point) => (
                <li key={point}>
                  <SealCheck size={20} />
                  {point}
                </li>
              ))}
            </ul>
            <div className="tech-pipeline" aria-label="Technical pipeline">
              <ol>
                {TECH_PIPELINE.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
              <p>
                <span className="live-dot" aria-hidden="true" />
                Create, try or verify on Stellar Testnet
              </p>
            </div>
          </div>
        </section>

        <GuidedProofDemo />

        <CredibilityMarquee />

        <section className="section section--cream trust-gap" id="why-zeroseal">
          <div className="shell">
            <div className="trust-gap__layout">
              <header className="trust-gap__head">
                <p className="eyebrow">The disclosure trust gap</p>
                <h2 className="display display--lg">
                  Close the gap before the exploit moves.
                </h2>
                <p className="lede">
                  ZeroSeal gives researchers and programmes a shared proof
                  surface before private exploit detail ever leaves the
                  reporter.
                </p>
                <ul className="trust-gap__conflicts" aria-label="What the gap causes">
                  {TRUST_CONFLICTS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </header>

              <ol className="trust-gap__bridge" aria-label="How ZeroSeal bridges the two sides">
                <li className="trust-gap__party">
                  <span>Researcher</span>
                  <p>
                    I need to prove my finding matters without giving away the
                    full exploit first.
                  </p>
                </li>
                <li className="trust-gap__seal">
                  <StampSeal size={56} className="trust-gap__seal-mark" />
                  <div>
                    <span>ZeroSeal</span>
                    <p>An approved public claim, backed by sealed private evidence.</p>
                  </div>
                </li>
                <li className="trust-gap__party">
                  <span>Security programme</span>
                  <p>
                    I need enough evidence to accept, prioritise and pay for a
                    serious claim.
                  </p>
                </li>
              </ol>
            </div>
          </div>
        </section>

        <section className="section section--paper story-section" id="zeroseal-layer">
          <div className="shell">
            <div className="zeroseal-layer-panel">
              <header className="section__head">
                <p className="eyebrow">THE ZEROSEAL LAYER</p>
                <h2 className="display display--lg">
                  A verification layer between discovery and disclosure.
                </h2>
                <p className="lede">
                  Private evidence stays with the researcher. Only the approved
                  public claim moves through verification and the confirmed
                  registry action is recorded on Stellar.
                </p>
              </header>
              <div className="zeroseal-stage-flow" aria-label="ZeroSeal verification layer flow">
                {ZEROSEAL_STAGES.map((stage, index) => (
                  <article className="zeroseal-stage" key={stage.title}>
                    <span className="zeroseal-stage__icon" aria-hidden="true" />
                    <h3>{stage.title}</h3>
                    <p>{stage.text}</p>
                    {index < ZEROSEAL_STAGES.length - 1 ? (
                      <span className="zeroseal-stage__arrow" aria-hidden="true">v</span>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
            <details className="technical-details comparison-details">
              <summary>Compare disclosure paths</summary>
              <div className="comparison-table" aria-label="Disclosure comparison">
                <section>
                  <h3>Traditional disclosure</h3>
                  <ul>
                    {TRADITIONAL_DISCLOSURE.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>ZeroSeal-assisted disclosure</h3>
                  <ul>
                    {ZEROSEAL_DISCLOSURE.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              </div>
            </details>
          </div>
        </section>

        <CompactClaimWorkspace />

        <section className="section section--dotted" id="how-it-works">
          <div className="shell">
            <header className="section__head section__head--split">
              <div>
                <p className="eyebrow">HOW IT WORKS</p>
                <h2 className="display display--lg">
                  Private evidence in. Public assurance out.
                </h2>
              </div>
              <p className="lede">
                Move from private evidence to a public receipt without turning
                the homepage into a technical document.
              </p>
            </header>
            <HowItWorksTerminal />
          </div>
        </section>

        <section className="section section--cream" id="network-activity">
          <div className="shell">
            <header className="section__head section__head--split">
              <div>
                <p className="eyebrow">Network activity</p>
                <h2 className="display display--lg">
                  Real state, visible on Stellar
                </h2>
              </div>
              <p className="lede">
                ZeroSeal shows transaction data only after a real confirmation
                or retained receipt exists.
              </p>
            </header>
            <OnChainActivity />
            <StellarActivity />
          </div>
        </section>

        <section className="section section--cream" id="use-cases">
          <div className="shell">
            <UseCaseEngine />
          </div>
        </section>

        <section className="section section--paper" id="business">
          <div className="shell">
            <header className="section__head">
              <p className="eyebrow">PROGRAMME INFRASTRUCTURE</p>
              <h2 className="display display--lg">
                Verification infrastructure for security programmes.
              </h2>
              <p className="lede">
                Programmes can configure claim rules, verification capacity and
                public receipt workflows.
              </p>
            </header>
            <BusinessModelCarousel />
          </div>
        </section>

        <section className="section section--paper" id="roadmap">
          <div className="shell">
            <header className="section__head">
              <p className="eyebrow">THE NEXT ZEROSEAL LAYER</p>
              <h2 className="display display--lg">
                Private security claims can become confidential settlement infrastructure.
              </h2>
              <p className="lede">
                These capabilities are planned. Today, ZeroSeal provides claim
                stamping, public receipts and receipt verification on Stellar Testnet.
              </p>
            </header>
            <RoadmapColumns />
          </div>
        </section>

        <section className="section section--cream" id="product-status">
          <div className="shell">
            <header className="section__head">
              <p className="eyebrow">Product status</p>
              <h2 className="display display--lg">Operational surface</h2>
            </header>
            <ProductStatusTerminal />
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="shell footer__inner">
          <div className="footer__brand">
            <strong>ZeroSeal</strong>
            <p>Privacy-preserving security claims on Stellar Testnet.</p>
          </div>
          <nav className="footer__col" aria-label="Product">
            <h2>Product</h2>
            <ul>
              {FOOTER_PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <nav className="footer__col" aria-label="Developers">
            <h2>Developers</h2>
            <ul>
              {FOOTER_DEVELOPER_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <nav className="footer__col" aria-label="Testnet status">
            <h2>Testnet status</h2>
            <ul>
              <li>
                <span>ZeroSeal is running on Stellar Testnet with claim stamping, public receipts and receipt verification.</span>
              </li>
              <li>
                <a href="#use-cases">Use cases</a>
              </li>
            </ul>
          </nav>
        </div>
        <div className="shell footer__bottom">
          <span>ZeroSeal is live on Stellar Testnet.</span>
          <span>Copyright 2026 ZeroSeal</span>
          <span>Network TESTNET</span>
          <a href={explorerContractUrl(registryContractId)} target="_blank" rel="noreferrer">
            Registry{" "}
            <span className="mono" title={registryContractId}>
              {shortenAddress(registryContractId)}
            </span>
          </a>
          <a href={explorerContractUrl(verifierContractId)} target="_blank" rel="noreferrer">
            Verifier{" "}
            <span className="mono" title={verifierContractId}>
              {shortenAddress(verifierContractId)}
            </span>
          </a>
        </div>
      </footer>
    </div>
  );
}
