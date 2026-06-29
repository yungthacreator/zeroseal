const STEPS = [
  {
    title: "Prepare privately",
    text: "Keep the report and sensitive witness on the device.",
  },
  {
    title: "Load the approved proof",
    text: "ZeroSeal reads the supported public claim data.",
  },
  {
    title: "Create the claim record",
    text: "The backend tracks the policy-linked claim lifecycle.",
  },
  {
    title: "Approve the Testnet action",
    text: "Freighter shows the exact registry transaction.",
  },
  {
    title: "Inspect the receipt",
    text: "View the real transaction and receipt after confirmation.",
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
            <i aria-hidden="true" />
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
