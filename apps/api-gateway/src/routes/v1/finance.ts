import { FastifyInstance } from 'fastify';
import { getFinancialSummary, getTransactionHistory, processRefund } from '@c1rcle/core/finance-engine';
import { z } from 'zod';

const SummaryQuery = z.object({
    entityId: z.string(),
    type: z.string()
}).strict();

const HistoryQuery = z.object({
    entityId: z.string(),
    limit: z.string().optional(),
    state: z.string().optional()
}).strict();

const RefundBody = z.object({
    orderId: z.string(),
    amount: z.number().positive(),
    reason: z.string()
}).strict();

const PromoterIdParam = z.object({
    promoterId: z.string()
}).strict();

const PayoutBody = z.object({
    promoterId: z.string().optional(),
    amount: z.number().optional()
}).catchall(z.any());

export default async function financeRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/finance/summary
     * Gets financial overview for the authenticated user/partner
     */
    fastify.get('/summary', {
        preHandler: [fastify.validate({ querystring: SummaryQuery })]
    }, async (request, reply) => {
        const { entityId, type } = request.query as { entityId: string, type: string };

        try {
            await fastify.verifyPartnerAccess(request, entityId);
            const summary = await getFinancialSummary(entityId, type);
            return summary;
        } catch (error: any) {
            fastify.log.error(`Finance summary failed for entityId=${entityId}: ${error.message}`);
            return reply.status(error.message.includes('Forbidden') || error.message.includes('Unauthorized') ? 403 : 500).send({ error: "Failed to load financial summary" });
        }
    });

    /**
     * GET /api/v1/finance/history
     * Gets ledger history
     */
    fastify.get('/history', {
        preHandler: [fastify.validate({ querystring: HistoryQuery })]
    }, async (request, reply) => {
        const { entityId, limit, state } = request.query as { entityId: string, limit?: string, state?: string };

        try {
            const history = await getTransactionHistory(entityId, {
                limit: limit ? parseInt(limit) : 50,
                state
            });
            return history;
        } catch (error: any) {
            fastify.log.error(`Finance history failed for entityId=${entityId}: ${error.message}`);
            reply.status(500).send({ error: "Failed to load transaction history" });
        }
    });

    /**
     * POST /api/v1/finance/refund
     * Initiates a refund
     */
    fastify.post('/refund', {
        preHandler: [fastify.validate({ body: RefundBody })]
    }, async (request, reply) => {
        const { orderId, amount, reason } = request.body as { orderId: string, amount: number, reason: string };
        try {
            const result = await processRefund(orderId, amount, reason, (request as any).user?.uid);
            return result;
        } catch (error: any) {
            fastify.log.error(`Refund failed for orderId=${orderId}: ${error.message}`);
            reply.status(400).send({ error: "Failed to process refund" });
        }
    });

    /**
     * GET /api/v1/finance/promoter/balance/:promoterId
     */
    fastify.get('/promoter/balance/:promoterId', {
        preHandler: [fastify.validate({ params: PromoterIdParam })]
    }, async (request, reply) => {
        const { promoterId } = request.params as { promoterId: string };
        try {
            const { getPromoterPayoutBalance } = await import('@c1rcle/core/payout-engine');
            return await getPromoterPayoutBalance(promoterId);
        } catch (error: any) {
            fastify.log.error(`Payout balance failed for promoterId=${promoterId}: ${error.message}`);
            reply.status(500).send({ error: "Failed to load payout balance" });
        }
    });

    /**
     * POST /api/v1/finance/promoter/payout
     */
    fastify.post('/promoter/payout', {
        preHandler: [fastify.validate({ body: PayoutBody })]
    }, async (request, reply) => {
        const data = request.body as any;
        try {
            const { requestPromoterPayout } = await import('@c1rcle/core/payout-engine');
            return await requestPromoterPayout(data);
        } catch (error: any) {
            fastify.log.error(`Payout request failed: ${error.message}`);
            reply.status(400).send({ error: "Failed to request payout" });
        }
    });

    /**
     * GET /api/v1/finance/promoter/payouts/:promoterId
     */
    fastify.get('/promoter/payouts/:promoterId', {
        preHandler: [fastify.validate({ params: PromoterIdParam })]
    }, async (request, reply) => {
        const { promoterId } = request.params as { promoterId: string };
        try {
            const { listPromoterPayouts } = await import('@c1rcle/core/payout-engine');
            return await listPromoterPayouts(promoterId);
        } catch (error: any) {
            fastify.log.error(`Payout list failed for promoterId=${promoterId}: ${error.message}`);
            reply.status(500).send({ error: "Failed to load payouts" });
        }
    });
}

