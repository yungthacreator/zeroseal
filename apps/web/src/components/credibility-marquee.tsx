"use client";

import Image from "next/image";

const ECOSYSTEMS = [
  {
    name: "HackerOne",
    logo: "/brands/hackerone.svg",
  },
  {
    name: "Immunefi",
    logo: "/brands/immunefi.svg",
  },
  {
    name: "Code4rena",
    logo: "/brands/code4rena.svg",
  },
  {
    name: "CodeHawks",
    logo: "/brands/codehawks.svg",
  },
  {
    name: "Cantina",
    logo: "/brands/cantina.svg",
  },
] as const;

function EcosystemLogo({ item }: { item: (typeof ECOSYSTEMS)[number] }) {
  return (
    <li className="credibility-marquee__logo-wrap">
      <Image
        className="credibility-marquee__logo"
        src={item.logo}
        alt={item.name}
        width={180}
        height={48}
        loading="lazy"
        unoptimized
      />
    </li>
  );
}

function MarqueeTrack({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul
      className="credibility-marquee__track"
      aria-hidden={hidden ? "true" : undefined}
      aria-label={hidden ? undefined : "Security disclosure ecosystem examples"}
    >
      {ECOSYSTEMS.map((item) => (
        <EcosystemLogo item={item} key={item.name} />
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
          Fits the disclosure paths researchers already use.
        </h3>
        <p className="credibility-marquee__lede">
          ZeroSeal adds a private verification and receipt layer before the
          complete report is disclosed.
        </p>
        <div className="credibility-marquee__viewport">
          <div className="credibility-marquee__motion">
            <MarqueeTrack />
            <MarqueeTrack hidden />
          </div>
        </div>
      </div>
    </section>
  );
}
