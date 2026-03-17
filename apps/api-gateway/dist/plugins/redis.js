import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
/**
 * ⚡ Persistent Redis Client Plugin
 *
 * Provides a singleton Redis connection for high-performance caching.
 * Falls back gracefully if Redis is unavailable.
 */
export default fp(async (fastify) => {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
        const redis = new Redis(redisUrl, {
            maxRetriesPerRequest: 1,
            connectTimeout: 2000, // ⚡ Failure Isolation: Don't hang if Redis is unreachable
            retryStrategy: (times) => {
                if (times > 3)
                    return null; // Stop retrying after 3 attempts
                return Math.min(times * 100, 2000);
            }
        });
        redis.on('error', (err) => {
            fastify.log.warn(`Redis connection error: ${err.message}`);
        });
        redis.on('connect', () => {
            fastify.log.info('Successfully connected to Redis');
        });
        fastify.decorate('redis', redis);
        // Ensure clean shutdown
        fastify.addHook('onClose', async () => {
            await redis.quit();
        });
    }
    catch (err) {
        fastify.log.error(`Failed to initialize Redis: ${err}`);
        // We don't exit process, allowing fallback to in-memory cache
    }
});
//# sourceMappingURL=redis.js.map