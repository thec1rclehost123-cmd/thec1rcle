import type { Firestore } from 'firebase-admin/firestore';
import type {
  PartnerContext,
  EventSummary,
  EventDetail,
  EventFilters,
  HostDashboardOverview,
  HostOverviewStats,
  HostOrderSummary,
  HostSettings,
  TeamMember,
  PaginatedResult,
  ActivityItem,
  OverviewMetric,
  OverviewRange,
  OverviewSeries,
  OverviewSeriesPoint,
} from './types.js';
import { toIso, toNum, safeStr } from './types.js';
import type { ServiceContext, ServiceLogger } from './service-context.js';
import { consoleLogger } from './service-context.js';
import { FinanceService } from './finance-service.js';

// ─── HostService ──────────────────────────────────────────────────────────────
//
// Phase 1: READ-only. All methods read from existing Firestore collections.
// Identity: handles both creatorId and hostId on event documents during migration.

export class HostService {
  private db: Firestore;
  private log: ServiceLogger;
  private financeService: FinanceService;

  constructor(ctx: ServiceContext);
  /** @deprecated Use ServiceContext form. Retained for backward compatibility. */
  constructor(db: Firestore);
  constructor(arg: ServiceContext | Firestore) {
    if ('db' in arg && 'log' in arg) {
      this.db = arg.db;
      this.log = arg.log;
      this.financeService = new FinanceService(arg as ServiceContext);
    } else {
      this.db = arg as Firestore;
      this.log = consoleLogger;
      this.financeService = new FinanceService(this.db);
    }
  }

  // ── Overview ─────────────────────────────────────────────────────────────

  async getOverview(
    ctx: PartnerContext,
    options: { range?: OverviewRange; metric?: OverviewMetric } = {},
  ): Promise<HostDashboardOverview> {
    const partnerId = ctx.partnerId;
    const range = options.range ?? '1m';
    const metric = options.metric ?? 'tickets';

    const [statsSnap, upcomingEvents, latestOrders, performance, balances] = await Promise.all([
      this.db
        .collection('host_stats')
        .doc(partnerId)
        .get()
        .catch((err) => {
          this.log.error(
            {
              service: 'HostService',
              method: 'getOverview',
              partnerId,
              error: err?.message ?? String(err),
            },
            'host_stats read failed',
          );
          return null;
        }),
      this.getUpcomingEvents(partnerId),
      this.getLatestOrders(partnerId),
      this.getPerformance(partnerId, range, metric),
      this.financeService.getBalances(ctx),
    ]);

    const raw = statsSnap?.exists ? (statsSnap.data() as Record<string, any>) : {};
    const stats: HostOverviewStats = {
      totalTicketsSold: toNum(raw.totalTicketsSold),
      totalRevenue: balances.available + balances.pending,
      activeEventsCount: toNum(raw.activeEventsCount),
      upcomingEventsCount: toNum(raw.upcomingEventsCount),
      completedEventsCount: toNum(raw.completedEventsCount),
      avgTicketsPerEvent: toNum(raw.avgTicketsPerEvent),
    };

    const recentActivity = await this.getRecentActivity(partnerId);

    return { stats, upcomingEvents, recentActivity, latestOrders, performance };
  }

  // ── Events ────────────────────────────────────────────────────────────────

  async getEvents(
    ctx: PartnerContext,
    filters: EventFilters,
  ): Promise<PaginatedResult<EventSummary>> {
    const { status, cursor, limit = 20 } = filters;
    const cap = Math.min(limit, 100);
    const partnerId = ctx.partnerId;

    let q: any = this.db
      .collection('events')
      .where('creatorId', '==', partnerId)
      .orderBy('startDate', 'desc')
      .limit(cap + 1);

    if (status) q = q.where('lifecycle', '==', status);
    if (cursor) {
      const cursorDoc = await this.db.collection('events').doc(cursor).get();
      if (cursorDoc.exists) q = q.startAfter(cursorDoc);
    }

    let snap = await q.get().catch((err: any) => {
      this.log.error(
        {
          service: 'HostService',
          method: 'getEvents',
          partnerId,
          field: 'creatorId',
          error: err?.message ?? String(err),
        },
        'Events query failed',
      );
      return null;
    });

    // Fallback: try hostId field if creatorId returned nothing
    if (!snap || snap.empty) {
      let q2: any = this.db
        .collection('events')
        .where('hostId', '==', partnerId)
        .orderBy('startDate', 'desc')
        .limit(cap + 1);
      if (status) q2 = q2.where('lifecycle', '==', status);
      snap = await q2.get().catch((err: any) => {
        this.log.error(
          {
            service: 'HostService',
            method: 'getEvents',
            partnerId,
            field: 'hostId',
            error: err?.message ?? String(err),
          },
          'Events hostId fallback query failed',
        );
        return { docs: [] };
      });
    }

    const docs = snap?.docs ?? [];
    const hasMore = docs.length > cap;
    const items = docs.slice(0, cap).map((doc: any) => this.docToEventSummary(doc));
    const nextCursor = hasMore ? (items[items.length - 1]?.eventId ?? null) : null;

    return { data: items, hasMore, nextCursor };
  }

