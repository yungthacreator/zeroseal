import assert from "node:assert/strict";
import test from "node:test";

import {
  Account,
  BASE_FEE,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

import {
  submitSignedXdr,
  type StellarSubmissionServer,
} from "./submit-transaction";

const TESTNET_ACCOUNT =
  "GBYWCY5VVCF4ZU3LG4OGOGB6OB6RVAXOA5RTW3BAFJO7MQKWWM7M3EHS";
const TX_HASH =
  "1a1ffe25af3d34d880c501bac8e98255d0ca89e48753993c3facd6e2bb3cd38c";

const SIGNED_XDR = new TransactionBuilder(
  new Account(TESTNET_ACCOUNT, "1"),
  {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  },
)
  .addOperation(
    Operation.manageData({
      name: "zeroseal-confirmation-test",
      value: "ready",
    }),
  )
  .setTimeout(30)
  .build()
  .toXDR();

const baseInput = {
  signedTxXdr: SIGNED_XDR,
  networkPassphrase: Networks.TESTNET,
  rpcUrl: "https://rpc.example.test",
  sleep: () => Promise.resolve(),
  pollIntervalMs: 0,
};

void test("returns only after Stellar reports SUCCESS", async () => {
  const confirmations: unknown[] = [
    { status: "NOT_FOUND" },
    { status: "SUCCESS", hash: TX_HASH, ledger: 3_377_274 },
  ];
  let confirmationChecks = 0;

  const server: StellarSubmissionServer = {
    sendTransaction: () =>
      Promise.resolve({
        status: "PENDING",
        hash: TX_HASH,
      }),
    getTransaction: () => {
      confirmationChecks += 1;
      return Promise.resolve(confirmations.shift());
    },
  };

  const result = await submitSignedXdr({
    ...baseInput,
    server,
    maxPollAttempts: 3,
  });

  assert.deepEqual(result, {
    hash: TX_HASH,
    ledger: "3377274",
  });
  assert.equal(confirmationChecks, 2);
});

void test("continues checking a DUPLICATE submission until SUCCESS", async () => {
  const server: StellarSubmissionServer = {
    sendTransaction: () =>
      Promise.resolve({
        status: "DUPLICATE",
        hash: TX_HASH,
      }),
    getTransaction: () =>
      Promise.resolve({
        status: "SUCCESS",
        hash: TX_HASH,
        ledger: 3_377_275,
      }),
  };

  const result = await submitSignedXdr({
    ...baseInput,
    server,
    maxPollAttempts: 1,
  });

  assert.equal(result.hash, TX_HASH);
  assert.equal(result.ledger, "3377275");
});

void test("rejects an RPC submission error before saving a receipt", async () => {
  let confirmationChecks = 0;
  const server: StellarSubmissionServer = {
    sendTransaction: () =>
      Promise.resolve({
        status: "ERROR",
        hash: TX_HASH,
      }),
    getTransaction: () => {
      confirmationChecks += 1;
      return Promise.resolve({ status: "NOT_FOUND" });
    },
  };

  await assert.rejects(
    submitSignedXdr({
      ...baseInput,
      server,
      maxPollAttempts: 1,
    }),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(
        error.message,
        /Stellar transaction submission failed before confirmation/,
      );
      assert.match(error.message, /No ZeroSeal receipt was created/);
      assert.match(error.message, /Stellar RPC details: status=ERROR/);
      assert.doesNotMatch(error.message, /Freighter approval was rejected/);
      return true;
    },
  );
  assert.equal(confirmationChecks, 0);
});

void test("rejects a transaction that Stellar reports as FAILED", async () => {
  const server: StellarSubmissionServer = {
    sendTransaction: () =>
      Promise.resolve({
        status: "PENDING",
        hash: TX_HASH,
      }),
    getTransaction: () =>
      Promise.resolve({
        status: "FAILED",
        hash: TX_HASH,
      }),
  };

  await assert.rejects(
    submitSignedXdr({
      ...baseInput,
      server,
      maxPollAttempts: 1,
    }),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(
        error.message,
        new RegExp(`Stellar Testnet transaction failed for ${TX_HASH}`),
      );
      assert.match(error.message, /No ZeroSeal receipt was created/);
      assert.match(error.message, /Stellar RPC details: status=FAILED/);
      assert.doesNotMatch(error.message, /Freighter approval was rejected/);
      return true;
    },
  );
});

void test("does not turn a permanent NOT_FOUND result into a confirmed receipt", async () => {
  let confirmationChecks = 0;
  const server: StellarSubmissionServer = {
    sendTransaction: () =>
      Promise.resolve({
        status: "PENDING",
        hash: TX_HASH,
      }),
    getTransaction: () => {
      confirmationChecks += 1;
      return Promise.resolve({ status: "NOT_FOUND" });
    },
  };

  await assert.rejects(
    submitSignedXdr({
      ...baseInput,
      server,
      maxPollAttempts: 3,
    }),
    /Stellar did not confirm transaction/,
  );
  assert.equal(confirmationChecks, 3);
});
