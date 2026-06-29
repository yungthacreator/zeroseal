# ZeroSeal

**Prove impact. Reveal nothing.**

**Live application:** https://zeroseal.vercel.app

**Network:** Stellar Testnet

ZeroSeal is privacy-preserving proof infrastructure for responsible Web3 security disclosure.

It enables a security researcher to prove that private vulnerability evidence satisfies a programme's published impact policy without exposing the exploit path, reproduction steps, sensitive code paths, private witness values, or complete proof of concept.

The current `security-impact-v1` workflow structurally validates a supported proof artifact, persists the claim lifecycle, queues verification work, records real Stellar Testnet transaction state and issues receipts only after genuine confirmation. Complete server-side UltraHonk verification and proof-bound arbitrary evidence commitments remain roadmap items until the v2 circuit and verifier path are complete.

## The problem

Responsible disclosure still depends heavily on trust.

A researcher may discover a serious vulnerability but face a difficult choice:

* reveal sensitive technical evidence before receiving acknowledgement;
* expose reproduction details to prove the report is credible;
* trust that the receiving programme will protect the report;
* risk duplicate disputes or questions about when evidence existed;
* disclose enough information to prove impact while avoiding unnecessary operational risk.

Protocol teams face the opposite problem. They need enough evidence to assess whether a report satisfies their impact policy, but receiving a complete exploit package can itself create additional security risk.

ZeroSeal introduces a cryptographic verification layer between the researcher and the receiving programme.

The researcher proves that an approved condition is satisfied. The programme receives a verifiable result and an auditable Stellar receipt. The private witness remains with the researcher.

## What ZeroSeal proves

The current implemented workflow focuses on security impact claims.

A programme defines public verification parameters such as:

* programme identifier;
* programme snapshot;
* impact policy;
* minimum loss threshold;
* circuit identifier;
* verifier contract;
* registry contract.

The researcher supplies private witness values to an approved proof flow. Local evidence files can also be hashed into an evidence commitment, but the current v1 circuit does not yet prove that those arbitrary files produced the submitted proof.

The resulting public claim can demonstrate that:

* the claim belongs to the selected programme;
* the correct programme snapshot was used;
* the selected impact rule was satisfied;
* the approved threshold was met;
* the researcher commitment matches the proof;
* the claim contains a unique nullifier;
* the resulting transaction was confirmed on Stellar, when a real transaction hash and ledger have been reconciled.

The private witness is not sent to Stellar and is not stored by the ZeroSeal backend.

## Live workflow

A new researcher can follow the application in this order.

### 1. Connect

Connect a Freighter wallet on Stellar Testnet.

Freighter exposes the selected public address and network. ZeroSeal never requests or stores the wallet seed phrase or secret key.

### 2. Choose the claim

Select the:

* programme;
* programme snapshot;
* impact policy;
* supported proof circuit.

These values define the public statement that the proof must satisfy.

### 3. Prepare privately

Prepare the vulnerability report, proof of concept, screenshots, logs, reproduction notes, and supporting files locally.

The current evidence workspace can calculate a deterministic local commitment without uploading the file contents.

### 4. Generate the proof

Use or load the approved `security-impact-v1` proof artifact.

The private witness remains on the researcher's device.

### 5. Create the backend claim

ZeroSeal creates a claim record containing only permitted public information, commitments, identifiers, and lifecycle state.

Raw vulnerability evidence is rejected by the backend.

### 6. Verify

The proof artifact is structurally validated and routed through the configured verification boundary.

The implementation distinguishes between:

* artifact structural validation;
* cryptographic proof verification;
* Soroban verifier status;
* Claim Registry recording.

ZeroSeal does not trust a client-supplied `verified` value.

### 7. Authorise and record

Freighter presents the Stellar transaction to the researcher for review and signing.

After submission, ZeroSeal records the real transaction hash and reconciles its status against Stellar.

### 8. Inspect

After confirmation, the application exposes:

* transaction hash;
* confirmed ledger;
* source account;
* registry contract;
* verifier contract;
* network;
* public receipt;
* Stellar explorer links.

No fabricated transaction hashes or ledger values are used.

## System architecture

```text
Private evidence
      |
      | remains local
      v
Noir security-impact circuit
      |
      v
UltraHonk proof artifact
      |
      v
ZeroSeal API
  | structural validation
  | claim persistence
  | verification job
  | lifecycle tracking
      |
      v
Soroban verifier
      |
      v
Claim Registry
      |
      v
Confirmed Stellar transaction
      |
      v
Immutable public receipt
```

## Privacy boundary

### Remains private

