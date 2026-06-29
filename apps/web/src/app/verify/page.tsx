"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { shortenAddress } from "@/lib/presentation";
import { isLikelyTransactionHash } from "@/lib/stellar/testnet";

function extractIdentifier(input: string): string {
  const value = input.trim();
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? value;
  } catch {
    return value;
  }
}

export default function VerifyPage() {
  const [query, setQuery] = useState("");
  const identifier = useMemo(() => extractIdentifier(query), [query]);
  const isTransaction = isLikelyTransactionHash(identifier);
  const canVerify = Boolean(identifier);

  return (
    <div className="receipt-page verify-page">
      <main className="receipt-page__main">
        <Link className="receipt-page__back" href="/">
          &larr; ZeroSeal
        </Link>
        <section className="receipt-page__card">
          <div className="receipt-page__head">
            <p>VERIFY PUBLIC RECEIPT</p>
            <h1>Check a ZeroSeal receipt.</h1>
          </div>
          <p className="lede">
            Enter a ZeroSeal claim identifier, transaction hash or receipt URL.
            Private evidence is never shown here.
          </p>
          <label className="verify-page__field">
            <span>Receipt, claim identifier or transaction hash</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Paste receipt URL or transaction hash"
            />
          </label>

          <div className="verify-page__result">
            <span>Detected input</span>
            <strong>{identifier ? shortenAddress(identifier) : "Waiting"}</strong>
            <p>
              {isTransaction
                ? "This looks like a Stellar Testnet transaction hash. ZeroSeal can query the public receipt page."
                : identifier
                  ? "This looks like a claim identifier or receipt slug. Use the receipt page if it resolves to a stored public record."
                  : "No lookup has been requested."}
            </p>
          </div>

          <div className="receipt-page__actions">
            <Link
              className="btn btn--primary btn--sm"
              href={canVerify ? `/receipt/${encodeURIComponent(identifier)}` : "#"}
              aria-disabled={!canVerify}
            >
              Verify receipt
            </Link>
            <Link className="btn btn--outline btn--sm" href="/create">
              Create a private claim
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
