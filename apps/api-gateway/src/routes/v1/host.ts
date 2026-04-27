import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const HostOverviewQuery = z.object({
    hostId: z.string()
}).strict();

const HostEventsQuery = z.object({
    hostId: z.string(),
    limit: z.string().optional(),
    lastId: z.string().optional()
}).strict();

const HostIdQuery = z.object({ hostId: z.string() });
const HostProfilePatch = z.object({ hostId: z.string(), patch: z.record(z.any()) });
const PartnershipActionBody = z.object({ action: z.enum(['approve', 'reject']) });
const NotificationsReadBody = z.object({ hostId: z.string(), notificationId: z.string().optional(), markAllRead: z.boolean().optional() });
const TeamInviteBody = z.object({ hostId: z.string(), email: z.string().email(), role: z.string(), name: z.string().optional() });
const TeamMemberPatch = z.object({ role: z.string().optional(), isActive: z.boolean().optional() });
const HostOrdersQuery = z.object({ hostId: z.string(), limit: z.string().optional(), cursor: z.string().optional(), status: z.string().optional() });
const HostFinanceQuery = z.object({ hostId: z.string(), limit: z.string().optional(), cursor: z.string().optional() });
const ALLOWED_PROFILE_FIELDS = ['displayName','bio','tagline','profileImage','coverImage','socialLinks','contactEmail','contactPhone','genre','city','instagramHandle','youtubeHandle','spotifyHandle'];


