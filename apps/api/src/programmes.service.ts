import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import type { ApiConfig } from "./config";
import { CONFIG } from "./tokens";
import { PrismaService } from "./prisma.service";

export const SECURITY_PROGRAMME_IDENTIFIER = "zeroseal-security-impact-demo";
export const SECURITY_SNAPSHOT_IDENTIFIER = "security-impact-demo-v1";
export const SECURITY_POLICY_IDENTIFIER = "published-impact-threshold-v1";
export const SECURITY_CIRCUIT_ID = "security-impact-v1";

@Injectable()
export class ProgrammesService implements OnModuleInit {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(CONFIG) private readonly config: ApiConfig,
  ) {}

  async onModuleInit() {
    await this.seedDevelopmentProgramme();
  }

  async seedDevelopmentProgramme() {
    const organisation = await this.prisma.organisation.upsert({
      where: { slug: "zeroseal-demo" },
      update: {},
      create: {
        slug: "zeroseal-demo",
        name: "ZeroSeal demo organisation",
      },
    });

    const programme = await this.prisma.programme.upsert({
      where: { identifier: SECURITY_PROGRAMME_IDENTIFIER },
      update: {
        name: "ZeroSeal Security Impact Demo",
        network: this.config.STELLAR_NETWORK,
      },
      create: {
        identifier: SECURITY_PROGRAMME_IDENTIFIER,
        name: "ZeroSeal Security Impact Demo",
        network: this.config.STELLAR_NETWORK,
        organisationId: organisation.id,
      },
    });

    await this.prisma.circuit.upsert({
      where: { identifier: SECURITY_CIRCUIT_ID },
      update: {
        version: "v1",
        claimType: "SECURITY_IMPACT",
        proofSystem: "Noir UltraHonk",
        evidenceCommitmentBinding: false,
        active: true,
        expectedPublicInputs: [
          "program_id",
          "snapshot_id",
          "impact_rule_id",
          "minimum_loss",
          "state_commitment",
          "researcher_commitment",
          "nullifier",
        ],
      },
      create: {
        identifier: SECURITY_CIRCUIT_ID,
        version: "v1",
        claimType: "SECURITY_IMPACT",
        proofSystem: "Noir UltraHonk",
        evidenceCommitmentBinding: false,
        expectedPublicInputs: [
          "program_id",
          "snapshot_id",
          "impact_rule_id",
          "minimum_loss",
          "state_commitment",
          "researcher_commitment",
          "nullifier",
        ],
      },
    });

    await this.prisma.programmeSnapshot.upsert({
      where: {
        programmeId_identifier: {
          programmeId: programme.id,
          identifier: SECURITY_SNAPSHOT_IDENTIFIER,
        },
      },
      update: {},
      create: {
        programmeId: programme.id,
        identifier: SECURITY_SNAPSHOT_IDENTIFIER,
        description:
          "Demo programme snapshot for the Security Impact circuit.",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      },
    });

    await this.prisma.impactPolicy.upsert({
      where: {
        programmeId_identifier: {
          programmeId: programme.id,
          identifier: SECURITY_POLICY_IDENTIFIER,
        },
      },
      update: {
        registryContract: this.config.REGISTRY_CONTRACT_ID,
        verifierContract: this.config.VERIFIER_CONTRACT_ID,
      },
      create: {
        programmeId: programme.id,
        identifier: SECURITY_POLICY_IDENTIFIER,
        rule: "private demonstrated loss is greater than or equal to the public minimum loss threshold",
        publicThreshold: "50",
        circuitId: SECURITY_CIRCUIT_ID,
        expectedPublicInputs: [
          "program_id",
          "snapshot_id",
          "impact_rule_id",
          "minimum_loss",
          "state_commitment",
          "researcher_commitment",
          "nullifier",
        ],
        registryContract: this.config.REGISTRY_CONTRACT_ID,
        verifierContract: this.config.VERIFIER_CONTRACT_ID,
        network: this.config.STELLAR_NETWORK,
      },
    });
  }

  async getSecurityPolicy() {
    return this.prisma.impactPolicy.findFirstOrThrow({
      where: {
        identifier: SECURITY_POLICY_IDENTIFIER,
        programme: { identifier: SECURITY_PROGRAMME_IDENTIFIER },
      },
      include: {
        programme: true,
      },
    });
  }

  async listProgrammes() {
    return this.prisma.programme.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        snapshots: { orderBy: { createdAt: "desc" } },
        policies: { orderBy: { createdAt: "asc" } },
      },
    });
  }

  async getProgramme(programmeId: string) {
    return this.prisma.programme.findFirstOrThrow({
      where: {
        OR: [{ id: programmeId }, { identifier: programmeId }],
      },
      include: {
        snapshots: { orderBy: { createdAt: "desc" } },
        policies: { orderBy: { createdAt: "asc" } },
      },
    });
  }

  async getProgrammeSnapshots(programmeId: string) {
    const programme = await this.getProgramme(programmeId);
    return this.prisma.programmeSnapshot.findMany({
      where: { programmeId: programme.id },
      orderBy: { createdAt: "desc" },
    });
  }

  async getProgrammePolicies(programmeId: string) {
    const programme = await this.getProgramme(programmeId);
    return this.prisma.impactPolicy.findMany({
      where: { programmeId: programme.id },
      orderBy: { createdAt: "asc" },
    });
  }

  async listCircuits() {
    return this.prisma.circuit.findMany({
      orderBy: { createdAt: "asc" },
    });
  }
}
