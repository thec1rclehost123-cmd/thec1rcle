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

function hostPerformanceUnavailable(cause?: unknown) {
  const error: any = new Error('Canonical host performance data is unavailable');
  if (cause !== undefined) error.cause = cause;
  error.code = 'ANALYTICS_DATA_UNAVAILABLE';
  error.statusCode = 503;
  return error;
}

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
      this.getPerformance(ctx, range, metric),
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

    // NOTE: We intentionally avoid orderBy() on a different field than the where() clause
    // to prevent Firestore FAILED_PRECONDITION errors caused by missing composite indexes.
    // Sorting is done in-memory instead, which is safe for the page sizes involved.
    let q: any = this.db.collection('events').where('creatorId', '==', partnerId).limit(500); // overfetch so in-memory sort + slice is accurate

    if (status) q = q.where('lifecycle', '==', status);

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
      let q2: any = this.db.collection('events').where('hostId', '==', partnerId).limit(500);
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

    // Sort by startDate descending in memory (avoids composite index requirement)
    const allDocs: any[] = (snap?.docs ?? []).slice().sort((a: any, b: any) => {
      const aTime = this.toDateValue(a.data()?.startDate)?.getTime() ?? 0;
      const bTime = this.toDateValue(b.data()?.startDate)?.getTime() ?? 0;
      return bTime - aTime; // descending
    });

    // Apply cursor-based pagination after sort
    let startIdx = 0;
    if (cursor) {
      const cursorIdx = allDocs.findIndex((d: any) => d.id === cursor);
      if (cursorIdx !== -1) startIdx = cursorIdx + 1;
    }

    const page = allDocs.slice(startIdx, startIdx + cap + 1);
    const hasMore = page.length > cap;
    const items = page.slice(0, cap).map((doc: any) => this.docToEventSummary(doc));
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

    return (snap as any).docs
      .map((doc: any) => {
        const d = doc.data() as Record<string, any>;
        if (d.removedAt !== undefined && d.removedAt !== null) {
          return null;
        }
        return {
          memberId: doc.id,
          uid: safeStr(d.uid),
          displayName: safeStr(d.displayName || d.name || d.email),
          email: safeStr(d.email),
          role: safeStr(d.role || 'staff'),
          isActive: d.isActive !== false,
          joinedAt: toIso(d.createdAt),
        } satisfies TeamMember;
      })
      .filter(Boolean) as TeamMember[];
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private docToEventSummary(
    doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
  ): EventSummary {
    const d = (doc.data() ?? {}) as Record<string, any>;
    const rawCoverImage = d.coverImage || d.image || d.poster || '';
    const hasValidCover = rawCoverImage && !rawCoverImage.includes('placeholder.svg');
    return {
      eventId: doc.id,
      title: safeStr(d.title || d.name),
      startDate: toIso(d.startDate),
      endDate: toIso(d.endDate),
      venueId: safeStr(d.venueId),
      venueName: safeStr(d.venueName || d.venue?.name),
      status: (d.lifecycle ?? d.status ?? 'draft') as any,
      submissionStatus: (d.submissionStatus ?? 'not_submitted') as any,
      coverImage: hasValidCover ? rawCoverImage : null,
      ticketsSold: toNum(d.ticketsSold ?? d.totalTicketsSold),
      revenue: toNum(d.revenue ?? d.totalRevenue),
      capacity: toNum(d.capacity ?? d.totalCapacity),
      host: safeStr(d.host),
      hostName: safeStr(d.hostName),
      hostId: safeStr(d.hostId),
      creatorId: safeStr(d.creatorId),
      creatorRole: safeStr(d.creatorRole),
    };
  }

  private docToEventDetail(doc: FirebaseFirestore.DocumentSnapshot): EventDetail {
    const d = (doc.data() ?? {}) as Record<string, any>;
    const summary = this.docToEventSummary(doc);

    const rawTiers = Array.isArray(d.ticketTiers)
      ? d.ticketTiers
      : Array.isArray(d.tiers)
        ? d.tiers
        : Array.isArray(d.tickets)
          ? d.tickets
          : [];
    const tiers = rawTiers.map((t: any) => ({
      tierId: safeStr(t.tierId || t.id),
      name: safeStr(t.name),
      price: toNum(t.price),
      capacity: toNum(t.capacity ?? t.quantity ?? t.maxQuantity),
      sold: toNum(t.sold ?? t.ticketsSold),
    }));

    const attributions = Array.isArray(d.promoterAttributions)
      ? d.promoterAttributions.map((a: any) => ({
          promoterId: safeStr(a.promoterId),
          linkId: safeStr(a.linkId),
          commissionRate: toNum(a.commissionRate),
        }))
      : [];

    const venueName = safeStr(
      d.venueName || (typeof d.venue === 'string' ? d.venue : d.venue?.name) || '',
    );

    // Use an any-typed intermediate to carry the extended workspace fields
    // without widening the exported EventDetail type in types.ts.
    const result: any = {
      ...summary,
      description: safeStr(d.description),
      ticketTiers: tiers,
      promoterAttributions: attributions,
      ownerPartnerId: safeStr(d.creatorId || d.hostId || d.ownerPartnerId),
      createdAt: toIso(d.createdAt),
      updatedAt: toIso(d.updatedAt),
      // Fields expected by the host event workspace PageClient
      id: doc.id,
      lifecycle: safeStr(d.lifecycle || d.status || 'draft'),
      venue: venueName,
      slug: d.slug ?? null,
      hostId: safeStr(d.hostId || d.creatorId),
      hostName: safeStr(d.hostName),
      venueAddress: safeStr(d.venueAddress),
      city: safeStr(d.city),
      eventUrl: safeStr(d.eventUrl || d.url),
      shortDescription: safeStr(d.shortDescription),
      tags: Array.isArray(d.tags) ? d.tags : [],
      settings: d.settings ?? {},
      promoterSettings: d.promoterSettings ?? { enabled: false, allowedPromoterIds: [] },
      image: d.image ?? null,
      stats: d.stats ?? {},
    };
    return result as EventDetail;
  }

  private async getRecentActivity(partnerId: string): Promise<ActivityItem[]> {
    // Avoid orderBy('createdAt') alongside where('actorId') — requires a composite index.
    // Fetch without ordering and sort in memory instead.
    const snap = await this.db
      .collection('activity_logs')
      .where('actorId', '==', partnerId)
      .limit(50)
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

    return ((snap as any).docs as any[])
      .sort((a, b) => {
        const aTime = this.toDateValue(a.data()?.createdAt)?.getTime() ?? 0;
        const bTime = this.toDateValue(b.data()?.createdAt)?.getTime() ?? 0;
        return bTime - aTime; // descending
      })
      .slice(0, 10)
      .map((doc: any) => {
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
    // Avoid orderBy('startDate') alongside where(ownerField) — requires a composite index.
    // Instead, fetch without orderBy and filter/sort in memory.
    const snap = await this.db
      .collection('events')
      .where(ownerField, '==', partnerId)
      .limit(100)
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

    const now = new Date();
    return ((snap as any).docs ?? []).filter((doc: any) => {
      const startDate = this.toDateValue(doc.data()?.startDate);
      return startDate !== null && startDate >= now;
    });
  }

  private async getLatestOrders(partnerId: string): Promise<HostOrderSummary[]> {
    const docs = await this.fetchRecentOrderDocs(partnerId, 20);
    return docs.map((doc) => this.docToOrderSummary(doc));
  }

  async getPerformance(
    ctx: PartnerContext,
    range: OverviewRange,
    metric: OverviewMetric,
  ): Promise<OverviewSeries> {
    const partnerId = ctx.partnerId;
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
    const fromDate = earliestStart.toISOString().slice(0, 10);
    const snapshot = await this.db
      .collection('partner_finance_aggregates')
      .doc(partnerId)
      .collection('daily')
      .where('date', '>=', fromDate)
      .orderBy('date', 'asc')
      .limit(400)
      .get()
      .catch((err) => {
        this.log.error(
          {
            service: 'HostService',
            method: 'getPerformance',
            partnerId,
            range,
            metric,
            error: err?.message ?? String(err),
          },
          'Canonical host performance projection read failed',
        );
        throw hostPerformanceUnavailable(err);
      });

    for (const doc of snapshot.docs) {
      const raw = doc.data() as Record<string, any>;
      const dateKey = safeStr(raw.date || doc.id);
      const createdAt = this.toDateValue(`${dateKey}T12:00:00.000Z`);
      if (!createdAt) continue;

      const bucketIndex = buckets.findIndex(
        (bucket) => createdAt >= bucket.start && createdAt < bucket.end,
      );
      if (bucketIndex === -1) continue;

      series[bucketIndex].revenue += toNum(raw.grossRevenue) / 100;
      series[bucketIndex].ticketsSold += toNum(raw.ticketsSold);
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
      for (let index = 0; index < 2; index += 1) {
        const point = new Date(now);
        point.setDate(now.getDate() - (1 - index));
        point.setHours(0, 0, 0, 0);
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

    return starts.map((start, index) => {
      let end = starts[index + 1];
      if (!end) {
        end = new Date(start);
        if (range === 'all') {
          end.setMonth(end.getMonth() + 1, 1);
        } else {
          end.setDate(end.getDate() + 1);
        }
        end.setHours(0, 0, 0, 0);
      }
      return {
        start,
        end,
        label: this.formatOverviewLabel(start, range),
      };
    });
  }

  private formatOverviewLabel(date: Date, range: OverviewRange): string {
    if (range === '1d') {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
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
