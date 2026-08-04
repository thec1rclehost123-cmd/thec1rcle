import { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { trackPromoterLinkClick } from '@c1rcle/core/promoter-engine';
// @ts-ignore - JS module with runtime exports
import { signPromoterAttribution } from '@c1rcle/core/promoter-attribution';
import { z } from 'zod';
import { resolvePartnerContext } from '../../lib/partner-context.js';

const CreateLinkBody = z
  .object({
    eventId: z.string(),
    ticketTierIds: z.array(z.string()).max(50).optional(),
  })
  .strict();

const LinksQuery = z
  .object({
    promoterId: z.string().optional(),
    eventId: z.string().optional(),
    isActive: z.string().optional(),
    limit: z.string().optional(),
  })
  .strict();

const CodeParam = z.object({ code: z.string() }).strict();
const PromoterIdParam = z.object({ promoterId: z.string() }).strict();
const EventIdParam = z.object({ eventId: z.string() }).strict();
const LinkIdParam = z.object({ id: z.string() }).strict();

export default async function promoterLinksRoutes(fastify: FastifyInstance) {
  const LINKS_COL = 'promoter_links';
  const COMMISSIONS_COL = 'promoter_commissions';

  /**
   * GET /api/v1/promoter-links/:id
   * Public endpoint — used by the guest-portal refer page (no auth token available).
   * Returns only the minimal fields needed to resolve the referral redirect.
   * Financial fields (commissionRate, revenue, commission, conversions, clicks) are intentionally excluded.
   */
  fastify.get(
    '/:id',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ params: z.object({ id: z.string().min(1) }) })],
    },
    async (request: any, reply: any) => {
      const { id } = request.params;
      const doc = await fastify.db
        .collection(LINKS_COL)
        .doc(id)
        .get()
        .catch(() => null);
      if (!doc || !doc.exists) {
        return reply.status(404).send({ success: false, error: 'Link not found' });
      }
      const data = doc.data() as any;
      // Public projection only — never expose financial or identity fields unauthenticated.
      const link = {
        id: doc.id,
        code: data.code,
        eventId: data.eventId,
        eventSlug: data.eventSlug || null,
        isActive: data.isActive,
        expiresAt: data.expiresAt || null,
      };
      return reply.send({ success: true, link });
    },
  );

  /**
   * POST /api/v1/promoter-links/create
   */
  fastify.post(
    '/create',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ body: CreateLinkBody })],
    },
    async (request: any, reply) => {
      const { eventId, ticketTierIds = [] } = request.body as {
        eventId: string;
        ticketTierIds?: string[];
      };
      let context;
      try {
        context = await resolvePartnerContext(fastify.db, request);
      } catch (error: any) {
        request.log.error({ error }, 'Unable to resolve promoter link authorization');
        return reply.status(503).send({ error: 'Promoter authorization is unavailable' });
      }
      if (!context || context.type !== 'promoter') {
        return reply.status(403).send({ error: 'An active promoter membership is required' });
      }

      const promoterId = context.partnerId;
      const assignmentId = `${promoterId}_${eventId}`;
      const assignmentRef = fastify.db.collection('promoter_assignments').doc(assignmentId);
      const eventRef = fastify.db.collection('events').doc(eventId);
      const linkRef = fastify.db.collection(LINKS_COL).doc(assignmentId);

      try {
        return await fastify.db.runTransaction(async (transaction: any) => {
          const [assignmentDoc, eventDoc, existingLinkDoc] = await Promise.all([
            transaction.get(assignmentRef),
            transaction.get(eventRef),
            transaction.get(linkRef),
          ]);
          if (!assignmentDoc.exists || !eventDoc.exists) {
            throw Object.assign(new Error('Approved promoter assignment not found'), {
              code: 'PROMOTER_ASSIGNMENT_REQUIRED',
              statusCode: 403,
            });
          }
          const assignment = assignmentDoc.data() as any;
          const event = eventDoc.data() as any;
          if (
            assignment.status !== 'active' ||
            assignment.promoterId !== promoterId ||
            assignment.eventId !== eventId ||
            Number(assignment.assignmentVersion || 0) < 2 ||
            !assignment.approvedByPartnerId
          ) {
            throw Object.assign(new Error('Approved promoter assignment is invalid'), {
              code: 'PROMOTER_ASSIGNMENT_REQUIRED',
              statusCode: 403,
            });
          }
          if (!['scheduled', 'live'].includes(String(event.lifecycle || '').toLowerCase())) {
            throw Object.assign(new Error('Event is not open for promotion'), {
              code: 'EVENT_NOT_PROMOTABLE',
              statusCode: 409,
            });
          }

          const assignedTierIds = Object.keys(assignment.tierCommissions || {});
          const selectedTierIds = [...new Set(ticketTierIds.map(String))].sort();
          if (
            selectedTierIds.length > 0 &&
            assignedTierIds.length > 0 &&
            selectedTierIds.some((tierId) => !assignedTierIds.includes(tierId))
          ) {
            throw Object.assign(new Error('A requested ticket tier is not assigned'), {
              code: 'PROMOTER_TIER_NOT_ASSIGNED',
              statusCode: 403,
            });
          }
          if (existingLinkDoc.exists && existingLinkDoc.data().isActive === true) {
            return existingLinkDoc.data();
          }

          const assignmentVersion = Number(assignment.assignmentVersion);
          const termsVersion = Number(assignment.termsVersion || assignmentVersion);
          const link = {
            id: assignmentId,
            code:
              assignment.linkCode ||
              createHash('sha256')
                .update(`promoter-link:${assignmentId}`)
                .digest('hex')
                .slice(0, 10)
                .toUpperCase(),
            promoterId,
            promoterName: assignment.promoterName || '',
            eventId,
            eventTitle: event.title || assignment.eventTitle || 'Event',
            ticketTierIds: selectedTierIds,
            commissionRate: Number(assignment.commissionRate || 0),
            commissionType: assignment.commissionType || 'percentage',
            tierCommissions: assignment.tierCommissions || null,
            assignmentId,
            assignmentVersion,
            termsVersion,
            clicks: 0,
            conversions: 0,
            revenue: 0,
            commission: 0,
            isActive: true,
            expiresAt: assignment.validUntil || event.startDate || event.startAt || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as any;
          link.attributionSignature = signPromoterAttribution(link);
          transaction.set(linkRef, link);
          return link;
        });
      } catch (error: any) {
        request.log.warn({ error, promoterId, eventId }, 'Promoter link creation rejected');
        return reply.status(error.statusCode || 503).send({
          error: error.message || 'Promoter link creation failed',
          code: error.code || 'PROMOTER_LINK_CREATION_FAILED',
        });
      }
    },
  );

  /**
   * GET /api/v1/promoter-links
   * Caller must be the promoter (filtering by their own promoterId) or manage the event.
   */
  fastify.get(
    '/',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: LinksQuery })],
    },
    async (request: any, reply) => {
      const { promoterId, eventId, isActive, limit = 50 } = request.query;

      // Require at least one scoping filter; enforce ownership of that scope.
      if (!promoterId && !eventId) {
        return reply.status(400).send({ error: 'promoterId or eventId filter is required' });
      }

      if (promoterId && promoterId !== request.user.uid) {
        // Allow host/venue managers to list links for their events, not arbitrary promoters.
        return reply
          .status(403)
          .send({ error: 'Forbidden: can only list your own promoter links' });
      }

      if (eventId && !promoterId) {
        // Caller must manage the event's owning partner.
        const eventDoc = await fastify.db
          .collection('events')
          .doc(eventId)
          .get()
          .catch(() => null);
        const partnerId = eventDoc?.exists
          ? (eventDoc.data() as any).hostId || (eventDoc.data() as any).venueId
          : null;
        if (!partnerId) return reply.status(404).send({ error: 'Event not found' });
        try {
          await fastify.verifyPartnerAccess(request, partnerId);
        } catch {
          return reply.status(403).send({ error: 'Forbidden' });
        }
      }

      let q: any = fastify.db.collection(LINKS_COL);
      if (promoterId) q = q.where('promoterId', '==', promoterId);
      if (eventId) q = q.where('eventId', '==', eventId);
      if (isActive !== undefined) q = q.where('isActive', '==', isActive === 'true');
      const snap = await q.orderBy('createdAt', 'desc').limit(Number(limit)).get();
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    },
  );

  /**
   * GET /api/v1/promoter-links/by-code/:code
   */
  fastify.get(
    '/by-code/:code',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [
        fastify.validate({
          params: CodeParam,
          querystring: z.object({ eventId: z.string().optional() }),
        }),
      ],
    },
    async (request: any, reply) => {
      const { code } = request.params;
      const { eventId } = request.query;
      let query = fastify.db
        .collection(LINKS_COL)
        .where('code', '==', code)
        .where('isActive', '==', true);
      if (eventId) {
        query = query.where('eventId', '==', eventId);
      }
      const snap = await query.limit(1).get();
      if (snap.empty) return reply.status(404).send({ error: 'Link not found' });
      return { id: snap.docs[0].id, ...snap.docs[0].data() };
    },
  );

  /**
   * GET /api/v1/promoter-links/stats/:promoterId
   * Caller must be the promoter or have an admin role.
   */
  fastify.get(
    '/stats/:promoterId',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ params: PromoterIdParam })],
    },
    async (request: any, reply) => {
      const { promoterId } = request.params;
      if (request.user.uid !== promoterId && request.user.role !== 'admin') {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      const [linksSnap, pendingSnap, paidSnap] = await Promise.all([
        fastify.db.collection(LINKS_COL).where('promoterId', '==', promoterId).get(),
        fastify.db
          .collection(COMMISSIONS_COL)
          .where('promoterId', '==', promoterId)
          .where('status', '==', 'pending')
          .get(),
        fastify.db
          .collection(COMMISSIONS_COL)
          .where('promoterId', '==', promoterId)
          .where('status', '==', 'paid')
          .get(),
      ]);
      const links = linksSnap.docs.map((d: any) => d.data());
      const totalClicks = links.reduce((s: number, l: any) => s + (l.clicks || 0), 0);
      const totalConversions = links.reduce((s: number, l: any) => s + (l.conversions || 0), 0);
      return {
        totalLinks: links.length,
        totalClicks,
        totalConversions,
        totalRevenue: links.reduce((s: number, l: any) => s + (l.revenue || 0), 0),
        totalCommission: links.reduce((s: number, l: any) => s + (l.commission || 0), 0),
        pendingCommission: pendingSnap.docs.reduce(
          (s: number, d: any) => s + (d.data().commissionAmount || 0),
          0,
        ),
        paidCommission: paidSnap.docs.reduce(
          (s: number, d: any) => s + (d.data().commissionAmount || 0),
          0,
        ),
        conversionRate: totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) : 0,
      };
    },
  );

  /**
   * GET /api/v1/promoter-links/event-summary/:eventId
   * Caller must manage the event's host/venue.
   */
  fastify.get(
    '/event-summary/:eventId',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ params: EventIdParam })],
    },
    async (request: any, reply) => {
      const { eventId } = request.params;
      const eventDoc = await fastify.db.collection('events').doc(eventId).get();
      if (!eventDoc.exists) return reply.status(404).send({ error: 'Event not found' });
      const partnerId = (eventDoc.data() as any).hostId || (eventDoc.data() as any).venueId;
      const [snap, accessDenied] = await Promise.all([
        fastify.db.collection(LINKS_COL).where('eventId', '==', eventId).get(),
        partnerId
          ? fastify
              .verifyPartnerAccess(request, partnerId)
              .then(() => false)
              .catch(() => true)
          : Promise.resolve(false),
      ]);
      if (accessDenied) return reply.status(403).send({ error: 'Forbidden' });
      const links = snap.docs.map((d: any) => d.data());
      return {
        totalPromoters: new Set(links.map((l: any) => l.promoterId)).size,
        totalClicks: links.reduce((s: number, l: any) => s + (l.clicks || 0), 0),
        totalConversions: links.reduce((s: number, l: any) => s + (l.conversions || 0), 0),
        totalRevenue: links.reduce((s: number, l: any) => s + (l.revenue || 0), 0),
        totalCommission: links.reduce((s: number, l: any) => s + (l.commission || 0), 0),
        topPromoters: links
          .sort((a: any, b: any) => (b.conversions || 0) - (a.conversions || 0))
          .slice(0, 5),
      };
    },
  );

  /**
   * POST /api/v1/promoter-links/track-click
   * Records a click on a promoter link by code. No auth required — called from guest-portal.
   */
  const TrackClickBody = z.object({ code: z.string(), eventId: z.string().optional() }).strict();
  fastify.post(
    '/track-click',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.validate({ body: TrackClickBody })],
    },
    async (request: any, reply) => {
      const { code, eventId } = request.body;

      const result = await trackPromoterLinkClick(code, { source: 'promoter-links', eventId });

      if (result.status !== 'ok') {
        return reply.status(404).send({ error: 'Link not found' });
      }

      return { success: true };
    },
  );

  /**
   * PATCH /api/v1/promoter-links/:id/deactivate
   * Caller must be the promoter who owns the link, or manage the linked event.
   */
  fastify.patch(
    '/:id/deactivate',
    {
      config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
      preHandler: [fastify.requireAuth, fastify.validate({ params: LinkIdParam })],
    },
    async (request: any, reply) => {
      const { id } = request.params;
      const linkDoc = await fastify.db.collection(LINKS_COL).doc(id).get();
      if (!linkDoc.exists) return reply.status(404).send({ error: 'Link not found' });
      const link = linkDoc.data() as any;

      const isOwner = link.promoterId === request.user.uid;
      if (!isOwner && request.user.role !== 'admin') {
        const eventDoc = await fastify.db.collection('events').doc(link.eventId).get();
        const partnerId = eventDoc.exists
          ? (eventDoc.data() as any).hostId || (eventDoc.data() as any).venueId
          : null;
        if (!partnerId) return reply.status(403).send({ error: 'Forbidden' });
        try {
          await fastify.verifyPartnerAccess(request, partnerId);
        } catch {
          return reply.status(403).send({ error: 'Forbidden' });
        }
      }

      const now = new Date().toISOString();
      await fastify.db
        .collection(LINKS_COL)
        .doc(id)
        .update({ isActive: false, deactivatedAt: now, updatedAt: now });
      return { success: true };
    },
  );
}
