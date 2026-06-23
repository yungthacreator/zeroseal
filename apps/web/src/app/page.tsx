import { WalletPanel } from "@/components/wallet-panel";

export default function Home() {
  return (
    <main>
      <nav className="navigation">
        <span className="brand">ZEROSEAL</span>
        <span className="network-label">Privacy proof infrastructure</span>
      </nav>

      <section className="hero">
        <p className="eyebrow">Prove impact. Reveal nothing.</p>
        <h1>
          Verifiable claims,
          <br />
          without exposing the evidence.
        </h1>
        <p className="hero-copy">
          Generate a zero-knowledge proof from private evidence, verify it on
          Stellar, and record a replay-resistant public receipt.
        </p>
      </section>

      <section className="workflow-grid">
        <article>
          <span>01</span>
          <h2>Prepare privately</h2>
          <p>Your sensitive evidence stays on your device.</p>
        </article>

        <article>
          <span>02</span>
          <h2>Prove the claim</h2>
          <p>Noir and UltraHonk produce a verifiable proof.</p>
        </article>

        <article>
          <span>03</span>
          <h2>Record the receipt</h2>
          <p>Soroban verifies the proof and prevents replay.</p>
        </article>
      </section>

      <WalletPanel />

      <footer>
        Experimental software. Contracts and proving workflows remain
        unaudited.
      </footer>
    </main>
  );
}
