import { joinWaitlist, processWaitlist, verifyWaitlistAccess } from '@c1rcle/core/waitlist-engine';
export default async function waitlistRoutes(fastify) {
    /**
     * POST /api/v1/waitlist/join
     */
    fastify.post('/join', async (request, reply) => {
        const data = request.body;
        try {
            return await joinWaitlist(data);
        }
        catch (error) {
            reply.status(400).send({ error: error.message });
        }
    });
    /**
     * POST /api/v1/waitlist/process
     */
    fastify.post('/process', async (request, reply) => {
        const { eventId, tierId } = request.body;
        try {
            const next = await processWaitlist(eventId, tierId);
            if (!next)
                return { status: 'empty' };
            return next;
        }
        catch (error) {
            reply.status(400).send({ error: error.message });
        }
    });
    /**
     * GET /api/v1/waitlist/verify
     */
    fastify.get('/verify', async (request, reply) => {
        const { eventId, email } = request.query;
        try {
            return await verifyWaitlistAccess(eventId, email);
        }
        catch (error) {
            reply.status(400).send({ error: error.message });
        }
    });
}
//# sourceMappingURL=waitlist.js.map