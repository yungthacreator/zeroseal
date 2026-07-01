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
const SUCCESSFUL_SUBMIT_CLAIM_HASH =
  "1a1ffe25af3d34d880c501bac8e98255d0ca89e48753993c3facd6e2bb3cd38c";
const SUCCESSFUL_SUBMIT_CLAIM_LEDGER = 3377274;
const SUCCESSFUL_SUBMIT_CLAIM_CONTRACT =
  "CD6MKUVXB7ZTZQCGNMBVHMU4PGT2SEKS6Z5LF53HXDOAVCO3LGKGQ3JU";
const SUCCESSFUL_SUBMIT_CLAIM_RESEARCHER_COMMITMENT =
  "73fea8bfb67ac8c6a2bac808316c2750331983290be5e4e488e62361f8090b3b";
const SUCCESSFUL_SUBMIT_CLAIM_COMMITMENT =
  "cfa8caa9feef6e035354b47763dc50d1ffd7beefc63a6ced135a6f97dff2b980";
const SUCCESSFUL_SUBMIT_CLAIM_NULLIFIER =
  "0da1e0e0056857609cc20523e06ceb6a9a76304b6141f9c0c10a23c5bd2cd739";

void test("researcher commitment hex has the expected base64 byte representation", () => {
  assert.equal(
    Buffer.from(RESEARCHER_COMMITMENT, "hex").toString("base64"),
    "BDZQE/sj1EXZM+tHskkQiBmetKYHErsWc6nY7kSHUdA=",
  );
});

void test("evidence manifest commitment remains separate from researcher commitment", () => {
  assert.notEqual(EVIDENCE_MANIFEST_COMMITMENT, RESEARCHER_COMMITMENT);
});

void test("public claim fixture does not bind a wallet account", async () => {
  const { readFile } = await import("node:fs/promises");
  const { default: path } = await import("node:path");
  const artifactPath = path.resolve(
    process.cwd(),
    "../web/public/zeroseal/browser-claim.json",
  );
  const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
    arguments: { researcher_commitment: string; researcher: string };
    researcher?: unknown;
    wallet?: unknown;
    account?: unknown;
  };

  assert.equal(
    artifact.arguments.researcher_commitment.replace(/^0x/i, "").toLowerCase(),
    RESEARCHER_COMMITMENT,
  );
  assert.equal(artifact.arguments.researcher, "connected Freighter wallet address");
  assert.equal(artifact.researcher, undefined);
  assert.equal(artifact.wallet, undefined);
  assert.equal(artifact.account, undefined);
});

