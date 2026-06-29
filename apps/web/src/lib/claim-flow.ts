export const CLAIM_STATES = [
  "DRAFT",
  "PRIVATE_EVIDENCE_READY",
  "SEAL_GENERATING",
  "SEAL_GENERATED",
  "PUBLIC_CLAIM_REVIEWED",
  "AWAITING_WALLET",
  "SUBMITTING",
  "CONFIRMED",
  "RECEIPT_ISSUED",
  "FAILED",
] as const;

export type ClaimState = (typeof CLAIM_STATES)[number];

export type ClaimAction =
  | "privateEvidenceReady"
  | "startSeal"
  | "sealGenerated"
  | "reviewPublicClaim"
  | "requestWallet"
  | "submit"
  | "confirm"
  | "issueReceipt"
  | "fail"
  | "reset";

export type PrivateEvidence = {
  vulnerabilityDescription: string;
  reproductionSteps: string;
  proofOfConcept: string;
  affectedCode: string;
  screenshotsOrLogs: string;
  expectedResult: string;
  actualResult: string;
  privateImpactValues: string;
  privateNotes: string;
};

export type PublicClaimConfig = {
  policyIdentifier: string;
  policyVersion: string;
  publicThreshold: string;
  verifierVersion: string;
};

export type ClaimDraft = {
  state?: ClaimState;
  demoMode?: boolean;
  loadedPackage?: boolean;
  reportingContext: string;
  programmeName: string;
  programmeUrl: string;
  targetType: string;
  targetLocator: string;
  affectedComponent: string;
  network: string;
  findingTitle: string;
  bugCategory: string;
  claimedSeverity: "Critical" | "High" | "Medium" | "Low" | "";
  impactStatement: string;
  estimatedFinancialImpact: string;
  privateEvidence: PrivateEvidence;
  publicClaim: PublicClaimConfig;
  researcherFingerprint?: string | null;
  privateSeal?: PrivateSeal | null;
  receipt?: { transactionHash: string | null; ledger: string | null } | null;
};

export type PrivateSeal = {
  claimIdentifier: string;
  canonicalClaimHash: string;
  privateEvidenceDigest: string;
  saltHex: string;
  researcherFingerprint: string;
  nullifier: string;
  recoveryBundle: {
    schema: "zeroseal.private-recovery.v1";
    createdAt: string;
    privateEvidence: PrivateEvidence;
    saltHex: string;
    canonicalClaimHash: string;
    researcherFingerprint: string;
    nullifier: string;
  };
};

export type PublicPayload = {
  claimIdentifier: string;
  reportingContext: string;
  programmeContext: string;
  programmeHash: string;
  targetSnapshotHash: string;
  publicPolicyIdentifier: string;
  publicPolicyVersion: string;
  publicThreshold: string;
  researcherFingerprint: string;
  researcherPublicKey: string | null;
  proofDigest: string;
  nullifier: string;
  verifierVersion: string;
  verificationResult: "structural_only" | "verified";
  network: "TESTNET";
  timestamp: string;
};

const PUBLIC_PAYLOAD_KEYS = new Set<keyof PublicPayload>([
  "claimIdentifier",
  "reportingContext",
  "programmeContext",
  "programmeHash",
  "targetSnapshotHash",
  "publicPolicyIdentifier",
  "publicPolicyVersion",
  "publicThreshold",
  "researcherFingerprint",
  "researcherPublicKey",
  "proofDigest",
  "nullifier",
  "verifierVersion",
  "verificationResult",
  "network",
  "timestamp",
]);

const STATE_TRANSITIONS: Partial<
  Record<ClaimState, Partial<Record<ClaimAction, ClaimState>>>
> = {
  DRAFT: {
    privateEvidenceReady: "PRIVATE_EVIDENCE_READY",
    reset: "DRAFT",
    fail: "FAILED",
  },
  PRIVATE_EVIDENCE_READY: {
    startSeal: "SEAL_GENERATING",
    reset: "DRAFT",
    fail: "FAILED",
  },
  SEAL_GENERATING: {
    sealGenerated: "SEAL_GENERATED",
    reset: "DRAFT",
    fail: "FAILED",
  },
  SEAL_GENERATED: {
    reviewPublicClaim: "PUBLIC_CLAIM_REVIEWED",
    reset: "DRAFT",
    fail: "FAILED",
  },
  PUBLIC_CLAIM_REVIEWED: {
    requestWallet: "AWAITING_WALLET",
    reset: "DRAFT",
    fail: "FAILED",
  },
  AWAITING_WALLET: {
    submit: "SUBMITTING",
    reset: "DRAFT",
    fail: "FAILED",
  },
  SUBMITTING: {
    confirm: "CONFIRMED",
    reset: "DRAFT",
    fail: "FAILED",
  },
  CONFIRMED: {
    issueReceipt: "RECEIPT_ISSUED",
    reset: "DRAFT",
    fail: "FAILED",
  },
  RECEIPT_ISSUED: {
    reset: "DRAFT",
  },
  FAILED: {
    reset: "DRAFT",
  },
};

