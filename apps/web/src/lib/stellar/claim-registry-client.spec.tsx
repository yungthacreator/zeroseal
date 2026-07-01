import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
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

import { DEFAULT_REGISTRY_CONTRACT_ID } from "./config";
import {
  assertSubmitClaimSignedXdrReady,
  decodeSubmitClaimArgsFromXdr,
} from "./claim-registry-client";

const OLD_REGISTRY_CONTRACT_ID =
  "CBKQ3ZTUIOQLPQLZ5RUK237P6AGAJ4LGOQJNB2GVJHRFVNKENFIU622R";
const RESEARCHER =
  "GBYWCY5VVCF4ZU3LG4OGOGB6OB6RVAXOA5RTW3BAFJO7MQKWWM7M3EHS";
const RESEARCHER_COMMITMENT =
  "73fea8bfb67ac8c6a2bac808316c2750331983290be5e4e488e62361f8090b3b";
const CLAIM_COMMITMENT =
  "cfa8caa9feef6e035354b47763dc50d1ffd7beefc63a6ced135a6f97dff2b980";
const NULLIFIER =
  "0da1e0e0056857609cc20523e06ceb6a9a76304b6141f9c0c10a23c5bd2cd739";

void test("generated claim registry binding matches the minimal submit_claim ABI", async () => {
  const generatedPath = path.resolve(
    process.cwd(),
    "src/generated/claim-registry-client.ts",
  );
  const generated = await readFile(generatedPath, "utf8");

  assert.match(generated, new RegExp(DEFAULT_REGISTRY_CONTRACT_ID));
  assert.doesNotMatch(generated, new RegExp(OLD_REGISTRY_CONTRACT_ID));
  assert.doesNotMatch(generated, /register_researcher/);
  assert.doesNotMatch(generated, /public_inputs/);
  assert.doesNotMatch(generated, /proof_bytes/);
  assert.match(generated, /researcher_commitment: Buffer/);
  assert.match(generated, /claim_commitment: Buffer/);
  assert.match(generated, /nullifier: Buffer/);
});

void test("browser claim public artifact contains only safe submit_claim commitments", async () => {
  const artifactPath = path.resolve(
    process.cwd(),
    "public/zeroseal/browser-claim.json",
  );
  const artifactText = await readFile(artifactPath, "utf8");
  const artifact = JSON.parse(artifactText) as {
    registry_contract_id?: string;
    method?: string;
    arguments?: Record<string, unknown>;
  };

  assert.equal(artifact.registry_contract_id, DEFAULT_REGISTRY_CONTRACT_ID);
  assert.equal(artifact.method, "submit_claim");
  assert.deepEqual(Object.keys(artifact.arguments ?? {}).sort(), [
    "claim_commitment",
    "nullifier",
    "researcher",
    "researcher_commitment",
  ]);
  assert.doesNotMatch(artifactText, /proof_hex|proof_bytes|public_inputs_hex|public_inputs|vulnerability description/i);
});

void test("Step 5 displayed submit_claim commitments match decoded signable XDR", () => {
  const transaction = new TransactionBuilder(new Account(RESEARCHER, "1"), {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: DEFAULT_REGISTRY_CONTRACT_ID,
        function: "submit_claim",
        args: [
          nativeToScVal(RESEARCHER, { type: "address" }),
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
    .setTimeout(30)
    .build();

  const decoded = decodeSubmitClaimArgsFromXdr(transaction.toXDR());

  assert.deepEqual(decoded, {
    contractId: DEFAULT_REGISTRY_CONTRACT_ID,
    method: "submit_claim",
    researcher: RESEARCHER,
    researcherCommitment: RESEARCHER_COMMITMENT,
    claimCommitment: CLAIM_COMMITMENT,
    nullifier: NULLIFIER,
  });
});

void test("signed submit_claim XDR readiness requires signature and Soroban data", () => {
  const source = Keypair.random();
  const researcherCommitment = "01".repeat(32);
  const claimCommitment = "02".repeat(32);
  const nullifier = "03".repeat(32);
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
          nativeToScVal(Buffer.from(researcherCommitment, "hex"), {
            type: "bytes",
          }),
          nativeToScVal(Buffer.from(claimCommitment, "hex"), {
            type: "bytes",
          }),
          nativeToScVal(Buffer.from(nullifier, "hex"), { type: "bytes" }),
        ],
      }),
    )
    .setSorobanData(new SorobanDataBuilder().setResourceFee("2000").build())
    .setTimeout(30)
    .build();

  transaction.sign(source);

  const readiness = assertSubmitClaimSignedXdrReady({
    signedXdr: transaction.toXDR(),
    networkPassphrase: Networks.TESTNET,
    expected: {
      contractId: DEFAULT_REGISTRY_CONTRACT_ID,
      researcher: source.publicKey(),
      researcherCommitment,
      claimCommitment,
      nullifier,
    },
  });

  assert.equal(readiness.decoded.method, "submit_claim");
  assert.equal(readiness.signatureCount, 1);
  assert.equal(readiness.feeStroops, "7000");
  assert.equal(readiness.sorobanResourceFee, "2000");
});
