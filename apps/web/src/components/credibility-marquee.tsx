"use client";

import Image from "next/image";
import { useState } from "react";

const ECOSYSTEMS = [
  {
    name: "Immunefi",
    logo: "/brands/immunefi.svg",
  },
  {
    name: "Sherlock",
    logo: null,
  },
  {
    name: "Code4rena",
    logo: "/brands/code4rena.svg",
  },
  {
    name: "Cantina",
    logo: "/brands/cantina.svg",
  },
  {
    name: "Hats Finance",
    logo: null,
  },
  {
    name: "CodeHawks",
    logo: null,
  },
] as const;

function EcosystemLogo({ item }: { item: (typeof ECOSYSTEMS)[number] }) {
  const [failed, setFailed] = useState(false);

  if (!item.logo || failed) {
    return <span className="credibility-marquee__wordmark">{item.name}</span>;
  }

  return (
    <span className="credibility-marquee__logo-wrap">
      <Image
        className="credibility-marquee__logo"
        src={item.logo}
        alt={item.name}
        width={180}
        height={48}
        loading="lazy"
        unoptimized
        onError={() => setFailed(true)}
      />
      <span className="credibility-marquee__fallback" aria-hidden="true">
        {item.name}
      </span>
    </span>
  );
}

function MarqueeTrack({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul className="credibility-marquee__track" aria-hidden={hidden}>
      {ECOSYSTEMS.map((item) => (
        <li key={item.name}>
          <EcosystemLogo item={item} />
        </li>
      ))}
    </ul>
  );
}

export function CredibilityMarquee() {
  return (
    <section
      className="credibility-marquee"
      aria-labelledby="credibility-marquee-title"
    >
      <div className="shell">
        <h2 className="eyebrow" id="credibility-marquee-title">
          DESIGNED FOR MODERN SECURITY DISCLOSURE
        </h2>
        <p className="credibility-marquee__lede">
          ZeroSeal is designed to complement the workflows used by security
          researchers, audit firms and vulnerability reward programmes.
        </p>
        <p className="credibility-marquee__label">
          Designed to complement workflows across security research ecosystems
          such as
        </p>
        <div
          className="credibility-marquee__viewport"
          aria-label="Security disclosure ecosystem examples"
        >
          <div className="credibility-marquee__motion">
            <MarqueeTrack />
            <MarqueeTrack hidden />
          </div>
        </div>
      </div>
    </section>
  );
}