* exploit details;
* reproduction steps;
* sensitive code paths;
* private witness values;
* researcher secrets;
* complete proof-of-concept files;
* supporting documents;
* wallet secret keys;
* wallet seed phrases.

### Becomes publicly verifiable

* programme identifier;
* snapshot identifier;
* policy identifier;
* circuit identifier;
* public threshold;
* researcher commitment;
* state commitment;
* nullifier;
* proof digest;
* accepted public-input digest;
* transaction hash;
* ledger number;
* registry contract;
* verifier contract;
* receipt identifier;
* confirmation timestamp.

## Current implementation

ZeroSeal currently includes:

* a Noir security impact circuit;
* UltraHonk proof artifact support;
* a Soroban verifier contract;
* a Soroban Claim Registry contract;
* replay-resistant nullifier handling;
* Freighter desktop wallet integration;
* Stellar Testnet transaction support;
* real explorer links;
* browser-side evidence hashing;
* a NestJS backend;
* PostgreSQL persistence;
* Prisma database models and migrations;
* verification job processing;
* transaction reconciliation;
* public claim receipts;
* wallet activity endpoints;
* programme, snapshot and policy endpoints;
* typed frontend API integration;
* deterministic tests;
* health and readiness endpoints.

## Claim lifecycle

```text
DRAFT
  |
  v
AWAITING_PROOF
  |
  v
PROOF_RECEIVED
  |
  v
VERIFYING
  |
  v
VERIFIED
  |
  v
AWAITING_WALLET_SIGNATURE
  |
  v
SUBMITTED
  |
  v
CONFIRMED
  |
  v
RECEIPT_ISSUED
```

Failure states:

```text
PROOF_REJECTED
TRANSACTION_FAILED
EXPIRED
CANCELLED
```

Lifecycle transitions are validated by the backend. Clients cannot move claims directly into arbitrary states.

## Backend API

The dedicated API is located in:

```text
apps/api
```

Main endpoints:

```text
POST /api/v1/claims
GET  /api/v1/claims/:claimId
GET  /api/v1/claims/:claimId/status
POST /api/v1/claims/:claimId/proof
POST /api/v1/claims/:claimId/evidence
POST /api/v1/claims/:claimId/verification
POST /api/v1/claims/:claimId/transactions
GET  /api/v1/claims/:claimId/transactions
GET  /api/v1/claims/:claimId/receipt

GET  /api/v1/wallets/:address/claims
GET  /api/v1/wallets/:address/activity
GET  /api/v1/wallets/:address/researcher-registration

GET  /api/v1/transactions/:transactionHash
GET  /api/v1/receipts/:receiptId

GET  /api/v1/programmes
GET  /api/v1/programmes/:programmeId
GET  /api/v1/programmes/:programmeId/snapshots
GET  /api/v1/programmes/:programmeId/policies
GET  /api/v1/circuits

GET  /health
GET  /ready
```

## Database model

The backend includes production-oriented models for:

* `WalletAccount`
* `Organisation`
* `Programme`
* `ProgrammeSnapshot`
* `ImpactPolicy`
* `Claim`
* `ClaimPublicInput`
* `ProofArtifact`
* `VerificationJob`
* `VerificationResult`
* `EvidenceCommitment`
* `ChainTransaction`
* `ClaimReceipt`
* `Payment`
* `VerificationCredit`

Important protections include:

* UUID primary keys;
* immutable receipt identifiers;
* idempotency keys;
* unique transaction hashes per network;
* nullifier uniqueness;
* programme snapshot immutability;
* indexed wallet, programme, status and transaction fields;
* transaction-safe lifecycle updates;
* no raw private evidence storage;
* no secret key storage.

## Receipt contents

A confirmed receipt can contain:

* receipt ID;
* claim ID;
* programme ID;
* snapshot ID;
* policy ID;
* circuit ID;
* researcher wallet address;
* researcher commitment;
* nullifier;
* public-input digest;
* proof artifact digest;
* Stellar transaction hash;
* confirmed ledger;
* registry contract;
* verifier contract;
* network;
* confirmation time;
* transaction explorer URL;
* account explorer URL;
* registry explorer URL;
* verifier explorer URL.

Issued receipt semantics are immutable.

## Repository structure

```text
zeroseal/
+-- apps/
|   +-- api/                     NestJS API and verification worker
|   +-- web/                     Next.js application
+-- circuits/                    Noir proof circuits
+-- contracts/                   Soroban contracts
+-- packages/
|   +-- claim-registry-client/   Shared Claim Registry client
+-- docs/                        Runbooks, glossary and truth matrix
+-- scripts/                     Development and validation scripts
+-- docker-compose.dev.yml       PostgreSQL and Redis services
+-- package.json                 Workspace commands
+-- README.md
```

