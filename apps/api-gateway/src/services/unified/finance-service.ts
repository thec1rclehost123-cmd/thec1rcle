import type { Firestore } from 'firebase-admin/firestore';
import type {
  PartnerContext,
  LedgerEntry,
  LedgerEntryType,
  LedgerEntryStatus,
  LedgerFilters,
  Payout,
  PayoutFilters,
  BalanceSummary,
  FinanceOverview,
  BankAccount,
  Dispute,
  PaginatedResult,
  DataPoint,
} from './types.js';
import { toIso, toNum, safeStr } from './types.js';
import type { ServiceContext, ServiceLogger } from './service-context.js';
import { consoleLogger } from './service-context.js';

// ─── FinanceService ───────────────────────────────────────────────────────────
//
// THE single source of truth for all partner financials.
// Collection: partner_ledger/{entryId}
//
// IMPORTANT: This service NEVER writes money to the ledger from API routes.
// Ledger writes happen only via internal methods called by the checkout flow.
//
// P1: getBalances now ALWAYS computes from partner_ledger — no fallback to
// payout_balances cache doc. This eliminates cache-ledger drift as a class of bug.

export class FinanceService {
  private db: Firestore;
  private log: ServiceLogger;
  private redis?: ServiceContext['redis'];

  constructor(ctx: ServiceContext);
  /** @deprecated Use ServiceContext form. Retained for backward compatibility. */
  constructor(db: Firestore);
  constructor(arg: ServiceContext | Firestore) {
    if ('db' in arg && 'log' in arg) {
      this.db = arg.db;
      this.log = arg.log;
      this.redis = (arg as ServiceContext).redis;
    } else {
      this.db = arg as Firestore;
      this.log = consoleLogger;
    }
  }

  // ── Overview ─────────────────────────────────────────────────────────────

  async getOverview(ctx: PartnerContext): Promise<FinanceOverview> {
    const partnerId = ctx.partnerId;
    const startedAt = Date.now();

    const [settled, pending] = await Promise.all([
      this.sumLedger(partnerId, 'settled'),
      this.sumLedger(partnerId, 'pending'),
    ]);

    const revenueByPeriod = await this.getRevenueByPeriod(partnerId, 30);

    const durationMs = Date.now() - startedAt;
    if (durationMs > 500) {
      this.log.warn(
        { service: 'FinanceService', method: 'getOverview', partnerId, durationMs },
        'Slow finance overview computation'
      );
    }

    return {
      totalRevenue: settled + pending,
      pendingPayouts: pending,
      settledPayouts: settled,
      currency: 'INR',
      revenueByPeriod,
    };
  }

  // ── Ledger ────────────────────────────────────────────────────────────────

  async getLedger(ctx: PartnerContext, filters: LedgerFilters): Promise<PaginatedResult<LedgerEntry>> {
    const { from, to, type, cursor, limit = 20 } = filters;
    const cap = Math.min(limit, 200);
    const partnerId = ctx.partnerId;
    const startedAt = Date.now();

    let q: any = this.db
      .collection('partner_ledger')
      .where('toPartnerId', '==', partnerId)
      .orderBy('createdAt', 'desc')
      .limit(cap + 1);

    if (type) q = q.where('type', '==', type);
    if (from) q = q.where('createdAt', '>=', new Date(from));
    if (to) q = q.where('createdAt', '<=', new Date(to));
    if (cursor) {
      const cursorDoc = await this.db.collection('partner_ledger').doc(cursor).get();
      if (cursorDoc.exists) q = q.startAfter(cursorDoc);
    }

    const snap = await q.get().catch((err: any) => {
      this.log.error(
        { service: 'FinanceService', method: 'getLedger', partnerId, error: err?.message ?? String(err) },
        'Ledger query failed — returning empty result'
      );
      return null;
    });

    const durationMs = Date.now() - startedAt;
    if (durationMs > 300) {
      this.log.warn(
        { service: 'FinanceService', method: 'getLedger', partnerId, durationMs, filters: { from, to, type } },
        'Slow ledger query'
      );
    }

    const docs: any[] = snap?.docs ?? [];
    const hasMore = docs.length > cap;
    const items = docs.slice(0, cap).map((doc: any) => this.docToLedgerEntry(doc));
    const nextCursor = hasMore ? items[items.length - 1]?.entryId ?? null : null;

    return { data: items, hasMore, nextCursor };
  }

