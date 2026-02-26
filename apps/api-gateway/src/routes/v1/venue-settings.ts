import { FastifyInstance } from 'fastify';

/**
 * Venue & Host Settings Gateway Routes
 */
export default async function venueSettingsRoutes(fastify: FastifyInstance) {

    // ── Venue Settings ────────────────────────────────────────────────────────

    /**
     * GET /api/v1/venue-settings?venueId=XXX
     */
    fastify.get('/venue', async (request: any, reply) => {
        const { venueId } = request.query as any;
        if (!venueId) return reply.status(400).send({ error: 'venueId required' });
        const doc = await fastify.db.collection('venues').doc(venueId).get();
        if (!doc.exists) return reply.status(404).send({ error: 'Venue not found' });
        return { venue: { id: doc.id, ...doc.data() } };
    });

    /**
     * PATCH /api/v1/venue-settings/venue
     * Update venue settings
     */
    fastify.patch('/venue', async (request: any, reply) => {
        const { venueId, updates } = request.body as any;
        if (!venueId || !updates) return reply.status(400).send({ error: 'venueId and updates required' });

        const allowedFields = ['name', 'description', 'address', 'city', 'state', 'capacity', 'amenities', 'photos', 'coverImage', 'contactEmail', 'contactPhone', 'socialLinks', 'operatingHours', 'dressCode', 'ageRestriction'];
        const sanitized: Record<string, any> = {};
        for (const key of allowedFields) {
            if (updates[key] !== undefined) sanitized[key] = updates[key];
        }
        sanitized.updatedAt = new Date().toISOString();

        await fastify.db.collection('venues').doc(venueId).update(sanitized);
        return { success: true };
    });

    // ── Venue Reservations ────────────────────────────────────────────────────

    /**
     * GET /api/v1/venue-settings/venue/reservations?venueId=XXX
     */
    fastify.get('/venue/reservations', async (request: any, reply) => {
        const { venueId, status, limit = 50 } = request.query as any;
        if (!venueId) return reply.status(400).send({ error: 'venueId required' });

        let q: any = fastify.db.collection('table_reservations').where('venueId', '==', venueId);
        if (status && status !== 'all') q = q.where('status', '==', status);
        q = q.orderBy('requestedAt', 'desc').limit(Number(limit));

        const snap = await q.get();
        const reservations = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        return { reservations };
    });

    /**
     * PATCH /api/v1/venue-settings/venue/reservations/:id
     * Update reservation status
     */
    fastify.patch('/venue/reservations/:id', async (request: any, reply) => {
        const { id } = request.params as any;
        const { status, notes } = request.body as any;
        if (!status) return reply.status(400).send({ error: 'status required' });

        await fastify.db.collection('table_reservations').doc(id).update({ status, notes: notes || null, updatedAt: new Date().toISOString() });
        return { success: true };
    });

    // ── Host Settings ─────────────────────────────────────────────────────────

    /**
     * GET /api/v1/venue-settings/host?hostId=XXX
     */
    fastify.get('/host', async (request: any, reply) => {
        const { hostId } = request.query as any;
        if (!hostId) return reply.status(400).send({ error: 'hostId required' });
        const doc = await fastify.db.collection('hosts').doc(hostId).get();
        if (!doc.exists) return reply.status(404).send({ error: 'Host not found' });
        return { host: { id: doc.id, ...doc.data() } };
    });

    /**
     * PATCH /api/v1/venue-settings/host
     * Update host settings
     */
    fastify.patch('/host', async (request: any, reply) => {
        const { hostId, settings } = request.body as any;
        if (!hostId) return reply.status(400).send({ error: 'hostId required' });

        const allowedSettings = ['phone', 'email', 'socialLinks', 'bankAccount', 'payoutMode', 'bio', 'profileImage', 'displayName'];
        const updates: Record<string, any> = {};
        for (const key of allowedSettings) {
            if (settings?.[key] !== undefined) updates[key] = settings[key];
        }
        updates.updatedAt = new Date().toISOString();

        await fastify.db.collection('hosts').doc(hostId).update(updates);
        return { success: true };
    });

    // ── Host Overview ─────────────────────────────────────────────────────────

    /**
     * GET /api/v1/venue-settings/host/overview?hostId=XXX
     */
    fastify.get('/host/overview', async (request: any, reply) => {
        const { hostId } = request.query as any;
        if (!hostId) return reply.status(400).send({ error: 'hostId required' });

        const [eventsSnap, partnershipsSnap] = await Promise.all([
            fastify.db.collection('events').where('hostId', '==', hostId).orderBy('createdAt', 'desc').limit(10).get(),
            fastify.db.collection('partnerships').where('hostId', '==', hostId).get()
        ]);

        const events = eventsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        const liveEvents = events.filter((e: any) => e.status === 'live' || e.status === 'approved');
        const draftEvents = events.filter((e: any) => e.status === 'draft');

        // Aggregate revenue from orders for these events
        const eventIds = events.map((e: any) => e.id).slice(0, 10);
        let totalRevenue = 0;
        if (eventIds.length > 0) {
            const ordersSnap = await fastify.db.collection('orders')
                .where('hostId', '==', hostId)
                .where('status', 'in', ['confirmed', 'paid'])
                .get();
            totalRevenue = ordersSnap.docs.reduce((s: number, d: any) => s + (d.data().hostPayout || d.data().total || 0), 0);
        }

        return {
            hostId,
            stats: { totalEvents: events.length, liveEvents: liveEvents.length, draftEvents: draftEvents.length, totalRevenue, partnerships: partnershipsSnap.docs.length },
            recentEvents: events.slice(0, 5)
        };
    });
}
