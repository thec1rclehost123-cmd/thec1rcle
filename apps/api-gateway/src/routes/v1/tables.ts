import { FastifyInstance } from 'fastify';
import {
  getFloorPlan,
  updateMasterTable,
  assignTable,
  getEventAssignments,
} from '@c1rcle/core/table-engine';
import { z } from 'zod';

const VenueIdParam = z.object({ venueId: z.string() }).strict();
const EventIdParam = z.object({ eventId: z.string() }).strict();

const FloorPlanBody = z.record(z.string(), z.any());

const AssignBody = z
  .object({
    eventId: z.string(),
    tableId: z.string(),
    bookingId: z.string().optional(),
    status: z.string(),
  })
  .strict();

/** Resolve venueId from an eventId. */
async function getEventVenueId(db: any, eventId: string): Promise<string | null> {
  const doc = await db.collection('events').doc(eventId).get();
  if (!doc.exists) return null;
  return (doc.data() as any).venueId || null;
}

export default async function tableRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/venue/tables
   * Supports:
   * - ?venueId=... (Master floor plan)
   * - ?eventId=... (Tonight's assignments)
   */
  fastify.get(
    '/venue/tables',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { venueId, eventId } = request.query as any;

      if (eventId) {
        const vid = await getEventVenueId(fastify.db, eventId);
        if (!vid) return reply.status(404).send({ error: 'Event not found' });
        await (fastify as any).verifyPartnerAccess(request, vid).catch(() => {
          throw reply.status(403).send({ error: 'Forbidden' });
        });

        // Return event assignments
        try {
          const snap = await fastify.db
            .collection('table_assignments')
            .where('eventId', '==', eventId)
            .get();

          const bookings = snap.docs
            .filter((d) => d.data().status === 'reserved')
            .map((d) => ({ id: d.id, ...d.data() }));
          const blockedTables = snap.docs
            .filter((d) => d.data().status === 'blocked')
            .map((d) => d.data().tableId);

          return { bookings, blockedTables };
        } catch (error) {
          return { bookings: [], blockedTables: [] };
        }
      }

      if (venueId) {
        await fastify.verifyPartnerAccess(request, venueId).catch(() => {
          throw reply.status(403).send({ error: 'Forbidden' });
        });

        // Return master tables
        const snap = await fastify.db.collection('venues').doc(venueId).collection('tables').get();
        const tables = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        // Add some legacy metadata the dashboard expects
        const results = tables as any;
        results.totalCapacity = tables.reduce(
          (acc: any, t: any) => acc + (parseInt(t.capacity) || 0),
          0,
        );

        return results;
      }

      return reply.status(400).send({ error: 'Missing venueId or eventId' });
    },
  );

  /**
   * POST /api/v1/venue/tables
   * Supports:
   * - Add/Update table definition (if table body provided)
   * - Update status (if action: updateStatus provided)
   */
  fastify.post(
    '/venue/tables',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { venueId, table, action, eventId, tableId, status, notes } = request.body as any;

      if (action === 'updateStatus') {
        const vid = await getEventVenueId(fastify.db, eventId);
        if (!vid) return reply.status(404).send({ error: 'Event not found' });
        await (fastify as any).verifyPartnerAccess(request, vid).catch(() => {
          throw reply.status(403).send({ error: 'Forbidden' });
        });

        const assignmentId = `${eventId}_${tableId}`;
        if (status === 'available') {
          await fastify.db.collection('table_assignments').doc(assignmentId).delete();
        } else {
          await fastify.db
            .collection('table_assignments')
            .doc(assignmentId)
            .set(
              {
                eventId,
                tableId,
                status,
                notes: notes || '',
                updatedAt: new Date().toISOString(),
                updatedBy: request.user.uid,
              },
              { merge: true },
            );
        }
        return { success: true };
      }

      if (venueId && table) {
        await fastify.verifyPartnerAccess(request, venueId).catch(() => {
          throw reply.status(403).send({ error: 'Forbidden' });
        });

        if (table.id) {
          await fastify.db
            .collection('venues')
            .doc(venueId)
            .collection('tables')
            .doc(table.id)
            .set(table, { merge: true });
        } else {
          await fastify.db.collection('venues').doc(venueId).collection('tables').add(table);
        }
        return { success: true };
      }

      return reply.status(400).send({ error: 'Invalid request' });
    },
  );

  /**
   * DELETE /api/v1/venue/tables?tableId=...
   */
  fastify.delete(
    '/venue/tables',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { tableId } = request.query as any;
      // Search across all venue table subcollections (or use a better way if we had venueId)
      // For now, assume tableId is unique across the system if using doc lookup
      // Ideally we'd need venueId here too.
      return reply
        .status(501)
        .send({ error: 'Delete requires venueId context - not implemented safely yet' });
    },
  );
}
