"use client";

import { Buffer } from "buffer";
import { useEffect, useState } from "react";

type ArtifactState =
  | "checking"
  | "ready"
  | "loaded"
  | "error";

type BrowserClaimArtifact = {
  schema: string;
  network: string;
  fields: {
    program_id: string;
    snapshot_id: string;
    impact_rule_id: string;
    minimum_loss: string;
    state_commitment: string;
    researcher_commitment: string;
    nullifier: string;
  };
  claim: {
    public_inputs_hex: string;
    proof_hex: string;
    public_inputs_bytes: number;
    proof_bytes: number;
    public_inputs_sha256: string;
    proof_sha256: string;
  };
};

export type VerifiedArtifact = {
  commitment: string;
  commitmentBase64: string;
  nullifier: string;
  publicInputsBytes: number;
  proofBytes: number;
  publicInputs: Array<{
    position: number;
    name: string;
    valueHex: string;
  }>;
  rawArtifact: BrowserClaimArtifact;
};

type Props = {
  onLoad: (artifact: VerifiedArtifact) => void;
};

function withoutPrefix(value: string): string {
  return value.replace(/^0x/i, "").toLowerCase();
}

function isHex(value: string): boolean {
  return /^[0-9a-f]+$/i.test(value);
}

function hexToBytes(value: string): Uint8Array {
  const normalized = withoutPrefix(value);

  if (
    normalized.length === 0 ||
    normalized.length % 2 !== 0 ||
    !isHex(normalized)
  ) {
    throw new Error("Malformed hexadecimal artifact data.");
  }

  const bytes = new Uint8Array(normalized.length / 2);

  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(
      normalized.slice(index, index + 2),
      16,
    );
  }

  return bytes;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const copied = Uint8Array.from(bytes);

  const digest = await crypto.subtle.digest(
    "SHA-256",
    copied.buffer,
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function shorten(value: string): string {
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function hexToBase64(value: string): string {
  return Buffer.from(withoutPrefix(value), "hex").toString("base64");
}

async function verifyArtifact(): Promise<VerifiedArtifact> {
  const response = await fetch(
    "/zeroseal/browser-claim.json",
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(
      `Artifact request failed with status ${response.status}.`,
    );
  }

  const artifact =
    (await response.json()) as BrowserClaimArtifact;

  if (artifact.schema !== "zeroseal.browser-claim.v1") {
    throw new Error("Unsupported proof artifact schema.");
  }

  if (artifact.network !== "TESTNET") {
    throw new Error("Proof artifact must target Stellar Testnet.");
  }

  const publicInputsHex = withoutPrefix(
    artifact.claim.public_inputs_hex,
  );

  const proofHex = withoutPrefix(
    artifact.claim.proof_hex,
  );

  const commitment = withoutPrefix(
    artifact.fields.researcher_commitment,
  );

  const nullifier = withoutPrefix(
    artifact.fields.nullifier,
  );

  if (
    publicInputsHex.length !== 224 * 2 ||
    artifact.claim.public_inputs_bytes !== 224
  ) {
    throw new Error("Public inputs must contain 224 bytes.");
  }

  if (
    proofHex.length !== 14592 * 2 ||
    artifact.claim.proof_bytes !== 14592
  ) {
    throw new Error("UltraHonk proof must contain 14592 bytes.");
  }

  if (commitment.length !== 64 || !isHex(commitment)) {
    throw new Error("Invalid researcher commitment.");
  }

  if (nullifier.length !== 64 || !isHex(nullifier)) {
    throw new Error("Invalid claim nullifier.");
  }

  const embeddedCommitment = publicInputsHex.slice(
    160 * 2,
    192 * 2,
  );

  const embeddedNullifier = publicInputsHex.slice(
    192 * 2,
    224 * 2,
  );

  if (embeddedCommitment !== commitment) {
    throw new Error(
      "Commitment does not match the public inputs.",
    );
  }

  if (embeddedNullifier !== nullifier) {
    throw new Error(
      "Nullifier does not match the public inputs.",
    );
  }

  const publicInputBytes = hexToBytes(publicInputsHex);
  const proofBytes = hexToBytes(proofHex);

  const [publicInputHash, proofHash] = await Promise.all([
    sha256(publicInputBytes),
    sha256(proofBytes),
  ]);

  if (
    publicInputHash !==
    artifact.claim.public_inputs_sha256.toLowerCase()
  ) {
    throw new Error("Public-input integrity check failed.");
  }

  if (
    proofHash !== artifact.claim.proof_sha256.toLowerCase()
  ) {
    throw new Error("Proof integrity check failed.");
  }

  return {
    commitment,
    commitmentBase64: hexToBase64(commitment),
    nullifier,
    publicInputsBytes: publicInputBytes.length,
    proofBytes: proofBytes.length,
    publicInputs: [
      "program_id",
      "snapshot_id",
      "impact_rule_id",
      "minimum_loss",
      "state_commitment",
      "researcher_commitment",
      "nullifier",
    ].map((name, position) => ({
      position,
      name,
      valueHex: artifact.fields[name as keyof BrowserClaimArtifact["fields"]],
    })),
    rawArtifact: artifact,
  };
}

export function VerifiedArtifactLoader({
  onLoad,
}: Props) {
  const [state, setState] =
    useState<ArtifactState>("checking");

  const [artifact, setArtifact] =
    useState<VerifiedArtifact | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const verified = await verifyArtifact();

        if (cancelled) {
          return;
        }

        setArtifact(verified);
        setError(null);
        setState("ready");
      } catch (reason) {
        if (cancelled) {
          return;
        }

        setArtifact(null);
        setState("error");

        setError(
          reason instanceof Error
            ? reason.message
            : "Artifact verification failed.",
        );
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadCommitment = () => {
    if (!artifact) {
      return;
    }

    onLoad(artifact);
    setState("loaded");
  };

  const status =
    state === "checking"
      ? "Checking proof package"
      : state === "ready"
        ? "Artifact structurally checked"
        : state === "loaded"
          ? "Sample proof package loaded"
          : "Artifact unavailable";

  return (
    <div
      className="zs-artifact-loader"
      data-state={state}
    >
      <span
        className="zs-artifact-loader__seal"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          role="presentation"
          focusable="false"
        >
          <path
            className="zs-artifact-loader__shield"
            d="M12 2 20 5.2v5.9c0 5-3.1 8.7-8 10.9-4.9-2.2-8-5.9-8-10.9V5.2L12 2Z"
          />
          <path
            className="zs-artifact-loader__check"
            d="m8.1 12 2.4 2.4 5.5-5.7"
          />
        </svg>
      </span>

      <div className="zs-artifact-loader__content">
        <span className="zs-artifact-loader__label">
          PROOF PACKAGE
        </span>

        <strong>{status}</strong>

        {artifact ? (
          <small>
            researcher fingerprint {shorten(artifact.commitment)}
            {" · "}
            base64 {artifact.commitmentBase64}
            {" · "}
            static demo artifact
          </small>
        ) : null}

        {artifact ? (
          <small>
            {shorten(artifact.commitment)}
            {" · "}
            {artifact.publicInputsBytes}B inputs
            {" · "}
            {artifact.proofBytes.toLocaleString()}B proof
            {" · "}
            nullifier {shorten(artifact.nullifier)}
          </small>
        ) : null}

        {error ? (
          <small className="zs-artifact-loader__error">
            {error}
          </small>
        ) : null}
      </div>

      <button
        type="button"
        className="zs-artifact-loader__button"
        onClick={loadCommitment}
        disabled={!artifact || state === "checking"}
      >
        {state === "loaded"
          ? "Loaded"
          : "Load sample proof package"}
      </button>
    </div>
  );
}
