import { FastifyInstance } from 'fastify';
import type { Firestore } from 'firebase-admin/firestore';
import { getFinancialSummary, getTransactionHistory, processRefund } from '@c1rcle/core/finance-engine';
// @ts-ignore — JS module, no type declarations
import { MONEY_STATES } from '@c1rcle/core/ledger-engine';
import { z } from 'zod';

// ── Existing schemas ──────────────────────────────────────────────────────────

const SummaryQuery = z.object({
    entityId: z.string().optional(),
    venueId: z.string().optional(),
    type: z.string()
}).passthrough();

const HistoryQuery = z.object({
    entityId: z.string().optional(),
    venueId: z.string().optional(),
    limit: z.string().optional(),
    state: z.string().optional()
}).passthrough();

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
    entityId: z.string().optional(),
    venueId: z.string().optional(),
    entityType: z.string().optional(),
});

const PayoutHistoryQuery = z.object({
    entityId: z.string().optional(),
    venueId: z.string().optional(),
    entityType: z.string().optional(),
    limit: z.string().optional(),
    cursor: z.string().optional(),
});

const InvoicesQuery = z.object({
    entityId: z.string().optional(),
    venueId: z.string().optional(),
    limit: z.string().optional(),
}).passthrough();

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
    /**
     * GET /api/v1/venue/finance/overview
     * High-level metrics for the finance dashboard
     */
    fastify.get('/venue/finance/overview', {
        preHandler: [fastify.requireAuth, fastify.validate({ querystring: EntityQuery })]
    }, async (request, reply) => {
        const { entityId, venueId } = request.query as any;
        const targetId = entityId || venueId;
        if (!targetId) return reply.status(400).send({ error: 'venueId or entityId required' });
        try {
            await fastify.verifyPartnerAccess(request, targetId);

            // Fetch ledger sums
            const [payable, held, settled] = await Promise.all([
                sumLedger(fastify.db, entityId, [MONEY_STATES.PAYABLE]),
                sumLedger(fastify.db, entityId, [MONEY_STATES.HELD]),
                sumLedger(fastify.db, entityId, [MONEY_STATES.SETTLED]),
            ]);

            return {
                metrics: {
                    availableBalance: Math.max(0, payable),
                    pendingPayouts: Math.max(0, held + settled),
                    totalRevenue: Math.max(0, payable + held + settled),
                    currency: 'INR'
                }
            };
        } catch (error: any) {
            return reply.status(500).send({ error: 'Failed to load finance overview' });
        }
    });

    fastify.get('/wallet', {
        preHandler: [fastify.validate({ querystring: EntityQuery })]
    }, async (request, reply) => {
        const { entityId, venueId } = request.query as any;
        const targetId = entityId || venueId;
        if (!targetId) return reply.status(400).send({ error: 'venueId or entityId required' });
        try {
            await fastify.verifyPartnerAccess(request, targetId);

            const [payable, held, settled] = await Promise.all([
                sumLedger(fastify.db, targetId, [MONEY_STATES.PAYABLE]),
                sumLedger(fastify.db, targetId, [MONEY_STATES.HELD]),
                sumLedger(fastify.db, targetId, [MONEY_STATES.SETTLED]),
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
        const { entityId, venueId } = request.query as any;
        const targetId = entityId || venueId;
        if (!targetId) return reply.status(400).send({ error: 'venueId or entityId required' });
        try {
            await fastify.verifyPartnerAccess(request, targetId);

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
     * GET /api/v1/venue/finance/payouts
     */
    fastify.get('/venue/finance/payouts', {
        preHandler: [fastify.requireAuth, fastify.validate({ querystring: PayoutHistoryQuery })]
    }, async (request, reply) => {
        const { entityId, limit: limitStr } = request.query as any;
        const limit = Math.min(parseInt(limitStr || '10'), 50);

        try {
            await fastify.verifyPartnerAccess(request, entityId);
            const snap = await fastify.db.collection('payouts')
                .where('partnerId', '==', entityId)
                .limit(100)
                .get();

            const payouts = snap.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    arrivalDate: d.timestamp,
                    amount: d.amount,
                    currency: d.currency || 'INR',
                    status: d.status || 'paid',
                    eventName: d.eventName || null,
                    description: d.description || 'Event Revenue'
                };
            });

            payouts.sort((a: any, b: any) => {
                const dateA = new Date(a.arrivalDate || 0).getTime();
                const dateB = new Date(b.arrivalDate || 0).getTime();
                return dateB - dateA;
            });

            const sliced = payouts.slice(0, limit);
            return { payouts: sliced, hasMore: payouts.length >= limit };
        } catch (error: any) {
            return { payouts: [], hasMore: false };
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
                .limit(200);

            // Cursor-based pagination
            if (cursor) {
                const cursorDoc = await db.collection('payout_requests').doc(cursor).get();
                if (cursorDoc.exists) {
                    q = q.startAfter(cursorDoc);
                }
            }

            const snap = await q.get();
            let allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // In-memory sort
            allDocs.sort((a, b) => {
                const dateA = new Date(a.createdAt || 0).getTime();
                const dateB = new Date(b.createdAt || 0).getTime();
                return dateB - dateA;
            });

            const docs = allDocs.slice(0, limit);
            const hasMore = allDocs.length > limit;

            const history = docs.map((d: any) => {
                return {
                    id: d.id,
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
                    .limit(100)
                    .get();

                const fallbackDocs = fallbackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                fallbackDocs.sort((a: any, b: any) => {
                    const dateA = new Date(a.timestamp || 0).getTime();
                    const dateB = new Date(b.timestamp || 0).getTime();
                    return dateB - dateA;
                });

                const fallbackHistory = fallbackDocs.slice(0, limit).map((d: any) => {
                    return {
                        id: d.id,
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

    /**
     * GET /api/v1/venue/finance/bank-accounts
     */
    fastify.get('/venue/finance/bank-accounts', {
        preHandler: [fastify.requireAuth, fastify.validate({ querystring: EntityQuery })]
    }, async (request, reply) => {
        const { entityId, venueId } = request.query as any;
        const targetId = entityId || venueId;
        if (!targetId) return reply.status(400).send({ error: 'venueId or entityId required' });
        try {
            await fastify.verifyPartnerAccess(request, targetId);
            const snap = await fastify.db.collection('bank_accounts')
                .where('partnerId', '==', targetId)
                .get();

            return {
                accounts: snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            };
        } catch (error: any) {
            return { accounts: [] };
        }
    });

    /**
     * GET /api/v1/venue/finance/disputes
     */
    fastify.get('/venue/finance/disputes', {
        preHandler: [fastify.requireAuth, fastify.validate({ querystring: EntityQuery })]
    }, async (request, reply) => {
        const { entityId } = request.query as any;
        try {
            await fastify.verifyPartnerAccess(request, entityId);
            const snap = await fastify.db.collection('disputes')
                .where('partnerId', '==', entityId)
                .limit(100)
                .get();

            const disputes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            disputes.sort((a: any, b: any) => {
                const dateA = new Date(a.createdAt || 0).getTime();
                const dateB = new Date(b.createdAt || 0).getTime();
                return dateB - dateA;
            });

            return {
                disputes: disputes.slice(0, 50)
            };
        } catch (error: any) {
            return { disputes: [] };
        }
    });

    fastify.get('/finance/payout-config', {
        preHandler: [fastify.requireAuth]
    }, async (_request, _reply) => {
        return {
            instantFeeRate: 0.03,   // 3% fee for same-day payout
            standardFeeRate: 0,     // no fee for 2-3 business day payout
            currency: 'INR',
        };
    });

    fastify.get('/venue/finance/ledger', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { venueId, limit: limitStr = '50' } = request.query as any;
        if (!venueId) return reply.status(400).send({ error: 'venueId required' });
        await fastify.verifyPartnerAccess(request, venueId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        
        const limit = Math.min(parseInt(limitStr), 100);
        const snap = await fastify.db.collection('ledger_entries')
            .where('actorId', '==', venueId)
            .limit(limit)
            .get();
        
        const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // In-memory sort by timestamp desc
        entries.sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        
        return { ledger: entries };
    });

    fastify.get('/venue/finance/host-payouts', {
        preHandler: [fastify.requireAuth, fastify.validate({ querystring: EntityQuery })]
    }, async (request, reply) => {
        const { entityId, venueId } = request.query as any;
        const targetId = entityId || venueId;
        if (!targetId) return reply.status(400).send({ error: 'venueId or entityId required' });
        try {
            await fastify.verifyPartnerAccess(request, targetId);
            return {
                totalOwedPaise: 0,
                totalHeldPaise: 0,
                pendingSettlements: [],
                historySettlements: []
            };
        } catch (error: any) {
            return { pendingSettlements: [], historySettlements: [] };
        }
    });

    fastify.get('/venue/finance/promoter-payouts', {
        preHandler: [fastify.requireAuth, fastify.validate({ querystring: EntityQuery })]
    }, async (request, reply) => {
        const { entityId, venueId } = request.query as any;
        const targetId = entityId || venueId;
        if (!targetId) return reply.status(400).send({ error: 'venueId or entityId required' });
        try {
            await fastify.verifyPartnerAccess(request, targetId);
            return {
                totalOwedPaise: 0,
                totalHeldPaise: 0,
                pendingSettlements: [],
                historySettlements: []
            };
        } catch (error: any) {
            return { pendingSettlements: [], historySettlements: [] };
        }
    });
}
