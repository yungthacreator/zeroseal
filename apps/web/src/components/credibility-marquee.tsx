"use client";

import Image from "next/image";

type Platform = { name: string; logo?: string };

// Brief: logos and platform names only — no descriptions, no cards.
const PLATFORMS: Platform[] = [
  { name: "HackerOne", logo: "/brands/hackerone.svg" },
  { name: "Bugcrowd" },
  { name: "Intigriti" },
  { name: "YesWeHack" },
  { name: "Immunefi", logo: "/brands/immunefi.svg" },
  { name: "HackenProof" },
  { name: "Code4rena", logo: "/brands/code4rena.svg" },
  { name: "CodeHawks", logo: "/brands/codehawks.svg" },
  { name: "Cantina", logo: "/brands/cantina.svg" },
  { name: "Sherlock" },
  { name: "Hats Finance" },
  { name: "Direct to project" },
];

function PlatformItem({ item }: { item: Platform }) {
  return (
    <li className="zs-marquee__item">
      {item.logo ? (
        <Image
          className="zs-marquee__logo"
          src={item.logo}
          alt={item.name}
          width={150}
          height={36}
          loading="lazy"
          unoptimized
        />
      ) : (
        <span className="zs-marquee__word">{item.name}</span>
      )}
    </li>
  );
}

function Track({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul
      className="zs-marquee__track"
      aria-hidden={hidden ? "true" : undefined}
      aria-label={hidden ? undefined : "Security disclosure platforms"}
    >
      {PLATFORMS.map((item) => (
        <PlatformItem item={item} key={item.name} />
      ))}
    </ul>
  );
}

export function CredibilityMarquee() {
  return (
    <section className="zs-marquee" aria-labelledby="zs-marquee-title">
      <div className="shell">
        <h2 className="eyebrow" id="zs-marquee-title">
          SECURITY DISCLOSURE ECOSYSTEM
        </h2>
        <h3 className="display display--md zs-marquee__heading">
          Fits the disclosure paths researchers already use.
        </h3>
        <p className="zs-marquee__lede">
          ZeroSeal adds a private verification and receipt layer before the
          complete report is disclosed.
        </p>
      </div>
      <div className="zs-marquee__viewport">
        <div className="zs-marquee__motion">
          <Track />
          <Track hidden />
        </div>
      </div>
    </section>
  );
}
