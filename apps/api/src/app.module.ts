import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { ClaimsController } from "./claims.controller";
import { ClaimsService } from "./claims.service";
import { ContinuationsService } from "./continuations.service";
import { RequestIdMiddleware, SafeExceptionFilter } from "./common";
import { loadConfig } from "./config";
import { HealthController } from "./health.controller";
import { PrismaService } from "./prisma.service";
import { ProgrammesService } from "./programmes.service";
import { ProofService } from "./proof.service";
import { ReceiptsService } from "./receipts.service";
import { StellarService } from "./stellar.service";
import { CONFIG } from "./tokens";
import { TransactionsService } from "./transactions.service";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
  ],
  controllers: [ClaimsController, HealthController],
  providers: [
    PrismaService,
    {
      provide: CONFIG,
      useFactory: loadConfig,
    },
    ProgrammesService,
    ProofService,
    ClaimsService,
    ContinuationsService,
    TransactionsService,
    ReceiptsService,
    StellarService,
    {
      provide: APP_FILTER,
      useClass: SafeExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
