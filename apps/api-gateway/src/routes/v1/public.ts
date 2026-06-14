import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { applyPublicCacheHeaders, buildVersionedPublicCacheKey, bumpPublicCacheVersion } from '../../utils/public-cache';
import { enforcePublicRateLimit } from '../../utils/public-rate-limit';
import { buildErrorResponse } from '../../lib/api-contracts';
// @ts-ignore
import { getHomepageInterviews, getHomepageSelects } from '@c1rcle/core/homepage-curation-engine';
// @ts-ignore
import { normalizeCityKey } from '@c1rcle/core/guest-discovery-engine';

const publicListQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.string().optional(),
    lastId: z.string().optional(),
    sort: z.string().optional(),
    city: z.string().optional(),
    cityKey: z.string().optional(),
    search: z.string().optional(),
    q: z.string().optional(),
    role: z.string().optional(),
    vibe: z.string().optional(),
    status: z.string().optional(),
    area: z.string().optional(),
    areaKey: z.string().optional(),
    tablesOnly: z.string().optional(),
    tablesAvailable: z.string().optional(),
    type: z.string().optional(),
    eventType: z.string().optional(),
    curatedCategory: z.string().optional(),
    priceType: z.string().optional(),
    dayKey: z.string().optional(),
    host: z.string().optional(),
    hostId: z.string().optional(),
    hostSlug: z.string().optional(),
    venue: z.string().optional(),
    venueId: z.string().optional(),
    venueSlug: z.string().optional(),
}).passthrough();

const publicSearchQuerySchema = publicListQuerySchema.extend({
    q: z.string().optional(),
    type: z.string().optional(),
    offset: z.coerce.number().int().min(0).optional(),
});

const slugParamSchema = z.object({
    slug: z.string().min(1),
});

const eventParamSchema = z.object({
    idOrSlug: z.string().min(1),
});

const PUBLIC_EVENTS_CACHE_SCHEMA_VERSION = 3;

function createApiError(requestId: string, code: string, message: string) {
    return buildErrorResponse({ code, message, requestId });
}

function sortObjectKeys(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sortObjectKeys);
    const sorted: any = {};
    Object.keys(obj).sort().forEach(key => {
        sorted[key] = sortObjectKeys(obj[key]);
    });
    return sorted;
}

function normalizePublicDiscoveryQuery(rawQuery: Record<string, any> = {}) {
    const query = { ...(rawQuery || {}) };
    const normalizedCityKey = normalizeCityKey(query.cityKey || query.city || null);

    if (normalizedCityKey) {
        query.cityKey = normalizedCityKey;
        delete query.city;
    }

    if (query.sort) {
        const normalizedSort = String(query.sort).trim().toLowerCase();
        query.sort = normalizedSort === 'trending' || normalizedSort === 'popular'
            ? 'heat'
            : normalizedSort === 'newest'
                ? 'new'
                : normalizedSort;
    }

    return sortObjectKeys(query);
}

async function cachedPublic<T>(
    fastify: FastifyInstance,
    namespace: string,
    rawKey: string,
    ttlSeconds: number,
    factory: () => Promise<T>
) {
    const cacheKey = await buildVersionedPublicCacheKey(fastify, namespace, rawKey);
    const cached = await fastify.cache.get('public-discovery', cacheKey);
    if (cached) return cached;
    const value = await factory();
    await fastify.cache.set('public-discovery', cacheKey, value, ttlSeconds);
    return value;
}

