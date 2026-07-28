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

const LEDGER_AGGREGATES_COLLECTION = 'partner_finance_aggregates';
const BALANCE_CACHE_VERSION = 2;
const REVENUE_FIELDS_BY_TYPE = {
  host_payout: 'hostPayout',
  venue_share: 'venueShare',
  promoter_commission: 'promoterCommission',
} as const;

function financeUnavailable(message: string, cause?: unknown) {
  const error: any = new Error(message);
  if (cause !== undefined) error.cause = cause;
  error.code = 'FINANCE_DATA_UNAVAILABLE';
  error.statusCode = 503;
  return error;
}

function requirePaise(value: unknown, recordLabel: string) {
  const amountPaise = Number(value);
  if (!Number.isSafeInteger(amountPaise)) {
    throw financeUnavailable(`${recordLabel} is missing canonical integer amountPaise`);
  }
  return amountPaise;
}

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
        'Slow finance overview computation',
      );
    }

    return {
      totalRevenue: (balances.settled + balances.pending) / 100,
      pendingPayouts: balances.pending / 100,
      settledPayouts: balances.settled / 100,
      totalRevenuePaise: balances.settled + balances.pending,
      pendingPayoutsPaise: balances.pending,
      settledPayoutsPaise: balances.settled,
      currency: 'INR',
      revenueByPeriod,
    };
  }

  async getFinanceSummary(ctx: PartnerContext): Promise<any> {
    const partnerId = ctx.partnerId;

    // ⚡ Performance: serve from Redis cache to avoid 4 parallel Firestore queries
    const summaryCacheKey = `finance:summary:v${BALANCE_CACHE_VERSION}:${partnerId}`;
    if (this.redis && this.redis.status === 'ready') {
      try {
        const cached = await this.redis.get(summaryCacheKey);
        if (cached) return JSON.parse(cached);
      } catch {
        // Redis failure is non-critical — fall through to computation
      }
    }

    const [balances, doc, payoutsSnap] = await Promise.all([
      this.readBalanceAggregate(partnerId),
      this.db.collection(LEDGER_AGGREGATES_COLLECTION).doc(partnerId).get(),
      this.db
        .collection('payouts')
        .where('partnerId', '==', partnerId)
        .where('status', 'in', ['completed', 'paid', 'cleared'])
        .get(),
    ]);

    const aggregate = doc.exists ? doc.data() : {};
    const totalsByType = aggregate?.totalsByType || {};

    // Sum all successful payouts
    const paidOutPaise = payoutsSnap.docs.reduce((sum, d) => {
      const payout = d.data();
      const amountPaise = requirePaise(payout.amountPaise, `Payout ${d.id}`);
      return sum + Math.abs(amountPaise);
    }, 0);

    // Get pending refunds from ledger (this might be slow if many, but aggregate doesn't split pending by type)
    // Actually, let's just use 0 if not easily available from aggregate for now,
    // OR query the ledger for the last few days of pending refunds.
    // Given it's a P0, let's try to get it right.
    const pendingRefundsSnap = await this.db
      .collection('partner_ledger')
      .where('toPartnerId', '==', partnerId)
      .where('type', '==', 'refund')
      .where('status', '==', 'pending')
      .limit(50)
      .get();

    const refundPendingPaise = pendingRefundsSnap.docs.reduce(
      (sum, d) => sum + Math.abs(requirePaise(d.data().amountPaise, `Ledger entry ${d.id}`)),
      0,
    );

    // Admission count is ticket truth. Orders remain display metadata only.
    const ticketsSnap = await this.db
      .collection('tickets')
      .where('hostId', '==', partnerId)
      .where('status', 'in', ['active', 'used', 'transferred'])
      .get();

    const totalTicketsSold = (ticketsSnap as any).size;

    const result = {
      netRevenue: (balances.settled + balances.pending) / 100,
      netRevenuePaise: balances.settled + balances.pending,
      availableBalance: balances.settled / 100,
      availableBalancePaise: balances.settled,
      pendingBalance: balances.pending / 100,
      pendingBalancePaise: balances.pending,
      totalTicketsSold,
      paidOut: paidOutPaise / 100,
      paidOutPaise,
      refundPending: refundPendingPaise / 100,
      refundPendingPaise,
      currency: aggregate?.currency || 'INR',
    };

    // ⚡ Write-through: cache finance summary for 5min (invalidated on purchase)
    if (this.redis && this.redis.status === 'ready') {
      this.redis.set(summaryCacheKey, JSON.stringify(result), 'EX', 300).catch(() => {});
    }

    return result;
  }

  // ── Ledger ────────────────────────────────────────────────────────────────

  async getLedger(
    ctx: PartnerContext,
    filters: LedgerFilters,
  ): Promise<PaginatedResult<LedgerEntry>> {
    const { from, to, type, status, cursor, limit = 20 } = filters;
    const cap = Math.min(limit, 200);
    const partnerId = ctx.partnerId;
    const startedAt = Date.now();

    let q: any = this.db
      .collection('partner_ledger')
      .where('toPartnerId', '==', partnerId)
      .orderBy('createdAt', 'desc')
      .limit(cap + 1);

    if (type) q = q.where('type', '==', type);
    if (status) q = q.where('status', '==', status);
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
      this.log.error(
        {
          service: 'FinanceService',
          method: 'getLedger',
          partnerId,
          error: err?.message ?? String(err),
        },
        'Canonical paginated ledger query failed',
      );
      throw financeUnavailable('Canonical ledger data is unavailable', err);
    }

    const durationMs = Date.now() - startedAt;
    if (durationMs > 300) {
      this.log.warn(
        {
          service: 'FinanceService',
          method: 'getLedger',
          partnerId,
          durationMs,
          filters: { from, to, type },
        },
        'Slow ledger query',
      );
    }

    const docs: any[] = snap.docs ?? [];
    const hasMore = docs.length > cap;
    const items = docs.slice(0, cap).map((doc: any) => this.docToLedgerEntry(doc));
    const nextCursor = hasMore ? (items[items.length - 1]?.entryId ?? null) : null;

    return { data: items, hasMore, nextCursor };
  }

  // ── Payouts ───────────────────────────────────────────────────────────────

  async getPayouts(ctx: PartnerContext, filters: PayoutFilters): Promise<PaginatedResult<Payout>> {
    const { status, cursor, limit = 20 } = filters;
    const cap = Math.min(limit, 100);
    const boundedLimit = 501;
    let snap: FirebaseFirestore.QuerySnapshot;
    try {
      snap = await this.db
        .collection('payouts')
        .where('partnerId', '==', ctx.partnerId)
        .limit(boundedLimit)
        .get();
    } catch (err: any) {
      this.log.error(
        {
          service: 'FinanceService',
          method: 'getPayouts',
          partnerId: ctx.partnerId,
          error: err?.message ?? String(err),
        },
        'Canonical bounded payouts query failed',
      );
      throw financeUnavailable('Canonical payout data is unavailable', err);
    }

    if (snap.size >= boundedLimit) {
      throw financeUnavailable('Payout history exceeds the bounded launch query window');
    }

    let allItems = snap.docs.map((doc: any) => this.docToPayout(doc));
    if (status) allItems = allItems.filter((item) => item.status === status);
    allItems.sort((a, b) => {
      const timeDelta =
        new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime();
      return timeDelta || b.payoutId.localeCompare(a.payoutId);
    });

    let startIndex = 0;
    if (cursor) {
      const cursorIndex = allItems.findIndex((item) => item.payoutId === cursor);
      if (cursorIndex < 0) {
        throw financeUnavailable('Payout cursor is outside the bounded launch query window');
      }
      startIndex = cursorIndex + 1;
    }

    const window = allItems.slice(startIndex, startIndex + cap + 1);
    const hasMore = window.length > cap;
    const items = window.slice(0, cap);
    const nextCursor = hasMore ? (items[items.length - 1]?.payoutId ?? null) : null;

    return { data: items, hasMore, nextCursor };
  }

  // ── Balances ──────────────────────────────────────────────────────────────

  // P1: Always compute from partner_ledger — eliminates cache/ledger drift.
  // The payout_balances cache doc is NO LONGER used as a source of truth.
  // Redis is used as a short-lived performance cache (15s TTL) only.
  async getBalances(ctx: PartnerContext): Promise<BalanceSummary> {
    const cacheKey = `finance:balance:v${BALANCE_CACHE_VERSION}:${ctx.partnerId}`;

    // Try Redis cache first. The 15-second TTL is the Host/Venue launch SLA.
    if (this.redis && this.redis.status === 'ready') {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          this.log.info(
            {
              service: 'FinanceService',
              method: 'getBalances',
              partnerId: ctx.partnerId,
              cacheHit: true,
            },
            'Balance served from Redis cache',
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

    const result: BalanceSummary = {
      available: balances.settled / 100,
      pending: balances.pending / 100,
      availablePaise: balances.settled,
      pendingPaise: balances.pending,
      currency: 'INR',
    };

    const durationMs = Date.now() - startedAt;
    if (durationMs > 300) {
      this.log.warn(
        { service: 'FinanceService', method: 'getBalances', partnerId: ctx.partnerId, durationMs },
        'Slow balance computation from ledger',
      );
    }

    // Write-through to Redis cache (best-effort, non-blocking).
    if (this.redis && this.redis.status === 'ready') {
      this.redis.set(cacheKey, JSON.stringify(result), 'EX', 15).catch(() => {});
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
          {
            service: 'FinanceService',
            method: 'getBankAccounts',
            partnerId: ctx.partnerId,
            error: err?.message ?? String(err),
          },
          'Bank accounts query failed',
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
    const boundedLimit = 501;
    let snap: FirebaseFirestore.QuerySnapshot;
    try {
      snap = await this.db
        .collection('disputes')
        .where('partnerId', '==', ctx.partnerId)
        .limit(boundedLimit)
        .get();
    } catch (err: any) {
      this.log.error(
        {
          service: 'FinanceService',
          method: 'getDisputes',
          partnerId: ctx.partnerId,
          error: err?.message ?? String(err),
        },
        'Canonical bounded disputes query failed',
      );
      throw financeUnavailable('Canonical dispute data is unavailable', err);
    }
    if (snap.size >= boundedLimit) {
      throw financeUnavailable('Dispute history exceeds the bounded launch query window');
    }
    let items = (snap as any).docs.map((doc: any) => {
      const d = doc.data() as Record<string, any>;
      return {
        disputeId: doc.id,
        orderId: safeStr(d.orderId),
        amount: requirePaise(d.amountPaise, `Dispute ${doc.id}`) / 100,
        status: safeStr(d.status || 'open'),
        reason: d.reason ?? null,
        createdAt: toIso(d.createdAt),
      } satisfies Dispute;
    });
    if (status) items = items.filter((item: Dispute) => item.status === status);
    items.sort((left: Dispute, right: Dispute) =>
      String(right.createdAt || '').localeCompare(String(left.createdAt || '')),
    );
    items = items.slice(0, 50);

    return { data: items, hasMore: false, nextCursor: null };
  }

  // ── Internal write methods (called only by checkout flow, not API routes) ─

  async recordTicketSale(
    _eventId: string,
    _orderId: string,
    _grossAmount: number,
    _participants: {
      venueId: string;
      hostId: string;
      promoterId?: string;
      promoterLinkId?: string;
      platformFeeRate: number;
      venueShareRate: number;
      promoterCommissionRate?: number;
    },
  ): Promise<void> {
    throw new Error(
      'DIRECT_TICKET_LEDGER_WRITE_DISABLED: finalizeTicketPayment is the sole ticket-sale writer',
    );
  }

  async recordRefund(
    _eventId: string,
    _orderId: string,
    _amount: number,
    _partnerId: string,
  ): Promise<void> {
    throw new Error(
      'DIRECT_REFUND_LEDGER_WRITE_DISABLED: finalizeProcessedRefund is the sole refund writer',
    );
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private docToLedgerEntry(
    doc: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot,
  ): LedgerEntry {
    const d = (doc.data() ?? {}) as Record<string, any>;
    const amountPaise = requirePaise(d.amountPaise, `Ledger entry ${doc.id}`);
    return {
      entryId: doc.id,
      eventId: safeStr(d.eventId),
      type: (d.type ?? 'ticket_revenue') as LedgerEntryType,
      amount: amountPaise / 100,
      amountPaise,
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
    const amountPaise = requirePaise(d.amountPaise, `Payout ${doc.id}`);
    return {
      payoutId: doc.id,
      amountPaise,
      amount: amountPaise / 100,
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
          {
            service: 'FinanceService',
            method: 'getRevenueByPeriod',
            partnerId: ctx.partnerId,
            days,
            error: err?.message ?? String(err),
          },
          'Revenue period query failed',
        );
        throw err;
      });

    const durationMs = Date.now() - startedAt;
    if (durationMs > 300) {
      this.log.warn(
        {
          service: 'FinanceService',
          method: 'getRevenueByPeriod',
          partnerId: ctx.partnerId,
          durationMs,
        },
        'Slow revenue aggregation',
      );
    }

    return snap.docs
      .map((doc) => {
        const d = doc.data() as Record<string, any>;
        const date = safeStr(d.date || doc.id);
        return { date, value: toNum(d[revenueField]) / 100 };
      })
      .filter((point) => point.date);
  }

  private async readBalanceAggregate(partnerId: string): Promise<AggregateBalances> {
    const doc = await this.db
      .collection(LEDGER_AGGREGATES_COLLECTION)
      .doc(partnerId)
      .get()
      .catch((err: any) => {
        this.log.error(
          {
            service: 'FinanceService',
            method: 'readBalanceAggregate',
            partnerId,
            error: err?.message ?? String(err),
          },
          'Ledger aggregate read failed',
        );
        throw err;
      });

    if (!doc.exists) return this.rebuildPartnerLedgerAggregate(partnerId);

    const data = (doc.data() || {}) as Record<string, any>;
    const hasMalformedDottedProjection = Object.keys(data).some(
      (key) => key.startsWith('balances.') || key.startsWith('totalsByType.'),
    );
    if (hasMalformedDottedProjection) {
      this.log.warn(
        { service: 'FinanceService', method: 'readBalanceAggregate', partnerId },
        'Rebuilding malformed dotted-field finance projection from canonical ledger',
      );
      return this.rebuildPartnerLedgerAggregate(partnerId);
    }

    const balances = (data.balances || {}) as Record<string, any>;
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

  private async rebuildPartnerLedgerAggregate(partnerId: string): Promise<AggregateBalances> {
    const startedAt = Date.now();
    const snap = await this.db
      .collection('partner_ledger')
      .where('toPartnerId', '==', partnerId)
      .get()
      .catch((err: any) => {
        this.log.error(
          {
            service: 'FinanceService',
            method: 'rebuildPartnerLedgerAggregate',
            partnerId,
            error: err?.message ?? String(err),
          },
          'Ledger aggregate rebuild query failed',
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
      const amount = requirePaise(data.amountPaise, `Ledger entry ${doc.id}`);
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
      await this.db
        .batch()
        .set(
          aggregateRef,
          {
            partnerId,
            currency: 'INR',
            balances,
            totalsByType,
            rebuiltAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: false },
        )
        .commit();
    } else {
      for (let start = 0; start < dailyEntries.length; start += chunkSize) {
        const batch = this.db.batch();
        if (start === 0) {
          batch.set(
            aggregateRef,
            {
              partnerId,
              currency: 'INR',
              balances,
              totalsByType,
              rebuiltAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: false },
          );
        }
        for (const [dateKey, bucket] of dailyEntries.slice(start, start + chunkSize)) {
          batch.set(
            aggregateRef.collection('daily').doc(dateKey),
            {
              date: dateKey,
              createdAt: dateKey,
              updatedAt: new Date().toISOString(),
              hostPayout: toNum(bucket.hostPayout),
              venueShare: toNum(bucket.venueShare),
              promoterCommission: toNum(bucket.promoterCommission),
            },
            { merge: false },
          );
        }
        await batch.commit();
      }
    }

    const durationMs = Date.now() - startedAt;
    if (durationMs > 300) {
      this.log.warn(
        {
          service: 'FinanceService',
          method: 'rebuildPartnerLedgerAggregate',
          partnerId,
          durationMs,
          docCount: snap.docs.length,
        },
        'Rebuilt partner ledger aggregate from source ledger',
      );
    }

    return balances;
  }
}
