const STEPS = [
  {
    title: "Prepare privately",
    text: "The researcher keeps the report, exploit code, reproduction steps and private values on their own device.",
  },
  {
    title: "Load the approved proof",
    text: "ZeroSeal loads the supported proof artifact and reads the public claim data allowed by the programme.",
  },
  {
    title: "Create the claim record",
    text: "The backend creates a policy-linked claim and tracks its verification lifecycle without storing the private exploit files.",
  },
  {
    title: "Approve the Testnet action",
    text: "The researcher reviews and signs the exact Claim Registry transaction through Freighter.",
  },
  {
    title: "Inspect the receipt",
    text: "A confirmed transaction exposes the public result, ledger, registry contract and receipt through ZeroSeal and a Stellar explorer.",
  },
] as const;

const TECHNICAL_TERMS = [
  "Noir circuit",
  "UltraHonk proof artifact",
  "public inputs",
  "nullifier",
  "researcher commitment",
  "registry contract",
  "verifier status",
  "replay protection",
] as const;

export function HowItWorksTerminal() {
  return (
    <div className="simple-how">
      <ol className="simple-how__steps">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>

      <details className="technical-details">
        <summary>Technical details</summary>
        <ul>
          {TECHNICAL_TERMS.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