void test("submit_claim recovery is idempotent and stores public commitments", async () => {
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
    contractId: "CD6MKUVXB7ZTZQCGNMBVHMU4PGT2SEKS6Z5LF53HXDOAVCO3LGKGQ3JU",
    method: "submit_claim",
    operationType: "claim_submission",
    researcherCommitment: RESEARCHER_COMMITMENT,
    claimCommitment: "1".repeat(64),
    nullifier: "2".repeat(64),
    status: "CONFIRMED",
    feeCharged: "47683",
    submittedAt: new Date("2026-06-23T14:39:47Z"),
    confirmedAt: new Date("2026-06-23T14:39:47Z"),
    failedAt: null,
    rawResponseDigest: "digest",
    idempotencyKey: `recover:submit_claim:${TX_HASH}`,
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
    recoverSubmitClaim: () =>
      Promise.resolve({
        hash: TX_HASH,
        successful: true,
        ledger: 3242354,
        sourceAccount: CURRENT_ACCOUNT,
        createdAt: new Date("2026-06-23T14:39:47Z"),
        feeCharged: "47683",
        contractId: "CD6MKUVXB7ZTZQCGNMBVHMU4PGT2SEKS6Z5LF53HXDOAVCO3LGKGQ3JU",
        method: "submit_claim" as const,
        researcher: CURRENT_ACCOUNT,
        researcherCommitment: RESEARCHER_COMMITMENT,
        claimCommitment: "1".repeat(64),
        nullifier: "2".repeat(64),
        explorerTransactionUrl: `https://stellar.expert/explorer/testnet/tx/${TX_HASH}`,
        explorerAccountUrl: `https://stellar.expert/explorer/testnet/account/${CURRENT_ACCOUNT}`,
        explorerRegistryUrl:
          "https://stellar.expert/explorer/testnet/contract/CD6MKUVXB7ZTZQCGNMBVHMU4PGT2SEKS6Z5LF53HXDOAVCO3LGKGQ3JU",
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
  assert.equal(first.transaction.method, "submit_claim");
  assert.equal(first.transaction.claimId, null);
});

void test("another wallet cannot inherit the current wallet registration", () => {
  const recovered = {
    sourceAccount: CURRENT_ACCOUNT,
    researcherCommitment: RESEARCHER_COMMITMENT,
  };

  assert.notEqual(recovered.sourceAccount, OTHER_ACCOUNT);
});

void test("exact successful submit_claim hash reconciles to one claim receipt with public commitments", async () => {
  const createdClaims: Array<Record<string, unknown>> = [];
  const publicInputs: Array<Record<string, unknown>> = [];
  const transactions: Array<Record<string, unknown>> = [];
  let receiptIssueCount = 0;

  const policy = {
    id: "policy-id",
    programmeId: "programme-id",
    identifier: "published-impact-threshold-v1",
    circuitId: "security-impact-v1",
    registryContract: SUCCESSFUL_SUBMIT_CLAIM_CONTRACT,
    verifierContract: "CABBWKKUU4PWWU5LSV2BPUMIEZR542V36WONDA2UT6OHXJWZAPXIKA2X",
    programme: { identifier: "zeroseal-security-impact-testnet" },
  };
  const snapshot = { id: "snapshot-id", identifier: "security-impact-testnet-v1" };

  const prisma = {
    impactPolicy: {
      findFirstOrThrow: () => Promise.resolve(policy),
    },
    programmeSnapshot: {
      findFirstOrThrow: () => Promise.resolve(snapshot),
    },
    walletAccount: {
      upsert: () =>
        Promise.resolve({
          id: "wallet-id",
          address: CURRENT_ACCOUNT,
          network: "TESTNET",
        }),
    },
    claim: {
      findFirst: () =>
        Promise.resolve(
          createdClaims[0]
            ? {
                ...createdClaims[0],
                walletAccount: { address: CURRENT_ACCOUNT },
                publicInputs: publicInputs.map((input) => ({ ...input })),
              }
            : null,
        ),
      create: ({ data }: { data: Record<string, unknown> }) => {
        const claim = {
          id: "claim-id",
          ...data,
        };
        createdClaims.push(claim);
        return Promise.resolve(claim);
      },
      update: ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(createdClaims[0], data);
        return Promise.resolve(createdClaims[0]);
      },
    },
    claimPublicInput: {
      deleteMany: () => {
        publicInputs.splice(0, publicInputs.length);
        return Promise.resolve({ count: 0 });
      },
      createMany: ({ data }: { data: Array<Record<string, unknown>> }) => {
        publicInputs.push(...data);
        return Promise.resolve({ count: data.length });
      },
    },
    chainTransaction: {
      upsert: ({ update, create }: { update: Record<string, unknown>; create: Record<string, unknown> }) => {
        const existing = transactions.find(
          (transaction) =>
            transaction.transactionHash === SUCCESSFUL_SUBMIT_CLAIM_HASH,
        );
        if (existing) {
          Object.assign(existing, update);
          return Promise.resolve(existing);
        }
        const transaction = { id: "transaction-id", ...create };
        transactions.push(transaction);
        return Promise.resolve(transaction);
      },
    },
    $transaction: async (callback: (client: unknown) => Promise<unknown>) =>
      callback(prisma),
  } as unknown as PrismaService;

  const stellar = {
    validateTransactionHash: (hash: string) => hash.toLowerCase(),
    fetchSubmitClaimInvocation: () =>
      Promise.resolve({
        hash: SUCCESSFUL_SUBMIT_CLAIM_HASH,
        successful: true,
        ledger: SUCCESSFUL_SUBMIT_CLAIM_LEDGER,
        sourceAccount: CURRENT_ACCOUNT,
        createdAt: new Date("2026-07-01T10:18:06.000Z"),
        feeCharged: "100",
        contractId: SUCCESSFUL_SUBMIT_CLAIM_CONTRACT,
        method: "submit_claim" as const,
        researcher: CURRENT_ACCOUNT,
        researcherCommitment: SUCCESSFUL_SUBMIT_CLAIM_RESEARCHER_COMMITMENT,
        claimCommitment: SUCCESSFUL_SUBMIT_CLAIM_COMMITMENT,
        nullifier: SUCCESSFUL_SUBMIT_CLAIM_NULLIFIER,
        explorerTransactionUrl: `https://stellar.expert/explorer/testnet/tx/${SUCCESSFUL_SUBMIT_CLAIM_HASH}`,
        explorerAccountUrl: `https://stellar.expert/explorer/testnet/account/${CURRENT_ACCOUNT}`,
        explorerRegistryUrl: `https://stellar.expert/explorer/testnet/contract/${SUCCESSFUL_SUBMIT_CLAIM_CONTRACT}`,
        explorerVerifierUrl:
          "https://stellar.expert/explorer/testnet/contract/CABBWKKUU4PWWU5LSV2BPUMIEZR542V36WONDA2UT6OHXJWZAPXIKA2X",
      }),
    rawDigest: () => "digest",
  } as unknown as StellarService;

  const receipts = {
    issueIfReady: (claimId: string) => {
      receiptIssueCount += 1;
      return Promise.resolve({
        receiptId: "zs_receipt",
        claimId,
        transactionHash: SUCCESSFUL_SUBMIT_CLAIM_HASH,
        ledgerNumber: SUCCESSFUL_SUBMIT_CLAIM_LEDGER,
      });
    },
  } as unknown as ReceiptsService;

  const service = new TransactionsService(prisma, stellar, receipts);
  const first = await (service as unknown as {
    reconcileSubmitClaimHash: (hash: string) => Promise<{
      status: string;
      claim: { id: string };
      receipt: { receiptId: string };
    }>;
  }).reconcileSubmitClaimHash(SUCCESSFUL_SUBMIT_CLAIM_HASH);
  const second = await (service as unknown as {
    reconcileSubmitClaimHash: (hash: string) => Promise<{ receipt: { receiptId: string } }>;
  }).reconcileSubmitClaimHash(SUCCESSFUL_SUBMIT_CLAIM_HASH);

  assert.equal(first.status, "RECONCILED");
  assert.equal(first.claim.id, "claim-id");
  assert.equal(first.receipt.receiptId, "zs_receipt");
  assert.equal(second.receipt.receiptId, "zs_receipt");
  assert.equal(createdClaims.length, 1);
  assert.equal(transactions.length, 1);
  assert.equal(receiptIssueCount, 2);
  assert.deepEqual(
    publicInputs.map((input) => [input.position, input.name, input.valueHex]),
    [
      [0, "researcher_commitment", SUCCESSFUL_SUBMIT_CLAIM_RESEARCHER_COMMITMENT],
      [1, "claim_commitment", SUCCESSFUL_SUBMIT_CLAIM_COMMITMENT],
      [2, "nullifier", SUCCESSFUL_SUBMIT_CLAIM_NULLIFIER],
    ],
  );
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

void test("confirmed submit_claim transaction confirms the claim and requests a receipt", async () => {
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
          method: "submit_claim",
        }),
      update: ({ data }: { data: Partial<ChainTransaction> }) =>
        Promise.resolve({
          id: "tx-record",
          claimId: "claim-id",
          method: "submit_claim",
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

void test("receipt issuance can create a claim submission receipt from confirmed public inputs", async () => {
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
            registryContract: "CD6MKUVXB7ZTZQCGNMBVHMU4PGT2SEKS6Z5LF53HXDOAVCO3LGKGQ3JU",
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
              method: "submit_claim",
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

void test("receipt lookup resolves by transaction hash and includes claim commitment", async () => {
  const receipt = {
    receiptId: "zs_receipt",
    claimId: "claim-id",
    transactionHash: SUCCESSFUL_SUBMIT_CLAIM_HASH,
    ledgerNumber: SUCCESSFUL_SUBMIT_CLAIM_LEDGER,
    registryContract: SUCCESSFUL_SUBMIT_CLAIM_CONTRACT,
    verifierContract: "CABBWKKUU4PWWU5LSV2BPUMIEZR542V36WONDA2UT6OHXJWZAPXIKA2X",
    network: "TESTNET",
    walletAddress: CURRENT_ACCOUNT,
    researcherCommitment: SUCCESSFUL_SUBMIT_CLAIM_RESEARCHER_COMMITMENT,
    nullifier: SUCCESSFUL_SUBMIT_CLAIM_NULLIFIER,
    policyIdentifier: "published-impact-threshold-v1",
    issuedAt: new Date("2026-07-01T10:18:30.000Z"),
    explorerTransactionUrl: `https://stellar.expert/explorer/testnet/tx/${SUCCESSFUL_SUBMIT_CLAIM_HASH}`,
    explorerAccountUrl: `https://stellar.expert/explorer/testnet/account/${CURRENT_ACCOUNT}`,
    explorerRegistryUrl: `https://stellar.expert/explorer/testnet/contract/${SUCCESSFUL_SUBMIT_CLAIM_CONTRACT}`,
    explorerVerifierUrl:
      "https://stellar.expert/explorer/testnet/contract/CABBWKKUU4PWWU5LSV2BPUMIEZR542V36WONDA2UT6OHXJWZAPXIKA2X",
    claim: {
      publicInputs: [
        {
          name: "claim_commitment",
          valueHex: SUCCESSFUL_SUBMIT_CLAIM_COMMITMENT,
        },
      ],
    },
  };
  const prisma = {
    claimReceipt: {
      findFirst: ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          JSON.stringify(where).includes(SUCCESSFUL_SUBMIT_CLAIM_HASH)
            ? receipt
            : null,
        ),
    },
  } as unknown as PrismaService;

  const service = new ReceiptsService(prisma, {} as unknown as StellarService);
  const resolved = await (service as unknown as {
    getByIdentifier: (identifier: string) => Promise<{ claimCommitment: string }>;
  }).getByIdentifier(SUCCESSFUL_SUBMIT_CLAIM_HASH);

  assert.equal(resolved.claimCommitment, SUCCESSFUL_SUBMIT_CLAIM_COMMITMENT);
});

void test("receipt ID lookup never queries UUID fields", async () => {
  let findFirstCalled = false;
  let findUniqueWhere: unknown = null;
  const prisma = {
    claimReceipt: {
      findUnique: ({ where }: { where: unknown }) => {
        findUniqueWhere = where;
        return Promise.resolve({
          receiptId: "zs_9f4c17af-8aae-4c4a-bebf-55c3c2d33f16",
          claimId: "7c70acef-34b6-47e3-9605-345c6829c2d9",
          transactionHash: SUCCESSFUL_SUBMIT_CLAIM_HASH,
          ledgerNumber: SUCCESSFUL_SUBMIT_CLAIM_LEDGER,
          registryContract: SUCCESSFUL_SUBMIT_CLAIM_CONTRACT,
          verifierContract: "CABBWKKUU4PWWU5LSV2BPUMIEZR542V36WONDA2UT6OHXJWZAPXIKA2X",
          network: "TESTNET",
          walletAddress: CURRENT_ACCOUNT,
          researcherCommitment: SUCCESSFUL_SUBMIT_CLAIM_RESEARCHER_COMMITMENT,
          nullifier: SUCCESSFUL_SUBMIT_CLAIM_NULLIFIER,
          policyIdentifier: "published-impact-threshold-v1",
          issuedAt: new Date("2026-07-01T10:18:30.000Z"),
          explorerTransactionUrl: `https://stellar.expert/explorer/testnet/tx/${SUCCESSFUL_SUBMIT_CLAIM_HASH}`,
          explorerAccountUrl: `https://stellar.expert/explorer/testnet/account/${CURRENT_ACCOUNT}`,
          explorerRegistryUrl: `https://stellar.expert/explorer/testnet/contract/${SUCCESSFUL_SUBMIT_CLAIM_CONTRACT}`,
          explorerVerifierUrl:
            "https://stellar.expert/explorer/testnet/contract/CABBWKKUU4PWWU5LSV2BPUMIEZR542V36WONDA2UT6OHXJWZAPXIKA2X",
          claim: { publicInputs: [] },
          transaction: { method: "submit_claim", status: "CONFIRMED" },
        });
      },
      findFirst: () => {
        findFirstCalled = true;
        return Promise.resolve(null);
      },
    },
  } as unknown as PrismaService;

  const service = new ReceiptsService(prisma, {} as unknown as StellarService);
  await service.getByIdentifier("zs_9f4c17af-8aae-4c4a-bebf-55c3c2d33f16");

  assert.equal(findFirstCalled, false);
  assert.deepEqual(findUniqueWhere, {
    receiptId: "zs_9f4c17af-8aae-4c4a-bebf-55c3c2d33f16",
  });
});

void test("transaction hash receipt lookup never queries UUID fields", async () => {
  let findFirstWhere: unknown = null;
  const prisma = {
    claimReceipt: {
      findFirst: ({ where }: { where: unknown }) => {
        findFirstWhere = where;
        return Promise.resolve(null);
      },
    },
  } as unknown as PrismaService;

  const service = new ReceiptsService(prisma, {} as unknown as StellarService);
  await assert.rejects(
    () => service.getByIdentifier(SUCCESSFUL_SUBMIT_CLAIM_HASH.toUpperCase()),
    /Receipt not found/,
  );

  assert.deepEqual(findFirstWhere, {
    transactionHash: SUCCESSFUL_SUBMIT_CLAIM_HASH,
  });
});

void test("malformed receipt identifier returns controlled error", async () => {
  const prisma = {
    claimReceipt: {
      findFirst: () => {
        throw new Error("should not query database");
      },
      findUnique: () => {
        throw new Error("should not query database");
      },
    },
  } as unknown as PrismaService;

  const service = new ReceiptsService(prisma, {} as unknown as StellarService);
  await assert.rejects(
    () => service.getByIdentifier("not-a-receipt"),
    /Enter a valid ZeroSeal receipt ID/,
  );
});

void test("public receipts list only issued submit_claim receipts", async () => {
  const prisma = {
    claimReceipt: {
      findMany: () =>
        Promise.resolve([
          {
            receiptId: "zs_receipt",
            claimId: "claim-id",
            transactionHash: SUCCESSFUL_SUBMIT_CLAIM_HASH,
            ledgerNumber: SUCCESSFUL_SUBMIT_CLAIM_LEDGER,
            registryContract: SUCCESSFUL_SUBMIT_CLAIM_CONTRACT,
            verifierContract: "CABBWKKUU4PWWU5LSV2BPUMIEZR542V36WONDA2UT6OHXJWZAPXIKA2X",
            network: "TESTNET",
            walletAddress: CURRENT_ACCOUNT,
            researcherCommitment: SUCCESSFUL_SUBMIT_CLAIM_RESEARCHER_COMMITMENT,
            nullifier: SUCCESSFUL_SUBMIT_CLAIM_NULLIFIER,
            policyIdentifier: "published-impact-threshold-v1",
            issuedAt: new Date("2026-07-01T10:18:30.000Z"),
            explorerTransactionUrl: `https://stellar.expert/explorer/testnet/tx/${SUCCESSFUL_SUBMIT_CLAIM_HASH}`,
            explorerAccountUrl: `https://stellar.expert/explorer/testnet/account/${CURRENT_ACCOUNT}`,
            explorerRegistryUrl: `https://stellar.expert/explorer/testnet/contract/${SUCCESSFUL_SUBMIT_CLAIM_CONTRACT}`,
            explorerVerifierUrl:
              "https://stellar.expert/explorer/testnet/contract/CABBWKKUU4PWWU5LSV2BPUMIEZR542V36WONDA2UT6OHXJWZAPXIKA2X",
            claim: {
              publicInputs: [
                {
                  name: "claim_commitment",
                  valueHex: SUCCESSFUL_SUBMIT_CLAIM_COMMITMENT,
                },
              ],
            },
            transaction: {
              method: "submit_claim",
              status: "CONFIRMED",
            },
          },
        ]),
    },
  } as unknown as PrismaService;

  const service = new ReceiptsService(prisma, {} as unknown as StellarService);
  const receipts = await (service as unknown as {
    listPublicReceipts: () => Promise<Array<{ actionLabel: string; transactionHash: string }>>;
  }).listPublicReceipts();

  assert.deepEqual(receipts.map((item) => item.actionLabel), ["Claim stamped"]);
  assert.equal(receipts[0].transactionHash, SUCCESSFUL_SUBMIT_CLAIM_HASH);
});
