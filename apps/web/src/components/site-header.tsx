"use client";

import { useState } from "react";
import { WalletAction } from "@/components/wallet-action";

const NAV_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "#why-zeroseal", label: "Why ZeroSeal" },
  { href: "#guided-demo", label: "Guided demo" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#proof-workspace", label: "Live workspace" },
  { href: "#network-activity", label: "Network activity" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="site-header__inner shell">
        <a className="brand" href="#top" aria-label="ZeroSeal home">
          <span className="brand__mark" aria-hidden="true">
            <SealMark />
          </span>
          <span>ZeroSeal</span>
        </a>

        <nav className="site-nav" aria-label="Primary">
          <ul>
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-header__actions">
          <WalletAction />
          <button
            type="button"
            className="site-header__toggle"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="visually-hidden">
              {open ? "Close menu" : "Open menu"}
            </span>
            <span className="site-header__bars" aria-hidden="true" />
          </button>
        </div>
      </div>

      <nav
        id="mobile-nav"
        className="mobile-nav"
        data-open={open}
        aria-label="Primary mobile"
        hidden={!open}
      >
        <ul>
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

function SealMark() {
  return (
    <svg viewBox="0 0 64 64" fill="none" focusable="false" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M35.44 11.66 L47.48 17.45" />
        <path d="M49.62 20.14 L53.03 35.04" />
        <path d="M52.26 38.39 L42.74 50.33" />
        <path d="M39.64 51.82 L24.36 51.82" />
        <path d="M21.26 50.33 L11.74 38.39" />
        <path d="M10.98 35.04 L14.38 20.14" />
        <path d="M16.52 17.45 L28.56 11.66" />
      </g>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M18.8 32 a13.2 13.2 0 1 0 26.4 0 a13.2 13.2 0 1 0 -26.4 0 Z M25.4 26.2 L38.6 26.2 L38.6 29.3 L29.36 34.7 L38.6 34.7 L38.6 37.8 L25.4 37.8 L25.4 34.7 L34.64 29.3 L25.4 29.3 Z"
      />
    </svg>
  );
}
