import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const AdminLogsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
});

export default async function adminRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/admin/logs
     * Fetch admin audit logs
     */
    fastify.get('/logs', {
        preHandler: [
            fastify.requireRoles(['admin']),
            fastify.validate({ querystring: AdminLogsQuerySchema }),
        ]
    }, async (request: any, reply) => {
        const actorId = request.user?.uid;
        if (!actorId) return reply.status(401).send({ error: "Unauthorized" });

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
