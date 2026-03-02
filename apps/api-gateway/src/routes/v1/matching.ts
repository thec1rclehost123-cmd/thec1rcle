import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const MatchFeedQuery = z.object({
    lat: z.string().optional(),
    lng: z.string().optional(),
    limit: z.string().optional(),
    type: z.string().optional()
}).strict();

const SwipeBody = z.object({
    targetId: z.string(),
    targetType: z.string().optional(),
    direction: z.string()
}).strict();

const ReportBody = z.object({
    targetId: z.string(),
    targetType: z.string().optional(),
    reason: z.string(),
    details: z.string().optional()
}).strict();

export default async function matchingRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/matching/feed
     * Get ranked list of potential matches (events for V1)
     */
    fastify.get('/feed', {
        preHandler: [fastify.validate({ querystring: MatchFeedQuery })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send({ error: "Unauthorized" });

        const { lat, lng, limit = 20, type = 'event' } = request.query as any;

        try {
            const feed = await fastify.matchingService.getMatchFeed(userId, {
                lat: lat ? Number(lat) : undefined,
                lng: lng ? Number(lng) : undefined,
                limit: Number(limit),
                type: type as any
            });
            return feed;
        } catch (error: any) {
            fastify.log.error(`Error in GET /matching/feed: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });

    /**
     * POST /api/v1/matching/swipe
     * Submit an interaction (Like/Pass/Superlike)
     */
    fastify.post('/swipe', {
        preHandler: [fastify.validate({ body: SwipeBody })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send({ error: "Unauthorized" });

        const { targetId, targetType = 'event', direction } = request.body as any;

        if (!targetId || !direction) {
            return reply.status(400).send({ error: "targetId and direction are required" });
        }

        try {
            await fastify.matchingService.handleSwipe(userId, targetId, targetType, direction);

            // Analytics instrumentation (Step 4 preview)
            // @ts-ignore
            if (fastify.analyticsService) {
                // await fastify.analyticsService.trackInteraction(userId, 'swipe', { targetId, direction });
            }

            return { success: true };
        } catch (error: any) {
            fastify.log.error(`Error in POST /matching/swipe: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });

    /**
     * POST /api/v1/matching/report
     * Report an event or profile
     */
    fastify.post('/report', {
        preHandler: [fastify.validate({ body: ReportBody })]
    }, async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send({ error: "Unauthorized" });

        const { targetId, targetType = 'event', reason, details } = request.body as any;

        if (!targetId || !reason) {
            return reply.status(400).send({ error: "targetId and reason are required" });
        }

        try {
            const reportId = await fastify.moderationService.reportItem({
                reporterId: userId,
                targetId,
                targetType,
                reason,
                details
            });

            return { success: true, reportId };
        } catch (error: any) {
            fastify.log.error(`Error in POST /matching/report: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
}
