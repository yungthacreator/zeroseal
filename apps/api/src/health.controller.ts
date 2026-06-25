import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";

import { PrismaService } from "./prisma.service";

@Controller()
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
      return {
        status: "ready",
        service: "zeroseal-api",
        time: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        code: "DATABASE_UNAVAILABLE",
        message: "Database is not ready.",
      });
    }
  }
}
