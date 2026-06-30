import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const src = join(process.cwd(), "src");

function readApiFile(path: string): string {
  return readFileSync(join(src, path), "utf8");
}

void test("API health can boot even when PostgreSQL is unavailable", () => {
  const prismaService = readApiFile("prisma.service.ts");
  const healthController = readApiFile("health.controller.ts");
  const main = readApiFile("main.ts");

  assert.doesNotMatch(
    prismaService,
    /implements\s+OnModuleInit/,
    "PrismaService must not hard-connect during Nest bootstrap",
  );
  assert.doesNotMatch(
    prismaService,
    /async\s+onModuleInit\(\)\s*{[\s\S]*?\$connect\(\)/,
    "Database connection belongs in /ready and data operations, not /health startup",
  );
  assert.match(healthController, /@Get\("\/health"\)/);
  assert.match(healthController, /@Get\("\/ready"\)/);
  assert.match(healthController, /\$queryRaw`SELECT 1`/);
  assert.match(main, /setInterval\(\(\)\s*=>\s*undefined,\s*60_000\)/);
});
