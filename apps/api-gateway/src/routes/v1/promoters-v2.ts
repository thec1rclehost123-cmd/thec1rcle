import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse } from '../../lib/api-contracts';
import { resolvePromoterRequestContext } from '../../lib/promoter-request-context';

const AnalyticsQuery = z.object({
    range: z.enum(['7d', '30d', '90d', 'ytd', 'all']).optional(),
    eventId: z.string().optional(),
}).strict();

const LinksQuery = z.object({
    eventId: z.string().optional(),
    status: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(200).optional(),
}).strict();

const EventsQuery = z.object({
    city: z.string().optional(),
    status: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).optional(),
}).strict();

const FinanceQuery = z.object({
    status: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(200).optional(),
}).strict();

async function getPromoterContextOrReply(fastify: FastifyInstance, request: any, reply: any) {
    const context = await resolvePromoterRequestContext(fastify as any, request);
    if (!context) {
        reply.status(403).send(buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'Promoter access required',
            requestId: request.id,
        }));
        return null;
    }
    return context;
}

export default async function promoterV2Routes(fastify: FastifyInstance) {
    fastify.get('/me/overview', {
        preHandler: [fastify.requireAuth],
    }, async (request: any, reply) => {
        const context = await getPromoterContextOrReply(fastify, request, reply);
        if (!context) return;
        return fastify.promoterServiceV2.getOverview(context);
    });

    fastify.get('/me/analytics', {
        preHandler: [fastify.requireAuth, fastify.validate({ querystring: AnalyticsQuery })],
    }, async (request: any, reply) => {
        const context = await getPromoterContextOrReply(fastify, request, reply);
        if (!context) return;
        const query = request.query as z.infer<typeof AnalyticsQuery>;
        return fastify.promoterServiceV2.getAnalytics(context, query);
    });

    fastify.get('/me/links', {
        preHandler: [fastify.requireAuth, fastify.validate({ querystring: LinksQuery })],
    }, async (request: any, reply) => {
        const context = await getPromoterContextOrReply(fastify, request, reply);
        if (!context) return;
        const query = request.query as z.infer<typeof LinksQuery>;
        return fastify.promoterServiceV2.listLinks(context, query);
    });

    fastify.get('/me/events', {
        preHandler: [fastify.requireAuth, fastify.validate({ querystring: EventsQuery })],
    }, async (request: any, reply) => {
        const context = await getPromoterContextOrReply(fastify, request, reply);
        if (!context) return;
        const query = request.query as z.infer<typeof EventsQuery>;
        return fastify.promoterServiceV2.listEvents(context, query);
    });

    fastify.get('/me/finance', {
        preHandler: [fastify.requireAuth, fastify.validate({ querystring: FinanceQuery })],
    }, async (request: any, reply) => {
        const context = await getPromoterContextOrReply(fastify, request, reply);
        if (!context) return;
        const query = request.query as z.infer<typeof FinanceQuery>;
        return fastify.promoterServiceV2.getFinance(context, query);
    });

    fastify.get('/me/payouts', {
        preHandler: [fastify.requireAuth, fastify.validate({ querystring: FinanceQuery })],
    }, async (request: any, reply) => {
        const context = await getPromoterContextOrReply(fastify, request, reply);
        if (!context) return;
        const query = request.query as z.infer<typeof FinanceQuery>;
        return fastify.promoterServiceV2.listPayouts(context, query);
    });

    fastify.get('/me/profile', {
        preHandler: [fastify.requireAuth],
    }, async (request: any, reply) => {
        const context = await getPromoterContextOrReply(fastify, request, reply);
        if (!context) return;
        return fastify.promoterServiceV2.getProfile(context);
    });

    fastify.get('/me/settings', {
        preHandler: [fastify.requireAuth],
    }, async (request: any, reply) => {
        const context = await getPromoterContextOrReply(fastify, request, reply);
        if (!context) return;
        return fastify.promoterServiceV2.getSettings(context);
    });
}
