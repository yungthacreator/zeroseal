CREATE TABLE "Circuit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "identifier" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "claimType" TEXT NOT NULL,
    "proofSystem" TEXT NOT NULL,
    "evidenceCommitmentBinding" BOOLEAN NOT NULL DEFAULT false,
    "expectedPublicInputs" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Circuit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Circuit_identifier_key" ON "Circuit"("identifier");
CREATE INDEX "Circuit_identifier_idx" ON "Circuit"("identifier");
CREATE INDEX "Circuit_claimType_idx" ON "Circuit"("claimType");

ALTER TABLE "Claim" ADD COLUMN "evidenceBindingStatus" TEXT NOT NULL DEFAULT 'LOCAL_ONLY';
ALTER TABLE "Claim" ALTER COLUMN "researcherCommitment" DROP NOT NULL;
ALTER TABLE "ClaimReceipt" ADD COLUMN "evidenceBindingStatus" TEXT NOT NULL DEFAULT 'LOCAL_ONLY';