## Technology

### Proof system

* Noir
* UltraHonk
* Barretenberg

### Blockchain

* Stellar
* Soroban
* Freighter
* Stellar RPC
* Horizon
* Stellar Expert explorer

### Backend

* NestJS
* TypeScript
* PostgreSQL
* Prisma
* Redis
* structured logging
* OpenAPI
* request IDs
* rate limiting

### Frontend

* Next.js
* React
* TypeScript
* typed API clients
* responsive wallet interface

## Local development

### Requirements

Install:

* Node.js 22 or later;
* npm;
* Docker;
* Docker Compose;
* Freighter browser extension;
* Rust and Stellar CLI for contract work;
* Noir and Barretenberg for proof generation.

### Clone the repository

```bash
git clone https://github.com/yungthacreator/zeroseal.git
cd zeroseal
```

### Install dependencies

```bash
npm install
npm --prefix apps/api install
npm --prefix apps/web install
```

### Start PostgreSQL and Redis

```bash
docker compose -f docker-compose.dev.yml up -d
```

### Configure the API

Create:

```text
apps/api/.env
```

Use `apps/api/.env.example` as the template.

Required configuration includes:

```env
NODE_ENV=development
PORT=4000

DATABASE_URL=postgresql://zeroseal:zeroseal_dev_password@127.0.0.1:5432/zeroseal
REDIS_URL=redis://127.0.0.1:6379

STELLAR_RPC_URL=
STELLAR_HORIZON_URL=
STELLAR_NETWORK_PASSPHRASE=

REGISTRY_CONTRACT_ID=
VERIFIER_CONTRACT_ID=

EXPLORER_TRANSACTION_BASE_URL=
EXPLORER_ACCOUNT_BASE_URL=
EXPLORER_CONTRACT_BASE_URL=

CORS_ALLOWED_ORIGINS=http://127.0.0.1:3001
API_PUBLIC_URL=http://127.0.0.1:4000
```

Never commit environment files or secrets.

### Configure the web application

Create:

```text
apps/web/.env.local
```

Add:

```env
NEXT_PUBLIC_ZEROSEAL_API_URL=http://127.0.0.1:4000
```

### Apply migrations

```bash
set -a
source apps/api/.env
set +a

npm --prefix apps/api run prisma:generate
npm --prefix apps/api run prisma:migrate
```

### Start the API

```bash
set -a
source apps/api/.env
set +a

npm --prefix apps/api run dev
```

The API should be available at:

```text
http://127.0.0.1:4000
```

Health checks:

```bash
curl http://127.0.0.1:4000/health
curl http://127.0.0.1:4000/ready
```

### Start the verification worker

Open another terminal:

```bash
cd ~/projects/zeroseal

set -a
source apps/api/.env
set +a

npm --prefix apps/api run worker
```

### Start the web application

Open another terminal:

```bash
cd ~/projects/zeroseal

npm --prefix apps/web run dev -- --hostname 127.0.0.1 --port 3001
```

Open:

```text
http://127.0.0.1:3001
```

## Validation

Run the following before submitting changes:

```bash
npm --prefix apps/api run prisma:format
npm --prefix apps/api run prisma:validate
npm --prefix apps/api run prisma:generate
npm --prefix apps/api run lint
npm --prefix apps/api test
npm --prefix apps/api run build

npm --prefix apps/web run typecheck
npm --prefix apps/web run lint
npm --prefix apps/web run build

git diff --check
```

Automated tests do not require real Stellar Testnet transactions.

## Security properties

ZeroSeal is designed around the following rules:

* private evidence remains outside the backend;
* secret keys remain inside the user's wallet;
* proof results are never accepted from a client boolean;
* nullifiers prevent supported replay attempts;
* idempotency prevents duplicate claim creation;
* transaction hashes are validated before persistence;
* ledger data is retrieved from Stellar;
* confirmed receipts require confirmed transactions;
* raw proof data is excluded from application logs;
* error responses do not expose production stack traces;
* payload and proof sizes are restricted;
* programme snapshots become immutable after use;
* transaction status is reconciled in the background.

## Current verification boundary

The project deliberately separates four different verification statements.

### Structural validation

Implemented.

ZeroSeal validates the artifact schema, identifiers, encodings, sizes, public-input count, ordering, digests, commitments and supported circuit configuration.

### Server-side cryptographic verification

Partially implemented.

The adapter boundary exists, but complete server-side UltraHonk verification remains a development milestone.

A result must remain pending where complete cryptographic verification is unavailable.

### Soroban verification

Configured for the Testnet workflow.

