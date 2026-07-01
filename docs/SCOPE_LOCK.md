# Scope Lock

## Product

**ZeroSeal - private proof-of-impact and bounty reservation on Stellar.**

## Core flow

```text
private witness
    -> Noir proof
    -> Soroban UltraHonk verification
    -> claim nullifier recorded
    -> test bounty reserved
    -> optional demo-vault safety mode
```

## Milestone order

### M0 - proof-verification spike
Real Noir proof accepted by a real Soroban verifier on localnet. Wrong input and tampered proof rejected.

### M1 - domain circuit
Prove target binding, state binding, non-privileged execution, excess withdrawal, threshold, researcher binding, and nullifier.

### M2 - contracts
Demo vault, bounty escrow, impact coordinator, replay protection, atomic state transition.

### M3 - testnet
Deploy and complete a real testnet flow.

### M4 - adversarial review
Independent review and negative tests.

### M5 - GUI
Single-screen, black-and-white interface with restrained Stellar-compatible accent.

## Stop conditions

Do not start the next delivery step when the current acceptance criteria are not met.
Do not replace failed verification with mocks.
Do not claim integration with Immunefi, Sherlock, or Stellar Development Foundation.