function emptyPrivateEvidence(): PrivateEvidence {
  return {
    vulnerabilityDescription: "",
    reproductionSteps: "",
    proofOfConcept: "",
    affectedCode: "",
    screenshotsOrLogs: "",
    expectedResult: "",
    actualResult: "",
    privateImpactValues: "",
    privateNotes: "",
  };
}

function defaultPublicClaim(): PublicClaimConfig {
  return {
    policyIdentifier: "published-impact-threshold-v1",
    policyVersion: "security-impact-v1",
    publicThreshold: "",
    verifierVersion: "structural-browser-testnet-v1",
  };
}

export function createInitialClaimDraft(): ClaimDraft {
  return {
    state: "DRAFT",
    demoMode: false,
    loadedPackage: false,
    reportingContext: "",
    programmeName: "",
    programmeUrl: "",
    targetType: "",
    targetLocator: "",
    affectedComponent: "",
    network: "",
    findingTitle: "",
    bugCategory: "",
    claimedSeverity: "",
    impactStatement: "",
    estimatedFinancialImpact: "",
    privateEvidence: emptyPrivateEvidence(),
    publicClaim: defaultPublicClaim(),
    researcherFingerprint: null,
    privateSeal: null,
    receipt: null,
  };
}

export function createExampleDemoDraft(): ClaimDraft {
  return {
    ...createInitialClaimDraft(),
    demoMode: true,
    reportingContext: "Directly to a project",
    programmeName: "Example Vault Security Programme",
    programmeUrl: "https://example.invalid/example-vault",
    targetType: "smart contract",
    targetLocator: "example-vault.testnet",
    affectedComponent: "withdraw(uint256)",
    network: "Stellar Testnet",
    findingTitle: "Example smart-contract threshold finding",
    bugCategory: "Access control",
    claimedSeverity: "High",
    impactStatement:
      "An example vault path can demonstrate an impact above the published threshold.",
    estimatedFinancialImpact: "250000",
    privateEvidence: {
      vulnerabilityDescription:
        "Example only. No real exploit or live target is used.",
      reproductionSteps:
        "1. Review the example programme.\n2. Generate a private seal.\n3. Approve only the public Testnet action.",
    proofOfConcept: "example-private-outline",
      affectedCode: "contracts/ExampleVault.sol",
      screenshotsOrLogs: "example-log-entry",
      expectedResult: "The example vault remains balanced.",
      actualResult: "The example path exceeds the threshold.",
      privateImpactValues: "250000",
      privateNotes: "Example data. Do not use an unpatched real finding.",
    },
    publicClaim: {
      ...defaultPublicClaim(),
      publicThreshold: "100000",
    },
  };
}

export function resetClaimDraft(draft: ClaimDraft): ClaimDraft {
  return {
    ...draft,
    state: "DRAFT",
    loadedPackage: false,
    privateEvidence: emptyPrivateEvidence(),
    researcherFingerprint: null,
    privateSeal: null,
    receipt: null,
  };
}

export function nextClaimState(
  current: ClaimState,
  action: ClaimAction,
): ClaimState {
  return STATE_TRANSITIONS[current]?.[action] ?? current;
}

export function canonicalizeClaim(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeClaim(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalizeClaim(record[key])}`)
    .join(",")}}`;
}

function hexFromBytes(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function secureRandomHex(byteLength = 32): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error("Secure random values are unavailable.");
  }

  const bytes = new Uint8Array(byteLength);
  cryptoApi.getRandomValues(bytes);
  return hexFromBytes(bytes);
}

async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) {
    throw new Error("WebCrypto SHA-256 is unavailable.");
  }

  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  const payload = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(payload).set(bytes);
  const digest = await cryptoApi.subtle.digest("SHA-256", payload);
  return hexFromBytes(new Uint8Array(digest));
}

function claimSealMaterial(draft: ClaimDraft, privateEvidenceDigest: string) {
  return {
    reportingContext: draft.reportingContext,
    programmeName: draft.programmeName,
    programmeUrl: draft.programmeUrl,
    targetType: draft.targetType,
    targetLocator: draft.targetLocator,
    affectedComponent: draft.affectedComponent,
    network: draft.network,
    findingTitle: draft.findingTitle,
    bugCategory: draft.bugCategory,
    claimedSeverity: draft.claimedSeverity,
    impactStatement: draft.impactStatement,
    estimatedFinancialImpact: draft.estimatedFinancialImpact,
    privateEvidenceDigest,
    publicClaim: draft.publicClaim,
  };
}

