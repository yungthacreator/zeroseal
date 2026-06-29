"use client";

import { useEffect, useMemo, useState } from "react";

const SCENES = [
  {
    title: "Choose the reporting path",
    caption:
      "Start by choosing HackerOne, Immunefi, Code4rena, CodeHawks, Cantina, HackenProof, Sherlock or a direct project report.",
    active: ["device"],
  },
  {
    title: "Add private finding context",
    caption:
      "Enter the title, severity, category, summary and target while sensitive notes remain local.",
    active: ["device", "zeroseal"],
  },
  {
    title: "Generate the private seal",
    caption:
      "ZeroSeal prepares a commitment only after the researcher acts. No fingerprint is shown beforehand.",
    active: ["device", "zeroseal"],
  },
  {
    title: "Review the public claim",
    caption:
      "The public claim keeps only approved fields: programme context, policy, threshold, fingerprint and nullifier.",
    active: ["zeroseal"],
  },
  {
    title: "Approve the registry action",
    caption:
      "Freighter shows the exact Stellar Testnet action before anything is submitted.",
    active: ["zeroseal", "wallet"],
  },
  {
    title: "Verify the receipt",
    caption:
      "A receipt appears only after a real Testnet transaction hash and ledger are available.",
    active: ["wallet", "receipt"],
  },
] as const;

const CONTROL_ICONS = {
  play: ">",
  pause: "||",
  previous: "<",
  next: ">",
  restart: "R",
} as const;

function SceneArtwork({
  active,
}: {
  active: readonly string[];
}) {
  const isActive = (node: string) => active.includes(node);

  return (
    <div className="demo-art" aria-hidden="true">
      <div className="demo-art__node demo-art__node--device" data-active={isActive("device")}>
        <span>Private device</span>
        <strong>report · PoC · notes</strong>
      </div>
      <div className="demo-art__node demo-art__node--zeroseal" data-active={isActive("zeroseal")}>
        <span>ZeroSeal</span>
        <strong>private seal</strong>
      </div>
      <div className="demo-art__node demo-art__node--wallet" data-active={isActive("wallet")}>
        <span>Wallet</span>
        <strong>Testnet approval</strong>
      </div>
      <div className="demo-art__node demo-art__node--receipt" data-active={isActive("receipt")}>
        <span>Receipt</span>
        <strong>verified public record</strong>
      </div>
      <span className="demo-art__path demo-art__path--one" />
      <span className="demo-art__path demo-art__path--two" />
      <span className="demo-art__path demo-art__path--three" />
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
    }, 6800);

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
            <h2 className="display display--lg">From private evidence to public receipt.</h2>
          </div>
          <p className="lede">
            A compact walkthrough shows what the researcher does, when ZeroSeal
            generates a seal, and when Stellar becomes part of the record.
          </p>
        </header>

        <div
          className="guided-demo__frame"
          aria-roledescription="carousel"
          aria-label="ZeroSeal guided walkthrough"
        >
          <div className="guided-demo__screen" data-running={running}>
            <SceneArtwork active={scene.active} />
          </div>

          <article className="guided-demo__content" key={scene.title}>
            <span className="guided-demo__type">Guided product flow</span>
            <p className="guided-demo__progress" aria-live="polite">
              Step {index + 1} of {SCENES.length}
            </p>
            <h3>{scene.title}</h3>
            <p className="guided-demo__typewriter">{scene.caption}</p>
            {index === SCENES.length - 1 ? (
              <div className="guided-demo__ready">
                <strong>Ready to use the workspace?</strong>
                <a className="btn btn--yellow btn--sm" href="#proof-workspace">
                  Open workspace
                </a>
              </div>
            ) : null}
          </article>

          <div className="guided-demo__timeline" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="guided-demo__controls" aria-label="Guided tour controls">
          <button
            type="button"
            className="guided-demo__control-icon"
            aria-label="Play walkthrough"
            onClick={() => setRunning(true)}
          >
            <span aria-hidden="true">{CONTROL_ICONS.play}</span>
          </button>
          <button
            type="button"
            className="guided-demo__control-icon"
            aria-label="Pause walkthrough"
            onClick={() => setRunning(false)}
          >
            <span aria-hidden="true">{CONTROL_ICONS.pause}</span>
          </button>
          <button
            type="button"
            className="guided-demo__control-icon"
            aria-label="Previous walkthrough step"
            onClick={() => pauseAndSet(index - 1)}
          >
            <span aria-hidden="true">{CONTROL_ICONS.previous}</span>
          </button>
          <button
            type="button"
            className="guided-demo__control-icon"
            aria-label="Next walkthrough step"
            onClick={() => pauseAndSet(index + 1)}
          >
            <span aria-hidden="true">{CONTROL_ICONS.next}</span>
          </button>
          <button
            type="button"
            className="guided-demo__control-icon"
            aria-label="Restart walkthrough"
            onClick={() => {
              setRunning(false);
              setIndex(0);
            }}
          >
            <span aria-hidden="true">{CONTROL_ICONS.restart}</span>
          </button>
          <a className="btn btn--outline btn--sm" href="#proof-workspace">
            Workspace
          </a>
        </div>
      </div>
    </section>
  );
}
