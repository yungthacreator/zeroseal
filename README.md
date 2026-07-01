# ZeroSeal

Prove security impact. Keep private evidence private.

ZeroSeal is a privacy-first claim stamping and receipt verification layer for security researchers, bug bounty programmes, audit teams, protocols and disclosure workflows.

## What ZeroSeal Is

ZeroSeal lets a researcher prepare a security claim, keep sensitive evidence local and stamp only safe public commitments on Stellar Testnet. The result is a wallet-authorised receipt that can be checked later without exposing the raw report, proof of concept, notes, private files, salts or witness values.

## Why It Exists

Security disclosure often starts before trust is settled. Researchers need a way to show that a claim existed at a specific time. Programmes need a way to inspect a public record without receiving unpublished exploit detail too early. ZeroSeal provides timestamped, wallet-authorised, verifiable claim evidence and receipts.

ZeroSeal does not automatically resolve every dispute. It does not decide whether a vulnerability is valid, whether severity is correct, who found it first or whether a bounty must be paid.

## Current Testnet Capabilities

- Prepare a security claim in the browser.
- Keep raw reports, PoCs, notes, private files, reproduction steps, salts, witness values, secrets and unpublished exploit detail private.
- Create cryptographic commitments from the approved claim state.
- Review the exact public fields before stamping.
- Authorise a real Stellar Testnet `submit_claim` transaction with Freighter.
- Record researcher address, researcher commitment, claim commitment and nullifier in the Claim Registry.
- Reconcile a confirmed transaction into a ZeroSeal public receipt.
- Verify receipts by receipt ID, claim ID or transaction hash.
- Link each issued receipt to the confirmed Stellar transaction.

## Product Flow

1. Prepare report.
2. Add private evidence.
3. Generate private seal.
4. Review public claim.
5. Approve stamp.
6. Receive and verify receipt.

## What Remains Private

- Raw report.
- PoC.
- Notes.
- Private files.
- Reproduction steps.
- Salts.
- Witness values.
- Secrets.
- Unpublished exploit details.

## What Is Publicly Stamped

- Researcher wallet.
- Researcher commitment.
- Claim commitment.
- Nullifier.
- Registry contract.
- Method.
- Transaction hash.
- Ledger.
- Network.
- Public policy identifier.

## Duplicate and Replay Protection

ZeroSeal can prevent replay of the same nullifier and reject exact commitment reuse where enforced by the contract. It does not yet determine whether two differently written reports describe the same underlying vulnerability. Semantic duplicate analysis and programme dispute tooling are planned roadmap items.

## Receipt Verification

Receipts can be verified by:

- Receipt ID.
- Claim ID.
- Transaction hash.

The verification response checks ZeroSeal persistence and the confirmed Stellar Testnet transaction, then displays the receipt, ledger, wallet, registry contract, public commitments and Stellar Explorer link.

## Architecture

- Next.js frontend for claim preparation, public receipts, verification and public activity.
- NestJS API for claims, receipts, continuations, reconciliation and verification.
- PostgreSQL and Prisma for persistence.
- Soroban Claim Registry for `submit_claim`.
- Soroban verifier contract for the current verification surface.
- Freighter wallet for Stellar Testnet authorisation.
- UltraHonk proof preparation and structural proof handling where supported by the current workflow.
- Local private evidence handling in the browser.
- Backend receipt reconciliation after confirmed Stellar Testnet transactions.

Some receipt fields reflect the current Testnet workflow and may be expanded after further proof verification and security review.

## Stellar Testnet Contracts

Registry:

`CD6MKUVXB7ZTZQCGNMBVHMU4PGT2SEKS6Z5LF53HXDOAVCO3LGKGQ3JU`

Verifier:

`CABBWKKUU4PWWU5LSV2BPUMIEZR542V36WONDA2UT6OHXJWZAPXIKA2X`

Current confirmed regression receipt:

`zs_9f4c17af-8aae-4c4a-bebf-55c3c2d33f16`

## Local Development

Install dependencies:

```powershell
npm install
```

Start local infrastructure:

```powershell
docker compose -f docker-compose.dev.yml up -d
```

Generate Prisma client and apply migrations:

```powershell
npm.cmd --prefix apps/api run prisma:generate
npm.cmd --prefix apps/api exec prisma migrate deploy
```

Run the API:

```powershell
npm.cmd --prefix apps/api run dev
```

Run the web app:

```powershell
npm.cmd --prefix apps/web run dev
```

Required environment values include database, Redis, API URL, Stellar Testnet RPC and contract IDs. Do not commit real secrets or private keys.

## Roadmap

Planned items:

- Confidential Bounty Escrow.
- Confidential Reward Tokens.
- Programme API and SDK.
- Duplicate Claim Coordination.
- Stronger proof verification.
- Mainnet readiness after security review.

These roadmap items are not presented as live product capabilities.

## Security and Product Boundaries

ZeroSeal:

- Does not publish private evidence.
- Does not replace responsible disclosure.
- Does not determine vulnerability validity.
- Does not assign severity automatically.
- Does not guarantee bounty payment.
- Currently runs on Stellar Testnet.
- Must undergo further security review before mainnet use.

## Repository and Live Product

Repository:

`https://github.com/yungthacreator/zeroseal`

Use a production URL only after the deployed frontend and API are confirmed working together.
