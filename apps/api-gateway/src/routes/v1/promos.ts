import { FastifyInstance } from 'fastify';
import {
  createPromoCode,
  getPromoCodeByCode,
  upsertPromoCode,
  getPromoCodeById,
  getEventPromoCodes,
  validatePromoCode,
} from '@c1rcle/core/promo-service';
import { z } from 'zod';

const EventIdParam = z.object({ eventId: z.string() }).strict();
const PromoIdParam = z.object({ id: z.string() }).strict();

const CreatePromoBody = z
  .object({
    eventId: z.string(),
    codeData: z.record(z.string(), z.any()),
  })
  .strict();

const ValidatePromoBody = z
  .object({
    eventId: z.string(),
    code: z.string(),
    userId: z.string().optional(),
    items: z.array(z.any()).optional(),
  })
  .strict();

/** Resolve a partnerId from an eventId for access-control checks. */
async function getEventPartnerId(db: any, eventId: string): Promise<string | null> {
  const doc = await db.collection('events').doc(eventId).get();
  if (!doc.exists) return null;
  const data = doc.data();
  return data?.hostId || data?.venueId || null;
}

export default async function promoRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/promos/event/:eventId
   * Only the event's partner (host/venue) may list promo codes.
   */
  fastify.get(
    '/event/:eventId',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ params: EventIdParam })],
    },
    async (request: any, reply) => {
      const { eventId } = request.params as { eventId: string };
      const partnerId = await getEventPartnerId(fastify.db, eventId);
      if (!partnerId) return reply.status(404).send({ error: 'Event not found' });
      try {
        await fastify.verifyPartnerAccess(request, partnerId);
      } catch {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      try {
        return await getEventPromoCodes(eventId);
      } catch (error: any) {
        reply.status(500).send({ error: 'Internal server error' });
      }
    },
  );

  /**
   * GET /api/v1/promos/:id
   * Requires auth — caller must be authenticated to read a promo code.
   */
  fastify.get(
    '/:id',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ params: PromoIdParam })],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        return await getPromoCodeById(id);
      } catch (error: any) {
        reply.status(500).send({ error: 'Internal server error' });
      }
    },
  );

  /**
   * POST /api/v1/promos
   * Caller must manage the event's host/venue.
   */
  fastify.post(
    '/',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: CreatePromoBody })],
    },
    async (request: any, reply) => {
      const { eventId, codeData } = request.body as any;
      const partnerId = await getEventPartnerId(fastify.db, eventId);
      if (!partnerId) return reply.status(404).send({ error: 'Event not found' });
      try {
        await fastify.verifyPartnerAccess(request, partnerId);
      } catch {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      try {
        return await upsertPromoCode(eventId, codeData, request.user);
      } catch (error: any) {
        reply.status(400).send({ error: 'Request failed' });
      }
    },
  );

  /**
   * POST /api/v1/promos/validate
   * Requires auth to prevent anonymous brute-forcing of promo codes.
   */
  fastify.post(
    '/validate',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: ValidatePromoBody })],
    },
    async (request: any, reply) => {
      const { eventId, code, items } = request.body as any;
      const userId = request.user.uid;
      try {
        return await validatePromoCode(eventId, code, userId, items);
      } catch (error: any) {
        reply.status(400).send({ error: 'Request failed' });
      }
    },
  );
}