  // ── Payouts ───────────────────────────────────────────────────────────────

  async getPayouts(ctx: PartnerContext, filters: PayoutFilters): Promise<PaginatedResult<Payout>> {
    const { status, cursor, limit = 20 } = filters;
    const cap = Math.min(limit, 100);

    let q: any = this.db
      .collection('payouts')
      .where('partnerId', '==', ctx.partnerId)
      .orderBy('requestedAt', 'desc')
      .limit(cap + 1);

    if (status) q = q.where('status', '==', status);
    if (cursor) {
      const cursorDoc = await this.db.collection('payouts').doc(cursor).get();
      if (cursorDoc.exists) q = q.startAfter(cursorDoc);
    }

    const snap = await q.get().catch((err: any) => {
      this.log.error(
        { service: 'FinanceService', method: 'getPayouts', partnerId: ctx.partnerId, error: err?.message ?? String(err) },
        'Payouts query failed'
      );
      return { docs: [] };
    });
    const docs: any[] = (snap as any).docs;
    const hasMore = docs.length > cap;
    const items = docs.slice(0, cap).map((doc: any) => this.docToPayout(doc));
    const nextCursor = hasMore ? items[items.length - 1]?.payoutId ?? null : null;

    return { data: items, hasMore, nextCursor };
  }

  // ── Balances ──────────────────────────────────────────────────────────────

