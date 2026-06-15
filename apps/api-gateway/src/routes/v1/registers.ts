import { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const VenueDateParams = z
  .object({
    venueId: z.string(),
    date: z.string(),
  })
  .strict();

const RangeParams = z
  .object({
    venueId: z.string(),
  })
  .strict();

const RangeQuery = z
  .object({
    startDate: z.string(),
    endDate: z.string(),
  })
  .strict();

const PatchBody = z.record(z.string(), z.any());

export default async function registerRoutes(fastify: FastifyInstance) {
  const COL = 'venue_registers';

  function makeId(venueId: string, date: string) {
    return `${venueId}_${date}`;
  }

  async function getOrCreate(db: any, venueId: string, date: string) {
    const id = makeId(venueId, date);
    const doc = await db.collection(COL).doc(id).get();
    if (!doc.exists) {
      const blank = {
        id,
        venueId,
        date,
        notes: { internal: '', operational: '', promotional: '' },
        expectedFootfall: 0,
        actualFootfall: 0,
        staffAssignments: [],
        incidents: [],
        inspections: [],
        reminders: [],
        expenses: [],
        revenue: { cover: 0, drinks: 0, food: 0, vip: 0, other: 0 },
        weather: null,
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.collection(COL).doc(id).set(blank);
      return blank;
    }
    return { id: doc.id, ...doc.data() };
  }

  /**
   * GET /api/v1/registers/:venueId/:date
   */
  fastify.get(
    '/:venueId/:date',
    {
      preHandler: [
        fastify.requirePartnerAccess((req) => (req.params as any).venueId),
        fastify.validate({ params: VenueDateParams }),
      ],
    },
    async (request: any, reply) => {
      const { venueId, date } = request.params;
      return getOrCreate(fastify.db, venueId, date);
    },
  );

  /**
   * GET /api/v1/registers/:venueId/range
   */
  fastify.get(
    '/:venueId/range',
    {
      preHandler: [
        fastify.requirePartnerAccess((req) => (req.params as any).venueId),
        fastify.validate({ params: RangeParams, querystring: RangeQuery }),
      ],
    },
    async (request: any, reply) => {
      const { venueId } = request.params;
      const { startDate, endDate } = request.query;
      const snap = await fastify.db
        .collection(COL)
        .where('venueId', '==', venueId)
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .orderBy('date', 'asc')
        .get();
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    },
  );

  /**
   * PATCH /api/v1/registers/:venueId/:date
   * Generic partial update for notes, footfall, status, dayClose, etc.
   */
  fastify.patch(
    '/:venueId/:date',
    {
      preHandler: [
        fastify.requirePartnerAccess((req) => (req.params as any).venueId),
        fastify.validate({ params: VenueDateParams, body: PatchBody }),
      ],
    },
    async (request: any, reply) => {
      const { venueId, date } = request.params;
      const id = makeId(venueId, date);
      const now = new Date().toISOString();
      await getOrCreate(fastify.db, venueId, date);
      await fastify.db
        .collection(COL)
        .doc(id)
        .set({ ...request.body, updatedAt: now }, { merge: true });
      return fastify.db
        .collection(COL)
        .doc(id)
        .get()
        .then((d: any) => ({ id: d.id, ...d.data() }));
    },
  );
}
