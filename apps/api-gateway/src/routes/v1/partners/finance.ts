import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { resolvePartnerContext } from '../../../lib/partner-context.js';
import { FinanceService } from '../../../services/unified/finance-service.js';
import { buildErrorResponse } from '../../../lib/api-contracts.js';
import { buildPayoutAccountRecord } from '../../../lib/partner-hardening.js';

const LedgerQuerySchema = z
  .object({
    from: z.string().optional(),
    to: z.string().optional(),
    type: z
      .enum([
        'ticket_revenue',
        'platform_fee',
        'venue_share',
        'host_payout',
        'promoter_commission',
        'refund',
        'dispute_hold',
        'dispute_release',
      ])
      .optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

const PayoutsQuerySchema = z
  .object({
    status: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

const DisputesQuerySchema = z
  .object({
    status: z.string().optional(),
  })
  .strict();

const BankAccountSchema = z.object({
  accountNumber: z.string(),
  ifscCode: z.string(),
  bankName: z.string(),
  accountHolderName: z.string(),
  isDefault: z.boolean().optional(),
});

export default async function partnersFinanceRoutes(fastify: FastifyInstance) {
  const financeService = new FinanceService({
    db: fastify.db,
    log: fastify.log,
    redis: fastify.redis,
  });

  const resolveFinanceContext = async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) {
      reply.status(403).send(
        buildErrorResponse({
          code: 'FORBIDDEN',
          message: 'No partner identity found',
          requestId: request.id,
        }),
      );
      return null;
    }
    return ctx;
  };

  const toNumber = (value: any) => {
    const amount = Number(value ?? 0);
    return Number.isFinite(amount) ? amount : 0;
  };

  const asArray = <T = Record<string, any>>(value: unknown): T[] =>
    Array.isArray(value) ? (value as T[]) : [];
  const asRecord = (value: unknown): Record<string, any> =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, any>)
      : {};

  const mapPayout = (payout: Record<string, any>) => ({
    id: payout.payoutId || payout.id,
    amount: toNumber(payout.amount),
    status: String(payout.status || 'pending').toLowerCase(),
    paymentMethod: payout.paymentMethod ?? null,
    requestedAt: payout.requestedAt ?? payout.createdAt ?? null,
    completedAt: payout.completedAt ?? payout.settledAt ?? null,
    currency: payout.currency || 'INR',
  });

  const mapAccount = (account: Record<string, any>) => ({
    id: account.accountId || account.id,
    bankName: account.bankName || 'Bank Account',
    last4: account.last4 || '0000',
    isDefault: Boolean(account.isDefault),
    paymentType: account.paymentType || 'bank_account',
  });

  const resolveOrderPartnerId = async (orderId: string) => {
    const orderDoc = await fastify.db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) return { exists: false, partnerId: null as string | null };
    const order = orderDoc.data() as Record<string, any>;
    const directPartnerId =
      order.partnerId || order.venueId || order.hostId || order.creatorId || null;
    if (directPartnerId) return { exists: true, partnerId: String(directPartnerId) };
    const eventId = order.eventId ? String(order.eventId) : '';
    if (!eventId) return { exists: true, partnerId: null as string | null };
    const eventDoc = await fastify.db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) return { exists: true, partnerId: null as string | null };
    const event = eventDoc.data() as Record<string, any>;
    return {
      exists: true,
      partnerId: String(event.creatorId || event.hostId || event.venueId || '') || null,
    };
  };

  const buildPromoterFinancePayload = async (partnerId: string) => {
    const promoterCtx = {
      partnerId,
      uid: partnerId,
      type: 'promoter' as const,
      roles: [],
      venueIds: [],
      displayName: 'Promoter',
    };
    const [balances, payoutsResult, ledgerResult] = await Promise.all([
      financeService.getBalances(promoterCtx),
      financeService.getPayouts(promoterCtx, { limit: 100 }),
      financeService.getLedger(promoterCtx, { type: 'promoter_commission', limit: 100 }),
    ]);
    const payouts = asArray(payoutsResult.data).map((item: Record<string, any>) => mapPayout(item));
    const totalPaid = payouts
      .filter((payout) =>
        ['completed', 'paid', 'cleared'].includes(String(payout.status || '').toLowerCase()),
      )
      .reduce((sum, payout) => sum + toNumber(payout.amount), 0);
    const commissionDetails = asArray(ledgerResult.data).map((entry: Record<string, any>) => ({
      id: entry.entryId,
      eventId: entry.eventId || null,
      eventName: null,
      buyerName: null,
      amount: toNumber(entry.amount),
      revenue: toNumber(entry.amount),
      status: String(entry.status || 'pending').toLowerCase(),
      date: entry.createdAt || null,
      source: 'partner_ledger',
    }));
    return {
      balance: {
        totalEarned: toNumber(balances.available) + toNumber(balances.pending),
        available: toNumber(balances.available),
        pending: toNumber(balances.pending),
        totalPaid,
        instantAvailable: 0,
      },
      payouts,
      commissionDetails,
    };
  };

  const createBankAccount = async (partnerId: string, body: Record<string, any>) => {
    if (body.isDefault) {
      const existing = await fastify.db
        .collection('bank_accounts')
        .where('partnerId', '==', partnerId)
        .where('isDefault', '==', true)
        .limit(10)
        .get()
        .catch(() => null);
      if (existing && !existing.empty) {
        const batch = fastify.db.batch();
        for (const doc of existing.docs) batch.update(doc.ref, { isDefault: false });
        await batch.commit();
      }
    }

    const account = buildPayoutAccountRecord(body, { partnerId, ownerType: 'promoter' });
    const ref = await fastify.db.collection('bank_accounts').add(account.record);
    return account.response(ref.id);
  };

  const deleteBankAccount = async (partnerId: string, accountId: string) => {
    if (!accountId) {
      const err: any = new Error('accountId required');
      err.statusCode = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }
    const ref = fastify.db.collection('bank_accounts').doc(accountId);
    const doc = await ref.get();
    if (!doc.exists) {
      const err: any = new Error('Account not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    const account = doc.data() as Record<string, any>;
    if (String(account.partnerId || '') !== partnerId) {
      const err: any = new Error('Forbidden');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
    await ref.delete();
    return { success: true };
  };

  // ── Overview ───────────────────────────────────────────────────────────────

  fastify.get(
    '/partners/finance/overview',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      const ctx = await resolvePartnerContext(fastify.db, request);
      if (!ctx)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'No partner identity found',
            requestId: request.id,
          }),
        );

      try {
        const cacheKey = `partners:finance:overview:${ctx.partnerId}`;
        const cached = await fastify.cache.get('partners', cacheKey);
        if (cached)
          return reply
            .header('Cache-Control', 'private, max-age=120')
            .send({ ...cached, fromCache: true });

        const overview = await financeService.getOverview(ctx);
        await fastify.cache.set('partners', cacheKey, overview, 120);
        return reply.header('Cache-Control', 'private, max-age=120').send(overview);
      } catch (err: any) {
        fastify.log.error(
          { err: err.message, partnerId: ctx.partnerId },
          'partners/finance/overview error',
        );
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  // ── Ledger ─────────────────────────────────────────────────────────────────

  fastify.get(
    '/partners/finance/ledger',
    {
      preHandler: [fastify.validate({ querystring: LedgerQuerySchema }), fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      const ctx = await resolvePartnerContext(fastify.db, request);
      if (!ctx)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'No partner identity found',
            requestId: request.id,
          }),
        );

      try {
        const result = await financeService.getLedger(ctx, request.query);
        return reply.header('Cache-Control', 'private, max-age=60').send(result);
      } catch (err: any) {
        fastify.log.error({ err: err.message }, 'partners/finance/ledger error');
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  // ── Payouts ────────────────────────────────────────────────────────────────

  fastify.get(
    '/partners/finance/payouts',
    {
      preHandler: [fastify.validate({ querystring: PayoutsQuerySchema }), fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      const ctx = await resolvePartnerContext(fastify.db, request);
      if (!ctx)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'No partner identity found',
            requestId: request.id,
          }),
        );

      try {
        const result = await financeService.getPayouts(ctx, request.query);
        return reply.header('Cache-Control', 'private, max-age=60').send(result);
      } catch (err: any) {
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  // ── Balances ───────────────────────────────────────────────────────────────

  fastify.get(
    '/partners/finance/balances',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      const ctx = await resolvePartnerContext(fastify.db, request);
      if (!ctx)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'No partner identity found',
            requestId: request.id,
          }),
        );

      try {
        const balances = await financeService.getBalances(ctx);
        return reply.header('Cache-Control', 'private, max-age=60').send(balances);
      } catch (err: any) {
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  // ── Bank Accounts ──────────────────────────────────────────────────────────

  fastify.get(
    '/partners/finance/bank-accounts',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      const ctx = await resolvePartnerContext(fastify.db, request);
      if (!ctx)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'No partner identity found',
            requestId: request.id,
          }),
        );

      try {
        const accounts = await financeService.getBankAccounts(ctx);
        return reply.header('Cache-Control', 'private, max-age=300').send({ accounts });
      } catch (err: any) {
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.post(
    '/partners/finance/bank-accounts',
    {
      preHandler: [fastify.validate({ body: BankAccountSchema }), fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      const ctx = await resolvePartnerContext(fastify.db, request);
      if (!ctx)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'No partner identity found',
            requestId: request.id,
          }),
        );

      try {
        if (request.body.isDefault) {
          const existing = await fastify.db
            .collection('bank_accounts')
            .where('partnerId', '==', ctx.partnerId)
            .where('isDefault', '==', true)
            .limit(10)
            .get()
            .catch(() => null);

          if (existing && !existing.empty) {
            const batch = fastify.db.batch();
            for (const doc of existing.docs) batch.update(doc.ref, { isDefault: false });
            await batch.commit();
          }
        }

        const account = buildPayoutAccountRecord(request.body, {
          partnerId: ctx.partnerId,
          ownerType: ctx.type,
        });
        const ref = await fastify.db.collection('bank_accounts').add(account.record);
        return reply.status(201).send({
          account: {
            accountId: ref.id,
            last4: account.last4,
            bankName: account.bankName,
            isDefault: account.isDefault,
            paymentType: account.paymentType,
          },
        });
      } catch (err: any) {
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  fastify.delete(
    '/partners/finance/bank-accounts',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      const ctx = await resolvePartnerContext(fastify.db, request);
      if (!ctx)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'No partner identity found',
            requestId: request.id,
          }),
        );

      try {
        const query = asRecord(request.query);
        const body = asRecord(request.body);
        return reply.send(
          await deleteBankAccount(ctx.partnerId, String(query.accountId || body.accountId || '')),
        );
      } catch (err: any) {
        if (err.statusCode)
          return reply.status(err.statusCode).send(
            buildErrorResponse({
              code: err.code || 'ERROR',
              message: err.message,
              requestId: request.id,
            }),
          );
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  // ── Disputes ───────────────────────────────────────────────────────────────

  fastify.get(
    '/partners/finance/disputes',
    {
      preHandler: [fastify.validate({ querystring: DisputesQuerySchema }), fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      const ctx = await resolvePartnerContext(fastify.db, request);
      if (!ctx)
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'No partner identity found',
            requestId: request.id,
          }),
        );

      try {
        const result = await financeService.getDisputes(ctx, request.query.status);
        return reply.header('Cache-Control', 'private, max-age=60').send(result);
      } catch (err: any) {
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  );

  // ── Native parity dispatch ────────────────────────────────────────────────

  fastify.route({
    method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    url: '/partners/finance/*',
    preHandler: [fastify.requireAuth],
    handler: async (request: any, reply: any) => {
      const ctx = await resolveFinanceContext(request, reply);
      if (!ctx) return;

      const rest = String(request.params?.['*'] || '').replace(/^\/+/, '');
      if (!rest) {
        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Partner finance endpoint not found',
            requestId: request.id,
          }),
        );
      }

      const query = asRecord(request.query);
      const body = asRecord(request.body);

      if (rest === 'summary' && request.method === 'GET') {
        const [overview, balances] = await Promise.all([
          financeService.getOverview(ctx),
          financeService.getBalances(ctx),
        ]);
        return reply.send({
          entityId: ctx.partnerId,
          type: ctx.type,
          netRevenue: overview.totalRevenue,
          availableBalance: balances.available,
          pendingBalance: balances.pending,
          paidOut: 0,
          refundPending: 0,
          currency: balances.currency,
        });
      }

      if (rest === 'history' && request.method === 'GET') {
        const limit = parseInt(String(query.limit || '50'), 10) || 50;
        const history = await financeService.getLedger(ctx, { limit });
        const filtered = asArray(history.data).filter((entry: Record<string, any>) => {
          if (!query.state) return true;
          return String(entry.status || '').toLowerCase() === String(query.state).toLowerCase();
        });
        return reply.send(
          filtered.map((entry: Record<string, any>) => ({
            id: entry.entryId,
            entityId: ctx.partnerId,
            actorId: ctx.partnerId,
            amount: entry.amount,
            currency: entry.currency,
            state: String(entry.status || '').toUpperCase(),
            timestamp: entry.createdAt,
            type: entry.type,
            referenceId: entry.referenceId,
            eventId: entry.eventId,
            source: 'partner_ledger',
          })),
        );
      }

      if (rest === 'refund' && request.method === 'POST') {
        const orderId = String(body.orderId || '');
        const amount = Number(body.amount);
        const reason = String(body.reason || '');
        if (!orderId || !amount || !reason) {
          return reply.status(400).send(
            buildErrorResponse({
              code: 'BAD_REQUEST',
              message: 'orderId, amount, and reason are required',
              requestId: request.id,
            }),
          );
        }
        const { exists, partnerId } = await resolveOrderPartnerId(orderId);
        if (!exists)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Order not found',
              requestId: request.id,
            }),
          );
        if (!partnerId || partnerId !== ctx.partnerId)
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Forbidden',
              requestId: request.id,
            }),
          );
        return reply.status(503).send(
          buildErrorResponse({
            code: 'LEGACY_REFUND_ROUTE_DISABLED',
            message:
              'This legacy refund route is disabled. Use POST /api/v1/refunds/request with amountPaise.',
            requestId: request.id,
          }),
        );
      }

      if (rest === 'wallet' && request.method === 'GET') {
        const balances = await financeService.getBalances(ctx);
        return reply.send({
          availablePaise: Math.max(0, balances.availablePaise),
          pendingPaise: Math.max(0, balances.pendingPaise),
          heldPaise: Math.max(0, balances.pendingPaise),
          currency: balances.currency || 'INR',
        });
      }

      if (rest === 'payout-balance' && request.method === 'GET') {
        const balances = await financeService.getBalances(ctx);
        return reply.send({
          withdrawablePaise: Math.max(0, balances.availablePaise),
          pendingSettlementPaise: Math.max(0, balances.pendingPaise),
          currency: balances.currency || 'INR',
        });
      }

      if (rest === 'subscription' && request.method === 'GET')
        return reply.send({ subscription: null });
      if (rest === 'billing-methods' && request.method === 'GET')
        return reply.send({ methods: [] });
      if (rest === 'invoices' && request.method === 'GET') return reply.send({ invoices: [] });
      if (rest === 'payout-config' && request.method === 'GET') {
        return reply.send({ instantFeeRate: 0.03, standardFeeRate: 0, currency: 'INR' });
      }

      if (rest === 'promoter/balance' && request.method === 'GET') {
        if (ctx.type !== 'promoter')
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Forbidden',
              requestId: request.id,
            }),
          );
        const payload = await buildPromoterFinancePayload(ctx.partnerId);
        return reply.send(payload.balance);
      }

      if (rest === 'promoter/payout' && request.method === 'POST') {
        if (ctx.type !== 'promoter')
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Forbidden',
              requestId: request.id,
            }),
          );
        return reply.status(503).send(
          buildErrorResponse({
            code: 'PAYOUTS_NOT_LAUNCH_ENABLED',
            message: 'Payout withdrawals are unavailable during launch verification',
            requestId: request.id,
          }),
        );
      }

      if (rest === 'promoter/payouts' && request.method === 'GET') {
        if (ctx.type !== 'promoter')
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Forbidden',
              requestId: request.id,
            }),
          );
        return reply.send(await buildPromoterFinancePayload(ctx.partnerId));
      }

      if (rest === 'promoter/payouts' && request.method === 'POST') {
        if (ctx.type !== 'promoter')
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Forbidden',
              requestId: request.id,
            }),
          );
        return reply.status(503).send(
          buildErrorResponse({
            code: 'PAYOUTS_NOT_LAUNCH_ENABLED',
            message: 'Payout withdrawals are unavailable during launch verification',
            requestId: request.id,
          }),
        );
      }

      if (rest === 'promoter/payouts' && request.method === 'DELETE') {
        if (ctx.type !== 'promoter')
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Forbidden',
              requestId: request.id,
            }),
          );
        return reply.status(503).send(
          buildErrorResponse({
            code: 'PAYOUTS_NOT_LAUNCH_ENABLED',
            message: 'Payout withdrawals are unavailable during launch verification',
            requestId: request.id,
          }),
        );
      }

      if (rest === 'promoter/bank-accounts' && request.method === 'GET') {
        if (ctx.type !== 'promoter')
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Forbidden',
              requestId: request.id,
            }),
          );
        const accounts = await financeService.getBankAccounts(ctx);
        return reply.send({ accounts: accounts.map((account) => mapAccount(account as any)) });
      }

      if (rest === 'promoter/bank-accounts' && request.method === 'POST') {
        if (ctx.type !== 'promoter')
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Forbidden',
              requestId: request.id,
            }),
          );
        return reply.status(201).send(await createBankAccount(ctx.partnerId, body));
      }

      if (rest === 'promoter/bank-accounts' && request.method === 'DELETE') {
        if (ctx.type !== 'promoter')
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Forbidden',
              requestId: request.id,
            }),
          );
        return reply.send(
          await deleteBankAccount(ctx.partnerId, String(query.accountId || body.accountId || '')),
        );
      }

      if (rest === 'promoter/finance' && request.method === 'GET') {
        if (ctx.type !== 'promoter')
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Forbidden',
              requestId: request.id,
            }),
          );
        return reply.send(await buildPromoterFinancePayload(ctx.partnerId));
      }

      if (rest === 'venue/overview' && request.method === 'GET') {
        const [balances, overview] = await Promise.all([
          financeService.getBalances(ctx),
          financeService.getOverview(ctx),
        ]);
        return reply.send({
          metrics: {
            availableBalance: Math.max(0, toNumber(balances.available)),
            pendingPayouts: Math.max(0, toNumber(balances.pending)),
            totalRevenue: Math.max(0, toNumber(overview.totalRevenue)),
            currency: balances.currency || 'INR',
          },
        });
      }

      if (rest === 'venue/payouts' && request.method === 'GET') {
        const payouts = await financeService.getPayouts(ctx, {
          limit: Math.min(parseInt(String(query.limit || '10'), 10) || 10, 50),
        });
        const items = asArray(payouts.data).map((payout: Record<string, any>) => ({
          id: payout.payoutId,
          arrivalDate: payout.requestedAt ?? payout.completedAt ?? null,
          amount: toNumber(payout.amount),
          currency: payout.currency || 'INR',
          status: payout.status || 'paid',
          eventName: null,
          description: 'Event Revenue',
        }));
        return reply.send({ payouts: items, hasMore: Boolean(payouts.hasMore) });
      }

      if (rest === 'venue/bank-accounts' && request.method === 'GET') {
        const accounts = await financeService.getBankAccounts(ctx);
        return reply.send({ accounts: accounts.map((account) => mapAccount(account as any)) });
      }

      if (rest === 'venue/disputes' && request.method === 'GET') {
        const disputes = await financeService.getDisputes(ctx);
        return reply.send({
          disputes: asArray(disputes.data).map((dispute: Record<string, any>) => ({
            id: dispute.disputeId,
            orderId: dispute.orderId,
            amount: dispute.amount,
            status: dispute.status,
            reason: dispute.reason,
            createdAt: dispute.createdAt,
          })),
        });
      }

      if (rest === 'venue/ledger' && request.method === 'GET') {
        const ledger = await financeService.getLedger(ctx, {
          limit: Math.min(parseInt(String(query.limit || '50'), 10) || 50, 100),
        });
        return reply.send({
          ledger: asArray(ledger.data).map((entry: Record<string, any>) => ({
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
        });
      }

      if (
        (rest === 'venue/host-payouts' || rest === 'venue/promoter-payouts') &&
        request.method === 'GET'
      ) {
        return reply.send({
          totalOwedPaise: 0,
          totalHeldPaise: 0,
          pendingSettlements: [],
          historySettlements: [],
        });
      }

      return reply.status(404).send(
        buildErrorResponse({
          code: 'NOT_FOUND',
          message: 'Partner finance endpoint not found',
          requestId: request.id,
        }),
      );
    },
  });
}
