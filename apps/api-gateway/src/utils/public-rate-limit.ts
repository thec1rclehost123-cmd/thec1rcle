import { FastifyInstance, FastifyRequest } from 'fastify';

const memoryCounters = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: FastifyRequest) {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0].trim();
    }
    return request.ip || 'unknown';
}

export async function enforcePublicRateLimit(
    fastify: FastifyInstance,
    request: FastifyRequest,
    keyPrefix: string,
    limit: number,
    windowSeconds: number
) {
    const ip = getClientIp(request);
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const resetAt = now + windowSeconds * 1000;

    if (fastify.redis && fastify.redis.status === 'ready') {
        const redisKey = `public-rate-limit:${key}`;
        const multi = fastify.redis.multi();
        multi.incr(redisKey);
        multi.expire(redisKey, windowSeconds);
        const results = await multi.exec();
        const count = Number(results?.[0]?.[1] || 0);
        if (count > limit) {
            throw new Error('RATE_LIMITED');
        }
        return;
    }

    const current = memoryCounters.get(key);
    if (!current || current.resetAt <= now) {
        memoryCounters.set(key, { count: 1, resetAt });
        return;
    }
    if (current.count >= limit) {
        throw new Error('RATE_LIMITED');
    }
    current.count += 1;
    memoryCounters.set(key, current);
}
