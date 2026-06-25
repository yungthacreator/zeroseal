"use client";

import { useCallback, useRef, useState } from "react";

type ManifestEntry = {
  id: string;
  name: string;
  type: string;
  size: number;
  sha256: string;
};

export type EvidenceCommitmentPayload = {
  evidenceCommitment: string;
  manifestDigest: string;
  fileCount: number;
  totalBytes: number;
  canonicalisationVersion: string;
  contentTypes: string[];
};

type Props = {
  onCommitment?: (payload: EvidenceCommitmentPayload) => void;
  onClear?: () => void;
  bindingStatus?: string | null;
  compact?: boolean;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function shortHash(value: string): string {
  if (value.length <= 20) {
    return value;
  }
  return `${value.slice(0, 12)}\u2026${value.slice(-8)}`;
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256OfString(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  return sha256Hex(encoded.buffer as ArrayBuffer);
}

export function EvidenceManifest({
  onCommitment,
  onClear,
  bindingStatus,
  compact = false,
}: Props) {
  const [entries, setEntries] = useState<ManifestEntry[]>([]);
  const [manifestHash, setManifestHash] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const recomputeRoot = useCallback(async (list: ManifestEntry[]) => {
    if (list.length === 0) {
      setManifestHash(null);
      return;
    }

    // Deterministic manifest root: sort by filename, join per-file
    // digests, then hash the joined string. Order-independent and
    // reproducible from the same set of files.
    const ordered = [...list].sort((a, b) => a.name.localeCompare(b.name));
    const joined = ordered
      .map((entry) => `${entry.name}:${entry.size}:${entry.sha256}`)
      .join("\n");
    const root = await sha256OfString(joined);
    setManifestHash(root);
    onCommitment?.({
      evidenceCommitment: root,
      manifestDigest: root,
      fileCount: ordered.length,
      totalBytes: ordered.reduce((sum, entry) => sum + entry.size, 0),
      canonicalisationVersion: "zeroseal.evidence-manifest.v1",
      contentTypes: Array.from(new Set(ordered.map((entry) => entry.type))),
    });
  }, [onCommitment]);

  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);

      if (files.length === 0) {
        return;
      }

      setBusy(true);

      try {
        const next: ManifestEntry[] = [];

        for (const file of files) {
          const buffer = await file.arrayBuffer();
          const sha256 = await sha256Hex(buffer);
          next.push({
            id: `${file.name}-${file.size}-${sha256.slice(0, 8)}`,
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
            sha256,
          });
        }

        setEntries((current) => {
          const merged = [...current];
          for (const entry of next) {
            if (!merged.some((existing) => existing.id === entry.id)) {
              merged.push(entry);
            }
          }
          void recomputeRoot(merged);
          return merged;
        });
      } finally {
        setBusy(false);
      }
    },
    [recomputeRoot],
  );

  const removeEntry = useCallback(
    (id: string) => {
      setEntries((current) => {
        const next = current.filter((entry) => entry.id !== id);
        void recomputeRoot(next);
        return next;
      });
    },
    [recomputeRoot],
  );

  const clearAll = useCallback(() => {
    setEntries([]);
    setManifestHash(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onClear?.();
  }, [onClear]);

  const flash = useCallback((key: string) => {
    setCopied(key);
    window.setTimeout(
      () => setCopied((current) => (current === key ? null : current)),
      1400,
    );
  }, []);

  const buildManifest = useCallback(() => {
    return {
      schema: "zeroseal.evidence-manifest.v1",
      network: "TESTNET",
      created_locally: true,
      manifest_hash: manifestHash,
      file_count: entries.length,
      files: [...entries]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((entry) => ({
          name: entry.name,
          type: entry.type,
          size: entry.size,
          sha256: entry.sha256,
        })),
    };
  }, [entries, manifestHash]);

  const copyHash = useCallback(async () => {
    if (!manifestHash || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(manifestHash);
      flash("hash");
    } catch {
      // Hash remains visible for manual copy.
    }
  }, [flash, manifestHash]);

  const downloadManifest = useCallback(() => {
    const blob = new Blob([JSON.stringify(buildManifest(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "zeroseal-evidence-manifest.json";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [buildManifest]);

  return (
    <div className="manifest">
      {!compact ? (
        <div className="manifest__intro">
          <p className="eyebrow">Evidence commitment</p>
          <h2 className="display display--lg">
            Commit to evidence without exposing it
          </h2>
          <p className="lede">
            Select reports, screenshots, logs or proof-of-concept files.
            ZeroSeal hashes them in this browser and creates a deterministic
            evidence commitment.
          </p>

          <p className="manifest__local-note">
            Files stay on this device. ZeroSeal reads them locally to calculate
            a commitment and does not upload their contents.
          </p>

          <div className="manifest__privacy">
            <strong>PRIVATE</strong>
            <ul>
              <li>file contents</li>
              <li>exploit details</li>
              <li>reproduction steps</li>
              <li>supporting documents</li>
            </ul>
          </div>
        </div>
      ) : null}

      <div className="manifest__tool">
        <div className="manifest__bar">
          <span className="manifest__bar-label">Evidence commitment</span>
          <span className="manifest__bar-state">
            {busy
              ? "Hashing"
              : entries.length > 0
                ? `${entries.length} file${entries.length === 1 ? "" : "s"} selected`
                : "No files selected"}
          </span>
        </div>
        {bindingStatus ? (
          <p className="manifest__binding-status">
            Binding status: {bindingStatus.replaceAll("_", " ").toLowerCase()}
          </p>
        ) : null}

        <div
          className="manifest__drop"
          data-drag={dragging}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (event.dataTransfer.files) {
              void addFiles(event.dataTransfer.files);
            }
          }}
        >
          <strong>Drop evidence files here</strong>
          <span>PDF, images, logs, JSON, text and archives</span>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="visually-hidden"
            onChange={(event) => {
              if (event.target.files) {
                void addFiles(event.target.files);
              }
            }}
          />
        </div>

        {entries.length > 0 ? (
          <ul className="manifest__files">
            {entries.map((entry) => (
              <li key={entry.id} className="manifest__file">
                <span className="manifest__file-name">{entry.name}</span>
                <button
                  type="button"
                  className="manifest__file-remove"
                  onClick={() => removeEntry(entry.id)}
                  aria-label={`Remove ${entry.name}`}
                >
                  Remove
                </button>
                <span className="manifest__file-meta">
                  {entry.type} · {formatSize(entry.size)}
                </span>
                <span className="manifest__file-hash">
                  sha256 {shortHash(entry.sha256)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {manifestHash ? (
          <div className="manifest__root">
            <p className="manifest__root-label">Manifest commitment</p>
            <p className="manifest__root-hash">{manifestHash}</p>
          </div>
        ) : null}

        <div className="manifest__actions">
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => void copyHash()}
            disabled={!manifestHash}
          >
            {copied === "hash" ? "Copied" : "Copy commitment"}
          </button>
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={downloadManifest}
            disabled={entries.length === 0}
          >
            Download manifest
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={clearAll}
            disabled={entries.length === 0}
          >
            Clear files
          </button>
        </div>

        <p className="manifest__bound-note">
          Files remain on this device. ZeroSeal sends only permitted
          commitments and public claim data. This circuit does not currently
          constrain evidenceCommitment, so the digest is claim-attached rather
          than proof-bound.
        </p>
      </div>
    </div>
  );
}
