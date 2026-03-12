import { searchEvents } from '@c1rcle/core/search';
import { z } from 'zod';
const SearchQuery = z.object({
    q: z.string().optional()
}).catchall(z.any());
export default async function searchRoutes(fastify) {
    /**
     * GET /api/v1/search
     * Global search through Meilisearch
     */
    fastify.get('/', {
        preHandler: [fastify.validate({ querystring: SearchQuery })]
    }, async (request, reply) => {
        const { q, ...filters } = request.query;
        try {
            const cacheKey = JSON.stringify({ q, filters });
            const cached = await fastify.cache.get('search:public', cacheKey);
            if (cached)
                return cached;
            // Use existing search logic from core
            const results = await searchEvents(q, filters);
            await fastify.cache.set('search:public', cacheKey, results, 60); // 60s TTL
            return results;
        }
        catch (error) {
            reply.status(500).send({ error: error.message });
        }
    });
}
//# sourceMappingURL=search.js.map