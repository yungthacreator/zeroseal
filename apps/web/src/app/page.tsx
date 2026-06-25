import { BusinessModelCarousel } from "@/components/business-model-carousel";
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
  "Noir circuit",
  "UltraHonk proof",
  "Soroban verifier",
  "Claim Registry",
  "Replay-protected receipt",
] as const;

const PRIVATE_ITEMS = [
  "exploit details",
  "reproduction steps",
  "sensitive code paths",
  "researcher secret",
  "private values",
  "complete witness",
] as const;

const VERIFIABLE_ITEMS = [
  "programme identifier",
  "snapshot identifier",
  "impact rule",
  "public threshold",
  "researcher commitment",
  "nullifier",
  "accepted receipt",
  "transaction hash",
] as const;

const FOOTER_PRODUCT_LINKS = [
  { label: "Use cases", href: "#use-cases" },
  { label: "Proof workspace", href: "#proof-workspace" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Network activity", href: "#network-activity" },
] as const;

const FOOTER_DEVELOPER_LINKS = [
  { label: "Registry contract", href: explorerContractUrl(registryContractId) },
  { label: "Verifier contract", href: explorerContractUrl(verifierContractId) },
  { label: "Official Freighter", href: "https://freighter.app/" },
] as const;

export default function Home() {
  return (
    <div id="top">
      <SiteHeader />

      <main>
        <section className="hero" id="hero">
          <div className="shell hero__inner">
            <p className="eyebrow">
              Real-world zero-knowledge claims on Stellar
            </p>
            <h1 className="display display--hero hero__headline">
              Prove what matters.
              <br />
              <em>Reveal nothing else.</em>
            </h1>
            <p className="lede hero__lede">
              ZeroSeal lets security researchers prove that private
              vulnerability evidence satisfies a public impact rule. The
              witness remains on the researcher&apos;s device while Soroban
              verifies the proof and Stellar records the result.
            </p>
            <HeroActions />
            <div className="tech-pipeline" aria-label="Technical pipeline">
              <ol>
                {TECH_PIPELINE.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
              <p>
                <span aria-hidden="true" />
                Running on Stellar Testnet
              </p>
            </div>
          </div>
        </section>

        <section className="section section--dotted" id="how-it-works">
          <div className="shell">
            <header className="section__head section__head--split">
              <div>
                <p className="eyebrow">How it works</p>
                <h2 className="display display--lg">
                  Private witness. Public verification.
                </h2>
              </div>
              <p className="lede">
                ZeroSeal separates local witness material from the public
                inputs and receipts required to verify a security-impact claim.
              </p>
            </header>

            <div className="how-disclosure">
              <HowItWorksTerminal />
              <div className="compare compare--compact">
                <section className="compare__col compare__col--private">
                  <h3>REMAINS PRIVATE</h3>
                  <ul>
                    {PRIVATE_ITEMS.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
                <section className="compare__col compare__col--verifiable">
                  <h3>PUBLICLY VERIFIABLE</h3>
                  <ul>
                    {VERIFIABLE_ITEMS.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>
          </div>
        </section>

        <section className="section section--cream" id="use-cases">
          <div className="shell">
            <UseCaseEngine />
          </div>
        </section>

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

        <section className="section section--paper" id="business">
          <div className="shell">
            <header className="section__head">
              <p className="eyebrow">Business model</p>
              <h2 className="display display--lg">
                Verification infrastructure for security programmes
              </h2>
              <p className="lede">
                ZeroSeal can turn privacy-preserving claim verification into
                reusable infrastructure for security programmes, protocols and
                institutions.
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
            <strong>ZEROSEAL</strong>
            <p>Privacy-preserving security claims on Stellar.</p>
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
          <nav className="footer__col" aria-label="Security">
            <h2>Security</h2>
            <ul>
              <li>
                <a href="#how-it-works">Architecture</a>
              </li>
              <li>
                <span>Independent project notice</span>
              </li>
            </ul>
          </nav>
        </div>
        <div className="shell footer__bottom">
          <span>Built independently for Stellar Testnet.</span>
          <span>© 2026 ZeroSeal</span>
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
