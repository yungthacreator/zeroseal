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
The stable commitment contained in the supported proof artifact and used by the researcher registration flow. It is not an evidence hash and must not change when evidence files change.

## Evidence Commitment
A digest calculated locally from selected evidence files. The raw files remain on the researcher's device and are not uploaded to the API. In the current v1 workflow the digest may be attached to a claim, but the active circuit does not yet prove that these files produced the proof.

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
The immutable ZeroSeal record issued only after genuine transaction confirmation and reconciliation.

## Evidence Binding Status
The public label for whether an evidence commitment is local-only, claim-attached, unsupported by the active circuit, or cryptographically constrained by a future supported circuit.

## Structural Validation
Validation that the proof artifact has the supported schema, byte lengths, public-input ordering and digests. This is not the same as cryptographic proof verification.

## Cryptographic Verification
Verifier execution that proves the submitted proof is valid for the selected circuit and public inputs.

## Soroban Verification
Verification or registry logic executed by configured Soroban contracts on Stellar Testnet.

## Receipt ID
The immutable ZeroSeal receipt identifier. It is not a Stellar transaction hash.
