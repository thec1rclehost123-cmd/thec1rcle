import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse } from '../../lib/api-contracts';
// @ts-ignore
import {
  getRecommendationCacheContext,
  getRecommendedEvents,
  getRecommendedEventsV2,
  getSimilarEvents,
} from '@c1rcle/core/recommendation-engine';

const RecommendationQuery = z
  .object({
    type: z.enum(['personal', 'similar']).optional().default('personal'),
    eventId: z.string().min(1).max(160).optional(),
    limit: z.coerce.number().int().min(1).max(20).optional().default(10),
    contract: z.enum(['legacy', 'v2']).optional().default('legacy'),
  })
  .strict();

export default async function recommendationRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/recommendations',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: RecommendationQuery })],
    },
    async (request: any, reply) => {
      try {
        const userId = request.user?.uid;
        if (!userId) {
          return reply.status(401).send(
            buildErrorResponse({
              code: 'UNAUTHORIZED',
              message: 'Sign in to load personalized recommendations',
              requestId: request.id,
            }),
          );
        }

        const type = request.query?.type || 'personal';
        const eventId = request.query?.eventId;
        const limit = request.query?.limit || 10;
        const contract = request.query?.contract || 'legacy';
        const cacheContext =
          type === 'personal' && contract === 'v2'
            ? await getRecommendationCacheContext(userId)
            : null;
        const cacheKey = JSON.stringify({
          userId,
          type,
          eventId: eventId || null,
          limit,
          contract,
          cacheContext,
        });

        reply.header('Cache-Control', 'private, max-age=0, s-maxage=120');
        reply.header('Vary', 'Authorization');

        const cached = await fastify.cache.get('recommendations', cacheKey);
        if (cached) return cached;

        if (type === 'similar') {
          if (!eventId) {
            return reply.status(400).send(
              buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'Event ID required for similar recommendations',
                requestId: request.id,
              }),
            );
          }
          const similar = await getSimilarEvents(eventId, limit);
          await fastify.cache.set('recommendations', cacheKey, similar, 120);
          return similar;
        }

        const recommendations =
          contract === 'v2'
            ? await getRecommendedEventsV2(userId, limit)
            : await getRecommendedEvents(userId, limit);
        await fastify.cache.set('recommendations', cacheKey, recommendations, 120);
        return recommendations;
      } catch (error: any) {
        request.log.error(
          { requestId: request.id, error: error?.message },
          'GET /recommendations failed',
        );
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Recommendation request failed',
            requestId: request.id,
          }),
        );
      }
    },
  );
}
