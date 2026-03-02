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
        this.memoryStore = new Map();
        this.fastify = fastify;
    }
    hashKey(key) {
        return crypto.createHash('md5').update(key).digest('hex');
    }
    async set(namespace, rawKey, value, ttlSeconds = 60) {
        const key = `${namespace}:${this.hashKey(rawKey)}`;
        const json = JSON.stringify(value);
        // 1. Try Redis
        if (this.fastify.redis && this.fastify.redis.status === 'ready') {
            try {
                await this.fastify.redis.set(key, json, 'EX', ttlSeconds);
                return;
            }
            catch (err) {
                this.fastify.log.warn(`Cache Set Error (Redis): ${err}`);
            }
        }
        // 2. Fallback to Memory
        const expiry = Date.now() + ttlSeconds * 1000;
        this.memoryStore.set(key, { value, expiry });
    }
    async get(namespace, rawKey) {
        const key = `${namespace}:${this.hashKey(rawKey)}`;
        // 1. Try Redis
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
        // 2. Try Memory Fallback
        const item = this.memoryStore.get(key);
        if (!item)
            return null;
        if (Date.now() > item.expiry) {
            this.memoryStore.delete(key);
            return null;
        }
        return item.value;
    }
    async delete(namespace, rawKey) {
        const key = `${namespace}:${this.hashKey(rawKey)}`;
        if (this.fastify.redis)
            await this.fastify.redis.del(key);
        this.memoryStore.delete(key);
    }
    async invalidateNamespace(namespace) {
        // 1. Clear Memory
        for (const [k] of this.memoryStore) {
            if (k.startsWith(`${namespace}:`)) {
                this.memoryStore.delete(k);
            }
        }
        // 2. Clear Redis (SCAN and DEL)
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