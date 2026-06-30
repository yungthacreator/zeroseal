import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";

import type { ApiConfig } from "./config";
import { PrismaService } from "./prisma.service";
import { checkRedisReady, checkStellarRpcReady } from "./readiness";
import { CONFIG } from "./tokens";

@Controller()
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CONFIG) private readonly config: ApiConfig,
  ) {}

  @Get("/health")
  health() {
    return {
      status: "ok",
      service: "zeroseal-api",
      time: new Date().toISOString(),
    };
  }

  @Get("/ready")
  async ready() {
    const checks = {
      api: "alive",
      database: "unknown",
      redis: "optional" as "optional" | "ready" | "unavailable",
      stellarRpc: "unknown",
      worker: this.config.RUN_EMBEDDED_WORKER ? "embedded" : "disabled",
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = "ready";
    } catch {
      throw new ServiceUnavailableException({
        code: "SERVICE_DEPENDENCY_UNAVAILABLE",
        message: "Database is not ready.",
        checks,
      });
    }

    try {
      await checkRedisReady(this.config.REDIS_URL);
      checks.redis = "ready";
    } catch {
      checks.redis = "unavailable";
      if (this.config.REDIS_REQUIRED_FOR_READY) {
        throw new ServiceUnavailableException({
          code: "SERVICE_DEPENDENCY_UNAVAILABLE",
          message: "Redis is required but unavailable.",
          checks,
        });
      }
    }

    try {
      await checkStellarRpcReady(this.config.STELLAR_RPC_URL);
      checks.stellarRpc = "ready";
    } catch {
      checks.stellarRpc = "unavailable";
      throw new ServiceUnavailableException({
        code: "SERVICE_DEPENDENCY_UNAVAILABLE",
        message: "Stellar RPC is not ready.",
        checks,
      });
    }

    return {
      status: "ready",
      service: "zeroseal-api",
      time: new Date().toISOString(),
      checks,
    };
  }
}
