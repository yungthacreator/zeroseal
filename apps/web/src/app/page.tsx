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
  "Private evidence",
  "Approved proof package",
  "Public claim",
  "Wallet approval",
  "Testnet receipt",
] as const;

const TRUST_POINTS = [
  "Evidence stays on your device",
  "Only approved public claim data is exposed",
  "Confirmed actions receive a Stellar Testnet receipt",
] as const;

const PAIN_POINTS = [
  {
    title: "Reveal too early",
    text: "A full exploit may be exposed before the researcher receives acknowledgement, protection or clear payout terms.",
  },
  {
    title: "Duplicate disputes",
    text: "A researcher may receive a duplicate decision without enough information to independently understand how the new report overlaps with an earlier private submission.",
  },
  {
    title: "Severity disputes",
    text: "The impact of a finding can become a negotiation before the underlying evidence has been handled safely.",
  },
  {
    title: "Programme risk",
    text: "Security teams must separate real, reproducible findings from incomplete or exaggerated reports without creating more exposure.",
  },
] as const;

const SOLUTION_CARDS = [
  {
    title: "Keep the evidence private",
    text: "Exploit code, exact values, reproduction steps and sensitive witness material remain on the researcher's device.",
  },
  {
    title: "Present only the approved claim",
    text: "The proof package exposes the programme, policy, threshold and other permitted public inputs without publishing the complete witness.",
  },
  {
    title: "Create a durable public record",
    text: "After wallet approval and Testnet confirmation, ZeroSeal displays an inspectable transaction and replay-resistant receipt.",
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
  { label: "Guided demo", href: "#guided-demo" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Live workspace", href: "#proof-workspace" },
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
              ZeroSeal helps security researchers present a permitted impact
              claim without revealing the full exploit first. Sensitive evidence
              stays on the researcher&apos;s device while the public claim,
              wallet approval and confirmed Stellar receipt remain
              independently inspectable.
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
                Live demo on Stellar Testnet
              </p>
            </div>
          </div>
        </section>

        <section className="section section--cream story-section" id="why-zeroseal">
          <div className="shell">
            <header className="section__head">
              <p className="eyebrow">THE DISCLOSURE TRUST GAP</p>
              <h2 className="display display--lg">
                Researchers should not have to reveal everything just to be
                believed.
              </h2>
              <p className="lede">
                Security disclosure often begins with an uncomfortable
                trade-off. A researcher may need to expose sensitive exploit
                details before scope, severity, priority or payment has been
                agreed. At the same time, a programme needs enough evidence to
                distinguish a serious finding from an incomplete or exaggerated
                claim.
              </p>
            </header>
            <div className="story-grid story-grid--four">
              {PAIN_POINTS.map((card) => (
                <article className="story-card" key={card.title}>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </article>
              ))}
            </div>
            <p className="story-closing">
              Both sides are asked to trust before either side has enough
              protection.
            </p>
          </div>
        </section>

        <section className="section section--paper story-section" id="zeroseal-layer">
          <div className="shell">
            <header className="section__head">
              <p className="eyebrow">THE ZEROSEAL LAYER</p>
              <h2 className="display display--lg">
                A safer middle step between discovery and disclosure.
              </h2>
              <p className="lede">
                ZeroSeal separates the private evidence from the public claim.
                The researcher keeps the exploit material locally, the
                programme defines what may be proven publicly, and Stellar
                records the confirmed registry action.
              </p>
            </header>
            <div className="story-grid story-grid--three">
              {SOLUTION_CARDS.map((card) => (
                <article className="story-card story-card--solution" key={card.title}>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </article>
              ))}
            </div>
            <p className="positioning-statement">
              ZeroSeal is not a bug bounty marketplace and it does not replace
              human triage. It is a verification layer that can sit between
              private evidence, programme review and settlement.
            </p>
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
          </div>
        </section>

        <GuidedProofDemo />

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
                ZeroSeal turns a sensitive security finding into a controlled
                public claim without publishing the complete exploit.
              </p>
            </header>
            <HowItWorksTerminal />
          </div>
        </section>

        <CredibilityMarquee />

        <ResearcherRegistration />

        <OnChainActivity />

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
                The lifecycle reflects genuine local wallet state, retained
                receipts and configured Testnet contracts.
              </p>
            </header>
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
                ZeroSeal can provide privacy-preserving claim checks, programme
                policy configuration and auditable public receipts as reusable
                infrastructure.
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
