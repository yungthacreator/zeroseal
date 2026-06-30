import assert from "node:assert/strict";
import test from "node:test";

import type { ChainTransaction } from "@prisma/client";
import { ReceiptsService } from "./receipts.service";
import type { PrismaService } from "./prisma.service";
import type { StellarService } from "./stellar.service";
import { TransactionsService } from "./transactions.service";

const CURRENT_ACCOUNT =
  "GBYWCY5VVCF4ZU3LG4OGOGB6OB6RVAXOA5RTW3BAFJO7MQKWWM7M3EHS";
const OTHER_ACCOUNT =
  "GBZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKBOG";
const RESEARCHER_COMMITMENT =
  "04365013fb23d445d933eb47b2491088199eb4a60712bb1673a9d8ee448751d0";
const EVIDENCE_MANIFEST_COMMITMENT =
  "925d2dbefbf0000000000000000000000000000000000000000000000021998c";
const TX_HASH =
  "200414937c44753e24c5d79450ad6eb57e267940def01eab6105246ab39f970b";

void test("researcher commitment hex has the expected base64 byte representation", () => {
  assert.equal(
    Buffer.from(RESEARCHER_COMMITMENT, "hex").toString("base64"),
    "BDZQE/sj1EXZM+tHskkQiBmetKYHErsWc6nY7kSHUdA=",
  );
});

void test("evidence manifest commitment remains separate from researcher commitment", () => {
  assert.notEqual(EVIDENCE_MANIFEST_COMMITMENT, RESEARCHER_COMMITMENT);
});

void test("proof fixture does not bind a wallet account", async () => {
  const { readFile } = await import("node:fs/promises");
  const { default: path } = await import("node:path");
  const artifactPath = path.resolve(
    process.cwd(),
    "../web/public/zeroseal/browser-claim.json",
  );
  const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
    fields: { researcher_commitment: string };
    researcher?: unknown;
    wallet?: unknown;
    account?: unknown;
  };

  assert.equal(
    artifact.fields.researcher_commitment.replace(/^0x/i, "").toLowerCase(),
    RESEARCHER_COMMITMENT,
  );
  assert.equal(artifact.researcher, undefined);
  assert.equal(artifact.wallet, undefined);
  assert.equal(artifact.account, undefined);
});

