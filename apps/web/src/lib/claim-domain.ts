export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type ResearcherCommitment = Brand<string, "ResearcherCommitment">;
export type EvidenceManifestCommitment = Brand<
  string,
  "EvidenceManifestCommitment"
>;
export type ProofArtifactDigest = Brand<string, "ProofArtifactDigest">;
export type ClaimPublicInputDigest = Brand<string, "ClaimPublicInputDigest">;
export type Nullifier = Brand<string, "Nullifier">;

export type RegistrationTransaction = {
  kind: "registration_transaction";
  transactionHash: string;
  researcherCommitment: ResearcherCommitment;
};

export type ClaimTransaction = {
  kind: "claim_transaction";
  transactionHash: string;
  nullifier: Nullifier;
};

export type ClaimReceipt = {
  kind: "claim_receipt";
  receiptId: string;
  transactionHash: string;
};

export function asResearcherCommitment(value: string): ResearcherCommitment {
  return value as ResearcherCommitment;
}

export function asEvidenceManifestCommitment(
  value: string,
): EvidenceManifestCommitment {
  return value as EvidenceManifestCommitment;
}

export function asProofArtifactDigest(value: string): ProofArtifactDigest {
  return value as ProofArtifactDigest;
}

export function asClaimPublicInputDigest(
  value: string,
): ClaimPublicInputDigest {
  return value as ClaimPublicInputDigest;
}

export function asNullifier(value: string): Nullifier {
  return value as Nullifier;
}
