# ZeroSeal Free Render Deployment

## Architecture

The free Render blueprint creates only:

- `zeroseal-api`, a free web service.
- `zeroseal-postgres`, a free PostgreSQL database.
- `zeroseal-redis`, a free Key Value instance.

There is no separate Render worker service. Free Render does not provide a separate always-on background worker, so the API starts an embedded BullMQ worker when `RUN_EMBEDDED_WORKER=true`.

The `zeroseal-api` service is pinned to `branch: feat/testnet-browser-integration` with `autoDeployTrigger: commit`.

## Source of Truth

PostgreSQL is the source of truth for claims, proof artifacts, verification jobs, transactions and receipts. Redis is used only as a queue transport. If Redis restarts, the API can recover queued verification and reconciliation work from PostgreSQL.

The free PostgreSQL plan may expire or be reset according to Render free-plan policy. Export or migrate data before relying on it for a long-running demo.

## Required Environment

Render supplies `PORT` and `RENDER_EXTERNAL_URL`.

The API resolves its public URL in this order:

1. `API_PUBLIC_URL`
2. `RENDER_EXTERNAL_URL`
3. Local development fallback only when `NODE_ENV=development`

Production has no localhost fallback. The blueprint does not set an `API_PUBLIC_URL` placeholder; Render supplies `RENDER_EXTERNAL_URL`.

Required production values:

```env
NODE_ENV=production
RUN_EMBEDDED_WORKER=true
CORS_ALLOWED_ORIGINS=https://zeroseal.vercel.app
STELLAR_NETWORK=TESTNET
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
REGISTRY_CONTRACT_ID=CBKQ3ZTUIOQLPQLZ5RUK237P6AGAJ4LGOQJNB2GVJHRFVNKENFIU622R
VERIFIER_CONTRACT_ID=CABBWKKUU4PWWU5LSV2BPUMIEZR542V36WONDA2UT6OHXJWZAPXIKA2X
EXPLORER_TRANSACTION_BASE_URL=https://stellar.expert/explorer/testnet/tx
EXPLORER_ACCOUNT_BASE_URL=https://stellar.expert/explorer/testnet/account
EXPLORER_CONTRACT_BASE_URL=https://stellar.expert/explorer/testnet/contract
LOG_LEVEL=info
```

Do not set wildcard CORS origins.

## Blueprint Steps

1. Connect the repository to Render.
2. Confirm the blueprint is using `branch: feat/testnet-browser-integration`.
3. Apply `render.yaml`.
4. Confirm every resource uses `plan: free`.
5. Confirm there is no `type: worker` service.
6. Confirm there is no `sync: false` value.
7. Let `preDeployCommand` run `npx prisma migrate deploy`.
8. Open `/health` and `/ready`.

`/health` checks the web process. `/ready` checks both PostgreSQL and Redis.

## Vercel Connection

After Render assigns the API URL, set this Vercel environment variable:

```env
NEXT_PUBLIC_ZEROSEAL_API_URL=https://THE-ACTUAL-RENDER-API-URL
```

Redeploy the existing Vercel project after setting the value.

Do not use a production fallback to `127.0.0.1`.
