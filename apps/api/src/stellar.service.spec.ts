import assert from "node:assert/strict";
import test from "node:test";

import type { ApiConfig } from "./config";
import { StellarService } from "./stellar.service";

const config: ApiConfig = {
  DATABASE_URL: "postgresql://zeroseal:zeroseal@127.0.0.1:5432/zeroseal",
  REDIS_URL: "redis://127.0.0.1:6379",
  API_PORT: 4000,
  WEB_ORIGIN: "http://127.0.0.1:3001",
  STELLAR_NETWORK: "TESTNET",
  STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
  STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
  STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  REGISTRY_CONTRACT_ID: "CBKQ3ZTUIOQLPQLZ5RUK237P6AGAJ4LGOQJNB2GVJHRFVNKENFIU622R",
  VERIFIER_CONTRACT_ID: "CABBWKKUU4PWWU5LSV2BPUMIEZR542V36WONDA2UT6OHXJWZAPXIKA2X",
  EXPLORER_TRANSACTION_BASE_URL:
    "https://stellar.expert/explorer/testnet/tx",
  EXPLORER_ACCOUNT_BASE_URL:
    "https://stellar.expert/explorer/testnet/account",
  EXPLORER_CONTRACT_BASE_URL:
    "https://stellar.expert/explorer/testnet/contract",
  LOG_LEVEL: "info",
};

void test("StellarService builds network-aware Explorer links", () => {
  const service = new StellarService(config);
  const hash = "a".repeat(64);
  const account = "G".padEnd(56, "A");
  const contract = "C".padEnd(56, "A");

  assert.equal(
    service.explorerTransactionUrl(hash),
    `https://stellar.expert/explorer/testnet/tx/${hash}`,
  );
  assert.equal(
    service.explorerAccountUrl(account),
    `https://stellar.expert/explorer/testnet/account/${account}`,
  );
  assert.equal(
    service.explorerContractUrl(contract),
    `https://stellar.expert/explorer/testnet/contract/${contract}`,
  );
});

void test("StellarService recovers a matching researcher registration transaction", async () => {
  const originalFetch = global.fetch;
  const txHash =
    "200414937c44753e24c5d79450ad6eb57e267940def01eab6105246ab39f970b";
  const account =
    "GBYWCY5VVCF4ZU3LG4OGOGB6OB6RVAXOA5RTW3BAFJO7MQKWWM7M3EHS";
  const commitment =
    "04365013fb23d445d933eb47b2491088199eb4a60712bb1673a9d8ee448751d0";

  global.fetch = (async (url: string | URL | Request) => {
    const href = String(url);
    const body = href.includes("/operations")
      ? {
          _embedded: {
            records: [
              {
                type: "invoke_host_function",
                transaction_successful: true,
                source_account: account,
                parameters: [
                  {
                    type: "Address",
                    value:
                      "AAAAEgAAAAFVDeZ0Q6C3wXnsaK1v7/AMBPFmdBLQ6NVJ4lq1RGlRTw==",
                  },
                  {
                    type: "Sym",
                    value: "AAAADwAAABNyZWdpc3Rlcl9yZXNlYXJjaGVyAA==",
                  },
                  {
                    type: "Address",
                    value:
                      "AAAAEgAAAAAAAAAAcWFjtaiLzNNrNxxnGD5wfRqC7gdjO2wgKl32QVazPs0=",
                  },
                  {
                    type: "Bytes",
                    value: "AAAADQAAACAENlAT+yPURdkz60eySRCIGZ60pgcSuxZzqdjuRIdR0A==",
                  },
                ],
              },
            ],
          },
        }
      : {
          _embedded: {
            records: [
              {
                hash: txHash,
                successful: true,
                ledger: 3242354,
                source_account: account,
                created_at: "2026-06-23T14:39:47Z",
                fee_charged: "47683",
                _links: {
                  operations: {
                    href: "https://horizon-testnet.stellar.org/tx/operations{?cursor,limit,order}",
                  },
                },
              },
            ],
          },
        };

    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;

  try {
    const recovered = await new StellarService(config).recoverResearcherRegistration(
      account,
      commitment,
    );
    assert.equal(recovered?.hash, txHash);
    assert.equal(recovered?.ledger, 3242354);
    assert.equal(recovered?.researcherCommitment, commitment);
    assert.equal(recovered?.method, "register_researcher");
  } finally {
    global.fetch = originalFetch;
  }
});
