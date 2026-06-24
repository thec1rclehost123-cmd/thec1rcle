import { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const RequestBody = z.object({
  promoterId: z.string(),
  promoterName: z.string().optional(),
  promoterEmail: z.string().email().optional(),
  targetId: z.string(),
  targetType: z.string(),
  targetName: z.string().optional(),
  message: z.string().optional(),
  initiatedBy: z.enum(['promoter', 'host', 'venue']).optional(),
});

const PromoterIdParam = z.object({ promoterId: z.string() }).strict();
const ConnectionIdParam = z.object({ id: z.string() }).strict();
const StatusQuery = z.object({ status: z.string().optional() }).strict();
const IncomingQuery = z
  .object({ targetId: z.string(), role: z.string().optional(), status: z.string().optional() })
  .strict();
const DiscoverQuery = z
  .object({
    type: z.enum(['host', 'venue', 'promoter']).optional(),
    city: z.string().optional(),
    search: z.string().optional(),
    limit: z.string().optional(),
  })
  .strict();

const ActionBody = z.object({
  action: z.enum(['approve', 'reject', 'block', 'revoke']),
  reason: z.string().optional(),
});

const InvitesBody = z.object({
  id: z.string(),
  hostId: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  expiresAt: z.string().optional(),
});

const LinkClickBody = z
  .object({
    linkId: z.string(),
    promoterId: z.string().optional(),
  })
  .strict();

export default async function promoterConnectionsRoutes(fastify: FastifyInstance) {
  const COL = 'promoter_connections';

  /**
   * POST /api/v1/promoter-connections/request
   * SEC-4 fix: requireAuth + verify caller is the promoter they claim to be
   */
  fastify.post(
    '/request',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: RequestBody })],
    },
    async (request: any, reply) => {
      const {
        promoterId,
        promoterName,
        promoterEmail,
        targetId,
        targetType,
        targetName,
        message = '',
        initiatedBy = 'promoter',
      } = request.body;
      const uid = request.user.uid;

      // Caller must be the promoter they are sending as
      if (uid !== promoterId) {
        return reply.status(403).send({ error: 'Forbidden: you can only request as yourself' });
      }

      // BUG-2 fix: block on pending OR active, not just pending
      const existing = await fastify.db
        .collection(COL)
        .where('promoterId', '==', promoterId)
        .where('targetId', '==', targetId)
        .where('status', 'in', ['pending', 'active'])
        .limit(1)
        .get();
      if (!existing.empty) {
        return reply.status(409).send({ error: 'Connection already exists or is pending' });
      }

      const now = new Date().toISOString();
      const id = randomUUID();
      const conn: any = {
        id,
        promoterId,
        promoterName,
        promoterEmail,
        targetId,
        targetType,
        targetName,
        message,
        status: 'pending',
        initiatedBy,
        fromPartnerId: promoterId,
        toPartnerId: targetId,
        createdAt: now,
        updatedAt: now,
      };

      if (targetType === 'host') {
        conn.hostId = targetId;
        conn.hostName = targetName || '';
      } else if (targetType === 'venue') {
        conn.venueId = targetId;
        conn.venueName = targetName || '';
      }

      await fastify.db.collection(COL).doc(id).set(conn);

      // Write notification — non-critical, never block the request
      const isPromoterInitiated = initiatedBy === 'promoter';
      const recipientId = isPromoterInitiated ? targetId : promoterId;
      const recipientType = isPromoterInitiated ? targetType : 'promoter';
      const senderName = isPromoterInitiated
        ? promoterName || 'A promoter'
        : targetName || 'A partner';
      const notifType = isPromoterInitiated ? 'promoter_request' : 'connection_request';

      fastify.db
        .collection('notifications')
        .add({
          recipientId,
          recipientType,
          type: notifType,
          title: 'New Connection Request',
          message: `${senderName} wants to connect with you.`,
          read: false,
          createdAt: now,
          data: {
            connectionId: id,
            promoterId,
            targetId,
            targetType,
            initiatedBy,
          },
        })
        .catch((err: any) =>
          fastify.log.warn({ connectionId: id, err: err.message }, 'notification write failed'),
        );

      return conn;
    },
  );

  /**
   * GET /api/v1/promoter-connections/promoter/:promoterId
   * Fix: requireAuth + caller must be the promoter they are querying
   */
  fastify.get(
    '/promoter/:promoterId',
    {
      preHandler: [
        fastify.requireAuth,
        fastify.validate({ params: PromoterIdParam, querystring: StatusQuery }),
      ],
    },
    async (request: any, reply) => {
      const { promoterId } = request.params;
      const uid = request.user.uid;
      if (uid !== promoterId) {
        return reply
          .status(403)
          .send({ error: 'Forbidden: you can only view your own connections' });
      }
      const { status } = request.query;
      let q: any = fastify.db.collection(COL).where('promoterId', '==', promoterId);
      if (status) q = q.where('status', '==', status);
      const snap = await q.limit(100).get();
      return snap.docs.map((d: any) => {
        const { promoterEmail: _e, ...safe } = d.data();
        return { id: d.id, ...safe };
      });
    },
  );

  /**
   * GET /api/v1/promoter-connections/incoming
   * Fix: requireAuth + verify caller owns the targetId they are querying
   */
  fastify.get(
    '/incoming',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: IncomingQuery })],
    },
    async (request: any, reply) => {
      const { targetId, role, status } = request.query;
      const uid = request.user.uid;
      // Verify caller owns this targetId (host or venue)
      const col = role === 'venue' ? 'venues' : 'hosts';
      const entityDoc = await fastify.db
        .collection(col)
        .doc(targetId)
        .get()
        .catch(() => null);
      const edata = entityDoc?.exists ? (entityDoc.data() as any) : null;
      const isOwner =
        edata && (edata.ownerId === uid || edata.ownerUid === uid || edata.userId === uid);
      if (!isOwner) {
        return reply.status(403).send({ error: 'Forbidden: you do not own this entity' });
      }
      let q: any = fastify.db.collection(COL).where('targetId', '==', targetId);
      if (role) q = q.where('targetType', '==', role);
      if (status) q = q.where('status', '==', status);
      const snap = await q.limit(100).get();
      return snap.docs.map((d: any) => {
        const { promoterEmail: _e, ...safe } = d.data();
        return { id: d.id, ...safe };
      });
    },
  );

  /**
   * GET /api/v1/promoter-connections/discover
   * Search for approved partners (hosts, venues, promoters) for discovery
   */
  fastify.get(
    '/discover',
    {
      preHandler: [fastify.validate({ querystring: DiscoverQuery })],
    },
    async (request: any, reply) => {
      const { type = 'host', city, search, limit = 20 } = request.query;
      const collectionMap: Record<string, string> = {
        host: 'hosts',
        venue: 'venues',
        promoter: 'promoters',
      };
      // SEC-7 fix: type is enum-validated above — no raw-string fallback
      const col = collectionMap[type as string];

      let snapshot = await fastify.db
        .collection(col)
        .where('status', '==', 'active')
        .limit(Number(limit) * 5)
        .get();
      if (snapshot.empty) {
        snapshot = await fastify.db
          .collection(col)
          .limit(Number(limit) * 5)
          .get();
      }

      let results = snapshot.docs.map((d: any) => {
        const r = d.data();
        return {
          id: d.id,
          type,
          name: r.displayName || r.name || 'Unknown',
          avatar: r.profileImage || r.avatar || null,
          coverImage: r.coverImage || r.bannerImage || null,
          city: r.city || r.location?.split?.(',')[0]?.trim?.() || 'Pune',
          bio: r.bio || r.summary || r.description || '',
          tags: r.tags || r.genres || [],
          eventsCount: r.eventsCount || 0,
          followersCount: parseInt(r.followers) || r.followersCount || 0,
          isVerified: !!(r.isVerified || r.isApproved || r.status === 'active'),
        };
      });

      if (city && city.toLowerCase() !== 'all') {
        results = results.filter((r: any) => r.city.toLowerCase().includes(city.toLowerCase()));
      }
      if (search) {
        const s = search.toLowerCase();
        results = results.filter(
          (r: any) => r.name.toLowerCase().includes(s) || r.bio.toLowerCase().includes(s),
        );
      }

      return results.slice(0, Number(limit));
    },
  );

  /**
   * PATCH /api/v1/promoter-connections/:id
   * SEC-5 fix: requireAuth + verify caller is a party to this connection
   */
  fastify.patch(
    '/:id',
    {
      preHandler: [
        fastify.requireAuth,
        fastify.validate({ params: ConnectionIdParam, body: ActionBody }),
      ],
    },
    async (request: any, reply) => {
      const { id } = request.params;
      const { action, reason } = request.body;
      const uid = request.user.uid;

      const connDoc = await fastify.db.collection(COL).doc(id).get();
      if (!connDoc.exists) return reply.status(404).send({ error: 'Connection not found' });
      const cdata = connDoc.data() as any;

      // Only the target (recipient) can approve/reject/block; the promoter can revoke
      const isPromoter = uid === cdata.promoterId;
      const isTarget = uid === cdata.targetId;
      if (!isPromoter && !isTarget) {
        return reply
          .status(403)
          .send({ error: 'Forbidden: you are not a party to this connection' });
      }
      if (action !== 'revoke' && isPromoter && !isTarget) {
        return reply
          .status(403)
          .send({ error: 'Forbidden: only the recipient can approve or reject' });
      }

      const statusMap: Record<string, string> = {
        approve: 'active',
        reject: 'rejected',
        block: 'blocked',
        revoke: 'revoked',
      };
      const newStatus = statusMap[action];
      if (!newStatus) return reply.status(400).send({ error: 'Invalid action' });
      await fastify.db
        .collection(COL)
        .doc(id)
        .update({
          status: newStatus,
          ...(reason ? { reason } : {}),
          updatedAt: new Date().toISOString(),
        });
      return { success: true };
    },
  );

  /**
   * POST /api/v1/promoter-connections/invites
   * Fix: requireAuth + caller must own the hostId they are creating an invite for
   */
  fastify.post(
    '/invites',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: InvitesBody })],
    },
    async (request: any, reply) => {
      const { id, hostId, email, name, type, expiresAt } = request.body as any;
      const uid = request.user.uid;

      if (!id || !hostId || !email) {
        return reply.status(400).send({ error: 'id, hostId, and email are required' });
      }

      // Verify caller owns the host they are creating an invite for
      const hostDoc = await fastify.db
        .collection('hosts')
        .doc(hostId)
        .get()
        .catch(() => null);
      const hdata = hostDoc?.exists ? (hostDoc.data() as any) : null;
      const isOwner =
        hdata && (hdata.ownerId === uid || hdata.ownerUid === uid || hdata.userId === uid);
      if (!isOwner) {
        return reply.status(403).send({ error: 'Forbidden: you do not own this host' });
      }

      const now = new Date().toISOString();
      const invite = {
        id,
        hostId,
        email,
        name: name || '',
        type: type || 'promoter',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      await fastify.db.collection('onboarding_invites').doc(id).set(invite);
      return { success: true, invite };
    },
  );

  /**
   * POST /api/v1/promoter-connections/links/click
   * Fix: requireAuth + doc-exists guard before update
   */
  fastify.post(
    '/links/click',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: LinkClickBody })],
    },
    async (request: any, reply) => {
      const { linkId } = request.body as any;
      if (!linkId) return reply.status(400).send({ error: 'linkId is required' });
      const linkRef = fastify.db.collection('promoter_links').doc(linkId);
      const linkSnap = await linkRef.get().catch(() => null);
      if (!linkSnap?.exists) return reply.status(404).send({ error: 'Link not found' });
      const { FieldValue } = await import('firebase-admin/firestore');
      await linkRef.update({
        clicks: FieldValue.increment(1),
        lastClickAt: new Date().toISOString(),
      });
      return { success: true };
    },
  );
}
