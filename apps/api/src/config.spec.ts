import assert from "node:assert/strict";
import test from "node:test";

import { configSchema } from "./config";

const baseEnv = {
  DATABASE_URL: "postgresql://zeroseal:zeroseal@127.0.0.1:5432/zeroseal",
  REDIS_URL: "redis://127.0.0.1:6379",
  STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
  STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
  STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  REGISTRY_CONTRACT_ID: "CBKQ3ZTUIOQLPQLZ5RUK237P6AGAJ4LGOQJNB2GVJHRFVNKENFIU622R",
  VERIFIER_CONTRACT_ID: "CABBWKKUU4PWWU5LSV2BPUMIEZR542V36WONDA2UT6OHXJWZAPXIKA2X",
  EXPLORER_TRANSACTION_BASE_URL: "https://stellar.expert/explorer/testnet/tx",
  EXPLORER_ACCOUNT_BASE_URL: "https://stellar.expert/explorer/testnet/account",
  EXPLORER_CONTRACT_BASE_URL: "https://stellar.expert/explorer/testnet/contract",
};

void test("config accepts provider PORT and production CORS origins", () => {
  const parsed = configSchema.parse({
    ...baseEnv,
    PORT: "10000",
    CORS_ALLOWED_ORIGINS: "https://zeroseal.vercel.app,https://preview.zeroseal.app",
    NODE_ENV: "production",
    API_PUBLIC_URL: "https://zeroseal-api.example.com",
  });

  assert.equal(parsed.PORT, 10000);
  assert.deepEqual(parsed.CORS_ALLOWED_ORIGINS, [
    "https://zeroseal.vercel.app",
    "https://preview.zeroseal.app",
  ]);
  assert.equal(parsed.API_PUBLIC_URL, "https://zeroseal-api.example.com");
});

void test("config keeps local API_PORT and WEB_ORIGIN compatibility", () => {
  const parsed = configSchema.parse({
    ...baseEnv,
    API_PORT: "4001",
    WEB_ORIGIN: "http://127.0.0.1:3001",
  });

  assert.equal(parsed.PORT, 4001);
  assert.deepEqual(parsed.CORS_ALLOWED_ORIGINS, ["http://127.0.0.1:3001"]);
});
