import assert from "node:assert/strict";
import test from "node:test";

import {
  Account,
  BASE_FEE,
  Keypair,
  nativeToScVal,
  Networks,
  Operation,
  SorobanDataBuilder,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

import {
  signPreparedXdr,
  signSdkPreparedSubmitClaim,
  signedTransactionMessage,
  type PreparedReview,
} from "./claim-wizard";
import { DEFAULT_REGISTRY_CONTRACT_ID } from "../lib/stellar/config";
import { submitSignedXdr } from "../lib/stellar/submit-transaction";

const TESTNET_ACCOUNT =
  "GBYWCY5VVCF4ZU3LG4OGOGB6OB6RVAXOA5RTW3BAFJO7MQKWWM7M3EHS";
const RESEARCHER_COMMITMENT = "01".repeat(32);
const CLAIM_COMMITMENT = "02".repeat(32);
const NULLIFIER = "03".repeat(32);

function transactionXdr(): string {
  return new TransactionBuilder(new Account(TESTNET_ACCOUNT, "1"), {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.manageData({ name: "stamp", value: "ready" }))
    .setTimeout(30)
    .build()
    .toXDR();
}

function signedSubmitClaimXdr(source = Keypair.random()): {
  xdr: string;
  source: string;
  review: PreparedReview;
} {
  const transaction = new TransactionBuilder(new Account(source.publicKey(), "1"), {
    fee: "5000",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: DEFAULT_REGISTRY_CONTRACT_ID,
        function: "submit_claim",
        args: [
          nativeToScVal(source.publicKey(), { type: "address" }),
          nativeToScVal(Buffer.from(RESEARCHER_COMMITMENT, "hex"), {
            type: "bytes",
          }),
          nativeToScVal(Buffer.from(CLAIM_COMMITMENT, "hex"), {
            type: "bytes",
          }),
          nativeToScVal(Buffer.from(NULLIFIER, "hex"), { type: "bytes" }),
        ],
      }),
    )
    .setSorobanData(new SorobanDataBuilder().setResourceFee("2000").build())
    .setTimeout(30)
    .build();

  transaction.sign(source);

  return {
    xdr: transaction.toXDR(),
    source: source.publicKey(),
    review: {
      wallet: source.publicKey(),
      contractId: DEFAULT_REGISTRY_CONTRACT_ID,
      method: "submit_claim",
      researcherCommitment: RESEARCHER_COMMITMENT,
      claimCommitment: CLAIM_COMMITMENT,
      nullifier: NULLIFIER,
      simulatedFee: "7000",
      feeStroops: "7000",
      feeXlm: "0.0007000",
      signableXdr: "preview-xdr-that-must-not-be-submitted",
    },
  };
}

void test("Stellar submission failure is never labelled as Freighter rejection", () => {
  const message = signedTransactionMessage(
    new Error(
      "Stellar transaction submission failed before confirmation. No ZeroSeal receipt was created. Stellar RPC details: status=ERROR",
    ),
  );

  assert.equal(
    message,
    "Wallet approval succeeded, but Stellar submission failed. No receipt was created. Open Technical details for the RPC response.",
  );
  assert.doesNotMatch(message, /Freighter approval was rejected/);
});

void test("explicit user rejection remains a Freighter rejection", async () => {
  await assert.rejects(
    () =>
      signPreparedXdr({
        signableXdr: "prepared-xdr",
        walletAddress: TESTNET_ACCOUNT,
        networkPassphrase: Networks.TESTNET,
        signTransaction: () =>
          Promise.resolve({
            signedTxXdr: "",
            signerAddress: "",
            error: { code: -1, message: "User rejected the request" },
          }),
      }),
    /Freighter approval was rejected/,
  );
});

void test("non-user Freighter errors keep their real cause", async () => {
  await assert.rejects(
    () =>
      signPreparedXdr({
        signableXdr: "prepared-xdr",
        walletAddress: TESTNET_ACCOUNT,
        networkPassphrase: Networks.TESTNET,
        signTransaction: () =>
          Promise.resolve({
            signedTxXdr: "",
            signerAddress: "",
            error: { code: -1, message: "Transaction simulation failed" },
          }),
      }),
    /Freighter signing failed: Transaction simulation failed/,
  );
});

void test("Contract error #2 during preparation is not labelled as a Freighter error", () => {
  const message = signedTransactionMessage(
    new Error("Transaction simulation failed: HostError: Error(Contract, #2)"),
  );

  assert.equal(
    message,
    "Claim Registry identity mismatch. ZeroSeal could not reuse the researcher commitment already registered for this wallet.",
  );
  assert.doesNotMatch(message, /Freighter signing failed|Freighter approval was rejected/);
});

void test("SDK assembled transaction sign is used for the submit_claim path", async () => {
  const signed = signedSubmitClaimXdr();
  let assembledSignCalls = 0;
  let directFreighterCalls = 0;
  const transaction = {
    signed: undefined as { toXDR: () => string } | undefined,
    sign: async (options?: { signTransaction?: unknown }) => {
      assembledSignCalls += 1;
      assert.equal(typeof options?.signTransaction, "function");
      transaction.signed = { toXDR: () => signed.xdr };
    },
  };

  const result = await signSdkPreparedSubmitClaim({
    transaction,
    review: signed.review,
    networkPassphrase: Networks.TESTNET,
    signTransaction: async () => {
      directFreighterCalls += 1;
      throw new Error("manual signing must not be called by this helper");
    },
  });

  assert.equal(assembledSignCalls, 1);
  assert.equal(directFreighterCalls, 0);
  assert.equal(result.signedTxXdr, signed.xdr);
  assert.equal(result.readiness.signatureCount, 1);
  assert.equal(result.readiness.sorobanResourceFee, "2000");
  assert.equal(result.readiness.decoded.researcherCommitment, RESEARCHER_COMMITMENT);
  assert.equal(result.readiness.decoded.claimCommitment, CLAIM_COMMITMENT);
  assert.equal(result.readiness.decoded.nullifier, NULLIFIER);
});

void test("SDK signing cancellation still shows the Freighter rejection message", async () => {
  const signed = signedSubmitClaimXdr();

  await assert.rejects(
    () =>
      signSdkPreparedSubmitClaim({
        transaction: {
          signed: undefined,
          sign: () => Promise.reject(new Error("User rejected the request")),
        },
        review: signed.review,
        networkPassphrase: Networks.TESTNET,
      }),
    /Freighter approval was rejected/,
  );
});

void test("RPC txMalformed produces no receipt and is not a Freighter rejection", async () => {
  let message = "";
  try {
    await submitSignedXdr({
      signedTxXdr: signedSubmitClaimXdr().xdr,
      networkPassphrase: Networks.TESTNET,
      rpcUrl: "https://example.invalid",
      server: {
        sendTransaction: () =>
          Promise.resolve({
            status: "ERROR",
            errorResult: {
              result: {
                switch: { name: "txMalformed", value: -16 },
              },
            },
            latestLedger: 3385464,
          }),
        getTransaction: () => Promise.reject(new Error("must not poll")),
      },
    });
    assert.fail("txMalformed must reject before receipt creation.");
  } catch (error) {
    assert.ok(error instanceof Error);
    message = error.message;
  }

  assert.match(message, /No ZeroSeal receipt was created/);
  assert.match(
    message,
    /Stellar rejected the transaction envelope as malformed before contract execution/,
  );
  assert.match(message, /Stellar RPC details: status=ERROR/);
  assert.doesNotMatch(message, /Freighter approval was rejected/);
  assert.equal(
    signedTransactionMessage(new Error(message)),
    "Wallet approval succeeded, but Stellar submission failed. No receipt was created. Open Technical details for the RPC response.",
  );
});

void test("Stellar ERROR includes RPC diagnostics and does not poll", async () => {
  let polled = false;

  await assert.rejects(
    () =>
      submitSignedXdr({
        signedTxXdr: transactionXdr(),
        networkPassphrase: Networks.TESTNET,
        rpcUrl: "https://example.invalid",
        server: {
          sendTransaction: () =>
            Promise.resolve({
              status: "ERROR",
              errorResult: "tx_bad_auth",
              latestLedger: 123,
            }),
          getTransaction: () => {
            polled = true;
            return Promise.reject(new Error("must not poll"));
          },
        },
      }),
    /status=ERROR.*errorResult=tx_bad_auth.*latestLedger=123/,
  );

  assert.equal(polled, false);
});

void test("Stellar FAILED confirmation includes RPC diagnostics", async () => {
  const hash = "a".repeat(64);

  await assert.rejects(
    () =>
      submitSignedXdr({
        signedTxXdr: transactionXdr(),
        networkPassphrase: Networks.TESTNET,
        rpcUrl: "https://example.invalid",
        maxPollAttempts: 1,
        pollIntervalMs: 0,
        server: {
          sendTransaction: () => Promise.resolve({ status: "PENDING", hash }),
          getTransaction: () =>
            Promise.resolve({
              status: "FAILED",
              hash,
              errorResult: "tx_failed",
            }),
        },
      }),
    /Stellar Testnet transaction failed.*errorResult=tx_failed/,
  );
});
