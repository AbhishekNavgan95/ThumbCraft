import { Redis } from "ioredis";

/** Shared Redis connection factory for BullMQ (maxRetriesPerRequest must be null). */
export function createRedisConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
  });
}
