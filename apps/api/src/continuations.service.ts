import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { ApiError } from "./common";
import { PrismaService } from "./prisma.service";
import { hex64 } from "./validators";

const publicClaimSchema = z
  .object({
    reportingContext: z.string().min(1).max(120).nullable(),
    programmeName: z.string().min(1).max(200).nullable(),
    targetType: z.string().min(1).max(120).nullable(),
    targetLocator: z.string().min(1).max(240).nullable(),
    affectedComponent: z.string().min(1).max(200).nullable(),
    findingTitle: z.string().min(1).max(240).nullable(),
    bugCategory: z.string().min(1).max(120).nullable(),
    claimedSeverity: z.string().min(1).max(40).nullable(),
    impactStatement: z.string().min(1).max(2000).nullable(),
    publicThreshold: z.string().min(1).max(80).nullable(),
  })
  .strict();

export const continuationSchema = z
  .object({
    publicPayload: z.record(z.string(), z.unknown()),
    publicClaim: publicClaimSchema,
    seal: z
      .object({
        claimIdentifier: z.string().min(8).max(160),
        researcherFingerprint: hex64,
        nullifier: hex64,
        canonicalClaimHash: hex64,
        privateEvidenceDigest: hex64,
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    const serialized = JSON.stringify(value).toLowerCase();
    for (const forbidden of [
      "privatereport",
      "reproductionsteps",
      "proofofconcept",
      "salt",
      "privateimpact",
      "attachment",
      "witnessvalue",
    ]) {
      if (serialized.includes(forbidden)) {
        context.addIssue({
          code: "custom",
          message: `Continuation payload cannot include ${forbidden}.`,
        });
      }
    }
  });

export type ContinuationInput = z.infer<typeof continuationSchema>;

@Injectable()
export class ContinuationsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async create(input: ContinuationInput) {
    await this.prune();

    const token = randomBytes(18).toString("base64url");
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000);

    await this.prisma.continuation.create({
      data: {
        tokenHash: hashToken(token),
        expiresAt,
        payload: input as Prisma.InputJsonValue,
      },
    });

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      linkPath: `/create?continue=${token}`,
    };
  }

  async consume(token: string) {
    await this.prune();

    const tokenHash = hashToken(token);
    const stored = await this.prisma.continuation.findUnique({
      where: { tokenHash },
    });
    if (!stored) {
      throw new ApiError("CONTINUATION_NOT_FOUND", "Continuation link was not found.", 404);
    }

    if (stored.consumedAt) {
      throw new ApiError("CONTINUATION_USED", "Continuation link has already been used.", 409);
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new ApiError("CONTINUATION_EXPIRED", "Continuation link has expired.", 410);
    }

    const claimed = await this.prisma.continuation.updateMany({
      where: {
        tokenHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });

    if (claimed.count !== 1) {
      throw new ApiError("CONTINUATION_USED", "Continuation link has already been used.", 409);
    }

    const payload = continuationSchema.parse(stored.payload);

    return {
      token,
      expiresAt: stored.expiresAt.toISOString(),
      publicPayload: payload.publicPayload,
      publicClaim: payload.publicClaim,
      seal: payload.seal,
    };
  }

  private prune() {
    return this.prisma.continuation.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: new Date() } },
          { consumedAt: { not: null } },
        ],
      },
    });
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
