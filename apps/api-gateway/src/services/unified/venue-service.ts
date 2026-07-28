import type { Firestore } from 'firebase-admin/firestore';
import type {
  PartnerContext,
  EventSummary,
  EventFilters,
  VenueOverviewStats,
  PartnerSummary,
  GuestOpsSummary,
  PaginatedResult,
  ActivityItem,
} from './types.js';
import { toIso, toNum, safeStr } from './types.js';
import type { ServiceContext, ServiceLogger } from './service-context.js';
import { consoleLogger } from './service-context.js';

// ─── VenueService ─────────────────────────────────────────────────────────────
//
// Phase 1: READ-only. Delegates all scheduling operations to SchedulingService.
// Venue identity: ctx.partnerId is the venueId for venue_owner / venue_manager.

export class VenueService {
  private db: Firestore;
  private log: ServiceLogger;

  constructor(ctx: ServiceContext);
  /** @deprecated Use ServiceContext form. Retained for backward compatibility. */
  constructor(db: Firestore);
  constructor(arg: ServiceContext | Firestore) {
    if ('db' in arg && 'log' in arg) {
      this.db = arg.db;
      this.log = arg.log;
    } else {
      this.db = arg as Firestore;
      this.log = consoleLogger;
    }
  }

  // ── Overview ─────────────────────────────────────────────────────────────

  async getOverview(ctx: PartnerContext): Promise<{
    stats: VenueOverviewStats;
    tonightOps: Record<string, any> | null;
    alerts: ActivityItem[];
  }> {
    const venueId = ctx.partnerId;

    const [statsSnap, tonightSnap] = await Promise.all([
      this.db
        .collection('venue_stats')
        .doc(venueId)
        .get()
        .catch((err) => {
          this.log.error(
            {
              service: 'VenueService',
              method: 'getOverview',
              venueId,
              error: err?.message ?? String(err),
            },
            'venue_stats read failed',
          );
          return null;
        }),
      this.db
        .collection('events')
        .where('venueId', '==', venueId)
        .where('lifecycle', 'in', ['live', 'published'])
        .orderBy('startDate', 'asc')
        .limit(1)
        .get()
        .catch((err) => {
          this.log.error(
            {
              service: 'VenueService',
              method: 'getOverview',
              venueId,
              error: err?.message ?? String(err),
            },
            'Tonight ops query failed',
          );
          return null;
        }),
    ]);

    const raw = statsSnap?.exists ? (statsSnap.data() as Record<string, any>) : {};
    const stats: VenueOverviewStats = {
      totalEventsHosted: toNum(raw.totalEventsHosted),
      upcomingEventsCount: toNum(raw.upcomingEventsCount),
      totalGuestsCheckedIn: toNum(raw.totalGuestsCheckedIn),
      totalRevenue: toNum(raw.totalRevenue),
      activePartnersCount: toNum(raw.activePartnersCount),
      occupancyRate: toNum(raw.occupancyRate),
    };

    const tonightEvent = tonightSnap && !tonightSnap.empty ? tonightSnap.docs[0] : null;
    const tonightOps = tonightEvent
      ? {
          eventId: tonightEvent.id,
          title: safeStr(tonightEvent.data()?.title),
          startDate: toIso(tonightEvent.data()?.startDate),
          checkedIn: toNum(tonightEvent.data()?.checkedInCount),
          capacity: toNum(tonightEvent.data()?.capacity),
        }
      : null;

    const alerts = await this.getAlerts(venueId);

    return { stats, tonightOps, alerts };
  }

  // ── Events ────────────────────────────────────────────────────────────────

  async getEvents(
    ctx: PartnerContext,
    filters: EventFilters,
  ): Promise<PaginatedResult<EventSummary>> {
    const { status, date, cursor, limit = 20 } = filters;
    const cap = Math.min(limit, 100);
    const venueId = ctx.partnerId;

    let q: any = this.db
      .collection('events')
      .where('venueId', '==', venueId)
      .orderBy('startDate', 'desc')
      .limit(cap + 1);

    if (status) q = q.where('lifecycle', '==', status);
    if (date === 'today') {
      const todayKey = new Date().toISOString().slice(0, 10);
      q = q
        .where('startDate', '>=', todayKey)
        .where('startDate', '<=', `${todayKey}T23:59:59.999Z`);
    }
    if (cursor) {
      const cursorDoc = await this.db.collection('events').doc(cursor).get();
      if (cursorDoc.exists) q = q.startAfter(cursorDoc);
    }

    const snap = await q.get().catch((err: any) => {
      this.log.error(
        {
          service: 'VenueService',
          method: 'getEvents',
          venueId: ctx.partnerId,
          error: err?.message ?? String(err),
        },
        'Events query failed',
      );
      const unavailable: any = new Error('Venue event data is temporarily unavailable');
      unavailable.code = 'EVENT_DATA_UNAVAILABLE';
      unavailable.statusCode = 503;
      throw unavailable;
    });
    const docs: FirebaseFirestore.QueryDocumentSnapshot[] = (snap as any).docs;
    const hasMore = docs.length > cap;
    const items = docs.slice(0, cap).map((doc) => this.docToEventSummary(doc));
    const nextCursor = hasMore ? (items[items.length - 1]?.eventId ?? null) : null;

    return { data: items, hasMore, nextCursor };
  }

