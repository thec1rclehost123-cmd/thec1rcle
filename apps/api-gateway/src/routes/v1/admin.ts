import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const AdminLogsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
});

export default async function adminRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/v1/admin/reindex-discovery
     * Force-rebuild all public discovery read models (event_card_index, host_summary, venue_summary)
     * Useful after a failed sync or project migration.
     */
    fastify.post('/reindex-discovery', {
        preHandler: [fastify.requireAdmin],
    }, async (request: any, reply) => {
        try {
            fastify.log.info({ uid: request.user?.uid }, '[admin] Force-reindexing public discovery read models');
            // Reset version flags so bootstrap runs unconditionally
            await fastify.db.collection('system_meta').doc('public_discovery_bootstrap').delete().catch(() => {});
            (fastify.publicDiscoveryService as any).eventCardsChecked = false;
            (fastify.publicDiscoveryService as any).hostSummaryChecked = false;
            (fastify.publicDiscoveryService as any).venueSummaryChecked = false;
            (fastify.publicDiscoveryService as any).bootstrapPromise = null;

            // Run bootstrap in background — don't block the response
            fastify.publicDiscoveryService.bootstrapReadModels(fastify.log).catch((err: any) => {
                fastify.log.error({ error: err?.message || String(err) }, '[admin] reindex-discovery failed');
            });
            return reply.send({ success: true, message: 'Reindex started in background — check server logs for progress' });
        } catch (error: any) {
            fastify.log.error(`Error in POST /admin/reindex-discovery: ${error.message}`);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    /**
     * GET /api/v1/admin/logs
     * Fetch admin audit logs
     */
    fastify.get('/logs', {
        preHandler: [
            fastify.requireAdmin,
            fastify.validate({ querystring: AdminLogsQuerySchema }),
        ]
    }, async (request: any, reply) => {
        const actorId = request.user?.uid;
        const { limit } = request.query as z.infer<typeof AdminLogsQuerySchema>;

        try {
            const snapshot = await fastify.db.collection('admin_audit_logs')
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();

            const logs = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Handle Firestore Timestamp normalization
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt
                };
            });

            return { success: true, logs };
        } catch (error: any) {
            fastify.log.error(`Error in GET /admin/logs: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
}
