import { FastifyInstance, FastifyReply } from 'fastify';

const memoryVersions = new Map<string, number>();

async function getNamespaceVersion(fastify: FastifyInstance, namespace: string): Promise<number> {
  const redis = fastify.redis;
  const redisKey = `public-cache-version:${namespace}`;

  if (redis && redis.status === 'ready') {
    try {
      const cached = await redis.get(redisKey);
      if (cached) return Number(cached) || 1;
      await redis.set(redisKey, '1');
      return 1;
    } catch (error) {
      fastify.log.warn({ error, namespace }, 'Failed to read public cache version from redis');
    }
  }

  if (!memoryVersions.has(namespace)) {
    memoryVersions.set(namespace, 1);
  }
  return memoryVersions.get(namespace) || 1;
}

export async function buildVersionedPublicCacheKey(
  fastify: FastifyInstance,
  namespace: string,
  rawKey: string,
) {
  const version = await getNamespaceVersion(fastify, namespace);
  return `v${version}:${rawKey}`;
}

export async function bumpPublicCacheVersion(fastify: FastifyInstance, namespace: string) {
  const redis = fastify.redis;
  const redisKey = `public-cache-version:${namespace}`;

  if (redis && redis.status === 'ready') {
    try {
      const next = await redis.incr(redisKey);
      return next;
    } catch (error) {
      fastify.log.warn({ error, namespace }, 'Failed to bump public cache version in redis');
    }
  }

  const next = (memoryVersions.get(namespace) || 1) + 1;
  memoryVersions.set(namespace, next);
  return next;
}

export function applyPublicCacheHeaders(reply: FastifyReply, ttlSeconds: number) {
  reply.header(
    'Cache-Control',
    `public, max-age=0, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds}`,
  );
  reply.header('Vary', 'Accept-Encoding');
}
