"use client";

import { useEffect, useState } from "react";

const NOW = [
  "Noir Security Impact circuit",
  "UltraHonk proof generation",
  "Pedersen commitment binding",
  "Soroban verifier",
  "Claim Registry",
  "replay protection",
  "Stellar Testnet deployment",
  "wallet-signed registration",
] as const;

const NEXT = [
  "wallet-signed claim submission",
  "public receipt explorer",
  "paid proof verification",
  "mobile signing",
  "programme dashboards",
  "verification API",
] as const;

function useRoadmapIndex(length: number, offset: number, paused: boolean) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion || paused) {
      return;
    }

    let count = 0;
    const timer = window.setInterval(() => {
      count += 1;
      setIndex((current) => Math.min(current + 1, length - 1));

      if (count >= length - 1) {
        window.clearInterval(timer);
      }
    }, 1900 + offset);

    return () => window.clearInterval(timer);
  }, [length, offset, paused]);

  return index;
}

export function RoadmapColumns() {
  const [paused, setPaused] = useState(false);
  const nowIndex = useRoadmapIndex(NOW.length, 0, paused);
  const nextIndex = useRoadmapIndex(NEXT.length, 320, paused);

  return (
    <div
      className="roadmap-pro"
      id="roadmap"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <RoadmapList title="Now" items={NOW} activeIndex={nowIndex} />
      <RoadmapList title="Next" items={NEXT} activeIndex={nextIndex} />
    </div>
  );
}

function RoadmapList({
  title,
  items,
  activeIndex,
}: {
  title: string;
  items: ReadonlyArray<string>;
  activeIndex: number;
}) {
  return (
    <article className="roadmap-pro__column" tabIndex={0}>
      <p>{title}</p>
      <ul>
        {items.map((item, index) => (
          <li
            key={item}
            data-active={index === activeIndex}
            data-seen={index <= activeIndex}
          >
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}
