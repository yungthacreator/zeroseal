import { loadConfig } from "./config";
import { PrismaService } from "./prisma.service";
import { ReceiptsService } from "./receipts.service";
import { StellarService } from "./stellar.service";
import { TransactionsService } from "./transactions.service";
import { startWorkerRuntime } from "./worker-runtime";

async function main() {
  const config = loadConfig();
  const prisma = new PrismaService();
  const stellar = new StellarService(config);
  const receipts = new ReceiptsService(prisma, stellar);
  const transactions = new TransactionsService(prisma, stellar, receipts);

  await prisma.$connect();
  const runtime = await startWorkerRuntime({
    enabled: true,
    redisUrl: config.REDIS_URL,
    prisma,
    transactions,
  });

  const shutdown = async () => {
    await runtime.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

void main();
