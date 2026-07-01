import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(process.cwd(), "..", "..");

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

void test("local PowerShell tooling starts, checks and stops the real dev stack", () => {
  for (const path of [
    "scripts/start-local.ps1",
    "scripts/check-local.ps1",
    "scripts/stop-local.ps1",
    "apps/web/.env.local.example",
  ]) {
    assert.equal(existsSync(join(root, path)), true, `${path} should exist`);
  }

  const start = read("scripts/start-local.ps1");
  assert.match(start, /C:\\Users\\PC\\projects\\zeroseal/);
  assert.match(start, /docker compose -f docker-compose\.dev\.yml up -d/);
  assert.match(start, /prisma migrate deploy/);
  assert.match(start, /RUN_EMBEDDED_WORKER\s*=\s*"true"/);
  assert.match(start, /WORKER_REQUIRED_FOR_READY\s*=\s*"true"/);
  assert.match(start, /http:\/\/127\.0\.0\.1:3001\/create/);
  assert.match(start, /http:\/\/127\.0\.0\.1:4000\/ready/);

  const check = read("scripts/check-local.ps1");
  assert.match(check, /docker compose -f docker-compose\.dev\.yml ps/);
  assert.match(check, /http:\/\/127\.0\.0\.1:4000\/health/);
  assert.match(check, /http:\/\/127\.0\.0\.1:4000\/ready/);
  assert.match(check, /http:\/\/127\.0\.0\.1:3001\/create/);

  const stop = read("scripts/stop-local.ps1");
  assert.match(stop, /zeroseal-codex/);
  assert.match(stop, /Stop-Process/);
});

void test("web local env example points browser builds at the local API and Testnet", () => {
  const env = read("apps/web/.env.local.example");

  assert.match(env, /NEXT_PUBLIC_ZEROSEAL_API_URL=http:\/\/127\.0\.0\.1:4000/);
  assert.match(env, /NEXT_PUBLIC_STELLAR_RPC_URL=https:\/\/soroban-testnet\.stellar\.org/);
  assert.match(env, /NEXT_PUBLIC_REGISTRY_CONTRACT_ID=CD6MKUVXB7ZTZQCGNMBVHMU4PGT2SEKS6Z5LF53HXDOAVCO3LGKGQ3JU/);
  assert.doesNotMatch(env, /SECRET|PRIVATE_KEY|SESSION_SECRET/);
});
