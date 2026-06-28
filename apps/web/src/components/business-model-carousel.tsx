"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const SLIDES = [
  {
    title: "Verification credits",
    buyer: "Security programmes and sponsoring organisations",
    value: "Per-proof or prepaid access to ZeroSeal verification infrastructure.",
    stellar: "Optional Testnet payment experiments remain separate from claim truth.",
    availability: "Roadmap commercially; demo payment code is not production billing.",
  },
  {
    title: "Programme infrastructure",
    buyer: "Bug-bounty programmes, protocols and audit organisations",
    value:
      "Policy configuration, claim dashboards, verification records and receipt management.",
    stellar: "Claim Registry calls and public receipt state.",
    availability: "Partial: demo programme, policies and claim persistence are implemented.",
  },
  {
    title: "Custom proof systems",
    buyer: "Programmes with specific impact rules",
    value:
      "Purpose-built circuits and integrations for programme-specific impact rules.",
    stellar: "Dedicated verifier contracts and versioned public-input policy.",
    availability: "Roadmap unless a dedicated circuit is implemented and verified.",
  },
  {
    title: "Enterprise disclosure infrastructure",
    buyer: "Security teams and disclosure operators",
    value:
      "Private claim workflows, audit trails and controlled disclosure integration.",
    stellar: "Receipts can anchor confirmed disclosure events on Stellar Testnet.",
    availability: "Roadmap; not presented as a live enterprise product.",
  },
] as const;

export function BusinessModelCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStart = useRef<number | null>(null);

  const active = SLIDES[index];
  const label = useMemo(
    () => `${String(index + 1).padStart(2, "0")} / ${String(SLIDES.length).padStart(2, "0")}`,
    [index],
  );

  const go = (direction: 1 | -1) => {
    setIndex((current) => (current + direction + SLIDES.length) % SLIDES.length);
  };

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        go(1);
      }
    }, 6000);

    return () => window.clearInterval(timer);
  }, [paused, reducedMotion]);

  return (
    <section
      className="business-carousel"
      aria-roledescription="carousel"
      aria-label="ZeroSeal business model"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setPaused(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          go(1);
        }
        if (event.key === "ArrowLeft") {
          go(-1);
        }
      }}
      onTouchStart={(event) => {
        touchStart.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (touchStart.current === null) {
          return;
        }
        const end = event.changedTouches[0]?.clientX ?? touchStart.current;
        const delta = end - touchStart.current;
        touchStart.current = null;
        if (Math.abs(delta) > 40) {
          go(delta < 0 ? 1 : -1);
        }
      }}
      tabIndex={0}
    >
      <div className="business-carousel__index">{label}</div>
      <article className="business-carousel__slide" key={active.title}>
        <h3>{active.title}</h3>
        <dl>
          <div>
            <dt>Buyer</dt>
            <dd>{active.buyer}</dd>
          </div>
          <div>
            <dt>Value</dt>
            <dd>{active.value}</dd>
          </div>
          <div>
            <dt>Stellar activity</dt>
            <dd>{active.stellar}</dd>
          </div>
          <div>
            <dt>Availability</dt>
            <dd>{active.availability}</dd>
          </div>
        </dl>
      </article>
      <div className="business-carousel__controls">
        <button type="button" onClick={() => go(-1)} aria-label="Previous business model slide">
          Previous
        </button>
        <div className="business-carousel__progress" aria-hidden="true">
          {SLIDES.map((slide, slideIndex) => (
            <span key={slide.title} data-active={slideIndex === index} />
          ))}
        </div>
        <button type="button" onClick={() => go(1)} aria-label="Next business model slide">
          Next
        </button>
      </div>
    </section>
  );
}
