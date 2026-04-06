import { FastifyInstance } from 'fastify';
import type { Firestore } from 'firebase-admin/firestore';
import { getFinancialSummary, getTransactionHistory, processRefund } from '@c1rcle/core/finance-engine';
// @ts-ignore — JS module, no type declarations
import { MONEY_STATES } from '@c1rcle/core/ledger-engine';
import { z } from 'zod';

// ── Existing schemas ──────────────────────────────────────────────────────────

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

// ── New schemas ───────────────────────────────────────────────────────────────

const EntityQuery = z.object({
    entityId: z.string(),
    entityType: z.string().optional(),
}).strict();

const PayoutHistoryQuery = z.object({
    entityId: z.string(),
    entityType: z.string().optional(),
    limit: z.string().optional(),
    cursor: z.string().optional(),
}).strict();

const InvoicesQuery = z.object({
    entityId: z.string(),
    limit: z.string().optional(),
}).strict();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Sum ledger_entries for an actorId filtered by one or more states.
 * Amounts in ledger are stored in rupees; caller multiplies by 100 for paise.
 */
async function sumLedger(
    db: Firestore,
    actorId: string,
    states: string[]
): Promise<number> {
    const snapshots = await Promise.all(
        states.map((state) =>
            db.collection('ledger_entries')
                .where('actorId', '==', actorId)
                .where('state', '==', state)
                .get()
        )
    );
    return snapshots.reduce((total, snap) => {
        return total + snap.docs.reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0);
    }, 0);
}

