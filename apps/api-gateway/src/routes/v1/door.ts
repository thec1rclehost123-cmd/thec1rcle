import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const DoorQuerySchema = z
  .object({
    eventId: z.any().optional(),
    venueId: z.any().optional(),
    limit: z.any().optional(),
  })
  .passthrough();

const WalkInBodySchema = z
  .object({
    eventId: z.string(),
    guestName: z.string(),
    phoneFull: z.string().optional(),
    gender: z.string().optional(),
  })
  .passthrough();

const DineInBodySchema = z.any();

export default async function doorRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/venue/walk-ins
   */
  fastify.get(
    '/venue/walk-ins',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: DoorQuerySchema })],
    },
    async (request: any, reply) => {
      const { eventId, limit: limitStr } = request.query;
      const limit = parseInt(limitStr || '200');

      try {
        const snap = await fastify.db
          .collection('walk_ins')
          .where('eventId', '==', eventId)
          .limit(200)
          .get();

        const entries = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        entries.sort((a: any, b: any) => {
          const dateA = new Date(a.addedAt || 0).getTime();
          const dateB = new Date(b.addedAt || 0).getTime();
          return dateB - dateA;
        });

        return { entries: entries.slice(0, limit) };
      } catch (error: any) {
        return { entries: [] };
      }
    },
  );

  /**
   * POST /api/v1/venue/walk-ins
   */
  fastify.post(
    '/venue/walk-ins',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: WalkInBodySchema })],
    },
    async (request: any, reply) => {
      const body = request.body;
      const now = new Date().toISOString();

      const doc = await fastify.db.collection('walk_ins').add({
        ...body,
        addedAt: now,
        addedBy: request.user?.uid,
      });

      return { success: true, id: doc.id };
    },
  );

  /**
   * GET /api/v1/venue/door/dinein
   */
  fastify.get(
    '/venue/door/dinein',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: DoorQuerySchema })],
    },
    async (request: any, reply) => {
      const { eventId, limit: limitStr } = request.query;
      const limit = parseInt(limitStr || '200');

      try {
        const snap = await fastify.db
          .collection('dine_in_entries')
          .where('eventId', '==', eventId)
          .limit(200)
          .get();

        const entries = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        entries.sort((a: any, b: any) => {
          const dateA = new Date(a.addedAt || 0).getTime();
          const dateB = new Date(b.addedAt || 0).getTime();
          return dateB - dateA;
        });

        return { entries: entries.slice(0, limit) };
      } catch (error: any) {
        return { entries: [] };
      }
    },
  );

  /**
   * POST /api/v1/venue/door/dinein
   */
  fastify.post(
    '/venue/door/dinein',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: DineInBodySchema })],
    },
    async (request: any, reply) => {
      const body = request.body;
      const now = new Date().toISOString();

      const doc = await fastify.db.collection('dine_in_entries').add({
        ...body,
        addedAt: now,
        addedBy: request.user?.uid,
      });

      return { success: true, id: doc.id };
    },
  );
}
