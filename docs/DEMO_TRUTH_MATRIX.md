# ZeroSeal Demo Truth Matrix

| UI statement | Source of truth | Scope | Implemented | Planned | Verification |
| --- | --- | --- | --- | --- | --- |
| Wallet connected | Freighter approval and active public key | wallet | Yes | No | Connected wallet control shows address and Testnet |
| Programme selected | API programme record | backend | Yes | No | `GET /api/v1/programmes` |
| Evidence hashed locally | Browser Web Crypto digest | local | Yes | No | Re-select same files and compare digest |
| Evidence commitment attached | API claim evidence endpoint | backend | Yes | No | `POST /api/v1/claims/:claimId/evidence` |
| Evidence commitment proof-bound | Circuit public inputs | cryptographic | No | Yes | `security-impact-v1` has no evidenceCommitment input |
| Proof structurally validated | API proof validator | backend | Yes | No | `POST /api/v1/claims/:claimId/proof` |
| Cryptographic verification pending | Verifier adapter boundary | backend | Yes | Yes | Verification result remains pending without real verifier runtime |
| Soroban verifier configured | Contract configuration | on-chain configuration | Yes | No | Configured verifier contract ID |
| Researcher registration found | Claim Registry `get_researcher_commitment` | on-chain state | Yes | No | Contract read via generated client |
| Transaction recovered | Horizon transaction and operation parameters | on-chain history | Yes | No | Wallet, contract, method and commitment match |
| Receipt issued | API receipt table after confirmation | backend/on-chain | Partial | No | Receipt requires confirmed transaction |
| XLM credits | Payment and credit models | backend | Partial | Yes | Credit issuance remains configuration-gated |
