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
          .collection('door_sales')
          .where('eventId', '==', eventId)
          .where('category', '==', 'walkin')
          .where('status', '==', 'active')
          .limit(200)
          .get();

        const entries = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
        entries.sort((a: any, b: any) => {
          const dateA = new Date(a.createdAt || a.addedAt || 0).getTime();
          const dateB = new Date(b.createdAt || b.addedAt || 0).getTime();
          return dateB - dateA;
        });

        const page = entries.slice(0, limit);
        const totals = {
          count: page.length,
          totalPaise: page.reduce((s: number, e: any) => s + (Number(e.amountPaise) || 0), 0),
          totalGuests: page.reduce(
            (s: number, e: any) => s + (Number(e.totalGuests) || Number(e.partySize) || 1),
            0,
          ),
        };
        return { entries: page, totals };
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

      const doc = await fastify.db.collection('door_sales').add({
        ...body,
        category: body.category || 'walkin',
        paymentMode: body.paymentMode || 'cash',
        source: 'manual',
        status: 'active',
        addedAt: now,
        addedBy: request.user?.uid,
        addedByName: request.user?.displayName || 'User',
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
      const { venueId, limit: limitStr } = request.query;
      const limit = parseInt(limitStr || '200');

      try {
        const snap = await fastify.db
          .collection('door_sales')
          .where('venueId', '==', venueId)
          .where('category', '==', 'dinein')
          .where('status', '==', 'active')
          .limit(200)
          .get();

        const entries = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        entries.sort((a: any, b: any) => {
          const dateA = new Date(a.createdAt || a.addedAt || 0).getTime();
          const dateB = new Date(b.createdAt || b.addedAt || 0).getTime();
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

      const doc = await fastify.db.collection('door_sales').add({
        ...body,
        category: 'dinein',
        paymentMode: 'cash',
        source: 'manual',
        status: 'active',
        addedAt: now,
        addedBy: request.user?.uid,
        addedByName: request.user?.displayName || 'User',
      });

      return { success: true, id: doc.id };
    },
  );
}
