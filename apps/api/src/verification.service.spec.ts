import assert from "node:assert/strict";
import test from "node:test";

import { ChainTransactionStatus } from "@prisma/client";
import { ApiError } from "./common";
import type { ClaimsService } from "./claims.service";
import type { ReceiptsService } from "./receipts.service";
import type { StellarService } from "./stellar.service";
import type { TransactionsService } from "./transactions.service";
import { VerificationService } from "./verification.service";

const RECEIPT_ID = "zs_9f4c17af-8aae-4c4a-bebf-55c3c2d33f16";
const CLAIM_ID = "7c70acef-34b6-47e3-9605-345c6829c2d9";
const TX_HASH =
  "1a1ffe25af3d34d880c501bac8e98255d0ca89e48753993c3facd6e2bb3cd38c";
const LEDGER = 3377274;
const WALLET =
  "GBYWCY5VVCF4ZU3LG4OGOGB6OB6RVAXOA5RTW3BAFJO7MQKWWM7M3EHS";

const RECEIPT = {
  receiptId: RECEIPT_ID,
  claimId: CLAIM_ID,
  transactionHash: TX_HASH,
  ledgerNumber: LEDGER,
  registryContract: "CD6MKUVXB7ZTZQCGNMBVHMU4PGT2SEKS6Z5LF53HXDOAVCO3LGKGQ3JU",
  verifierContract: "CABBWKKUU4PWWU5LSV2BPUMIEZR542V36WONDA2UT6OHXJWZAPXIKA2X",
  network: "TESTNET",
  walletAddress: WALLET,
  researcherCommitment:
    "73fea8bfb67ac8c6a2bac808316c2750331983290be5e4e488e62361f8090b3b",
  claimCommitment:
    "cfa8caa9feef6e035354b47763dc50d1ffd7beefc63a6ced135a6f97dff2b980",
  nullifier: "0da1e0e0056857609cc20523e06ceb6a9a76304b6141f9c0c10a23c5bd2cd739",
  policyIdentifier: "security-impact-v1",
  issuedAt: new Date("2026-07-01T09:00:00Z").toISOString(),
  explorerTransactionUrl: `https://stellar.expert/explorer/testnet/tx/${TX_HASH}`,
  explorerAccountUrl: `https://stellar.expert/explorer/testnet/account/${WALLET}`,
  explorerRegistryUrl:
    "https://stellar.expert/explorer/testnet/contract/CD6MKUVXB7ZTZQCGNMBVHMU4PGT2SEKS6Z5LF53HXDOAVCO3LGKGQ3JU",
  explorerVerifierUrl:
    "https://stellar.expert/explorer/testnet/contract/CABBWKKUU4PWWU5LSV2BPUMIEZR542V36WONDA2UT6OHXJWZAPXIKA2X",
};

const TRANSACTION = {
  id: "0b3526ee-e096-474d-9b2f-7cc77cad84dc",
  transactionHash: TX_HASH,
  status: ChainTransactionStatus.CONFIRMED,
  ledgerNumber: LEDGER,
  sourceAccount: WALLET,
  contractId: RECEIPT.registryContract,
  method: "submit_claim",
  researcherCommitment: RECEIPT.researcherCommitment,
  confirmedAt: new Date("2026-07-01T09:00:00Z"),
};

function createVerificationService() {
  const calls: string[] = [];
  const receipts = {
    contextName: "receipts",
    getByIdentifier(identifier: string) {
      assert.equal(this.contextName, "receipts");
      calls.push(`receipt:${identifier}`);
      if ([RECEIPT_ID, CLAIM_ID, TX_HASH].includes(identifier)) {
        return Promise.resolve(RECEIPT);
      }
      throw new ApiError("RECEIPT_NOT_FOUND", "Receipt not found.", 404);
    },
  };
  const claims = {
    contextName: "claims",
    getClaim(identifier: string) {
      assert.equal(this.contextName, "claims");
      calls.push(`claim:${identifier}`);
      if (identifier !== CLAIM_ID) {
        throw new ApiError("CLAIM_NOT_FOUND", "Claim not found.", 404);
      }
      return Promise.resolve({
        id: CLAIM_ID,
        status: "RECEIPT_ISSUED",
        transactions: [TRANSACTION],
      });
    },
  };
  const transactions = {
    contextName: "transactions",
    getTransaction(identifier: string) {
      assert.equal(this.contextName, "transactions");
      calls.push(`transaction:${identifier}`);
      if (identifier !== TX_HASH) {
        throw new ApiError("TRANSACTION_NOT_FOUND", "Transaction not found.", 404);
      }
      return Promise.resolve(TRANSACTION);
    },
  };
  const stellar = {
    fetchTransaction(hash: string) {
      calls.push(`chain:${hash}`);
      if (hash !== TX_HASH) {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        hash: TX_HASH,
        successful: true,
        ledger: LEDGER,
        sourceAccount: WALLET,
        createdAt: new Date("2026-07-01T09:00:00Z"),
        feeCharged: "100",
      });
    },
  };

  return {
    calls,
    service: new VerificationService(
      claims as unknown as ClaimsService,
      receipts as unknown as ReceiptsService,
      transactions as unknown as TransactionsService,
      stellar as unknown as StellarService,
    ),
  };
}

