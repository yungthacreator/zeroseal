import { SiteHeader } from "@/components/site-header";
import { UseCaseSequence } from "@/components/use-case-sequence";
import { WalletPanel } from "@/components/wallet-panel";

const PIPELINE = [
  {
    number: "01",
    title: "Prepare the witness",
    body: "Sensitive evidence remains on the prover device.",
  },
  {
    number: "02",
    title: "Bind the claim",
    body: "Pedersen commitments bind the researcher, snapshot, rule, and threshold.",
  },
  {
    number: "03",
    title: "Generate the proof",
    body: "A Noir circuit produces an UltraHonk proof with seven public inputs.",
  },
  {
    number: "04",
    title: "Verify on Stellar",
    body: "Soroban verifies the proof and rejects altered claims.",
  },
  {
    number: "05",
    title: "Record the receipt",
    body: "The Claim Registry stores the accepted public claim.",
  },
  {
    number: "06",
    title: "Prevent replay",
    body: "A used nullifier cannot be accepted as a new claim.",
  },
] as const;

const PRIVATE_ITEMS = [
  "Exploit details",
  "Researcher secret",
  "Private values",
  "Complete witness",
] as const;

const PUBLIC_ITEMS = [
  "Programme and snapshot identifiers",
  "Impact rule and public threshold",
  "State and researcher commitments",
  "Nullifier and accepted receipt",
] as const;

const LIFECYCLE = [
  "Programme registered",
  "Researcher commitment registered",
  "Private proof accepted",
  "Public receipt recorded",
  "Duplicate nullifier rejected",
  "Original receipt preserved",
] as const;

const STELLAR_COMPONENTS = [
  {
    title: "Soroban",
    body: "Verifies the UltraHonk proof and executes the Claim Registry.",
  },
  {
    title: "Freighter",
    body: "Provides account access and network detection in the current frontend.",
  },
  {
    title: "Stellar ledger",
    body: "Stores accepted public receipts and replay-resistant nullifiers.",
  },
] as const;

const NOW = [
  "Noir Security Impact circuit",
  "UltraHonk proof generation",
  "Pedersen commitment binding",
  "Soroban verifier",
  "Claim Registry",
  "Replay protection",
] as const;

const NEXT = [
  "Stellar Testnet deployment",
  "Wallet-signed claim submission",
  "Public receipt explorer",
  "Confidential token policy proofs",
] as const;

