import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import crypto from 'crypto';

/**
 * ⚡ Hybrid Cache Provider (Redis + In-Memory Fallback)
 * 
 * Automatically selects the best available storage.
 * Standardizes key hashing to prevent collisions and handle large query params.
 */
class HybridCache {
    private memoryStore = new Map<string, { value: any; expiry: number }>();
    private fastify: FastifyInstance;

    constructor(fastify: FastifyInstance) {
        this.fastify = fastify;
    }

    private hashKey(key: string): string {
        return crypto.createHash('md5').update(key).digest('hex');
    }

    async set(namespace: string, rawKey: string, value: any, ttlSeconds: number = 60) {
        const key = `${namespace}:${this.hashKey(rawKey)}`;
        const json = JSON.stringify(value);

        // 1. Try Redis
        if (this.fastify.redis && this.fastify.redis.status === 'ready') {
            try {
                await this.fastify.redis.set(key, json, 'EX', ttlSeconds);
                return;
            } catch (err) {
                this.fastify.log.warn(`Cache Set Error (Redis): ${err}`);
            }
        }

        // 2. Fallback to Memory
        const expiry = Date.now() + ttlSeconds * 1000;
        this.memoryStore.set(key, { value, expiry });
    }

    async get(namespace: string, rawKey: string) {
        const key = `${namespace}:${this.hashKey(rawKey)}`;

        // 1. Try Redis
        if (this.fastify.redis && this.fastify.redis.status === 'ready') {
            try {
                const cached = await this.fastify.redis.get(key);
                if (cached) return JSON.parse(cached);
            } catch (err) {
                this.fastify.log.warn(`Cache Get Error (Redis): ${err}`);
            }
        }

        // 2. Try Memory Fallback
        const item = this.memoryStore.get(key);
        if (!item) return null;

        if (Date.now() > item.expiry) {
            this.memoryStore.delete(key);
            return null;
        }

        return item.value;
    }

    async delete(namespace: string, rawKey: string) {
        const key = `${namespace}:${this.hashKey(rawKey)}`;
        if (this.fastify.redis) await this.fastify.redis.del(key);
        this.memoryStore.delete(key);
    }
}

export default fp(async (fastify: FastifyInstance) => {
    const cache = new HybridCache(fastify);
    fastify.decorate('cache', cache);
    fastify.log.info('Hybrid cache plugin (Redis-ready) initialized');
});

declare module 'fastify' {
    interface FastifyInstance {
        cache: HybridCache;
    }
}
