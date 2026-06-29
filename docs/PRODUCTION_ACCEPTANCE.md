# Production Acceptance

## Required Before Recording

- `https://zeroseal.vercel.app` returns 200.
- `NEXT_PUBLIC_ZEROSEAL_API_URL` is set in Vercel to the real Render API origin.
- The API `/health` endpoint returns `status: ok`.
- The API `/ready` endpoint returns `status: ready`.
- PostgreSQL is ready.
- Redis is either ready or reported as optional.
- `REGISTRY_CONTRACT_ID` is configured.
- `VERIFIER_CONTRACT_ID` is configured.
- CORS allows `https://zeroseal.vercel.app` and required local development origins only.
- The `/create` route creates a persisted backend claim before signing.
- The `/receipt/[identifier]` route checks backend receipt or transaction state before falling back to public Stellar lookup.
- A real Stellar Testnet transaction has been executed and inspected.

## Manual Provider Variables

Set these in Vercel:

- `NEXT_PUBLIC_ZEROSEAL_API_URL`
- `NEXT_PUBLIC_REGISTRY_CONTRACT_ID`
- `NEXT_PUBLIC_VERIFIER_CONTRACT_ID`

Set these in Render:

- `DATABASE_URL`
- `REDIS_URL`
- `RUN_EMBEDDED_WORKER=true`
- `REDIS_REQUIRED_FOR_READY=false`
- `CORS_ALLOWED_ORIGINS=https://zeroseal.vercel.app`
- `STELLAR_NETWORK=TESTNET`
- `STELLAR_RPC_URL=https://soroban-testnet.stellar.org`
- `STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org`
- `STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015`
- `REGISTRY_CONTRACT_ID`
- `VERIFIER_CONTRACT_ID`

Do not set a localhost API URL in production.
