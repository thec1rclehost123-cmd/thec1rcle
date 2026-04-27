import { FastifyInstance } from 'fastify';
import { manageConnection, generatePromoterLink, getPromoterStats, listConnections } from '@c1rcle/core/promoter-engine';
import { z } from 'zod';

const ConnectionsQuery = z.object({
    entityId: z.string(),
    entityType: z.string(),
    status: z.string().optional()
}).strict();

const ConnectBody = z.object({
    action: z.string()
}).catchall(z.any());

const PromoterIdParam = z.object({ id: z.string() }).strict();

const LinksBody = z.object({
    promoterId: z.string(),
    eventId: z.string()
}).strict();

export default async function promoterRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/promoters/connections
     * Lists connections for a promoter or venue
     */
    fastify.get('/connections', {
        preHandler: [fastify.validate({ querystring: ConnectionsQuery })]
    }, async (request, reply) => {
        const { entityId, entityType, status } = request.query as { entityId: string, entityType: string, status?: string };

        try {
            const connections = await listConnections(entityId, entityType, status);
            return connections;
        } catch (error: any) {
            reply.status(500).send({ error: "Internal server error" });
        }
    });

    /**
     * POST /api/v1/promoters/connect
     * Requests or manages a partnership connection
     */
    fastify.post('/connect', {
        preHandler: [fastify.validate({ body: ConnectBody })]
    }, async (request, reply) => {
        const { action, ...data } = request.body as any;

        try {
            const result = await manageConnection(action, {
                ...data,
                actor: (request as any).user
            });
            return result;
        } catch (error: any) {
            reply.status(400).send({ error: "Request failed" });
        }
    });

    /**
     * GET /api/v1/promoters/stats/:id
     * Gets conversion stats for a promoter
     */
    fastify.get('/stats/:id', {
        preHandler: [fastify.validate({ params: PromoterIdParam })]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        try {
            const stats = await getPromoterStats(id);
            return stats;
        } catch (error: any) {
            reply.status(500).send({ error: "Internal server error" });
        }
    });

    /**
     * GET /api/v1/partner/promoter/overview
     * Dashboard overview for promoters
     */
    fastify.get('/partner/promoter/overview', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { promoterId } = request.query as any;
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        
        await fastify.verifyPartnerAccess(request, promoterId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        
        try {
            // Fetch stats, active links, and upcoming events
            const [stats, linksSnap] = await Promise.all([
                getPromoterStats(promoterId).catch(() => ({ totalEarnings: 0, totalClicks: 0, totalConversions: 0 })),
                fastify.db.collection('promoter_links').where('promoterId', '==', promoterId).where('isActive', '==', true).get()
            ]);

            const links = linksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
            
            return {
                stats: {
                    earnings: stats.totalEarnings || 0,
                    clicks: stats.totalClicks || 0,
                    conversions: stats.totalConversions || 0,
                    payoutsPending: 0
                },
                activeLinks: links.length,
                upcomingEvents: 0, // Placeholder
                recentActivity: []
            };
        } catch (error: any) {
            fastify.log.error(`Promoter overview error: ${error.message}`);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });

    /**
     * GET /api/v1/promoter/stats
     * Used by dashboard links page
     */
    fastify.get('/stats', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { promoterId } = request.query as any;
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        
        try {
            const stats = await getPromoterStats(promoterId);
            return stats;
        } catch (error: any) {
            return { totalEarnings: 0, totalClicks: 0, totalConversions: 0 };
        }
    });

    fastify.post('/links', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { promoterId, eventId } = request.body as { promoterId: string, eventId: string };
        await fastify.verifyPartnerAccess(request, promoterId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });

        try {
            const link = await generatePromoterLink(promoterId, eventId);
            return link;
        } catch (error: any) {
            reply.status(500).send({ error: "Internal server error" });
        }
    });
}
