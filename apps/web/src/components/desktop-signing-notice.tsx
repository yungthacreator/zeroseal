"use client";

import { useMemo, useState } from "react";

export function DesktopSigningNotice() {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const desktopUrl =
    typeof window === "undefined" ? "" : window.location.href;
  const qrUrl = useMemo(() => {
    if (!desktopUrl) {
      return "";
    }

    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=12&data=${encodeURIComponent(
      desktopUrl,
    )}`;
  }, [desktopUrl]);

  const copyDesktopLink = async () => {
    if (!navigator.clipboard || !desktopUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(desktopUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // The URL remains visible in browser chrome if clipboard access is denied.
    }
  };

  return (
    <aside className="desktop-signing" aria-labelledby="desktop-signing-title">
      <div>
        <p className="desktop-signing__kicker">Wallet extension required</p>
        <h3 id="desktop-signing-title">Desktop signing required</h3>
        <p>
          You can explore ZeroSeal on mobile. To sign a Testnet proof, open
          this page in a desktop browser with the Freighter extension installed.
        </p>
      </div>

      <div className="desktop-signing__actions">
        <button type="button" onClick={() => void copyDesktopLink()}>
          {copied ? "Copied" : "Copy desktop link"}
        </button>
        <button type="button" onClick={() => setVisible((value) => !value)}>
          {visible ? "Hide QR code" : "Show QR code"}
        </button>
        <a href="https://freighter.app/" target="_blank" rel="noreferrer">
          Get the official wallet
        </a>
      </div>

      {visible && qrUrl ? (
        <div className="desktop-signing__qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="QR code for this ZeroSeal page" />
        </div>
      ) : null}
    </aside>
  );
}
