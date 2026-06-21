# Competition Alignment

## Mandatory requirements

ZeroSeal must ship with:

1. A public open-source repository.
2. A 2–3 minute working demo video.
3. Meaningful zero-knowledge cryptography.
4. Proof verification inside a Stellar smart contract.

## Why ZK is load-bearing

Without ZK, a researcher must disclose the exploit witness to prove impact. ZeroSeal keeps the witness private while proving a constrained impact statement.

## Why Stellar is load-bearing

Stellar is not used as a decorative timestamp layer. The MVP uses Soroban to:

- verify the proof;
- bind the proof to approved public inputs;
- record a nullifier;
- prevent replay;
- reserve a test bounty;
- optionally activate an opt-in safety state.

## Competition MVP statement

An unprivileged actor can extract more value from a registered demo vault than their legitimate entitlement, and the excess is at least the registered critical-impact threshold.

## Out of scope for the MVP

- universal exploit proving;
- arbitrary EVM execution;
- real Immunefi or Sherlock integration;
- real bounty payouts;
- production funds;
- mainnet deployment;
- automatic pause of protocols that did not opt in;
- claims of formal audit or production readiness.
