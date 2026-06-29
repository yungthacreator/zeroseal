"use client";

import Image from "next/image";

const ECOSYSTEMS = [
  {
    name: "Immunefi",
    logo: "/brands/immunefi.svg",
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
    name: "CodeHawks",
    logo: "/brands/codehawks.svg",
  },
] as const;

function EcosystemLogo({ item }: { item: (typeof ECOSYSTEMS)[number] }) {
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
      />
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
          SECURITY DISCLOSURE ECOSYSTEM
        </h2>
        <h3 className="display display--md">
          Designed for the workflows researchers already use.
        </h3>
        <p className="credibility-marquee__lede">
          ZeroSeal can complement existing research, audit and vulnerability
          disclosure processes by adding a privacy-preserving verification and
          receipt layer.
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
