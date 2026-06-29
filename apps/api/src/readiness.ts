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
