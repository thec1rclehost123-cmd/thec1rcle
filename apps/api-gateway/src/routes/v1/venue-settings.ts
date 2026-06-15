import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse } from '../../lib/api-contracts';

const VenueQuery = z.object({ venueId: z.string() }).strict();
const VenueUpdatesBody = z
  .object({
    venueId: z.string(),
    updates: z.record(z.string(), z.any()),
  })
  .strict();

const ReservationsQuery = z
  .object({
    venueId: z.string(),
    status: z.string().optional(),
    limit: z.string().optional(),
  })
  .strict();

const ReservationIdParam = z.object({ id: z.string() }).strict();
const ReservationStatusBody = z
  .object({
    status: z.string(),
    notes: z.string().optional(),
  })
  .strict();
const GuestReservationCreateBody = z
  .object({
    venueId: z.string(),
    venueName: z.string().optional(),
    date: z.string(),
    time: z.string().optional(),
    guests: z.number().int().positive(),
    bookingType: z.enum(['event', 'restaurant']),
    guestName: z.string().optional(),
    guestPhone: z.string().optional(),
    specialRequests: z.string().optional(),
    eventId: z.string().optional(),
    eventTitle: z.string().optional(),
    tableId: z.string().optional(),
    tableName: z.string().optional(),
    tablePrice: z.number().optional(),
    tierId: z.string().optional(),
    tierName: z.string().optional(),
    tierPrice: z.number().optional(),
  })
  .strict();

const HostQuery = z.object({ hostId: z.string() }).strict();
const HostSettingsBody = z
  .object({
    hostId: z.string(),
    settings: z.record(z.string(), z.any()),
  })
  .strict();

/**
 * Venue & Host Settings Gateway Routes
 */
