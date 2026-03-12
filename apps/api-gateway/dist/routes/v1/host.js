import { z } from 'zod';
const HostOverviewQuery = z.object({
    hostId: z.string()
}).strict();
const HostEventsQuery = z.object({
    hostId: z.string(),
    limit: z.string().optional(),
    lastId: z.string().optional()
}).strict();
export default async function hostRoutes(fastify) {
    /**
     * GET /host/overview
     * Aggregated statistics for the host dashboard
     */
    fastify.get('/host/overview', {
        preHandler: [
            fastify.validate({ querystring: HostOverviewQuery }),
            fastify.requireRoles(['admin', 'partner', 'host'])
        ]
    }, async (request, reply) => {
        const { hostId } = request.query;
        if (!hostId)
            return reply.status(400).send({ error: "hostId is required" });
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
            const stats = statsSnap.exists ? statsSnap.data() : {
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
            const events = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
        }
        catch (error) {
            fastify.log.error(`Host overview failed: ${error.message}`);
            return reply.status(error.message.includes('Forbidden') ? 403 : 500).send({ error: error.message });
        }
    });
    /**
     * GET /host/events
     * List events owned by the host
     */
    fastify.get('/host/events', {
        preHandler: [
            fastify.validate({ querystring: HostEventsQuery }),
            fastify.requireRoles(['admin', 'partner', 'host'])
        ]
    }, async (request, reply) => {
        const { hostId, limit = 20, lastId } = request.query;
        if (!hostId)
            return reply.status(400).send({ error: "hostId is required" });
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
                const raw = doc.data();
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
        }
        catch (error) {
            fastify.log.error(`Host events list failed: ${error.message}`);
            return reply.status(error.message.includes('Forbidden') ? 403 : 500).send({ error: error.message });
        }
    });
}
//# sourceMappingURL=host.js.map