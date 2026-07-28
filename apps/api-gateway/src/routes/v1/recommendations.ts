import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse } from '../../lib/api-contracts';
// @ts-ignore
import {
  getRecommendedEvents,
  getSimilarEvents,
  recordRecommendationSignal,
  warmRecommendationCandidates,
} from '@c1rcle/core/recommendation-engine';

const RecommendationQuery = z
  .object({
    type: z.enum(['personal', 'similar']).optional().default('personal'),
    eventId: z.string().min(1).max(160).optional(),
    limit: z.coerce.number().int().min(1).max(20).optional().default(10),
    contract: z.enum(['legacy', 'v2']).optional().default('legacy'),
  })
  .strict();
const RecommendationSignalBody = z
  .object({
    type: z.literal('category_browse'),
    category: z.string().trim().min(1).max(64),
  })
  .strict();

export function formatRecommendationResponse(recommendations: any[], contract: 'legacy' | 'v2') {
  if (contract === 'legacy') return recommendations;
  return {
    items: recommendations.map((event) => ({
      event,
      reasonLabel: 'Selected for your nightlife preferences',
    })),
    contract: 'v2',
  };
}

export default async function recommendationRoutes(fastify: FastifyInstance) {
  if (typeof warmRecommendationCandidates === 'function' && fastify.db) {
    await warmRecommendationCandidates(fastify.db).catch((error: any) => {
      fastify.log.warn(
        { error: error?.message || String(error) },
        'Recommendation candidate warmup failed; first request will retry',
      );
    });
  }

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
        const cacheKey = JSON.stringify({
          userId,
          type,
          eventId: eventId || null,
          limit,
          contract,
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
          const similar = await getSimilarEvents(eventId, limit, fastify.db);
          const response = formatRecommendationResponse(similar, contract);
          await fastify.cache.set('recommendations', cacheKey, response, 120);
          return response;
        }

        const recommendations = await getRecommendedEvents(userId, limit, fastify.db);
        const response = formatRecommendationResponse(recommendations, contract);
        await fastify.cache.set('recommendations', cacheKey, response, 120);
        return response;
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

  fastify.post(
    '/users/me/recommendation-signals',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: RecommendationSignalBody })],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;
      if (!userId) {
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            requestId: request.id,
          }),
        );
      }

      try {
        reply.header('Cache-Control', 'private, no-store');
        const result = await recordRecommendationSignal(fastify.db, {
          userId,
          type: request.body.type,
          category: request.body.category,
          requestId: request.id,
        });
        await fastify.cache.invalidateNamespace('recommendations');
        return { success: true, data: result, ...result };
      } catch (error: any) {
        request.log.error(
          { requestId: request.id, error: error?.message },
          'POST /users/me/recommendation-signals failed',
        );
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Recommendation signal could not be recorded',
            requestId: request.id,
          }),
        );
      }
    },
  );
}