export default async function venueSettingsRoutes(fastify: FastifyInstance) {
  async function requirePartnerScope(
    request: any,
    reply: any,
    partnerId: string,
    partnerType: 'venue' | 'host',
  ) {
    const userId = request.user?.uid;
    if (!userId) {
      reply.status(401).send(
        buildErrorResponse({
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
          requestId: request.id,
        }),
      );
      return false;
    }

    try {
      await fastify.verifyPartnerAccess(request, partnerId);
      return true;
    } catch (error: any) {
      reply.status(403).send(
        buildErrorResponse({
          code: 'FORBIDDEN',
          message: `Forbidden: no ${partnerType} access`,
          requestId: request.id,
        }),
      );
      return false;
    }
  }

  // ── Venue Settings ────────────────────────────────────────────────────────

  /**
   * GET /api/v1/venue/settings?venueId=XXX
   * Used by the Partner Dashboard
   */
  fastify.get(
    '/venue/settings',
    {
      preHandler: [fastify.validate({ querystring: VenueQuery })],
    },
    async (request: any, reply) => {
      const { venueId } = request.query as any;
      if (!venueId)
        return reply.status(400).send(
          buildErrorResponse({
            code: 'BAD_REQUEST',
            message: 'venueId required',
            requestId: request.id,
          }),
        );
      if (!(await requirePartnerScope(request, reply, venueId, 'venue'))) return;

      const doc = await fastify.db.collection('venues').doc(venueId).get();
      if (!doc.exists)
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Venue not found',
            requestId: request.id,
          }),
        );

      const data = doc.data() as any;
      // Return in the specific shape the dashboard expects
      return {
        settings: {
          id: doc.id,
          adminEmail: data.adminEmail || data.contactEmail || '',
          supportHotline: data.supportHotline || data.contactPhone || '',
          operationalTimezone: data.operationalTimezone || 'Asia/Dubai',
          primaryLanguage: data.primaryLanguage || 'English (US)',
          bankAccountName: data.bankAccountName || '',
          bankAccountMasked: data.bankAccountMasked || '',
          settlementCadence: data.settlementCadence || 'weekly',
          notifications: data.notifications || {
            revenueUpdates: true,
            partnerRequests: true,
            securityAudit: true,
            productAnnouncements: false,
          },
          security: data.security || {
            masterPasswordUpdatedAt: null,
            twoFactorEnabled: false,
          },
          ...data,
        },
      };
    },
  );

  /**
   * PATCH /api/v1/venue/settings
   * Used by the Partner Dashboard
   */
  fastify.patch(
    '/venue/settings',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { venueId, patch } = request.body as any;
      if (!venueId || !patch)
        return reply.status(400).send(
          buildErrorResponse({
            code: 'BAD_REQUEST',
            message: 'venueId and patch required',
            requestId: request.id,
          }),
        );
      if (!(await requirePartnerScope(request, reply, venueId, 'venue'))) return;

      await fastify.db.collection('venues').doc(venueId).set(patch, { merge: true });

      await fastify.writeAuditLog({
        action: 'venue.settings.patch',
        actorUid: request.user?.uid,
        actorRole: request.authContext?.activeMembership?.role || request.user?.role || null,
        partnerId: venueId,
        partnerType: 'venue',
        entityId: venueId,
        entityType: 'venue',
        requestId: request.id,
        payload: { patchedFields: Object.keys(patch) },
      });

      return { success: true };
    },
  );

  /**
   * GET /api/v1/venue-settings?venueId=XXX
   */
  fastify.get(
    '/venue',
    {
      preHandler: [fastify.validate({ querystring: VenueQuery })],
    },
    async (request: any, reply) => {
      const { venueId } = request.query as any;
      if (!venueId)
        return reply.status(400).send(
          buildErrorResponse({
            code: 'BAD_REQUEST',
            message: 'venueId required',
            requestId: request.id,
          }),
        );
      if (!(await requirePartnerScope(request, reply, venueId, 'venue'))) return;
      const doc = await fastify.db.collection('venues').doc(venueId).get();
      if (!doc.exists)
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Venue not found',
            requestId: request.id,
          }),
        );
      return { venue: { id: doc.id, ...doc.data() } };
    },
  );

  /**
   * PATCH /api/v1/venue-settings/venue
   * Update venue settings
   */
  fastify.patch(
    '/venue',
    {
      preHandler: [fastify.validate({ body: VenueUpdatesBody })],
    },
    async (request: any, reply) => {
      const { venueId, updates } = request.body as any;
      if (!venueId || !updates)
        return reply.status(400).send(
          buildErrorResponse({
            code: 'BAD_REQUEST',
            message: 'venueId and updates required',
            requestId: request.id,
          }),
        );
      if (!(await requirePartnerScope(request, reply, venueId, 'venue'))) return;

      const allowedFields = [
        'name',
        'description',
        'address',
        'city',
        'state',
        'capacity',
        'amenities',
        'photos',
        'coverImage',
        'contactEmail',
        'contactPhone',
        'socialLinks',
        'operatingHours',
        'dressCode',
        'ageRestriction',
      ];
      const sanitized: Record<string, any> = {};
      for (const key of allowedFields) {
        if (updates[key] !== undefined) sanitized[key] = updates[key];
      }
      sanitized.updatedAt = new Date().toISOString();

      await fastify.db.collection('venues').doc(venueId).update(sanitized);
      await fastify.writeAuditLog({
        action: 'venue.settings.update',
        actorUid: request.user?.uid,
        actorRole: request.authContext?.activeMembership?.role || request.user?.role || null,
        partnerId: venueId,
        partnerType: 'venue',
        entityId: venueId,
        entityType: 'venue',
        requestId: request.id,
        payload: { updatedFields: Object.keys(sanitized).filter((key) => key !== 'updatedAt') },
      });
      await fastify.sendInngestEvent(fastify.InngestEvents.PUBLIC_DISCOVERY_SYNC, {
        type: 'venue',
        id: venueId,
      });
      await fastify.invalidatePublicDiscovery('all');
      return { success: true };
    },
  );

  // ── Venue Reservations ────────────────────────────────────────────────────

  /**
   * POST /api/v1/venue-settings/venue/reservations
   * Create a guest reservation request
   */
  fastify.post(
    '/venue/reservations',
    {
      preHandler: [fastify.validate({ body: GuestReservationCreateBody })],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;
      if (!userId) {
        return reply.status(401).send(
          buildErrorResponse({
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
            requestId: request.id,
          }),
        );
      }

      const venueId = request.body.venueId;
      const venueDoc = await fastify.db.collection('venues').doc(venueId).get();
      if (!venueDoc.exists) {
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Venue not found',
            requestId: request.id,
          }),
        );
      }

      const now = new Date().toISOString();
      const reservation = {
        venueId,
        venueName: request.body.venueName || venueDoc.data()?.name || null,
        userId,
        guestEmail: request.user?.email || null,
        guestName:
          request.body.guestName || request.user?.displayName || request.user?.name || 'Guest',
        guestPhone: request.body.guestPhone || null,
        date: request.body.date,
        time: request.body.time || null,
        guests: request.body.guests,
        bookingType: request.body.bookingType,
        specialRequests: request.body.specialRequests || null,
        eventId: request.body.eventId || null,
        eventTitle: request.body.eventTitle || null,
        tableId: request.body.tableId || null,
        tableName: request.body.tableName || null,
        tablePrice: request.body.tablePrice ?? null,
        tierId: request.body.tierId || null,
        tierName: request.body.tierName || null,
        tierPrice: request.body.tierPrice ?? null,
        status: 'pending',
        requestedAt: now,
        updatedAt: now,
      };

      const created = await fastify.db.collection('table_reservations').add(reservation);
      return {
        success: true,
        reservation: {
          id: created.id,
          ...reservation,
        },
      };
    },
  );

  /**
   * GET /api/v1/venue-settings/venue/reservations?venueId=XXX
   */
  fastify.get(
    '/venue/reservations',
    {
      preHandler: [fastify.validate({ querystring: ReservationsQuery })],
    },
    async (request: any, reply) => {
      const { venueId, status, limit = 50 } = request.query as any;
      if (!venueId)
        return reply.status(400).send(
          buildErrorResponse({
            code: 'BAD_REQUEST',
            message: 'venueId required',
            requestId: request.id,
          }),
        );
      if (!(await requirePartnerScope(request, reply, venueId, 'venue'))) return;

      let q: any = fastify.db.collection('table_reservations').where('venueId', '==', venueId);
      if (status && status !== 'all') q = q.where('status', '==', status);

      const snap = await q.get();
      const reservations = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      reservations.sort((a: any, b: any) => {
        const dateA = new Date(a.requestedAt || 0).getTime();
        const dateB = new Date(b.requestedAt || 0).getTime();
        return dateB - dateA;
      });
      return { reservations: reservations.slice(0, Number(limit)) };
    },
  );

  /**
   * PATCH /api/v1/venue-settings/venue/reservations/:id
   * Update reservation status
   */
  fastify.patch(
    '/venue/reservations/:id',
    {
      preHandler: [fastify.validate({ params: ReservationIdParam, body: ReservationStatusBody })],
    },
    async (request: any, reply) => {
      const { id } = request.params as any;
      const { status, notes } = request.body as any;
      if (!status)
        return reply.status(400).send(
          buildErrorResponse({
            code: 'BAD_REQUEST',
            message: 'status required',
            requestId: request.id,
          }),
        );

      const reservationDoc = await fastify.db.collection('table_reservations').doc(id).get();
      if (!reservationDoc.exists)
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Reservation not found',
            requestId: request.id,
          }),
        );
      const reservation = reservationDoc.data() as any;
      if (!(await requirePartnerScope(request, reply, reservation.venueId, 'venue'))) return;

      await fastify.db
        .collection('table_reservations')
        .doc(id)
        .update({ status, notes: notes || null, updatedAt: new Date().toISOString() });
      await fastify.writeAuditLog({
        action: 'venue.reservation.update',
        actorUid: request.user?.uid,
        actorRole: request.authContext?.activeMembership?.role || request.user?.role || null,
        partnerId: reservation.venueId,
        partnerType: 'venue',
        entityId: id,
        entityType: 'table_reservation',
        requestId: request.id,
        payload: { status, hasNotes: Boolean(notes) },
      });
      return { success: true };
    },
  );

  // ── Host Settings ─────────────────────────────────────────────────────────

  /**
   * GET /api/v1/venue-settings/host?hostId=XXX
   */
  fastify.get(
    '/host',
    {
      preHandler: [fastify.validate({ querystring: HostQuery })],
    },
    async (request: any, reply) => {
      const { hostId } = request.query as any;
      if (!hostId)
        return reply.status(400).send(
          buildErrorResponse({
            code: 'BAD_REQUEST',
            message: 'hostId required',
            requestId: request.id,
          }),
        );
      if (!(await requirePartnerScope(request, reply, hostId, 'host'))) return;
      const doc = await fastify.db.collection('hosts').doc(hostId).get();
      if (!doc.exists)
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Host not found',
            requestId: request.id,
          }),
        );
      return { host: { id: doc.id, ...doc.data() } };
    },
  );

  /**
   * PATCH /api/v1/venue-settings/host
   * Update host settings
   */
  fastify.patch(
    '/host',
    {
      preHandler: [fastify.validate({ body: HostSettingsBody })],
    },
    async (request: any, reply) => {
      const { hostId, settings } = request.body as any;
      if (!hostId)
        return reply.status(400).send(
          buildErrorResponse({
            code: 'BAD_REQUEST',
            message: 'hostId required',
            requestId: request.id,
          }),
        );
      if (!(await requirePartnerScope(request, reply, hostId, 'host'))) return;

      const allowedSettings = [
        'phone',
        'email',
        'socialLinks',
        'bankAccount',
        'payoutMode',
        'bio',
        'profileImage',
        'displayName',
      ];
      const updates: Record<string, any> = {};
      for (const key of allowedSettings) {
        if (settings?.[key] !== undefined) updates[key] = settings[key];
      }
      updates.updatedAt = new Date().toISOString();

      await fastify.db.collection('hosts').doc(hostId).update(updates);
      await fastify.writeAuditLog({
        action: 'host.settings.update',
        actorUid: request.user?.uid,
        actorRole: request.authContext?.activeMembership?.role || request.user?.role || null,
        partnerId: hostId,
        partnerType: 'host',
        entityId: hostId,
        entityType: 'host',
        requestId: request.id,
        payload: { updatedFields: Object.keys(updates).filter((key) => key !== 'updatedAt') },
      });
      await fastify.sendInngestEvent(fastify.InngestEvents.PUBLIC_DISCOVERY_SYNC, {
        type: 'host',
        id: hostId,
      });
      await fastify.invalidatePublicDiscovery('all');
      return { success: true };
    },
  );

  // ── Host Overview ─────────────────────────────────────────────────────────

  /**
   * GET /api/v1/venue-settings/host/overview?hostId=XXX
   */
  fastify.get(
    '/host/overview',
    {
      preHandler: [fastify.validate({ querystring: HostQuery })],
    },
    async (request: any, reply) => {
      const { hostId } = request.query as any;
      if (!hostId)
        return reply.status(400).send(
          buildErrorResponse({
            code: 'BAD_REQUEST',
            message: 'hostId required',
            requestId: request.id,
          }),
        );
      if (!(await requirePartnerScope(request, reply, hostId, 'host'))) return;

      const [eventsSnap, partnershipsSnap] = await Promise.all([
        fastify.db.collection('events').where('hostId', '==', hostId).get(),
        fastify.db.collection('partnerships').where('hostId', '==', hostId).get(),
      ]);

      const allEvents = eventsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      allEvents.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      const events = allEvents.slice(0, 10);
      const liveEvents = events.filter((e: any) => e.status === 'live' || e.status === 'approved');
      const draftEvents = events.filter((e: any) => e.status === 'draft');

      // Aggregate revenue from orders for these events
      const eventIds = events.map((e: any) => e.id);
      let totalRevenue = 0;
      if (eventIds.length > 0) {
        const ordersSnap = await fastify.db
          .collection('orders')
          .where('hostId', '==', hostId)
          .where('status', 'in', ['confirmed', 'paid'])
          .get();
        totalRevenue = ordersSnap.docs.reduce(
          (s: number, d: any) => s + (d.data().hostPayout || d.data().total || 0),
          0,
        );
      }

      return {
        hostId,
        stats: {
          totalEvents: allEvents.length,
          liveEvents: liveEvents.length,
          draftEvents: draftEvents.length,
          totalRevenue,
          partnerships: partnershipsSnap.docs.length,
        },
        recentEvents: events.slice(0, 5),
      };
    },
  );
}
