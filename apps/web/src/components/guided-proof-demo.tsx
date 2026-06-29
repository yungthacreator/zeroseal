"use client";

import { useEffect, useMemo, useState } from "react";

const TOUR_STEPS = [
  {
    title: "A researcher discovers a serious vulnerability",
    text: "The researcher has exploit code, reproduction steps and private values that should not be exposed before the report is handled safely.",
    visual: "Private finding discovered",
  },
  {
    title: "The sensitive evidence stays local",
    text: "The exploit, exact values and complete witness remain on the researcher's device. ZeroSeal does not need to upload the private files to explain the public claim.",
    visual: "Nothing private uploaded",
  },
  {
    title: "An approved proof package is loaded",
    text: "The proof package contains the supported claim structure and the public inputs permitted by the selected programme policy.",
    visual: "Approved artifact loaded",
  },
  {
    title: "ZeroSeal reads the researcher fingerprint",
    text: "The fingerprint is a fixed cryptographic value linked to the approved proof package. It helps identify changes without revealing the private witness. The researcher does not calculate or paste it manually.",
    visual: "Fingerprint created automatically",
  },
  {
    title: "The public claim is checked",
    text: "The current demo checks the proof artifact structure and the permitted claim inputs. Cryptographic verification must only be shown as complete when the configured verifier confirms it.",
    visual: "Claim checks completed",
  },
  {
    title: "The researcher reviews the Testnet action",
    text: "Freighter displays the exact Claim Registry transaction. Nothing is sent until the researcher reviews and approves it.",
    visual: "Wallet approval required",
  },
  {
    title: "A confirmed action receives a receipt",
    text: "After a real Stellar Testnet confirmation, ZeroSeal can display the transaction hash, ledger, account, contracts and public receipt. A real value appears only after actual confirmation.",
    visual: "Public receipt available after confirmation",
  },
] as const;

export function GuidedProofDemo() {
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const step = TOUR_STEPS[index];
  const progress = useMemo(
    () => `Step ${index + 1} of ${TOUR_STEPS.length}`,
    [index],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!running || reducedMotion) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % TOUR_STEPS.length);
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [index, reducedMotion, running]);

  const pauseAndSet = (nextIndex: number) => {
    setRunning(false);
    setIndex((nextIndex + TOUR_STEPS.length) % TOUR_STEPS.length);
  };

  return (
    <section className="section section--paper guided-demo" id="guided-demo">
      <div className="shell">
        <header className="section__head section__head--split">
          <div>
            <p className="eyebrow">GUIDED PRODUCT TOUR</p>
            <h2 className="display display--lg">
              See the full journey before using the live workspace.
            </h2>
          </div>
          <p className="lede">
            Follow an illustrative security claim from private evidence to a
            public Testnet receipt. This tour explains the product without
            submitting a transaction or opening a wallet.
          </p>
        </header>

        <div
          className="guided-demo__frame"
          aria-roledescription="carousel"
          aria-label="Illustrative guided tour"
        >
          <div className="guided-demo__visual" aria-hidden="true">
            <span>{step.visual}</span>
            <div className="guided-demo__signal">
              {TOUR_STEPS.map((item, stepIndex) => (
                <i
                  key={item.title}
                  data-active={stepIndex === index}
                  data-complete={stepIndex < index}
                />
              ))}
            </div>
          </div>

          <article className="guided-demo__content">
            <span className="guided-demo__type">Illustrative guided tour</span>
            <p className="guided-demo__progress" aria-live="polite">
              {progress}
            </p>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
            {index === TOUR_STEPS.length - 1 ? (
              <div className="guided-demo__ready">
                <strong>Ready to try the real flow?</strong>
                <a className="btn btn--primary" href="#proof-workspace">
                  Open the live Testnet workspace
                </a>
              </div>
            ) : null}
          </article>
        </div>

        <div className="guided-demo__controls" aria-label="Guided tour controls">
          <button type="button" onClick={() => setRunning(true)}>
            Start
          </button>
          <button type="button" onClick={() => setRunning(false)}>
            Pause
          </button>
          <button type="button" onClick={() => pauseAndSet(index - 1)}>
            Previous
          </button>
          <button type="button" onClick={() => pauseAndSet(index + 1)}>
            Next
          </button>
          <button
            type="button"
            onClick={() => {
              setRunning(false);
              setIndex(0);
            }}
          >
            Restart
          </button>
        </div>
      </div>
    </section>
  );
}
