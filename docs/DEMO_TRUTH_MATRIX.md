# ZeroSeal Demo Truth Matrix

| Visible claim or feature | Classification | Source of truth | Verification note |
| --- | --- | --- | --- |
| Live frontend at `https://zeroseal.vercel.app` | Implemented and live | Vercel project | Public frontend loads independently of local services |
| Production API | Roadmap until deployed | Provider health URL | Free Render blueprint is present. Do not claim live until `/health` and `/ready` pass on a real public API |
| Managed PostgreSQL | Roadmap until provisioned | Provider database | Free Render PostgreSQL is configured in blueprint. Local Docker Postgres is not production |
| Managed Redis and embedded worker | Implemented locally, roadmap until deployed | API process logs and queue processing | Free deployment runs the worker inside `zeroseal-api` with `RUN_EMBEDDED_WORKER=true` |
| Redis queue recovery | Implemented locally | PostgreSQL verification jobs and transactions | Redis is transport only. PostgreSQL is source of truth |
| Demo programme | Implemented locally | `GET /api/v1/programmes` | `ZeroSeal Security Impact Demo` only |
| Third-party programme integration | Not supported | API programme records | Ecosystem names are references only |
| Desktop Freighter connection | Implemented locally | Wallet context and browser extension | Tested path is desktop extension signing |
| Mobile Freighter signing | Not supported | Wallet UX | Mobile can explore; signing requires desktop extension |
| Evidence files remain local | Implemented locally | Browser evidence manifest | File contents are read locally for hashing and are not sent to the API |
| Evidence commitment attached to claim | Implemented locally | `POST /api/v1/claims/:claimId/evidence` | Stored as local or claim-attached metadata |
| Evidence commitment constrained by `security-impact-v1` | Not supported | Proof public inputs | v1 has no `evidence_commitment` public input |
| Researcher fingerprint | Structurally validated | Supported proof artifact public inputs | Technical name: researcher commitment. Must not be confused with the local evidence seal |
| Proof artifact digest | Structurally validated | API proof validator | Digest is calculated from submitted artifact payload |
| Public-input digest | Structurally validated | API proof validator | Digest covers ordered accepted public inputs |
| `security-impact-v1` proof artifact shape | Structurally validated | `ProofService` | Schema, byte lengths, public input ordering and digests are checked |
| Server-side UltraHonk verification | Roadmap | Verifier adapter | Current worker keeps cryptographic boundary pending |
| Soroban verifier contract configured | Implemented locally | Env/config and explorer links | Configuration exists; proof verification is not claimed complete |
| Claim Registry researcher registration | Verified by Soroban | Claim Registry contract read/write | Only after Freighter signs and the contract accepts the transaction |
| Replay resistance | Verified by Soroban and backend constraints | Nullifier uniqueness and registry constraints | Same nullifier/proof cannot be reused in the supported flow |
| Real transaction hash | Recorded on Stellar Testnet | Horizon reconciliation | Only display as confirmed after successful Stellar response |
| Ledger number | Recorded on Stellar Testnet | Horizon reconciliation | Required before receipt issuance |
| Public receipt | Implemented locally; live only after production API | API receipt table | Issued only after confirmed transaction, real hash and ledger |
| Exact duplicate fingerprint equality | Roadmap | Future circuit | Not implemented in v1 |
| Semantic duplicate detection | Roadmap | Future product research | Not claimed |
| Automated bounty escrow | Roadmap | Future settlement design | Not implemented |
| Verification credits | Roadmap commercially | Payment and credit models | Demo code exists but production billing is not live |
| Ecosystem logo strip | Implemented and live after frontend deploy | Homepage component and `docs/BRAND_ASSETS.md` | Uses only locally stored, verified official assets |
