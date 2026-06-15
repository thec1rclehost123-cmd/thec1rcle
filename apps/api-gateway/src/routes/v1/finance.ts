import { FastifyInstance } from 'fastify';
import type { Firestore } from 'firebase-admin/firestore';
import { getFinancialSummary, processRefund } from '@c1rcle/core/finance-engine';
import { z } from 'zod';
import { FinanceService } from '../../services/unified/finance-service.js';
import { buildPayoutAccountRecord } from '../../lib/partner-hardening.js';

// ── Existing schemas ──────────────────────────────────────────────────────────

const SummaryQuery = z
  .object({
    entityId: z.string().optional(),
    venueId: z.string().optional(),
    type: z.string(),
  })
  .passthrough();

const HistoryQuery = z
  .object({
    entityId: z.string().optional(),
    venueId: z.string().optional(),
    limit: z.string().optional(),
    state: z.string().optional(),
  })
  .passthrough();

const RefundBody = z
  .object({
    orderId: z.string(),
    amount: z.number().positive(),
    reason: z.string(),
  })
  .strict();

const PromoterIdParam = z
  .object({
    promoterId: z.string(),
  })
  .strict();

const PayoutBody = z
  .object({
    promoterId: z.string().optional(),
    amount: z.number().optional(),
  })
  .catchall(z.any());

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

const InvoicesQuery = z
  .object({
    entityId: z.string().optional(),
    venueId: z.string().optional(),
    limit: z.string().optional(),
  })
  .passthrough();

// ── Helpers ───────────────────────────────────────────────────────────────────

type UnifiedPartnerType = 'host' | 'venue' | 'promoter';

function normalizePartnerType(
  entityType?: string,
  fallback: UnifiedPartnerType = 'host',
): UnifiedPartnerType {
  const normalized = String(entityType || '').toLowerCase();
  if (normalized === 'promoter') return 'promoter';
  if (normalized === 'venue' || normalized === 'club') return 'venue';
  if (normalized === 'host') return 'host';
  return fallback;
}

function buildFinanceContext(
  request: any,
  partnerId: string,
  entityType?: string,
  fallback: UnifiedPartnerType = 'host',
) {
  const type = normalizePartnerType(entityType, fallback);
  return {
    partnerId,
    uid: String(request.user?.uid || partnerId),
    type,
    roles: [],
    venueIds: type === 'venue' ? [partnerId] : [],
    displayName: String(
      request.user?.displayName || request.user?.email || request.user?.uid || 'Partner',
    ),
  };
}

async function resolveOrderPartnerId(db: Firestore, orderId: string) {
  const orderDoc = await db.collection('orders').doc(orderId).get();
  if (!orderDoc.exists) {
    return { exists: false, partnerId: null as string | null };
  }

  const order = orderDoc.data() as Record<string, any>;
  const directPartnerId =
    order.partnerId || order.venueId || order.hostId || order.creatorId || null;
  if (directPartnerId) {
    return { exists: true, partnerId: String(directPartnerId) };
  }

  const eventId = order.eventId ? String(order.eventId) : '';
  if (!eventId) {
    return { exists: true, partnerId: null as string | null };
  }

  const eventDoc = await db.collection('events').doc(eventId).get();
  if (!eventDoc.exists) {
    return { exists: true, partnerId: null as string | null };
  }

  const event = eventDoc.data() as Record<string, any>;
  return {
    exists: true,
    partnerId: String(event.creatorId || event.hostId || event.venueId || ''),
  };
}