export async function generatePrivateSeal(
  draft: ClaimDraft,
  options: { saltHex?: string; createdAt?: string } = {},
): Promise<PrivateSeal> {
  const saltHex = options.saltHex ?? secureRandomHex();
  const privateEvidenceDigest = await sha256Hex(
    canonicalizeClaim(draft.privateEvidence),
  );
  const canonicalClaim = canonicalizeClaim(
    claimSealMaterial(draft, privateEvidenceDigest),
  );
  const canonicalClaimHash = await sha256Hex(canonicalClaim);
  const sealMaterial = canonicalizeClaim({
    canonicalClaimHash,
    privateEvidenceDigest,
    saltHex,
    policyIdentifier: draft.publicClaim.policyIdentifier,
    policyVersion: draft.publicClaim.policyVersion,
  });
  const researcherFingerprint = await sha256Hex(sealMaterial);
  const nullifier = await sha256Hex(
    canonicalizeClaim({
      researcherFingerprint,
      programmeName: draft.programmeName,
      policyIdentifier: draft.publicClaim.policyIdentifier,
    }),
  );
  const claimIdentifier = `zs-${researcherFingerprint.slice(0, 12)}`;

  return {
    claimIdentifier,
    canonicalClaimHash,
    privateEvidenceDigest,
    saltHex,
    researcherFingerprint,
    nullifier,
    recoveryBundle: {
      schema: "zeroseal.private-recovery.v1",
      createdAt: options.createdAt ?? new Date().toISOString(),
      privateEvidence: draft.privateEvidence,
      saltHex,
      canonicalClaimHash,
      researcherFingerprint,
      nullifier,
    },
  };
}

export async function hashTargetSnapshot(draft: ClaimDraft): Promise<string> {
  return sha256Hex(
    canonicalizeClaim({
      targetType: draft.targetType,
      targetLocator: draft.targetLocator,
      affectedComponent: draft.affectedComponent,
      network: draft.network,
    }),
  );
}

export async function hashProgrammeContext(draft: ClaimDraft): Promise<string> {
  return sha256Hex(
    canonicalizeClaim({
      reportingContext: draft.reportingContext,
      programmeName: draft.programmeName,
      programmeUrl: draft.programmeUrl,
    }),
  );
}

export async function buildPublicPayloadAsync(
  draft: ClaimDraft,
  seal: PrivateSeal,
  options: {
    researcherPublicKey?: string | null;
    timestamp?: string;
    verificationResult?: PublicPayload["verificationResult"];
  } = {},
): Promise<PublicPayload> {
  return {
    claimIdentifier: seal.claimIdentifier,
    reportingContext: draft.reportingContext,
    programmeContext: draft.programmeName,
    programmeHash: await hashProgrammeContext(draft),
    targetSnapshotHash: await hashTargetSnapshot(draft),
    publicPolicyIdentifier: draft.publicClaim.policyIdentifier,
    publicPolicyVersion: draft.publicClaim.policyVersion,
    publicThreshold: draft.publicClaim.publicThreshold,
    researcherFingerprint: seal.researcherFingerprint,
    researcherPublicKey: options.researcherPublicKey ?? null,
    proofDigest: seal.canonicalClaimHash,
    nullifier: seal.nullifier,
    verifierVersion: draft.publicClaim.verifierVersion,
    verificationResult: options.verificationResult ?? "structural_only",
    network: "TESTNET",
    timestamp: options.timestamp ?? new Date().toISOString(),
  };
}

export function publicPayloadContainsOnlyAllowedFields(
  payload: Record<string, unknown>,
): boolean {
  return Object.keys(payload).every((key) =>
    PUBLIC_PAYLOAD_KEYS.has(key as keyof PublicPayload),
  );
}

export function assertPublicPayloadAllowed(
  payload: Record<string, unknown>,
): void {
  const forbidden = Object.keys(payload).filter(
    (key) => !PUBLIC_PAYLOAD_KEYS.has(key as keyof PublicPayload),
  );

  if (forbidden.length > 0) {
    throw new Error(`Private or unsupported public fields: ${forbidden.join(", ")}`);
  }
}

export function formatFingerprint(value: string | null | undefined): string {
  return value && value.length === 64
    ? `${value.slice(0, 8)}...${value.slice(-8)}`
    : "Not generated";
}

export function canContinueFromStep(step: number, draft: ClaimDraft): boolean {
  switch (step) {
    case 0:
      return Boolean(draft.reportingContext);
    case 1:
      return Boolean(
        draft.programmeName &&
          draft.targetType &&
          draft.targetLocator &&
          draft.affectedComponent,
      );
    case 2:
      return Boolean(
        draft.findingTitle &&
          draft.bugCategory &&
          draft.claimedSeverity &&
          draft.impactStatement,
      );
    case 3:
      return Boolean(
        draft.privateEvidence.vulnerabilityDescription &&
          draft.privateEvidence.reproductionSteps,
      );
    case 4:
      return Boolean(draft.publicClaim.publicThreshold);
    case 5:
      return Boolean(draft.privateSeal && draft.researcherFingerprint);
    case 6:
      return draft.state === "PUBLIC_CLAIM_REVIEWED";
    default:
      return true;
  }
}
