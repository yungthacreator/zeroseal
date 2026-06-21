# Architecture Decision Record 001

## Decision

Use a small Noir circuit with UltraHonk proof generation and a Soroban UltraHonk verifier for the competition MVP.

## Rationale

- Noir is readable and suited to a narrowly constrained statement.
- Stellar provides BN254/Poseidon-family primitives needed by modern ZK verification.
- A public Soroban UltraHonk verifier implementation exists as reference code.
- The deadline favours a small circuit over a general-purpose zkVM application.

## Trust boundaries

- The private exploit witness remains local.
- The verifier key is pinned at deployment.
- Public inputs are explicitly encoded and documented.
- The coordinator trusts only the approved verifier contract.
- The reference verifier is unaudited and must be labelled as such.
- All assets and bounties are testnet/demo-only.

## Revisit condition

Switch away from Noir only if the M0 spike cannot be reproduced with pinned versions within the allocated time.
