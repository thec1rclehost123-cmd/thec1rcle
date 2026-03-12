import { FastifyInstance } from 'fastify';
/**
 * ⚡ Hybrid Cache Provider (Redis + In-Memory Fallback)
 *
 * Automatically selects the best available storage.
 * Standardizes key hashing to prevent collisions and handle large query params.
 */
declare class HybridCache {
    private memoryStore;
    private fastify;
    constructor(fastify: FastifyInstance);
    private hashKey;
    set(namespace: string, rawKey: string, value: any, ttlSeconds?: number): Promise<void>;
    get(namespace: string, rawKey: string): Promise<any>;
    delete(namespace: string, rawKey: string): Promise<void>;
    invalidateNamespace(namespace: string): Promise<void>;
}
declare const _default: (fastify: FastifyInstance) => Promise<void>;
export default _default;
declare module 'fastify' {
    interface FastifyInstance {
        cache: HybridCache;
    }
}
//# sourceMappingURL=cache.d.ts.map