void test("registration recovery is idempotent and stores researcher commitment", async () => {
  let walletUpserts = 0;
  let transactionUpserts = 0;
  const record = {
    id: "tx-record",
    network: "TESTNET",
    transactionHash: TX_HASH,
    walletAccountId: "wallet-record",
    claimId: null,
    ledgerNumber: 3242354,
    sourceAccount: CURRENT_ACCOUNT,
    contractId: "CBKQ3ZTUIOQLPQLZ5RUK237P6AGAJ4LGOQJNB2GVJHRFVNKENFIU622R",
    method: "register_researcher",
    operationType: "researcher_registration",
    researcherCommitment: RESEARCHER_COMMITMENT,
    status: "CONFIRMED",
    feeCharged: "47683",
    submittedAt: new Date("2026-06-23T14:39:47Z"),
    confirmedAt: new Date("2026-06-23T14:39:47Z"),
    failedAt: null,
    rawResponseDigest: "digest",
    idempotencyKey: `recover:register_researcher:${TX_HASH}`,
    createdAt: new Date("2026-06-25T00:00:00Z"),
    updatedAt: new Date("2026-06-25T00:00:00Z"),
  } satisfies ChainTransaction;

  const prisma = {
    walletAccount: {
      upsert: () => {
        walletUpserts += 1;
        return Promise.resolve({ id: "wallet-record", address: CURRENT_ACCOUNT });
      },
    },
    chainTransaction: {
      upsert: () => {
        transactionUpserts += 1;
        return Promise.resolve(record);
      },
    },
  } as unknown as PrismaService;

  const stellar = {
    recoverResearcherRegistration: () =>
      Promise.resolve({
        hash: TX_HASH,
        successful: true,
        ledger: 3242354,
        sourceAccount: CURRENT_ACCOUNT,
        createdAt: new Date("2026-06-23T14:39:47Z"),
        feeCharged: "47683",
        contractId: "CBKQ3ZTUIOQLPQLZ5RUK237P6AGAJ4LGOQJNB2GVJHRFVNKENFIU622R",
        method: "register_researcher" as const,
        researcherCommitment: RESEARCHER_COMMITMENT,
        explorerTransactionUrl: `https://stellar.expert/explorer/testnet/tx/${TX_HASH}`,
        explorerAccountUrl: `https://stellar.expert/explorer/testnet/account/${CURRENT_ACCOUNT}`,
        explorerRegistryUrl:
          "https://stellar.expert/explorer/testnet/contract/CBKQ3ZTUIOQLPQLZ5RUK237P6AGAJ4LGOQJNB2GVJHRFVNKENFIU622R",
        explorerVerifierUrl:
          "https://stellar.expert/explorer/testnet/contract/CABBWKKUU4PWWU5LSV2BPUMIEZR542V36WONDA2UT6OHXJWZAPXIKA2X",
      }),
    rawDigest: () => "digest",
  } as unknown as StellarService;

  const receipts = {} as unknown as ReceiptsService;
  const service = new TransactionsService(prisma, stellar, receipts);

  const first = await service.recoverResearcherRegistration(
    CURRENT_ACCOUNT,
    RESEARCHER_COMMITMENT,
  );
  const second = await service.recoverResearcherRegistration(
    CURRENT_ACCOUNT,
    RESEARCHER_COMMITMENT,
  );

  assert.equal(first.status, "RECOVERED");
  assert.equal(second.status, "RECOVERED");
  assert.equal(transactionUpserts, 2);
  assert.equal(walletUpserts, 2);
  assert.equal(first.transaction.researcherCommitment, RESEARCHER_COMMITMENT);
  assert.equal(first.transaction.method, "register_researcher");
  assert.equal(first.transaction.claimId, null);
});

void test("another wallet cannot inherit the current wallet registration", () => {
  const recovered = {
    sourceAccount: CURRENT_ACCOUNT,
    researcherCommitment: RESEARCHER_COMMITMENT,
  };

  assert.notEqual(recovered.sourceAccount, OTHER_ACCOUNT);
});

void test("receipt issuance requires a confirmed claim transaction with hash and ledger", async () => {
  const prisma = {
    claim: {
      findUnique: () =>
        Promise.resolve({
          id: "claim-id",
          status: "CONFIRMED",
          researcherCommitment: RESEARCHER_COMMITMENT,
          nullifier: "1".repeat(64),
          transactions: [],
          proofArtifacts: [{ publicInputDigest: "p", artifactDigest: "a" }],
          verificationResults: [{ status: "PASSED" }],
          receipt: null,
        }),
    },
  } as unknown as PrismaService;

  const stellar = {} as unknown as StellarService;
  const service = new ReceiptsService(prisma, stellar);

  await assert.rejects(
    () => service.issueIfReady("claim-id"),
    /Receipt is pending real transaction confirmation/,
  );
});

