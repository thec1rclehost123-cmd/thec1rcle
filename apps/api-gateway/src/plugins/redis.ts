import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
import { FastifyInstance } from 'fastify';

/**
 * ⚡ Persistent Redis Client Plugin
 *
 * Provides a singleton Redis connection for high-performance caching.
 * Falls back gracefully if Redis is unavailable.
 */
export default fp(async (fastify: FastifyInstance) => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true, // ⚡ Optimization: Don't connect immediately
      retryStrategy: (times) => {
        return null; // Stop retrying immediately in dev
      },
    });

    // 🛡️ Resilience: Handle connection errors without crashing the process
    redis.on('error', (err) => {
      fastify.log.warn(`Redis unavailable: ${err.message}. Using mock fallback.`);
    });

    // Decorate with a proxy that avoids crashing if redis is called while disconnected
    const redisProxy = new Proxy(redis, {
      get(target, prop) {
        const val = target[prop as keyof Redis];
        if (redis.status !== 'ready' && typeof val === 'function') {
          // Return a no-op function that logs a warning
          return (...args: any[]) => {
            fastify.log.debug(`Redis [${String(prop)}] skipped - client not ready`);
            return Promise.resolve(null);
          };
        }
        return val;
      },
    });

    fastify.decorate('redis', redisProxy as any);

    fastify.addHook('onClose', async () => {
      if (redis.status !== 'end') await redis.quit();
    });
  } catch (err) {
    fastify.log.error(`Critical Redis Plugin Error: ${err}`);
    // Fallback to a bare-bones mock if even the constructor fails
    fastify.decorate('redis', {
      get: () => Promise.resolve(null),
      set: () => Promise.resolve(null),
      del: () => Promise.resolve(null),
      status: 'end',
    } as any);
  }
});

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}
