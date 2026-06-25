import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import express from "express";

import { AppModule } from "./app.module";
import { loadConfig } from "./config";

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
  });

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "128kb" }));
  app.enableShutdownHooks();
  app.enableCors({
    origin: config.WEB_ORIGIN,
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

  await app.listen(config.API_PORT, "0.0.0.0");
}

void bootstrap();
