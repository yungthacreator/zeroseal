"use client";

import { useEffect, useMemo, useState } from "react";

const SCENES = [
  {
    title: "A vulnerability is discovered",
    caption: "Exploit code, reproduction steps and sensitive values remain private.",
    visual: "discovery",
  },
  {
    title: "The evidence stays on the device",
    caption: "ZeroSeal does not upload the complete exploit to present the claim.",
    visual: "privacy",
  },
  {
    title: "The approved proof package is loaded",
    caption: "The package supplies only the supported public claim structure.",
    visual: "package",
  },
  {
    title: "The fingerprint appears automatically",
    caption: "ZeroSeal reads it from the proof package. The researcher does not calculate or paste it.",
    visual: "fingerprint",
  },
  {
    title: "The researcher reviews the Testnet action",
    caption: "Freighter shows the exact Claim Registry transaction before approval.",
    visual: "wallet",
  },
  {
    title: "The confirmed action receives a receipt",
    caption: "The real transaction, ledger and receipt appear only after confirmation.",
    visual: "receipt",
  },
] as const;

function SceneArtwork({ visual }: { visual: (typeof SCENES)[number]["visual"] }) {
  return (
    <div className="demo-art" data-scene={visual}>
      <div className="demo-art__local">
        <span>Report</span>
        <span>Code file</span>
        <span>Lock</span>
      </div>
      <div className="demo-art__boundary">
        <span>Private device</span>
      </div>
      <div className="demo-art__zeroseal">ZeroSeal</div>
      <div className="demo-art__wallet">
        <strong>Freighter</strong>
        <span>Stellar Testnet</span>
        <span>Approval required</span>
      </div>
      <div className="demo-art__fingerprint">
        <span>Researcher fingerprint</span>
        <strong>04365013...448751d0</strong>
      </div>
      <div className="demo-art__receipt">
        <span>Transaction appears after confirmation</span>
        <span>Ledger appears after confirmation</span>
        <span>Receipt appears after confirmation</span>
      </div>
      <i className="demo-art__line demo-art__line--a" />
      <i className="demo-art__line demo-art__line--b" />
    </div>
  );
}

export function GuidedProofDemo() {
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const scene = SCENES[index];
  const progress = useMemo(() => ((index + 1) / SCENES.length) * 100, [index]);

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
      setIndex((current) => {
        const next = Math.min(current + 1, SCENES.length - 1);
        if (next === SCENES.length - 1) {
          setRunning(false);
        }
        return next;
      });
    }, 8500);

    return () => window.clearTimeout(timer);
  }, [index, reducedMotion, running]);

  const pauseAndSet = (nextIndex: number) => {
    setRunning(false);
    setIndex((nextIndex + SCENES.length) % SCENES.length);
  };

  return (
    <section className="section section--paper guided-demo" id="guided-demo">
      <div className="shell">
        <header className="section__head section__head--split">
          <div>
            <p className="eyebrow">VISUAL WALKTHROUGH</p>
            <h2 className="display display--lg">Watch the claim become public.</h2>
          </div>
          <p className="lede">
            A short interactive walkthrough shows what stays private, what is
            approved for public review, and when a receipt appears.
          </p>
        </header>

        <div
          className="guided-demo__frame"
          aria-roledescription="carousel"
          aria-label="Illustrative guided tour"
        >
          <div className="guided-demo__screen" data-running={running}>
            <SceneArtwork visual={scene.visual} />
          </div>

          <article className="guided-demo__content" key={scene.title}>
            <span className="guided-demo__type">Illustrative guided tour</span>
            <p className="guided-demo__progress" aria-live="polite">
              Scene {index + 1} of {SCENES.length}
            </p>
            <h3>{scene.title}</h3>
            <p>{scene.caption}</p>
            {index === SCENES.length - 1 ? (
              <div className="guided-demo__ready">
                <strong>Ready to try the real flow?</strong>
                <a className="btn btn--yellow" href="#proof-workspace">
                  Open live Testnet workspace
                </a>
              </div>
            ) : null}
          </article>

          <div className="guided-demo__timeline" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
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
          <a className="btn btn--outline" href="#proof-workspace">
            Open live workspace
          </a>
        </div>
      </div>
    </section>
  );
}
