import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const VenueQuery = z.object({
    venueId: z.string()
}).strict();

const ReadBody = z.object({
    venueId: z.string(),
    notificationId: z.string().optional(),
    notificationType: z.string().optional(),
    markAllRead: z.boolean().optional()
}).strict();

const ActionBody = z.object({
    notificationId: z.string(),
    notificationType: z.string(),
    action: z.string(),
    venueId: z.string().optional()
}).strict();

const SendBody = z.object({
    venueId: z.string(),
    title: z.string(),
    message: z.string(),
    data: z.any().optional()
}).strict();

/**
 * Venue Notifications Gateway Routes
 * Aggregates notifications from multiple collections for dashboard display
 */
export default async function notificationsRoutes(fastify: FastifyInstance) {

    /**
     * GET /api/v1/notifications?venueId=XXX
     * Aggregate notifications for a venue from multiple sources.
     * Caller must manage the venue.
     */
    fastify.get('/', {
        preHandler: [fastify.requirePartnerAccess((req) => (req.query as any).venueId), fastify.validate({ querystring: VenueQuery })]
    }, async (request: any, reply) => {
        const { venueId } = request.query;
        try {
            const dashboard = await fastify.notificationService.getVenueDashboard(venueId);
            return dashboard;
        } catch (error: any) {
            fastify.log.error(`Error in GET /notifications: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });

    /**
     * PATCH /api/v1/notifications/read
     * Mark notification(s) as read. Caller must manage the venue.
     */
    fastify.patch('/read', {
        preHandler: [fastify.requirePartnerAccess((req) => (req.body as any).venueId), fastify.validate({ body: ReadBody })]
    }, async (request: any, reply) => {
        const { venueId, notificationId, notificationType, markAllRead } = request.body as any;
        try {
            await fastify.notificationService.markAsRead(venueId, notificationId, notificationType, !!markAllRead);
            return { success: true, markedCount: markAllRead ? 'all' : 1 };
        } catch (error: any) {
            fastify.log.error(`Error in PATCH /notifications/read: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });

    /**
     * POST /api/v1/notifications/action
     * Perform a quick action on a notification.
     * Caller must manage the venue (venueId in body).
     */
    fastify.post('/action', {
        preHandler: [fastify.requireAuth, fastify.validate({ body: ActionBody })]
    }, async (request: any, reply) => {
        const { notificationId, notificationType, action, venueId } = request.body as any;
        if (!notificationId || !notificationType || !action) return reply.status(400).send({ error: 'Missing required fields' });

        if (venueId) {
            try {
                await fastify.verifyPartnerAccess(request, venueId);
            } catch {
                return reply.status(403).send({ error: 'Forbidden: Insufficient access to this venue' });
            }
        }

        try {
            const newStatus = await fastify.notificationService.performAction(notificationId, notificationType, action);
            return { success: true, newStatus };
        } catch (error: any) {
            fastify.log.error(`Error in POST /notifications/action: ${error.message}`);
            return reply.status(400).send({ error: "Action failed" });
        }
    });

    /**
     * POST /api/v1/notifications/send
     * Send a push notification to all followers of a venue.
     * Caller must manage the venue.
     */
    fastify.post('/send', {
        preHandler: [fastify.requirePartnerAccess((req) => (req.body as any).venueId), fastify.validate({ body: SendBody })]
    }, async (request: any, reply) => {
        const { venueId, title, message, data } = request.body as any;
        if (!title || !message) return reply.status(400).send({ error: 'title and message required' });

        try {
            const result = await fastify.notificationService.sendPushToFollowers(venueId, title, message, data);
            return { success: true, ...result };
        } catch (error: any) {
            fastify.log.error(`Error in POST /notifications/send: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
}
