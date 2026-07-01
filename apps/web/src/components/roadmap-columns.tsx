"use client";

import { useEffect, useRef, useState } from "react";

const ROADMAP_ITEMS = [
  {
    title: "Confidential Bounty Escrow",
    text: "Planned escrow rails for reserving and releasing security rewards after agreed verification and disclosure conditions are met.",
  },
  {
    title: "Confidential Reward Tokens",
    text: "Planned confidential-token settlement for bounty rewards where commercially sensitive amounts and payment conditions require stronger privacy.",
  },
  {
    title: "Programme API and SDK",
    text: "Planned tools for bug bounty programmes, audit teams, protocols and security platforms to issue, verify and manage ZeroSeal receipts inside their own workflows.",
  },
  {
    title: "Duplicate Claim Coordination",
    text: "Planned programme tooling for comparing authorised claim commitments and handling duplicate disputes without exposing private exploit evidence.",
  },
] as const;

export function RoadmapColumns() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) {
      return;
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion || typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setRevealed(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.28 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="roadmap-pro"
      ref={stageRef}
      data-revealed={revealed}
      aria-label="Planned ZeroSeal roadmap"
    >
      <span className="roadmap-pro__horizon" aria-hidden="true" />
      {ROADMAP_ITEMS.map((item, index) => (
        <article
          className="roadmap-pro__card"
          key={item.title}
          style={{ "--reveal-index": index } as React.CSSProperties}
        >
          <span className="roadmap-pro__badge">PLANNED</span>
          <span className="roadmap-pro__index" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3>{item.title}</h3>
          <p>{item.text}</p>
        </article>
      ))}
    </div>
  );
}