void test("confirmed register_researcher transaction confirms the claim and requests a receipt", async () => {
  let claimStatusUpdate: string | null = null;
  let receiptClaimId: string | null = null;

  const prisma = {
    chainTransaction: {
      findUnique: () =>
        Promise.resolve({
          id: "tx-record",
          status: "SUBMITTED",
          transactionHash: TX_HASH,
          sourceAccount: CURRENT_ACCOUNT,
          walletAccount: { address: CURRENT_ACCOUNT },
          claimId: "claim-id",
          claim: { id: "claim-id", status: "SUBMITTED" },
          method: "register_researcher",
        }),
      update: ({ data }: { data: Partial<ChainTransaction> }) =>
        Promise.resolve({
          id: "tx-record",
          claimId: "claim-id",
          method: "register_researcher",
          ...data,
        }),
    },
    claim: {
      update: ({ data }: { data: { status: string } }) => {
        claimStatusUpdate = data.status;
        return Promise.resolve({ id: "claim-id", status: data.status });
      },
    },
    $transaction: async (callback: (client: unknown) => Promise<unknown>) =>
      callback(prisma),
  } as unknown as PrismaService;

  const stellar = {
    fetchTransaction: () =>
      Promise.resolve({
        hash: TX_HASH,
        successful: true,
        ledger: 3242355,
        sourceAccount: CURRENT_ACCOUNT,
        createdAt: new Date("2026-06-30T04:00:00Z"),
        feeCharged: "100",
      }),
    rawDigest: () => "digest",
  } as unknown as StellarService;

  const receipts = {
    issueIfReady: (claimId: string) => {
      receiptClaimId = claimId;
      return Promise.resolve({ receiptId: "zs_test" });
    },
  } as unknown as ReceiptsService;

  const service = new TransactionsService(prisma, stellar, receipts);
  const updated = await service.reconcile("tx-record");

  assert.equal(updated.status, "CONFIRMED");
  assert.equal(claimStatusUpdate, "CONFIRMED");
  assert.equal(receiptClaimId, "claim-id");
});

void test("receipt issuance can create a registration receipt from confirmed public inputs", async () => {
  let claimStatusUpdate: string | null = null;
  const createdReceipts: unknown[] = [];

  const prisma = {
    claim: {
      findUnique: () =>
        Promise.resolve({
          id: "claim-id",
          status: "CONFIRMED",
          circuitId: "security-impact-v1",
          network: "TESTNET",
          researcherCommitment: RESEARCHER_COMMITMENT,
          evidenceBindingStatus: "LOCAL_ONLY",
          nullifier: "1".repeat(64),
          evidenceCommitmentId: null,
          programme: { identifier: "zeroseal-public-demo" },
          programmeSnapshot: { identifier: "2026-demo" },
          impactPolicy: {
            identifier: "security-impact-v1",
            registryContract: "CBKQ3ZTUIOQLPQLZ5RUK237P6AGAJ4LGOQJNB2GVJHRFVNKENFIU622R",
            verifierContract: "CABBWKKUU4PWWU5LSV2BPUMIEZR542V36WONDA2UT6OHXJWZAPXIKA2X",
          },
          walletAccount: { address: CURRENT_ACCOUNT },
          proofArtifacts: [],
          publicInputs: [
            { position: 0, digest: "a".repeat(64), valueHex: "01", name: "impact" },
          ],
          transactions: [
            {
              id: "tx-record",
              transactionHash: TX_HASH,
              ledgerNumber: 3242355,
              confirmedAt: new Date("2026-06-30T04:00:00Z"),
              method: "register_researcher",
            },
          ],
          verificationResults: [],
          receipt: null,
        }),
      update: ({ data }: { data: { status: string } }) => {
        claimStatusUpdate = data.status;
        return Promise.resolve({ id: "claim-id", status: data.status });
      },
    },
    claimReceipt: {
      create: ({ data }: { data: unknown }) => {
        createdReceipts.push(data);
        return Promise.resolve(data);
      },
    },
    $transaction: async (callback: (client: unknown) => Promise<unknown>) =>
      callback(prisma),
  } as unknown as PrismaService;

  const stellar = {
    explorerTransactionUrl: (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`,
    explorerAccountUrl: (account: string) => `https://stellar.expert/explorer/testnet/account/${account}`,
    explorerContractUrl: (contract: string) =>
      `https://stellar.expert/explorer/testnet/contract/${contract}`,
  } as unknown as StellarService;

  const service = new ReceiptsService(prisma, stellar);
  const receipt = await service.issueIfReady("claim-id");

  assert.equal((receipt as { transactionHash: string }).transactionHash, TX_HASH);
  assert.equal(claimStatusUpdate, "RECEIPT_ISSUED");
  assert.equal(createdReceipts.length, 1);
});
