import { PrismaService } from "./prisma.service";
import { loadConfig } from "./config";
import { StellarService } from "./stellar.service";
import { ReceiptsService } from "./receipts.service";
import { TransactionsService } from "./transactions.service";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : undefined;
}

async function main() {
  const address = argValue("address") ?? process.env.ZEROSEAL_BACKFILL_ADDRESS;
  const researcherCommitment =
    argValue("researcher-commitment") ??
    process.env.ZEROSEAL_BACKFILL_RESEARCHER_COMMITMENT;
  const ledgerFrom = argValue("ledger-from");
  const ledgerTo = argValue("ledger-to");
  const confirmedAfter = argValue("confirmed-after");
  const confirmedBefore = argValue("confirmed-before");

  if (!address || !researcherCommitment) {
    throw new Error(
      "Usage: npm --prefix apps/api run backfill:registration -- --address=G... --researcher-commitment=<64 hex>",
    );
  }

  const config = loadConfig();
  const prisma = new PrismaService();
  const stellar = new StellarService(config);
  const receipts = new ReceiptsService(prisma, stellar);
  const transactions = new TransactionsService(prisma, stellar, receipts);

  await prisma.$connect();

  try {
    const result = await transactions.recoverResearcherRegistration(
      address,
      researcherCommitment,
      {
        ledgerFrom: ledgerFrom ? Number.parseInt(ledgerFrom, 10) : undefined,
        ledgerTo: ledgerTo ? Number.parseInt(ledgerTo, 10) : undefined,
        confirmedAfter: confirmedAfter ? new Date(confirmedAfter) : undefined,
        confirmedBefore: confirmedBefore
          ? new Date(confirmedBefore)
          : undefined,
      },
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
