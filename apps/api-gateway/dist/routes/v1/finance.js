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
export default async function financeRoutes(fastify) {
    /**
     * GET /api/v1/finance/summary
     * Gets financial overview for the authenticated user/partner
     */
    fastify.get('/summary', {
        preHandler: [fastify.validate({ querystring: SummaryQuery })]
    }, async (request, reply) => {
        const { entityId, type } = request.query;
        // RBAC: Ensure user has access to this entity
        // await fastify.verifyPartnerAccess(request, entityId);
        try {
            const summary = await getFinancialSummary(entityId, type);
            return summary;
        }
        catch (error) {
            reply.status(500).send({ error: error.message });
        }
    });
    /**
     * GET /api/v1/finance/history
     * Gets ledger history
     */
    fastify.get('/history', {
        preHandler: [fastify.validate({ querystring: HistoryQuery })]
    }, async (request, reply) => {
        const { entityId, limit, state } = request.query;
        try {
            const history = await getTransactionHistory(entityId, {
                limit: limit ? parseInt(limit) : 50,
                state
            });
            return history;
        }
        catch (error) {
            reply.status(500).send({ error: error.message });
        }
    });
    /**
     * POST /api/v1/finance/refund
     * Initiates a refund
     */
    fastify.post('/refund', {
        preHandler: [fastify.validate({ body: RefundBody })]
    }, async (request, reply) => {
        const { orderId, amount, reason } = request.body;
        try {
            const result = await processRefund(orderId, amount, reason, request.user?.uid);
            return result;
        }
        catch (error) {
            reply.status(400).send({ error: error.message });
        }
    });
    /**
     * GET /api/v1/finance/promoter/balance/:promoterId
     */
    fastify.get('/promoter/balance/:promoterId', {
        preHandler: [fastify.validate({ params: PromoterIdParam })]
    }, async (request, reply) => {
        const { promoterId } = request.params;
        try {
            const { getPromoterPayoutBalance } = await import('@c1rcle/core/payout-engine');
            return await getPromoterPayoutBalance(promoterId);
        }
        catch (error) {
            reply.status(500).send({ error: error.message });
        }
    });
    /**
     * POST /api/v1/finance/promoter/payout
     */
    fastify.post('/promoter/payout', {
        preHandler: [fastify.validate({ body: PayoutBody })]
    }, async (request, reply) => {
        const data = request.body;
        try {
            const { requestPromoterPayout } = await import('@c1rcle/core/payout-engine');
            return await requestPromoterPayout(data);
        }
        catch (error) {
            reply.status(400).send({ error: error.message });
        }
    });
    /**
     * GET /api/v1/finance/promoter/payouts/:promoterId
     */
    fastify.get('/promoter/payouts/:promoterId', {
        preHandler: [fastify.validate({ params: PromoterIdParam })]
    }, async (request, reply) => {
        const { promoterId } = request.params;
        try {
            const { listPromoterPayouts } = await import('@c1rcle/core/payout-engine');
            return await listPromoterPayouts(promoterId);
        }
        catch (error) {
            reply.status(500).send({ error: error.message });
        }
    });
}
//# sourceMappingURL=finance.js.map