export default async function financeRoutes(fastify: FastifyInstance) {

    // ── Existing routes ───────────────────────────────────────────────────────

    /**
     * GET /api/v1/finance/summary
     */
    fastify.get('/summary', {
        preHandler: [fastify.validate({ querystring: SummaryQuery })]
    }, async (request, reply) => {
        const { entityId, type } = request.query as { entityId: string; type: string };
        try {
            await fastify.verifyPartnerAccess(request, entityId);
            const summary = await getFinancialSummary(entityId, type);
            return summary;
        } catch (error: any) {
            fastify.log.error(`Finance summary failed for entityId=${entityId}: ${error.message}`);
            return reply.status(
                error.message.includes('Forbidden') || error.message.includes('Unauthorized') ? 403 : 500
            ).send({ error: 'Failed to load financial summary' });
        }
    });

    /**
     * GET /api/v1/finance/history
     */
    fastify.get('/history', {
        preHandler: [fastify.validate({ querystring: HistoryQuery })]
    }, async (request, reply) => {
        const { entityId, limit, state } = request.query as { entityId: string; limit?: string; state?: string };
        try {
            const history = await getTransactionHistory(entityId, {
                limit: limit ? parseInt(limit) : 50,
                state,
            });
            return history;
        } catch (error: any) {
            fastify.log.error(`Finance history failed for entityId=${entityId}: ${error.message}`);
            reply.status(500).send({ error: 'Failed to load transaction history' });
        }
    });

    /**
     * POST /api/v1/finance/refund
     */
    fastify.post('/refund', {
        preHandler: [fastify.validate({ body: RefundBody })]
    }, async (request, reply) => {
        const { orderId, amount, reason } = request.body as { orderId: string; amount: number; reason: string };
        try {
            const result = await processRefund(orderId, amount, reason, (request as any).user?.uid);
            return result;
        } catch (error: any) {
            fastify.log.error(`Refund failed for orderId=${orderId}: ${error.message}`);
            reply.status(400).send({ error: 'Failed to process refund' });
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
            reply.status(500).send({ error: 'Failed to load payout balance' });
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
            reply.status(400).send({ error: 'Failed to request payout' });
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
            reply.status(500).send({ error: 'Failed to load payouts' });
        }
    });

    // ── New routes ────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/finance/wallet?entityId=&entityType=
     *
     * Wallet balance for a venue/host/promoter.
     * availablePaise  = sum of PAYABLE ledger entries (ready to withdraw)
     * pendingPaise    = sum of HELD + SETTLED entries (in-flight, not yet payable)
     *
     * Ledger amounts are stored in INR rupees; multiply × 100 for paise.
     */
    fastify.get('/wallet', {
        preHandler: [fastify.validate({ querystring: EntityQuery })]
    }, async (request, reply) => {
        const { entityId } = request.query as { entityId: string };
        try {
            await fastify.verifyPartnerAccess(request, entityId);

            const [payable, held, settled] = await Promise.all([
                sumLedger(fastify.db, entityId, [MONEY_STATES.PAYABLE]),
                sumLedger(fastify.db, entityId, [MONEY_STATES.HELD]),
                sumLedger(fastify.db, entityId, [MONEY_STATES.SETTLED]),
            ]);

            return {
                availablePaise: Math.max(0, Math.round(payable * 100)),
                pendingPaise: Math.max(0, Math.round((held + settled) * 100)),
                heldPaise: Math.max(0, Math.round(held * 100)),
                currency: 'INR',
            };
        } catch (error: any) {
            fastify.log.error(`Wallet balance failed for entityId=${entityId}: ${error.message}`);
            return reply.status(
                error.message.includes('Forbidden') || error.message.includes('Unauthorized') ? 403 : 500
            ).send({ error: 'Failed to load wallet balance' });
        }
    });

    /**
     * GET /api/v1/finance/payout-balance?entityId=&entityType=
     *
     * How much a partner can withdraw right now vs. what is still settling.
     * withdrawablePaise       = PAYABLE entries (settled & allocated, ready for bank transfer)
     * pendingSettlementPaise  = HELD + SETTLED entries (event done but not yet allocated)
     */
    fastify.get('/payout-balance', {
        preHandler: [fastify.validate({ querystring: EntityQuery })]
    }, async (request, reply) => {
        const { entityId } = request.query as { entityId: string };
        try {
            await fastify.verifyPartnerAccess(request, entityId);

            const [payable, held, settled] = await Promise.all([
                sumLedger(fastify.db, entityId, [MONEY_STATES.PAYABLE]),
                sumLedger(fastify.db, entityId, [MONEY_STATES.HELD]),
                sumLedger(fastify.db, entityId, [MONEY_STATES.SETTLED]),
            ]);

            return {
                withdrawablePaise: Math.max(0, Math.round(payable * 100)),
                pendingSettlementPaise: Math.max(0, Math.round((held + settled) * 100)),
                currency: 'INR',
            };
        } catch (error: any) {
            fastify.log.error(`Payout balance failed for entityId=${entityId}: ${error.message}`);
            return reply.status(
                error.message.includes('Forbidden') || error.message.includes('Unauthorized') ? 403 : 500
            ).send({ error: 'Failed to load payout balance' });
        }
    });

    /**
     * GET /api/v1/finance/payout-history?entityId=&entityType=&limit=&cursor=
     *
     * Paginated payout request history for a venue/host/promoter.
     * Primary source: payout_requests collection (written by partner dashboard).
     * Fallback: payouts collection (written by payout-engine batch settlement).
     */
    fastify.get('/payout-history', {
        preHandler: [fastify.validate({ querystring: PayoutHistoryQuery })]
    }, async (request, reply) => {
        const { entityId, limit: limitStr, cursor } = request.query as {
            entityId: string;
            entityType?: string;
            limit?: string;
            cursor?: string;
        };
        const limit = Math.min(parseInt(limitStr || '25'), 100);

        try {
            await fastify.verifyPartnerAccess(request, entityId);

            const db = fastify.db;

            // Build base query on payout_requests
            let q: FirebaseFirestore.Query = db.collection('payout_requests')
                .where('venueId', '==', entityId)
                .orderBy('createdAt', 'desc')
                .limit(limit + 1); // +1 to detect hasMore

            // Cursor-based pagination
            if (cursor) {
                const cursorDoc = await db.collection('payout_requests').doc(cursor).get();
                if (cursorDoc.exists) {
                    q = q.startAfter(cursorDoc);
                }
            }

            const snap = await q.get();
            const docs = snap.docs.slice(0, limit);
            const hasMore = snap.docs.length > limit;

            const history = docs.map((doc) => {
                const d = doc.data();
                return {
                    id: doc.id,
                    venueId: d.venueId,
                    amountPaise: d.amountPaise ?? Math.round((d.amount || 0) * 100),
                    status: d.status ?? 'pending',
                    method: d.methodId ?? null,
                    methodDetail: null,
                    requestedAt: d.createdAt,
                    settledAt: d.settledAt ?? null,
                    eventName: d.eventName ?? null,
                    eventDate: d.eventDate ?? null,
                    reference: d.providerRef ?? null,
                };
            });

            // If payout_requests has no data, fall back to payouts collection
            if (history.length === 0 && !cursor) {
                const fallbackSnap = await db.collection('payouts')
                    .where('partnerId', '==', entityId)
                    .orderBy('timestamp', 'desc')
                    .limit(limit)
                    .get();

                const fallbackHistory = fallbackSnap.docs.map((doc) => {
                    const d = doc.data();
                    return {
                        id: doc.id,
                        venueId: entityId,
                        amountPaise: Math.round((d.amount || 0) * 100),
                        status: d.status ?? 'completed',
                        method: null,
                        methodDetail: null,
                        requestedAt: d.timestamp,
                        settledAt: d.timestamp,
                        eventName: null,
                        eventDate: null,
                        reference: d.bankReference ?? null,
                    };
                });

                return {
                    history: fallbackHistory,
                    hasMore: false,
                    nextCursor: null,
                };
            }

            return {
                history,
                hasMore,
                nextCursor: hasMore && docs.length > 0 ? docs[docs.length - 1].id : null,
            };
        } catch (error: any) {
            fastify.log.error(`Payout history failed for entityId=${entityId}: ${error.message}`);
            return reply.status(
                error.message.includes('Forbidden') || error.message.includes('Unauthorized') ? 403 : 500
            ).send({ error: 'Failed to load payout history' });
        }
    });

    /**
     * GET /api/v1/finance/subscription?entityId=
     *
     * Monthly subscription plan for a venue.
     * Greenfield — no subscription collection exists yet.
     * Returns null until subscription billing is implemented.
     */
    fastify.get('/subscription', {
        preHandler: [fastify.validate({ querystring: EntityQuery })]
    }, async (request, reply) => {
        const { entityId } = request.query as { entityId: string };
        try {
            await fastify.verifyPartnerAccess(request, entityId);

            // Future: query subscriptions collection
            // const doc = await fastify.db.collection('subscriptions').doc(entityId).get();
            // if (doc.exists) return { subscription: doc.data() };

            return { subscription: null };
        } catch (error: any) {
            fastify.log.error(`Subscription fetch failed for entityId=${entityId}: ${error.message}`);
            return reply.status(
                error.message.includes('Forbidden') || error.message.includes('Unauthorized') ? 403 : 500
            ).send({ error: 'Failed to load subscription' });
        }
    });

    /**
     * GET /api/v1/finance/billing-methods?entityId=
     *
     * Saved billing/autopay methods for subscription debit.
     * Greenfield — returns empty until billing is implemented.
     */
    fastify.get('/billing-methods', {
        preHandler: [fastify.validate({ querystring: EntityQuery })]
    }, async (request, reply) => {
        const { entityId } = request.query as { entityId: string };
        try {
            await fastify.verifyPartnerAccess(request, entityId);

            // Future: query billing_methods collection
            return { methods: [] };
        } catch (error: any) {
            fastify.log.error(`Billing methods failed for entityId=${entityId}: ${error.message}`);
            return reply.status(
                error.message.includes('Forbidden') || error.message.includes('Unauthorized') ? 403 : 500
            ).send({ error: 'Failed to load billing methods' });
        }
    });

    /**
     * GET /api/v1/finance/invoices?entityId=&limit=
     *
     * Subscription invoices/receipts.
     * Greenfield — returns empty until subscription billing is implemented.
     */
    fastify.get('/invoices', {
        preHandler: [fastify.validate({ querystring: InvoicesQuery })]
    }, async (request, reply) => {
        const { entityId } = request.query as { entityId: string };
        try {
            await fastify.verifyPartnerAccess(request, entityId);

            // Future: query invoices collection
            return { invoices: [] };
        } catch (error: any) {
            fastify.log.error(`Invoices failed for entityId=${entityId}: ${error.message}`);
            return reply.status(
                error.message.includes('Forbidden') || error.message.includes('Unauthorized') ? 403 : 500
            ).send({ error: 'Failed to load invoices' });
        }
    });
}
