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
export default async function promoterRoutes(fastify) {
    /**
     * GET /api/v1/promoters/connections
     * Lists connections for a promoter or venue
     */
    fastify.get('/connections', {
        preHandler: [fastify.validate({ querystring: ConnectionsQuery })]
    }, async (request, reply) => {
        const { entityId, entityType, status } = request.query;
        try {
            const connections = await listConnections(entityId, entityType, status);
            return connections;
        }
        catch (error) {
            reply.status(500).send({ error: error.message });
        }
    });
    /**
     * POST /api/v1/promoters/connect
     * Requests or manages a partnership connection
     */
    fastify.post('/connect', {
        preHandler: [fastify.validate({ body: ConnectBody })]
    }, async (request, reply) => {
        const { action, ...data } = request.body;
        try {
            const result = await manageConnection(action, {
                ...data,
                actor: request.user
            });
            return result;
        }
        catch (error) {
            reply.status(400).send({ error: error.message });
        }
    });
    /**
     * GET /api/v1/promoters/stats/:id
     * Gets conversion stats for a promoter
     */
    fastify.get('/stats/:id', {
        preHandler: [fastify.validate({ params: PromoterIdParam })]
    }, async (request, reply) => {
        const { id } = request.params;
        try {
            const stats = await getPromoterStats(id);
            return stats;
        }
        catch (error) {
            reply.status(500).send({ error: error.message });
        }
    });
    /**
     * POST /api/v1/promoters/links
     * Generates tracking links
     */
    fastify.post('/links', {
        preHandler: [fastify.validate({ body: LinksBody })]
    }, async (request, reply) => {
        const { promoterId, eventId } = request.body;
        try {
            const link = await generatePromoterLink(promoterId, eventId);
            return link;
        }
        catch (error) {
            reply.status(500).send({ error: error.message });
        }
    });
}
//# sourceMappingURL=promoters.js.map