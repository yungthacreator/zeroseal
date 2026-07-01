import assert from "node:assert/strict";
import test from "node:test";

import { getWorkerReadiness } from "./health.controller";

void test("worker readiness reports ready when the embedded worker is enabled", () => {
  assert.equal(
    getWorkerReadiness({
      RUN_EMBEDDED_WORKER: true,
      WORKER_REQUIRED_FOR_READY: true,
    }),
    "ready",
  );
});

void test("worker readiness reports unavailable when a required worker is disabled", () => {
  assert.equal(
    getWorkerReadiness({
      RUN_EMBEDDED_WORKER: false,
      WORKER_REQUIRED_FOR_READY: true,
    }),
    "unavailable",
  );
});

void test("worker readiness reports not_required when reconciliation is handled outside this API process", () => {
  assert.equal(
    getWorkerReadiness({
      RUN_EMBEDDED_WORKER: false,
      WORKER_REQUIRED_FOR_READY: false,
    }),
    "not_required",
  );
});
