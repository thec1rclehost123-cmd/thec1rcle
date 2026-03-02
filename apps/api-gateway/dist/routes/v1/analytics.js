import { getVenueAnalytics, getHostAnalytics, getPromoterFunnel } from '@c1rcle/core/analytics-engine';
export default async function analyticsRoutes(fastify) {
    /**
     * GET /api/v1/analytics/venue/:id
     * Gets performance analytics for a venue
     */
    fastify.get('/venue/:id', async (request, reply) => {
        const { id } = request.params;
        const { range } = request.query;
        try {
            const cacheKey = JSON.stringify({ id, range });
            const cached = await fastify.cache.get('analytics:venue', cacheKey);
            if (cached)
                return cached;
            const stats = await getVenueAnalytics(id, range);
            await fastify.cache.set('analytics:venue', cacheKey, stats, 120); // 120s TTL
            return stats;
        }
        catch (error) {
            reply.status(500).send({ error: error.message });
        }
    });
    /**
     * GET /api/v1/analytics/host/:id
     * Gets performance analytics for a host
     */
    fastify.get('/host/:id', async (request, reply) => {
        const { id } = request.params;
        try {
            const cached = await fastify.cache.get('analytics:host', id);
            if (cached)
                return cached;
            const stats = await getHostAnalytics(id);
            await fastify.cache.set('analytics:host', id, stats, 120); // 120s TTL
            return stats;
        }
        catch (error) {
            reply.status(500).send({ error: error.message });
        }
    });
    /**
     * GET /api/v1/analytics/promoter/:id
     * Gets funnel analytics for a promoter
     */
    fastify.get('/promoter/:id', async (request, reply) => {
        const { id } = request.params;
        try {
            const cached = await fastify.cache.get('analytics:promoter', id);
            if (cached)
                return cached;
            const funnel = await getPromoterFunnel(id);
            await fastify.cache.set('analytics:promoter', id, funnel, 120); // 120s TTL
            return funnel;
        }
        catch (error) {
            reply.status(500).send({ error: error.message });
        }
    });
    /**
     * GET /api/v1/analytics/:type/:id/:subCategory
     */
    fastify.get('/:type/:id/:subCategory', async (request, reply) => {
        const { type, id, subCategory } = request.params;
        try {
            const engine = await import('@c1rcle/core/analytics-engine');
            const methodName = `get${type.charAt(0).toUpperCase() + type.slice(1)}${subCategory.charAt(0).toUpperCase() + subCategory.slice(1)}Analytics`;
            if (typeof engine[methodName] === 'function') {
                return await engine[methodName](fastify.db, id);
            }
            // Fallback for overview if named different
            if (subCategory === 'overview') {
                const overviewMethod = `get${type.charAt(0).toUpperCase() + type.slice(1)}OverviewStats`;
                if (typeof engine[overviewMethod] === 'function') {
                    return await engine[overviewMethod](fastify.db, id);
                }
            }
            reply.status(404).send({ error: `Analytics subcategory ${subCategory} not found for ${type}` });
        }
        catch (error) {
            reply.status(500).send({ error: error.message });
        }
    });
}
//# sourceMappingURL=analytics.js.map