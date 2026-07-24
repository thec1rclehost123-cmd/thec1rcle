import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getHostAnalytics } from '@c1rcle/core/analytics-engine';
import { HostService } from '../../services/unified/host-service.js';
import {
  buildPayoutAccountRecord,
  sanitizeEventResubmissionPatch,
} from '../../lib/partner-hardening.js';
import { enrichHostProfileWithSignedUrls, cleanHostProfilePatch } from '../../lib/signed-urls.js';
import { getPartnerCommerceRows } from '../../lib/canonicalCommerceMetrics.js';

const HostOverviewQuery = z
  .object({
    hostId: z.string(),
  })
  .strict();

const HostEventsQuery = z
  .object({
    hostId: z.string(),
    limit: z.string().optional(),
    lastId: z.string().optional(),
  })
  .strict();

const HostIdQuery = z.object({ hostId: z.string() });
const HostProfilePatch = z.object({ hostId: z.string(), patch: z.record(z.string(), z.any()) });
const PartnershipActionBody = z.object({ action: z.enum(['approve', 'reject']) });
const NotificationsReadBody = z.object({
  hostId: z.string(),
  notificationId: z.string().optional(),
  markAllRead: z.boolean().optional(),
});
const TeamInviteBody = z.object({
  hostId: z.string(),
  email: z.string().email(),
  role: z.string(),
  name: z.string().optional(),
});
const TeamMemberPatch = z.object({ role: z.string().optional(), isActive: z.boolean().optional() });
const HostOrdersQuery = z.object({
  hostId: z.string(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
  status: z.string().optional(),
});
const HostFinanceQuery = z.object({
  hostId: z.string(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
});
const HostTimeSeriesQuery = z.object({
  hostId: z.string(),
  range: z.enum(['1d', '1w', '1m', 'all']).optional(),
  metric: z.enum(['tickets', 'revenue']).optional(),
});
const HostVenueCalendarQuery = z.object({
  hostId: z.string(),
  venueId: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
const ALLOWED_PROFILE_FIELDS = [
  'displayName',
  'bio',
  'tagline',
  'profileImage',
  'coverImage',
  'socialLinks',
  'contactEmail',
  'contactPhone',
  'genre',
  'city',
  'instagramHandle',
  'youtubeHandle',
  'spotifyHandle',
];

export default async function hostRoutes(fastify: FastifyInstance) {
  const hostService = new HostService({ db: fastify.db, log: fastify.log, redis: fastify.redis });
  /**
   * GET /host/overview
   * Aggregated statistics for the host dashboard
   */
  fastify.get(
    '/host/overview',
    {
      preHandler: [
        fastify.validate({ querystring: HostOverviewQuery }),
        fastify.requireRoles(['admin', 'partner', 'host']),
      ],
    },
    async (request: { query: any }, reply: any) => {
      const { hostId } = request.query;
      if (!hostId) return reply.status(400).send({ error: 'hostId is required' });

      const cacheKey = `overview:${hostId}`;

      try {
        // 0. Check Cache
        const cached = await fastify.cache.get('host', cacheKey);
        if (cached) {
          return reply
            .header('Cache-Control', 'private, max-age=300')
            .send({ success: true, ...cached, fromCache: true });
        }

        // Verify access
        await fastify.verifyPartnerAccess(request, hostId);

        const ctx = { partnerId: hostId, type: 'host', roles: ['host_owner'] } as any;
        const overview = await hostService.getOverview(ctx, { range: '1m', metric: 'revenue' });

        const responseData = {
          stats: {
            revenue: overview.stats.totalRevenue,
            ticketsSold: overview.stats.totalTicketsSold,
            activePromoters: (
              await fastify.db
                .collection('promoter_connections')
                .where('hostId', '==', hostId)
                .where('status', '==', 'active')
                .count()
                .get()
            ).data().count,
            pendingItems: overview.stats.activeEventsCount,
          },
          upcomingEvents: overview.upcomingEvents.map((e) => ({
            id: e.eventId,
            name: e.title,
            date: e.startDate,
            startDate: e.startDate,
            venue_name: e.venueName || 'TBD',
            status: e.status,
            lifecycle: e.status,
            poster_url: e.coverImage,
          })),
        };

        // 3. Save to Cache (5 min TTL)
        await fastify.cache.set('host', cacheKey, responseData, 300);

        return reply
          .header('Cache-Control', 'private, max-age=300')
          .send({ success: true, ...responseData });
      } catch (error: any) {
        fastify.log.error(`Host overview failed: ${error.message}`);
        return reply
          .status(
            error.message.includes('Forbidden') || error.message.includes('Unauthorized')
              ? 403
              : 500,
          )
          .send({
            error:
              error.message.includes('Forbidden') || error.message.includes('Unauthorized')
                ? 'Access denied'
                : 'Internal server error',
          });
      }
    },
  );

  /**
   * GET /host/events
   * List events owned by the host
   */
  // ── Host Profile ────────────────────────────────────────────────────────

  fastify.get(
    '/host/profile',
    {
      preHandler: [fastify.validate({ querystring: HostIdQuery })],
    },
    async (request: any, reply) => {
      const { hostId } = request.query;
      await fastify.verifyPartnerAccess(request, hostId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const doc = await fastify.db.collection('hosts').doc(hostId).get();
      if (!doc.exists) return reply.status(404).send({ error: 'Host not found' });
      const enriched = await enrichHostProfileWithSignedUrls({ id: doc.id, ...doc.data() });
      return { host: enriched };
    },
  );

  fastify.patch(
    '/host/profile',
    {
      preHandler: [fastify.validate({ body: HostProfilePatch })],
    },
    async (request: any, reply) => {
      const { hostId, patch } = request.body;
      await fastify.verifyPartnerAccess(request, hostId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const cleanedPatch = cleanHostProfilePatch(patch);
      const safe: Record<string, any> = {};
      for (const k of ALLOWED_PROFILE_FIELDS) {
        if (cleanedPatch[k] !== undefined) safe[k] = cleanedPatch[k];
      }
      safe.updatedAt = new Date().toISOString();
      await fastify.db.collection('hosts').doc(hostId).update(safe);
      await fastify.publicDiscoveryService.syncHostReadModels(hostId).catch(() => {});
      await fastify.invalidatePublicDiscovery('all').catch(() => {});
      await fastify
        .writeAuditLog({
          action: 'HOST_PROFILE_UPDATED',
          actorUid: request.user?.uid || hostId,
          entityId: hostId,
          payload: { patch: safe },
        })
        .catch(() => {});
      const doc = await fastify.db.collection('hosts').doc(hostId).get();
      const enriched = await enrichHostProfileWithSignedUrls({ id: doc.id, ...doc.data() });
      return { host: enriched };
    },
  );

  // ── Host Partnerships ────────────────────────────────────────────────────

  fastify.get(
    '/host/partnerships',
    {
      preHandler: [fastify.validate({ querystring: HostIdQuery })],
    },
    async (request: any, reply) => {
      const { hostId } = request.query;
      await fastify.verifyPartnerAccess(request, hostId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const snap = await fastify.db
        .collection('partnerships')
        .where('hostId', '==', hostId)
        .orderBy('createdAt', 'desc')
        .get();
      return { partnerships: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) };
    },
  );

  fastify.patch('/host/partnerships/:partnershipId', async (request: any, reply) => {
    const { partnershipId } = request.params;
    const { action } = request.body as any;
    if (!['approve', 'reject'].includes(action))
      return reply.status(400).send({ error: 'action must be approve or reject' });
    const ref = fastify.db.collection('partnerships').doc(partnershipId);
    const doc = await ref.get();
    if (!doc.exists) return reply.status(404).send({ error: 'Partnership not found' });
    const p = doc.data() as any;
    await fastify.verifyPartnerAccess(request, p.hostId).catch(() => {
      throw reply.status(403).send({ error: 'Forbidden' });
    });
    await ref.update({
      status: action === 'approve' ? 'active' : 'rejected',
      updatedAt: new Date().toISOString(),
    });
    return { success: true, status: action === 'approve' ? 'active' : 'rejected' };
  });

  // ── Host Notifications ───────────────────────────────────────────────────

  fastify.get(
    '/host/notifications',
    {
      preHandler: [fastify.validate({ querystring: HostIdQuery })],
    },
    async (request: any, reply) => {
      const { hostId } = request.query;
      await fastify.verifyPartnerAccess(request, hostId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const snap = await fastify.db
        .collection('notifications')
        .where('recipientId', '==', hostId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      return { notifications: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) };
    },
  );

  fastify.patch(
    '/host/notifications/read',
    {
      preHandler: [fastify.validate({ body: NotificationsReadBody })],
    },
    async (request: any, reply) => {
      const { hostId, notificationId, markAllRead } = request.body as any;
      await fastify.verifyPartnerAccess(request, hostId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      if (markAllRead) {
        const snap = await fastify.db
          .collection('notifications')
          .where('recipientId', '==', hostId)
          .where('read', '==', false)
          .get();
        const batch = fastify.db.batch();
        snap.docs.forEach((d: any) => batch.update(d.ref, { read: true }));
        await batch.commit();
        return { success: true, markedCount: snap.size };
      }
      if (notificationId) {
        await fastify.db.collection('notifications').doc(notificationId).update({ read: true });
        return { success: true, markedCount: 1 };
      }
      return reply.status(400).send({ error: 'notificationId or markAllRead required' });
    },
  );

  // ── Host Orders ──────────────────────────────────────────────────────────

  fastify.get(
    '/host/orders',
    {
      preHandler: [fastify.validate({ querystring: HostOrdersQuery })],
    },
    async (request: any, reply) => {
      const { hostId, limit = '20', cursor, status } = request.query as any;
      await fastify.verifyPartnerAccess(request, hostId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const pageSize = Math.min(parseInt(limit), 100);
      let q: any = fastify.db
        .collection('orders')
        .where('hostId', '==', hostId)
        .orderBy('createdAt', 'desc');
      if (status) q = q.where('status', '==', status);
      if (cursor) {
        const cursorDoc = await fastify.db.collection('orders').doc(cursor).get();
        if (cursorDoc.exists) q = q.startAfter(cursorDoc);
      }
      q = q.limit(pageSize + 1);
      const snap = await q.get();
      const hasMore = snap.docs.length > pageSize;
      const orders = snap.docs.slice(0, pageSize).map((d: any) => {
        const o = d.data();
        return { id: d.id, ...o, buyerEmail: undefined, buyerPhone: undefined };
      });
      return { orders, hasMore, nextCursor: hasMore ? orders[orders.length - 1].id : null };
    },
  );

  // ── Host Finance ─────────────────────────────────────────────────────────

  fastify.get(
    '/host/finance/disputes',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: HostIdQuery })],
    },
    async (request: any, reply) => {
      const { hostId } = request.query as any;
      await fastify.verifyPartnerAccess(request, hostId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const snap = await fastify.db
        .collection('disputes')
        .where('hostId', '==', hostId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      return { disputes: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) };
    },
  );

  fastify.get(
    '/host/finance/payouts',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: HostFinanceQuery })],
    },
    async (request: any, reply) => {
      const { hostId, limit = '20', cursor } = request.query as any;
      await fastify.verifyPartnerAccess(request, hostId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const pageSize = Math.min(parseInt(limit), 50);
      let q: any = fastify.db
        .collection('partner_settlements')
        .where('partnerId', '==', hostId)
        .orderBy('createdAt', 'desc')
        .limit(pageSize + 1);
      if (cursor) {
        const c = await fastify.db.collection('partner_settlements').doc(cursor).get();
        if (c.exists) q = q.startAfter(c);
      }
      const snap = await q.get();
      const hasMore = snap.docs.length > pageSize;
      const payouts = snap.docs.slice(0, pageSize).map((d: any) => ({ id: d.id, ...d.data() }));
      return { payouts, hasMore, nextCursor: hasMore ? payouts[payouts.length - 1].id : null };
    },
  );

  fastify.get(
    '/host/finance/bank-accounts',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: HostIdQuery })],
    },
    async (request: any, reply) => {
      const { hostId } = request.query as any;
      await fastify.verifyPartnerAccess(request, hostId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const snap = await fastify.db
        .collection('bank_accounts')
        .where('partnerId', '==', hostId)
        .get();

      return {
        accounts: snap.docs.map((doc: any) => {
          const data = doc.data() || {};
          return {
            id: doc.id,
            bankName: data.bankName || 'Bank Account',
            last4: data.last4 || data.accountLast4 || '0000',
            isDefault: data.isDefault ?? false,
            paymentType: data.paymentType || 'bank_account',
          };
        }),
      };
    },
  );

  fastify.post('/host/finance/bank-accounts', async (request: any, reply) => {
    const body = request.body as Record<string, any>;
    const hostId = String(body.hostId || '');
    if (!hostId) return reply.status(400).send({ error: 'hostId required' });
    await fastify.verifyPartnerAccess(request, hostId).catch(() => {
      throw reply.status(403).send({ error: 'Forbidden' });
    });

    const account = buildPayoutAccountRecord(body, { partnerId: hostId, ownerType: 'host' });
    const ref = await fastify.db.collection('bank_accounts').add(account.record);
    await fastify
      .writeAuditLog({
        action: 'BANK_ACCOUNT_ADDED',
        actorUid: request.user?.uid || hostId,
        entityId: ref.id,
        payload: { hostId },
      })
      .catch(() => {});
    return reply.status(201).send(account.response(ref.id));
  });

  fastify.delete('/host/finance/bank-accounts', async (request: any, reply) => {
    const query = request.query as { hostId?: string; accountId?: string };
    const body = (request.body || {}) as Record<string, any>;
    const hostId = query.hostId || String(body.hostId || '');
    const accountId = query.accountId || String(body.accountId || '');

    if (!hostId || !accountId)
      return reply.status(400).send({ error: 'hostId and accountId required' });
    await fastify.verifyPartnerAccess(request, hostId).catch(() => {
      throw reply.status(403).send({ error: 'Forbidden' });
    });

    const ref = fastify.db.collection('bank_accounts').doc(accountId);
    const doc = await ref.get();
    if (!doc.exists) return reply.status(404).send({ error: 'Account not found' });

    const account = doc.data() as Record<string, any>;
    if (String(account.partnerId || '') !== hostId)
      return reply.status(403).send({ error: 'Forbidden' });

    await ref.delete();
    await fastify
      .writeAuditLog({
        action: 'BANK_ACCOUNT_DELETED',
        actorUid: request.user?.uid || hostId,
        entityId: accountId,
        payload: { hostId },
      })
      .catch(() => {});
    return { success: true };
  });

  // ── Host Overview Summary ────────────────────────────────────────────────

  fastify.get(
    '/host/overview/summary',
    {
      preHandler: [fastify.validate({ querystring: HostIdQuery })],
    },
    async (request: any, reply) => {
      const { hostId } = request.query as any;
      await fastify.verifyPartnerAccess(request, hostId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const [partnerSnap, promoterSnap, eventsSnap] = await Promise.all([
        fastify.db.collection('partnerships').where('hostId', '==', hostId).get(),
        fastify.db
          .collection('promoter_connections')
          .where('hostId', '==', hostId)
          .where('status', '==', 'active')
          .get(),
        fastify.db
          .collection('events')
          .where('creatorId', '==', hostId)
          .where('lifecycle', 'in', ['submitted', 'scheduled', 'live', 'approved'])
          .orderBy('startDate', 'asc')
          .limit(5)
          .get(),
      ]);
      const pendingPartnerships = partnerSnap.docs.filter(
        (d: any) => d.data().status === 'pending',
      ).length;
      return {
        pendingPartnerships,
        activePromoters: promoterSnap.size,
        upcomingEvents: eventsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
      };
    },
  );

  // ── Host Team ────────────────────────────────────────────────────────────

  fastify.get(
    '/host/team',
    {
      preHandler: [fastify.validate({ querystring: HostIdQuery })],
    },
    async (request: any, reply) => {
      const { hostId } = request.query as any;
      await fastify.verifyPartnerAccess(request, hostId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const snap = await fastify.db
        .collection('partner_memberships')
        .where('partnerId', '==', hostId)
        .where('partnerType', '==', 'host')
        .get();
      return { members: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) };
    },
  );

  fastify.patch(
    '/host/team/:memberId',
    {
      preHandler: [fastify.validate({ body: TeamMemberPatch })],
    },
    async (request: any, reply) => {
      const { memberId } = request.params as any;
      const patch = request.body as any;
      const doc = await fastify.db.collection('partner_memberships').doc(memberId).get();
      if (!doc.exists) return reply.status(404).send({ error: 'Member not found' });
      const m = doc.data() as any;
      await fastify.verifyPartnerAccess(request, m.partnerId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const safe: Record<string, any> = {};
      if (patch.role !== undefined) safe.role = patch.role;
      if (patch.isActive !== undefined) safe.isActive = patch.isActive;
      safe.updatedAt = new Date().toISOString();
      await fastify.db.collection('partner_memberships').doc(memberId).update(safe);
      await fastify
        .writeAuditLog({
          action: 'TEAM_MEMBER_UPDATED',
          actorUid: request.user?.uid || m.partnerId,
          entityId: memberId,
          payload: { hostId: m.partnerId, patch: safe },
        })
        .catch(() => {});
      return { success: true };
    },
  );

  fastify.delete('/host/team/:memberId', async (request: any, reply) => {
    const { memberId } = request.params as any;
    const doc = await fastify.db.collection('partner_memberships').doc(memberId).get();
    if (!doc.exists) return reply.status(404).send({ error: 'Member not found' });
    const m = doc.data() as any;
    await fastify.verifyPartnerAccess(request, m.partnerId).catch(() => {
      throw reply.status(403).send({ error: 'Forbidden' });
    });
    await fastify.db
      .collection('partner_memberships')
      .doc(memberId)
      .update({ isActive: false, removedAt: new Date().toISOString() });
    await fastify
      .writeAuditLog({
        action: 'TEAM_MEMBER_REMOVED',
        actorUid: request.user?.uid || m.partnerId,
        entityId: memberId,
        payload: { hostId: m.partnerId },
      })
      .catch(() => {});
    return { success: true };
  });

  // ── Host Promoters ────────────────────────────────────────────────────────

  fastify.get(
    '/host/promoters',
    {
      preHandler: [fastify.validate({ querystring: HostIdQuery })],
    },
    async (request: any, reply) => {
      const { hostId } = request.query as any;
      await fastify.verifyPartnerAccess(request, hostId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const snap = await fastify.db
        .collection('promoter_connections')
        .where('hostId', '==', hostId)
        .orderBy('createdAt', 'desc')
        .get();
      return { promoters: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) };
    },
  );

  // ── Host Event Sub-routes ────────────────────────────────────────────────

  fastify.get('/host/events/:id/tickets', async (request: any, reply) => {
    const { id: eventId } = request.params as any;
    const userId = request.user?.uid;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
    const eventDoc = await fastify.db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) return reply.status(404).send({ error: 'Event not found' });
    const ev = eventDoc.data() as any;
    if (ev.hostId !== userId && ev.creatorId !== userId) {
      try {
        await fastify.verifyPartnerAccess(request, ev.creatorId || ev.hostId);
      } catch {
        return reply.status(403).send({ error: 'Forbidden' });
      }
    }
    const tiers = (ev.ticketTiers || ev.tiers || ev.tickets || []).map((t: any) => ({
      id: t.id || t.tierId,
      name: t.name,
      price: t.price,
      quantity: t.quantity || t.maxQuantity || 0,
      sold: t.sold || 0,
      status: t.status || 'active',
    }));
    return { tiers, eventId };
  });

  fastify.patch('/host/events/:id/tickets', async (request: any, reply) => {
    const { id: eventId } = request.params as any;
    const { tiers } = request.body as any;
    if (!Array.isArray(tiers)) return reply.status(400).send({ error: 'tiers array required' });
    const eventDoc = await fastify.db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) return reply.status(404).send({ error: 'Event not found' });
    const ev = eventDoc.data() as any;
    try {
      await fastify.verifyPartnerAccess(request, ev.creatorId || ev.hostId);
    } catch {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    await fastify.db
      .collection('events')
      .doc(eventId)
      .update({ ticketTiers: tiers, updatedAt: new Date().toISOString() });
    await fastify.cache.delete('events:detail', eventId).catch(() => {});
    return { success: true };
  });

  fastify.post('/host/events/:id/submit', async (request: any, reply) => {
    const { id: eventId } = request.params as any;
    const userId = request.user?.uid;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
    const eventDoc = await fastify.db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) return reply.status(404).send({ error: 'Event not found' });
    const ev = eventDoc.data() as any;
    const hostId = ev.creatorId || ev.hostId;
    try {
      await fastify.verifyPartnerAccess(request, hostId);
    } catch {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    if (!['draft', 'changes_requested'].includes(ev.lifecycle || ev.status || '')) {
      return reply
        .status(409)
        .send({ error: `Cannot submit event in ${ev.lifecycle || ev.status} state` });
    }
    const now = new Date().toISOString();
    await fastify.db
      .collection('events')
      .doc(eventId)
      .update({ lifecycle: 'submitted', status: 'submitted', updatedAt: now, submittedAt: now });
    await fastify.db.collection('submission_history').add({
      eventId,
      fromState: ev.lifecycle || ev.status,
      toState: 'submitted',
      actorUid: userId,
      actorRole: 'host',
      timestamp: now,
    });
    if (ev.venueId) {
      await fastify.db.collection('notifications').add({
        recipientId: ev.venueId,
        recipientType: 'venue',
        type: 'event_submitted',
        eventId,
        hostId,
        title: 'New Event Submission',
        message: `${ev.title} has been submitted for your approval.`,
        read: false,
        createdAt: now,
      });
    }
    await fastify.cache.delete('events:detail', eventId).catch(() => {});
    await fastify.publicDiscoveryService.syncEventReadModels(eventId).catch(() => {});
    return { success: true };
  });

  fastify.patch('/host/events/:id/resubmit', async (request: any, reply) => {
    const { id: eventId } = request.params as any;
    const userId = request.user?.uid;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
    const eventDoc = await fastify.db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) return reply.status(404).send({ error: 'Event not found' });
    const ev = eventDoc.data() as any;
    const hostId = ev.creatorId || ev.hostId;
    try {
      await fastify.verifyPartnerAccess(request, hostId);
    } catch {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    if (!['changes_requested', 'rejected'].includes(ev.lifecycle || ev.status || '')) {
      return reply
        .status(409)
        .send({ error: `Cannot resubmit event in ${ev.lifecycle || ev.status} state` });
    }
    const body = request.body as any;
    const now = new Date().toISOString();
    const updates: Record<string, any> = {
      lifecycle: 'submitted',
      status: 'submitted',
      updatedAt: now,
      resubmittedAt: now,
    };
    Object.assign(updates, sanitizeEventResubmissionPatch(body?.patch));
    await fastify.db.collection('events').doc(eventId).update(updates);
    await fastify.db.collection('submission_history').add({
      eventId,
      fromState: ev.lifecycle,
      toState: 'submitted',
      actorUid: userId,
      actorRole: 'host',
      note: body?.note,
      timestamp: now,
    });
    if (ev.venueId) {
      await fastify.db.collection('notifications').add({
        recipientId: ev.venueId,
        recipientType: 'venue',
        type: 'event_resubmitted',
        eventId,
        hostId,
        title: 'Event Resubmitted',
        message: `${ev.title} has been resubmitted for your approval.`,
        read: false,
        createdAt: now,
      });
    }
    await fastify.cache.delete('events:detail', eventId).catch(() => {});
    await fastify.publicDiscoveryService.syncEventReadModels(eventId).catch(() => {});
    return { success: true };
  });

  fastify.get(
    '/host/events',
    {
      preHandler: [
        fastify.validate({ querystring: HostEventsQuery }),
        fastify.requireRoles(['admin', 'partner', 'host']),
      ],
    },
    async (request: { query: any }, reply: any) => {
      const { hostId, limit = 20, lastId } = request.query;
      if (!hostId) return reply.status(400).send({ error: 'hostId is required' });

      const cacheKey = JSON.stringify(request.query);

      try {
        // 0. Check Cache
        const cached = await fastify.cache.get('host', cacheKey);
        if (cached) {
          return reply
            .header('Cache-Control', 'private, max-age=60')
            .send({ success: true, ...cached, fromCache: true });
        }

        await fastify.verifyPartnerAccess(request, hostId);

        let q = fastify.db
          .collection('events')
          .where('creatorId', '==', hostId)
          .orderBy('startDate', 'desc');

        const paginationLimit = Math.min(Number(limit), 100);

        // Cursor-based pagination
        if (lastId) {
          const lastDoc = await fastify.db.collection('events').doc(lastId).get();
          if (lastDoc.exists) {
            q = q.startAfter(lastDoc);
          }
        }

        // Fetch +1 to determine if there's more
        q = q.limit(paginationLimit + 1);

        const snapshot = await q.get();
        const docs = snapshot.docs;

        const hasMore = docs.length > paginationLimit;
        const data = docs.slice(0, paginationLimit).map((doc) => {
          const raw = doc.data() as any;
          // Projection: Return only what's needed for the dashboard list
          return {
            id: doc.id,
            title: raw.title,
            startDate: raw.startDate,
            lifecycle: raw.lifecycle,
            venue_name: raw.venue || 'TBD',
            image: raw.image || raw.poster,
          };
        });

        const response = {
          success: true,
          events: data,
          nextCursor: hasMore ? data[data.length - 1].id : null,
          hasMore,
        };

        // 4. Save to Cache (60s TTL)
        await fastify.cache.set('host', cacheKey, response, 60);

        return reply.header('Cache-Control', 'private, max-age=60').send(response);
      } catch (error: any) {
        fastify.log.error(`Host events list failed: ${error.message}`);
        return reply
          .status(
            error.message.includes('Forbidden') || error.message.includes('Unauthorized')
              ? 403
              : 500,
          )
          .send({
            error:
              error.message.includes('Forbidden') || error.message.includes('Unauthorized')
                ? 'Access denied'
                : 'Internal server error',
          });
      }
    },
  );

  // ── Host Analytics Time-Series ────────────────────────────────────────────

  fastify.get(
    '/host/analytics/time-series',
    {
      preHandler: [fastify.validate({ querystring: HostTimeSeriesQuery })],
    },
    async (request: any, reply) => {
      const { hostId, range = '1w', metric = 'revenue' } = request.query as any;
      await fastify.verifyPartnerAccess(request, hostId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const cacheKey = `${hostId}:${range}:${metric}`;
      const cached = await fastify.cache.get('analytics:host:ts', cacheKey);
      if (cached)
        return reply
          .header('Cache-Control', 'private, max-age=120')
          .send({ ...cached, fromCache: true });
      try {
        const stats = await getHostAnalytics(hostId, range as any);
        await fastify.cache.set('analytics:host:ts', cacheKey, stats, 120);
        return reply.header('Cache-Control', 'private, max-age=120').send(stats);
      } catch (error: any) {
        fastify.log.error(`Host analytics time-series error: ${error.message}`);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    },
  );

  // ── Host Analytics Overview ───────────────────────────────────────────────

  fastify.get(
    '/host/analytics/overview',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { hostId } = request.query as any;
      if (!hostId) return reply.status(400).send({ error: 'hostId required' });
      await fastify.verifyPartnerAccess(request, hostId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [eventsSnap, commerceRows, checkinsSnap] = await Promise.all([
        fastify.db
          .collection('events')
          .where('creatorId', '==', hostId)
          .get()
          .catch(() => ({ docs: [] as any[], size: 0 })),
        getPartnerCommerceRows(fastify.db, hostId, 'hostId'),
        fastify.db
          .collection('check_ins')
          .where('hostId', '==', hostId)
          .where('checkedInAt', '>=', thirtyDaysAgo)
          .get()
          .catch(() => ({ size: 0 })),
      ]);
      const totalRevenuePaise = commerceRows.ledger
        .filter((entry) => !entry.createdAtIso || entry.createdAtIso >= thirtyDaysAgo)
        .reduce((sum, entry) => sum + Number(entry.amountPaise || 0), 0);
      const totalTickets = commerceRows.tickets.filter(
        (ticket) => !ticket.createdAtIso || ticket.createdAtIso >= thirtyDaysAgo,
      ).length;
      const eventCount = (eventsSnap as any).size || ((eventsSnap as any).docs || []).length;
      return reply.send({
        period: '30d',
        events: { total: eventCount },
        revenue: { totalPaise: totalRevenuePaise, total: totalRevenuePaise / 100 },
        tickets: { sold: totalTickets },
        attendance: { checkedIn: (checkinsSnap as any).size || 0 },
      });
    },
  );

  // ── Host Venue Calendar ───────────────────────────────────────────────────

  fastify.get(
    '/host/venue-calendar',
    {
      preHandler: [fastify.validate({ querystring: HostVenueCalendarQuery })],
    },
    async (request: any, reply) => {
      const { hostId, venueId, startDate, endDate } = request.query as any;
      await fastify.verifyPartnerAccess(request, hostId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const partnerSnap = await fastify.db
        .collection('partnerships')
        .where('hostId', '==', hostId)
        .where('venueId', '==', venueId)
        .where('status', '==', 'active')
        .limit(1)
        .get();
      if (partnerSnap.empty)
        return reply.status(403).send({ error: 'No active partnership with this venue' });
      let q: any = fastify.db.collection('availability_slots').where('venueId', '==', venueId);
      if (startDate) q = q.where('date', '>=', startDate);
      if (endDate) q = q.where('date', '<=', endDate);
      const snap = await q.get();
      const calendar = snap.docs.map((d: any) => {
        const data = d.data();
        return {
          id: d.id,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          status: data.status,
        };
      });
      return reply.header('Cache-Control', 'private, max-age=30').send({ calendar });
    },
  );

  // ── Host Finance Overview ─────────────────────────────────────────────────

  fastify.get(
    '/host/finance/overview',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: HostIdQuery })],
    },
    async (request: any, reply) => {
      const { hostId } = request.query as any;
      await fastify.verifyPartnerAccess(request, hostId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });
      const cacheKey = `host:finance:overview:${hostId}`;
      const cached = await fastify.cache.get('host', cacheKey);
      if (cached)
        return reply
          .header('Cache-Control', 'private, max-age=120')
          .send({ ...cached, fromCache: true });
      const [settlementsSnap, disputesSnap] = await Promise.all([
        fastify.db
          .collection('partner_settlements')
          .where('partnerId', '==', hostId)
          .orderBy('createdAt', 'desc')
          .limit(10)
          .get(),
        fastify.db.collection('disputes').where('hostId', '==', hostId).limit(50).get(),
      ]);
      const settlements = settlementsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      const disputes = disputesSnap.docs.map((d: any) => d.data());
      const totalPending = settlements
        .filter((s: any) => s.status === 'pending')
        .reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
      const totalPaid = settlements
        .filter((s: any) => s.status === 'paid')
        .reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
      const result = {
        totalPending,
        totalPaid,
        openDisputes: disputes.filter((d: any) => d.status === 'open').length,
        recentPayouts: settlements,
      };
      await fastify.cache.set('host', cacheKey, result, 120);
      return reply.header('Cache-Control', 'private, max-age=120').send(result);
    },
  );
}
