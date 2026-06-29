import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import express from "express";

import { AppModule } from "./app.module";
import { loadConfig } from "./config";
import { PrismaService } from "./prisma.service";
import { TransactionsService } from "./transactions.service";
import { startWorkerRuntime } from "./worker-runtime";

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
  });

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "128kb" }));
  app.enableShutdownHooks();
  app.enableCors({
    origin: config.CORS_ALLOWED_ORIGINS,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Idempotency-Key", "X-Request-Id"],
    credentials: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: false,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("ZeroSeal API")
      .setDescription("Persistent claims, Stellar reconciliation and receipts.")
      .setVersion("1.0.0")
      .build(),
  );
  SwaggerModule.setup("/api/docs", app, document);

  await app.listen(config.PORT, "0.0.0.0");

  const runtime = await startWorkerRuntime({
    enabled: config.RUN_EMBEDDED_WORKER,
    redisUrl: config.REDIS_URL,
    prisma: app.get(PrismaService),
    transactions: app.get(TransactionsService),
  });

  const shutdown = async () => {
    await runtime.close();
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

void bootstrap();
