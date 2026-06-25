"use client";

import { useState } from "react";

const JOURNEY = [
  {
    title: "Connect",
    body: "Connect Freighter on Stellar Testnet.",
  },
  {
    title: "Choose the claim",
    body: "Select the programme, snapshot, impact policy and supported circuit.",
  },
  {
    title: "Prepare privately",
    body: "Keep exploit details, reproduction steps, sensitive code paths and witness values on the researcher device.",
  },
  {
    title: "Prove",
    body: "Generate or load the approved proof artifact and permitted public inputs.",
  },
  {
    title: "Authorise",
    body: "Review and sign the Stellar transaction in Freighter.",
  },
  {
    title: "Verify",
    body: "The proof is checked against the declared programme policy and public inputs.",
  },
  {
    title: "Record",
    body: "The confirmed Claim Registry transaction produces a replay-resistant receipt.",
  },
  {
    title: "Inspect",
    body: "Open the real transaction and related account or contracts in a Stellar Explorer.",
  },
] as const;

const THRESHOLD_FLOW = [
  "authenticated source",
  "committed private value",
  "threshold circuit",
  "public statement",
  "verifiable receipt",
] as const;

export function UseCaseEngine() {
  const [active, setActive] = useState(0);
  const step = JOURNEY[active];

  return (
    <div className="researcher-journey">
      <div className="researcher-journey__intro">
        <p className="eyebrow">Use cases</p>
        <h2 className="display display--lg">
          How a researcher uses ZeroSeal
        </h2>
        <p className="lede">
          The live path starts with a security-impact claim: private exploit
          evidence stays local while public inputs, commitments and wallet
          authorisation move through Stellar.
        </p>
      </div>

      <div
        className="researcher-journey__body"
        role="group"
        aria-label="Security research workflow"
      >
        <ol className="researcher-journey__index">
          {JOURNEY.map((item, index) => (
            <li key={item.title}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-current={index === active ? "step" : undefined}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {item.title}
              </button>
            </li>
          ))}
        </ol>

        <section className="researcher-journey__panel">
          <span>{String(active + 1).padStart(2, "0")}</span>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
          <div className="researcher-journey__controls">
            <button
              type="button"
              onClick={() =>
                setActive((current) =>
                  current === 0 ? JOURNEY.length - 1 : current - 1,
                )
              }
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() =>
                setActive((current) => (current + 1) % JOURNEY.length)
              }
            >
              Next
            </button>
          </div>
        </section>
      </div>

      <section className="threshold-scenario">
        <div>
          <p className="eyebrow">Illustrative threshold-proof scenario</p>
          <h3>What the same proof pattern can unlock</h3>
          <dl>
            <div>
              <dt>Public statement</dt>
              <dd>Profit exceeded $1M.</dd>
            </div>
            <div>
              <dt>Private source</dt>
              <dd>Exact $24.25M result and complete account history.</dd>
            </div>
            <div>
              <dt>Value</dt>
              <dd>
                A fund, market maker, exchange or treasury can prove a
                threshold without disclosing exact balances, strategy or full
                history.
              </dd>
            </div>
          </dl>
        </div>
        <ol aria-label="Illustrative threshold proof transformation">
          {THRESHOLD_FLOW.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