async function assertVerifiedSameReceipt(identifier: string) {
  const { service } = createVerificationService();
  const result = await service.verify(identifier);

  assert.equal(result.status, "VERIFIED");
  assert.equal(result.receipt?.receiptId, RECEIPT_ID);
  assert.equal(result.receipt?.claimId, CLAIM_ID);
  assert.equal(result.receipt?.transactionHash, TX_HASH);
  assert.equal(result.receipt?.ledgerNumber, LEDGER);
  return result;
}

void test("receipt resolver preserves the receipt service context", async () => {
  const { calls, service } = createVerificationService();

  await service.verify(RECEIPT_ID);

  assert.deepEqual(calls, [`receipt:${RECEIPT_ID}`, `chain:${TX_HASH}`]);
});

void test("claim resolver preserves the claim service context", async () => {
  const { calls, service } = createVerificationService();

  await service.verify(CLAIM_ID);

  assert.deepEqual(calls, [`claim:${CLAIM_ID}`, `receipt:${CLAIM_ID}`, `chain:${TX_HASH}`]);
});

void test("transaction resolver preserves the transaction service context", async () => {
  const { calls, service } = createVerificationService();

  await service.verify(TX_HASH);

  assert.deepEqual(calls, [`transaction:${TX_HASH}`, `chain:${TX_HASH}`, `receipt:${TX_HASH}`]);
});

void test("verify by receipt ID returns VERIFIED", async () => {
  await assertVerifiedSameReceipt(RECEIPT_ID);
});

void test("verify by claim ID returns VERIFIED", async () => {
  await assertVerifiedSameReceipt(CLAIM_ID);
});

void test("verify by transaction hash returns VERIFIED", async () => {
  await assertVerifiedSameReceipt(TX_HASH);
});

void test("missing chain ledger does not create a false receipt mismatch", async () => {
  const { service } = createVerificationService();
  const stellar = (service as unknown as { stellar: StellarService }).stellar as unknown as {
    fetchTransaction: (hash: string) => Promise<unknown>;
  };
  stellar.fetchTransaction = () =>
    Promise.resolve({
      hash: TX_HASH,
      successful: true,
      ledger: null,
      sourceAccount: WALLET,
      createdAt: new Date("2026-07-01T09:00:00Z"),
      feeCharged: "100",
    });

  const result = await service.verify(TX_HASH);

  assert.equal(result.status, "VERIFIED");
  assert.equal(result.receipt?.ledgerNumber, LEDGER);
});

void test("all verification identifiers return the same receipt", async () => {
  const byReceipt = await assertVerifiedSameReceipt(RECEIPT_ID);
  const byClaim = await assertVerifiedSameReceipt(CLAIM_ID);
  const byTransaction = await assertVerifiedSameReceipt(TX_HASH);

  assert.deepEqual(byReceipt.receipt, byClaim.receipt);
  assert.deepEqual(byReceipt.receipt, byTransaction.receipt);
});

void test("no identifier causes undefined Prisma delegate access", async () => {
  const { service } = createVerificationService();

  await assert.doesNotReject(() => service.verify(RECEIPT_ID));
  await assert.doesNotReject(() => service.verify(CLAIM_ID));
  await assert.doesNotReject(() => service.verify(TX_HASH));
});

void test("unknown identifiers return controlled 404 state, not 500", async () => {
  const { service } = createVerificationService();

  await assert.rejects(
    () => service.verify("11111111-1111-4111-8111-111111111111"),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 404 &&
      error.code === "CLAIM_NOT_FOUND",
  );
});