  // ── Guest Ops ─────────────────────────────────────────────────────────────

  async getGuestOps(ctx: PartnerContext, eventId: string): Promise<GuestOpsSummary> {
    const [ordersSnap, checkInsSnap] = await Promise.all([
      this.db
        .collection('orders')
        .where('eventId', '==', eventId)
        .get()
        .catch((err) => {
          this.log.error(
            {
              service: 'VenueService',
              method: 'getGuestOps',
              venueId: ctx.partnerId,
              eventId,
              collection: 'orders',
              error: err?.message ?? String(err),
            },
            'Guest orders query failed',
          );
          return { docs: [] as any[] };
        }),
      this.db
        .collection('check_ins')
        .where('eventId', '==', eventId)
        .get()
        .catch((err) => {
          this.log.error(
            {
              service: 'VenueService',
              method: 'getGuestOps',
              venueId: ctx.partnerId,
              eventId,
              collection: 'check_ins',
              error: err?.message ?? String(err),
            },
            'Guest check-ins query failed',
          );
          return { docs: [] as any[], size: 0 };
        }),
    ]);

    const paidOrders = (ordersSnap as any).docs.filter((doc: any) => {
      const status = String(doc.data()?.status || '').toLowerCase();
      return ['paid', 'confirmed', 'completed'].includes(status);
    });
    const totalGuests = paidOrders.reduce(
      (sum: number, doc: any) => sum + toNum(doc.data()?.ticketCount ?? 1),
      0,
    );
    const denied = paidOrders.reduce(
      (sum: number, doc: any) =>
        doc.data()?.deniedAt ? sum + toNum(doc.data()?.ticketCount ?? 1) : sum,
      0,
    );
    const checkedIn = (checkInsSnap as any).size ?? (checkInsSnap as any).docs?.length ?? 0;

    return {
      eventId,
      totalGuests,
      checkedIn,
      pending: Math.max(0, totalGuests - checkedIn - denied),
      denied,
    };
  }

  // ── Partnerships ──────────────────────────────────────────────────────────

  async getPartnerships(ctx: PartnerContext): Promise<PartnerSummary[]> {
    const snap = await this.db
      .collection('partner_memberships')
      .where('venueId', '==', ctx.partnerId)
      .where('isActive', '==', true)
      .limit(100)
      .get()
      .catch((err) => {
        this.log.error(
          {
            service: 'VenueService',
            method: 'getPartnerships',
            venueId: ctx.partnerId,
            error: err?.message ?? String(err),
          },
          'Partnerships query failed',
        );
        return { docs: [] };
      });

    return (snap as any).docs.map((doc: any) => {
      const d = doc.data() as Record<string, any>;
      return {
        partnerId: safeStr(d.partnerId || d.uid),
        partnershipId: doc.id,
        displayName: safeStr(d.displayName || d.name || d.email),
        type: (d.partnerType ?? 'host') as any,
        status: d.status ?? (d.isActive ? 'active' : 'inactive'),
        connectedAt: toIso(d.createdAt),
      } satisfies PartnerSummary;
    });
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  async getSettings(ctx: PartnerContext): Promise<Record<string, any>> {
    const venueId = ctx.partnerId;
    const snap = await this.db
      .collection('venues')
      .doc(venueId)
      .get()
      .catch((err) => {
        this.log.error(
          {
            service: 'VenueService',
            method: 'getSettings',
            venueId,
            error: err?.message ?? String(err),
          },
          'Venue settings read failed',
        );
        return null;
      });
    if (!snap?.exists) return {};
    const d = snap.data() as Record<string, any>;
    return {
      venueId,
      name: safeStr(d.name || d.displayName),
      description: safeStr(d.description),
      city: safeStr(d.city),
      address: d.address ?? {},
      capacity: toNum(d.capacity),
      facilities: Array.isArray(d.facilities) ? d.facilities : [],
      operatingHours: d.operatingHours ?? {},
      contactEmail: safeStr(d.contactEmail || d.email),
      contactPhone: safeStr(d.contactPhone || d.phone),
      profileImage: d.profileImage ?? null,
      coverImage: d.coverImage ?? null,
      socialLinks: d.socialLinks ?? {},
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private docToEventSummary(doc: FirebaseFirestore.QueryDocumentSnapshot): EventSummary {
    const d = doc.data() as Record<string, any>;
    const rawCoverImage = d.coverImage || d.image || d.poster || '';
    const hasValidCover = rawCoverImage && !rawCoverImage.includes('placeholder.svg');
    return {
      ...d,
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

  private async getAlerts(venueId: string): Promise<ActivityItem[]> {
    const snap = await this.db
      .collection('venue_alerts')
      .where('venueId', '==', venueId)
      .where('resolved', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get()
      .catch((err) => {
        this.log.error(
          {
            service: 'VenueService',
            method: 'getAlerts',
            venueId,
            error: err?.message ?? String(err),
          },
          'Alerts query failed',
        );
        return { docs: [] };
      });

    return (snap as any).docs.map((doc: any) => {
      const d = doc.data() as Record<string, any>;
      return {
        id: doc.id,
        type: safeStr(d.type || 'alert'),
        title: safeStr(d.title || d.message),
        detail: d.detail ?? d.description ?? null,
        timestamp: toIso(d.createdAt),
      } satisfies ActivityItem;
    });
  }
}