async function listPromoterPayoutRows(db: Firestore, promoterId: string, limit = 100) {
  const snap = await db
    .collection('payouts')
    .where('partnerId', '==', promoterId)
    .limit(Math.min(Math.max(limit, 1), 200))
    .get();

  return snap.docs
    .map((doc) => {
      const data = doc.data() as Record<string, any>;
      return {
        id: doc.id,
        amount: Number(data.amount) || 0,
        status: String(data.status || 'pending').toLowerCase(),
        paymentMethod: data.paymentMethod || data.method || 'bank_transfer',
        requestedAt: data.requestedAt || data.createdAt || data.timestamp || null,
        completedAt: data.completedAt || data.updatedAt || data.timestamp || null,
        paymentDetails: data.paymentDetails || null,
        bankName: data.bankName || null,
        last4: data.last4 || data.accountLast4 || null,
      };
    })
    .sort((left, right) => {
      const leftTime = new Date(left.requestedAt || left.completedAt || 0).getTime();
      const rightTime = new Date(right.requestedAt || right.completedAt || 0).getTime();
      return rightTime - leftTime;
    });
}

async function listPromoterCommissionDetails(db: Firestore, promoterId: string, limit = 50) {
  const financeService = new FinanceService(db);
  const ledger = await financeService.getLedger(
    {
      partnerId: promoterId,
      uid: promoterId,
      type: 'promoter',
      roles: [],
      venueIds: [],
      displayName: 'Promoter',
    },
    { type: 'promoter_commission', limit: Math.min(Math.max(limit, 1), 200) },
  );

  return ledger.data.map((entry) => ({
    id: entry.entryId,
    eventId: entry.eventId || null,
    eventName: null,
    buyerName: null,
    amount: Number(entry.amount) || 0,
    revenue: Number(entry.amount) || 0,
    status: String(entry.status || 'pending').toLowerCase(),
    date: entry.createdAt || null,
    source: 'partner_ledger',
  }));
}

async function buildPromoterFinancePayload(db: Firestore, promoterId: string) {
  const financeService = new FinanceService(db);
  const ctx = {
    partnerId: promoterId,
    uid: promoterId,
    type: 'promoter' as const,
    roles: [],
    venueIds: [],
    displayName: 'Promoter',
  };
  const [baseBalance, payouts, commissionDetails] = await Promise.all([
    financeService.getBalances(ctx),
    listPromoterPayoutRows(db, promoterId, 100),
    listPromoterCommissionDetails(db, promoterId, 100),
  ]);

  const totalPaid = payouts
    .filter((payout) => ['completed', 'paid', 'cleared'].includes(payout.status))
    .reduce((sum, payout) => sum + Math.abs(payout.amount), 0);

  return {
    balance: {
      totalEarned: (Number(baseBalance.available) || 0) + (Number(baseBalance.pending) || 0),
      available: Number(baseBalance.available) || 0,
      pending: Number(baseBalance.pending) || 0,
      totalPaid,
      instantAvailable: 0,
    },
    payouts,
    commissionDetails,
  };
}

