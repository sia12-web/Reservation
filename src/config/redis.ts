import Redis from "ioredis";
import Redlock from "redlock";
import { env } from "./env";

export const redis = new Redis(env.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 0,
});

redis.on("error", (err) => {
  console.error("[ioredis] Main connection error:", err.message);
});

const realRedlock = new Redlock([redis], {
  retryCount: 3,
  retryDelay: 200,
  retryJitter: 50,
});

export const redlock = (env.nodeEnv === 'test' || process.env.USE_MOCK_REDIS === 'true')
  ? {
    acquire: async (resources: string[], _duration: number) => {
      console.warn(`Using MOCK redlock acquisition (NODE_ENV=${env.nodeEnv}, USE_MOCK=${process.env.USE_MOCK_REDIS}) for:`, resources);
      return {
        release: async () => {
          // no-op
        },
      };
    },
  } as unknown as Redlock
  : realRedlock;