export default async function hostRoutes(fastify: FastifyInstance) {
    /**
     * GET /host/overview
     * Aggregated statistics for the host dashboard
     */
    fastify.get('/host/overview', {
        preHandler: [
            fastify.validate({ querystring: HostOverviewQuery }),
            fastify.requireRoles(['admin', 'partner', 'host'])
        ]
    }, async (request: { query: any }, reply: any) => {
        const { hostId } = request.query;
        if (!hostId) return reply.status(400).send({ error: "hostId is required" });

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

            // 1. Fetch Precomputed Stats
            const statsSnap = await fastify.db.collection("host_stats").doc(hostId).get();
            const stats = statsSnap.exists ? statsSnap.data() as any : {
                totalTicketsSold: 0,
                totalRevenue: 0,
                activeEventsCount: 0,
                upcomingEventsCount: 0
            };

            // 2. Fetch Recent Events (for the list)
            const eventsSnapshot = await fastify.db.collection("events")
                .where("creatorId", "==", hostId)
                .orderBy("startDate", "desc")
                .limit(5)
                .get();

            const events = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

            const responseData = {
                stats: {
                    revenue: stats.totalRevenue || 0,
                    ticketsSold: stats.totalTicketsSold || 0,
                    activePromoters: (await fastify.db.collection("partnerships") // Still keep this as is or precompute?
                        .where("hostId", "==", hostId)
                        .where("status", "==", "active")
                        .count().get()).data().count,
                    pendingItems: stats.activeEventsCount || 0 // Or keep original pendingItems logic if needed
                },
                upcomingEvents: events.map(e => ({
                    id: e.id,
                    name: e.title,
                    date: e.date,
                    startDate: e.startDate,
                    venue_name: e.venue || "TBD",
                    status: e.status,
                    lifecycle: e.lifecycle,
                    poster_url: e.image || e.poster
                }))
            };

            // 3. Save to Cache (5 min TTL)
            await fastify.cache.set('host', cacheKey, responseData, 300);

            return reply
                .header('Cache-Control', 'private, max-age=300')
                .send({ success: true, ...responseData });

        } catch (error: any) {
            fastify.log.error(`Host overview failed: ${error.message}`);
            return reply.status(error.message.includes('Forbidden') || error.message.includes('Unauthorized') ? 403 : 500).send({ error: error.message.includes('Forbidden') || error.message.includes('Unauthorized') ? "Access denied" : "Internal server error" });
        }
    });

    /**
     * GET /host/events
     * List events owned by the host
     */
    // ── Host Profile ────────────────────────────────────────────────────────

    fastify.get('/host/profile', {
        preHandler: [fastify.validate({ querystring: HostIdQuery })]
    }, async (request: any, reply) => {
        const { hostId } = request.query;
        await fastify.verifyPartnerAccess(request, hostId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        const doc = await fastify.db.collection('hosts').doc(hostId).get();
        if (!doc.exists) return reply.status(404).send({ error: 'Host not found' });
        return { host: { id: doc.id, ...doc.data() } };
    });

    fastify.patch('/host/profile', {
        preHandler: [fastify.validate({ body: HostProfilePatch })]
    }, async (request: any, reply) => {
        const { hostId, patch } = request.body;
        await fastify.verifyPartnerAccess(request, hostId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        const safe: Record<string, any> = {};
        for (const k of ALLOWED_PROFILE_FIELDS) { if (patch[k] !== undefined) safe[k] = patch[k]; }
        safe.updatedAt = new Date().toISOString();
        await fastify.db.collection('hosts').doc(hostId).update(safe);
        await fastify.publicDiscoveryService.syncHostReadModels(hostId).catch(() => {});
        await fastify.invalidatePublicDiscovery('all').catch(() => {});
        const doc = await fastify.db.collection('hosts').doc(hostId).get();
        return { host: { id: doc.id, ...doc.data() } };
    });

    // ── Host Partnerships ────────────────────────────────────────────────────

    fastify.get('/host/partnerships', {
        preHandler: [fastify.validate({ querystring: HostIdQuery })]
    }, async (request: any, reply) => {
        const { hostId } = request.query;
        await fastify.verifyPartnerAccess(request, hostId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        const snap = await fastify.db.collection('partnerships').where('hostId', '==', hostId).orderBy('createdAt', 'desc').get();
        return { partnerships: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) };
    });

    fastify.patch('/host/partnerships/:partnershipId', async (request: any, reply) => {
        const { partnershipId } = request.params;
        const { action } = request.body as any;
        if (!['approve', 'reject'].includes(action)) return reply.status(400).send({ error: 'action must be approve or reject' });
        const ref = fastify.db.collection('partnerships').doc(partnershipId);
        const doc = await ref.get();
        if (!doc.exists) return reply.status(404).send({ error: 'Partnership not found' });
        const p = doc.data() as any;
        await fastify.verifyPartnerAccess(request, p.hostId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        await ref.update({ status: action === 'approve' ? 'active' : 'rejected', updatedAt: new Date().toISOString() });
        return { success: true, status: action === 'approve' ? 'active' : 'rejected' };
    });

    // ── Host Notifications ───────────────────────────────────────────────────

    fastify.get('/host/notifications', {
        preHandler: [fastify.validate({ querystring: HostIdQuery })]
    }, async (request: any, reply) => {
        const { hostId } = request.query;
        await fastify.verifyPartnerAccess(request, hostId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        const snap = await fastify.db.collection('notifications')
            .where('recipientId', '==', hostId)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        return { notifications: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) };
    });

    fastify.patch('/host/notifications/read', {
        preHandler: [fastify.validate({ body: NotificationsReadBody })]
    }, async (request: any, reply) => {
        const { hostId, notificationId, markAllRead } = request.body as any;
        await fastify.verifyPartnerAccess(request, hostId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        if (markAllRead) {
            const snap = await fastify.db.collection('notifications').where('recipientId', '==', hostId).where('read', '==', false).get();
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
    });

    // ── Host Orders ──────────────────────────────────────────────────────────

    fastify.get('/host/orders', {
        preHandler: [fastify.validate({ querystring: HostOrdersQuery })]
    }, async (request: any, reply) => {
        const { hostId, limit = '20', cursor, status } = request.query as any;
        await fastify.verifyPartnerAccess(request, hostId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        const pageSize = Math.min(parseInt(limit), 100);
        let q: any = fastify.db.collection('orders').where('hostId', '==', hostId).orderBy('createdAt', 'desc');
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
    });

    // ── Host Finance ─────────────────────────────────────────────────────────

    fastify.get('/host/finance/disputes', {
        preHandler: [fastify.validate({ querystring: HostIdQuery })]
    }, async (request: any, reply) => {
        const { hostId } = request.query as any;
        await fastify.verifyPartnerAccess(request, hostId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        const snap = await fastify.db.collection('disputes').where('hostId', '==', hostId).orderBy('createdAt', 'desc').limit(50).get();
        return { disputes: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) };
    });

    fastify.get('/host/finance/payouts', {
        preHandler: [fastify.validate({ querystring: HostFinanceQuery })]
    }, async (request: any, reply) => {
        const { hostId, limit = '20', cursor } = request.query as any;
        await fastify.verifyPartnerAccess(request, hostId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        const pageSize = Math.min(parseInt(limit), 50);
        let q: any = fastify.db.collection('partner_settlements').where('partnerId', '==', hostId).orderBy('createdAt', 'desc').limit(pageSize + 1);
        if (cursor) { const c = await fastify.db.collection('partner_settlements').doc(cursor).get(); if (c.exists) q = q.startAfter(c); }
        const snap = await q.get();
        const hasMore = snap.docs.length > pageSize;
        const payouts = snap.docs.slice(0, pageSize).map((d: any) => ({ id: d.id, ...d.data() }));
        return { payouts, hasMore, nextCursor: hasMore ? payouts[payouts.length - 1].id : null };
    });

    // ── Host Overview Summary ────────────────────────────────────────────────

    fastify.get('/host/overview/summary', {
        preHandler: [fastify.validate({ querystring: HostIdQuery })]
    }, async (request: any, reply) => {
        const { hostId } = request.query as any;
        await fastify.verifyPartnerAccess(request, hostId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        const [partnerSnap, promoterSnap, eventsSnap] = await Promise.all([
            fastify.db.collection('partnerships').where('hostId', '==', hostId).get(),
            fastify.db.collection('promoter_connections').where('hostId', '==', hostId).where('status', '==', 'active').get(),
            fastify.db.collection('events').where('creatorId', '==', hostId).where('lifecycle', 'in', ['submitted', 'scheduled', 'live', 'approved']).orderBy('startDate', 'asc').limit(5).get(),
        ]);
        const pendingPartnerships = partnerSnap.docs.filter((d: any) => d.data().status === 'pending').length;
        return {
            pendingPartnerships,
            activePromoters: promoterSnap.size,
            upcomingEvents: eventsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
        };
    });

    // ── Host Team ────────────────────────────────────────────────────────────

    fastify.get('/host/team', {
        preHandler: [fastify.validate({ querystring: HostIdQuery })]
    }, async (request: any, reply) => {
        const { hostId } = request.query as any;
        await fastify.verifyPartnerAccess(request, hostId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        const snap = await fastify.db.collection('partner_memberships')
            .where('partnerId', '==', hostId)
            .where('partnerType', '==', 'host')
            .get();
        return { members: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) };
    });

    fastify.patch('/host/team/:memberId', {
        preHandler: [fastify.validate({ body: TeamMemberPatch })]
    }, async (request: any, reply) => {
        const { memberId } = request.params as any;
        const patch = request.body as any;
        const doc = await fastify.db.collection('partner_memberships').doc(memberId).get();
        if (!doc.exists) return reply.status(404).send({ error: 'Member not found' });
        const m = doc.data() as any;
        await fastify.verifyPartnerAccess(request, m.partnerId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        const safe: Record<string, any> = {};
        if (patch.role !== undefined) safe.role = patch.role;
        if (patch.isActive !== undefined) safe.isActive = patch.isActive;
        safe.updatedAt = new Date().toISOString();
        await fastify.db.collection('partner_memberships').doc(memberId).update(safe);
        return { success: true };
    });

    fastify.delete('/host/team/:memberId', async (request: any, reply) => {
        const { memberId } = request.params as any;
        const doc = await fastify.db.collection('partner_memberships').doc(memberId).get();
        if (!doc.exists) return reply.status(404).send({ error: 'Member not found' });
        const m = doc.data() as any;
        await fastify.verifyPartnerAccess(request, m.partnerId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        await fastify.db.collection('partner_memberships').doc(memberId).update({ isActive: false, removedAt: new Date().toISOString() });
        return { success: true };
    });

    // ── Host Promoters ────────────────────────────────────────────────────────

    fastify.get('/host/promoters', {
        preHandler: [fastify.validate({ querystring: HostIdQuery })]
    }, async (request: any, reply) => {
        const { hostId } = request.query as any;
        await fastify.verifyPartnerAccess(request, hostId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        const snap = await fastify.db.collection('promoter_connections').where('hostId', '==', hostId).orderBy('createdAt', 'desc').get();
        return { promoters: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) };
    });

    // ── Host Event Sub-routes ────────────────────────────────────────────────

    fastify.get('/host/events/:id/tickets', async (request: any, reply) => {
        const { id: eventId } = request.params as any;
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
        const eventDoc = await fastify.db.collection('events').doc(eventId).get();
        if (!eventDoc.exists) return reply.status(404).send({ error: 'Event not found' });
        const ev = eventDoc.data() as any;
        if (ev.hostId !== userId && ev.creatorId !== userId) {
            try { await fastify.verifyPartnerAccess(request, ev.hostId || ev.creatorId); } catch { return reply.status(403).send({ error: 'Forbidden' }); }
        }
        const tiers = (ev.ticketTiers || ev.tiers || ev.tickets || []).map((t: any) => ({
            id: t.id || t.tierId, name: t.name, price: t.price, quantity: t.quantity || t.maxQuantity || 0,
            sold: t.sold || 0, status: t.status || 'active',
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
        try { await fastify.verifyPartnerAccess(request, ev.hostId || ev.creatorId); } catch { return reply.status(403).send({ error: 'Forbidden' }); }
        await fastify.db.collection('events').doc(eventId).update({ ticketTiers: tiers, updatedAt: new Date().toISOString() });
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
        const hostId = ev.hostId || ev.creatorId;
        try { await fastify.verifyPartnerAccess(request, hostId); } catch { return reply.status(403).send({ error: 'Forbidden' }); }
        if (!['draft', 'changes_requested'].includes(ev.lifecycle || ev.status || '')) {
            return reply.status(409).send({ error: `Cannot submit event in ${ev.lifecycle || ev.status} state` });
        }
        const now = new Date().toISOString();
        await fastify.db.collection('events').doc(eventId).update({ lifecycle: 'submitted', status: 'submitted', updatedAt: now, submittedAt: now });
        await fastify.db.collection('submission_history').add({ eventId, fromState: ev.lifecycle || ev.status, toState: 'submitted', actorUid: userId, actorRole: 'host', timestamp: now });
        if (ev.venueId) {
            await fastify.db.collection('notifications').add({ recipientId: ev.venueId, recipientType: 'venue', type: 'event_submitted', eventId, hostId, title: 'New Event Submission', message: `${ev.title} has been submitted for your approval.`, read: false, createdAt: now });
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
        const hostId = ev.hostId || ev.creatorId;
        try { await fastify.verifyPartnerAccess(request, hostId); } catch { return reply.status(403).send({ error: 'Forbidden' }); }
        if (!['changes_requested', 'rejected'].includes(ev.lifecycle || ev.status || '')) {
            return reply.status(409).send({ error: `Cannot resubmit event in ${ev.lifecycle || ev.status} state` });
        }
        const body = request.body as any;
        const now = new Date().toISOString();
        const updates: Record<string, any> = { lifecycle: 'submitted', status: 'submitted', updatedAt: now, resubmittedAt: now };
        if (body?.patch) Object.assign(updates, body.patch);
        await fastify.db.collection('events').doc(eventId).update(updates);
        await fastify.db.collection('submission_history').add({ eventId, fromState: ev.lifecycle, toState: 'submitted', actorUid: userId, actorRole: 'host', note: body?.note, timestamp: now });
        if (ev.venueId) {
            await fastify.db.collection('notifications').add({ recipientId: ev.venueId, recipientType: 'venue', type: 'event_resubmitted', eventId, hostId, title: 'Event Resubmitted', message: `${ev.title} has been resubmitted for your approval.`, read: false, createdAt: now });
        }
        await fastify.cache.delete('events:detail', eventId).catch(() => {});
        await fastify.publicDiscoveryService.syncEventReadModels(eventId).catch(() => {});
        return { success: true };
    });

    fastify.get('/host/events', {
        preHandler: [
            fastify.validate({ querystring: HostEventsQuery }),
            fastify.requireRoles(['admin', 'partner', 'host'])
        ]
    }, async (request: { query: any }, reply: any) => {
        const { hostId, limit = 20, lastId } = request.query;
        if (!hostId) return reply.status(400).send({ error: "hostId is required" });

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

            let q = fastify.db.collection("events")
                .where("creatorId", "==", hostId)
                .orderBy("startDate", "desc");

            const paginationLimit = Math.min(Number(limit), 100);

            // Cursor-based pagination
            if (lastId) {
                const lastDoc = await fastify.db.collection("events").doc(lastId).get();
                if (lastDoc.exists) {
                    q = q.startAfter(lastDoc);
                }
            }

            // Fetch +1 to determine if there's more
            q = q.limit(paginationLimit + 1);

            const snapshot = await q.get();
            const docs = snapshot.docs;

            const hasMore = docs.length > paginationLimit;
            const data = docs.slice(0, paginationLimit).map(doc => {
                const raw = doc.data() as any;
                // Projection: Return only what's needed for the dashboard list
                return {
                    id: doc.id,
                    title: raw.title,
                    startDate: raw.startDate,
                    lifecycle: raw.lifecycle,
                    venue_name: raw.venue || "TBD",
                    image: raw.image || raw.poster
                };
            });

            const response = {
                success: true,
                events: data,
                nextCursor: hasMore ? data[data.length - 1].id : null,
                hasMore
            };

            // 4. Save to Cache (60s TTL)
            await fastify.cache.set('host', cacheKey, response, 60);

            return reply
                .header('Cache-Control', 'private, max-age=60')
                .send(response);

        } catch (error: any) {
            fastify.log.error(`Host events list failed: ${error.message}`);
            return reply.status(error.message.includes('Forbidden') || error.message.includes('Unauthorized') ? 403 : 500).send({ error: error.message.includes('Forbidden') || error.message.includes('Unauthorized') ? "Access denied" : "Internal server error" });
        }
    });
}
