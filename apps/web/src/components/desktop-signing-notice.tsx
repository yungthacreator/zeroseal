"use client";

import { useState } from "react";

const DISMISSED_KEY = "zeroseal:desktop-signing-notice-dismissed";

export function DesktopSigningNotice() {
  const [visible, setVisible] = useState(
    () =>
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(DISMISSED_KEY) !== "true",
  );
  const [details, setDetails] = useState(false);

  const dismiss = () => {
    window.sessionStorage.setItem(DISMISSED_KEY, "true");
    setVisible(false);
  };

  if (!visible) {
    return null;
  }

  return (
    <aside className="desktop-signing" aria-labelledby="desktop-signing-title">
      <div>
        <p className="desktop-signing__kicker">Desktop wallet required for signing</p>
        <h3 id="desktop-signing-title">Desktop wallet required for signing</h3>
        <p>
          You can explore the full ZeroSeal workflow on this device. Stellar
          transaction signing currently uses the Freighter browser extension on
          desktop.
        </p>
        {details ? (
          <p>
            Open ZeroSeal in Firefox or Chromium on desktop, unlock Freighter,
            switch to Stellar Testnet and return to the signing step.
          </p>
        ) : null}
      </div>

      <div className="desktop-signing__actions">
        <button type="button" onClick={dismiss}>
          Continue without wallet
        </button>
        <button type="button" onClick={() => setDetails((value) => !value)}>
          View desktop instructions
        </button>
        <a href="https://freighter.app/" target="_blank" rel="noreferrer">
          Official Freighter
        </a>
      </div>
    </aside>
  );
}
