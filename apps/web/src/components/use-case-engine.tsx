const USE_CASES = [
  {
    title: "Private impact verification",
    text: "Show that a vulnerability meets a published loss or severity threshold without revealing the complete exploit first.",
    label: "Current focus",
  },
  {
    title: "Priority and authorship record",
    text: "Create a time-linked public record of the approved researcher fingerprint and confirmed registry action.",
    label: "Current focus",
  },
  {
    title: "Safer staged disclosure",
    text: "Share the public claim first, complete programme review second, and disclose the full technical report through an agreed private channel.",
    label: "Current focus",
  },
  {
    title: "Future duplicate-proof circuits",
    text: "A future programme-specific circuit could prove that two private submissions satisfy a defined overlap rule without exposing the earlier report.",
    label: "Future extension",
  },
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
          ZeroSeal is shaped for security researchers and programmes that need a
          safer path between private evidence and public assurance.
        </p>
      </div>

      <div className="security-use-cases__grid">
        {USE_CASES.map((item) => (
          <article key={item.title}>
            <span>{item.label}</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
            {item.title === "Priority and authorship record" ? (
              <small>
                This record supports review, but does not by itself legally
                prove authorship.
              </small>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
