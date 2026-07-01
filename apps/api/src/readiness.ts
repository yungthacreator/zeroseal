import Redis from "ioredis";

type RedisLike = {
  connect: () => Promise<unknown>;
  ping: () => Promise<unknown>;
  quit?: () => Promise<unknown>;
  disconnect?: () => void;
};

type RedisConstructor = new (url: string, options: unknown) => RedisLike;

export async function checkRedisReady(
  redisUrl: string,
  RedisClass: RedisConstructor = Redis as unknown as RedisConstructor,
): Promise<void> {
  const redis = new RedisClass(redisUrl, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
  });

  try {
    await redis.connect();
    const pong = await redis.ping();
    if (pong !== "PONG") {
      throw new Error("Redis readiness check failed.");
    }
  } finally {
    if (redis.quit) {
      await redis.quit().catch(() => redis.disconnect?.());
    } else {
      redis.disconnect?.();
    }
  }
}

export async function checkStellarRpcReady(rpcUrl: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "zeroseal-ready",
        method: "getHealth",
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Stellar RPC returned HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as {
      result?: { status?: string };
      error?: unknown;
    };

    if (payload.error || !payload.result) {
      throw new Error("Stellar RPC readiness check failed.");
    }
  } finally {
    clearTimeout(timeout);
  }
}
