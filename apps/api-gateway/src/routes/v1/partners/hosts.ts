import type { FastifyInstance } from 'fastify';
import { getHostAnalytics } from '@c1rcle/core/analytics-engine';
import { z } from 'zod';
import { resolvePartnerContext, requireType } from '../../../lib/partner-context.js';
import { FinanceService } from '../../../services/unified/finance-service.js';
import { HostService } from '../../../services/unified/host-service.js';
import { SchedulingService } from '../../../services/unified/scheduling-service.js';
import { buildErrorResponse } from '../../../lib/api-contracts.js';

const OverviewQuerySchema = z.object({
  range: z.enum(['1d', '1w', '1m', 'all']).optional(),
  metric: z.enum(['tickets', 'revenue']).optional(),
}).strict();

const EventFiltersSchema = z.object({
  status: z.enum(['draft', 'pending_approval', 'approved', 'published', 'live', 'completed', 'cancelled']).optional(),
  cursor: z.string().optional(),
  lastId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).passthrough();

const CalendarQuerySchema = z.object({
  venueId: z.string(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict();

const SlotRequestSchema = z.object({
  venueId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().optional(),
});

const TeamMemberPatch = z.object({
  role: z.string().optional(),
  isActive: z.boolean().optional(),
  status: z.string().optional(),
  granularPermissions: z.record(z.string(), z.boolean()).nullable().optional(),
  verified: z.boolean().optional(),
}).passthrough();

type PlainRecord = Record<string, any>;

function asRecord(value: unknown): PlainRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as PlainRecord : {};
}

function asArray<T = PlainRecord>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function toNumber(value: any): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function mapByAnyId(items: PlainRecord[], candidates: string[]) {
  const map = new Map<string, PlainRecord>();
  for (const item of items) {
    for (const candidate of candidates) {
      const value = item?.[candidate];
      if (value !== undefined && value !== null && String(value)) {
        map.set(String(value), item);
        break;
      }
    }
  }
  return map;
}

function buildHostKpis(stats: PlainRecord) {
  return {
    totalRevenue: toNumber(stats.totalRevenue ?? stats.revenue),
    totalTicketsSold: toNumber(stats.totalTicketsSold ?? stats.ticketsSold),
    activePromoters: toNumber(stats.activePromoters),
    pendingItems: toNumber(stats.pendingItems),
  };
}

function mergeHostEvents(legacyItems: PlainRecord[], unifiedItems: PlainRecord[]) {
  const unifiedById = mapByAnyId(unifiedItems, ['eventId', 'id']);
  const merged: PlainRecord[] = [];
  const seen = new Set<string>();

  for (const legacyItem of legacyItems) {
    const id = String(legacyItem?.id || legacyItem?.eventId || '');
    const unifiedItem = unifiedById.get(id) || {};
    seen.add(id);
    merged.push({
      ...legacyItem,
      ...unifiedItem,
      id: id || String(unifiedItem.eventId || ''),
      eventId: String(unifiedItem.eventId || legacyItem.id || ''),
      name: legacyItem.name ?? unifiedItem.title ?? '',
      title: unifiedItem.title ?? legacyItem.name ?? legacyItem.title ?? '',
      date: legacyItem.date ?? unifiedItem.startDate ?? legacyItem.startDate ?? null,
      startDate: unifiedItem.startDate ?? legacyItem.startDate ?? legacyItem.date ?? null,
      endDate: unifiedItem.endDate ?? legacyItem.endDate ?? null,
      venue_name: legacyItem.venue_name ?? unifiedItem.venueName ?? legacyItem.venueName ?? '',
      venueName: unifiedItem.venueName ?? legacyItem.venue_name ?? legacyItem.venueName ?? '',
      status: legacyItem.status ?? unifiedItem.status ?? legacyItem.lifecycle ?? 'draft',
      lifecycle: legacyItem.lifecycle ?? unifiedItem.status ?? legacyItem.status ?? 'draft',
      submissionStatus: unifiedItem.submissionStatus ?? legacyItem.submissionStatus ?? 'not_submitted',
      poster_url: legacyItem.poster_url ?? unifiedItem.coverImage ?? legacyItem.image ?? null,
      image: legacyItem.image ?? unifiedItem.coverImage ?? legacyItem.poster_url ?? null,
      coverImage: unifiedItem.coverImage ?? legacyItem.poster_url ?? legacyItem.image ?? null,
      ticketsSold: toNumber(unifiedItem.ticketsSold ?? legacyItem.ticketsSold),
      revenue: toNumber(unifiedItem.revenue ?? legacyItem.revenue),
      capacity: toNumber(unifiedItem.capacity ?? legacyItem.capacity),
    });
  }

  for (const unifiedItem of unifiedItems) {
    const id = String(unifiedItem?.eventId || unifiedItem?.id || '');
    if (!id || seen.has(id)) continue;
    merged.push({
      ...unifiedItem,
      id,
      eventId: id,
      name: unifiedItem.title ?? '',
      title: unifiedItem.title ?? '',
      date: unifiedItem.startDate ?? null,
      startDate: unifiedItem.startDate ?? null,
      endDate: unifiedItem.endDate ?? null,
      venue_name: unifiedItem.venueName ?? '',
      venueName: unifiedItem.venueName ?? '',
      status: unifiedItem.status ?? 'draft',
      lifecycle: unifiedItem.status ?? 'draft',
      submissionStatus: unifiedItem.submissionStatus ?? 'not_submitted',
      poster_url: unifiedItem.coverImage ?? null,
      image: unifiedItem.coverImage ?? null,
      coverImage: unifiedItem.coverImage ?? null,
      ticketsSold: toNumber(unifiedItem.ticketsSold),
      revenue: toNumber(unifiedItem.revenue),
      capacity: toNumber(unifiedItem.capacity),
    });
  }

  return merged;
}

function mergeHostTeamMembers(legacyItems: PlainRecord[], unifiedItems: PlainRecord[]) {
  const unifiedById = mapByAnyId(unifiedItems, ['memberId', 'membershipId', 'id']);
  const merged: PlainRecord[] = [];
  const seen = new Set<string>();

  for (const legacyItem of legacyItems) {
    const membershipId = String(legacyItem?.membershipId || legacyItem?.memberId || legacyItem?.id || '');
    const unifiedItem = unifiedById.get(membershipId) || {};
    const isActive = legacyItem.isActive ?? unifiedItem.isActive ?? legacyItem.status !== 'removed';
    seen.add(membershipId);
    merged.push({
      ...legacyItem,
      ...unifiedItem,
      id: membershipId,
      membershipId,
      memberId: membershipId,
      uid: legacyItem.uid ?? unifiedItem.uid ?? null,
      displayName: legacyItem.displayName ?? unifiedItem.displayName ?? legacyItem.name ?? legacyItem.email ?? '',
      email: legacyItem.email ?? unifiedItem.email ?? null,
      phone: legacyItem.phone ?? legacyItem.contactPhone ?? null,
      role: legacyItem.role ?? unifiedItem.role ?? 'STAFF',
      status: legacyItem.status ?? (isActive ? 'active' : 'suspended'),
      isActive: Boolean(isActive),
      joinedAt: legacyItem.joinedAt ?? unifiedItem.joinedAt ?? legacyItem.createdAt ?? null,
      lastActive: legacyItem.lastActive ?? legacyItem.lastSeenAt ?? null,
      photoUrl: legacyItem.photoUrl ?? legacyItem.photoURL ?? null,
      granularPermissions: legacyItem.granularPermissions ?? null,
      verified: legacyItem.verified ?? Boolean(unifiedItem.uid),
    });
  }

  for (const unifiedItem of unifiedItems) {
    const membershipId = String(unifiedItem?.memberId || unifiedItem?.membershipId || unifiedItem?.id || '');
    if (!membershipId || seen.has(membershipId)) continue;
    merged.push({
      ...unifiedItem,
      id: membershipId,
      membershipId,
      memberId: membershipId,
      uid: unifiedItem.uid ?? null,
      displayName: unifiedItem.displayName ?? unifiedItem.email ?? '',
      email: unifiedItem.email ?? null,
      phone: null,
      role: unifiedItem.role ?? 'STAFF',
      status: unifiedItem.isActive === false ? 'suspended' : 'active',
      isActive: unifiedItem.isActive !== false,
      joinedAt: unifiedItem.joinedAt ?? null,
      lastActive: null,
      photoUrl: null,
      granularPermissions: null,
      verified: Boolean(unifiedItem.uid),
    });
  }

  return merged;
}

export default async function partnersHostRoutes(fastify: FastifyInstance) {
  const svcCtx = { db: fastify.db, log: fastify.log, redis: fastify.redis };
  const hostService = new HostService(svcCtx);
  const schedulingService = new SchedulingService(svcCtx);
  const financeService = new FinanceService(svcCtx);

  const hostProfileFields = ['displayName', 'bio', 'tagline', 'profileImage', 'coverImage', 'socialLinks', 'contactEmail', 'contactPhone', 'genre', 'city', 'instagramHandle', 'youtubeHandle', 'spotifyHandle'];

  const buildLegacyOverview = async (hostId: string) => {
    const [statsSnap, eventsSnapshot, activePromotersSnap] = await Promise.all([
      fastify.db.collection('host_stats').doc(hostId).get().catch(() => null),
      fastify.db.collection('events')
        .where('creatorId', '==', hostId)
        .orderBy('startDate', 'desc')
        .limit(5)
        .get()
        .catch(() => ({ docs: [] as any[] })),
      fastify.db.collection('partnerships')
        .where('hostId', '==', hostId)
        .where('status', '==', 'active')
        .count()
        .get()
        .catch(() => null),
    ]);

    const stats = statsSnap?.exists ? (statsSnap.data() as PlainRecord) : {};
    const events = (eventsSnapshot as any).docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
    return {
      success: true,
      stats: {
        revenue: toNumber(stats.totalRevenue),
        ticketsSold: toNumber(stats.totalTicketsSold),
        activePromoters: toNumber(activePromotersSnap?.data?.().count),
        pendingItems: toNumber(stats.activeEventsCount),
      },
      upcomingEvents: events.map((event: PlainRecord) => ({
        id: event.id,
        name: event.title,
        date: event.date ?? event.startDate ?? null,
        startDate: event.startDate ?? event.date ?? null,
        venue_name: event.venue || event.venueName || 'TBD',
        status: event.status,
        lifecycle: event.lifecycle,
        poster_url: event.image || event.poster || event.coverImage || null,
      })),
    };
  };

  const buildLegacyEvents = async (hostId: string, query: PlainRecord) => {
    const limit = Math.min(Number(query.limit || 20), 100);
    let q: any = fastify.db.collection('events')
      .where('creatorId', '==', hostId)
      .orderBy('startDate', 'desc');

    const lastId = String(query.lastId || query.cursor || '');
    if (lastId) {
      const lastDoc = await fastify.db.collection('events').doc(lastId).get().catch(() => null);
      if (lastDoc?.exists) q = q.startAfter(lastDoc);
    }

    const snapshot = await q.limit(limit + 1).get().catch(() => ({ docs: [] as any[] }));
    const docs = (snapshot as any).docs || [];
    const hasMore = docs.length > limit;
    const events = docs.slice(0, limit).map((doc: any) => {
      const raw = doc.data() as PlainRecord;
      return {
        id: doc.id,
        title: raw.title,
        startDate: raw.startDate ?? null,
        lifecycle: raw.lifecycle ?? raw.status ?? 'draft',
        venue_name: raw.venue || raw.venueName || 'TBD',
        image: raw.image || raw.poster || raw.coverImage || null,
      };
    });

    return {
      success: true,
      events,
      nextCursor: hasMore ? events[events.length - 1]?.id ?? null : null,
      hasMore,
    };
  };

  const buildLegacyTeam = async (hostId: string) => {
    const snap = await fastify.db.collection('partner_memberships')
      .where('partnerId', '==', hostId)
      .where('partnerType', '==', 'host')
      .get()
      .catch(() => ({ docs: [] as any[] }));
    return { members: (snap as any).docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })) };
  };

  const patchTeamMember = async (hostId: string, memberId: string, patch: PlainRecord) => {
    const ref = fastify.db.collection('partner_memberships').doc(memberId);
    const doc = await ref.get();
    if (!doc.exists) {
      const err: any = new Error('Member not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const membership = doc.data() as PlainRecord;
    if (String(membership.partnerId || '') !== hostId) {
      const err: any = new Error('Forbidden');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const safe: PlainRecord = { updatedAt: new Date().toISOString() };
    if (patch.role !== undefined) safe.role = patch.role;
    if (patch.isActive !== undefined) safe.isActive = patch.isActive;
    await ref.update(safe);
    return { success: true };
  };

  const removeTeamMember = async (hostId: string, memberId: string) => {
    const ref = fastify.db.collection('partner_memberships').doc(memberId);
    const doc = await ref.get();
    if (!doc.exists) {
      const err: any = new Error('Member not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const membership = doc.data() as PlainRecord;
    if (String(membership.partnerId || '') !== hostId) {
      const err: any = new Error('Forbidden');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    await ref.update({ isActive: false, removedAt: new Date().toISOString() });
    return { success: true };
  };

  const getHostProfile = async (hostId: string) => {
    const doc = await fastify.db.collection('hosts').doc(hostId).get();
    if (!doc.exists) {
      const err: any = new Error('Host not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    return { host: { id: doc.id, ...(doc.data() || {}) } };
  };

  const updateHostProfile = async (hostId: string, patch: PlainRecord) => {
    const safe: PlainRecord = {};
    for (const key of hostProfileFields) {
      if (patch[key] !== undefined) safe[key] = patch[key];
    }
    safe.updatedAt = new Date().toISOString();
    await fastify.db.collection('hosts').doc(hostId).set(safe, { merge: true });
    await fastify.publicDiscoveryService.syncHostReadModels(hostId).catch(() => {});
    await fastify.invalidatePublicDiscovery('all').catch(() => {});
    return getHostProfile(hostId);
  };

  const getHostPartnerships = async (hostId: string) => {
    const snap = await fastify.db.collection('partnerships')
      .where('hostId', '==', hostId)
      .orderBy('createdAt', 'desc')
      .get()
      .catch(() => ({ docs: [] as any[] }));
    return { partnerships: (snap as any).docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })) };
  };

  const updateHostPartnership = async (hostId: string, partnershipId: string, action: string) => {
    if (!['approve', 'reject'].includes(action)) {
      const err: any = new Error('action must be approve or reject');
      err.statusCode = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    const ref = fastify.db.collection('partnerships').doc(partnershipId);
    const doc = await ref.get();
    if (!doc.exists) {
      const err: any = new Error('Partnership not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    const partnership = doc.data() as PlainRecord;
    if (String(partnership.hostId || '') !== hostId) {
      const err: any = new Error('Forbidden');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    const status = action === 'approve' ? 'active' : 'rejected';
    await ref.update({ status, updatedAt: new Date().toISOString() });
    return { success: true, status };
  };

  const getHostNotifications = async (hostId: string) => {
    const snap = await fastify.db.collection('notifications')
      .where('recipientId', '==', hostId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()
      .catch(() => ({ docs: [] as any[] }));
    return { notifications: (snap as any).docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })) };
  };

  const markHostNotificationsRead = async (hostId: string, body: PlainRecord) => {
    const notificationId = String(body.notificationId || '');
    const markAllRead = body.markAllRead === true;
    if (markAllRead) {
      const snap = await fastify.db.collection('notifications')
        .where('recipientId', '==', hostId)
        .where('read', '==', false)
        .get();
      const batch = fastify.db.batch();
      snap.docs.forEach((doc: any) => batch.update(doc.ref, { read: true }));
      await batch.commit();
      return { success: true, markedCount: snap.size };
    }
    if (!notificationId) {
      const err: any = new Error('notificationId or markAllRead required');
      err.statusCode = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }
    await fastify.db.collection('notifications').doc(notificationId).update({ read: true });
    return { success: true, markedCount: 1 };
  };

  const getHostOrders = async (hostId: string, query: PlainRecord) => {
    const pageSize = Math.min(parseInt(String(query.limit || '20'), 10) || 20, 100);
    let q: any = fastify.db.collection('orders')
      .where('hostId', '==', hostId)
      .orderBy('createdAt', 'desc');
    if (query.status) q = q.where('status', '==', query.status);
    const cursor = String(query.cursor || '');
    if (cursor) {
      const cursorDoc = await fastify.db.collection('orders').doc(cursor).get().catch(() => null);
      if (cursorDoc?.exists) q = q.startAfter(cursorDoc);
    }
    const snap = await q.limit(pageSize + 1).get().catch(() => ({ docs: [] as any[] }));
    const docs = (snap as any).docs || [];
    const hasMore = docs.length > pageSize;
    const orders = docs.slice(0, pageSize).map((doc: any) => {
      const order = doc.data() as PlainRecord;
      return { id: doc.id, ...order, buyerEmail: undefined, buyerPhone: undefined };
    });
    return { orders, hasMore, nextCursor: hasMore ? orders[orders.length - 1]?.id ?? null : null };
  };

  const getHostFinanceDisputes = async (ctx: any) => {
    const result = await financeService.getDisputes(ctx);
    return {
      disputes: asArray(result.data).map((dispute: PlainRecord) => ({
        id: dispute.disputeId,
        orderId: dispute.orderId,
        amount: toNumber(dispute.amount),
        status: dispute.status,
        reason: dispute.reason ?? null,
        createdAt: dispute.createdAt ?? null,
      })),
    };
  };

  const getHostFinancePayouts = async (ctx: any, query: PlainRecord) => {
    const result = await financeService.getPayouts(ctx, {
      status: query.status,
      cursor: query.cursor,
      limit: parseInt(String(query.limit || '20'), 10) || 20,
    });
    const payouts = asArray(result.data).map((payout: PlainRecord) => ({
      id: payout.payoutId,
      amount: toNumber(payout.amount),
      status: payout.status,
      paymentMethod: payout.paymentMethod ?? null,
      requestedAt: payout.requestedAt ?? null,
      completedAt: payout.completedAt ?? null,
      currency: payout.currency || 'INR',
    }));
    return { payouts, hasMore: Boolean(result.hasMore), nextCursor: result.nextCursor ?? null };
  };

  const getHostBankAccounts = async (ctx: any) => {
    const accounts = await financeService.getBankAccounts(ctx);
    return {
      accounts: accounts.map((account) => ({
        id: account.accountId,
        bankName: account.bankName || 'Bank Account',
        last4: account.last4 || '0000',
        isDefault: account.isDefault ?? false,
        paymentType: account.paymentType || 'bank_account',
      })),
    };
  };

  const createHostBankAccount = async (hostId: string, body: PlainRecord) => {
    const paymentType = body.paymentType === 'debit_card' ? 'debit_card' : 'bank_account';
    const rawNumber = paymentType === 'debit_card'
      ? String(body.cardNumber || '').trim()
      : String(body.accountNumber || '').trim();
    if (!rawNumber) {
      const err: any = new Error('Account number or card number required');
      err.statusCode = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }
    const last4 = rawNumber.slice(-4);
    const now = new Date().toISOString();
    const ref = await fastify.db.collection('bank_accounts').add({
      partnerId: hostId,
      paymentType,
      accountHolderName: body.accountHolderName || body.cardHolderName || '',
      bankName: body.bankName || body.cardBrand || 'Bank Account',
      ifscCode: body.ifscCode || null,
      // P0-1: accountNumber field removed — storing plaintext account/card numbers
      // is a PCI/RBI compliance violation. last4 is sufficient for all display paths.
      cardBrand: paymentType === 'debit_card' ? (body.cardBrand || null) : null,
      cardLast4: paymentType === 'debit_card' ? last4 : null,
      last4,
      isDefault: body.isDefault !== false,
      createdAt: now,
      updatedAt: now,
    });
    return {
      account: {
        id: ref.id,
        bankName: body.bankName || body.cardBrand || 'Bank Account',
        last4,
        isDefault: body.isDefault !== false,
        paymentType,
      },
    };
  };

  const deleteHostBankAccount = async (hostId: string, query: PlainRecord, body: PlainRecord) => {
    const accountId = String(query.accountId || body.accountId || '');
    if (!accountId) {
      const err: any = new Error('hostId and accountId required');
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
    const account = doc.data() as PlainRecord;
    if (String(account.partnerId || '') !== hostId) {
      const err: any = new Error('Forbidden');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
    await ref.delete();
    return { success: true };
  };

  const getHostFinanceOverview = async (ctx: any) => {
    const [payoutsResult, disputesResult, balances] = await Promise.all([
      financeService.getPayouts(ctx, { limit: 10 }),
      financeService.getDisputes(ctx),
      financeService.getBalances(ctx),
    ]);
    const payouts = asArray(payoutsResult.data).map((payout: PlainRecord) => ({
      id: payout.payoutId,
      amount: toNumber(payout.amount),
      status: payout.status,
      paymentMethod: payout.paymentMethod ?? null,
      requestedAt: payout.requestedAt ?? null,
      completedAt: payout.completedAt ?? null,
      currency: payout.currency || 'INR',
    }));
    return {
      totalPending: toNumber(balances.pending),
      totalPaid: payouts
        .filter((payout) => ['completed', 'paid', 'cleared'].includes(String(payout.status || '').toLowerCase()))
        .reduce((sum, payout) => sum + toNumber(payout.amount), 0),
      openDisputes: asArray(disputesResult.data).filter((dispute: PlainRecord) => String(dispute.status || '').toLowerCase() === 'open').length,
      recentPayouts: payouts,
    };
  };

  const getHostOverviewSummary = async (hostId: string) => {
    const [partnerSnap, promoterSnap, eventsSnap] = await Promise.all([
      fastify.db.collection('partnerships').where('hostId', '==', hostId).get().catch(() => ({ docs: [] as any[] })),
      fastify.db.collection('promoter_connections').where('hostId', '==', hostId).where('status', '==', 'active').get().catch(() => ({ docs: [] as any[] })),
      fastify.db.collection('events')
        .where('creatorId', '==', hostId)
        .where('lifecycle', 'in', ['submitted', 'scheduled', 'live', 'approved'])
        .orderBy('startDate', 'asc')
        .limit(5)
        .get()
        .catch(() => ({ docs: [] as any[] })),
    ]);
    const partnerships = (partnerSnap as any).docs || [];
    return {
      pendingPartnerships: partnerships.filter((doc: any) => (doc.data() || {}).status === 'pending').length,
      activePromoters: (promoterSnap as any).size || 0,
      upcomingEvents: ((eventsSnap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })),
    };
  };

  const getHostPromoters = async (hostId: string) => {
    const snap = await fastify.db.collection('promoter_connections')
      .where('hostId', '==', hostId)
      .orderBy('createdAt', 'desc')
      .get()
      .catch(() => ({ docs: [] as any[] }));
    return { promoters: (snap as any).docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })) };
  };

  const getHostEventAndVerify = async (hostId: string, eventId: string) => {
    const doc = await fastify.db.collection('events').doc(eventId).get();
    if (!doc.exists) {
      const err: any = new Error('Event not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    const event = { id: doc.id, ...(doc.data() || {}) } as PlainRecord;
    const ownerId = String(event.creatorId || event.hostId || '');
    if (ownerId && ownerId !== hostId) {
      const err: any = new Error('Forbidden');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
    return event;
  };

  const getHostEventTickets = async (hostId: string, eventId: string) => {
    const event = await getHostEventAndVerify(hostId, eventId);
    return {
      tiers: asArray(event.ticketTiers || event.tiers || event.tickets).map((tier: PlainRecord, index: number) => ({
        id: tier.id || tier.tierId || String(index),
        name: tier.name,
        price: tier.price,
        quantity: tier.quantity || tier.maxQuantity || 0,
        sold: tier.sold || 0,
        status: tier.status || 'active',
      })),
      eventId,
    };
  };

  const updateHostEventTickets = async (hostId: string, eventId: string, body: PlainRecord) => {
    if (!Array.isArray(body.tiers)) {
      const err: any = new Error('tiers array required');
      err.statusCode = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }
    await getHostEventAndVerify(hostId, eventId);
    await fastify.db.collection('events').doc(eventId).update({ ticketTiers: body.tiers, updatedAt: new Date().toISOString() });
    await fastify.cache.delete('events:detail', eventId).catch(() => {});
    return { success: true };
  };

  const submitHostEvent = async (request: any, hostId: string, eventId: string) => {
    const event = await getHostEventAndVerify(hostId, eventId);
    const lifecycle = String(event.lifecycle || event.status || '');
    if (!['draft', 'changes_requested'].includes(lifecycle)) {
      const err: any = new Error(`Cannot submit event in ${lifecycle} state`);
      err.statusCode = 409;
      err.code = 'CONFLICT';
      throw err;
    }
    const now = new Date().toISOString();
    await fastify.db.collection('events').doc(eventId).update({ lifecycle: 'submitted', status: 'submitted', updatedAt: now, submittedAt: now });
    await fastify.db.collection('submission_history').add({
      eventId,
      fromState: lifecycle,
      toState: 'submitted',
      actorUid: request.user?.uid || hostId,
      actorRole: 'host',
      timestamp: now,
    });
    if (event.venueId) {
      await fastify.db.collection('notifications').add({
        recipientId: event.venueId,
        recipientType: 'venue',
        type: 'event_submitted',
        eventId,
        hostId,
        title: 'New Event Submission',
        message: `${event.title} has been submitted for your approval.`,
        read: false,
        createdAt: now,
      });
    }
    await fastify.cache.delete('events:detail', eventId).catch(() => {});
    await fastify.publicDiscoveryService.syncEventReadModels(eventId).catch(() => {});
    return { success: true };
  };

  const resubmitHostEvent = async (request: any, hostId: string, eventId: string, body: PlainRecord) => {
    const event = await getHostEventAndVerify(hostId, eventId);
    const lifecycle = String(event.lifecycle || event.status || '');
    if (!['changes_requested', 'rejected'].includes(lifecycle)) {
      const err: any = new Error(`Cannot resubmit event in ${lifecycle} state`);
      err.statusCode = 409;
      err.code = 'CONFLICT';
      throw err;
    }
    const now = new Date().toISOString();
    const updates: PlainRecord = { lifecycle: 'submitted', status: 'submitted', updatedAt: now, resubmittedAt: now };
    if (body.patch && typeof body.patch === 'object' && !Array.isArray(body.patch)) Object.assign(updates, body.patch);
    await fastify.db.collection('events').doc(eventId).update(updates);
    await fastify.db.collection('submission_history').add({
      eventId,
      fromState: lifecycle,
      toState: 'submitted',
      actorUid: request.user?.uid || hostId,
      actorRole: 'host',
      note: body.note,
      timestamp: now,
    });
    if (event.venueId) {
      await fastify.db.collection('notifications').add({
        recipientId: event.venueId,
        recipientType: 'venue',
        type: 'event_resubmitted',
        eventId,
        hostId,
        title: 'Event Resubmitted',
        message: `${event.title} has been resubmitted for your approval.`,
        read: false,
        createdAt: now,
      });
    }
    await fastify.cache.delete('events:detail', eventId).catch(() => {});
    await fastify.publicDiscoveryService.syncEventReadModels(eventId).catch(() => {});
    return { success: true };
  };

  const getHostAnalyticsTimeSeries = async (hostId: string, query: PlainRecord) => {
    const cacheKey = `${hostId}:${query.range || '1w'}:${query.metric || 'revenue'}`;
    const cached = await fastify.cache.get('analytics:host:ts', cacheKey);
    if (cached) return { ...cached, fromCache: true };
    const stats = await getHostAnalytics(hostId, (query.range || '1w') as any);
    await fastify.cache.set('analytics:host:ts', cacheKey, stats, 120);
    return stats;
  };

  const getHostVenueCalendar = async (hostId: string, query: PlainRecord) => {
    const venueId = String(query.venueId || '');
    const partnerSnap = await fastify.db.collection('partnerships')
      .where('hostId', '==', hostId)
      .where('venueId', '==', venueId)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    if (partnerSnap.empty) {
      const err: any = new Error('No active partnership with this venue');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
    const slots = await schedulingService.getCalendar(venueId, {
      startDate: String(query.startDate || '1970-01-01'),
      endDate: String(query.endDate || '2999-12-31'),
    });
    return {
      calendar: slots.map((slot) => ({
        id: slot.slotId,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: slot.status,
      })),
    };
  };

  // ── Overview ───────────────────────────────────────────────────────────────

  fastify.get('/partners/hosts/overview', {
    preHandler: [
      fastify.validate({ querystring: OverviewQuerySchema }),
      fastify.requireAuth,
    ],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'host');
      const range = request.query.range ?? '1m';
      const metric = request.query.metric ?? 'tickets';
      const cacheKey = `partners:host:overview:${ctx.partnerId}:${range}:${metric}:contract-v1`;
      const cached = await fastify.cache.get('partners', cacheKey);
      if (cached) return reply.header('Cache-Control', 'private, max-age=120').send({ ...cached, fromCache: true });

      const [result, legacyBody] = await Promise.all([
        hostService.getOverview(ctx, { range, metric }),
        buildLegacyOverview(ctx.partnerId),
      ]);
      const legacyStats = asRecord(legacyBody.stats);
      const stats = {
        ...legacyStats,
        ...asRecord(result.stats),
        revenue: toNumber(legacyStats.revenue ?? result.stats.totalRevenue),
        ticketsSold: toNumber(legacyStats.ticketsSold ?? result.stats.totalTicketsSold),
        activePromoters: toNumber(legacyStats.activePromoters),
        pendingItems: toNumber(legacyStats.pendingItems ?? result.stats.activeEventsCount),
      };
      const upcomingEvents = mergeHostEvents(asArray(legacyBody.upcomingEvents), asArray(result.upcomingEvents));
      const normalized = {
        ...legacyBody,
        success: legacyBody.success ?? true,
        stats,
        kpis: buildHostKpis(stats),
        activePromoters: stats.activePromoters,
        pendingItems: stats.pendingItems,
        upcomingEvents,
        recentActivity: asArray(result.recentActivity),
        latestOrders: asArray(result.latestOrders),
        performance: asArray(result.performance),
      };

      await fastify.cache.set('partners', cacheKey, normalized, 120);
      return reply.header('Cache-Control', 'private, max-age=120').send(normalized);
    } catch (err: any) {
      fastify.log.error({ err: err.message, partnerId: ctx.partnerId }, 'partners/hosts/overview error');
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code ?? 'ERROR', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  // ── Events list ────────────────────────────────────────────────────────────

  fastify.get('/partners/hosts/events', {
    preHandler: [
      fastify.validate({ querystring: EventFiltersSchema }),
      fastify.requireAuth,
    ],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'host');
      const filters = {
        status: request.query.status,
        cursor: request.query.cursor ?? request.query.lastId,
        limit: request.query.limit,
      };
      const [result, legacyBody] = await Promise.all([
        hostService.getEvents(ctx, filters),
        buildLegacyEvents(ctx.partnerId, request.query),
      ]);
      const events = mergeHostEvents(asArray(legacyBody.events), asArray(result.data));
      return reply.header('Cache-Control', 'private, max-age=60').send({
        ...legacyBody,
        success: legacyBody.success ?? true,
        events,
        data: events,
        hasMore: Boolean(result.hasMore ?? legacyBody.hasMore),
        nextCursor: result.nextCursor ?? legacyBody.nextCursor ?? null,
      });
    } catch (err: any) {
      fastify.log.error({ err: err.message }, 'partners/hosts/events error');
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  // ── Single event ───────────────────────────────────────────────────────────

  fastify.get('/partners/hosts/events/:eventId', {
    preHandler: [fastify.requireAuth],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'host');
      const event = await hostService.getEvent(ctx, request.params.eventId);
      if (!event) return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Event not found', requestId: request.id }));
      return reply.header('Cache-Control', 'private, max-age=30').send(event);
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  // ── Calendar ───────────────────────────────────────────────────────────────

  fastify.get('/partners/hosts/calendar', {
    preHandler: [
      fastify.validate({ querystring: CalendarQuerySchema }),
      fastify.requireAuth,
    ],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'host');
      const { venueId, startDate, endDate } = request.query;
      const slots = await schedulingService.getCalendar(venueId, { startDate, endDate });
      return reply.header('Cache-Control', 'private, max-age=60').send({ slots });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  // ── Request a slot ─────────────────────────────────────────────────────────

  fastify.post('/partners/hosts/slot-requests', {
    preHandler: [
      fastify.validate({ body: SlotRequestSchema }),
      fastify.requireAuth,
    ],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'host');
      const slot = await schedulingService.requestSlot(ctx, request.body);
      return reply.status(201).send({ slot });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  // ── Settings ───────────────────────────────────────────────────────────────

  fastify.get('/partners/hosts/settings', {
    preHandler: [fastify.requireAuth],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'host');
      const settings = await hostService.getSettings(ctx);
      return reply.header('Cache-Control', 'private, max-age=300').send(settings);
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  // ── Team ───────────────────────────────────────────────────────────────────

  fastify.get('/partners/hosts/team', {
    preHandler: [fastify.requireAuth],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'host');
      const [members, legacyBody] = await Promise.all([
        hostService.getTeam(ctx),
        buildLegacyTeam(ctx.partnerId),
      ]);
      return reply.header('Cache-Control', 'private, max-age=120').send({
        ...legacyBody,
        members: mergeHostTeamMembers(asArray(legacyBody.members), asArray(members)),
      });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.patch('/partners/hosts/team/:memberId', {
    preHandler: [
      fastify.validate({ body: TeamMemberPatch }),
      fastify.requireAuth,
    ],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'host');
      return reply.send(await patchTeamMember(ctx.partnerId, request.params.memberId, asRecord(request.body)));
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.delete('/partners/hosts/team/:memberId', {
    preHandler: [fastify.requireAuth],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'host');
      return reply.send(await removeTeamMember(ctx.partnerId, request.params.memberId));
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  // ── Native parity dispatch ────────────────────────────────────────────────

  fastify.route({
    method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    url: '/partners/hosts/*',
    preHandler: [fastify.requireAuth],
    handler: async (request: any, reply: any) => {
      const ctx = await resolvePartnerContext(fastify.db, request);
      if (!ctx) {
        return reply.status(403).send(buildErrorResponse({
          code: 'FORBIDDEN',
          message: 'No partner identity found',
          requestId: request.id,
        }));
      }

      try {
        requireType(ctx, 'host');
        const rest = String(request.params?.['*'] || '').replace(/^\/+/, '');
        if (!rest) {
          return reply.status(404).send(buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Partner host endpoint not found',
            requestId: request.id,
          }));
        }

        const body = asRecord(request.body);
        const query = asRecord(request.query);

        if (rest === 'profile' && request.method === 'GET') return reply.send(await getHostProfile(ctx.partnerId));
        if (rest === 'profile' && request.method === 'PATCH') return reply.send(await updateHostProfile(ctx.partnerId, asRecord(body.patch)));

        if (rest === 'partnerships' && request.method === 'GET') return reply.send(await getHostPartnerships(ctx.partnerId));
        if (rest.startsWith('partnerships/') && request.method === 'PATCH') {
          return reply.send(await updateHostPartnership(ctx.partnerId, rest.slice('partnerships/'.length), String(body.action || '')));
        }

        if (rest === 'notifications' && request.method === 'GET') return reply.send(await getHostNotifications(ctx.partnerId));
        if (rest === 'notifications/read' && request.method === 'PATCH') return reply.send(await markHostNotificationsRead(ctx.partnerId, body));

        if (rest === 'orders' && request.method === 'GET') return reply.send(await getHostOrders(ctx.partnerId, query));

        if (rest === 'finance/disputes' && request.method === 'GET') return reply.send(await getHostFinanceDisputes(ctx));
        if (rest === 'finance/payouts' && request.method === 'GET') return reply.send(await getHostFinancePayouts(ctx, query));
        if (rest === 'finance/bank-accounts' && request.method === 'GET') return reply.send(await getHostBankAccounts(ctx));
        if (rest === 'finance/bank-accounts' && request.method === 'POST') return reply.status(201).send(await createHostBankAccount(ctx.partnerId, body));
        if (rest === 'finance/bank-accounts' && request.method === 'DELETE') return reply.send(await deleteHostBankAccount(ctx.partnerId, query, body));
        if (rest === 'finance/overview' && request.method === 'GET') return reply.send(await getHostFinanceOverview(ctx));

        if (rest === 'overview/summary' && request.method === 'GET') return reply.send(await getHostOverviewSummary(ctx.partnerId));
        if (rest === 'promoters' && request.method === 'GET') return reply.send(await getHostPromoters(ctx.partnerId));
        if (rest === 'analytics/time-series' && request.method === 'GET') return reply.send(await getHostAnalyticsTimeSeries(ctx.partnerId, query));
        if (rest === 'venue-calendar' && request.method === 'GET') return reply.send(await getHostVenueCalendar(ctx.partnerId, query));

        const ticketsMatch = rest.match(/^events\/([^/]+)\/tickets$/);
        if (ticketsMatch && request.method === 'GET') return reply.send(await getHostEventTickets(ctx.partnerId, ticketsMatch[1]));
        if (ticketsMatch && request.method === 'PATCH') return reply.send(await updateHostEventTickets(ctx.partnerId, ticketsMatch[1], body));

        const submitMatch = rest.match(/^events\/([^/]+)\/submit$/);
        if (submitMatch && request.method === 'POST') return reply.send(await submitHostEvent(request, ctx.partnerId, submitMatch[1]));

        const resubmitMatch = rest.match(/^events\/([^/]+)\/resubmit$/);
        if (resubmitMatch && request.method === 'PATCH') return reply.send(await resubmitHostEvent(request, ctx.partnerId, resubmitMatch[1], body));

        if (rest === 'ops/tonight' && request.method === 'GET') {
          const today = new Date().toISOString().slice(0, 10);
          const snap = await fastify.db.collection('events')
            .where('creatorId', '==', ctx.partnerId)
            .where('startDate', '==', today)
            .limit(10)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const events = ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
          if (!events.length) return reply.send({ hasEvent: false, event: null, ops: null });
          const event = events[0];
          const [ordersSnap, checkinsSnap] = await Promise.all([
            fastify.db.collection('orders').where('eventId', '==', event.id).where('status', '==', 'paid').get().catch(() => ({ docs: [] as any[], size: 0 })),
            fastify.db.collection('check_ins').where('eventId', '==', event.id).get().catch(() => ({ docs: [] as any[], size: 0 })),
          ]);
          const revenue = ((ordersSnap as any).docs || []).reduce((s: number, d: any) => s + toNumber(d.data().totalPaise), 0);
          const ticketsSold = ((ordersSnap as any).docs || []).reduce((s: number, d: any) => s + toNumber(d.data().ticketCount), 0);
          return reply.send({ hasEvent: true, event: { id: event.id, title: event.title || event.name, startDate: event.startDate, startTime: event.startTime, venueName: event.venueName }, ops: { revenue: revenue / 100, checkedIn: (checkinsSnap as any).size || 0, ticketsSold, entryRate: ticketsSold > 0 ? Math.round(((checkinsSnap as any).size || 0) / ticketsSold * 100) : 0 } });
        }

        if (rest === 'promoter-requests' && request.method === 'GET') {
          const snap = await fastify.db.collection('promoter_connections')
            .where('hostId', '==', ctx.partnerId)
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const requests = ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
          return reply.send({ requests, total: requests.length });
        }

        if (rest === 'partnerships/request' && request.method === 'POST') {
          const venueId = String(body.venueId || '');
          if (!venueId) return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'venueId required', requestId: request.id }));
          const existing = await fastify.db.collection('partnerships')
            .where('hostId', '==', ctx.partnerId)
            .where('venueId', '==', venueId)
            .where('status', 'in', ['pending', 'active'])
            .limit(1)
            .get()
            .catch(() => ({ empty: true }));
          if (!(existing as any).empty) return reply.status(409).send(buildErrorResponse({ code: 'CONFLICT', message: 'Partnership request already exists', requestId: request.id }));
          const now = new Date().toISOString();
          const ref = await fastify.db.collection('partnerships').add({ hostId: ctx.partnerId, venueId, status: 'pending', message: String(body.message || ''), createdAt: now, updatedAt: now });
          return reply.status(201).send({ success: true, partnershipId: ref.id });
        }

        if (rest === 'invite' && request.method === 'POST') {
          const email = String(body.email || '').toLowerCase().trim();
          const role = String(body.role || 'PROMOTER');
          if (!email) return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'email required', requestId: request.id }));
          const now = new Date().toISOString();
          const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          const ref = await fastify.db.collection('host_invitations').add({ hostId: ctx.partnerId, email, role, status: 'pending', expiresAt: expires, createdAt: now });
          return reply.status(201).send({ success: true, invitationId: ref.id, email, role });
        }

        if (rest === 'broadcast' && request.method === 'POST') {
          const message = String(body.message || '').trim();
          const title = String(body.title || 'Update from your host').trim();
          if (!message) return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'message required', requestId: request.id }));
          const followersSnap = await fastify.db.collection('follows')
            .where('hostId', '==', ctx.partnerId)
            .limit(500)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const batch = fastify.db.batch();
          const now = new Date().toISOString();
          let count = 0;
          for (const doc of ((followersSnap as any).docs || [])) {
            const followData = doc.data() || {};
            const ref = fastify.db.collection('notifications').doc();
            batch.set(ref, { recipientId: followData.userId || followData.guestId, type: 'host_broadcast', title, message, hostId: ctx.partnerId, read: false, createdAt: now });
            count++;
          }
          if (count > 0) await batch.commit();
          return reply.send({ success: true, recipientCount: count });
        }

        if (rest === 'audience' && request.method === 'GET') {
          const range = String(query.range || '30d');
          const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
          const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
          const [ordersSnap, followersSnap] = await Promise.all([
            fastify.db.collection('orders').where('hostId', '==', ctx.partnerId).where('status', '==', 'paid').where('createdAt', '>=', since).limit(500).get().catch(() => ({ docs: [] as any[] })),
            fastify.db.collection('follows').where('hostId', '==', ctx.partnerId).limit(1000).get().catch(() => ({ docs: [] as any[], size: 0 })),
          ]);
          const orders = ((ordersSnap as any).docs || []).map((d: any) => d.data() || {});
          const genderCounts: Record<string, number> = {};
          const ageBuckets: Record<string, number> = { '18-24': 0, '25-34': 0, '35-44': 0, '45+': 0 };
          for (const o of orders) {
            if (o.buyerGender) genderCounts[o.buyerGender] = (genderCounts[o.buyerGender] || 0) + 1;
            const age = toNumber(o.buyerAge);
            if (age >= 18 && age <= 24) ageBuckets['18-24']++;
            else if (age >= 25 && age <= 34) ageBuckets['25-34']++;
            else if (age >= 35 && age <= 44) ageBuckets['35-44']++;
            else if (age >= 45) ageBuckets['45+']++;
          }
          return reply.send({ totalFollowers: (followersSnap as any).size || 0, totalBuyers: orders.length, genderDistribution: genderCounts, ageDistribution: ageBuckets, range });
        }

        if (rest === 'settings/session/revoke' && request.method === 'POST') {
          try {
            await (fastify as any).firebaseAdmin?.auth().revokeRefreshTokens(ctx.uid);
          } catch {
            // revokeRefreshTokens may not be available in all Firebase Admin setups; log and continue
            fastify.log.warn(`[partners/hosts] revokeRefreshTokens not available for uid=${ctx.uid}`);
          }
          return reply.send({ success: true });
        }

        if (rest === 'page' && request.method === 'GET') {
          const doc = await fastify.db.collection('host_pages').doc(ctx.partnerId).get().catch(() => null);
          if (!doc || !doc.exists) return reply.send({ hostId: ctx.partnerId, sections: [], isActive: false, theme: { primary: '#F44A22' } });
          return reply.send({ id: doc.id, ...(doc.data() || {}) });
        }

        if (rest === 'page' && (request.method === 'POST' || request.method === 'PATCH')) {
          const now = new Date().toISOString();
          await fastify.db.collection('host_pages').doc(ctx.partnerId).set({ ...body, hostId: ctx.partnerId, updatedAt: now }, { merge: true });
          return reply.send({ success: true });
        }

        const orderActionMatch = rest.match(/^orders\/([^/]+)\/(cancel|resend-receipt)$/);
        if (orderActionMatch && request.method === 'POST') {
          const [, orderId, action] = orderActionMatch;
          const ref = fastify.db.collection('orders').doc(orderId);
          const doc = await ref.get();
          if (!doc.exists) return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Order not found', requestId: request.id }));
          const order = doc.data() as PlainRecord;
          if (order.hostId && order.hostId !== ctx.partnerId) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'Order not accessible', requestId: request.id }));
          if (action === 'cancel') {
            await ref.update({ status: 'cancelled', cancelledAt: new Date().toISOString(), cancelledBy: ctx.uid });
            return reply.send({ success: true });
          }
          return reply.send({ success: true });
        }

        return reply.status(404).send(buildErrorResponse({
          code: 'NOT_FOUND',
          message: 'Partner host endpoint not found',
          requestId: request.id,
        }));
      } catch (err: any) {
        if (err.statusCode) {
          return reply.status(err.statusCode).send(buildErrorResponse({
            code: err.code || 'FORBIDDEN',
            message: err.message,
            requestId: request.id,
          }));
        }
        return reply.status(500).send(buildErrorResponse({
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          requestId: request.id,
        }));
      }
    },
  });
}
