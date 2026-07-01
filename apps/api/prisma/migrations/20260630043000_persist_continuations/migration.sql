CREATE TABLE "Continuation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tokenHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Continuation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Continuation_tokenHash_key" ON "Continuation"("tokenHash");
CREATE INDEX "Continuation_expiresAt_idx" ON "Continuation"("expiresAt");
CREATE INDEX "Continuation_consumedAt_idx" ON "Continuation"("consumedAt");
