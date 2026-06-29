import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

void test("Render blueprint uses only free services and no worker service", async () => {
  const blueprint = await readFile(resolve(process.cwd(), "../../render.yaml"), "utf8");

  assert.match(blueprint, /name:\s+zeroseal-api[\s\S]*?plan:\s+free/);
  assert.match(blueprint, /name:\s+zeroseal-postgres[\s\S]*?plan:\s+free/);
  assert.match(blueprint, /name:\s+zeroseal-redis[\s\S]*?plan:\s+free/);
  assert.doesNotMatch(blueprint, /type:\s+worker/);
  assert.doesNotMatch(blueprint, /\b(starter|basic-256mb|standard|pro|journal-snapshot)\b/i);
  assert.match(blueprint, /RUN_EMBEDDED_WORKER[\s\S]*?value:\s+true/);
  assert.match(blueprint, /branch:\s+main/);
  assert.match(blueprint, /autoDeployTrigger:\s+commit/);
  assert.match(blueprint, /REDIS_REQUIRED_FOR_READY[\s\S]*?value:\s+false/);
  assert.doesNotMatch(blueprint, /API_PUBLIC_URL/);
  assert.doesNotMatch(blueprint, /sync:\s*false/);
});
