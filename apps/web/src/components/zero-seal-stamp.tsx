"use client";

import React from "react";

type ZeroSealStampProps = {
  receiptId: string;
  ledgerNumber: number;
  network: string;
  transactionHash: string;
  compact?: boolean;
};

export function ZeroSealStamp({
  receiptId,
  ledgerNumber,
  network,
  transactionHash,
  compact = false,
}: ZeroSealStampProps) {
  const serial = receiptId.length > 16
    ? `${receiptId.slice(0, 8)}...${receiptId.slice(-6)}`
    : receiptId;
  const tx = `${transactionHash.slice(0, 8)}...${transactionHash.slice(-6)}`;

  return (
    <figure
      className="zeroseal-stamp"
      data-compact={compact}
      aria-label={`Official ZeroSeal stamp for receipt ${receiptId}, ledger ${ledgerNumber}`}
    >
      <svg viewBox="0 0 180 180" role="img" aria-hidden="true">
        <defs>
          <filter id="stamp-roughen">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="2"
              seed="17"
              result="noise"
            />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.9" />
          </filter>
          <path
            id="stamp-top"
            d="M 25 91 A 65 65 0 0 1 155 91"
          />
          <path
            id="stamp-bottom"
            d="M 155 91 A 65 65 0 0 1 25 91"
          />
        </defs>
        <g filter="url(#stamp-roughen)">
          <circle cx="90" cy="90" r="78" />
          <circle cx="90" cy="90" r="61" />
          <text className="zeroseal-stamp__ring">
            <textPath href="#stamp-top" startOffset="50%" textAnchor="middle">
              ZEROSEAL - VERIFIED CLAIM
            </textPath>
          </text>
          <text className="zeroseal-stamp__ring">
            <textPath href="#stamp-bottom" startOffset="50%" textAnchor="middle">
              {network} - STELLAR
            </textPath>
          </text>
          <text x="90" y="78" className="zeroseal-stamp__monogram">
            Z
          </text>
          <text x="90" y="106" className="zeroseal-stamp__main">
            STAMPED
          </text>
          <text x="90" y="126" className="zeroseal-stamp__ledger">
            LEDGER {ledgerNumber}
          </text>
          <text x="90" y="142" className="zeroseal-stamp__serial">
            {serial}
          </text>
        </g>
      </svg>
      <figcaption>
        <span>{serial}</span>
        <span>{tx}</span>
      </figcaption>
    </figure>
  );
}
