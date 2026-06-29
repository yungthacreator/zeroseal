import { BusinessModelCarousel } from "@/components/business-model-carousel";
import { CredibilityMarquee } from "@/components/credibility-marquee";
import { GuidedProofDemo } from "@/components/guided-proof-demo";
import { HeroActions } from "@/components/hero-actions";
import { HowItWorksTerminal } from "@/components/how-it-works-terminal";
import { OnChainActivity } from "@/components/on-chain-activity";
import { ProductStatusTerminal } from "@/components/product-status-terminal";
import { ResearcherRegistration } from "@/components/researcher-registration";
import { SiteHeader } from "@/components/site-header";
import { StellarActivity } from "@/components/stellar-activity";
import { UseCaseEngine } from "@/components/use-case-engine";
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
  "Evidence stays on your device",
  "Only approved public data is exposed",
  "Confirmed actions receive a Testnet receipt",
] as const;

const TRUST_GAP_ROWS = [
  {
    tension: "Early triage",
    current: "The reporter shares sensitive mechanics before the programme has made a decision.",
    zeroseal: "The reporter creates a private seal and exposes only the approved public claim.",
  },
  {
    tension: "Overlap review",
    current: "Duplicate decisions often sit inside one platform or inbox.",
    zeroseal: "A policy-linked fingerprint and nullifier give both sides a public reference.",
  },
  {
    tension: "Impact confidence",
    current: "Severity is negotiated while raw evidence is still risky to move around.",
    zeroseal: "The public threshold and private seal separate impact signal from exploit detail.",
  },
  {
    tension: "Public record",
    current: "The proof trail stays fragmented across screenshots, ticket notes and private mail.",
    zeroseal: "A confirmed Stellar Testnet action creates an inspectable receipt after approval.",
  },
] as const;

const SOLUTION_CARDS = [
  {
    title: "Keep the evidence private",
    text: "Reports, PoCs, screenshots, notes and witness values stay on the researcher's device.",
  },
  {
    title: "Present only the approved claim",
    text: "ZeroSeal prepares the programme, threshold, fingerprint and nullifier as public fields.",
  },
  {
    title: "Create a durable public record",
    text: "After wallet approval, Stellar Testnet records an inspectable registry action and receipt.",
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
            <p className="eyebrow">
              PRIVATE BUG EVIDENCE. VERIFIABLE PUBLIC CLAIMS.
            </p>
            <h1 className="display display--hero hero__headline">
              Prove the security impact.
              <br />
              <em>Keep the exploit private.</em>
            </h1>
            <p className="lede hero__lede">
              ZeroSeal helps researchers present an approved impact claim
              without revealing the full exploit first. Sensitive evidence stays
              on their device while the public claim, wallet approval and
              confirmed Stellar receipt remain inspectable.
            </p>
            <HeroActions />
            <ul className="hero__trust" aria-label="ZeroSeal trust points">
              {TRUST_POINTS.map((point) => (
                <li key={point}>{point}</li>
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

        <section className="section section--cream story-section trust-gap" id="why-zeroseal">
          <div className="shell">
            <div className="trust-gap__layout">
              <header className="section__head">
                <p className="eyebrow">THE DISCLOSURE TRUST GAP</p>
                <h2 className="display display--lg">
                  Close the trust gap before the exploit moves.
                </h2>
                <p className="lede">
                  ZeroSeal gives researchers and programmes a shared proof
                  surface before private exploit detail leaves the reporter.
                </p>
              </header>
              <div className="trust-gap__matrix" aria-label="Disclosure trust gap comparison">
                <div className="trust-gap__matrix-head">
                  <span>Risk point</span>
                  <span>Traditional path</span>
                  <span>ZeroSeal path</span>
                </div>
                {TRUST_GAP_ROWS.map((row) => (
                  <article className="trust-gap__row" key={row.tension}>
                    <h3>{row.tension}</h3>
                    <p>{row.current}</p>
                    <p>{row.zeroseal}</p>
                  </article>
                ))}
              </div>
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
              <div className="story-grid story-grid--three">
                {SOLUTION_CARDS.map((card) => (
                  <article className="story-card story-card--solution" key={card.title}>
                    <span className="story-card__icon" aria-hidden="true" />
                    <h3>{card.title}</h3>
                    <p>{card.text}</p>
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

        <ResearcherRegistration />

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
          <nav className="footer__col" aria-label="Prototype status">
            <h2>Prototype status</h2>
            <ul>
              <li>
                <span>Research prototype running on Stellar Testnet.</span>
              </li>
              <li>
                <a href="#use-cases">Use cases</a>
              </li>
            </ul>
          </nav>
        </div>
        <div className="shell footer__bottom">
          <span>Research prototype running on Stellar Testnet.</span>
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
