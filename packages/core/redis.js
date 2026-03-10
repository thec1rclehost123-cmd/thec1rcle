import { Redis } from "ioredis";

/**
 * THE C1RCLE - Centralized Redis Client
 * 
 * Provides a shared connection pool for all apps in the monorepo.
 * Uses environment variables for configuration.
 */

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let redis = null;

export function getRedisClient() {
    if (!redis) {
        redis = new Redis(REDIS_URL, {
            maxRetriesPerRequest: 3,
            enableOfflineQueue: false,
            connectTimeout: 5000,
            commandTimeout: 2000,
            retryStrategy(times) {
                const delay = Math.min(times * 100, 2000);
                return delay;
            },
        });

        redis.on("error", (err) => {
            console.error("[Redis] Client Error:", err.message);
        });

        redis.on("connect", () => {
            console.log("✅ Redis connected successfully");
        });
    }

    return redis;
}

export default getRedisClient;
