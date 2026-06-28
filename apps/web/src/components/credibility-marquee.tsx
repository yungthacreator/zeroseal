const ECOSYSTEMS = [
  "Immunefi",
  "Sherlock",
  "Code4rena",
  "Cantina",
  "Hats Finance",
  "CodeHawks",
] as const;

function MarqueeTrack({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul className="credibility-marquee__track" aria-hidden={hidden}>
      {ECOSYSTEMS.map((name) => (
        <li key={name}>
          <span className="credibility-marquee__wordmark" aria-label={name}>
            {name}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CredibilityMarquee() {
  return (
    <section
      className="credibility-marquee"
      aria-labelledby="credibility-marquee-title"
    >
      <div className="shell">
        <h2 className="eyebrow" id="credibility-marquee-title">
          DESIGNED FOR MODERN SECURITY DISCLOSURE
        </h2>
        <p className="credibility-marquee__lede">
          ZeroSeal is designed to complement the workflows used by security
          researchers, audit firms and vulnerability reward programmes.
        </p>
        <p className="credibility-marquee__label">
          Designed for security disclosure workflows across ecosystems such as
        </p>
        <div
          className="credibility-marquee__viewport"
          aria-label="Security disclosure ecosystem examples"
        >
          <div className="credibility-marquee__motion">
            <MarqueeTrack />
            <MarqueeTrack hidden />
          </div>
        </div>
        <p className="credibility-marquee__notice">
          Independent project. No affiliation or endorsement is implied.
        </p>
      </div>
    </section>
  );
}
