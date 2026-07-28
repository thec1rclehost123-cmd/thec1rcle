import { FastifyInstance } from 'fastify';
import { z } from 'zod';
// @ts-ignore
import { buildGuestPassPreview } from '@c1rcle/core/guest-pass-engine';

const PassQuery = z
  .object({
    orderId: z.string().min(1),
  })
  .strict();

const PassPlatformParam = z
  .object({
    platform: z.enum(['apple', 'google']),
  })
  .strict();

/**
 * Resolves an event via the public discovery service already registered
 * on the Fastify instance, falling back to a raw Firestore lookup.
 */
async function resolveEvent(fastify: FastifyInstance, eventId: string) {
  try {
    if (fastify.publicDiscoveryService?.getEventDetail) {
      const detail = await fastify.publicDiscoveryService.getEventDetail(eventId);
      return detail?.event || detail || null;
    }
  } catch {
    /* fall through */
  }

  // Fallback: direct Firestore lookup
  try {
    const doc = await fastify.db.collection('events').doc(eventId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  } catch {
    return null;
  }
}

export default async function guestPassRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/passes/:platform?orderId=xxx
   * Generate a wallet pass preview (Apple or Google) for the given order.
   */
  fastify.get(
    '/passes/:platform',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ params: PassPlatformParam, querystring: PassQuery })],
    },
    async (request: any, reply) => {
      const { platform } = request.params;
      const { orderId } = request.query;

      try {
        const result = await buildGuestPassPreview({
          orderId,
          platform,
          resolveEvent: (eventId: string) => resolveEvent(fastify, eventId),
          env: process.env,
        });

        return reply.status(result.statusCode).send(result.body);
      } catch (error: any) {
        request.log.error(
          { requestId: request.id, orderId, platform, error: error.message },
          `GET /passes/${platform} failed`,
        );
        return reply.status(500).send({ error: `Failed to generate ${platform} wallet pass` });
      }
    },
  );
}
