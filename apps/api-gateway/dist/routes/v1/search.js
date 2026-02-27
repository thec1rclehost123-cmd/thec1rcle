import { searchEvents } from '@c1rcle/core/search';
export default async function searchRoutes(fastify) {
    /**
     * GET /api/v1/search
     * Global search through Meilisearch
     */
    fastify.get('/', async (request, reply) => {
        const { q, ...filters } = request.query;
        try {
            // Use existing search logic from core
            const results = await searchEvents(q, filters);
            return results;
        }
        catch (error) {
            reply.status(500).send({ error: error.message });
        }
    });
}
//# sourceMappingURL=search.js.map