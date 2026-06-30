# ZeroSeal

**Prove security impact. Keep private evidence private.**

ZeroSeal is a privacy-preserving security disclosure product for researchers, bug bounty platforms, audit teams, and protocol security programmes.

It helps a researcher create a public, verifiable claim about a vulnerability without publishing the exploit path, raw report, proof of concept, private witness values, sensitive screenshots, salts, keys, or unpublished report content.

ZeroSeal is built around Stellar Testnet receipts, Freighter wallet approval, local private evidence handling, and proof-aware claim preparation.

## Live Product

- Frontend: `https://zeroseal.vercel.app`
- Network: Stellar Testnet
- Repository: `https://github.com/yungthacreator/zeroseal`

## Product Flow

ZeroSeal has three primary entry points:

- **Create claim**: build a private claim from scratch.
- **Try ZeroSeal**: use an example claim or enter test details to understand the full flow.
- **Verify receipt**: inspect a public receipt, transaction hash, or claim identifier.

The user flow is:

1. Choose where the vulnerability will be reported.
2. Describe the target and finding.
3. Add private evidence locally.
4. Generate a private seal.
5. Review the approved public claim.
6. Approve the Stellar Testnet registry action with Freighter.
7. Receive a public receipt after a real confirmed transaction.

No fingerprint, private seal output, wallet request, transaction hash, ledger, or receipt is shown before the user takes the required action.

## What ZeroSeal Proves Today

The current Noir circuit supports a specific private impact-threshold predicate. It is designed for a double-withdrawal or stale-entitlement style impact claim.

The current predicate checks that:

- the actor is unprivileged;
- each individual withdrawal is within entitlement;
- the combined withdrawals exceed entitlement;
- demonstrated private loss is at least the public minimum loss threshold.

The current implementation does not claim to prove every possible exploit or arbitrary exploit validity.

## Privacy Boundary

### Stays Private

- exploit details;
- reproduction steps;
- private files;
- proof-of-concept content;
- private witness values;
- exact vulnerable paths;
- salts and keys;
- unpublished report content;
- wallet secret keys and seed phrases.

### Can Become Public

- claim identifier;
- reporting context;
- programme or project context;
- target snapshot hash;
- policy identifier;
- public threshold;
- researcher fingerprint;
- nullifier;
- verifier version;
- researcher public key after wallet approval;
- transaction hash after confirmation;
- ledger after confirmation;
- registry contract;
- receipt URL.

## Stellar Testnet Flow

ZeroSeal uses Freighter for wallet approval on Stellar Testnet.

The app does not fabricate chain data. A receipt is only treated as confirmed when a real transaction hash is returned and can be shown through the Testnet receipt flow.

Current on-chain action:

- register or record the researcher fingerprint through the configured Claim Registry path;
- persist receipt details locally and through the backend path when available;
- link the user to Stellar explorer views for public inspection.

## Application Routes

- `/`: product homepage.
- `/create`: create a private claim from scratch.
- `/demo`: Try ZeroSeal.
- `/verify`: verify a public receipt or transaction.
- `/receipt/[identifier]`: inspect a receipt by transaction hash or local claim identifier.

## Architecture

```text
Researcher browser
  |
  | private evidence remains local
  v
Private seal generation
  |
  | public claim fields only
  v
ZeroSeal web app
  |
  | optional API persistence and structural checks
  v
ZeroSeal API
  |
  | Freighter wallet approval
  v
Stellar Testnet
  |
  | confirmed transaction
  v
Public receipt and verifier page
```

## Repository Structure

```text
zeroseal/
  apps/
    api/      NestJS API, claim lifecycle, receipts, queues, Stellar services
    web/      Next.js app, claim UI, Try ZeroSeal, receipt verification
  circuits/   Noir circuits
  contracts/  Soroban contracts
  docs/       product truth, runbooks, deployment notes
  packages/   shared contract client code
  scripts/    validation and support scripts
```

## Local Development

Install dependencies:

```powershell
npm install
```

Run the web app:

```powershell
npm.cmd --prefix apps/web run dev
```

Run the API:

```powershell
npm.cmd --prefix apps/api run dev
```

Start local infrastructure when needed:

```powershell
docker compose -f docker-compose.dev.yml up -d
```

## Required Checks

```powershell
npm.cmd --prefix apps/web run lint
npm.cmd --prefix apps/web run typecheck
npm.cmd --prefix apps/web run build
npm.cmd --prefix apps/api run test
npm.cmd --prefix apps/api run build
```

## Environment

Important environment values include:

- `NEXT_PUBLIC_REGISTRY_CONTRACT_ID`
- `NEXT_PUBLIC_VERIFIER_CONTRACT_ID`
- `NEXT_PUBLIC_ZEROSEAL_API_URL`
- `DATABASE_URL`
- `REDIS_URL`
- `STELLAR_NETWORK`
- `STELLAR_RPC_URL`
- `STELLAR_HORIZON_URL`
- `REGISTRY_CONTRACT_ID`
- `VERIFIER_CONTRACT_ID`

The default product network is Stellar Testnet.

## Product Truth

ZeroSeal is a real product surface with a real Testnet path, but the current proof boundary is intentionally specific.

Current truth:

- private evidence is not published by the claim wizard;
- example data loads only after the user clicks Load example;
- researcher fingerprint does not exist before private seal generation;
- receipt pages do not invent transactions;
- the current circuit supports a private impact-threshold predicate;
- server-side UltraHonk verification and wider arbitrary evidence binding remain roadmap items.

## Documentation

Useful docs:

- `docs/PRODUCT_FLOW_TRUTH.md`
- `docs/DEMO_TRUTH_MATRIX.md`
- `docs/DEMO_RUNBOOK.md`
- `docs/RENDER_DEPLOYMENT.md`
- `docs/ARCHITECTURE_DECISION.md`

## Status

ZeroSeal is competition-ready product infrastructure for privacy-preserving security claims on Stellar Testnet. The current milestone focuses on the full user journey from private evidence to public receipt while keeping proof claims precise and honest.
