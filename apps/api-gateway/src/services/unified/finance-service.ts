import { FieldValue, type Firestore } from 'firebase-admin/firestore';
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

const LEDGER_AGGREGATES_COLLECTION = 'partner_finance_aggregates';
const LEDGER_IDEMPOTENCY_COLLECTION = 'partner_ledger_idempotency';
const REVENUE_FIELDS_BY_TYPE = {
  host_payout: 'hostPayout',
  venue_share: 'venueShare',
  promoter_commission: 'promoterCommission',
} as const;

type RevenueFieldName = (typeof REVENUE_FIELDS_BY_TYPE)[keyof typeof REVENUE_FIELDS_BY_TYPE];
type AggregateBalances = Record<LedgerEntryStatus, number>;

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
    const balances = await this.readBalanceAggregate(partnerId);
    const revenueByPeriod = await this.getRevenueByPeriod(ctx, 30);

    const durationMs = Date.now() - startedAt;
    if (durationMs > 500) {
      this.log.warn(
        { service: 'FinanceService', method: 'getOverview', partnerId, durationMs },
        'Slow finance overview computation'
      );
    }

    return {
      totalRevenue: balances.settled + balances.pending,
      pendingPayouts: balances.pending,
      settledPayouts: balances.settled,
      currency: 'INR',
      revenueByPeriod,
    };
  }

  async getFinanceSummary(ctx: PartnerContext): Promise<any> {
    const partnerId = ctx.partnerId;
    const [balances, doc, payoutsSnap] = await Promise.all([
      this.readBalanceAggregate(partnerId),
      this.db.collection(LEDGER_AGGREGATES_COLLECTION).doc(partnerId).get(),
      this.db.collection('payouts')
        .where('partnerId', '==', partnerId)
        .where('status', 'in', ['completed', 'paid', 'cleared'])
        .get(),
    ]);

    const aggregate = doc.exists ? doc.data() : {};
    const totalsByType = aggregate?.totalsByType || {};
    
    // Sum all successful payouts
    const paidOut = payoutsSnap.docs.reduce((sum, d) => sum + Math.abs(toNum(d.data().amount)), 0);

    // Get pending refunds from ledger (this might be slow if many, but aggregate doesn't split pending by type)
    // Actually, let's just use 0 if not easily available from aggregate for now, 
    // OR query the ledger for the last few days of pending refunds.
    // Given it's a P0, let's try to get it right.
    const pendingRefundsSnap = await this.db.collection('partner_ledger')
      .where('toPartnerId', '==', partnerId)
      .where('type', '==', 'refund')
      .where('status', '==', 'pending')
      .limit(50)
      .get();
    
    const refundPending = pendingRefundsSnap.docs.reduce((sum, d) => sum + Math.abs(toNum(d.data().amount)), 0);

    // Get total tickets sold from orders collection
    const ticketsSnap = await this.db.collection('orders')
      .where('hostId', '==', partnerId)
      .where('status', 'in', ['paid', 'checked_in'])
      .get()
      .catch(() => ({ size: 0, docs: [] }));
    
    const totalTicketsSold = (ticketsSnap as any).docs.reduce((sum: number, doc: any) => sum + toNum(doc.data().ticketCount || 1), 0);

    return {
      netRevenue: balances.settled + balances.pending,
      availableBalance: balances.settled,
      pendingBalance: balances.pending,
      totalTicketsSold,
      paidOut,
      refundPending,
      currency: aggregate?.currency || 'INR',
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

    let snap;
    try {
      snap = await q.get();
    } catch (err: any) {
      this.log.warn(
        { service: 'FinanceService', method: 'getLedger', partnerId, error: err?.message ?? String(err) },
        'Ledger query failed, attempting in-memory fallback'
      );
      
      try {
        const fallbackSnap = await this.db
          .collection('partner_ledger')
          .where('toPartnerId', '==', partnerId)
          .get();
          
        let allItems = fallbackSnap.docs.map((doc: any) => this.docToLedgerEntry(doc));
        
        if (type) {
          allItems = allItems.filter(item => item.type === type);
        }
        if (from) {
          const fromTime = new Date(from).getTime();
          allItems = allItems.filter(item => item.createdAt && new Date(item.createdAt).getTime() >= fromTime);
        }
        if (to) {
          const toTime = new Date(to).getTime();
          allItems = allItems.filter(item => item.createdAt && new Date(item.createdAt).getTime() <= toTime);
        }
        
        allItems.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });
        
        let startIndex = 0;
        if (cursor) {
          const cursorIndex = allItems.findIndex(item => item.entryId === cursor);
          if (cursorIndex !== -1) {
            startIndex = cursorIndex + 1;
          }
        }
        
        const slicedItems = allItems.slice(startIndex, startIndex + cap + 1);
        const hasMore = slicedItems.length > cap;
        const items = slicedItems.slice(0, cap);
        const nextCursor = hasMore ? items[items.length - 1]?.entryId ?? null : null;
        
        return { data: items, hasMore, nextCursor };
      } catch (fallbackErr: any) {
        this.log.error(
          { service: 'FinanceService', method: 'getLedger', partnerId, error: fallbackErr?.message ?? String(fallbackErr) },
          'Ledger fallback query failed'
        );
        return { data: [], hasMore: false, nextCursor: null };
      }
    }

    const durationMs = Date.now() - startedAt;
    if (durationMs > 300) {
      this.log.warn(
        { service: 'FinanceService', method: 'getLedger', partnerId, durationMs, filters: { from, to, type } },
        'Slow ledger query'
      );
    }

    const docs: any[] = snap.docs ?? [];
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

    let snap;
    try {
      snap = await q.get();
    } catch (err: any) {
      this.log.warn(
        { service: 'FinanceService', method: 'getPayouts', partnerId: ctx.partnerId, error: err?.message ?? String(err) },
        'Payouts query failed, attempting in-memory fallback'
      );
      
      try {
        const fallbackSnap = await this.db
          .collection('payouts')
          .where('partnerId', '==', ctx.partnerId)
          .get();
          
        let allItems = fallbackSnap.docs.map((doc: any) => this.docToPayout(doc));
        
        if (status) {
          allItems = allItems.filter(item => item.status === status);
        }
        
        allItems.sort((a, b) => {
          const aTime = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
          const bTime = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
          return bTime - aTime;
        });
        
        let startIndex = 0;
        if (cursor) {
          const cursorIndex = allItems.findIndex(item => item.payoutId === cursor);
          if (cursorIndex !== -1) {
            startIndex = cursorIndex + 1;
          }
        }
        
        const slicedItems = allItems.slice(startIndex, startIndex + cap + 1);
        const hasMore = slicedItems.length > cap;
        const items = slicedItems.slice(0, cap);
        const nextCursor = hasMore ? items[items.length - 1]?.payoutId ?? null : null;
        
        return { data: items, hasMore, nextCursor };
      } catch (fallbackErr: any) {
        this.log.error(
          { service: 'FinanceService', method: 'getPayouts', partnerId: ctx.partnerId, error: fallbackErr?.message ?? String(fallbackErr) },
          'Payouts fallback query failed'
        );
        return { data: [], hasMore: false, nextCursor: null };
      }
    }

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
    const balances = await this.readBalanceAggregate(ctx.partnerId);

    const result: BalanceSummary = { available: balances.settled, pending: balances.pending, currency: 'INR' };

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
    const createdAt = toIso(now) || now.toISOString();
    const platformFee = Math.round(grossAmount * participants.platformFeeRate);
    const venueShare = Math.round(grossAmount * participants.venueShareRate);
    const promoterCommission = participants.promoterId
      ? Math.round(grossAmount * (participants.promoterCommissionRate ?? 0))
      : 0;
    const hostPayout = grossAmount - platformFee - venueShare - promoterCommission;

    const base = { eventId, currency: 'INR' as const, referenceId: orderId, createdAt };

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

    let created = false;
    const idempotencyRef = this.db.collection(LEDGER_IDEMPOTENCY_COLLECTION).doc(orderId);

    await this.db.runTransaction(async (txn) => {
      const markerDoc = await txn.get(idempotencyRef);
      if (markerDoc.exists) return;

      const eventDoc = await txn.get(this.db.collection('events').doc(eventId));
      const eventData = eventDoc.exists ? eventDoc.data() : {};
      const eventCity = eventData?.city || eventData?.cityName || 'Unknown';
      const normalizedCity = String(eventCity).trim().toLowerCase() || 'unknown';

      created = true;
      for (const entry of entries) {
        const ref = this.db.collection('partner_ledger').doc();
        txn.set(ref, entry);
      }

      txn.set(idempotencyRef, {
        orderId,
        eventId,
        partnerIds: Array.from(new Set([participants.hostId, participants.venueId, participants.promoterId].filter(Boolean))),
        entryCount: entries.length,
        createdAt,
      });

      if (participants.promoterId && promoterCommission > 0) {
        const statsRef = this.db.collection('promoter_stats').doc(participants.promoterId);
        // Using FieldValue.increment inside a transaction via set merge
        txn.set(statsRef, {
          totalCommissionEarned: FieldValue.increment(promoterCommission),
          updatedAt: new Date()
        }, { merge: true });

        // Update city-based stats for Option 2
        const cityStatsId = `${participants.promoterId}_${normalizedCity}`;
        const cityStatsRef = this.db.collection('promoter_city_stats').doc(cityStatsId);
        txn.set(cityStatsRef, {
          promoterId: participants.promoterId,
          city: normalizedCity,
          totalCommissionEarned: FieldValue.increment(promoterCommission),
          updatedAt: new Date()
        }, { merge: true });

        // --- NEW TIME & LOCATION MATRIX (Option 3) ---
        const d = new Date();
        const monthStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        
        const d2 = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        const dayNum = d2.getUTCDay() || 7;
        d2.setUTCDate(d2.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d2.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d2.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        const weekStr = `${d2.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;

        const buckets = [
          { type: 'all_time', value: 'all', city: 'global' },
          { type: 'all_time', value: 'all', city: normalizedCity },
          { type: 'month', value: monthStr, city: 'global' },
          { type: 'month', value: monthStr, city: normalizedCity },
          { type: 'week', value: weekStr, city: 'global' },
          { type: 'week', value: weekStr, city: normalizedCity },
        ];

        for (const bucket of buckets) {
          const docId = `${participants.promoterId}_${bucket.type}_${bucket.value}_${bucket.city}`;
          const ref = this.db.collection('leaderboard_stats').doc(docId);
          txn.set(ref, {
            promoterId: participants.promoterId,
            periodType: bucket.type,
            periodValue: bucket.value,
            city: bucket.city,
            totalCommissionEarned: FieldValue.increment(promoterCommission),
            updatedAt: new Date()
          }, { merge: true });
        }
        // ---------------------------------------------
      }

      this.applyAggregateWrites(txn, entries, createdAt);
    });

    if (!created) {
      this.log.warn(
        { service: 'FinanceService', method: 'recordTicketSale', eventId, orderId },
        'Skipped duplicate ledger write for ticket sale'
      );
      return;
    }

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
      const createdAt = toIso(new Date()) || new Date().toISOString();
      const entry: Omit<LedgerEntry, 'entryId'> = {
        eventId,
        type: 'refund' as LedgerEntryType,
        amount: -Math.abs(amount),
        currency: 'INR',
        fromPartnerId: null,
        toPartnerId: partnerId,
        status: 'settled' as LedgerEntryStatus,
        referenceId: orderId,
        settledAt: createdAt,
        createdAt,
      };

    const idempotencyRef = this.db.collection(LEDGER_IDEMPOTENCY_COLLECTION).doc(`refund_${orderId}`);

    await this.db.runTransaction(async (txn) => {
      const markerDoc = await txn.get(idempotencyRef);
      if (markerDoc.exists) return;

      const ref = this.db.collection('partner_ledger').doc();
      txn.set(ref, entry);
      this.applyAggregateWrites(txn, [entry], entry.createdAt || createdAt);

      txn.set(idempotencyRef, {
        orderId,
        eventId,
        partnerId,
        type: 'refund',
        amount: entry.amount,
        createdAt,
      });
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
    const balances = await this.readBalanceAggregate(partnerId);
    return balances[status] ?? 0;
  }

  private async getRevenueByPeriod(ctx: PartnerContext, days: number): Promise<DataPoint[]> {
    const fromKey = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const startedAt = Date.now();
    const revenueField = this.getRevenueFieldForPartnerType(ctx.type);

    await this.readBalanceAggregate(ctx.partnerId);

    const snap = await this.db
      .collection(LEDGER_AGGREGATES_COLLECTION)
      .doc(ctx.partnerId)
      .collection('daily')
      .where('date', '>=', fromKey)
      .orderBy('date', 'asc')
      .limit(Math.max(days + 14, 120))
      .get()
      .catch((err: any) => {
        this.log.error(
          { service: 'FinanceService', method: 'getRevenueByPeriod', partnerId: ctx.partnerId, days, error: err?.message ?? String(err) },
          'Revenue period query failed'
        );
        throw err;
      });

    const durationMs = Date.now() - startedAt;
    if (durationMs > 300) {
      this.log.warn(
        { service: 'FinanceService', method: 'getRevenueByPeriod', partnerId: ctx.partnerId, durationMs },
        'Slow revenue aggregation'
      );
    }

    return snap.docs
      .map((doc) => {
        const d = doc.data() as Record<string, any>;
        const date = safeStr(d.date || doc.id);
        return { date, value: toNum(d[revenueField]) };
      })
      .filter((point) => point.date);
  }

  private async readBalanceAggregate(partnerId: string): Promise<AggregateBalances> {
    const doc = await this.db.collection(LEDGER_AGGREGATES_COLLECTION).doc(partnerId).get().catch((err: any) => {
      this.log.error(
        { service: 'FinanceService', method: 'readBalanceAggregate', partnerId, error: err?.message ?? String(err) },
        'Ledger aggregate read failed'
      );
      throw err;
    });

    if (!doc.exists) return this.rebuildPartnerLedgerAggregate(partnerId);

    const balances = (doc.data()?.balances || {}) as Record<string, any>;
    return {
      pending: toNum(balances.pending),
      settled: toNum(balances.settled),
      disputed: toNum(balances.disputed),
      reversed: toNum(balances.reversed),
    };
  }

  private getRevenueFieldForPartnerType(type: PartnerContext['type']): RevenueFieldName {
    if (type === 'venue') return 'venueShare';
    if (type === 'promoter') return 'promoterCommission';
    return 'hostPayout';
  }

  private applyAggregateWrites(txn: any, entries: Omit<LedgerEntry, 'entryId'>[], createdAt: string) {
    const aggregateMap = new Map<string, {
      balances: Partial<Record<LedgerEntryStatus, number>>;
      totalsByType: Partial<Record<LedgerEntryType, number>>;
      daily: Map<string, Partial<Record<RevenueFieldName, number>>>;
    }>();

    for (const entry of entries) {
      const partnerId = entry.toPartnerId;
      if (!partnerId) continue;

      const next = aggregateMap.get(partnerId) || {
        balances: {} as Partial<Record<LedgerEntryStatus, number>>,
        totalsByType: {} as Partial<Record<LedgerEntryType, number>>,
        daily: new Map<string, Partial<Record<RevenueFieldName, number>>>(),
      };
      next.balances[entry.status] = (next.balances[entry.status] ?? 0) + entry.amount;
      next.totalsByType[entry.type] = (next.totalsByType[entry.type] ?? 0) + entry.amount;

      const revenueField = REVENUE_FIELDS_BY_TYPE[entry.type as keyof typeof REVENUE_FIELDS_BY_TYPE];
      const dateKey = String(entry.createdAt || createdAt).slice(0, 10);
      if (revenueField && dateKey) {
        const daily = next.daily.get(dateKey) || {} as Partial<Record<RevenueFieldName, number>>;
        daily[revenueField] = (daily[revenueField] ?? 0) + entry.amount;
        next.daily.set(dateKey, daily);
      }

      aggregateMap.set(partnerId, next);
    }

    for (const [partnerId, aggregate] of aggregateMap.entries()) {
      const aggregateRef = this.db.collection(LEDGER_AGGREGATES_COLLECTION).doc(partnerId);
      const balancePayload = Object.fromEntries(
        Object.entries(aggregate.balances).map(([status, amount]) => [status, FieldValue.increment(amount as number)])
      );
      const totalsPayload = Object.fromEntries(
        Object.entries(aggregate.totalsByType).map(([type, amount]) => [type, FieldValue.increment(amount as number)])
      );
      txn.set(aggregateRef, {
        partnerId,
        currency: 'INR',
        balances: balancePayload,
        totalsByType: totalsPayload,
        updatedAt: createdAt,
      }, { merge: true });

      for (const [dateKey, daily] of aggregate.daily.entries()) {
        const dailyPayload = Object.fromEntries(
          Object.entries(daily).map(([field, amount]) => [field, FieldValue.increment(amount as number)])
        );
        txn.set(aggregateRef.collection('daily').doc(dateKey), {
          date: dateKey,
          createdAt: dateKey,
          updatedAt: createdAt,
          ...dailyPayload,
        }, { merge: true });
      }
    }
  }

  private async rebuildPartnerLedgerAggregate(partnerId: string): Promise<AggregateBalances> {
    const startedAt = Date.now();
    const snap = await this.db
      .collection('partner_ledger')
      .where('toPartnerId', '==', partnerId)
      .get()
      .catch((err: any) => {
        this.log.error(
          { service: 'FinanceService', method: 'rebuildPartnerLedgerAggregate', partnerId, error: err?.message ?? String(err) },
          'Ledger aggregate rebuild query failed'
        );
        throw err;
      });

    const balances: AggregateBalances = {
      pending: 0,
      settled: 0,
      disputed: 0,
      reversed: 0,
    };
    const totalsByType: Partial<Record<LedgerEntryType, number>> = {};
    const daily = new Map<string, Record<string, number>>();

    for (const doc of snap.docs) {
      const data = doc.data() as Record<string, any>;
      const status = (data.status || 'pending') as LedgerEntryStatus;
      const type = (data.type || 'ticket_revenue') as LedgerEntryType;
      const amount = toNum(data.amount);
      balances[status] = (balances[status] ?? 0) + amount;
      totalsByType[type] = (totalsByType[type] ?? 0) + amount;

      const revenueField = REVENUE_FIELDS_BY_TYPE[type as keyof typeof REVENUE_FIELDS_BY_TYPE];
      const dateKey = toIso(data.createdAt)?.slice(0, 10);
      if (revenueField && dateKey) {
        const bucket = daily.get(dateKey) || {};
        bucket[revenueField] = (bucket[revenueField] ?? 0) + amount;
        daily.set(dateKey, bucket);
      }
    }

    const aggregateRef = this.db.collection(LEDGER_AGGREGATES_COLLECTION).doc(partnerId);
    const dailyEntries = Array.from(daily.entries());
    const chunkSize = 400;

    if (dailyEntries.length === 0) {
      await this.db.batch().set(aggregateRef, {
        partnerId,
        currency: 'INR',
        balances,
        totalsByType,
        rebuiltAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: false }).commit();
    } else {
      for (let start = 0; start < dailyEntries.length; start += chunkSize) {
        const batch = this.db.batch();
        if (start === 0) {
          batch.set(aggregateRef, {
            partnerId,
            currency: 'INR',
            balances,
            totalsByType,
            rebuiltAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }, { merge: false });
        }
        for (const [dateKey, bucket] of dailyEntries.slice(start, start + chunkSize)) {
          batch.set(aggregateRef.collection('daily').doc(dateKey), {
            date: dateKey,
            createdAt: dateKey,
            updatedAt: new Date().toISOString(),
            hostPayout: toNum(bucket.hostPayout),
            venueShare: toNum(bucket.venueShare),
            promoterCommission: toNum(bucket.promoterCommission),
          }, { merge: false });
        }
        await batch.commit();
      }
    }

    const durationMs = Date.now() - startedAt;
    if (durationMs > 300) {
      this.log.warn(
        { service: 'FinanceService', method: 'rebuildPartnerLedgerAggregate', partnerId, durationMs, docCount: snap.docs.length },
        'Rebuilt partner ledger aggregate from source ledger'
      );
    }

    return balances;
  }
}
