import { FastifyInstance } from "fastify";

/**
 * Venue Notifications Gateway Routes
 * Aggregates notifications from multiple collections for dashboard display
 */
export default async function notificationsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/notifications?venueId=XXX
   * Aggregate notifications for a venue from multiple sources
   */
  fastify.get("/", async (request: any, reply) => {
    const { venueId } = request.query;
    if (!venueId) return reply.status(400).send({ error: "venueId required" });

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
   * Mark notification(s) as read
   */
  fastify.patch("/read", async (request: any, reply) => {
    const { venueId, notificationId, notificationType, markAllRead } = request.body as any;
    if (!venueId) return reply.status(400).send({ error: "venueId required" });

    try {
      await fastify.notificationService.markAsRead(
        venueId,
        notificationId,
        notificationType,
        !!markAllRead,
      );
      return { success: true, markedCount: markAllRead ? "all" : 1 };
    } catch (error: any) {
      fastify.log.error(`Error in PATCH /notifications/read: ${error.message}`);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });

  /**
   * POST /api/v1/notifications/action
   * Perform a quick action on a notification (approve/reject connection, slot, etc.)
   */
  fastify.post("/action", async (request: any, reply) => {
    const { notificationId, notificationType, action, venueId } = request.body as any;
    if (!notificationId || !notificationType || !action)
      return reply.status(400).send({ error: "Missing required fields" });

    try {
      const newStatus = await fastify.notificationService.performAction(
        notificationId,
        notificationType,
        action,
      );
      return { success: true, newStatus };
    } catch (error: any) {
      fastify.log.error(`Error in POST /notifications/action: ${error.message}`);
      return reply.status(400).send({ error: error.message || "Action failed" });
    }
  });

  /**
   * POST /api/v1/notifications/send
   * Send a push notification to all followers of a venue
   */
  fastify.post("/send", async (request: any, reply) => {
    const { venueId, title, message, data } = request.body as any;
    if (!venueId || !title || !message)
      return reply.status(400).send({ error: "venueId, title, and message required" });

    try {
      const result = await fastify.notificationService.sendPushToFollowers(
        venueId,
        title,
        message,
        data,
      );
      return { success: true, ...result };
    } catch (error: any) {
      fastify.log.error(`Error in POST /notifications/send: ${error.message}`);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });
}
