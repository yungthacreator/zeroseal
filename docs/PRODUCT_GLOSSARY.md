# ZeroSeal Product Glossary

## Programme
The security programme or organisation that publishes the claim policy.

## Programme Snapshot
An immutable version of the programme configuration used by a claim.

## Impact Policy
The public condition or threshold being proven.

## Circuit
The approved proof logic that determines which private values and public inputs are valid.

## Claim
One user workflow from draft through verification and receipt issuance.

## Researcher Commitment
A stable researcher-registration binding associated with the wallet. It is not an evidence hash and must not change when evidence files change.

## Evidence Commitment
A deterministic digest of selected local evidence. The raw files remain in the browser. The commitment is only proof-bound when the active circuit explicitly constrains it.

## Proof Artifact
The encoded zero-knowledge proof and its approved public inputs.

## Proof Artifact Digest
A digest of the proof artifact. It is not the evidence commitment.

## Public-Input Digest
A digest of the permitted public-input sequence. It is not the raw public inputs.

## Nullifier
A circuit-scoped replay-prevention value. It is not an evidence hash.

## Stellar Transaction
The signed on-chain operation submitted through the user's wallet.

## Transaction Hash
The exact Stellar transaction identifier returned after submission. It must never be guessed or reused as another identifier.

## Receipt
The immutable ZeroSeal record issued after verified confirmation.

## Receipt ID
The immutable ZeroSeal receipt identifier. It is not a Stellar transaction hash.
