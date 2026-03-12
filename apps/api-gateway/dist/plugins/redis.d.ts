import { Redis } from 'ioredis';
import { FastifyInstance } from 'fastify';
/**
 * ⚡ Persistent Redis Client Plugin
 *
 * Provides a singleton Redis connection for high-performance caching.
 * Falls back gracefully if Redis is unavailable.
 */
declare const _default: (fastify: FastifyInstance) => Promise<void>;
export default _default;
declare module 'fastify' {
    interface FastifyInstance {
        redis: Redis;
    }
}
//# sourceMappingURL=redis.d.ts.map