export default function Home() {
  return (
    <div id="top">
      <SiteHeader />

      <main>
        <section className="hero panel panel--cream" id="product">
          <div className="hero__visual">
            <div className="hero__dots" aria-hidden="true" />
            <div className="shell hero__headline">
              <p className="eyebrow eyebrow--gold">
                Real-world zero-knowledge claims on Stellar
              </p>
              <h1 className="display display--xl">
                Prove what matters.
                <br />
                <em className="display-accent">Reveal nothing else.</em>
              </h1>
              <p className="hero__subhead">
                ZeroSeal enables a security researcher to prove that private
                vulnerability evidence satisfies a public impact threshold
                without disclosing exploit details or the complete witness.
                Soroban verifies the proof and the Claim Registry records a
                replay-resistant receipt.
              </p>
            </div>
          </div>

          <div className="shell hero__lower">
            <div className="application-rail">
              <div className="application-rail__label">
                <p>Applications</p>
                <span>Selective disclosure across sensitive claims</span>
              </div>

              <ol
                className="application-rail__items"
                aria-label="ZeroSeal applications"
              >
                <li>
                  <span>01</span>
                  <strong>Responsible disclosure</strong>
                  <small>Current proof</small>
                </li>
                <li>
                  <span>02</span>
                  <strong>Financial thresholds</strong>
                  <small>Future application</small>
                </li>
                <li>
                  <span>03</span>
                  <strong>Wallet control</strong>
                  <small>Future application</small>
                </li>
                <li>
                  <span>04</span>
                  <strong>Policy attestations</strong>
                  <small>Future application</small>
                </li>
              </ol>
            </div>

            <div className="hero__actions">
              <a className="btn btn--solid" href="#wallet">
                Connect Freighter
              </a>
              <a className="btn btn--outline" href="#how-it-works">
                See how it works
              </a>
            </div>
          </div>
        </section>

        <section className="panel panel--ink" id="how-it-works">
          <div className="shell">
            <header className="section-head section-head--split section-head--light">
              <div>
                <p className="eyebrow">How it works</p>
                <h2 className="display display--lg">
                  Private computation. <em className="display-accent">Public verification.</em>
                </h2>
              </div>
              <p className="section-head__sub">
                The witness stays local. Only the proof and claim-bound public
                inputs cross the verification boundary.
              </p>
            </header>

            <ol className="pipeline" aria-label="ZeroSeal proof pipeline">
              {PIPELINE.map((stage) => (
                <li key={stage.number}>
                  <span>{stage.number}</span>
                  <h3>{stage.title}</h3>
                  <p>{stage.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="panel panel--cream" id="privacy">
          <div className="shell privacy">
            <div className="privacy__head">
              <p className="eyebrow eyebrow--gold">Disclosure boundary</p>
              <h2 className="display display--lg">
                What stays private. <em className="display-accent">What becomes verifiable.</em>
              </h2>
            </div>

            <div className="privacy__grid">
              <article>
                <h3>Private</h3>
                <ul>
                  {PRIVATE_ITEMS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className="privacy__public">
                <h3>Verifiable</h3>
                <ul>
                  {PUBLIC_ITEMS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </div>

            <div className="proof-lifecycle">
              <div className="proof-lifecycle__head">
                <div>
                  <p className="eyebrow eyebrow--gold">Proof lifecycle</p>
                  <h3>Accepted once. Replayed never.</h3>
                </div>
                <p>
                  The protocol records the accepted claim, rejects a reused
                  nullifier, and preserves the original receipt.
                </p>
              </div>

              <ol>
                {LIFECYCLE.map((item, index) => (
                  <li key={item}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{item}</strong>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <UseCaseSequence />

        <WalletPanel />

        <section className="panel panel--yellow" id="stellar">
          <div className="shell stellar">
            <div className="stellar__intro">
              <div>
                <p className="eyebrow">Proudly built on Stellar</p>
                <h2 className="display display--lg">
                  The public verification and receipt layer
                </h2>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="stellar__wordmark"
                src="/stellar-wordmark.svg"
                alt="Stellar"
              />
            </div>

            <div className="stellar__components">
              {STELLAR_COMPONENTS.map((component) => (
                <article key={component.title}>
                  <h3>{component.title}</h3>
                  <p>{component.body}</p>
                </article>
              ))}
            </div>

            <div className="roadmap" id="roadmap">
              <article>
                <p className="roadmap__label">Now</p>
                <ul>
                  {NOW.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
              <article>
                <p className="roadmap__label">Next</p>
                <ul>
                  {NEXT.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </div>

            <p className="stellar__disclaimer">
              ZeroSeal is independently built for the Stellar ecosystem. This
              does not imply endorsement, partnership, funding, or official
              affiliation with the Stellar Development Foundation.
            </p>
          </div>
        </section>

        <section className="panel panel--ink final-cta">
          <div className="shell final-cta__inner">
            <div>
              <p className="eyebrow">ZeroSeal</p>
              <h2 className="display display--lg">
                Prove the claim. <em className="display-accent">Keep the evidence private.</em>
              </h2>
            </div>
            <a className="btn btn--yellow" href="#wallet">
              Connect Freighter
            </a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell site-footer__inner">
          <strong>ZeroSeal</strong>
          <span>Privacy-preserving claims on Stellar.</span>
          <span>Proudly built on Stellar.</span>
        </div>
      </footer>
    </div>
  );
}
