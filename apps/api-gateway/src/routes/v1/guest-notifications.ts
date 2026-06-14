import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse } from '../../lib/api-contracts';
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
        if (!userId) return reply.status(401).send(buildErrorResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: request.id }));

        try {
            const unreadOnly = request.query.unreadOnly === 'true';
            const countOnly = request.query.countOnly === 'true';
            const limit = Number.parseInt(request.query.limit || '50', 10);

            if (countOnly) {
                const unreadCount = await getGuestUnreadCount(fastify.db, userId);
                // Legacy fields at top level for backward compat
                return { success: true, data: { notifications: [], unreadCount }, notifications: [], unreadCount };
            }

            const [notifications, unreadCount] = await Promise.all([
                getGuestNotifications(fastify.db, userId, { unreadOnly, limit }),
                getGuestUnreadCount(fastify.db, userId),
            ]);
            // Legacy fields at top level for backward compat
            return { success: true, data: { notifications, unreadCount }, notifications, unreadCount };
        } catch (error: any) {
            fastify.log.error({ requestId: request.id, userId, error: error.message }, 'GET /guest-notifications failed');
            return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
        }
    });

    fastify.patch('/guest-notifications', {
        preHandler: [fastify.validate({ body: GuestNotificationsPatchBody })],
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send(buildErrorResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: request.id }));

        try {
            if (!request.body.markAll) {
                return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'markAll is required', requestId: request.id }));
            }

            await markAllGuestNotificationsRead(fastify.db, userId);
            return { success: true };
        } catch (error: any) {
            fastify.log.error({ requestId: request.id, userId, error: error.message }, 'PATCH /guest-notifications failed');
            return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
        }
    });

    fastify.patch('/guest-notifications/:id', {
        preHandler: [fastify.validate({ params: GuestNotificationIdParam })],
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send(buildErrorResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: request.id }));

        try {
            const result = await markGuestNotificationRead(fastify.db, userId, request.params.id);
            if (!result) return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Notification not found', requestId: request.id }));
            return { success: true };
        } catch (error: any) {
            const status = error.message?.includes('Unauthorized') ? 403 : 500;
            return reply.status(status).send(buildErrorResponse({ code: status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', message: error.message || 'Failed to update notification', requestId: request.id }));
        }
    });
}
