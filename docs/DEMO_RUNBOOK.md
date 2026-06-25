# ZeroSeal Demo Runbook

## Pre-Demo Checks
- Start PostgreSQL and Redis: `docker compose -f docker-compose.dev.yml up -d`.
- Apply migrations: `npm --prefix apps/api run prisma:migrate`.
- Start API: `npm --prefix apps/api run dev`.
- Start worker: `npm --prefix apps/api run worker`.
- Start web: `npm --prefix apps/web run dev -- --hostname 0.0.0.0 --port 3001`.
- API health: `http://127.0.0.1:4000/health`.
- Web URL: `http://127.0.0.1:3001`.
- Freighter is unlocked.
- Freighter network is Stellar Testnet.
- Wallet has enough Testnet XLM.
- Registry and verifier contract IDs are configured.

## Demo Flow
1. Open ZeroSeal.
2. Connect Freighter.
3. Show the connected Testnet account.
4. Select ZeroSeal Security Impact Demo.
5. Confirm the active snapshot and policy.
6. Choose local evidence.
7. Explain that files remain local.
8. Show evidence commitment creation.
9. Continue without copying any hash.
10. Load the approved proof artifact.
11. Show structural and cryptographic verification states separately.
12. Authorise the prepared Stellar transaction only if a transaction is intentionally being demonstrated.
13. Confirm the transaction in Freighter only during an approved live demo.
14. Wait for backend reconciliation.
15. Show confirmed transaction hash.
16. Open the transaction in StellarExpert.
17. Return to ZeroSeal.
18. Show the immutable public receipt.
19. Show network activity.
20. Briefly show the business-model carousel.

## Failure Recovery
- Wallet locked: unlock Freighter and retry Connect Freighter.
- Wallet missing: install the official Freighter browser extension.
- Wrong network: switch Freighter to Stellar Testnet.
- API unavailable: start `apps/api` and confirm `/health`.
- Worker unavailable: start `npm --prefix apps/api run worker`.
- Proof rejected: check artifact schema, public-input ordering and byte lengths.
- Transaction rejected: no chain state changed; retry when ready.
- Transaction pending: wait for reconciliation or inspect the transaction hash.
- Explorer unavailable: keep the confirmed hash and retry StellarExpert later.
- Previously registered researcher: recover provenance from Horizon; if unavailable, show Registry state found only.
- Commitment mismatch: do not overwrite researcherCommitment with evidenceCommitment.
- Circuit does not support evidence binding: show claim-attached, circuit binding pending.

## Mobile Notes
- A phone cannot open a computer's `127.0.0.1` address.
- Mobile testing requires a deployed HTTPS URL or explicitly configured LAN URL.
- Direct mobile Freighter handoff is not enabled until a supported wallet connector is configured.
