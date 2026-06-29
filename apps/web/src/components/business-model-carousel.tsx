"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const SLIDES = [
  {
    title: "Verification credits",
    text: "Pay per claim check or purchase prepaid capacity.",
  },
  {
    title: "Programme workspace",
    text: "Policy configuration, claim tracking and receipt management.",
  },
  {
    title: "Custom proof systems",
    text: "Programme-specific circuits and integrations.",
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
        <p>{active.text}</p>
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
      <p className="business-note">
        Future work: settlement integrations can respond to confirmed proof and
        receipt states.
      </p>
    </section>
  );
}
