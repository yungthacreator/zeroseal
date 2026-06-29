export function HeroActions() {
  return (
    <div className="hero-onboarding">
      <div className="hero__actions">
        <a className="btn btn--primary" href="/create">
          Create a private claim
        </a>
        <a className="btn btn--outline" href="/demo">
          Try ZeroSeal
        </a>
        <a className="btn btn--outline" href="/verify">
          Verify a receipt
        </a>
      </div>
    </div>
  );
}
