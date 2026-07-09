import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue, FieldPath } from 'firebase-admin/firestore';
import type {
  PartnerContext,
  EventSummary,
  EventFilters,
  PromoterOverviewStats,
  PromoterLink,
  LinkFilters,
  LinkAnalytics,
  PromoterConnection,
  ConnectionStatus,
  PaginatedResult,
  DataPoint,
} from './types.js';
import { toIso, toNum, safeStr } from './types.js';
import type { ServiceContext, ServiceLogger } from './service-context.js';
import { consoleLogger } from './service-context.js';
import { normalizePromoterCommissionRate } from '../../lib/partner-hardening.js';
import { resolvePartnerDocument } from '../../utils/partner-profiles.js';

// ─── PromoterService ──────────────────────────────────────────────────────────
//
// Phase 1: READ-only + link creation + connection management.
// Canonical identity: ctx.partnerId is the promoterId throughout.
// Reads from: promoter_links, partner_ledger, promoter_connections, events.

export class PromoterService {
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
      this.redis = arg.redis;
    } else {
      this.db = arg as Firestore;
      this.log = consoleLogger;
    }
  }

  // ── Overview ─────────────────────────────────────────────────────────────

  async getOverview(ctx: PartnerContext): Promise<{
    stats: PromoterOverviewStats;
    topLinks: PromoterLink[];
    recentActivity: Array<{ id: string; type: string; title: string; timestamp: string | null }>;
  }> {
    const promoterId = ctx.partnerId;
    const startedAt = Date.now();

    const linksSnap = await this.db
      .collection('promoter_links')
      .where('promoterId', '==', promoterId)
      .where('active', '==', true)
      .orderBy('conversionCount', 'desc')
      .limit(5)
      .get()
      .catch((err) => {
        this.log.error(
          {
            service: 'PromoterService',
            method: 'getOverview',
            promoterId,
            error: err?.message ?? String(err),
          },
          'Top links query failed',
        );
        return { docs: [] };
      });

    const topLinks = (linksSnap as any).docs.map((doc: any) => this.docToLink(doc));

    const stats = await this.computeStats(promoterId);

    const durationMs = Date.now() - startedAt;
    if (durationMs > 500) {
      this.log.warn(
        { service: 'PromoterService', method: 'getOverview', promoterId, durationMs },
        'Slow overview computation',
      );
    }

    return {
      stats,
      topLinks,
      recentActivity: [],
    };
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  async getAnalytics(
    ctx: PartnerContext,
    filters: { from?: string; to?: string; linkId?: string },
  ): Promise<{
    timeSeries: DataPoint[];
    byLink: Array<{
      linkId: string;
      code: string;
      clicks: number;
      conversions: number;
      revenue: number;
    }>;
  }> {
    const promoterId = ctx.partnerId;
    const startedAt = Date.now();

    let q: any = this.db
      .collection('promoter_links')
      .where('promoterId', '==', promoterId)
      .limit(100);

    if (filters.linkId) q = q.where('__name__', '==', filters.linkId);

    const snap = await q.get().catch((err: any) => {
      this.log.error(
        {
          service: 'PromoterService',
          method: 'getAnalytics',
          promoterId,
          error: err?.message ?? String(err),
        },
        'Analytics links query failed',
      );
      return { docs: [] };
    });

    const byLink = (snap as any).docs.map((doc: any) => {
      const d = doc.data() as Record<string, any>;
      return {
        linkId: doc.id,
        code: safeStr(d.code),
        clicks: toNum(d.clickCount),
        conversions: toNum(d.conversionCount),
        revenue: toNum(d.revenue),
      };
    });

    // P0-3: Aggregate real time-series data from daily click buckets
    // If we're getting analytics for a specific link, query that link's bucket.
    // If getting overall analytics, query the global promoter bucket.
    const timeSeries = filters.linkId
      ? await this.buildTimeSeries({ linkIds: [filters.linkId] }, filters.from, filters.to)
      : await this.buildTimeSeries({ promoterId }, filters.from, filters.to);

    const durationMs = Date.now() - startedAt;
    if (durationMs > 500) {
      this.log.warn(
        {
          service: 'PromoterService',
          method: 'getAnalytics',
          promoterId,
          durationMs,
          linkCount: byLink.length,
        },
        'Slow analytics aggregation',
      );
    }

    return { timeSeries, byLink };
  }

  // ── Links ─────────────────────────────────────────────────────────────────

  async getLinks(
    ctx: PartnerContext,
    filters: LinkFilters,
  ): Promise<PaginatedResult<PromoterLink>> {
    const { eventId, active, cursor, limit = 20 } = filters;
    const cap = Math.min(limit, 200);
    const promoterId = ctx.partnerId;

    let q: any = this.db
      .collection('promoter_links')
      .where('promoterId', '==', promoterId)
      .orderBy('createdAt', 'desc')
      .limit(cap + 1);

    if (eventId) q = q.where('eventId', '==', eventId);
    if (active !== undefined) q = q.where('active', '==', active);
    if (cursor) {
      const cursorDoc = await this.db.collection('promoter_links').doc(cursor).get();
      if (cursorDoc.exists) q = q.startAfter(cursorDoc);
    }

    const snap = await q.get().catch((err: any) => {
      this.log.error(
        {
          service: 'PromoterService',
          method: 'getLinks',
          promoterId,
          error: err?.message ?? String(err),
        },
        'Links query failed',
      );
      return { docs: [] };
    });
    const docs: any[] = (snap as any).docs;
    const hasMore = docs.length > cap;
    const items = docs.slice(0, cap).map((doc) => this.docToLink(doc));
    const nextCursor = hasMore ? (items[items.length - 1]?.linkId ?? null) : null;

    return { data: items, hasMore, nextCursor };
  }

  async createLink(
    ctx: PartnerContext,
    input: { eventId: string; commissionRate: number },
  ): Promise<PromoterLink> {
    const code = this.generateCode();
    const now = new Date();

    const ref = await this.db.collection('promoter_links').add({
      promoterId: ctx.partnerId,
      eventId: input.eventId,
      code,
      active: true,
      clickCount: 0,
      conversionCount: 0,
      commissionRate: normalizePromoterCommissionRate(input.commissionRate),
      revenue: 0,
      createdAt: now,
      updatedAt: now,
    });

    this.log.info(
      {
        service: 'PromoterService',
        method: 'createLink',
        promoterId: ctx.partnerId,
        linkId: ref.id,
        eventId: input.eventId,
      },
      'Promoter link created',
    );

    const doc = await ref.get();
    return this.docToLink(doc);
  }

  async updateLink(
    ctx: PartnerContext,
    linkId: string,
    input: { active?: boolean },
  ): Promise<PromoterLink | null> {
    const ref = this.db.collection('promoter_links').doc(linkId);
    const doc = await ref.get();
    if (!doc.exists) return null;

    const data = doc.data() as Record<string, any>;
    if (safeStr(data.promoterId) !== ctx.partnerId) return null;

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (input.active !== undefined) updates.active = input.active;

    await ref.update(updates);
    const updated = await ref.get();
    return this.docToLink(updated);
  }

  async getLinkAnalytics(ctx: PartnerContext, linkId: string): Promise<any | null> {
    const doc = await this.db.collection('promoter_links').doc(linkId).get();
    if (!doc.exists) return null;

    const data = doc.data() as Record<string, any>;
    if (safeStr(data.promoterId) !== ctx.partnerId) return null;

    const clicks = toNum(data.clickCount);
    const conversions = toNum(data.conversionCount);
    const revenue = toNum(data.revenue);
    const conversionRate = clicks > 0 ? conversions / clicks : 0;

    // P0-3: Aggregate real time-series data from daily click buckets
    const timeSeries = await this.buildTimeSeries({ linkIds: [linkId] });

    return {
      linkId,
      link: this.docToLink(doc),
      clicks,
      conversions,
      revenue,
      conversionRate,
      timeSeries,
    };
  }

  // P1: trackClick uses Redis batching to buffer clicks and reduce Firestore writes.
  // Falls back to direct FieldValue.increment if Redis is unavailable.
  async trackClick(linkCode: string): Promise<void> {
    const BATCH_SIZE = 5;
    const redisKey = `c1rcle:promoter:clicks:batch:${linkCode}`;
    let batchCount = 1;

    if (this.redis && this.redis.status === 'ready') {
      try {
        batchCount = await this.redis.incr(redisKey);
        if (batchCount < BATCH_SIZE) {
          return; // Buffered in Redis, will write to Firestore later
        }
        // Hit threshold, flush to Firestore
        await this.redis.del(redisKey); // Reset batch
      } catch (err: any) {
        this.log.warn(
          { service: 'PromoterService', method: 'trackClick', linkCode, error: err.message },
          'Redis batching failed, falling back to direct write',
        );
        batchCount = 1;
      }
    }

    const snap = await this.db
      .collection('promoter_links')
      .where('code', '==', linkCode)
      .where('active', '==', true)
      .limit(1)
      .get()
      .catch((err) => {
        this.log.error(
          {
            service: 'PromoterService',
            method: 'trackClick',
            linkCode,
            error: err?.message ?? String(err),
          },
          'Link lookup failed for click tracking',
        );
        return null;
      });

    if (!snap || snap.empty) return;

    const linkDoc = snap.docs[0];
    const promoterId = safeStr(linkDoc.data().promoterId);

    // P1: Atomic increment — eliminates the read-modify-write race.
    await linkDoc.ref
      .update({ clickCount: FieldValue.increment(batchCount), updatedAt: new Date() })
      .catch((err) => {
        this.log.error(
          {
            service: 'PromoterService',
            method: 'trackClick',
            linkId: linkDoc.id,
            error: err?.message ?? String(err),
          },
          'Link click count increment failed',
        );
      });

    // P0-3 Part A: Write a lightweight daily-bucket document for time-series aggregation.
    // Uses FieldValue.increment for safe concurrent writes. Non-blocking, best-effort.
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // 1. Link-specific bucket
    this.db
      .collection('promoter_link_events')
      .doc(linkDoc.id)
      .collection('daily')
      .doc(today)
      .set(
        { clicks: FieldValue.increment(batchCount), date: today, linkId: linkDoc.id },
        { merge: true },
      )
      .catch((err) => {
        this.log.warn(
          {
            service: 'PromoterService',
            method: 'trackClick',
            linkId: linkDoc.id,
            date: today,
            error: err?.message ?? String(err),
          },
          'Daily link bucket write failed (non-critical)',
        );
      });

    // 2. Global promoter bucket
    if (promoterId) {
      this.db
        .collection('promoter_daily_stats')
        .doc(promoterId)
        .collection('daily')
        .doc(today)
        .set({ clicks: FieldValue.increment(batchCount), date: today, promoterId }, { merge: true })
        .catch((err) => {
          this.log.warn(
            {
              service: 'PromoterService',
              method: 'trackClick',
              promoterId,
              date: today,
              error: err?.message ?? String(err),
            },
            'Daily global bucket write failed (non-critical)',
          );
        });
    }
  }

  // ── Events ────────────────────────────────────────────────────────────────

  // P0-2: Fixed — removed hard cap of 10 events. Now uses cursor-based pagination
  // and chunked Firestore `in` queries (max 30 per batch) to support promoters
  // with any number of linked events.
  //
  // P1: Pagination validated — ordering is by eventId (stable), cursor is
  // index-based into the sorted allEventIds array, and chunked `in` queries
  // are reassembled in insertion order via docsMap.
  async getEvents(
    ctx: PartnerContext,
    filters: EventFilters,
  ): Promise<PaginatedResult<EventSummary>> {
    const { cursor, limit = 20 } = filters;
    const cap = Math.min(limit, 100);
    const startedAt = Date.now();

    // Fetch all event IDs from promoter_links (up to 500 unique)
    const linksSnap = await this.db
      .collection('promoter_links')
      .where('promoterId', '==', ctx.partnerId)
      .select('eventId')
      .limit(500)
      .get()
      .catch((err) => {
        this.log.error(
          {
            service: 'PromoterService',
            method: 'getEvents',
            promoterId: ctx.partnerId,
            error: err?.message ?? String(err),
          },
          'Event links query failed',
        );
        return { docs: [] };
      });

    const allEventIds = [
      ...new Set(
        (linksSnap as any).docs.map((d: any) => safeStr(d.data().eventId)).filter(Boolean),
      ),
    ] as string[];

    // P1: Sort eventIds for deterministic pagination ordering.
    // Without this, Set iteration order depends on insertion order which
    // varies across queries if Firestore returns docs in different order.
    allEventIds.sort();

    if (!allEventIds.length) return { data: [], hasMore: false, nextCursor: null };

    // Apply cursor (eventId offset into sorted list)
    const startIdx = cursor ? allEventIds.indexOf(cursor) + 1 : 0;
    if (cursor && startIdx === 0) {
      // Cursor not found in ID list — start from beginning to avoid data loss
      this.log.warn(
        {
          service: 'PromoterService',
          method: 'getEvents',
          promoterId: ctx.partnerId,
          invalidCursor: cursor,
        },
        'Invalid cursor — resetting to start',
      );
    }
    const effectiveStartIdx = cursor && startIdx === 0 ? 0 : startIdx;
    const page = allEventIds.slice(effectiveStartIdx, effectiveStartIdx + cap + 1);
    const hasMore = page.length > cap;
    const pageIds = page.slice(0, cap);

    if (!pageIds.length) return { data: [], hasMore: false, nextCursor: null };

    // Firestore `in` supports max 30 values; chunk accordingly
    const CHUNK = 30;
    const chunks: string[][] = [];
    for (let i = 0; i < pageIds.length; i += CHUNK) {
      chunks.push(pageIds.slice(i, i + CHUNK));
    }

    const snapResults = await Promise.all(
      chunks.map((chunk) =>
        this.db
          .collection('events')
          .where(FieldPath.documentId(), 'in', chunk)
          .get()
          .catch((err) => {
            this.log.error(
              {
                service: 'PromoterService',
                method: 'getEvents',
                chunkSize: chunk.length,
                error: err?.message ?? String(err),
              },
              'Event batch query failed',
            );
            return { docs: [] };
          }),
      ),
    );

    const docsMap = new Map<string, any>();
    for (const snap of snapResults) {
      for (const doc of (snap as any).docs) {
        docsMap.set(doc.id, doc);
      }
    }

    // Preserve order from pageIds (sorted)
    const items: EventSummary[] = pageIds
      .map((id) => docsMap.get(id))
      .filter(Boolean)
      .map((doc: any) => {
        const d = doc.data() as Record<string, any>;
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
        } satisfies EventSummary;
      });

    const durationMs = Date.now() - startedAt;
    if (durationMs > 500) {
      this.log.warn(
        {
          service: 'PromoterService',
          method: 'getEvents',
          promoterId: ctx.partnerId,
          durationMs,
          totalEvents: allEventIds.length,
          pageSize: items.length,
        },
        'Slow event listing',
      );
    }

    return {
      data: items,
      hasMore,
      nextCursor: hasMore ? pageIds[pageIds.length - 1] : null,
    };
  }

  // ── Connections ───────────────────────────────────────────────────────────

  // P0-6: Fixed — now queries both fromPartnerId (outgoing) and toPartnerId (incoming)
  // in parallel, then merges and deduplicates results.
  async getConnections(
    ctx: PartnerContext,
    status?: ConnectionStatus,
  ): Promise<PromoterConnection[]> {
    const base = this.db.collection('promoter_connections');

    const buildQ = (field: 'fromPartnerId' | 'toPartnerId') => {
      let q: any = base.where(field, '==', ctx.partnerId).limit(1000);
      if (status) q = q.where('status', '==', status);
      return q.get().catch((err: any) => {
        this.log.error(
          {
            service: 'PromoterService',
            method: 'getConnections',
            field,
            partnerId: ctx.partnerId,
            error: err?.message ?? String(err),
          },
          'Connections query failed',
        );
        return { docs: [] };
      });
    };

    const [outSnap, inSnap] = await Promise.all([buildQ('fromPartnerId'), buildQ('toPartnerId')]);

    const seen = new Set<string>();
    const toConn = (doc: any): PromoterConnection => {
      const d = doc.data() as Record<string, any>;
      return {
        connectionId: doc.id,
        fromPartnerId: safeStr(d.fromPartnerId),
        toPartnerId: safeStr(d.toPartnerId),
        status: (d.status ?? 'pending') as ConnectionStatus,
        eventId: d.eventId ?? null,
        createdAt: toIso(d.createdAt),
        updatedAt: toIso(d.updatedAt),
        initiatedBy: d.initiatedBy ? safeStr(d.initiatedBy) : null,
      };
    };

    const results: PromoterConnection[] = [];
    for (const snap of [outSnap, inSnap]) {
      for (const doc of (snap as any).docs) {
        if (!seen.has(doc.id)) {
          seen.add(doc.id);
          results.push(toConn(doc));
        }
      }
    }
    return results;
  }

  async requestConnection(
    ctx: PartnerContext,
    targetPartnerId: string,
    eventId?: string,
  ): Promise<PromoterConnection> {
    const now = new Date();

    // Resolve target partner profile details
    const targetDoc = await resolvePartnerDocument(this.db, targetPartnerId).catch(() => null);
    const targetType = targetDoc?.type || 'venue';
    const targetName = targetDoc?.doc?.displayName || targetDoc?.doc?.name || '';

    // Fetch promoter info
    let promoterName = '';
    try {
      const promoterDoc = await this.db.collection('promoters').doc(ctx.partnerId).get();
      if (promoterDoc.exists) {
        promoterName = promoterDoc.data()?.displayName || promoterDoc.data()?.name || '';
      }
    } catch {}

    const connectionData: any = {
      fromPartnerId: ctx.partnerId,
      toPartnerId: targetPartnerId,
      promoterId: ctx.partnerId,
      promoterName,
      targetId: targetPartnerId,
      targetType,
      targetName,
      status: 'pending',
      eventId: eventId ?? null,
      createdAt: now,
      updatedAt: now,
      initiatedBy: 'promoter',
    };

    if (targetType === 'host') {
      connectionData.hostId = targetPartnerId;
      connectionData.hostName = targetName;
    } else if (targetType === 'venue') {
      connectionData.venueId = targetPartnerId;
      connectionData.venueName = targetName;
    }

    const ref = await this.db.collection('promoter_connections').add(connectionData);

    // BUG-5 fix: write notification to target partner (non-critical — never block the request)
    this.db
      .collection('notifications')
      .add({
        recipientId: targetPartnerId,
        recipientType: targetType,
        type: 'promoter_request',
        title: 'New Connection Request',
        message: `${promoterName || 'A promoter'} wants to connect with you.`,
        read: false,
        createdAt: now.toISOString(),
        data: {
          connectionId: ref.id,
          promoterId: ctx.partnerId,
          targetId: targetPartnerId,
          targetType,
          initiatedBy: 'promoter',
        },
      })
      .catch((err: any) =>
        this.log.warn({ connectionId: ref.id, err: err.message }, 'notification write failed'),
      );

    this.log.info(
      {
        service: 'PromoterService',
        method: 'requestConnection',
        from: ctx.partnerId,
        to: targetPartnerId,
        connectionId: ref.id,
      },
      'Connection request created',
    );

    const doc = await ref.get();
    const d = doc.data() as Record<string, any>;
    return {
      connectionId: doc.id,
      fromPartnerId: safeStr(d.fromPartnerId),
      toPartnerId: safeStr(d.toPartnerId),
      status: 'pending',
      eventId: d.eventId ?? null,
      createdAt: toIso(d.createdAt),
      updatedAt: toIso(d.updatedAt),
      initiatedBy: d.initiatedBy ? safeStr(d.initiatedBy) : null,
    };
  }

  async respondToConnection(
    ctx: PartnerContext,
    connectionId: string,
    action: 'accepted' | 'rejected',
  ): Promise<PromoterConnection | null> {
    const ref = this.db.collection('promoter_connections').doc(connectionId);
    const doc = await ref.get();
    if (!doc.exists) return null;

    const data = doc.data() as Record<string, any>;
    // Only the target partner can respond
    if (safeStr(data.toPartnerId) !== ctx.partnerId) return null;

    await ref.update({ status: action, updatedAt: new Date() });

    this.log.info(
      {
        service: 'PromoterService',
        method: 'respondToConnection',
        connectionId,
        action,
        respondedBy: ctx.partnerId,
      },
      'Connection response recorded',
    );

    const updated = await ref.get();
    const d = updated.data() as Record<string, any>;
    return {
      connectionId: updated.id,
      fromPartnerId: safeStr(d.fromPartnerId),
      toPartnerId: safeStr(d.toPartnerId),
      status: action as ConnectionStatus,
      eventId: d.eventId ?? null,
      createdAt: toIso(d.createdAt),
      updatedAt: toIso(d.updatedAt),
      initiatedBy: d.initiatedBy ? safeStr(d.initiatedBy) : null,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private docToLink(
    doc: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot,
  ): PromoterLink {
    const d = (doc.data() ?? {}) as Record<string, any>;
    return {
      linkId: doc.id,
      promoterId: safeStr(d.promoterId),
      eventId: safeStr(d.eventId),
      eventTitle: d.eventTitle ?? null,
      code: safeStr(d.code),
      active: d.active !== false,
      clickCount: toNum(d.clickCount),
      conversionCount: toNum(d.conversionCount),
      commissionRate: toNum(d.commissionRate),
      revenue: toNum(d.revenue),
      createdAt: toIso(d.createdAt),
      updatedAt: toIso(d.updatedAt),
    };
  }

  private async computeStats(promoterId: string): Promise<PromoterOverviewStats> {
    const startedAt = Date.now();

    const snap = await this.db
      .collection('promoter_links')
      .where('promoterId', '==', promoterId)
      .select('clickCount', 'conversionCount', 'revenue', 'active')
      .limit(500)
      .get()
      .catch((err) => {
        this.log.error(
          {
            service: 'PromoterService',
            method: 'computeStats',
            promoterId,
            error: err?.message ?? String(err),
          },
          'Links stats query failed',
        );
        return { docs: [] };
      });

    let clicks = 0;
    let conversions = 0;
    let revenue = 0;
    let totalLinks = 0;
    let commissionEarned = 0;

    for (const doc of (snap as any).docs) {
      const d = doc.data() as Record<string, any>;
      clicks += toNum(d.clickCount);
      conversions += toNum(d.conversionCount);
      revenue += toNum(d.revenue);
      totalLinks++;
    }

    const statsDoc = await this.db.collection('promoter_stats').doc(promoterId).get();

    if (statsDoc.exists) {
      commissionEarned = toNum(statsDoc.data()?.totalCommissionEarned);
    } else {
      const commSnap = await this.db
        .collection('partner_ledger')
        .where('toPartnerId', '==', promoterId)
        .where('type', '==', 'promoter_commission')
        .select('amount', 'status')
        .get()
        .catch((err) => {
          this.log.error(
            {
              service: 'PromoterService',
              method: 'computeStats',
              promoterId,
              error: err?.message ?? String(err),
            },
            'Ledger commission query failed',
          );
          return { docs: [] };
        });

      for (const doc of (commSnap as any).docs) {
        const d = doc.data() as Record<string, any>;
        if (d.status !== 'reversed' && d.status !== 'cancelled') {
          commissionEarned += toNum(d.amount);
        }
      }

      // Auto-backfill to prevent heavy reads on next load
      await statsDoc.ref
        .set(
          {
            totalCommissionEarned: commissionEarned,
            updatedAt: new Date(),
          },
          { merge: true },
        )
        .catch((err) => {
          this.log.warn(
            { service: 'PromoterService', method: 'computeStats', promoterId },
            'Failed to backfill promoter_stats',
          );
        });
    }

    const durationMs = Date.now() - startedAt;
    if (durationMs > 300) {
      this.log.warn(
        {
          service: 'PromoterService',
          method: 'computeStats',
          promoterId,
          durationMs,
          linkCount: totalLinks,
        },
        'Slow stats computation',
      );
    }

    return {
      totalLinks,
      totalClicks: clicks,
      totalConversions: conversions,
      totalRevenue: revenue,
      totalCommissionEarned: commissionEarned,
      conversionRate: clicks > 0 ? conversions / clicks : 0,
    };
  }

  // P0-3 Part B: Aggregate daily click buckets into a time-series array.
  // Reads from either promoter_daily_stats (for whole promoter)
  // or promoter_link_events/{linkId}/daily (for specific links).
  private async buildTimeSeries(
    opts: { linkIds?: string[]; promoterId?: string },
    from?: string,
    to?: string,
  ): Promise<DataPoint[]> {
    if (!opts.promoterId && (!opts.linkIds || !opts.linkIds.length)) return [];

    const start = from ?? new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const end = to ?? new Date().toISOString().slice(0, 10);

    const byDate = new Map<string, { clicks: number; revenue: number }>();

    if (opts.promoterId) {
      const snap = await this.db
        .collection('promoter_daily_stats')
        .doc(opts.promoterId)
        .collection('daily')
        .where('date', '>=', start)
        .where('date', '<=', end)
        .get()
        .catch((err) => {
          this.log.warn(
            {
              service: 'PromoterService',
              method: 'buildTimeSeries',
              promoterId: opts.promoterId,
              error: err?.message ?? String(err),
            },
            'Daily bucket query failed for global promoter stats',
          );
          return { docs: [] };
        });

      for (const doc of (snap as any).docs) {
        const d = doc.data() as Record<string, any>;
        const dateKey = safeStr(d.date);
        if (!dateKey) continue;
        const existing = byDate.get(dateKey) ?? { clicks: 0, revenue: 0 };
        byDate.set(dateKey, {
          clicks: existing.clicks + toNum(d.clicks),
          revenue: existing.revenue + toNum(d.revenue ?? 0),
        });
      }
    } else if (opts.linkIds && opts.linkIds.length) {
      await Promise.all(
        opts.linkIds.map(async (linkId) => {
          const snap = await this.db
            .collection('promoter_link_events')
            .doc(linkId)
            .collection('daily')
            .where('date', '>=', start)
            .where('date', '<=', end)
            .get()
            .catch((err) => {
              this.log.warn(
                {
                  service: 'PromoterService',
                  method: 'buildTimeSeries',
                  linkId,
                  error: err?.message ?? String(err),
                },
                'Daily bucket query failed for link',
              );
              return { docs: [] };
            });

          for (const doc of (snap as any).docs) {
            const d = doc.data() as Record<string, any>;
            const dateKey = safeStr(d.date);
            if (!dateKey) continue;
            const existing = byDate.get(dateKey) ?? { clicks: 0, revenue: 0 };
            byDate.set(dateKey, {
              clicks: existing.clicks + toNum(d.clicks),
              revenue: existing.revenue + toNum(d.revenue ?? 0),
            });
          }
        }),
      );
    }

    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { clicks }]) => ({ date, value: clicks }));
  }

  private generateCode(): string {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }
}
