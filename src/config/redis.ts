import Redis from "ioredis";
import Redlock from "redlock";
import { env } from "./env";
import { logger } from "./logger";

export const redis = new Redis(env.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 0,
});

redis.on("error", (err) => {
  logger.error({ err: err.message }, "[ioredis] Main connection error");
});

const realRedlock = new Redlock([redis], {
  retryCount: 3,
  retryDelay: 200,
  retryJitter: 50,
});

export const redlock = (env.nodeEnv === 'test' || process.env.USE_MOCK_REDIS === 'true')
  ? {
    acquire: async (resources: string[], _duration: number) => {
      logger.warn({ resources }, `Using MOCK redlock (NODE_ENV=${env.nodeEnv})`);
      return {
        release: async () => {
          // no-op
        },
      };
    },
  } as unknown as Redlock
  : realRedlock;

