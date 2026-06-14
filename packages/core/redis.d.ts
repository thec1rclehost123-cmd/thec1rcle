export function getRedisClient(): any;
export function cacheGet(key: any): Promise<any>;
export function cacheSet(key: any, value: any, ttlSeconds?: number): Promise<boolean>;
export function cacheDel(key: any): Promise<boolean>;
export default getRedisClient;
