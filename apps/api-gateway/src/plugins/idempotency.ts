import fp from 'fastify-plugin';

export default fp(async (fastify) => {
    fastify.addHook('preHandler', async (request, reply) => {
        const idempotencyKey = request.headers['x-idempotency-key'] as string;
        if (!idempotencyKey) return;

        const userId = (request as any).user?.uid || 'anonymous';
        
        try {
            const cached = await fastify.idempotencyService.getCachedResponse(idempotencyKey, userId);
            if (cached) {
                request.log.info({ idempotencyKey, userId }, 'Idempotency hit: returning cached response');
                return reply
                    .status(cached.status)
                    .header('x-idempotency-hit', 'true')
                    .send(cached.body);
            }
        } catch (error) {
            request.log.error({ error, idempotencyKey }, 'Idempotency check failed');
        }
    });

    // Hook to save successful responses
    fastify.addHook('onSend', async (request, reply, payload) => {
        const idempotencyKey = request.headers['x-idempotency-key'] as string;
        if (!idempotencyKey || reply.statusCode >= 400) return;

        const userId = (request as any).user?.uid || 'anonymous';
        const isHit = reply.getHeader('x-idempotency-hit') === 'true';
        
        if (!isHit) {
            try {
                const parsedBody = JSON.parse(payload as string);
                await fastify.idempotencyService.saveResponse(
                    idempotencyKey, 
                    userId, 
                    parsedBody, 
                    reply.statusCode
                );
            } catch (e) {
                // Silently fail if body is not JSON or save fails
            }
        }
    });
});