  // P1: Always compute from partner_ledger — eliminates cache/ledger drift.
  // The payout_balances cache doc is NO LONGER used as a source of truth.
  // Redis is used as a short-lived performance cache (60s TTL) only.
  async getBalances(ctx: PartnerContext): Promise<BalanceSummary> {
    const cacheKey = `finance:balance:${ctx.partnerId}`;

    // Try Redis cache first (60s TTL — acceptable for dashboard display)
    if (this.redis && this.redis.status === 'ready') {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          this.log.info(
            { service: 'FinanceService', method: 'getBalances', partnerId: ctx.partnerId, cacheHit: true },
            'Balance served from Redis cache'
          );
          return JSON.parse(cached);
        }
      } catch {
        // Redis failure is non-critical — fall through to ledger computation
      }
    }

    const startedAt = Date.now();

    // Compute from ledger — sole source of truth
    const [available, pending] = await Promise.all([
      this.sumLedger(ctx.partnerId, 'settled'),
      this.sumLedger(ctx.partnerId, 'pending'),
    ]);

    const result: BalanceSummary = { available, pending, currency: 'INR' };

    const durationMs = Date.now() - startedAt;
    if (durationMs > 300) {
      this.log.warn(
        { service: 'FinanceService', method: 'getBalances', partnerId: ctx.partnerId, durationMs },
        'Slow balance computation from ledger'
      );
    }

    // Write-through to Redis cache (best-effort, non-blocking)
    if (this.redis && this.redis.status === 'ready') {
      this.redis.set(cacheKey, JSON.stringify(result), 'EX', 60).catch(() => {});
    }

    return result;
  }

  // ── Bank Accounts ─────────────────────────────────────────────────────────

  async getBankAccounts(ctx: PartnerContext): Promise<BankAccount[]> {
    const snap = await this.db
      .collection('bank_accounts')
      .where('partnerId', '==', ctx.partnerId)
      .limit(10)
      .get()
      .catch((err: any) => {
        this.log.error(
          { service: 'FinanceService', method: 'getBankAccounts', partnerId: ctx.partnerId, error: err?.message ?? String(err) },
          'Bank accounts query failed'
        );
        return { docs: [] };
      });

    return (snap as any).docs.map((doc: any) => {
      const d = doc.data() as Record<string, any>;
      return {
        accountId: doc.id,
        last4: safeStr(d.last4 || d.accountNumber?.slice(-4)),
        bankName: safeStr(d.bankName || d.bank),
        isDefault: d.isDefault === true,
        paymentType: (d.paymentType ?? 'bank_account') as 'bank_account' | 'debit_card',
      } satisfies BankAccount;
    });
  }

  // ── Disputes ──────────────────────────────────────────────────────────────

  async getDisputes(ctx: PartnerContext, status?: string): Promise<PaginatedResult<Dispute>> {
    let q: any = this.db
      .collection('disputes')
      .where('partnerId', '==', ctx.partnerId)
      .orderBy('createdAt', 'desc')
      .limit(50);

    if (status) q = q.where('status', '==', status);

    const snap = await q.get().catch((err: any) => {
      this.log.error(
        { service: 'FinanceService', method: 'getDisputes', partnerId: ctx.partnerId, error: err?.message ?? String(err) },
        'Disputes query failed'
      );
      return { docs: [] };
    });
    const items = (snap as any).docs.map((doc: any) => {
      const d = doc.data() as Record<string, any>;
      return {
        disputeId: doc.id,
        orderId: safeStr(d.orderId),
        amount: toNum(d.amount),
        status: safeStr(d.status || 'open'),
        reason: d.reason ?? null,
        createdAt: toIso(d.createdAt),
      } satisfies Dispute;
    });

    return { data: items, hasMore: false, nextCursor: null };
  }

  // ── Internal write methods (called only by checkout flow, not API routes) ─

  async recordTicketSale(
    eventId: string,
    orderId: string,
    grossAmount: number,
    participants: {
      venueId: string;
      hostId: string;
      promoterId?: string;
      promoterLinkId?: string;
      platformFeeRate: number;
      venueShareRate: number;
      promoterCommissionRate?: number;
    }
  ): Promise<void> {
    const now = new Date();
    const batch = this.db.batch();
    const platformFee = Math.round(grossAmount * participants.platformFeeRate);
    const venueShare = Math.round(grossAmount * participants.venueShareRate);
    const promoterCommission = participants.promoterId
      ? Math.round(grossAmount * (participants.promoterCommissionRate ?? 0))
      : 0;
    const hostPayout = grossAmount - platformFee - venueShare - promoterCommission;

    const base = { eventId, currency: 'INR' as const, referenceId: orderId, createdAt: toIso(now) };

    const entries: Omit<LedgerEntry, 'entryId'>[] = [
      { ...base, type: 'ticket_revenue', amount: grossAmount, fromPartnerId: null, toPartnerId: 'platform', status: 'settled', settledAt: toIso(now) },
      { ...base, type: 'platform_fee', amount: platformFee, fromPartnerId: participants.hostId, toPartnerId: 'platform', status: 'settled', settledAt: toIso(now) },
      { ...base, type: 'venue_share', amount: venueShare, fromPartnerId: participants.hostId, toPartnerId: participants.venueId, status: 'pending', settledAt: null },
      { ...base, type: 'host_payout', amount: hostPayout, fromPartnerId: null, toPartnerId: participants.hostId, status: 'pending', settledAt: null },
    ];

    if (participants.promoterId && promoterCommission > 0) {
      entries.push({
        ...base,
        type: 'promoter_commission',
        amount: promoterCommission,
        fromPartnerId: participants.hostId,
        toPartnerId: participants.promoterId,
        status: 'pending',
        settledAt: null,
      });
    }

    for (const entry of entries) {
      const ref = this.db.collection('partner_ledger').doc();
      batch.set(ref, entry);
    }

    await batch.commit();

    this.log.info(
      { service: 'FinanceService', method: 'recordTicketSale', eventId, orderId, gross: grossAmount, entryCount: entries.length },
      'Ledger entries created for ticket sale'
    );

    // Invalidate Redis balance cache for all affected partners
    if (this.redis && this.redis.status === 'ready') {
      const partnerIds = new Set([participants.hostId, participants.venueId, participants.promoterId].filter(Boolean));
      for (const pid of partnerIds) {
        this.redis.del(`finance:balance:${pid}`).catch(() => {});
      }
    }
  }

  async recordRefund(
    eventId: string,
    orderId: string,
    amount: number,
    partnerId: string
  ): Promise<void> {
      await this.db.collection('partner_ledger').add({
        eventId,
        type: 'refund' as LedgerEntryType,
        amount: -Math.abs(amount),
        currency: 'INR',
        fromPartnerId: null,
        toPartnerId: partnerId,
        status: 'settled' as LedgerEntryStatus,
        referenceId: orderId,
        settledAt: toIso(new Date()),
        createdAt: toIso(new Date()),
      });

      this.log.info(
        { service: 'FinanceService', method: 'recordRefund', eventId, orderId, amount, partnerId },
        'Refund ledger entry created'
      );

      // Invalidate Redis balance cache
      if (this.redis && this.redis.status === 'ready') {
        this.redis.del(`finance:balance:${partnerId}`).catch(() => {});
      }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private docToLedgerEntry(doc: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot): LedgerEntry {
    const d = (doc.data() ?? {}) as Record<string, any>;
    return {
      entryId: doc.id,
      eventId: safeStr(d.eventId),
      type: (d.type ?? 'ticket_revenue') as LedgerEntryType,
      amount: toNum(d.amount),
      currency: 'INR',
      fromPartnerId: d.fromPartnerId ?? null,
      toPartnerId: safeStr(d.toPartnerId),
      status: (d.status ?? 'pending') as LedgerEntryStatus,
      settledAt: toIso(d.settledAt),
      referenceId: d.referenceId ?? d.orderId ?? null,
      createdAt: toIso(d.createdAt),
    };
  }

  private docToPayout(doc: FirebaseFirestore.QueryDocumentSnapshot): Payout {
    const d = doc.data() as Record<string, any>;
    return {
      payoutId: doc.id,
      amount: toNum(d.amount),
      status: safeStr(d.status || 'pending'),
      paymentMethod: d.paymentMethod ?? null,
      requestedAt: toIso(d.requestedAt ?? d.createdAt),
      completedAt: toIso(d.completedAt ?? d.settledAt),
      currency: 'INR',
    };
  }

  private async sumLedger(partnerId: string, status: LedgerEntryStatus): Promise<number> {
    const startedAt = Date.now();
    const snap = await this.db
      .collection('partner_ledger')
      .where('toPartnerId', '==', partnerId)
      .where('status', '==', status)
      .select('amount')
      .get()
      .catch((err: any) => {
        this.log.error(
          { service: 'FinanceService', method: 'sumLedger', partnerId, status, error: err?.message ?? String(err) },
          'Ledger sum query failed — returning 0'
        );
        return null;
      });

    const durationMs = Date.now() - startedAt;
    if (durationMs > 300) {
      this.log.warn(
        { service: 'FinanceService', method: 'sumLedger', partnerId, status, durationMs, docCount: snap?.docs?.length ?? 0 },
        'Slow ledger aggregation'
      );
    }

    if (!snap) return 0;
    return snap.docs.reduce((sum, doc) => sum + toNum((doc.data() as any).amount), 0);
  }

  private async getRevenueByPeriod(partnerId: string, days: number): Promise<DataPoint[]> {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const startedAt = Date.now();

    const snap = await this.db
      .collection('partner_ledger')
      .where('toPartnerId', '==', partnerId)
      .where('type', '==', 'host_payout')
      .where('createdAt', '>=', from)
      .orderBy('createdAt', 'asc')
      .limit(500)
      .get()
      .catch((err: any) => {
        this.log.error(
          { service: 'FinanceService', method: 'getRevenueByPeriod', partnerId, days, error: err?.message ?? String(err) },
          'Revenue period query failed'
        );
        return null;
      });

    const durationMs = Date.now() - startedAt;
    if (durationMs > 300) {
      this.log.warn(
        { service: 'FinanceService', method: 'getRevenueByPeriod', partnerId, durationMs },
        'Slow revenue aggregation'
      );
    }

    if (!snap) return [];

    const byDate: Record<string, number> = {};
    for (const doc of snap.docs) {
      const d = doc.data() as Record<string, any>;
      const date = toIso(d.createdAt)?.split('T')[0];
      if (date) byDate[date] = (byDate[date] ?? 0) + toNum(d.amount);
    }

    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value }));
  }
}
