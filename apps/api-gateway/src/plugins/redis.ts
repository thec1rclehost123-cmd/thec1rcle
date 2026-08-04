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
      enableOfflineQueue: false,
      connectTimeout: 2000,
      lazyConnect: true,
      retryStrategy: () => null,
    });

    redis.on('error', (err) => {
      fastify.log.warn(`Redis unavailable: ${err.message}`);
    });

    // `lazyConnect` prevents import-time network work, but the plugin must
    // establish and prove the connection before advertising Redis as usable.
    await redis.connect();
    await redis.ping();

    fastify.decorate('redis', redis);
    fastify.log.info('Redis connection established and verified');

    fastify.addHook('onClose', async () => {
      if (redis?.status !== 'end') await redis?.quit();
    });
  } catch (err) {
    redis?.disconnect(false);
    const unavailable = () => Promise.reject(new Error('REDIS_UNAVAILABLE'));
    const unavailableSync = () => {
      throw new Error('REDIS_UNAVAILABLE');
    };

    fastify.log.error(`Critical Redis Plugin Error: ${err}. Redis commands will fail closed.`);
    fastify.decorate('redis', {
      get: unavailable,
      set: unavailable,
      del: unavailable,
      incr: unavailable,
      expire: unavailable,
      publish: unavailable,
      scan: unavailable,
      flushdb: unavailable,
      info: unavailable,
      multi: unavailableSync,
      status: 'end',
    } as any);
  }
});

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}
