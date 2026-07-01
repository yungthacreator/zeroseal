import assert from "node:assert/strict";
import test from "node:test";

import { createIdempotencyKey } from "./idempotency";

const WALLET =
  "GBYWCY5VVCF4ZU3LG4OGOGB6OB6RVAXOA5RTW3BAFJO7MQKWWM7M3EHS";
const CLAIM_IDENTIFIER = "zs-73fea8bfb67a";
const CLAIM_COMMITMENT =
  "cfa8caa9feef6e035354b47763dc50d1ffd7beefc63a6ced135a6f97dff2b980";
const OTHER_CLAIM_COMMITMENT =
  "dfa8caa9feef6e035354b47763dc50d1ffd7beefc63a6ced135a6f97dff2b980";
const RESEARCHER_COMMITMENT =
  "73fea8bfb67ac8c6a2bac808316c2750331983290be5e4e488e62361f8090b3b";
const NULLIFIER =
  "0da1e0e0056857609cc20523e06ceb6a9a76304b6141f9c0c10a23c5bd2cd739";
const SIGNABLE_XDR = "AAAAAgAAAADo-not-leak-xdr";

function claimInputs(claimCommitment = CLAIM_COMMITMENT) {
  return [
    CLAIM_IDENTIFIER,
    WALLET,
    claimCommitment,
    RESEARCHER_COMMITMENT,
    NULLIFIER,
  ];
}

void test("idempotency key is fixed length and deterministic for retry", async () => {
  const first = await createIdempotencyKey("claim_submission", claimInputs());
  const retry = await createIdempotencyKey("claim_submission", claimInputs());

  assert.equal(first, retry);
  assert.match(first, /^zs:claim_submission:[0-9a-f]{64}$/);
  assert.ok(first.length <= 128);
});

void test("idempotency key changes when claim commitment changes", async () => {
  const first = await createIdempotencyKey("claim_submission", claimInputs());
  const changed = await createIdempotencyKey(
    "claim_submission",
    claimInputs(OTHER_CLAIM_COMMITMENT),
  );

  assert.notEqual(first, changed);
});

void test("idempotency key changes when operation changes", async () => {
  const claimKey = await createIdempotencyKey("claim_submission", claimInputs());
  const transactionKey = await createIdempotencyKey("claim_transaction", [
    "claim-id",
    WALLET,
    "1a1ffe25af3d34d880c501bac8e98255d0ca89e48753993c3facd6e2bb3cd38c",
    "CD6MKUVXB7ZTZQCGNMBVHMU4PGT2SEKS6Z5LF53HXDOAVCO3LGKGQ3JU",
    CLAIM_COMMITMENT,
  ]);

  assert.notEqual(claimKey, transactionKey);
});

void test("idempotency key does not contain wallet, XDR or raw commitment text", async () => {
  const key = await createIdempotencyKey("claim_submission", claimInputs());

  assert.doesNotMatch(key, new RegExp(WALLET));
  assert.doesNotMatch(key, new RegExp(CLAIM_COMMITMENT));
  assert.doesNotMatch(key, new RegExp(RESEARCHER_COMMITMENT));
  assert.doesNotMatch(key, new RegExp(NULLIFIER));
  assert.doesNotMatch(key, /AAAAAgAAAADo-not-leak-xdr/);
});
