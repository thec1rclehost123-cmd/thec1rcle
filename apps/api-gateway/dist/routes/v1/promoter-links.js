import { randomUUID } from 'node:crypto';
export default async function promoterLinksRoutes(fastify) {
    const LINKS_COL = 'promoter_links';
    const COMMISSIONS_COL = 'promoter_commissions';
    /**
     * POST /api/v1/promoter-links/create
     */
    fastify.post('/create', async (request, reply) => {
        const body = request.body;
        const { promoterId, promoterName, eventId, eventTitle, commissionRate, commissionType = 'percentage', ticketTierIds = [], expiresAt = null } = body;
        const existing = await fastify.db.collection(LINKS_COL)
            .where('promoterId', '==', promoterId)
            .where('eventId', '==', eventId)
            .where('isActive', '==', true)
            .limit(1).get();
        if (!existing.empty) {
            return reply.status(409).send({ error: 'Active link already exists for this event' });
        }
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const now = new Date().toISOString();
        const id = randomUUID();
        const link = { id, code, promoterId, promoterName, eventId, eventTitle, ticketTierIds, commissionRate, commissionType, clicks: 0, conversions: 0, revenue: 0, commission: 0, isActive: true, expiresAt, createdAt: now, updatedAt: now };
        await fastify.db.collection(LINKS_COL).doc(id).set(link);
        return link;
    });
    /**
     * GET /api/v1/promoter-links
     */
    fastify.get('/', async (request, reply) => {
        const { promoterId, eventId, isActive, limit = 50 } = request.query;
        let q = fastify.db.collection(LINKS_COL);
        if (promoterId)
            q = q.where('promoterId', '==', promoterId);
        if (eventId)
            q = q.where('eventId', '==', eventId);
        if (isActive !== undefined)
            q = q.where('isActive', '==', isActive === 'true');
        const snap = await q.orderBy('createdAt', 'desc').limit(Number(limit)).get();
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    });
    /**
     * GET /api/v1/promoter-links/by-code/:code
     */
    fastify.get('/by-code/:code', async (request, reply) => {
        const { code } = request.params;
        const snap = await fastify.db.collection(LINKS_COL).where('code', '==', code).where('isActive', '==', true).limit(1).get();
        if (snap.empty)
            return reply.status(404).send({ error: 'Link not found' });
        return { id: snap.docs[0].id, ...snap.docs[0].data() };
    });
    /**
     * GET /api/v1/promoter-links/stats/:promoterId
     */
    fastify.get('/stats/:promoterId', async (request, reply) => {
        const { promoterId } = request.params;
        const linksSnap = await fastify.db.collection(LINKS_COL).where('promoterId', '==', promoterId).get();
        const links = linksSnap.docs.map((d) => d.data());
        const pendingSnap = await fastify.db.collection(COMMISSIONS_COL).where('promoterId', '==', promoterId).where('status', '==', 'pending').get();
        const paidSnap = await fastify.db.collection(COMMISSIONS_COL).where('promoterId', '==', promoterId).where('status', '==', 'paid').get();
        const totalClicks = links.reduce((s, l) => s + (l.clicks || 0), 0);
        const totalConversions = links.reduce((s, l) => s + (l.conversions || 0), 0);
        return {
            totalLinks: links.length,
            totalClicks,
            totalConversions,
            totalRevenue: links.reduce((s, l) => s + (l.revenue || 0), 0),
            totalCommission: links.reduce((s, l) => s + (l.commission || 0), 0),
            pendingCommission: pendingSnap.docs.reduce((s, d) => s + (d.data().commissionAmount || 0), 0),
            paidCommission: paidSnap.docs.reduce((s, d) => s + (d.data().commissionAmount || 0), 0),
            conversionRate: totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) : 0
        };
    });
    /**
     * GET /api/v1/promoter-links/event-summary/:eventId
     */
    fastify.get('/event-summary/:eventId', async (request, reply) => {
        const { eventId } = request.params;
        const snap = await fastify.db.collection(LINKS_COL).where('eventId', '==', eventId).get();
        const links = snap.docs.map((d) => d.data());
        return {
            totalPromoters: new Set(links.map((l) => l.promoterId)).size,
            totalClicks: links.reduce((s, l) => s + (l.clicks || 0), 0),
            totalConversions: links.reduce((s, l) => s + (l.conversions || 0), 0),
            totalRevenue: links.reduce((s, l) => s + (l.revenue || 0), 0),
            totalCommission: links.reduce((s, l) => s + (l.commission || 0), 0),
            topPromoters: links.sort((a, b) => (b.conversions || 0) - (a.conversions || 0)).slice(0, 5)
        };
    });
    /**
     * PATCH /api/v1/promoter-links/:id/deactivate
     */
    fastify.patch('/:id/deactivate', async (request, reply) => {
        const { id } = request.params;
        const now = new Date().toISOString();
        await fastify.db.collection(LINKS_COL).doc(id).update({ isActive: false, deactivatedAt: now, updatedAt: now });
        return { success: true };
    });
}
//# sourceMappingURL=promoter-links.js.map