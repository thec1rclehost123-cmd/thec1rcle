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
  fastify.get(
    '/logs',
    {
      preHandler: [fastify.requireAdmin, fastify.validate({ querystring: AdminLogsQuerySchema })],
    },
    async (request: any, reply) => {
      const actorId = request.user?.uid;
      const { limit } = request.query as z.infer<typeof AdminLogsQuerySchema>;

      try {
        const snapshot = await fastify.db
          .collection('admin_audit_logs')
          .orderBy('createdAt', 'desc')
          .limit(limit)
          .get();

        const logs = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate
              ? data.createdAt.toDate().toISOString()
              : data.createdAt,
          };
        });

        return { success: true, logs };
      } catch (error: any) {
        fastify.log.error(`Error in GET /admin/logs: ${error.message}`);
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  /**
   * GET /api/v1/admin/cache
   * Show Redis cache stats (keys per namespace, total keys, memory usage)
   */
  fastify.get('/cache', { preHandler: [fastify.requireAdmin] }, async (_request: any, reply) => {
    try {
      const stats = await fastify.cache.getStats();
      return { success: true, ...stats };
    } catch (error: any) {
      fastify.log.error(`Error in GET /admin/cache: ${error.message}`);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  /**
   * DELETE /api/v1/admin/cache
   * Flush entire Redis cache
   */
  fastify.delete('/cache', { preHandler: [fastify.requireAdmin] }, async (request: any, reply) => {
    try {
      await fastify.cache.flushAll();
      await fastify.db.collection('admin_audit_logs').add({
        action: 'cache.flush_all',
        actorId: request.user.uid,
        actorEmail: request.user.email || null,
        timestamp: new Date(),
        requestId: request.id,
      });
      return { success: true, message: 'Entire cache flushed' };
    } catch (error: any) {
      fastify.log.error(`Error in DELETE /admin/cache: ${error.message}`);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  /**
   * DELETE /api/v1/admin/cache/:namespace
   * Flush a specific cache namespace
   */
  const CacheNamespaceParamsSchema = z.object({
    namespace: z.string().min(1),
  });

  fastify.delete(
    '/cache/:namespace',
    {
      preHandler: [fastify.requireAdmin, fastify.validate({ params: CacheNamespaceParamsSchema })],
    },
    async (request: any, reply) => {
      const { namespace } = request.params as z.infer<typeof CacheNamespaceParamsSchema>;
      try {
        await fastify.cache.invalidateNamespace(namespace);
        await fastify.db.collection('admin_audit_logs').add({
          action: 'cache.flush_namespace',
          namespace,
          actorId: request.user.uid,
          actorEmail: request.user.email || null,
          timestamp: new Date(),
          requestId: request.id,
        });
        return { success: true, message: `Namespace "${namespace}" flushed` };
      } catch (error: any) {
        fastify.log.error(`Error in DELETE /admin/cache/${namespace}: ${error.message}`);
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );
}
