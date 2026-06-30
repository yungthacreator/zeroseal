"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { REPORTING_PATHS } from "@/lib/reporting-paths";

const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;

export function CompactClaimWorkspace() {
  const [path, setPath] = useState("Immunefi");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("Critical");

  const createUrl = useMemo(() => {
    const params = new URLSearchParams({
      path,
      severity,
    });
    return `/create?${params.toString()}`;
  }, [path, severity]);

  return (
    <section className="section section--paper compact-workspace" id="proof-workspace">
      <div className="shell compact-workspace__inner">
        <header>
          <p className="eyebrow">COMPACT WORKSPACE</p>
          <h2 className="display display--md">Start a claim in seconds.</h2>
          <p className="lede">
            Pick the reporting path and severity, then continue into the private claim creator.
          </p>
        </header>

        <form className="compact-workspace__form">
          <label>
            <span>Reporting path</span>
            <select value={path} onChange={(event) => setPath(event.target.value as typeof path)}>
              {REPORTING_PATHS.map((option) => (
                <option key={option.id} value={option.name}>{option.name}</option>
              ))}
            </select>
          </label>

          <fieldset className="compact-workspace__severity">
            <legend>Severity</legend>
            {SEVERITIES.map((option) => (
              <button
                key={option}
                type="button"
                data-selected={severity === option}
                aria-pressed={severity === option}
                onClick={() => setSeverity(option)}
              >
                {option}
              </button>
            ))}
          </fieldset>

          <Link className="btn btn--primary" href={createUrl}>
            Continue creating claim
          </Link>
        </form>
      </div>
    </section>
  );
}