export default async function publicRoutes(fastify: FastifyInstance) {
    fastify.decorate('invalidatePublicDiscovery', async (target: 'events' | 'hosts' | 'venues' | 'search' | 'all' = 'all') => {
        const namespaces = target === 'all' ? ['events', 'hosts', 'venues', 'search', 'homepage'] : [target];
        for (const namespace of namespaces) {
            await bumpPublicCacheVersion(fastify, namespace);
        }
    });

    fastify.get('/homepage/selects', async (request: any, reply) => {
        try {
            await enforcePublicRateLimit(fastify, request, 'public:homepage-selects', 60, 60);
            applyPublicCacheHeaders(reply, 300);
            return await cachedPublic(
                fastify,
                'homepage',
                'selects',
                300,
                () => getHomepageSelects()
            );
        } catch (error: any) {
            if (error.message === 'RATE_LIMITED') return reply.status(429).send(createApiError(request.id, 'RATE_LIMITED', 'Too many requests'));
            request.log.error({ error }, 'Failed to list homepage selects');
            return reply.status(500).send(createApiError(request.id, 'INTERNAL_ERROR', 'Unable to load homepage selects'));
        }
    });

    fastify.get('/homepage/interviews', async (request: any, reply) => {
        try {
            await enforcePublicRateLimit(fastify, request, 'public:homepage-interviews', 60, 60);
            applyPublicCacheHeaders(reply, 300);
            return await cachedPublic(
                fastify,
                'homepage',
                'interviews',
                300,
                () => getHomepageInterviews()
            );
        } catch (error: any) {
            if (error.message === 'RATE_LIMITED') return reply.status(429).send(createApiError(request.id, 'RATE_LIMITED', 'Too many requests'));
            request.log.error({ error }, 'Failed to list homepage interviews');
            return reply.status(500).send(createApiError(request.id, 'INTERNAL_ERROR', 'Unable to load homepage interviews'));
        }
    });

    fastify.get('/events', { preHandler: fastify.validate({ querystring: publicListQuerySchema }) }, async (request: any, reply) => {
        try {
            await enforcePublicRateLimit(fastify, request, 'public:events', 120, 60);
            applyPublicCacheHeaders(reply, 60);
            const normalizedQuery = normalizePublicDiscoveryQuery(request.query || {});
            return await cachedPublic(
                fastify,
                'events',
                `v${PUBLIC_EVENTS_CACHE_SCHEMA_VERSION}:${JSON.stringify(normalizedQuery)}`,
                60,
                () => fastify.publicDiscoveryService.listEvents(normalizedQuery)
            );
        } catch (error: any) {
            if (error.message === 'RATE_LIMITED') return reply.status(429).send(createApiError(request.id, 'RATE_LIMITED', 'Too many requests'));
            request.log.error({ error }, 'Failed to list public events');
            return reply.status(500).send(createApiError(request.id, 'INTERNAL_ERROR', 'Unable to load public events'));
        }
    });

    fastify.get('/events/featured', { preHandler: fastify.validate({ querystring: publicListQuerySchema }) }, async (request: any, reply) => {
        try {
            await enforcePublicRateLimit(fastify, request, 'public:events-featured', 120, 60);
            applyPublicCacheHeaders(reply, 60);
            const normalizedQuery = normalizePublicDiscoveryQuery(request.query || {});
            return await cachedPublic(
                fastify,
                'events',
                `featured:v${PUBLIC_EVENTS_CACHE_SCHEMA_VERSION}:${JSON.stringify(normalizedQuery)}`,
                60,
                () => fastify.publicDiscoveryService.listFeaturedEvents(normalizedQuery)
            );
        } catch (error: any) {
            if (error.message === 'RATE_LIMITED') return reply.status(429).send(createApiError(request.id, 'RATE_LIMITED', 'Too many requests'));
            request.log.error({ error }, 'Failed to list featured public events');
            return reply.status(500).send(createApiError(request.id, 'INTERNAL_ERROR', 'Unable to load featured public events'));
        }
    });

    fastify.get('/events/:idOrSlug', { preHandler: fastify.validate({ params: eventParamSchema }) }, async (request: any, reply) => {
        try {
            await enforcePublicRateLimit(fastify, request, 'public:event-detail', 120, 60);
            applyPublicCacheHeaders(reply, 60);
            const result = await cachedPublic(
                fastify,
                'events',
                `detail:v${PUBLIC_EVENTS_CACHE_SCHEMA_VERSION}:${request.params.idOrSlug}`,
                60,
                () => fastify.publicDiscoveryService.getEventDetail(request.params.idOrSlug)
            );
            if (!result) return reply.status(404).send(createApiError(request.id, 'NOT_FOUND', 'Event not found'));
            return result;
        } catch (error: any) {
            if (error.message === 'RATE_LIMITED') return reply.status(429).send(createApiError(request.id, 'RATE_LIMITED', 'Too many requests'));
            request.log.error({ error }, 'Failed to get public event detail');
            return reply.status(500).send(createApiError(request.id, 'INTERNAL_ERROR', 'Unable to load public event'));
        }
    });

    fastify.get('/hosts', { preHandler: fastify.validate({ querystring: publicListQuerySchema }) }, async (request: any, reply) => {
        try {
            await enforcePublicRateLimit(fastify, request, 'public:hosts', 120, 60);
            applyPublicCacheHeaders(reply, 120);
            const sortedQuery = sortObjectKeys(request.query || {});
            return await cachedPublic(
                fastify,
                'hosts',
                JSON.stringify(sortedQuery),
                120,
                () => fastify.publicDiscoveryService.listHosts(request.query || {})
            );
        } catch (error: any) {
            if (error.message === 'RATE_LIMITED') return reply.status(429).send(createApiError(request.id, 'RATE_LIMITED', 'Too many requests'));
            request.log.error({ error }, 'Failed to list public hosts');
            return reply.status(500).send(createApiError(request.id, 'INTERNAL_ERROR', 'Unable to load public hosts'));
        }
    });

    fastify.get('/hosts/:slug', { preHandler: fastify.validate({ params: slugParamSchema }) }, async (request: any, reply) => {
        try {
            await enforcePublicRateLimit(fastify, request, 'public:host-detail', 120, 60);
            applyPublicCacheHeaders(reply, 120);
            const result = await cachedPublic(
                fastify,
                'hosts',
                `detail:${request.params.slug}`,
                120,
                () => fastify.publicDiscoveryService.getHostPublicProfile(request.params.slug)
            );
            if (!result) return reply.status(404).send(createApiError(request.id, 'NOT_FOUND', 'Host not found'));
            return result;
        } catch (error: any) {
            if (error.message === 'RATE_LIMITED') return reply.status(429).send(createApiError(request.id, 'RATE_LIMITED', 'Too many requests'));
            request.log.error({ error }, 'Failed to get public host detail');
            return reply.status(500).send(createApiError(request.id, 'INTERNAL_ERROR', 'Unable to load public host'));
        }
    });

    fastify.get('/venues', { preHandler: fastify.validate({ querystring: publicListQuerySchema }) }, async (request: any, reply) => {
        try {
            await enforcePublicRateLimit(fastify, request, 'public:venues', 120, 60);
            applyPublicCacheHeaders(reply, 120);
            const sortedQuery = sortObjectKeys(request.query || {});
            return await cachedPublic(
                fastify,
                'venues',
                JSON.stringify(sortedQuery),
                120,
                () => fastify.publicDiscoveryService.listVenues(request.query || {})
            );
        } catch (error: any) {
            if (error.message === 'RATE_LIMITED') return reply.status(429).send(createApiError(request.id, 'RATE_LIMITED', 'Too many requests'));
            request.log.error({ error }, 'Failed to list public venues');
            return reply.status(500).send(createApiError(request.id, 'INTERNAL_ERROR', 'Unable to load public venues'));
        }
    });

    fastify.get('/venues/:slug', { preHandler: fastify.validate({ params: slugParamSchema }) }, async (request: any, reply) => {
        try {
            await enforcePublicRateLimit(fastify, request, 'public:venue-detail', 120, 60);
            applyPublicCacheHeaders(reply, 120);
            const result = await cachedPublic(
                fastify,
                'venues',
                `detail:${request.params.slug}`,
                120,
                () => fastify.publicDiscoveryService.getVenuePublicProfile(request.params.slug)
            );
            if (!result) return reply.status(404).send(createApiError(request.id, 'NOT_FOUND', 'Venue not found'));
            return result;
        } catch (error: any) {
            if (error.message === 'RATE_LIMITED') return reply.status(429).send(createApiError(request.id, 'RATE_LIMITED', 'Too many requests'));
            request.log.error({ error }, 'Failed to get public venue detail');
            return reply.status(500).send(createApiError(request.id, 'INTERNAL_ERROR', 'Unable to load public venue'));
        }
    });

    fastify.get('/search', { preHandler: fastify.validate({ querystring: publicSearchQuerySchema }) }, async (request: any, reply) => {
        try {
            await enforcePublicRateLimit(fastify, request, 'public:search', 60, 60);
            applyPublicCacheHeaders(reply, 30);
            const sortedQuery = sortObjectKeys(request.query || {});
            const q = String(request.query?.q || '');
            return await cachedPublic(
                fastify,
                'search',
                JSON.stringify(sortedQuery),
                30,
                () => fastify.publicDiscoveryService.search(q, Number(request.query?.limit) || 6)
            );
        } catch (error: any) {
            if (error.message === 'RATE_LIMITED') return reply.status(429).send(createApiError(request.id, 'RATE_LIMITED', 'Too many requests'));
            request.log.error({ error }, 'Failed to search public discovery');
            return reply.status(500).send(createApiError(request.id, 'INTERNAL_ERROR', 'Unable to search public discovery'));
        }
    });
}
