"use client";

import { useEffect, useRef, useState } from "react";

const LINES = [
  "$ zeroseal status",
  "wallet.adapter               READY",
  "programme.registry           READY",
  "claim.persistence            READY",
  "proof.schema.validation      READY",
  "cryptographic.verification   PARTIAL",
  "soroban.verifier             READY",
  "claim.registry               READY",
  "transaction.reconciliation   READY",
  "explorer.receipts            READY",
  "mobile.desktop.continuation  READY",
  "xlm.verification.credits     PARTIAL",
] as const;

export function ProductStatusTerminal() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [started, setStarted] = useState(false);
  const [visible, setVisible] = useState(1);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion) {
      const timer = window.setTimeout(() => {
        setStarted(true);
        setVisible(LINES.length);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const node = ref.current;
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
    if (!started || visible >= LINES.length) {
      return;
    }

    const timer = window.setTimeout(
      () => setVisible((current) => Math.min(current + 1, LINES.length)),
      110,
    );

    return () => window.clearTimeout(timer);
  }, [started, visible]);

  return (
    <div className="status-terminal" ref={ref}>
      <pre aria-label="ZeroSeal product status">
        {LINES.slice(0, visible).map((line) => (
          <code
            key={line}
            data-state={
              line.startsWith("[ready]")
                ? "ready"
                : line.includes("READY")
                  ? "ready"
                  : line.includes("PARTIAL")
                  ? "pending"
                  : "command"
            }
          >
            {line}
          </code>
        ))}
      </pre>
    </div>
  );
}
