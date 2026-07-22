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

  let redis: Redis | null = null;
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: false,
      retryStrategy: (times) => {
        return Math.min(times * 250, 5000);
      },
    });

    // 🛡️ Resilience: Handle connection errors without crashing the process
    redis.on('error', (err) => {
      fastify.log.warn(`Redis unavailable: ${err.message}. Using mock fallback.`);
    });

    redis.on('ready', () => {
      fastify.log.info('Redis connection ready');
    });

    // Cache callers already check `status`, while security-sensitive callers
    // receive a real Redis error instead of a false successful no-op if the
    // dependency is unavailable. The client reconnects in the background.
    fastify.decorate('redis', redis);

    fastify.addHook('onClose', async () => {
      if (!redis || redis.status === 'end') return;
      if (redis.status === 'ready') await redis.quit();
      else redis.disconnect();
    });
  } catch (err) {
    fastify.log.error(`Critical Redis Plugin Error: ${err}`);
    redis?.disconnect();
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
