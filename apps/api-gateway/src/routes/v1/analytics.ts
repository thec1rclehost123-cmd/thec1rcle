import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getVenueAnalytics, getHostAnalytics, getPromoterFunnel } from '@c1rcle/core/analytics-engine';

const AnalyticsRangeSchema = z.object({
    range: z.enum(['7d', '30d', '90d', '1y']).optional(),
});

export default async function analyticsRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/analytics/venue/:id
     * Gets performance analytics for a venue
     */
    fastify.get('/venue/:id', {
        preHandler: [fastify.validate({ querystring: AnalyticsRangeSchema })]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { range } = request.query as z.infer<typeof AnalyticsRangeSchema>;

        try {
            const cacheKey = JSON.stringify({ id, range });
            const cached = await fastify.cache.get('analytics:venue', cacheKey);
            if (cached) return cached;

            const stats = await getVenueAnalytics(id, range);

            await fastify.cache.set('analytics:venue', cacheKey, stats, 120); // 120s TTL
            return stats;
        } catch (error: any) {
            reply.status(500).send({ error: "Internal server error" });
        }
    });

    /**
     * GET /api/v1/analytics/host/:id
     * Gets performance analytics for a host
     */
    fastify.get('/host/:id', async (request, reply) => {
        const { id } = request.params as { id: string };

        try {
            const cached = await fastify.cache.get('analytics:host', id);
            if (cached) return cached;

            const stats = await getHostAnalytics(id);

            await fastify.cache.set('analytics:host', id, stats, 120); // 120s TTL
            return stats;
        } catch (error: any) {
            reply.status(500).send({ error: "Internal server error" });
        }
    });

    /**
     * GET /api/v1/analytics/promoter/:id
     * Gets funnel analytics for a promoter
     */
    fastify.get('/promoter/:id', async (request, reply) => {
        const { id } = request.params as { id: string };

        try {
            const cached = await fastify.cache.get('analytics:promoter', id);
            if (cached) return cached;

            const funnel = await getPromoterFunnel(id);

            await fastify.cache.set('analytics:promoter', id, funnel, 120); // 120s TTL
            return funnel;
        } catch (error: any) {
            reply.status(500).send({ error: "Internal server error" });
        }
    });

    /**
     * GET /api/v1/analytics/:type/:id/:subCategory
     * NOTE: This catch-all route is not actively used by any frontend. Subcategory analytics
     * are served by the explicit /venue/:id, /host/:id, /promoter/:id routes above.
     * Returns 404 to prevent silent failures from dynamic method dispatch.
     */
    fastify.get('/:type/:id/:subCategory', async (_request, reply) => {
        reply.status(404).send({ error: 'Use /analytics/venue/:id, /analytics/host/:id, or /analytics/promoter/:id' });
    });
}
