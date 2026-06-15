import { FastifyInstance } from 'fastify';
import { z } from 'zod';
// @ts-ignore
import { getRecommendedEvents, getSimilarEvents } from '@c1rcle/core/recommendation-engine';

const RecommendationQuery = z
  .object({
    type: z.string().optional(),
    eventId: z.string().optional(),
    limit: z.string().optional(),
  })
  .passthrough();

function parseLimit(value: any, fallback = 5) {
  const limit = Number(value) || fallback;
  return Math.max(1, Math.min(limit, 100));
}

export default async function recommendationRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/recommendations',
    {
      preHandler: [fastify.validate({ querystring: RecommendationQuery })],
    },
    async (request: any, reply) => {
      try {
        const type = request.query?.type || 'personal';
        const eventId = request.query?.eventId;
        const limit = parseLimit(request.query?.limit, type === 'similar' ? 3 : 5);

        if (type === 'similar') {
          if (!eventId) {
            return reply
              .status(400)
              .send({ error: 'Event ID required for similar recommendations' });
          }
          return await getSimilarEvents(eventId, limit);
        }

        return await getRecommendedEvents(request.user?.uid || null, limit);
      } catch (error: any) {
        request.log.error(
          { requestId: request.id, error: error?.message },
          'GET /recommendations failed',
        );
        return reply.status(500).send({ error: error?.message || 'Recommendation request failed' });
      }
    },
  );
}
