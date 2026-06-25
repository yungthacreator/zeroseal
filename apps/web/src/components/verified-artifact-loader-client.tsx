"use client";

import dynamic from "next/dynamic";
import type { VerifiedArtifact } from "@/components/verified-artifact-loader";

type VerifiedArtifactLoaderClientProps = {
  onLoad: (artifact: VerifiedArtifact) => void;
};

const ClientOnlyArtifactLoader =
  dynamic<VerifiedArtifactLoaderClientProps>(
    () =>
      import(
        "@/components/verified-artifact-loader"
      ).then(
        (module) =>
          module.VerifiedArtifactLoader,
      ),
    {
      ssr: false,
      loading: () => (
        <div
          className="
            zs-artifact-loader
            zs-artifact-loader--client-loading
          "
          role="status"
          aria-live="polite"
        >
          <span
            className="
              zs-artifact-loader__loading-mark
            "
            aria-hidden="true"
          />

          <div
            className="
              zs-artifact-loader__content
            "
          >
            <span
              className="
                zs-artifact-loader__label
              "
            >
              PROOF ARTIFACT
            </span>

            <strong>
              Loading proof artifact
            </strong>
          </div>
        </div>
      ),
    },
  );

export function VerifiedArtifactLoaderClient({
  onLoad,
}: VerifiedArtifactLoaderClientProps) {
  return (
    <ClientOnlyArtifactLoader
      onLoad={onLoad}
    />
  );
}
