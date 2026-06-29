import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";

import type { ApiConfig } from "./config";
import { PrismaService } from "./prisma.service";
import { checkRedisReady } from "./readiness";
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
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await checkRedisReady(this.config.REDIS_URL);
      return {
        status: "ready",
        service: "zeroseal-api",
        time: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        code: "SERVICE_DEPENDENCY_UNAVAILABLE",
        message: "Database or queue service is not ready.",
      });
    }
  }
}
