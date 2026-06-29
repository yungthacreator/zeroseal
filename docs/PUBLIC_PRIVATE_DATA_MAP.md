# Public Private Data Map

## Stays Private

- Private report text.
- Reproduction steps.
- PoC notes.
- Uploaded file contents.
- Private impact value.
- Random salt.
- Recovery bundle unless the user exports it.
- Wallet seed phrases and secret keys.

## Public Claim

- Reporting path.
- Programme or project.
- Target identifier.
- Public title.
- Category.
- Severity.
- Public threshold.
- Shortened seal.
- Policy identifier.
- Rule identifier.
- Researcher public key after wallet approval.

## Backend Payload

The claim creation request may include:

- wallet address;
- researcher commitment;
- nullifier;
- evidence commitment digest;
- ordered public input digests;
- idempotency key.

It must not include private report text, reproduction steps, PoC notes, uploaded file contents, private impact value or random salt.

## Stellar Testnet

The chain record may include:

- transaction hash;
- ledger number;
- source account;
- Claim Registry contract ID;
- method;
- researcher commitment.

No private exploit detail is written to chain.
