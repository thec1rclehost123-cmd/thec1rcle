import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const RequestBody = z
  .object({
    hostId: z.string(),
    venueId: z.string(),
    hostName: z.string().optional(),
    venueName: z.string().optional(),
    initiatedBy: z.enum(['host', 'venue']).optional(),
  })
  .strict();

const PartnershipsQuery = z
  .object({
    hostId: z.string().optional(),
    venueId: z.string().optional(),
    status: z.string().optional(),
  })
  .strict();

const PartnershipIdParam = z
  .object({
    id: z.string(),
  })
  .strict();

const UpdateActionBody = z
  .object({
    action: z.enum(['approve', 'reject', 'block']),
    reason: z.string().optional(),
  })
  .strict();

const CheckQuery = z
  .object({
    hostId: z.string(),
    venueId: z.string(),
  })
  .strict();

export default async function partnershipRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/partnerships/request
   * SEC-1 fix: requireAuth + ownership check (caller must own the initiating entity)
   */
  fastify.post(
    '/request',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ body: RequestBody })],
    },
    async (request: any, reply) => {
      const { hostId, venueId, hostName, venueName, initiatedBy = 'host' } = request.body;
      const uid = request.user.uid;
      const db = fastify.db;

      // Verify the caller owns the entity they claim to be initiating as
      const initiatorId = initiatedBy === 'host' ? hostId : venueId;
      const initiatorCol = initiatedBy === 'host' ? 'hosts' : 'venues';
      const initiatorDoc = await db.collection(initiatorCol).doc(initiatorId).get();
      if (!initiatorDoc.exists) {
        return reply.status(404).send({ error: `${initiatedBy} not found` });
      }
      const idata = initiatorDoc.data() as any;
      const isOwner = idata?.ownerId === uid || idata?.ownerUid === uid || idata?.userId === uid;
      if (!isOwner) {
        return reply.status(403).send({ error: 'Forbidden: you do not own this entity' });
      }

      const existing = await db
        .collection('partnerships')
        .where('hostId', '==', hostId)
        .where('venueId', '==', venueId)
        .where('status', 'in', ['pending', 'active'])
        .limit(1)
        .get();
      if (!existing.empty) {
        return reply.status(409).send({ error: 'Partnership already requested or active' });
      }
      const now = new Date().toISOString();
      const ref = await db.collection('partnerships').add({
        hostId,
        venueId,
        hostName,
        venueName,
        status: 'pending',
        initiatedBy,
        createdAt: now,
        updatedAt: now,
      });

      // Write notification for the target partner — non-critical, never block the request
      const recipientId = initiatedBy === 'host' ? venueId : hostId;
      const recipientType = initiatedBy === 'host' ? 'venue' : 'host';
      const senderName = initiatedBy === 'host' ? hostName || 'A host' : venueName || 'A venue';
      const notifType = initiatedBy === 'host' ? 'host_request' : 'venue_request';

      db.collection('notifications')
        .add({
          recipientId,
          recipientType,
          type: notifType,
          title: 'New Connection Request',
          message: `${senderName} wants to connect with you.`,
          read: false,
          createdAt: now,
          data: {
            partnershipId: ref.id,
            hostId,
            venueId,
            hostName,
            venueName,
            initiatedBy,
          },
        })
        .catch((err: any) =>
          fastify.log.warn(
            { partnershipId: ref.id, err: err.message },
            'notification write failed',
          ),
        );

      return { success: true, id: ref.id };
    },
  );

  /**
   * GET /api/v1/partnerships
   * SEC-3 fix: requireAuth + require at least one scoping filter
   */
  fastify.get(
    '/',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: PartnershipsQuery })],
    },
    async (request: any, reply) => {
      const { hostId, venueId, status } = request.query;
      if (!hostId && !venueId) {
        return reply.status(400).send({ error: 'hostId or venueId filter is required' });
      }
      const uid = request.user.uid;
      const db = fastify.db;

      // Verify caller owns the entity they are filtering by
      if (hostId) {
        const hostSnap = await db
          .collection('hosts')
          .doc(hostId)
          .get()
          .catch(() => null);
        const hdata = hostSnap?.exists ? (hostSnap.data() as any) : null;
        const owns =
          hdata && (hdata.ownerId === uid || hdata.ownerUid === uid || hdata.userId === uid);
        if (!owns) return reply.status(403).send({ error: 'Forbidden: you do not own this host' });
      }
      if (venueId) {
        const venueSnap = await db
          .collection('venues')
          .doc(venueId)
          .get()
          .catch(() => null);
        const vdata = venueSnap?.exists ? (venueSnap.data() as any) : null;
        const owns = vdata && (vdata.ownerId === uid || vdata.ownerUid === uid);
        if (!owns) return reply.status(403).send({ error: 'Forbidden: you do not own this venue' });
      }

      let query: any = db.collection('partnerships');
      if (hostId) query = query.where('hostId', '==', hostId);
      if (venueId) query = query.where('venueId', '==', venueId);
      if (status) query = query.where('status', '==', status);
      const snap = await query.get();
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    },
  );

  /**
   * PATCH /api/v1/partnerships/:id
   * SEC-2 fix: requireAuth + verify caller is a party to the partnership
   */
  fastify.patch(
    '/:id',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [
        fastify.requireAuth,
        fastify.validate({ params: PartnershipIdParam, body: UpdateActionBody }),
      ],
    },
    async (request: any, reply) => {
      const { id } = request.params;
      const { action, reason } = request.body;
      const uid = request.user.uid;
      const db = fastify.db;

      const partnerDoc = await db.collection('partnerships').doc(id).get();
      if (!partnerDoc.exists) {
        return reply.status(404).send({ error: 'Partnership not found' });
      }
      const pdata = partnerDoc.data() as any;

      // Verify caller owns either hostId or venueId in this partnership
      const [hostSnap, venueSnap] = await Promise.all([
        db
          .collection('hosts')
          .doc(pdata.hostId || '')
          .get()
          .catch(() => null),
        db
          .collection('venues')
          .doc(pdata.venueId || '')
          .get()
          .catch(() => null),
      ]);
      // Check all ownership field aliases used across host documents
      const hdata = hostSnap?.exists ? (hostSnap.data() as any) : null;
      const ownsHost =
        hdata && (hdata.ownerId === uid || hdata.ownerUid === uid || hdata.userId === uid);
      const vdata = venueSnap?.exists ? (venueSnap.data() as any) : null;
      const ownsVenue = vdata && (vdata.ownerId === uid || vdata.ownerUid === uid);
      if (!ownsHost && !ownsVenue) {
        return reply
          .status(403)
          .send({ error: 'Forbidden: you are not a party to this partnership' });
      }

      const statusMap: Record<string, string> = {
        approve: 'active',
        reject: 'rejected',
        block: 'blocked',
      };
      const newStatus = statusMap[action];
      if (!newStatus) return reply.status(400).send({ error: 'Invalid action' });
      await db
        .collection('partnerships')
        .doc(id)
        .update({
          status: newStatus,
          ...(reason ? { rejectReason: reason } : {}),
          updatedAt: new Date().toISOString(),
        });
      return { success: true };
    },
  );

  /**
   * GET /api/v1/partnerships/check
   */
  fastify.get(
    '/check',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: CheckQuery })],
    },
    async (request: any, reply) => {
      const { hostId, venueId } = request.query;
      const snap = await fastify.db
        .collection('partnerships')
        .where('hostId', '==', hostId)
        .where('venueId', '==', venueId)
        .where('status', '==', 'active')
        .limit(1)
        .get();
      return { isPartner: !snap.empty };
    },
  );
}