export default async function financeRoutes(fastify: FastifyInstance) {
  const financeService = new FinanceService({
    db: fastify.db,
    log: fastify.log,
    redis: fastify.redis,
  });

  // ── Existing routes ───────────────────────────────────────────────────────

  /**
   * GET /api/v1/finance/summary
   */
  fastify.get(
    '/summary',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: SummaryQuery })],
    },
    async (request, reply) => {
      const { entityId, type } = request.query as { entityId: string; type: string };
      try {
        if (!entityId) return reply.status(400).send({ error: 'entityId required' });
        await fastify.verifyPartnerAccess(request, entityId);
        if (String(type).toLowerCase() === 'event') {
          return await getFinancialSummary(entityId, type);
        }

        const ctx = buildFinanceContext(
          request,
          entityId,
          type,
          normalizePartnerType(type, 'host'),
        );
        const summary = await financeService.getFinanceSummary(ctx);

        return {
          entityId,
          type,
          ...summary,
        };
      } catch (error: any) {
        fastify.log.error(`Finance summary failed for entityId=${entityId}: ${error.message}`);
        return reply
          .status(
            error.message.includes('Forbidden') || error.message.includes('Unauthorized')
              ? 403
              : 500,
          )
          .send({ error: 'Failed to load financial summary' });
      }
    },
  );

  /**
   * GET /api/v1/finance/history
   */
  fastify.get(
    '/history',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: HistoryQuery })],
    },
    async (request, reply) => {
      const { entityId, venueId, limit, state } = request.query as {
        entityId?: string;
        venueId?: string;
        limit?: string;
        state?: string;
      };
      const targetId = entityId || venueId;
      try {
        if (!targetId) return reply.status(400).send({ error: 'entityId or venueId required' });
        await fastify.verifyPartnerAccess(request, targetId);
        const ctx = buildFinanceContext(
          request,
          targetId,
          venueId ? 'venue' : undefined,
          venueId ? 'venue' : 'host',
        );
        const history = await financeService.getLedger(ctx, {
          limit: limit ? parseInt(limit) : 50,
        });
        return history.data
          .filter(
            (entry) =>
              !state || String(entry.status || '').toLowerCase() === String(state).toLowerCase(),
          )
          .map((entry) => ({
            id: entry.entryId,
            entityId: targetId,
            actorId: targetId,
            amount: entry.amount,
            currency: entry.currency,
            state: String(entry.status || '').toUpperCase(),
            timestamp: entry.createdAt,
            type: entry.type,
            referenceId: entry.referenceId,
            eventId: entry.eventId,
            source: 'partner_ledger',
          }));
      } catch (error: any) {
        fastify.log.error(`Finance history failed for entityId=${entityId}: ${error.message}`);
        reply.status(500).send({ error: 'Failed to load transaction history' });
      }
    },
  );

  /**
   * POST /api/v1/finance/refund
   */
  fastify.post(
    '/refund',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: RefundBody })],
    },
    async (request, reply) => {
      const { orderId, amount, reason } = request.body as {
        orderId: string;
        amount: number;
        reason: string;
      };
      try {
        const { exists, partnerId } = await resolveOrderPartnerId(fastify.db, orderId);
        if (!exists) return reply.status(404).send({ error: 'Order not found' });
        if (!partnerId) return reply.status(403).send({ error: 'Forbidden' });
        await fastify.verifyPartnerAccess(request, partnerId);
        const result = await processRefund(orderId, amount, reason, (request as any).user?.uid);
        return result;
      } catch (error: any) {
        fastify.log.error(`Refund failed for orderId=${orderId}: ${error.message}`);
        reply.status(400).send({ error: 'Failed to process refund' });
      }
    },
  );

  /**
   * GET /api/v1/finance/promoter/balance/:promoterId
   */
  fastify.get(
    '/promoter/balance/:promoterId',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ params: PromoterIdParam })],
    },
    async (request, reply) => {
      const { promoterId } = request.params as { promoterId: string };
      try {
        await fastify.verifyPartnerAccess(request, promoterId);
        const payload = await buildPromoterFinancePayload(fastify.db, promoterId);
        return payload.balance;
      } catch (error: any) {
        fastify.log.error(`Payout balance failed for promoterId=${promoterId}: ${error.message}`);
        reply.status(500).send({ error: 'Failed to load payout balance' });
      }
    },
  );

  /**
   * POST /api/v1/finance/promoter/payout
   */
  fastify.post(
    '/promoter/payout',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: PayoutBody })],
    },
    async (request, reply) => {
      const data = request.body as any;
      try {
        if (!data.promoterId) return reply.status(400).send({ error: 'promoterId required' });
        await fastify.verifyPartnerAccess(request, data.promoterId);
        const { requestPromoterPayout } = await import('@c1rcle/core/payout-engine');
        return await requestPromoterPayout(data);
      } catch (error: any) {
        fastify.log.error(`Payout request failed: ${error.message}`);
        reply.status(400).send({ error: 'Failed to request payout' });
      }
    },
  );

  /**
   * GET /api/v1/finance/promoter/payouts/:promoterId
   */
  fastify.get(
    '/promoter/payouts/:promoterId',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ params: PromoterIdParam })],
    },
    async (request, reply) => {
      const { promoterId } = request.params as { promoterId: string };
      try {
        await fastify.verifyPartnerAccess(request, promoterId);
        return { payouts: await listPromoterPayoutRows(fastify.db, promoterId, 100) };
      } catch (error: any) {
        fastify.log.error(`Payout list failed for promoterId=${promoterId}: ${error.message}`);
        reply.status(500).send({ error: 'Failed to load payouts' });
      }
    },
  );

  fastify.get(
    '/promoter/payouts',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { promoterId } = request.query as { promoterId?: string };
      try {
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        await fastify.verifyPartnerAccess(request, promoterId);
        const payload = await buildPromoterFinancePayload(fastify.db, promoterId);
        return { balance: payload.balance, payouts: payload.payouts };
      } catch (error: any) {
        fastify.log.error(`Promoter payouts failed for promoterId=${promoterId}: ${error.message}`);
        return reply
          .status(
            error.message.includes('Forbidden') || error.message.includes('Unauthorized')
              ? 403
              : 500,
          )
          .send({ error: 'Failed to load payouts' });
      }
    },
  );

  fastify.post(
    '/promoter/payouts',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: PayoutBody })],
    },
    async (request: any, reply) => {
      const data = request.body as any;
      try {
        if (!data.promoterId) return reply.status(400).send({ error: 'promoterId required' });
        await fastify.verifyPartnerAccess(request, data.promoterId);
        const { requestPromoterPayout } = await import('@c1rcle/core/payout-engine');
        return await requestPromoterPayout(data);
      } catch (error: any) {
        fastify.log.error(
          `Promoter payout request failed for promoterId=${data.promoterId}: ${error.message}`,
        );
        return reply.status(400).send({ error: error.message || 'Failed to request payout' });
      }
    },
  );

  fastify.delete(
    '/promoter/payouts',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { promoterId, payoutId } = request.query as { promoterId?: string; payoutId?: string };
      try {
        if (!promoterId || !payoutId)
          return reply.status(400).send({ error: 'promoterId and payoutId required' });
        await fastify.verifyPartnerAccess(request, promoterId);

        const ref = fastify.db.collection('payouts').doc(payoutId);
        const doc = await ref.get();
        if (!doc.exists) return reply.status(404).send({ error: 'Payout not found' });

        const payout = doc.data() as Record<string, any>;
        if (String(payout.partnerId || '') !== promoterId)
          return reply.status(403).send({ error: 'Forbidden' });
        if (!['pending', 'processing'].includes(String(payout.status || '').toLowerCase())) {
          return reply.status(409).send({ error: 'Only pending payouts can be cancelled' });
        }

        await ref.update({
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        return { success: true };
      } catch (error: any) {
        fastify.log.error(
          `Promoter payout cancel failed for payoutId=${payoutId}: ${error.message}`,
        );
        return reply
          .status(
            error.message.includes('Forbidden') || error.message.includes('Unauthorized')
              ? 403
              : 500,
          )
          .send({ error: 'Failed to cancel payout' });
      }
    },
  );

  fastify.get(
    '/promoter/finance/bank-accounts',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { promoterId } = request.query as { promoterId?: string };
      try {
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        await fastify.verifyPartnerAccess(request, promoterId);
        const snap = await fastify.db
          .collection('bank_accounts')
          .where('partnerId', '==', promoterId)
          .get();

        return {
          accounts: snap.docs.map((doc) => {
            const data = doc.data() as Record<string, any>;
            return {
              id: doc.id,
              bankName: data.bankName || 'Bank Account',
              last4: data.last4 || data.accountLast4 || '0000',
              isDefault: data.isDefault ?? false,
              paymentType: data.paymentType || 'bank_account',
            };
          }),
        };
      } catch (error: any) {
        fastify.log.error(
          `Promoter bank accounts failed for promoterId=${promoterId}: ${error.message}`,
        );
        return { accounts: [] };
      }
    },
  );

  fastify.post(
    '/promoter/finance/bank-accounts',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const body = request.body as Record<string, any>;
      const promoterId = String(body.promoterId || '');
      try {
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        await fastify.verifyPartnerAccess(request, promoterId);

        const account = buildPayoutAccountRecord(body, {
          partnerId: promoterId,
          ownerType: 'promoter',
        });
        const ref = await fastify.db.collection('bank_accounts').add(account.record);
        return reply.status(201).send(account.response(ref.id));
      } catch (error: any) {
        fastify.log.error(
          `Promoter bank account create failed for promoterId=${promoterId}: ${error.message}`,
        );
        return reply
          .status(
            error.message.includes('Forbidden') || error.message.includes('Unauthorized')
              ? 403
              : 500,
          )
          .send({ error: 'Failed to save payout method' });
      }
    },
  );

  fastify.delete(
    '/promoter/finance/bank-accounts',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const query = request.query as { promoterId?: string; accountId?: string };
      const body = (request.body || {}) as Record<string, any>;
      const promoterId = query.promoterId || String(body.promoterId || '');
      const accountId = query.accountId || String(body.accountId || '');
      try {
        if (!promoterId || !accountId)
          return reply.status(400).send({ error: 'promoterId and accountId required' });
        await fastify.verifyPartnerAccess(request, promoterId);

        const ref = fastify.db.collection('bank_accounts').doc(accountId);
        const doc = await ref.get();
        if (!doc.exists) return reply.status(404).send({ error: 'Account not found' });

        const account = doc.data() as Record<string, any>;
        if (String(account.partnerId || '') !== promoterId)
          return reply.status(403).send({ error: 'Forbidden' });

        await ref.delete();
        return { success: true };
      } catch (error: any) {
        fastify.log.error(
          `Promoter bank account delete failed for accountId=${accountId}: ${error.message}`,
        );
        return reply
          .status(
            error.message.includes('Forbidden') || error.message.includes('Unauthorized')
              ? 403
              : 500,
          )
          .send({ error: 'Failed to delete payout method' });
      }
    },
  );

  fastify.get(
    '/partner/promoter/finance',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { promoterId } = request.query as { promoterId?: string };
      try {
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        await fastify.verifyPartnerAccess(request, promoterId);
        return await buildPromoterFinancePayload(fastify.db, promoterId);
      } catch (error: any) {
        fastify.log.error(
          `Partner promoter finance failed for promoterId=${promoterId}: ${error.message}`,
        );
        return reply
          .status(
            error.message.includes('Forbidden') || error.message.includes('Unauthorized')
              ? 403
              : 500,
          )
          .send({ error: 'Failed to load promoter finance' });
      }
    },
  );

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
  fastify.get(
    '/venue/finance/overview',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: EntityQuery })],
    },
    async (request, reply) => {
      const { entityId, venueId, entityType } = request.query as any;
      const targetId = entityId || venueId;
      if (!targetId) return reply.status(400).send({ error: 'venueId or entityId required' });
      try {
        await fastify.verifyPartnerAccess(request, targetId);
        const ctx = buildFinanceContext(
          request,
          targetId,
          entityType || (venueId ? 'venue' : 'host'),
          venueId ? 'venue' : 'host',
        );
        const [balances, overview] = await Promise.all([
          financeService.getBalances(ctx),
          financeService.getOverview(ctx),
        ]);

        return {
          metrics: {
            availableBalance: Math.max(0, Number(balances.available) || 0),
            pendingPayouts: Math.max(0, Number(balances.pending) || 0),
            totalRevenue: Math.max(0, Number(overview.totalRevenue) || 0),
            currency: balances.currency || 'INR',
          },
        };
      } catch (error: any) {
        return reply.status(500).send({ error: 'Failed to load finance overview' });
      }
    },
  );

  fastify.get(
    '/wallet',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: EntityQuery })],
    },
    async (request, reply) => {
      const { entityId, venueId, entityType } = request.query as any;
      const targetId = entityId || venueId;
      if (!targetId) return reply.status(400).send({ error: 'venueId or entityId required' });
      try {
        await fastify.verifyPartnerAccess(request, targetId);
        const ctx = buildFinanceContext(
          request,
          targetId,
          entityType || (venueId ? 'venue' : 'host'),
          venueId ? 'venue' : 'host',
        );
        const balances = await financeService.getBalances(ctx);

        return {
          availablePaise: Math.max(0, Math.round((Number(balances.available) || 0) * 100)),
          pendingPaise: Math.max(0, Math.round((Number(balances.pending) || 0) * 100)),
          heldPaise: Math.max(0, Math.round((Number(balances.pending) || 0) * 100)),
          currency: balances.currency || 'INR',
        };
      } catch (error: any) {
        fastify.log.error(`Wallet balance failed for entityId=${entityId}: ${error.message}`);
        return reply
          .status(
            error.message.includes('Forbidden') || error.message.includes('Unauthorized')
              ? 403
              : 500,
          )
          .send({ error: 'Failed to load wallet balance' });
      }
    },
  );

  /**
   * GET /api/v1/finance/payout-balance?entityId=&entityType=
   *
   * How much a partner can withdraw right now vs. what is still settling.
   * withdrawablePaise       = PAYABLE entries (settled & allocated, ready for bank transfer)
   * pendingSettlementPaise  = HELD + SETTLED entries (event done but not yet allocated)
   */
  fastify.get(
    '/payout-balance',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: EntityQuery })],
    },
    async (request, reply) => {
      const { entityId, venueId, entityType } = request.query as any;
      const targetId = entityId || venueId;
      if (!targetId) return reply.status(400).send({ error: 'venueId or entityId required' });
      try {
        await fastify.verifyPartnerAccess(request, targetId);
        const ctx = buildFinanceContext(
          request,
          targetId,
          entityType || (venueId ? 'venue' : 'host'),
          venueId ? 'venue' : 'host',
        );
        const balances = await financeService.getBalances(ctx);

        return {
          withdrawablePaise: Math.max(0, Math.round((Number(balances.available) || 0) * 100)),
          pendingSettlementPaise: Math.max(0, Math.round((Number(balances.pending) || 0) * 100)),
          currency: balances.currency || 'INR',
        };
      } catch (error: any) {
        fastify.log.error(`Payout balance failed for entityId=${entityId}: ${error.message}`);
        return reply
          .status(
            error.message.includes('Forbidden') || error.message.includes('Unauthorized')
              ? 403
              : 500,
          )
          .send({ error: 'Failed to load payout balance' });
      }
    },
  );

  /**
   * GET /api/v1/venue/finance/payouts
   */
  fastify.get(
    '/venue/finance/payouts',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: PayoutHistoryQuery })],
    },
    async (request) => {
      const { entityId, limit: limitStr } = request.query as any;
      const limit = Math.min(parseInt(limitStr || '10'), 50);

      try {
        await fastify.verifyPartnerAccess(request, entityId);
        const snap = await fastify.db
          .collection('payouts')
          .where('partnerId', '==', entityId)
          .limit(limit + 1)
          .get();

        const payouts = snap.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            arrivalDate: d.timestamp,
            amount: d.amount,
            currency: d.currency || 'INR',
            status: d.status || 'paid',
            eventName: d.eventName || null,
            description: d.description || 'Event Revenue',
          };
        });

        payouts.sort((a: any, b: any) => {
          const dateA = new Date(a.arrivalDate || 0).getTime();
          const dateB = new Date(b.arrivalDate || 0).getTime();
          return dateB - dateA;
        });

        const hasMore = payouts.length > limit;
        const sliced = payouts.slice(0, limit);
        return { payouts: sliced, hasMore };
      } catch (error: any) {
        return { payouts: [], hasMore: false };
      }
    },
  );

  /**
   * GET /api/v1/finance/payout-history?entityId=&entityType=&limit=&cursor=
   *
   * Paginated payout request history for a venue/host/promoter.
   * Primary source: payout_requests collection (written by partner dashboard).
   * Fallback: payouts collection (written by payout-engine batch settlement).
   */
  fastify.get(
    '/payout-history',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: PayoutHistoryQuery })],
    },
    async (request, reply) => {
      const {
        entityId,
        limit: limitStr,
        cursor,
      } = request.query as {
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
        let q: FirebaseFirestore.Query = db
          .collection('payout_requests')
          .where('venueId', '==', entityId)
          .limit(limit + 1);

        // Cursor-based pagination
        if (cursor) {
          const cursorDoc = await db.collection('payout_requests').doc(cursor).get();
          if (cursorDoc.exists) {
            q = q.startAfter(cursorDoc);
          }
        }

        const snap = await q.get();
        let allDocs: any[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // In-memory sort
        allDocs.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        });

        const hasMore = allDocs.length > limit;
        const docs = allDocs.slice(0, limit);

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
          const fallbackSnap = await db
            .collection('payouts')
            .where('partnerId', '==', entityId)
            .limit(100)
            .get();

          const fallbackDocs = fallbackSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
        return reply
          .status(
            error.message.includes('Forbidden') || error.message.includes('Unauthorized')
              ? 403
              : 500,
          )
          .send({ error: 'Failed to load payout history' });
      }
    },
  );

  /**
   * GET /api/v1/finance/subscription?entityId=
   *
   * Monthly subscription plan for a venue.
   * Greenfield — no subscription collection exists yet.
   * Returns null until subscription billing is implemented.
   */
  fastify.get(
    '/subscription',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: EntityQuery })],
    },
    async (request, reply) => {
      const { entityId } = request.query as { entityId: string };
      try {
        await fastify.verifyPartnerAccess(request, entityId);

        return { subscription: null };
      } catch (error: any) {
        fastify.log.error(`Subscription fetch failed for entityId=${entityId}: ${error.message}`);
        return reply
          .status(
            error.message.includes('Forbidden') || error.message.includes('Unauthorized')
              ? 403
              : 500,
          )
          .send({ error: 'Failed to load subscription' });
      }
    },
  );

  /**
   * GET /api/v1/finance/billing-methods?entityId=
   *
   * Saved billing/autopay methods for subscription debit.
   * Greenfield — returns empty until billing is implemented.
   */
  fastify.get(
    '/billing-methods',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: EntityQuery })],
    },
    async (request, reply) => {
      const { entityId } = request.query as { entityId: string };
      try {
        await fastify.verifyPartnerAccess(request, entityId);

        // Future: query billing_methods collection
        return { methods: [] };
      } catch (error: any) {
        fastify.log.error(`Billing methods failed for entityId=${entityId}: ${error.message}`);
        return reply
          .status(
            error.message.includes('Forbidden') || error.message.includes('Unauthorized')
              ? 403
              : 500,
          )
          .send({ error: 'Failed to load billing methods' });
      }
    },
  );

  /**
   * GET /api/v1/finance/invoices?entityId=&limit=
   *
   * Subscription invoices/receipts.
   * Greenfield — returns empty until subscription billing is implemented.
   */
  fastify.get(
    '/invoices',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: InvoicesQuery })],
    },
    async (request, reply) => {
      const { entityId } = request.query as { entityId: string };
      try {
        await fastify.verifyPartnerAccess(request, entityId);

        // Future: query invoices collection
        return { invoices: [] };
      } catch (error: any) {
        fastify.log.error(`Invoices failed for entityId=${entityId}: ${error.message}`);
        return reply
          .status(
            error.message.includes('Forbidden') || error.message.includes('Unauthorized')
              ? 403
              : 500,
          )
          .send({ error: 'Failed to load invoices' });
      }
    },
  );

  /**
   * GET /api/v1/venue/finance/bank-accounts
   */
  fastify.get(
    '/venue/finance/bank-accounts',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: EntityQuery })],
    },
    async (request, reply) => {
      const { entityId, venueId, entityType } = request.query as any;
      const targetId = entityId || venueId;
      if (!targetId) return reply.status(400).send({ error: 'venueId or entityId required' });
      try {
        await fastify.verifyPartnerAccess(request, targetId);
        const ctx = buildFinanceContext(
          request,
          targetId,
          entityType || (venueId ? 'venue' : 'host'),
          venueId ? 'venue' : 'host',
        );
        const accounts = await financeService.getBankAccounts(ctx);

        return {
          accounts: accounts.map((account) => ({
            id: account.accountId,
            bankName: account.bankName,
            last4: account.last4,
            isDefault: account.isDefault,
            paymentType: account.paymentType,
          })),
        };
      } catch (error: any) {
        return { accounts: [] };
      }
    },
  );

  /**
   * GET /api/v1/venue/finance/disputes
   */
  fastify.get(
    '/venue/finance/disputes',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: EntityQuery })],
    },
    async (request) => {
      const { entityId, entityType } = request.query as any;
      try {
        await fastify.verifyPartnerAccess(request, entityId);
        const ctx = buildFinanceContext(request, entityId, entityType, 'venue');
        const disputeResult = await financeService.getDisputes(ctx);

        return {
          disputes: disputeResult.data.map((dispute) => ({
            id: dispute.disputeId,
            orderId: dispute.orderId,
            amount: dispute.amount,
            status: dispute.status,
            reason: dispute.reason,
            createdAt: dispute.createdAt,
          })),
        };
      } catch (error: any) {
        return { disputes: [] };
      }
    },
  );

  fastify.get(
    '/finance/payout-config',
    {
      preHandler: [fastify.requireAuth],
    },
    async (_request, _reply) => {
      return {
        instantFeeRate: 0.03, // 3% fee for same-day payout
        standardFeeRate: 0, // no fee for 2-3 business day payout
        currency: 'INR',
      };
    },
  );

  fastify.get(
    '/venue/finance/ledger',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const { venueId, limit: limitStr = '50' } = request.query as any;
      if (!venueId) return reply.status(400).send({ error: 'venueId required' });
      await fastify.verifyPartnerAccess(request, venueId).catch(() => {
        throw reply.status(403).send({ error: 'Forbidden' });
      });

      const result = await financeService.getLedger(
        buildFinanceContext(request, venueId, 'venue', 'venue'),
        { limit: Math.min(parseInt(limitStr), 100) },
      );

      return {
        ledger: result.data.map((entry) => ({
          id: entry.entryId,
          eventId: entry.eventId,
          amount: entry.amount,
          currency: entry.currency,
          state: String(entry.status || '').toUpperCase(),
          type: entry.type,
          timestamp: entry.createdAt,
          referenceId: entry.referenceId,
          source: 'partner_ledger',
        })),
      };
    },
  );

  fastify.get(
    '/venue/finance/host-payouts',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: EntityQuery })],
    },
    async (request, reply) => {
      const { entityId, venueId } = request.query as any;
      const targetId = entityId || venueId;
      if (!targetId) return reply.status(400).send({ error: 'venueId or entityId required' });
      try {
        await fastify.verifyPartnerAccess(request, targetId);
        return {
          totalOwedPaise: 0,
          totalHeldPaise: 0,
          pendingSettlements: [],
          historySettlements: [],
        };
      } catch (error: any) {
        return { pendingSettlements: [], historySettlements: [] };
      }
    },
  );

  fastify.get(
    '/venue/finance/promoter-payouts',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: EntityQuery })],
    },
    async (request, reply) => {
      const { entityId, venueId } = request.query as any;
      const targetId = entityId || venueId;
      if (!targetId) return reply.status(400).send({ error: 'venueId or entityId required' });
      try {
        await fastify.verifyPartnerAccess(request, targetId);
        return {
          totalOwedPaise: 0,
          totalHeldPaise: 0,
          pendingSettlements: [],
          historySettlements: [],
        };
      } catch (error: any) {
        return { pendingSettlements: [], historySettlements: [] };
      }
    },
  );
}