  async getEvent(ctx: PartnerContext, eventId: string): Promise<EventDetail | null> {
    const doc = await this.db.collection('events').doc(eventId).get();
    if (!doc.exists) return null;

    const data = doc.data() as Record<string, any>;
    const ownerId = safeStr(data.creatorId || data.hostId || data.ownerPartnerId);
    if (!ownerId || ownerId !== ctx.partnerId) return null;

    return this.docToEventDetail(doc);
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  async getSettings(ctx: PartnerContext): Promise<HostSettings> {
    const partnerId = ctx.partnerId;

    const [profileSnap, payoutSnap] = await Promise.all([
      this.db
        .collection('hosts')
        .doc(partnerId)
        .get()
        .catch((err) => {
          this.log.error(
            {
              service: 'HostService',
              method: 'getSettings',
              partnerId,
              collection: 'hosts',
              error: err?.message ?? String(err),
            },
            'Host profile read failed',
          );
          return null;
        }),
      this.db
        .collection('payout_configs')
        .doc(partnerId)
        .get()
        .catch((err) => {
          this.log.error(
            {
              service: 'HostService',
              method: 'getSettings',
              partnerId,
              collection: 'payout_configs',
              error: err?.message ?? String(err),
            },
            'Payout config read failed',
          );
          return null;
        }),
    ]);

    const profile = profileSnap?.exists ? (profileSnap.data() as Record<string, any>) : {};
    const payoutConfig = payoutSnap?.exists ? (payoutSnap.data() as Record<string, any>) : null;

    return {
      profile: {
        displayName: safeStr(profile.displayName || profile.name),
        bio: safeStr(profile.bio),
        tagline: safeStr(profile.tagline),
        profileImage: profile.profileImage ?? null,
        coverImage: profile.coverImage ?? null,
        contactEmail: safeStr(profile.contactEmail || profile.email),
        contactPhone: safeStr(profile.contactPhone || profile.phone),
        city: safeStr(profile.city),
        socialLinks: profile.socialLinks ?? {},
        genre: safeStr(profile.genre),
        instagramHandle: safeStr(profile.instagramHandle),
      },
      payoutConfig: payoutConfig ?? null,
      notifications: profile.notifications ?? {},
    };
  }

  // ── Team ──────────────────────────────────────────────────────────────────

  async getTeam(ctx: PartnerContext): Promise<TeamMember[]> {
    const snap = await this.db
      .collection('partner_memberships')
      .where('partnerId', '==', ctx.partnerId)
      .where('partnerType', '==', 'host')
      .limit(50)
      .get()
      .catch((err) => {
        this.log.error(
          { service: 'HostService', method: 'getTeam', error: err?.message ?? String(err) },
          'Team query failed',
        );
        return { docs: [] };
      });

    return (snap as any).docs.map((doc: any) => {
      const d = doc.data() as Record<string, any>;
      return {
        memberId: doc.id,
        uid: safeStr(d.uid),
        displayName: safeStr(d.displayName || d.name || d.email),
        email: safeStr(d.email),
        role: safeStr(d.role || 'staff'),
        isActive: d.isActive !== false,
        joinedAt: toIso(d.createdAt),
      } satisfies TeamMember;
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private docToEventSummary(
    doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
  ): EventSummary {
    const d = (doc.data() ?? {}) as Record<string, any>;
    return {
      eventId: doc.id,
      title: safeStr(d.title || d.name),
      startDate: toIso(d.startDate),
      endDate: toIso(d.endDate),
      venueId: safeStr(d.venueId),
      venueName: safeStr(d.venueName || d.venue?.name),
      status: (d.lifecycle ?? d.status ?? 'draft') as any,
      submissionStatus: (d.submissionStatus ?? 'not_submitted') as any,
      coverImage: d.coverImage ?? d.image ?? null,
      ticketsSold: toNum(d.ticketsSold ?? d.totalTicketsSold),
      revenue: toNum(d.revenue ?? d.totalRevenue),
      capacity: toNum(d.capacity ?? d.totalCapacity),
    };
  }

  private docToEventDetail(doc: FirebaseFirestore.DocumentSnapshot): EventDetail {
    const d = (doc.data() ?? {}) as Record<string, any>;
    const summary = this.docToEventSummary(doc);

    const tiers = Array.isArray(d.ticketTiers)
      ? d.ticketTiers.map((t: any) => ({
          tierId: safeStr(t.tierId || t.id),
          name: safeStr(t.name),
          price: toNum(t.price),
          capacity: toNum(t.capacity),
          sold: toNum(t.sold ?? t.ticketsSold),
        }))
      : [];

    const attributions = Array.isArray(d.promoterAttributions)
      ? d.promoterAttributions.map((a: any) => ({
          promoterId: safeStr(a.promoterId),
          linkId: safeStr(a.linkId),
          commissionRate: toNum(a.commissionRate),
        }))
      : [];

    return {
      ...summary,
      description: safeStr(d.description),
      ticketTiers: tiers,
      promoterAttributions: attributions,
      ownerPartnerId: safeStr(d.creatorId || d.hostId || d.ownerPartnerId),
      createdAt: toIso(d.createdAt),
      updatedAt: toIso(d.updatedAt),
    };
  }

  private async getRecentActivity(partnerId: string): Promise<ActivityItem[]> {
    const snap = await this.db
      .collection('activity_logs')
      .where('actorId', '==', partnerId)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get()
      .catch((err) => {
        this.log.error(
          {
            service: 'HostService',
            method: 'getRecentActivity',
            error: err?.message ?? String(err),
          },
          'Recent activity query failed',
        );
        return { docs: [] };
      });

    return (snap as any).docs.map((doc: any) => {
      const d = doc.data() as Record<string, any>;
      return {
        id: doc.id,
        type: safeStr(d.type),
        title: safeStr(d.title),
        detail: d.detail ?? null,
        timestamp: toIso(d.createdAt),
      } satisfies ActivityItem;
    });
  }

  private async getUpcomingEvents(partnerId: string): Promise<EventSummary[]> {
    const [creatorDocs, hostDocs] = await Promise.all([
      this.fetchUpcomingEventDocs('creatorId', partnerId),
      this.fetchUpcomingEventDocs('hostId', partnerId),
    ]);

    const docsById = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const doc of [...creatorDocs, ...hostDocs]) {
      docsById.set(doc.id, doc);
    }

    return [...docsById.values()]
      .sort((left, right) => {
        const leftDate =
          this.toDateValue(left.data()?.startDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const rightDate =
          this.toDateValue(right.data()?.startDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return leftDate - rightDate;
      })
      .slice(0, 8)
      .map((doc) => this.docToEventSummary(doc));
  }

  private async fetchUpcomingEventDocs(
    ownerField: 'creatorId' | 'hostId',
    partnerId: string,
  ): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
    const snap = await this.db
      .collection('events')
      .where(ownerField, '==', partnerId)
      .where('startDate', '>=', new Date())
      .orderBy('startDate', 'asc')
      .limit(12)
      .get()
      .catch((err) => {
        this.log.error(
          {
            service: 'HostService',
            method: 'fetchUpcomingEventDocs',
            error: err?.message ?? String(err),
          },
          'Upcoming events query failed',
        );
        return { docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] };
      });

    return (snap as any).docs ?? [];
  }

  private async getLatestOrders(partnerId: string): Promise<HostOrderSummary[]> {
    const docs = await this.fetchRecentOrderDocs(partnerId, 20);
    return docs.map((doc) => this.docToOrderSummary(doc));
  }

  private async getPerformance(
    partnerId: string,
    range: OverviewRange,
    metric: OverviewMetric,
  ): Promise<OverviewSeries> {
    const buckets = this.buildOverviewBuckets(range);
    const series: OverviewSeriesPoint[] = buckets.map((bucket) => ({
      date: bucket.start.toISOString(),
      label: bucket.label,
      value: 0,
      revenue: 0,
      ticketsSold: 0,
    }));

    if (buckets.length === 0) {
      return { range, metric, total: 0, series };
    }

    const earliestStart = buckets[0].start;
    const docs = await this.fetchRecentOrderDocs(partnerId, range === 'all' ? 500 : 250);

    for (const doc of docs) {
      const raw = doc.data() as Record<string, any>;
      const createdAt = this.toDateValue(raw.createdAt);
      if (!createdAt || createdAt < earliestStart) continue;

      const bucketIndex = buckets.findIndex(
        (bucket) => createdAt >= bucket.start && createdAt < bucket.end,
      );
      if (bucketIndex === -1) continue;

      series[bucketIndex].revenue += this.getOrderAmount(raw);
      series[bucketIndex].ticketsSold += this.getOrderTickets(raw);
    }

    for (const point of series) {
      point.value = metric === 'revenue' ? point.revenue : point.ticketsSold;
    }

    const total = series.reduce((sum, point) => sum + point.value, 0);
    return { range, metric, total, series };
  }

  private async fetchRecentOrderDocs(
    partnerId: string,
    limit: number,
  ): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
    const ordered = await this.db
      .collection('orders')
      .where('hostId', '==', partnerId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
      .catch((err) => {
        this.log.error(
          {
            service: 'HostService',
            method: 'fetchRecentOrderDocs',
            error: err?.message ?? String(err),
          },
          'Orders query failed',
        );
        return null;
      });

    if (ordered) return ordered.docs;

    const fallback = await this.db
      .collection('orders')
      .where('hostId', '==', partnerId)
      .limit(limit)
      .get()
      .catch((err) => {
        this.log.error(
          {
            service: 'HostService',
            method: 'fetchRecentOrderDocs',
            error: err?.message ?? String(err),
          },
          'Orders fallback query failed',
        );
        return { docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] };
      });

    return (fallback as any).docs ?? [];
  }

  private docToOrderSummary(doc: FirebaseFirestore.QueryDocumentSnapshot): HostOrderSummary {
    const d = doc.data() as Record<string, any>;

    return {
      orderId: doc.id,
      orderNumber: safeStr(
        d.orderNumber || d.displayOrderNumber || `ORD-${doc.id.slice(-6).toUpperCase()}`,
      ),
      customerName: safeStr(
        d.customerName || d.buyerName || d.guestName || d.userName || d.attendeeName || 'Guest',
      ),
      eventId: safeStr(d.eventId),
      eventName: safeStr(d.eventName || d.eventTitle || d.title),
      amount: this.getOrderAmount(d),
      ticketsCount: this.getOrderTickets(d),
      createdAt: toIso(d.createdAt),
      status: safeStr(d.status || 'paid'),
      source: this.getOrderSource(d),
    };
  }

  private getOrderAmount(d: Record<string, any>): number {
    if (typeof d.amount === 'number') return toNum(d.amount);
    if (typeof d.totalAmount === 'number') return toNum(d.totalAmount);
    if (typeof d.total === 'number') return toNum(d.total);
    if (typeof d.totalPaise === 'number') return toNum(d.totalPaise) / 100;
    return 0;
  }

  private getOrderTickets(d: Record<string, any>): number {
    if (typeof d.ticketCount === 'number') return toNum(d.ticketCount);
    if (typeof d.ticketsCount === 'number') return toNum(d.ticketsCount);
    if (typeof d.quantity === 'number') return toNum(d.quantity);
    if (Array.isArray(d.tickets)) return d.tickets.length;
    return 0;
  }

  private getOrderSource(d: Record<string, any>): 'ticket' | 'rsvp' {
    const raw = String(d.source || d.orderType || '')
      .trim()
      .toLowerCase();
    if (raw === 'rsvp' || d.isRsvp === true) return 'rsvp';
    return 'ticket';
  }

  private buildOverviewBuckets(
    range: OverviewRange,
  ): Array<{ start: Date; end: Date; label: string }> {
    const now = new Date();
    const starts: Date[] = [];

    if (range === '1d') {
      for (let index = 0; index < 8; index += 1) {
        const point = new Date(now);
        point.setHours(now.getHours() - (7 - index) * 3, 0, 0, 0);
        starts.push(point);
      }
    } else if (range === '1w') {
      for (let index = 0; index < 7; index += 1) {
        const point = new Date(now);
        point.setDate(now.getDate() - (6 - index));
        point.setHours(0, 0, 0, 0);
        starts.push(point);
      }
    } else if (range === '1m') {
      for (let index = 0; index < 6; index += 1) {
        const point = new Date(now);
        point.setDate(now.getDate() - (5 - index) * 5);
        point.setHours(0, 0, 0, 0);
        starts.push(point);
      }
    } else {
      for (let index = 0; index < 6; index += 1) {
        const point = new Date(now);
        point.setMonth(now.getMonth() - (5 - index), 1);
        point.setHours(0, 0, 0, 0);
        starts.push(point);
      }
    }

    return starts.map((start, index) => ({
      start,
      end: starts[index + 1] ?? new Date(now.getTime() + 3 * 60 * 60 * 1000),
      label: this.formatOverviewLabel(start, range),
    }));
  }

  private formatOverviewLabel(date: Date, range: OverviewRange): string {
    if (range === '1d') {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        hour12: true,
      });
    }

    if (range === 'all') {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      });
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  private toDateValue(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

    if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in (value as Record<string, unknown>)
    ) {
      try {
        const converted = (value as { toDate: () => Date }).toDate();
        return Number.isNaN(converted.getTime()) ? null : converted;
      } catch {
        return null;
      }
    }

    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
