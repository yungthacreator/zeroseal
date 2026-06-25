"use client";

import { useEffect, useRef, useState } from "react";

type CommandStep = {
  number: string;
  command: string;
  explanation: string;
};

const STEPS: ReadonlyArray<CommandStep> = [
  {
    number: "01",
    command: "choose_programme()",
    explanation:
      "The researcher selects the programme, immutable snapshot and public policy.",
  },
  {
    number: "02",
    command: "prepare_evidence_locally()",
    explanation:
      "Files remain on the researcher's device and are reduced to an evidence commitment.",
  },
  {
    number: "03",
    command: "generate_supported_proof()",
    explanation:
      "The supported circuit produces a proof over private values and permitted public inputs.",
  },
  {
    number: "04",
    command: "verify_claim()",
    explanation:
      "ZeroSeal validates the proof structure and keeps cryptographic and Soroban verification states distinct.",
  },
  {
    number: "05",
    command: "authorise_on_stellar()",
    explanation:
      "Freighter presents the Stellar transaction for user review and signature.",
  },
  {
    number: "06",
    command: "inspect_receipt()",
    explanation:
      "After confirmation, ZeroSeal provides the transaction hash, ledger and explorer-linked receipt.",
  },
];

export function HowItWorksTerminal() {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [started, setStarted] = useState(false);
  const [complete, setComplete] = useState(false);
  const [active, setActive] = useState(0);
  const [typed, setTyped] = useState<ReadonlyArray<string>>(
    STEPS.map(() => ""),
  );

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion) {
      const timer = window.setTimeout(() => {
        setTyped(STEPS.map((step) => step.command));
        setActive(STEPS.length - 1);
        setComplete(true);
        setStarted(true);
      }, 0);

      return () => window.clearTimeout(timer);
    }

    const node = sectionRef.current;

    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started || complete) {
      return;
    }

    let cancelled = false;
    let timer: number | null = null;

    const typeStep = (stepIndex: number, charIndex: number) => {
      if (cancelled) {
        return;
      }

      setActive(stepIndex);
      setTyped((current) =>
        current.map((value, index) =>
          index === stepIndex
            ? STEPS[stepIndex].command.slice(0, charIndex)
            : value,
        ),
      );

      if (charIndex <= STEPS[stepIndex].command.length) {
        timer = window.setTimeout(
          () => typeStep(stepIndex, charIndex + 1),
          24,
        );
        return;
      }

      if (stepIndex < STEPS.length - 1) {
        timer = window.setTimeout(() => typeStep(stepIndex + 1, 1), 180);
        return;
      }

      setComplete(true);
    };

    typeStep(0, 1);

    return () => {
      cancelled = true;

      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [complete, started]);

  const activeStep = STEPS[active];

  return (
    <div className="howto" ref={sectionRef}>
      <div className="proof-terminal" aria-label="ZeroSeal verification sequence">
        <div className="proof-terminal__bar">
          <span>zeroseal://proof-pipeline</span>
        </div>
        <ol className="proof-terminal__lines">
          {STEPS.map((step, index) => {
            const done =
              typed[index] === step.command && (complete || index < active);
            const isActive = index === active && !complete;

            return (
              <li
                key={step.number}
                data-active={isActive}
                data-complete={done || (complete && typed[index] === step.command)}
              >
                <span>{step.number}</span>
                <code>
                  {typed[index]}
                  {isActive ? <b aria-hidden="true" /> : null}
                </code>
              </li>
            );
          })}
        </ol>
      </div>

      <aside className="howto__note" aria-live="polite">
        <span>{activeStep.number}</span>
        <h3>{activeStep.command}</h3>
        <p>{activeStep.explanation}</p>
      </aside>
    </div>
  );
}
