import { randomUUID } from 'node:crypto';
export default async function promoterConnectionsRoutes(fastify) {
    const COL = 'promoter_connections';
    /**
     * POST /api/v1/promoter-connections/request
     */
    fastify.post('/request', async (request, reply) => {
        const { promoterId, promoterName, promoterEmail, targetId, targetType, targetName, message = '' } = request.body;
        const existing = await fastify.db.collection(COL)
            .where('promoterId', '==', promoterId)
            .where('targetId', '==', targetId)
            .where('status', '==', 'pending')
            .limit(1).get();
        if (!existing.empty)
            return reply.status(409).send({ error: 'Request already pending' });
        const now = new Date().toISOString();
        const id = randomUUID();
        const conn = { id, promoterId, promoterName, promoterEmail, targetId, targetType, targetName, message, status: 'pending', createdAt: now, updatedAt: now };
        await fastify.db.collection(COL).doc(id).set(conn);
        return conn;
    });
    /**
     * GET /api/v1/promoter-connections/promoter/:promoterId
     */
    fastify.get('/promoter/:promoterId', async (request, reply) => {
        const { promoterId } = request.params;
        const { status } = request.query;
        let q = fastify.db.collection(COL).where('promoterId', '==', promoterId);
        if (status)
            q = q.where('status', '==', status);
        const snap = await q.get();
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    });
    /**
     * GET /api/v1/promoter-connections/incoming
     */
    fastify.get('/incoming', async (request, reply) => {
        const { targetId, role, status } = request.query;
        let q = fastify.db.collection(COL).where('targetId', '==', targetId);
        if (role)
            q = q.where('targetType', '==', role);
        if (status)
            q = q.where('status', '==', status);
        const snap = await q.get();
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    });
    /**
     * GET /api/v1/promoter-connections/discover
     * Search for approved partners (hosts, venues, promoters) for discovery
     */
    fastify.get('/discover', async (request, reply) => {
        const { type = 'host', city, search, limit = 20 } = request.query;
        const collectionMap = { host: 'hosts', venue: 'venues', promoter: 'promoters' };
        const col = collectionMap[type] || type;
        let snapshot = await fastify.db.collection(col).where('status', '==', 'active').limit(Number(limit) * 5).get();
        if (snapshot.empty) {
            snapshot = await fastify.db.collection(col).limit(Number(limit) * 5).get();
        }
        let results = snapshot.docs.map((d) => {
            const r = d.data();
            return {
                id: d.id, type,
                name: r.displayName || r.name || 'Unknown',
                avatar: r.profileImage || r.avatar || null,
                coverImage: r.coverImage || r.bannerImage || null,
                city: r.city || r.location?.split?.(',')[0]?.trim?.() || 'Pune',
                bio: r.bio || r.summary || r.description || '',
                tags: r.tags || r.genres || [],
                eventsCount: r.eventsCount || 0,
                followersCount: parseInt(r.followers) || r.followersCount || 0,
                isVerified: !!(r.isVerified || r.isApproved || r.status === 'active')
            };
        });
        if (city && city.toLowerCase() !== 'all') {
            results = results.filter((r) => r.city.toLowerCase().includes(city.toLowerCase()));
        }
        if (search) {
            const s = search.toLowerCase();
            results = results.filter((r) => r.name.toLowerCase().includes(s) || r.bio.toLowerCase().includes(s));
        }
        return results.slice(0, Number(limit));
    });
    /**
     * PATCH /api/v1/promoter-connections/:id
     */
    fastify.patch('/:id', async (request, reply) => {
        const { id } = request.params;
        const { action, reason } = request.body;
        const statusMap = { approve: 'active', reject: 'rejected', block: 'blocked' };
        const newStatus = statusMap[action];
        if (!newStatus)
            return reply.status(400).send({ error: 'Invalid action' });
        await fastify.db.collection(COL).doc(id).update({ status: newStatus, ...(reason ? { reason } : {}), updatedAt: new Date().toISOString() });
        return { success: true };
    });
    /**
     * POST /api/v1/promoter-connections/invites
     * Create a promoter invite link (called by partner-dashboard host/invite route)
     */
    fastify.post('/invites', async (request, reply) => {
        const { id, hostId, email, name, type, status, expiresAt } = request.body;
        if (!id || !hostId || !email) {
            return reply.status(400).send({ error: 'id, hostId, and email are required' });
        }
        const now = new Date().toISOString();
        const invite = {
            id,
            hostId,
            email,
            name: name || '',
            type: type || 'promoter',
            status: status || 'pending',
            createdAt: now,
            updatedAt: now,
            expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };
        await fastify.db.collection('onboarding_invites').doc(id).set(invite);
        return { success: true, invite };
    });
    /**
     * POST /api/v1/promoter-connections/links/click
     * Increment click count for a promoter link
     */
    fastify.post('/links/click', async (request, reply) => {
        const { linkId, promoterId } = request.body;
        if (!linkId)
            return reply.status(400).send({ error: 'linkId is required' });
        const linkRef = fastify.db.collection('promoter_links').doc(linkId);
        const { FieldValue } = await import('firebase-admin/firestore');
        await linkRef.update({
            clicks: FieldValue.increment(1),
            lastClickAt: new Date().toISOString()
        });
        return { success: true };
    });
}
//# sourceMappingURL=promoter-connections.js.map