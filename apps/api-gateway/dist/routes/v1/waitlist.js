import { joinWaitlist, processWaitlist, verifyWaitlistAccess } from '@c1rcle/core/waitlist-engine';
import { z } from 'zod';
const JoinBody = z.record(z.string(), z.any());
const ProcessBody = z.object({
    eventId: z.string(),
    tierId: z.string()
}).strict();
const VerifyQuery = z.object({
    eventId: z.string(),
    email: z.string().email()
}).strict();
export default async function waitlistRoutes(fastify) {
    /**
     * POST /api/v1/waitlist/join
     */
    fastify.post('/join', {
        preHandler: [fastify.validate({ body: JoinBody })]
    }, async (request, reply) => {
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
    fastify.post('/process', {
        preHandler: [fastify.validate({ body: ProcessBody })]
    }, async (request, reply) => {
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
    fastify.get('/verify', {
        preHandler: [fastify.validate({ querystring: VerifyQuery })]
    }, async (request, reply) => {
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