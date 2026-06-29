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
          ZeroSeal can add a privacy-preserving verification and receipt layer
          to existing security research and disclosure workflows.
        </p>
        <ul
          className="credibility-marquee__viewport"
          aria-label="Security disclosure ecosystem examples"
        >
          {ECOSYSTEMS.map((item) => (
            <EcosystemLogo item={item} key={item.name} />
          ))}
        </ul>
      </div>
    </section>
  );
}
