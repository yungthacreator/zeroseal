# ZeroSeal Demo Runbook

## Open
- Live frontend: `https://zeroseal.vercel.app`.
- Local fallback: `http://127.0.0.1:3001`.
- Local API health: `http://127.0.0.1:4000/health`.
- Local API readiness: `http://127.0.0.1:4000/ready`.

## Prerequisites
- Desktop Firefox or Chromium with the official Freighter browser extension.
- Freighter unlocked and switched to Stellar Testnet.
- Testnet account funded.
- PostgreSQL and Redis running locally, or a verified production API configured in Vercel.
- API env includes `DATABASE_URL`, `REDIS_URL`, `CORS_ALLOWED_ORIGINS`, Stellar Testnet URLs, registry contract ID and verifier contract ID.
- Worker is running either as the local standalone process or embedded in the API with `RUN_EMBEDDED_WORKER=true`.

## Exact Demo Fixture
- Programme: `ZeroSeal Security Impact Demo`.
- Programme ID: `zeroseal-security-impact-demo`.
- Snapshot ID: `security-impact-demo-v1`.
- Policy ID: `published-impact-threshold-v1`.
- Circuit: `security-impact-v1`, version `v1`.
- Proof artifact: `apps/web/public/zeroseal/browser-claim.json`.
- Evidence commitment: browser-calculated local digest, optional for the fixed proof artifact.
- Evidence binding status: claim-attached or local-only; not proof-bound in v1.

## Five-Minute Sequence
1. Open `https://zeroseal.vercel.app` and state the trust problem: researchers need to prove impact without revealing exploit details.
2. Show the selected demo programme, snapshot, policy, circuit, network and evidence-binding status.
3. Open the local evidence manifest, choose safe dummy files if desired, and explain that file contents remain on device.
4. Load `browser-claim.json` and show the researcher commitment, nullifier, proof artifact digest and public-input digest.
5. Create the persisted claim through the API if the production or local backend is available.
6. Explain that ZeroSeal structurally validates the artifact and queues verification; UltraHonk and Soroban verification remain separate truth boundaries.
7. Connect desktop Freighter on Testnet.
8. Authorise the Claim Registry transaction only when the presenter intentionally wants to submit a Testnet transaction.
9. After submission, wait for backend reconciliation and show the real transaction hash and ledger only if returned by Stellar.
10. Inspect the explorer links and the public receipt only after the API issues it from confirmed transaction state.

## Expected Claim Statuses
- `AWAITING_PROOF` after claim creation.
- `PROOF_RECEIVED` after supported artifact submission.
- `VERIFYING` after verification is queued.
- `AWAITING_WALLET_SIGNATURE` after the worker processes the supported structural proof path.
- `SUBMITTED` when a transaction is recorded for reconciliation.
- `CONFIRMED` only after successful Stellar reconciliation.
- `RECEIPT_ISSUED` only after receipt creation from confirmed transaction state.

## Plain-English Explanation
ZeroSeal keeps private evidence and witness material away from the public workflow. The current demo proves that a supported public-input shape can move through a persisted claim lifecycle, wallet-authorised Stellar Testnet transaction, reconciliation and receipt path. It does not yet prove that arbitrary local evidence files are cryptographically bound into the v1 proof.

## Fallbacks
- Production API unavailable: say the frontend is live, backend deployment is pending, and run the local API.
- Free API cold start: wait for "Starting ZeroSeal verification service" to finish, then press Retry if it stops retrying.
- Worker unavailable: show claim and proof persistence, then state that queue processing is paused or waiting for Redis recovery.
- Testnet delay: keep the submitted transaction pending and use StellarExpert to inspect status later.
- Wallet missing or mobile device: continue without wallet and show desktop signing instructions.
- Previously registered researcher: display registry state only; do not call it a complete receipt unless the original transaction hash and ledger are available.
- Proof rejected: explain schema, byte length, digest or public-input ordering mismatch.
