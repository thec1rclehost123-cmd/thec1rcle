import { FastifyInstance } from 'fastify';
import { searchEvents, searchVenues } from '@c1rcle/core/search';
import { z } from 'zod';
import { buildErrorResponse } from '../../lib/api-contracts';

const SearchQuery = z.object({
  q: z.string().max(200).optional(),
  type: z.enum(['events', 'venues', 'hosts']).optional(),
  city: z.string().max(120).optional(),
  category: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(24),
  sort: z.string().max(64).optional(),
});

export default async function searchRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/search
   * Global search through Meilisearch
   */
  fastify.get(
    '/',
    {
      preHandler: [fastify.validate({ querystring: SearchQuery })],
    },
    async (request, reply) => {
      const { q, type, ...filters } = request.query as z.infer<typeof SearchQuery>;

      try {
        const cacheKey = `search:${type || 'all'}:${JSON.stringify({ q, ...filters })}`;
        const cached = await fastify.cache.get('search:public', cacheKey);
        if (cached) return cached;

        let results;
        if (type === 'venues') {
          results = await searchVenues(q, filters);
        } else if (type === 'hosts') {
          results = await searchEvents(q, { ...filters, type: 'hosts' });
        } else {
          results = await searchEvents(q, filters);
        }

        await fastify.cache.set('search:public', cacheKey, results, 60);
        return results;
      } catch (error: any) {
        request.log.error({ error }, 'Search failed');
        return reply.status(500).send(
          buildErrorResponse({
            code: 'SEARCH_ERROR',
            message: 'Search failed. Please try again.',
            requestId: request.id,
          }),
        );
      }
    },
  );
}
