# ZeroSeal Product Flow Truth

This document is the product-facing truth boundary for the current ZeroSeal browser flow.

## User Entry Points

- `/create`: create a private claim from scratch.
- `/demo`: try a safe fictional claim. The demo starts empty and only loads fictional data after the user explicitly asks for it.
- `/verify`: inspect a public receipt, transaction hash, or local public claim identifier.
- `/receipt/[identifier]`: show confirmed Stellar receipt data for a real transaction hash, or a local public claim preview when no transaction is attached.

The homepage should introduce these paths. It should not expose the full technical proof workspace as the first interaction.

## Current Supported Predicate

The current Noir circuit does not prove generic exploit validity.

The supported MVP predicate is a private impact threshold check for the double-withdrawal or stale-entitlement style flow:

- the actor is unprivileged;
- each individual withdrawal is within the public entitlement;
- combined withdrawals exceed the entitlement;
- demonstrated private loss is at least the public minimum loss threshold.

Public outputs are limited to programme and policy context, the target snapshot, minimum loss, state commitment, researcher commitment, and nullifier. Raw evidence, reproduction steps, proof-of-concept text, exact vulnerable paths, salts, keys, and unpublished report content are not public outputs.

## Browser Seal Boundary

The `/create` and `/demo` wizard creates a local private seal only after the user clicks **Generate private seal**.

That seal uses WebCrypto SHA-256 over canonical public claim material, a digest of the private evidence fields, and a secure random salt. It is a browser-side binding artifact and recovery bundle. It is not a replacement for server-side UltraHonk proof verification and it does not prove arbitrary exploit correctness.

Before that click:

- no researcher fingerprint is shown;
- no package or proof artifact is loaded;
- demo data is not preloaded.

## Public Payload

The public payload may contain:

- claim identifier;
- researcher public key;
- reporting context;
- programme context hash;
- target snapshot hash;
- policy identifier and version;
- public threshold;
- researcher fingerprint;
- proof digest or supported proof output digest;
- nullifier;
- verifier version;
- timestamp;
- network;
- transaction hash and ledger only after a real confirmation;
- verification result.

The public payload must not contain:

- exploit code;
- reproduction steps;
- raw evidence;
- private witness values;
- exact vulnerable path;
- salt;
- encryption key;
- unpublished report text.

## Receipt Semantics

Confirmed receipts require a real Stellar Testnet transaction hash and ledger. A local claim identifier can show the reviewed public payload, but it must say that no confirmed transaction is attached.

The current wallet action records a researcher fingerprint through the existing Claim Registry client. Expanding the on-chain registry to submit the full public claim payload is future work unless implemented in the contract and client.
