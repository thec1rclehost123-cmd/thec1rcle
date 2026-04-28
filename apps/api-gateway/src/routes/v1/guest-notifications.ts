import { FastifyInstance } from 'fastify';
import { z } from 'zod';
// @ts-ignore
import {
    getGuestNotifications,
    getGuestUnreadCount,
    markAllGuestNotificationsRead,
    markGuestNotificationRead,
} from '@c1rcle/core/guest-wallet-profile-notification-service';

const GuestNotificationsQuery = z.object({
    unreadOnly: z.string().optional(),
    countOnly: z.string().optional(),
    limit: z.string().optional(),
}).strict();

const GuestNotificationIdParam = z.object({
    id: z.string(),
}).strict();

const GuestNotificationsPatchBody = z.object({
    markAll: z.boolean().optional(),
}).strict();

export default async function guestNotificationRoutes(fastify: FastifyInstance) {
    fastify.get('/guest-notifications', {
        preHandler: [fastify.validate({ querystring: GuestNotificationsQuery })],
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

        try {
            const unreadOnly = request.query.unreadOnly === 'true';
            const countOnly = request.query.countOnly === 'true';
            const limit = Number.parseInt(request.query.limit || '50', 10);

            if (countOnly) {
                const unreadCount = await getGuestUnreadCount(fastify.db, userId);
                return { unreadCount };
            }

            const notifications = await getGuestNotifications(fastify.db, userId, { unreadOnly, limit });
            return { notifications };
        } catch (error: any) {
            fastify.log.error({ requestId: request.id, userId, error: error.message }, 'GET /guest-notifications failed');
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    fastify.patch('/guest-notifications', {
        preHandler: [fastify.validate({ body: GuestNotificationsPatchBody })],
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

        try {
            if (!request.body.markAll) {
                return reply.status(400).send({ error: 'markAll is required' });
            }

            return await markAllGuestNotificationsRead(fastify.db, userId);
        } catch (error: any) {
            fastify.log.error({ requestId: request.id, userId, error: error.message }, 'PATCH /guest-notifications failed');
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    fastify.patch('/guest-notifications/:id', {
        preHandler: [fastify.validate({ params: GuestNotificationIdParam })],
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

        try {
            const result = await markGuestNotificationRead(fastify.db, userId, request.params.id);
            if (!result) return reply.status(404).send({ error: 'Notification not found' });
            return result;
        } catch (error: any) {
            const status = error.message?.includes('Unauthorized') ? 403 : 500;
            return reply.status(status).send({ error: error.message || 'Failed to update notification' });
        }
    });
}
