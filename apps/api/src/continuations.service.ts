import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ApiError } from "./common";
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
      "privateevidence",
      "reproductionsteps",
      "proofofconcept",
      "salt",
      "privateimpact",
      "file",
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

type StoredContinuation = ContinuationInput & {
  token: string;
  expiresAt: Date;
  usedAt: Date | null;
};

@Injectable()
export class ContinuationsService {
  private readonly continuations = new Map<string, StoredContinuation>();

  create(input: ContinuationInput) {
    this.prune();

    const token = randomBytes(18).toString("base64url");
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000);

    this.continuations.set(token, {
      ...input,
      token,
      expiresAt,
      usedAt: null,
    });

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      linkPath: `/create?continue=${token}`,
    };
  }

  consume(token: string) {
    this.prune();

    const stored = this.continuations.get(token);
    if (!stored) {
      throw new ApiError("CONTINUATION_NOT_FOUND", "Continuation link was not found.", 404);
    }

    if (stored.usedAt) {
      throw new ApiError("CONTINUATION_USED", "Continuation link has already been used.", 409);
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      this.continuations.delete(token);
      throw new ApiError("CONTINUATION_EXPIRED", "Continuation link has expired.", 410);
    }

    stored.usedAt = new Date();

    return {
      token,
      expiresAt: stored.expiresAt.toISOString(),
      publicPayload: stored.publicPayload,
      publicClaim: stored.publicClaim,
      seal: stored.seal,
    };
  }

  private prune() {
    const now = Date.now();
    for (const [token, value] of this.continuations) {
      if (value.expiresAt.getTime() <= now || value.usedAt) {
        this.continuations.delete(token);
      }
    }
  }
}
