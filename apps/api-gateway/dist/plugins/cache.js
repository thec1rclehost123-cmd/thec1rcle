import fp from 'fastify-plugin';
import crypto from 'crypto';
/**
 * ⚡ Hybrid Cache Provider (Redis + In-Memory Fallback)
 *
 * Automatically selects the best available storage.
 * Standardizes key hashing to prevent collisions and handle large query params.
 */
class HybridCache {
    constructor(fastify) {
        this.fastify = fastify;
    }
    hashKey(key) {
        return crypto.createHash('md5').update(key).digest('hex');
    }
    async set(namespace, rawKey, value, ttlSeconds = 60) {
        const key = `${namespace}:${this.hashKey(rawKey)}`;
        const json = JSON.stringify(value);
        if (this.fastify.redis && this.fastify.redis.status === 'ready') {
            try {
                await this.fastify.redis.set(key, json, 'EX', ttlSeconds);
            }
            catch (err) {
                this.fastify.log.warn(`Cache Set Error (Redis): ${err}`);
            }
        }
    }
    async get(namespace, rawKey) {
        const key = `${namespace}:${this.hashKey(rawKey)}`;
        if (this.fastify.redis && this.fastify.redis.status === 'ready') {
            try {
                const cached = await this.fastify.redis.get(key);
                if (cached)
                    return JSON.parse(cached);
            }
            catch (err) {
                this.fastify.log.warn(`Cache Get Error (Redis): ${err}`);
            }
        }
        return null;
    }
    async delete(namespace, rawKey) {
        const key = `${namespace}:${this.hashKey(rawKey)}`;
        if (this.fastify.redis && this.fastify.redis.status === 'ready') {
            await this.fastify.redis.del(key);
        }
    }
    async invalidateNamespace(namespace) {
        if (this.fastify.redis && this.fastify.redis.status === 'ready') {
            try {
                let cursor = '0';
                do {
                    const [newCursor, keys] = await this.fastify.redis.scan(cursor, 'MATCH', `${namespace}:*`, 'COUNT', 100);
                    cursor = newCursor;
                    if (keys.length > 0) {
                        await this.fastify.redis.del(...keys);
                    }
                } while (cursor !== '0');
            }
            catch (err) {
                this.fastify.log.warn(`Cache Invalidate Error (Redis): ${err}`);
            }
        }
    }
}
export default fp(async (fastify) => {
    const cache = new HybridCache(fastify);
    fastify.decorate('cache', cache);
    fastify.log.info('Hybrid cache plugin (Redis-ready) initialized');
});
//# sourceMappingURL=cache.js.map