The application distinguishes configured Soroban verifier state from completed proof verification. The current worker keeps cryptographic and Soroban verification boundaries pending unless a real verifier path confirms them. The Claim Registry transaction is reconciled separately from proof verification.

### Evidence commitment binding

Partially implemented.

Browser-side evidence commitments can be attached to claims. The current `security-impact-v1` circuit does not yet constrain arbitrary uploaded evidence commitments as proof-bound public inputs.

The application must describe such commitments as local or claim-attached until a versioned circuit binds them cryptographically.

## Mobile wallet status

Desktop Freighter extension support is the current signing path.

Mobile browser extension signing is not claimed. Mobile users should follow the desktop wallet guidance until an official mobile handoff or WalletConnect-compatible Stellar flow is implemented and tested.

ZeroSeal never asks mobile users to enter a seed phrase into the website.

## Known limitations

* complete server-side UltraHonk verification is still in progress;
* arbitrary evidence commitments are not yet bound by `security-impact-v1`;
* mobile wallet handoff is not configured;
* verification credits are not yet operational;
* XLM settlement is not yet part of the primary claim flow;
* additional claim types require purpose-built circuits;
* the deployed application requires `NEXT_PUBLIC_ZEROSEAL_API_URL` to point at the deployed API;
* free Render services may cold start after idle time;
* free Render PostgreSQL has free-plan retention limits.

These limitations are shown openly so the application does not overstate what has been implemented.

## Free Render Deployment

The included Render blueprint is designed for a zero-cost production demo:

* `zeroseal-api`, one free web service;
* `zeroseal-postgres`, one free PostgreSQL database;
* `zeroseal-redis`, one free Key Value instance.

The API runs the verification and reconciliation worker in the same web process when `RUN_EMBEDDED_WORKER=true`. PostgreSQL remains the source of truth. Redis is only the queue transport, and queued work is recovered from persisted PostgreSQL records when the API starts or when Redis becomes available again.

The blueprint pins the API service to `feat/testnet-browser-integration`, uses `autoDeployTrigger: commit` and does not set an `API_PUBLIC_URL` placeholder. Production public URL resolution relies on an explicit `API_PUBLIC_URL` only when supplied, then Render's `RENDER_EXTERNAL_URL`.

See `docs/RENDER_DEPLOYMENT.md` for the exact blueprint and Vercel connection steps.

## Homepage Story

The frontend now introduces ZeroSeal in this order:

1. Hero.
2. Disclosure pain point.
3. ZeroSeal verification layer.
4. Guided product tour.
5. Simple how-it-works flow.
6. Security disclosure ecosystem logos.
7. Live Testnet workspace.
8. Network activity and receipts.
9. Security use cases and business model.
10. Product status.
11. Footer.

## Roadmap

### Milestone 1

Security impact proof workflow on Stellar Testnet.

### Milestone 2

Versioned circuit with cryptographically bound evidence commitments.

### Milestone 3

Complete server-side UltraHonk verification.

### Milestone 4

SEP-compatible wallet authentication.

### Milestone 5

Programme dashboards, verification credits and XLM settlement.

### Milestone 6

Additional circuits for:

* financial thresholds;
* solvency conditions;
* wallet control;
* reserve attestations;
* compliance policies;
* audit assertions;
* protocol-specific security rules.

## Why Stellar

ZeroSeal uses Stellar because it provides:

* fast transaction confirmation;
* low transaction costs;
* Soroban smart contracts;
* transparent public state;
* mature account infrastructure;
* wallet-authorised transactions;
* accessible Testnet tooling;
* independently inspectable explorer records.

The blockchain is used for public verification state and receipts. It is not used to store private vulnerability evidence.

## Intended users

ZeroSeal is designed for:

* independent security researchers;
* white hat researchers;
* audit firms;
* bug bounty programmes;
* protocol security teams;
* organisations that need privacy-preserving claim verification.

ZeroSeal is designed to complement security disclosure workflows used across platforms and communities such as Immunefi, Sherlock, Code4rena, Cantina, Hats Finance and CodeHawks.

ZeroSeal is an independent project and is not affiliated with or endorsed by these organisations.

## Responsible use

ZeroSeal is intended for authorised security research, responsible disclosure and approved verification workflows.

Do not use this project to:

* exploit live systems;
* access private user information;
* submit unauthorised transactions;
* misrepresent vulnerability impact;
* fabricate blockchain evidence;
* expose private keys or seed phrases.

## Live application

Visit:

https://zeroseal.vercel.app

Connect Freighter on Stellar Testnet, inspect the proof workflow and follow confirmed transactions through the explorer links exposed by the application.

## Licence

See the repository licence for permitted use and distribution terms.

