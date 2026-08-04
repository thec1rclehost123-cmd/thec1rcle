import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { validateScannerSession } from '../../lib/scannerSessions';

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
  const requireDoorAuth = async (request: any, reply: any) => {
    // 1. Try Firebase Auth
    if (request.user) {
      return;
    }

    // 2. Try Scanner Session Auth
    const scannerCode = request.headers['x-scanner-code'] as string | undefined;
    if (scannerCode) {
      try {
        const session = await validateScannerSession(fastify, scannerCode);
        if (session.authorized) {
          request.user = {
            uid: String(session.sessionData?.userId || session.sessionId),
            displayName: String(session.sessionData?.userName || 'Scanner'),
            role: String(session.sessionData?.role || 'door').toLowerCase(),
          };
          request.scannerCodeId = session.codeDoc.id;
          request.scannerCodeData = session.codeData;
          request.scannerSessionId = session.sessionId;
          request.scannerSessionData = session.sessionData;
          return;
        }
      } catch (error) {
        fastify.log.warn({ error }, 'Failed to validate scanner session in door routes');
      }
    }

    return reply.status(401).send({ error: 'Unauthorized: Authentication required' });
  };

  /**
   * GET /api/v1/venue/walk-ins
   */
  fastify.get(
    '/venue/walk-ins',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [requireDoorAuth, fastify.validate({ querystring: DoorQuerySchema })],
    },
    async (request: any, reply) => {
      const { eventId, limit: limitStr } = request.query;
      const limit = parseInt(limitStr || '200');

      if (request.scannerSessionData) {
        const sessEventId = request.scannerSessionData.eventId;
        if (sessEventId && String(sessEventId) !== String(eventId)) {
          return reply
            .status(403)
            .send({ error: 'Forbidden: Scanner is not authorized for this event' });
        }
        const sessVenueId = request.scannerSessionData.venueId;
        const reqVenueId = request.query.venueId;
        if (sessVenueId && reqVenueId && String(sessVenueId) !== String(reqVenueId)) {
          return reply
            .status(403)
            .send({ error: 'Forbidden: Scanner is not authorized for this venue' });
        }
      }

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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [requireDoorAuth, fastify.validate({ body: WalkInBodySchema })],
    },
    async (request: any, reply) => {
      const body = request.body;

      if (request.scannerSessionData) {
        const sessEventId = request.scannerSessionData.eventId;
        if (sessEventId && String(sessEventId) !== String(body.eventId)) {
          return reply
            .status(403)
            .send({ error: 'Forbidden: Scanner is not authorized for this event' });
        }
        const sessVenueId = request.scannerSessionData.venueId;
        if (sessVenueId && String(sessVenueId) !== String(body.venueId)) {
          return reply
            .status(403)
            .send({ error: 'Forbidden: Scanner is not authorized for this venue' });
        }
      }

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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [requireDoorAuth, fastify.validate({ querystring: DoorQuerySchema })],
    },
    async (request: any, reply) => {
      const { venueId, limit: limitStr } = request.query;
      const limit = parseInt(limitStr || '200');

      if (request.scannerSessionData) {
        const sessVenueId = request.scannerSessionData.venueId;
        if (sessVenueId && String(sessVenueId) !== String(venueId)) {
          return reply
            .status(403)
            .send({ error: 'Forbidden: Scanner is not authorized for this venue' });
        }
      }

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
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [requireDoorAuth, fastify.validate({ body: DineInBodySchema })],
    },
    async (request: any, reply) => {
      const body = request.body;

      if (request.scannerSessionData) {
        const sessVenueId = request.scannerSessionData.venueId;
        if (sessVenueId && String(sessVenueId) !== String(body.venueId)) {
          return reply
            .status(403)
            .send({ error: 'Forbidden: Scanner is not authorized for this venue' });
        }
      }

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
