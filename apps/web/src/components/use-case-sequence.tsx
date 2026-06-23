"use client";

import { useEffect, useState } from "react";

type UseCase = {
  id: string;
  number: string;
  title: string;
  phase: string;
  headline: string;
  body: string;
  publicClaim: string;
  privateSource: string;
  path: string;
};

const USE_CASES: ReadonlyArray<UseCase> = [
  {
    id: "responsible-disclosure",
    number: "01",
    title: "Responsible disclosure",
    phase: "Current proof",
    headline: "Prove impact without publishing the exploit",
    body: "A security researcher proves that private vulnerability evidence satisfies a programme-defined impact threshold without exposing exploit steps, private values, or the complete witness.",
    publicClaim: "Impact threshold satisfied",
    privateSource: "Exploit steps, values, and complete evidence",
    path: "Private evidence → impact rule → public receipt",
  },
  {
    id: "financial-threshold",
    number: "02",
    title: "Financial thresholds",
    phase: "Future application",
    headline:
      "Prove profit exceeded $1M while the exact $24.25M value stays private",
    body: "An authenticated or committed financial record can prove that a public threshold was exceeded without disclosing the exact amount or the complete underlying history.",
    publicClaim: "Profit exceeded $1M",
    privateSource: "$24.25M exact value and complete account history",
    path: "Authenticated value → threshold rule → bounded disclosure",
  },
  {
    id: "wallet-control",
    number: "03",
    title: "Wallet control",
    phase: "Future application",
    headline: "Prove control without revealing the complete wallet set",
    body: "Private signatures can demonstrate control of committed addresses while revealing only the claim required by the verifier.",
    publicClaim: "Required wallet control confirmed",
    privateSource: "Complete address set and private signing context",
    path: "Private signatures → control rule → public claim",
  },
  {
    id: "policy-attestation",
    number: "04",
    title: "Policy attestations",
    phase: "Future application",
    headline: "Prove a private record satisfies a public policy",
    body: "An authenticated record can satisfy an eligibility, compliance, or risk condition while minimising exposure of personal and commercial information.",
    publicClaim: "Policy condition satisfied",
    privateSource: "Complete personal or commercial record",
    path: "Authenticated record → policy rule → verifiable outcome",
  },
];

export function UseCaseSequence() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;

    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % USE_CASES.length);
    }, 9000);

    return () => window.clearInterval(timer);
  }, [paused, reducedMotion]);

  const current = USE_CASES[active];

  return (
    <section className="usecases panel panel--cream" id="use-cases">
      <div className="shell">
        <header className="section-head section-head--split">
          <div>
            <p className="eyebrow eyebrow--gold">Use cases</p>
            <h2 className="display display--lg">
              Selective disclosure for real-world claims
            </h2>
          </div>
          <p className="section-head__sub">
            ZeroSeal proves only the statement a verifier needs. The supporting
            evidence and exact values remain private.
          </p>
        </header>

        <div
          className="case-showcase"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          <nav className="case-showcase__tabs" aria-label="Use cases">
            {USE_CASES.map((useCase, index) => (
              <button
                type="button"
                key={useCase.id}
                className="case-showcase__tab"
                data-active={index === active}
                onClick={() => setActive(index)}
                aria-current={index === active ? "true" : undefined}
              >
                <span>{useCase.number}</span>
                <strong>{useCase.title}</strong>
                <small>{useCase.phase}</small>
              </button>
            ))}
          </nav>

          <article
            className="case-showcase__body"
            key={current.id}
            aria-labelledby={`${current.id}-heading`}
          >
            <div className="case-showcase__copy">
              <p className="case-showcase__phase">{current.phase}</p>
              <h3 id={`${current.id}-heading`}>{current.headline}</h3>
              <p>{current.body}</p>
              <div className="case-showcase__path">{current.path}</div>
            </div>

            <div className="case-showcase__proof" aria-label="Disclosure result">
              <div className="case-showcase__proof-head">
                <span>Disclosure boundary</span>
                <span>
                  {String(active + 1).padStart(2, "0")} /{" "}
                  {String(USE_CASES.length).padStart(2, "0")}
                </span>
              </div>

              <div className="case-showcase__proof-row">
                <span>Public statement</span>
                <strong>{current.publicClaim}</strong>
              </div>

              <div className="case-showcase__proof-row">
                <span>Private source</span>
                <strong>{current.privateSource}</strong>
              </div>

              <div className="case-showcase__controls">
                <button
                  type="button"
                  onClick={() =>
                    setActive(
                      (currentIndex) =>
                        (currentIndex - 1 + USE_CASES.length) %
                        USE_CASES.length,
                    )
                  }
                  aria-label="Previous use case"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActive(
                      (currentIndex) =>
                        (currentIndex + 1) % USE_CASES.length,
                    )
                  }
                  aria-label="Next use case"
                >
                  Next
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
