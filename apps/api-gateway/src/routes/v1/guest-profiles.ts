import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { findGuestUserByEmail, getGuestProfileSummary } from '../../services/guest-gp5';

const GuestProfileIdParam = z.object({
    id: z.string(),
}).strict();

const GuestProfileLookupQuery = z.object({
    email: z.string().email(),
}).strict();

export default async function guestProfileRoutes(fastify: FastifyInstance) {
    fastify.get('/guest-profiles/lookup', {
        preHandler: [fastify.validate({ querystring: GuestProfileLookupQuery })],
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

        try {
            const user = await findGuestUserByEmail(request.query.email);
            if (!user) return reply.status(404).send({ error: 'Profile not found' });

            return {
                user: {
                    uid: user.uid,
                    displayName: user.displayName || user.name || 'Member',
                    email: user.email || null,
                    photoURL: user.photoURL || user.avatar || null,
                    avatar: user.photoURL || user.avatar || null,
                },
            };
        } catch (error: any) {
            fastify.log.error({ requestId: request.id, userId, error: error.message }, 'GET /guest-profiles/lookup failed');
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    fastify.get('/guest-profiles/:id', {
        preHandler: [fastify.validate({ params: GuestProfileIdParam })],
    }, async (request: any, reply) => {
        try {
            const viewerId = request.user?.uid || null;
            const result = await getGuestProfileSummary(request.params.id, viewerId);
            if (!result.profile) return reply.status(404).send({ error: 'Profile not found' });
            return result;
        } catch (error: any) {
            fastify.log.error({ requestId: request.id, error: error.message }, 'GET /guest-profiles/:id failed');
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });
}
