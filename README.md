# ZeroSeal

**Prove impact. Reveal nothing.**

ZeroSeal is a privacy-preserving responsible disclosure protocol for Web3 security.

It enables a security researcher to prove that a predefined vulnerability impact is valid without publishing the exploit path, private witness, or sensitive technical details.

The proof is generated off-chain using Noir and UltraHonk, then verified by a Soroban smart contract on Stellar.

## The problem

Responsible disclosure currently depends heavily on trust.

Researchers may need to reveal sensitive exploit details before receiving acknowledgement or protection. Protocol teams must determine whether a report is credible without exposing users or assets to additional risk.

ZeroSeal introduces a cryptographic middle layer.

A researcher can prove that a registered security condition has been satisfied while keeping the evidence required to produce that proof private.

## What ZeroSeal proves

ZeroSeal is being designed to prove narrowly defined impact statements such as:

- an unprivileged action violates a registered security invariant;
- the demonstrated loss exceeds a defined severity threshold;
- the proof corresponds to a committed protocol state;
- the claim belongs to a specific researcher;
- the same claim has not already been submitted.

The exploit instructions and private witness are not published on-chain.

## Verified progress

The initial proof-verification milestone has passed on a local Stellar network.

| Test | Result |
| --- | --- |
| Valid Noir and UltraHonk proof | Accepted |
| Modified public input | Rejected |
| Tampered proof bytes | Rejected |
| Soroban verification | Confirmed |

This demonstrates that both zero-knowledge cryptography and Stellar verification are load-bearing parts of the system.

## Product flow

1. A protocol or security programme registers a precise impact condition.
2. A researcher generates a proof locally without revealing the private witness.
3. A Soroban contract verifies the proof on Stellar.
4. A replay-resistant claim is recorded.
5. The protocol can acknowledge the claim, reserve a demonstration bounty, or activate an optional safety response.

## Architecture

```text
Private security evidence
          |
          v
   Noir impact circuit
          |
          v
   UltraHonk proof
          |
          v
 Soroban verifier on Stellar
          |
          v
 Replay-resistant claim record



## Current development scope

The current build focuses on:

- a proof-of-impact Noir circuit;
- UltraHonk proof generation;
- Soroban proof verification;
- replay-resistant nullifiers;
- a deliberately vulnerable local demonstration vault;
- test-only bounty reservation;
- a minimal black-and-white interface.

ZeroSeal is designed for future use by bug bounty platforms, audit contests, protocols, and security teams. No external platform integration is currently claimed.

## Technology

- Stellar and Soroban
- Noir
- UltraHonk
- Barretenberg
- Rust
- Stellar CLI
- Docker localnet

## Security status

ZeroSeal is an experimental hackathon prototype.

It is not audited and must not be used with real assets, production contracts, mainnet funds, or undisclosed live vulnerabilities.

All current development and testing use local or test environments.

## Built on Stellar

ZeroSeal is being developed for **Stellar Hacks: Real-World ZK**, using zero-knowledge proof verification inside a Stellar smart contract.
