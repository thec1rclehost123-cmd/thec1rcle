import { FastifyInstance } from 'fastify';
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

export default async function waitlistRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/v1/waitlist/join
     */
    fastify.post('/join', {
        preHandler: [fastify.validate({ body: JoinBody })]
    }, async (request, reply) => {
        const data = request.body as any;
        try {
            return await joinWaitlist(data);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    /**
     * POST /api/v1/waitlist/process
     */
    fastify.post('/process', {
        preHandler: [fastify.validate({ body: ProcessBody })]
    }, async (request, reply) => {
        const { eventId, tierId } = request.body as { eventId: string, tierId: string };
        try {
            const next = await processWaitlist(eventId, tierId);
            if (!next) return { status: 'empty' };
            return next;
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    /**
     * GET /api/v1/waitlist/verify
     */
    fastify.get('/verify', {
        preHandler: [fastify.validate({ querystring: VerifyQuery })]
    }, async (request, reply) => {
        const { eventId, email } = request.query as { eventId: string, email: string };
        try {
            return await verifyWaitlistAccess(eventId, email);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });
}
