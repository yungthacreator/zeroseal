const USE_CASES = [
  {
    title: "Private impact verification",
    text: "Present a permitted impact claim without revealing the complete exploit first.",
  },
  {
    title: "Priority record",
    text: "Create a time-linked record of the approved fingerprint and registry action.",
  },
  {
    title: "Staged disclosure",
    text: "Review the public claim first and share the full report privately.",
  },
] as const;

const FUTURE_EXTENSIONS = [
  "duplicate-overlap circuits",
  "escrow integrations",
  "programme-specific proof rules",
] as const;

export function UseCaseEngine() {
  return (
    <div className="security-use-cases">
      <div className="security-use-cases__intro">
        <p className="eyebrow">Use cases</p>
        <h2 className="display display--lg">
          Security workflows first.
        </h2>
        <p className="lede">
          ZeroSeal supports the moment between a private finding and a public
          receipt.
        </p>
      </div>

      <div className="security-use-cases__grid">
        {USE_CASES.map((item) => (
          <article key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
            {item.title === "Priority record" ? (
              <small>
                This record does not by itself legally prove authorship.
              </small>
            ) : null}
          </article>
        ))}
      </div>

      <details className="technical-details security-use-cases__future">
        <summary>Future extensions</summary>
        <ul>
          {FUTURE_EXTENSIONS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
