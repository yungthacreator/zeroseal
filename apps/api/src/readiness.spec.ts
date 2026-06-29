import assert from "node:assert/strict";
import test from "node:test";

import { checkRedisReady } from "./readiness";

void test("checkRedisReady reports ready after ping", async () => {
  class FakeRedis {
    connect() {
      return Promise.resolve();
    }
    ping() {
      return Promise.resolve("PONG");
    }
    quit() {
      return Promise.resolve();
    }
  }

  await assert.doesNotReject(() =>
    checkRedisReady("redis://127.0.0.1:6379", FakeRedis),
  );
});

void test("checkRedisReady reports Redis failures", async () => {
  class FakeRedis {
    connect() {
      return Promise.resolve();
    }
    ping() {
      return Promise.reject(new Error("redis offline"));
    }
    disconnect() {
      return undefined;
    }
  }

  await assert.rejects(
    () => checkRedisReady("redis://127.0.0.1:6379", FakeRedis),
    /redis offline/,
  );
});
