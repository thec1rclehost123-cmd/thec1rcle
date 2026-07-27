import type { FastifyInstance } from 'fastify';
import { sendHostInvitationEmail, generateTemporaryPassword } from '../../../lib/email.js';
import { getHostAnalytics } from '@c1rcle/core/analytics-engine';
import { z } from 'zod';
import { resolvePartnerContext, requireType } from '../../../lib/partner-context.js';
import { getPartnerProfileWithPii } from '../../../utils/partner-profiles.js';
import { FinanceService } from '../../../services/unified/finance-service.js';
import { HostService } from '../../../services/unified/host-service.js';
import { SchedulingService } from '../../../services/unified/scheduling-service.js';
import { buildErrorResponse } from '../../../lib/api-contracts.js';
import {
  buildPayoutAccountRecord,
  sanitizeEventResubmissionPatch,
} from '../../../lib/partner-hardening.js';
import { encrypt, decrypt } from '../../../lib/encryption.js';
import {
  enrichHostProfileWithSignedUrls,
  cleanHostProfilePatch,
  signStorageUrl,
} from '../../../lib/signed-urls.js';
import { uploadPartnerAsset } from '../../../lib/partner-upload.js';
import { getAdminStorage } from '@c1rcle/core/admin';
import { randomUUID } from 'node:crypto';
import {
  updateEventPromoterCompensation,
  ensurePromoterLink,
  resolveEffectiveCommission,
  normalizeCompensationForRead,
} from '../events.js';
import {
  getEventCommerceMetrics,
  getOrderCommerceAmounts,
  getPartnerCommerceRows,
} from '../../../lib/canonicalCommerceMetrics.js';

const OverviewQuerySchema = z
  .object({
    range: z.enum(['1d', '1w', '1m', 'all']).optional(),
    metric: z.enum(['tickets', 'revenue']).optional(),
  })
  .strict();

const EventFiltersSchema = z
  .object({
    status: z
      .enum([
        'draft',
        'pending_approval',
        'approved',
        'published',
        'live',
        'completed',
        'cancelled',
      ])
      .optional(),
    cursor: z.string().optional(),
    lastId: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .passthrough();

const CalendarQuerySchema = z
  .object({
    venueId: z.string(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    view: z.string().optional(),
  })
  .passthrough();

const SlotRequestSchema = z.object({
  venueId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().optional(),
});

const TeamMemberPatch = z
  .object({
    role: z.string().optional(),
    isActive: z.boolean().optional(),
    status: z.string().optional(),
    granularPermissions: z.record(z.string(), z.boolean()).nullable().optional(),
    verified: z.boolean().optional(),
  })
  .passthrough();

type PlainRecord = Record<string, any>;

function asRecord(value: unknown): PlainRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as PlainRecord) : {};
}

function asArray<T = PlainRecord>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toNumber(value: any): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function buildHostKpis(stats: PlainRecord) {
  return {
    totalRevenue: toNumber(stats.totalRevenue ?? stats.revenue),
    totalTicketsSold: toNumber(stats.totalTicketsSold ?? stats.ticketsSold),
    activePromoters: toNumber(stats.activePromoters),
    pendingItems: toNumber(stats.pendingItems),
  };
}

// ─── Push notification helper ────────────────────────────────────────────────
// Sends an Expo push notification to a list of user IDs.
// Looks up pushTokens from the `users` collection, batches at 30 for Firestore
// `in` queries and 100 per Expo send request. Fire-and-forget safe.
async function sendPushToUsers(
  db: any,
  userIds: string[],
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (!userIds.length) return;
  const tokens: string[] = [];
  for (let i = 0; i < userIds.length; i += 30) {
    const batch = userIds.slice(i, i + 30);
    const snap = await db
      .collection('users')
      .where('__name__', 'in', batch)
      .get()
      .catch(() => ({ docs: [] as any[] }));
    (snap as any).docs.forEach((d: any) => {
      const ud = (d.data() as Record<string, any>) || {};
      if (Array.isArray(ud.pushTokens)) tokens.push(...ud.pushTokens);
    });
  }
  if (!tokens.length) return;
  const messages = tokens.map((token) => ({ to: token, sound: 'default', title, body, data }));
  for (let i = 0; i < messages.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    }).catch(() => {
      /* fire-and-forget — never fail the request */
    });
  }
}

export default async function partnersHostRoutes(fastify: FastifyInstance) {
  const svcCtx = { db: fastify.db, log: fastify.log, redis: fastify.redis };
  const hostService = new HostService(svcCtx);
  const schedulingService = new SchedulingService(svcCtx);
  const financeService = new FinanceService(svcCtx);

  const hostProfileFields = [
    'name',
    'displayName',
    'hostType',
    'bio',
    'tagline',
    'profileImage',
    'coverImage',
    'avatar',
    'photoURL',
    'cover',
    'coverURL',
    'socialLinks',
    'contactEmail',
    'contactPhone',
    'genre',
    'genres',
    'styleTags',
    'videos',
    'photos',
    'role',
    'city',
    'neighborhood',
    'website',
    'primaryCta',
    'instagramHandle',
    'youtubeHandle',
    'spotifyHandle',
    'publicProfileEnabled',
    'presenceConfig',
  ];

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
    await fastify
      .writeAuditLog({
        action: 'TEAM_MEMBER_UPDATED',
        actorUid: hostId,
        entityId: memberId,
        payload: { patch: safe },
      })
      .catch(() => {});
    return { success: true };
  };

  const removeTeamMember = async (hostId: string, memberId: string) => {
    let ref = fastify.db.collection('partner_memberships').doc(memberId);
    let doc = await ref.get();

    if (doc.exists) {
      const membership = doc.data() as PlainRecord;
      if (String(membership.partnerId || '') !== hostId) {
        const err: any = new Error('Forbidden');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
      await ref.update({ isActive: false, removedAt: new Date().toISOString() });
    } else {
      ref = fastify.db.collection('host_team_invitations').doc(memberId);
      doc = await ref.get();
      if (!doc.exists) {
        const err: any = new Error('Member or Invitation not found');
        err.statusCode = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      const invitation = doc.data() as PlainRecord;
      if (String(invitation.hostId || '') !== hostId) {
        const err: any = new Error('Forbidden');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
      await ref.update({ status: 'revoked', revokedAt: new Date().toISOString() });
    }

    await fastify
      .writeAuditLog({
        action: 'TEAM_MEMBER_REMOVED',
        actorUid: hostId,
        entityId: memberId,
      })
      .catch(() => {});
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
    const data = { id: doc.id, ...(doc.data() || {}) };
    const enriched = await enrichHostProfileWithSignedUrls(data);
    return { host: enriched, profile: enriched };
  };

  const updateHostProfile = async (hostId: string, patch: PlainRecord) => {
    const cleanedPatch = cleanHostProfilePatch(patch);
    const safe: PlainRecord = {};
    for (const key of hostProfileFields) {
      if (cleanedPatch[key] !== undefined) safe[key] = cleanedPatch[key];
    }
    // Normalize image fields so the discovery engine can find them
    if (safe.photoURL) {
      safe.profileImage = safe.photoURL;
      safe.avatar = safe.photoURL;
    }
    if (safe.profileImage) {
      safe.avatar = safe.profileImage;
      safe.photoURL = safe.profileImage;
    }
    if (safe.avatar) {
      safe.profileImage = safe.avatar;
      safe.photoURL = safe.avatar;
    }
    if (safe.backdropURL) {
      safe.coverURL = safe.backdropURL;
      safe.coverImage = safe.backdropURL;
      safe.cover = safe.backdropURL;
    }
    if (safe.coverURL) {
      safe.coverImage = safe.coverURL;
      safe.cover = safe.coverURL;
      safe.backdropURL = safe.coverURL;
    }
    if (safe.coverImage) {
      safe.coverURL = safe.coverImage;
      safe.cover = safe.coverImage;
      safe.backdropURL = safe.coverImage;
    }
    if (safe.cover) {
      safe.coverURL = safe.cover;
      safe.coverImage = safe.cover;
      safe.backdropURL = safe.cover;
    }
    safe.updatedAt = new Date().toISOString();
    await fastify.db.collection('hosts').doc(hostId).set(safe, { merge: true });
    await fastify.publicDiscoveryService.syncHostReadModels(hostId).catch(() => {});
    await fastify.invalidatePublicDiscovery('all').catch(() => {});
    await fastify
      .writeAuditLog({
        action: 'HOST_PROFILE_UPDATED',
        actorUid: hostId,
        entityId: hostId,
        payload: { patch: safe },
      })
      .catch(() => {});
    return getHostProfile(hostId);
  };

  const getHostPartnerships = async (hostId: string) => {
    const snap = await fastify.db
      .collection('partnerships')
      .where('hostId', '==', hostId)
      .orderBy('createdAt', 'desc')
      .get()
      .catch(() => ({ docs: [] as any[] }));
    return {
      partnerships: (snap as any).docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })),
    };
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
    let snap;
    const fallbackUsed = process.env.NODE_ENV === 'development';
    if (fallbackUsed) {
      const fallbackQ = fastify.db
        .collection('notifications')
        .where('recipientId', '==', hostId)
        .limit(100);
      const tempSnap = await fallbackQ.get().catch(() => ({ docs: [] as any[] }));
      const sortedDocs = [...(tempSnap.docs || [])].sort((a: any, b: any) => {
        const aTime = new Date(a.data()?.createdAt || a.data()?.timestamp || 0).getTime();
        const bTime = new Date(b.data()?.createdAt || b.data()?.timestamp || 0).getTime();
        return bTime - aTime;
      });
      snap = { docs: sortedDocs.slice(0, 50) };
    } else {
      try {
        snap = await fastify.db
          .collection('notifications')
          .where('recipientId', '==', hostId)
          .orderBy('createdAt', 'desc')
          .limit(50)
          .get();
      } catch (err: any) {
        if (
          err.code === 9 ||
          String(err).includes('requires an index') ||
          String(err).includes('FAILED_PRECONDITION')
        ) {
          fastify.log.warn(
            'Firestore index missing for host notifications query. Falling back to in-memory sort.',
          );
          const fallbackQ = fastify.db
            .collection('notifications')
            .where('recipientId', '==', hostId)
            .limit(100);
          const tempSnap = await fallbackQ.get().catch(() => ({ docs: [] as any[] }));
          const sortedDocs = [...(tempSnap.docs || [])].sort((a: any, b: any) => {
            const aTime = new Date(a.data()?.createdAt || a.data()?.timestamp || 0).getTime();
            const bTime = new Date(b.data()?.createdAt || b.data()?.timestamp || 0).getTime();
            return bTime - aTime;
          });
          snap = { docs: sortedDocs.slice(0, 50) };
        } else {
          snap = { docs: [] as any[] };
        }
      }
    }

    return {
      notifications: (snap as any).docs.map((doc: any) => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          ...data,
          title: decrypt(data.title),
          message: decrypt(data.message),
        };
      }),
    };
  };

  const markHostNotificationsRead = async (hostId: string, body: PlainRecord) => {
    const notificationId = String(body.notificationId || '');
    const markAllRead = body.markAllRead === true;
    if (markAllRead) {
      const snap = await fastify.db
        .collection('notifications')
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
    let q: any = fastify.db
      .collection('orders')
      .where('hostId', '==', hostId)
      .orderBy('createdAt', 'desc');
    if (query.status) q = q.where('status', '==', query.status);
    const cursor = String(query.cursor || '');
    if (cursor) {
      const cursorDoc = await fastify.db
        .collection('orders')
        .doc(cursor)
        .get()
        .catch(() => null);
      if (cursorDoc?.exists) q = q.startAfter(cursorDoc);
    }
    const snap = await q
      .limit(pageSize + 1)
      .get()
      .catch(() => ({ docs: [] as any[] }));
    const docs = (snap as any).docs || [];
    const hasMore = docs.length > pageSize;
    const orders = docs.slice(0, pageSize).map((doc: any) => {
      const order = doc.data() as PlainRecord;
      return { id: doc.id, ...order, buyerEmail: undefined, buyerPhone: undefined };
    });
    return {
      orders,
      hasMore,
      nextCursor: hasMore ? (orders[orders.length - 1]?.id ?? null) : null,
    };
  };

  const getHostFinanceDisputes = async (ctx: any) => {
    const result = await financeService.getDisputes(ctx);
    return {
      disputes: asArray(result.data).map((dispute: PlainRecord) => ({
        id: dispute.disputeId,
        orderId: dispute.orderId,
        amount: toNumber(dispute.amount),
        disputedAmount: toNumber(dispute.disputedAmount ?? dispute.amount),
        disputeFee: toNumber(dispute.disputeFee ?? 0),
        status: dispute.status,
        disputeStatus: String(dispute.disputeStatus ?? dispute.status ?? 'pending'),
        curatorStatus: dispute.curatorStatus ?? null,
        customerName: dispute.customerName ?? dispute.buyerName ?? null,
        trackingLink: dispute.trackingLink ?? null,
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
    const account = buildPayoutAccountRecord(body, { partnerId: hostId, ownerType: 'host' });
    const ref = await fastify.db.collection('bank_accounts').add(account.record);
    return account.response(ref.id);
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
    const [overview, payoutsResult, disputesResult, balances] = await Promise.all([
      financeService.getOverview(ctx),
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
    const totalPaid = payouts
      .filter((payout) =>
        ['completed', 'paid', 'cleared'].includes(String(payout.status || '').toLowerCase()),
      )
      .reduce((sum, payout) => sum + toNumber(payout.amount), 0);

    return {
      metrics: {
        availableBalance: toNumber(balances.available),
        pendingPayouts: toNumber(balances.pending),
        settledPayouts: totalPaid,
        totalRevenue: toNumber(overview.totalRevenue),
        currency: overview.currency || 'INR',
      },
      totalPending: toNumber(balances.pending),
      totalPaid,
      openDisputes: asArray(disputesResult.data).filter(
        (dispute: PlainRecord) => String(dispute.status || '').toLowerCase() === 'open',
      ).length,
      recentPayouts: payouts,
      revenueByPeriod: asArray(overview.revenueByPeriod),
    };
  };

  const getHostOverviewSummary = async (ctx: any) => {
    const hostId = ctx.partnerId;
    const [partnerSnap, promoterSnap, eventsSnap, finance] = await Promise.all([
      fastify.db
        .collection('partnerships')
        .where('hostId', '==', hostId)
        .get()
        .catch(() => ({ docs: [] as any[] })),
      fastify.db
        .collection('promoter_connections')
        .where('hostId', '==', hostId)
        .where('status', '==', 'active')
        .get()
        .catch(() => ({ docs: [] as any[] })),
      fastify.db
        .collection('events')
        .where('creatorId', '==', hostId)
        .where('lifecycle', 'in', ['submitted', 'scheduled', 'live', 'approved'])
        // No orderBy here — avoids composite index requirement (FAILED_PRECONDITION).
        // Sorted in-memory below instead.
        .limit(50)
        .get()
        .catch(() => ({ docs: [] as any[] })),
      financeService.getFinanceSummary(ctx),
    ]);
    const partnerships = (partnerSnap as any).docs || [];
    const upcomingEvents = ((eventsSnap as any).docs || [])
      .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }))
      .sort((a: any, b: any) => {
        const aTime = a.startDate ? new Date(a.startDate).getTime() : 0;
        const bTime = b.startDate ? new Date(b.startDate).getTime() : 0;
        return aTime - bTime; // ascending
      })
      .slice(0, 5);
    return {
      pendingPartnerships: partnerships.filter(
        (doc: any) => (doc.data() || {}).status === 'pending',
      ).length,
      activePromoters: (promoterSnap as any).size || 0,
      upcomingEvents,
      stats: {
        revenue: finance.netRevenue || 0,
        ticketsSold: finance.totalTicketsSold || 0,
        pendingItems: partnerships.filter((doc: any) => (doc.data() || {}).status === 'pending')
          .length,
      },
    };
  };

  const getHostEventOverview = async (ctx: any, eventId: string) => {
    const event = await hostService.getEvent(ctx, eventId);
    if (!event) {
      const err: any = new Error('Event not found');
      err.statusCode = 404;
      throw err;
    }

    const [ordersSnap, checkinsSnap, tiersSnap, eventDoc, commerce] = await Promise.all([
      fastify.db
        .collection('orders')
        .where('eventId', '==', eventId)
        .where('status', 'in', ['confirmed', 'paid'])
        .get(),
      fastify.db.collection('ticket_scans').where('eventId', '==', eventId).get(),
      fastify.db.collection('events').doc(eventId).collection('ticket_tiers').get(),
      fastify.db.collection('events').doc(eventId).get(),
      getEventCommerceMetrics(fastify.db, eventId),
    ]);

    const orders = ordersSnap.docs.map((d) => ({
      id: ordersSnap.docs[ordersSnap.docs.indexOf(d)].id,
      ...d.data(),
    }));
    const checkins = checkinsSnap.docs.map((d) => d.data());
    const tiers = tiersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const eventData = eventDoc.data() || {};

    // Revenue & tickets
    const grossRevenue = commerce.grossRevenue;
    const estimatedEarnings =
      commerce.ledgerEntries
        .filter(
          (entry) =>
            entry.toPartnerId === ctx.partnerId && ['host_payout', 'refund'].includes(entry.type),
        )
        .reduce((sum, entry) => sum + Number(entry.amountPaise || 0), 0) / 100;
    const ticketsSold = commerce.ticketsSold;
    const totalCheckedIn = checkins.length;
    const capacity = tiers.reduce(
      (sum: number, t: any) => sum + toNumber(t.capacity || t.quantity || 0),
      0,
    );
    const inventory = capacity - ticketsSold;
    const sellThrough = capacity > 0 ? Math.round((ticketsSold / capacity) * 100) : 0;

    // Guest list size = unique attendee orders
    const uniqueBuyers = new Set(
      commerce.soldTickets.map((ticket) => ticket.userId).filter(Boolean),
    ).size;
    const guestListSize = uniqueBuyers;

    // Conversion: views → purchases (views from event doc)
    const views = toNumber(eventData.stats?.views || eventData.views || 0);
    const saves = toNumber(eventData.stats?.saves || eventData.saves || 0);
    const conversionRate = views > 0 ? Math.round((ticketsSold / views) * 1000) / 10 : 0; // % with 1 decimal

    // Repeat vs new guests (buyers who appear in past orders for this host)
    const uniqueAttendees = uniqueBuyers;
    const repeatGuests = 0; // Would need cross-event query — return 0 as safe default
    const firstTimeGuests = uniqueAttendees;

    // Ticket mix & top tier
    const tierMap: Record<
      string,
      { tierId: string; tierName: string; sold: number; revenue: number }
    > = {};
    const orderTicketCounts = commerce.soldTickets.reduce(
      (counts, ticket) => {
        counts[ticket.orderId] = (counts[ticket.orderId] || 0) + 1;
        return counts;
      },
      {} as Record<string, number>,
    );
    for (const ticket of commerce.soldTickets) {
      const tierId = ticket.tierId || 'unknown';
      const tierName = ticket.tierName || tierId;
      if (!tierMap[tierId]) tierMap[tierId] = { tierId, tierName, sold: 0, revenue: 0 };
      tierMap[tierId].sold += 1;
      tierMap[tierId].revenue +=
        Number(commerce.orderRevenuePaise[ticket.orderId]?.netPaise || 0) /
        Math.max(orderTicketCounts[ticket.orderId] || 1, 1) /
        100;
    }
    // Fallback if no order items — use tier docs with sold counts
    if (Object.keys(tierMap).length === 0) {
      for (const t of tiers as any[]) {
        const sold = toNumber(t.sold || t.soldCount || 0);
        const revenue = sold * toNumber(t.price || 0);
        tierMap[t.id] = { tierId: t.id, tierName: t.name || 'Tier', sold, revenue };
      }
    }
    const ticketMix = Object.values(tierMap);
    const topTier =
      ticketMix.length > 0
        ? ticketMix.reduce((best, t) => (t.sold > best.sold ? t : best), ticketMix[0])
        : null;

    // Top promoter
    const promoterSales: Record<string, { name: string; sales: number; revenue: number }> = {};
    for (const ticket of commerce.soldTickets) {
      const promoterId = ticket.promoterId;
      if (promoterId) {
        if (!promoterSales[promoterId]) {
          promoterSales[promoterId] = { name: promoterId, sales: 0, revenue: 0 };
        }
        promoterSales[promoterId].sales += 1;
        promoterSales[promoterId].revenue +=
          Number(commerce.orderRevenuePaise[ticket.orderId]?.netPaise || 0) /
          Math.max(orderTicketCounts[ticket.orderId] || 1, 1) /
          100;
      }
    }
    const topPromoterEntries = Object.values(promoterSales);
    const topPromoter =
      topPromoterEntries.length > 0
        ? topPromoterEntries.reduce(
            (best, p) => (p.sales > best.sales ? p : best),
            topPromoterEntries[0],
          )
        : null;

    // Location distribution — from buyer city/state in orders
    const locationMap: Record<string, number> = {};
    for (const o of orders as any[]) {
      const city = o.buyerCity || o.city || 'Unknown';
      locationMap[city] = (locationMap[city] || 0) + 1;
    }
    const locationDistribution = Object.entries(locationMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Sales timeline (daily buckets)
    const salesBuckets: Record<string, { tickets: number; revenue: number; checkIns: number }> = {};
    for (const ticket of commerce.soldTickets) {
      const date = String(ticket.issuedAt || ticket.createdAt || '').slice(0, 10);
      if (!date) continue;
      if (!salesBuckets[date]) salesBuckets[date] = { tickets: 0, revenue: 0, checkIns: 0 };
      salesBuckets[date].tickets += 1;
    }
    for (const ledgerEntry of [...commerce.revenueEntries, ...commerce.refundEntries]) {
      const date = String(ledgerEntry.createdAt || '').slice(0, 10);
      if (!date) continue;
      if (!salesBuckets[date]) salesBuckets[date] = { tickets: 0, revenue: 0, checkIns: 0 };
      salesBuckets[date].revenue += Number(ledgerEntry.amountPaise || 0) / 100;
    }
    for (const c of checkins) {
      const date = ((c as any).scannedAt || '').slice(0, 10);
      if (date && salesBuckets[date]) salesBuckets[date].checkIns++;
    }
    const salesTimeline = Object.entries(salesBuckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => ({
        date,
        label: new Date(date + 'T00:00:00Z').toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
        }),
        tickets: b.tickets,
        revenue: b.revenue,
        checkIns: b.checkIns,
      }));

    // Hourly timeline (from check-in scan times)
    const hourlyBuckets: Record<number, { tickets: number; revenue: number; checkIns: number }> =
      {};
    for (let h = 0; h < 24; h++) hourlyBuckets[h] = { tickets: 0, revenue: 0, checkIns: 0 };
    for (const c of checkins) {
      const ts = (c as any).scannedAt || '';
      if (ts) {
        const hour = new Date(ts).getHours();
        hourlyBuckets[hour].checkIns++;
      }
    }
    for (const ticket of commerce.soldTickets) {
      const ts = ticket.issuedAt || ticket.createdAt || '';
      if (ts) {
        const hour = new Date(ts).getHours();
        hourlyBuckets[hour].tickets += 1;
      }
    }
    for (const ledgerEntry of [...commerce.revenueEntries, ...commerce.refundEntries]) {
      const ts = ledgerEntry.createdAt || '';
      if (ts) {
        const hour = new Date(ts).getHours();
        hourlyBuckets[hour].revenue += Number(ledgerEntry.amountPaise || 0) / 100;
      }
    }
    const hourlyTimeline = Array.from({ length: 24 }, (_, h) => {
      const label = `${h === 0 ? 12 : h <= 12 ? h : h - 12}${h < 12 ? 'am' : 'pm'}`;
      return { hour: h, label, ...hourlyBuckets[h] };
    });
    const peakSalesHour = hourlyTimeline.reduce(
      (peak, h) =>
        h.revenue > (peak?.revenue || 0) ? { label: h.label, revenue: h.revenue } : peak,
      null as { label: string; revenue: number } | null,
    );
    const peakCheckInHour = hourlyTimeline.reduce(
      (peak, h) =>
        h.checkIns > (peak?.checkIns || 0) ? { label: h.label, checkIns: h.checkIns } : peak,
      null as { label: string; checkIns: number } | null,
    );

    return {
      // Core stats (matches OverviewData interface)
      ticketsSold,
      grossRevenue,
      netRevenue: commerce.netRevenue,
      estimatedEarnings,
      guestListSize,
      totalCheckedIn,
      conversionRate,
      sellThrough,
      uniqueAttendees,
      repeatGuests,
      firstTimeGuests,
      topTier,
      locationDistribution,
      ticketMix,
      inventory,
      capacity,
      isPublic: eventData.isPublic !== false,
      isLiveEditable: eventData.status === 'live' || eventData.lifecycle === 'live',
      topPromoter,
      views,
      saves,
      salesTimeline,
      hourlyTimeline,
      peakSalesHour,
      peakCheckInHour,
      timeZone: eventData.timeZone || 'Asia/Kolkata',
      // Keep legacy shape for backwards compat
      event: {
        id: event.eventId,
        title: event.title,
        status: event.status,
        startDate: event.startDate,
        venueName: event.venueName,
      },
      stats: {
        revenue: commerce.netRevenue,
        ticketsSold,
        checkedIn: totalCheckedIn,
        capacity,
      },
      recentOrders: orders.slice(0, 10).map((o: any) => ({
        id: o.orderId || o.id,
        userName: o.userName,
        amount: Number(commerce.orderRevenuePaise[o.id]?.netPaise || 0) / 100,
        createdAt: o.createdAt,
      })),
    };
  };

  const processGuestCheckIn = async (ctx: any, eventId: string, body: any) => {
    const { orderId } = body;
    if (!orderId) {
      const err: any = new Error('orderId is required');
      err.statusCode = 400;
      throw err;
    }

    const orderRef = fastify.db.collection('orders').doc(orderId);
    const scanDocId = `${orderId}_host_manual`;
    const scanRef = fastify.db.collection('ticket_scans').doc(scanDocId);
    let alreadyCheckedIn = false;

    await fastify.db.runTransaction(async (tx: any) => {
      const orderDoc = await tx.get(orderRef);
      if (!orderDoc.exists) throw new Error('Order not found');
      const order = orderDoc.data();

      if (order.eventId !== eventId) throw new Error('Order does not belong to this event');

      if (order.status === 'checked_in') {
        alreadyCheckedIn = true;
        return;
      }

      const now = new Date().toISOString();
      tx.update(orderRef, {
        status: 'checked_in',
        checkedInAt: now,
        checkInSource: 'host_dashboard',
      });

      tx.set(scanRef, {
        orderId,
        eventId,
        result: 'valid',
        scannedBy: { uid: ctx.partnerId, name: 'Host Dashboard', role: 'host' },
        scannedAt: now,
        createdAt: now,
      });
    });

    if (alreadyCheckedIn) {
      return { success: false, error: 'Already checked in' };
    }

    return { success: true };
  };

  const getHostPromoters = async (hostId: string) => {
    const snap = await fastify.db
      .collection('promoter_connections')
      .where('hostId', '==', hostId)
      .orderBy('createdAt', 'desc')
      .get()
      .catch(() => ({ docs: [] as any[] }));
    return {
      promoters: (snap as any).docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })),
    };
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
    const rawTiers = asArray(
      (event as PlainRecord).ticketTiers ||
        (event as PlainRecord).tiers ||
        (event as PlainRecord).tickets,
    );
    const tiers = rawTiers.map((tier: PlainRecord, index: number) => {
      const qty = toNumber(tier.quantity || tier.maxQuantity || 0);
      const sold = toNumber(tier.sold || 0);
      const remaining = Math.max(0, qty - sold);
      const sellThrough = qty > 0 ? Math.round((sold / qty) * 100) : 0;
      return {
        id: tier.id || tier.tierId || String(index),
        name: tier.name || '',
        description: tier.description || '',
        entryType: tier.entryType || 'general',
        price: toNumber(tier.price || 0),
        quantity: qty,
        sold,
        remaining,
        sellThrough,
        startSale: tier.startSale || tier.saleStartDate || null,
        endSale: tier.endSale || tier.saleEndDate || null,
        minPurchaseQuantity: toNumber(tier.minPurchaseQuantity || tier.minQty || 1),
        maxPurchaseQuantity: toNumber(tier.maxPurchaseQuantity || tier.maxQty || 10),
        promoterEnabled: tier.promoterEnabled !== false,
        isHidden: !!tier.isHidden,
        isDisabled: !!tier.isDisabled,
        isSoldOut: qty > 0 && remaining === 0,
        passwordProtected: !!tier.passwordProtected,
        requiresApproval: !!tier.requiresApproval,
        status: tier.status || 'active',
        order: toNumber(tier.order ?? index),
      };
    });
    const totalSold = tiers.reduce((s, t) => s + t.sold, 0);
    const totalInventory = tiers.reduce((s, t) => s + t.quantity, 0);
    const totalRemaining = tiers.reduce((s, t) => s + t.remaining, 0);
    return { tiers, totalSold, totalInventory, totalRemaining };
  };

  const updateHostEventTickets = async (hostId: string, eventId: string, body: PlainRecord) => {
    if (!Array.isArray(body.tiers)) {
      const err: any = new Error('tiers array required');
      err.statusCode = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }
    await getHostEventAndVerify(hostId, eventId);
    await fastify.db
      .collection('events')
      .doc(eventId)
      .update({ ticketTiers: body.tiers, updatedAt: new Date().toISOString() });
    await fastify.cache.delete('events:detail', eventId).catch(() => {});
    await fastify
      .writeAuditLog({
        action: 'EVENT_TICKETS_UPDATED',
        actorUid: hostId,
        entityId: eventId,
        payload: { hostId },
      })
      .catch(() => {});
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

    // Standalone host events (no venue) self-publish immediately to 'scheduled'.
    // Events tied to a venue go to 'submitted' and wait for slot approval.
    const isStandalone = !event.venueId;
    const toState = isStandalone ? 'scheduled' : 'submitted';
    const extraUpdates: PlainRecord = isStandalone
      ? { visibility: 'public', publishedAt: now }
      : {};

    await fastify.db
      .collection('events')
      .doc(eventId)
      .update({
        lifecycle: toState,
        status: toState,
        updatedAt: now,
        submittedAt: now,
        ...extraUpdates,
      });
    await fastify.db.collection('submission_history').add({
      eventId,
      fromState: lifecycle,
      toState,
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
    await fastify.publicDiscoveryService.syncEventReadModels(eventId);
    await fastify
      .writeAuditLog({
        action: isStandalone ? 'EVENT_PUBLISHED' : 'EVENT_SUBMITTED',
        actorUid: request.user?.uid || hostId,
        entityId: eventId,
        payload: { hostId, standalone: isStandalone },
      })
      .catch(() => {});
    return { success: true, lifecycle: toState };
  };

  const resubmitHostEvent = async (
    request: any,
    hostId: string,
    eventId: string,
    body: PlainRecord,
  ) => {
    const event = await getHostEventAndVerify(hostId, eventId);
    const lifecycle = String(event.lifecycle || event.status || '');
    if (!['changes_requested', 'rejected'].includes(lifecycle)) {
      const err: any = new Error(`Cannot resubmit event in ${lifecycle} state`);
      err.statusCode = 409;
      err.code = 'CONFLICT';
      throw err;
    }
    const now = new Date().toISOString();
    const isStandalone = !event.venueId;
    const toState = isStandalone ? 'scheduled' : 'submitted';
    const updates: PlainRecord = {
      lifecycle: toState,
      status: toState,
      updatedAt: now,
      resubmittedAt: now,
      ...(isStandalone ? { visibility: 'public', publishedAt: now } : {}),
    };
    Object.assign(updates, sanitizeEventResubmissionPatch(body.patch));
    await fastify.db.collection('events').doc(eventId).update(updates);
    await fastify.db.collection('submission_history').add({
      eventId,
      fromState: lifecycle,
      toState,
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
    await fastify.publicDiscoveryService.syncEventReadModels(eventId);
    await fastify
      .writeAuditLog({
        action: isStandalone ? 'EVENT_PUBLISHED' : 'EVENT_RESUBMITTED',
        actorUid: request.user?.uid || hostId,
        entityId: eventId,
        payload: { hostId, note: body.note, standalone: isStandalone },
      })
      .catch(() => {});
    return { success: true, lifecycle: toState };
  };

  const getHostAnalyticsTimeSeries = async (hostId: string, query: PlainRecord) => {
    const range = String(query.range || '1w');
    const metric = String(query.metric || 'revenue');
    const cacheKey = `${hostId}:${range}:${metric}:v2`;
    const cached = await fastify.cache.get('analytics:host:ts', cacheKey);
    if (cached) return { ...cached, fromCache: true };

    const days =
      range === '1d' ? 1 : range === '1w' ? 7 : range === '1m' ? 30 : range === '3m' ? 90 : 7;
    const nowMs = Date.now();
    const fromMs = nowMs - days * 86400000;
    const fromIso = new Date(fromMs).toISOString();

    const ordersSnap = await fastify.db
      .collection('orders')
      .where('hostId', '==', hostId)
      .where('status', 'in', ['confirmed', 'paid'])
      .where('createdAt', '>=', fromIso)
      .limit(1000)
      .get()
      .catch(() => ({ docs: [] as any[] }));

    const buckets = new Map<string, { revenue: number; ticketsSold: number }>();
    for (let d = 0; d < days; d++) {
      const label = new Date(fromMs + d * 86400000).toISOString().slice(0, 10);
      buckets.set(label, { revenue: 0, ticketsSold: 0 });
    }
    for (const doc of (ordersSnap as any).docs) {
      const od = doc.data() || {};
      const label = String(od.createdAt || '').slice(0, 10);
      if (buckets.has(label)) {
        const b = buckets.get(label)!;
        b.revenue += toNumber(od.amount || od.total || 0);
        b.ticketsSold += toNumber(od.ticketsCount || od.quantity || 1);
      }
    }

    const series = Array.from(buckets.entries()).map(([date, b]) => ({
      label: date,
      date,
      revenue: b.revenue,
      ticketsSold: b.ticketsSold,
      value: metric === 'revenue' ? b.revenue : b.ticketsSold,
    }));
    const totals = series.reduce(
      (acc, pt) => ({
        revenue: acc.revenue + pt.revenue,
        ticketsSold: acc.ticketsSold + pt.ticketsSold,
      }),
      { revenue: 0, ticketsSold: 0 },
    );
    const legacyStats = await getHostAnalytics(hostId, range as any).catch(() => ({}));
    const result = {
      ...asRecord(legacyStats),
      series,
      total: metric === 'revenue' ? totals.revenue : totals.ticketsSold,
    };
    await fastify.cache.set('analytics:host:ts', cacheKey, result, 120);
    return result;
  };

  const getHostVenueCalendar = async (hostId: string, query: PlainRecord) => {
    const venueId = String(query.venueId || '');
    const partnerSnap = await fastify.db
      .collection('partnerships')
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
    const [eventsSnap, slots] = await Promise.all([
      fastify.db
        .collection('events')
        .where('venueId', '==', venueId)
        .get()
        .catch(() => ({ docs: [] as any[] })),
      schedulingService.getCalendar(venueId, {
        startDate: String(query.startDate || '1970-01-01'),
        endDate: String(query.endDate || '2999-12-31'),
      }),
    ]);
    const events = ((eventsSnap as any).docs || []).map((doc: any) => ({
      id: doc.id,
      ...(doc.data() || {}),
    }));
    const dates: PlainRecord[] = [];
    const cursor = new Date(`${String(query.startDate)}T00:00:00.000Z`);
    const end = new Date(`${String(query.endDate)}T00:00:00.000Z`);

    while (cursor <= end) {
      const dateKey = cursor.toISOString().slice(0, 10);
      const dayEvents = events.filter(
        (event: any) => String(event.startDate || '').slice(0, 10) === dateKey,
      );

      // Mask events not owned by this host
      const maskedEvents = dayEvents.map((ev: any) => {
        const isOwner = String(ev.creatorId || ev.hostId || '') === hostId;
        if (isOwner) return ev;
        return {
          id: ev.id,
          startDate: ev.startDate,
          status: ev.status,
          isExternal: true,
          title: 'Reserved Event', // Mask title for privacy
        };
      });

      const allDaySlots = slots.filter((slot) => String(slot.date || '') === dateKey);
      const block =
        allDaySlots.find((slot) => String(slot.status || '').toLowerCase() === 'blocked') || null;
      const visibleSlots = allDaySlots.filter(
        (slot) => String(slot.status || '').toLowerCase() !== 'blocked',
      );
      const confirmedSlots = visibleSlots.filter((slot) =>
        ['approved', 'occupied'].includes(String(slot.status || '').toLowerCase()),
      );

      // Filter for confirmed/booked events (exclude draft, deleted, cancelled, denied)
      const bookedEvents = dayEvents.filter((event: any) => {
        const lifecycle = String(event.lifecycle || event.status || 'draft').toLowerCase();
        return (
          lifecycle !== 'draft' &&
          lifecycle !== 'deleted' &&
          lifecycle !== 'cancelled' &&
          lifecycle !== 'denied'
        );
      });

      // Count drafts at the media or review creation steps as pending status
      const pendingDraftsCount = dayEvents.filter((event: any) => {
        const lifecycle = String(event.lifecycle || event.status || 'draft').toLowerCase();
        const lastStep = String(event.draftMeta?.lastStep || '').toLowerCase();
        return lifecycle === 'draft' && (lastStep === 'media' || lastStep === 'review');
      }).length;

      dates.push({
        date: dateKey,
        state: block
          ? 'BLOCKED'
          : bookedEvents.length > 0 || confirmedSlots.length > 0
            ? 'CONFIRMED'
            : 'OPEN',
        events: maskedEvents,
        slots: visibleSlots.map((slot) => ({
          id: slot.slotId,
          slotId: slot.slotId,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: slot.status,
          notes: slot.notes ?? null,
        })),
        block,
        stats: {
          eventCount: bookedEvents.length,
          pendingSlots:
            visibleSlots.filter((slot) => String(slot.status || '').toLowerCase() === 'requested')
              .length + pendingDraftsCount,
        },
      });

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return { calendar: dates, days: dates };
  };

  // ── Overview ───────────────────────────────────────────────────────────────

  fastify.get(
    '/partners/hosts/overview',
    {
      preHandler: [fastify.validate({ querystring: OverviewQuerySchema }), fastify.requireAuth],
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
        requireType(ctx, 'host');
        const hostDoc = await fastify.db
          .collection('hosts')
          .doc(ctx.partnerId)
          .get()
          .catch(() => null);
        const warnings = hostDoc && hostDoc.exists ? hostDoc.data()?.warnings || [] : [];

        const range = request.query.range ?? '1m';
        const metric = request.query.metric ?? 'tickets';
        const cacheKey = `partners:host:overview:${ctx.partnerId}:${range}:${metric}:contract-v1`;
        const cached = await fastify.cache.get('partners', cacheKey);
        if (cached) {
          return reply
            .header('Cache-Control', 'private, max-age=120')
            .send({ ...cached, warnings, fromCache: true });
        }

        const result = await hostService.getOverview(ctx, { range, metric });

        const stats = {
          ...asRecord(result.stats),
          revenue: result.stats.totalRevenue,
          ticketsSold: result.stats.totalTicketsSold,
          activePromoters: (
            await fastify.db
              .collection('partnerships')
              .where('hostId', '==', ctx.partnerId)
              .where('status', '==', 'active')
              .count()
              .get()
          ).data().count,
          pendingItems: result.stats.activeEventsCount,
        };

        const normalized = {
          success: true,
          stats,
          kpis: buildHostKpis(stats),
          activePromoters: stats.activePromoters,
          pendingItems: stats.pendingItems,
          upcomingEvents: asArray(result.upcomingEvents).map((e) => ({
            ...e,
            id: e.eventId,
            name: e.title,
            date: e.startDate,
            venue_name: e.venueName,
            poster_url: e.coverImage,
            lifecycle: e.status,
          })),
          recentActivity: asArray(result.recentActivity),
          latestOrders: asArray(result.latestOrders),
          performance: asArray(result.performance),
          warnings,
        };

        await fastify.cache.set('partners', cacheKey, normalized, 120);
        return reply.header('Cache-Control', 'private, max-age=120').send(normalized);
      } catch (err: any) {
        fastify.log.error(
          { err: err.message, partnerId: ctx.partnerId },
          'partners/hosts/overview error',
        );
        if (err.statusCode)
          return reply.status(err.statusCode).send(
            buildErrorResponse({
              code: err.code ?? 'ERROR',
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

  // ── Events list ────────────────────────────────────────────────────────────

  fastify.get(
    '/partners/hosts/events',
    {
      preHandler: [fastify.validate({ querystring: EventFiltersSchema }), fastify.requireAuth],
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
        requireType(ctx, 'host');
        const filters = {
          status: request.query.status,
          cursor: request.query.cursor ?? request.query.lastId,
          limit: request.query.limit,
        };
        const result = await hostService.getEvents(ctx, filters);
        return reply.header('Cache-Control', 'private, max-age=60').send({
          success: true,
          events: asArray(result.data).map((e) => ({
            ...e,
            id: e.eventId,
            name: e.title,
            date: e.startDate,
            venue_name: e.venueName,
            poster_url: e.coverImage,
            lifecycle: e.status,
          })),
          data: asArray(result.data).map((e) => ({
            ...e,
            id: e.eventId,
            name: e.title,
            date: e.startDate,
            venue_name: e.venueName,
            poster_url: e.coverImage,
            lifecycle: e.status,
          })),
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
        });
      } catch (err: any) {
        fastify.log.error({ err: err.message }, 'partners/hosts/events error');
        if (err.statusCode)
          return reply
            .status(err.statusCode)
            .send(
              buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }),
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

  // ── Single event ───────────────────────────────────────────────────────────

  fastify.get(
    '/partners/hosts/events/:eventId',
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
        requireType(ctx, 'host');
        const event = await hostService.getEvent(ctx, request.params.eventId);
        if (!event)
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Event not found',
              requestId: request.id,
            }),
          );
        return reply.header('Cache-Control', 'private, max-age=30').send(event);
      } catch (err: any) {
        if (err.statusCode)
          return reply
            .status(err.statusCode)
            .send(
              buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }),
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

  // ── Calendar ───────────────────────────────────────────────────────────────

  fastify.get(
    '/partners/hosts/calendar',
    {
      preHandler: [fastify.validate({ querystring: CalendarQuerySchema }), fastify.requireAuth],
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
        requireType(ctx, 'host');
        const calendar = await getHostVenueCalendar(ctx.partnerId, request.query);
        return reply.header('Cache-Control', 'private, max-age=60').send(calendar);
      } catch (err: any) {
        if (err.statusCode)
          return reply
            .status(err.statusCode)
            .send(
              buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }),
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

  // ── List slot requests (host) ──────────────────────────────────────────────
  // The page shows events submitted to venues for review.
  // Tabs filter by event lifecycle: submitted=pending, approved=approved,
  // needs_changes=needs action, denied=denied.

  fastify.get(
    '/partners/hosts/slot-requests',
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
        requireType(ctx, 'host');
        const hostId = ctx.partnerId;

        // Fetch events in review-relevant lifecycle states, by both owner fields.
        // No orderBy — avoids composite index requirement (FAILED_PRECONDITION).
        const reviewLifecycles = ['submitted', 'approved', 'needs_changes', 'denied'];

        const [creatorSnap, hostSnap] = await Promise.all([
          fastify.db
            .collection('events')
            .where('creatorId', '==', hostId)
            .where('lifecycle', 'in', reviewLifecycles)
            .limit(200)
            .get()
            .catch(() => ({ docs: [] as any[] })),
          fastify.db
            .collection('events')
            .where('hostId', '==', hostId)
            .where('lifecycle', 'in', reviewLifecycles)
            .limit(200)
            .get()
            .catch(() => ({ docs: [] as any[] })),
        ]);

        // Merge, deduplicate by doc id
        const docsById = new Map<string, any>();
        for (const doc of [...(creatorSnap as any).docs, ...(hostSnap as any).docs]) {
          docsById.set(doc.id, doc);
        }

        const requests = [...docsById.values()]
          .map((doc: any) => {
            const d = doc.data() as Record<string, any>;
            const startDate = d.startDate
              ? typeof d.startDate === 'string'
                ? d.startDate
                : (d.startDate?.toDate?.()?.toISOString?.() ?? '')
              : '';
            const createdAt = d.createdAt?.toDate?.()?.toISOString?.() ?? String(d.createdAt ?? '');
            const updatedAt = d.updatedAt?.toDate?.()?.toISOString?.() ?? null;
            return {
              id: doc.id,
              eventId: doc.id,
              venueId: String(d.venueId || ''),
              venueName: String(d.venueName || d.venue?.name || ''),
              // Use the event's start date/time as the requested slot
              requestedDate: startDate.split('T')[0] ?? '',
              requestedStartTime: d.startTime || startDate.split('T')[1]?.slice(0, 5) || '',
              requestedEndTime:
                d.endTime ||
                (d.endDate
                  ? ((typeof d.endDate === 'string'
                      ? d.endDate
                      : (d.endDate?.toDate?.()?.toISOString?.() ?? '')
                    )
                      .split('T')[1]
                      ?.slice(0, 5) ?? '')
                  : ''),
              status: String(d.lifecycle || d.status || 'pending'),
              notes: d.notes ?? d.description ?? null,
              clubResponse: d.clubResponse ?? d.venueNote ?? d.adminNote ?? null,
              alternativeDate: d.alternativeDate ?? null,
              alternativeStartTime: d.alternativeStartTime ?? null,
              alternativeEndTime: d.alternativeEndTime ?? null,
              createdAt,
              respondedAt: updatedAt,
            };
          })
          // Sort newest first in memory (avoids composite index requirement)
          .sort((a: any, b: any) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          });

        return reply
          .header('Cache-Control', 'private, max-age=60')
          .send({ success: true, requests });
      } catch (err: any) {
        fastify.log.error({ err: (err as any).message }, 'partners/hosts/slot-requests error');
        if (err.statusCode)
          return reply
            .status(err.statusCode)
            .send(
              buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }),
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

  // ── Request a slot ─────────────────────────────────────────────────────────

  fastify.post(
    '/partners/hosts/slot-requests',
    {
      preHandler: [fastify.validate({ body: SlotRequestSchema }), fastify.requireAuth],
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
        requireType(ctx, 'host');
        const slot = await schedulingService.requestSlot(ctx, request.body);
        return reply.status(201).send({ slot });
      } catch (err: any) {
        if (err.statusCode)
          return reply
            .status(err.statusCode)
            .send(
              buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }),
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

  // ── Settings ───────────────────────────────────────────────────────────────

  fastify.get(
    '/partners/hosts/settings',
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
        requireType(ctx, 'host');
        // When include=sessions, return active sessions for this user
        if ((request.query as any).include === 'sessions') {
          const snap = await fastify.db
            .collection('host_sessions')
            .where('uid', '==', ctx.uid)
            .limit(20)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const sessions = ((snap as any).docs || []).map((d: any) => d.data() || {});
          return reply.send({ sessions });
        }
        const doc = await fastify.db.collection('hosts').doc(ctx.partnerId).get();
        const data = doc.exists ? doc.data() || {} : {};
        const settings = {
          hostId: ctx.partnerId,
          orgName: data.orgName || data.displayName || data.name || '',
          supportEmail: data.supportEmail || data.contactEmail || data.email || '',
          legalPhone: data.legalPhone || data.contactPhone || data.phone || '',
          website: data.website || '',
          logoUrl: data.profileImage || data.photoURL || null,
          defaultTimezone: data.defaultTimezone || 'Asia/Kolkata',
          defaultCurrency: data.defaultCurrency || 'INR',
          notificationPreferences: data.notificationPreferences || {
            slotApproved_email: true,
            slotApproved_push: true,
            slotApproved_sms: false,
            slotRejected_email: true,
            slotRejected_push: true,
            slotRejected_sms: false,
            eventReminder_email: true,
            eventReminder_push: true,
            eventReminder_sms: false,
            promoterRequest_email: true,
            promoterRequest_push: true,
            promoterRequest_sms: false,
            newFollower_email: true,
            newFollower_push: true,
            newFollower_sms: false,
            weeklyDigest_email: true,
            weeklyDigest_push: false,
            weeklyDigest_sms: false,
          },
        };
        return reply.header('Cache-Control', 'private, max-age=300').send({ settings });
      } catch (err: any) {
        if (err.statusCode)
          return reply
            .status(err.statusCode)
            .send(
              buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }),
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

  // ── Team ───────────────────────────────────────────────────────────────────

  fastify.get('/partners/hosts/team/accept', async (request: any, reply: any) => {
    const { code, hostId } = request.query as any;
    if (!code || !hostId) {
      return reply.status(400).send({ error: 'code and hostId required' });
    }
    try {
      const snap = await fastify.db
        .collection('host_team_invitations')
        .where('hostId', '==', hostId)
        .where('inviteToken', '==', code)
        .limit(1)
        .get();

      if (snap.empty) {
        return reply.status(404).send({ error: 'Invitation not found or invalid' });
      }

      const invDoc = snap.docs[0];
      const invData = invDoc.data();

      if (invData.inviteExpires && new Date() > new Date(invData.inviteExpires)) {
        return reply.status(400).send({ error: 'Invitation has expired' });
      }

      return reply.send({
        name:
          invData.firstName && invData.lastName
            ? `${invData.firstName} ${invData.lastName}`
            : 'Team Member',
        email: invData.email,
        role: invData.role,
        partnerName: invData.partnerName || 'Host Partner',
        status: invData.status,
      });
    } catch (err: any) {
      fastify.log.error({ err }, 'GET /partners/hosts/team/accept failed');
      return reply.status(500).send(
        buildErrorResponse({
          code: 'INTERNAL_ERROR',
          message: err.message || 'Failed to retrieve invitation',
          requestId: request.id,
        }),
      );
    }
  });

  fastify.post('/partners/hosts/team/accept', async (request: any, reply: any) => {
    const { inviteCode, hostId } = request.body as any;
    if (!inviteCode || !hostId) {
      return reply.status(400).send({ error: 'inviteCode and hostId required' });
    }

    try {
      const snap = await fastify.db
        .collection('host_team_invitations')
        .where('hostId', '==', hostId)
        .where('inviteToken', '==', inviteCode)
        .limit(1)
        .get();

      if (snap.empty) {
        return reply.status(404).send({ error: 'Invitation not found or invalid' });
      }

      const invDoc = snap.docs[0];
      const invData = invDoc.data();

      if (invData.inviteExpires && new Date() > new Date(invData.inviteExpires)) {
        return reply.status(400).send({ error: 'Invitation has expired' });
      }

      if (invData.status === 'accepted' || invData.status === 'active') {
        let customToken = '';
        try {
          const userRecord = await fastify.auth.getUserByEmail(invData.email);
          customToken = await fastify.auth.createCustomToken(userRecord.uid);
        } catch (tokenErr) {
          fastify.log.error(
            { err: tokenErr },
            'Failed to generate custom token for already accepted invite',
          );
        }
        return reply.send({
          success: true,
          email: invData.email,
          customToken,
          alreadyAccepted: true,
        });
      }

      const email = invData.email;
      const name =
        invData.firstName && invData.lastName
          ? `${invData.firstName} ${invData.lastName}`
          : 'Team Member';
      const role = invData.role;
      const tempPassword = decrypt(invData.tempPassword);

      // 1. Create/update the Firebase user
      let userRecord;
      try {
        userRecord = await fastify.auth.getUserByEmail(email);
        await fastify.auth.updateUser(userRecord.uid, { password: tempPassword });
        await fastify.db.collection('users').doc(userRecord.uid).update({
          role: 'host',
          isApproved: true,
          onboardingComplete: true,
          mustChangePassword: true,
          updatedAt: new Date().toISOString(),
        });
      } catch (e: any) {
        if (e.code === 'auth/user-not-found') {
          userRecord = await fastify.auth.createUser({
            email,
            password: tempPassword,
            displayName: name,
          });

          await fastify.db.collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email,
            displayName: name,
            role: 'host',
            isApproved: true,
            onboardingComplete: true,
            mustChangePassword: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } else {
          throw e;
        }
      }

      const uid = userRecord.uid;
      const partnerName = invData.partnerName || 'Host Partner';

      // 2. Create or update the partner_memberships document
      const membershipSnap = await fastify.db
        .collection('partner_memberships')
        .where('partnerId', '==', hostId)
        .where('uid', '==', uid)
        .limit(1)
        .get();

      if (membershipSnap.empty) {
        await fastify.db.collection('partner_memberships').add({
          uid,
          partnerId: hostId,
          partnerName,
          partnerType: 'host',
          role,
          isActive: true,
          joinedAt: Date.now(),
          createdAt: new Date().toISOString(),
        });
      } else {
        await membershipSnap.docs[0].ref.update({
          isActive: true,
          role,
          updatedAt: new Date().toISOString(),
        });
      }

      // 3. Update the host_team_invitations record status to active
      await invDoc.ref.update({
        status: 'accepted',
        userId: uid,
        updatedAt: new Date().toISOString(),
      });

      const customToken = await fastify.auth.createCustomToken(uid);
      return reply.send({ success: true, email, customToken });
    } catch (err: any) {
      fastify.log.error({ err }, 'POST /partners/hosts/team/accept failed');
      return reply.status(500).send(
        buildErrorResponse({
          code: 'INTERNAL_ERROR',
          message: err.message || 'Failed to accept invitation',
          requestId: request.id,
        }),
      );
    }
  });

  fastify.get(
    '/partners/hosts/team',
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
        requireType(ctx, 'host');
        const members = await hostService.getTeam(ctx);

        const invitesSnap = await fastify.db
          .collection('host_team_invitations')
          .where('hostId', '==', ctx.partnerId)
          .where('status', '==', 'pending')
          .get()
          .catch(() => ({ docs: [] }));

        const invitedMembers = invitesSnap.docs.map((doc: any) => {
          const d = doc.data();
          const displayName =
            d.firstName && d.lastName
              ? `${d.firstName} ${d.lastName}`
              : d.email || d.phone || 'Invited Member';
          return {
            membershipId: doc.id,
            uid: null,
            displayName,
            email: d.email || null,
            phone: d.phone || null,
            role: d.role || 'STAFF',
            status: 'invited',
            isActive: false,
            joinedAt: d.createdAt || null,
            lastActive: null,
            photoUrl: null,
            granularPermissions: d.granularPermissions || null,
            verified: false,
          };
        });

        const uids = asArray(members)
          .map((m: any) => m.uid)
          .filter(Boolean);
        const userMap = new Map<string, any>();
        if (uids.length > 0) {
          for (let i = 0; i < uids.length; i += 30) {
            const batch = uids.slice(i, i + 30);
            const userSnap = await fastify.db
              .collection('users')
              .where('__name__', 'in', batch)
              .get()
              .catch(() => ({ docs: [] }));
            userSnap.docs.forEach((doc: any) => {
              userMap.set(doc.id, doc.data());
            });
          }
        }

        const mappedMembers = asArray(members).map((m: any) => {
          const uProfile = m.uid ? userMap.get(m.uid) : null;
          const email = m.email || uProfile?.email || null;
          const phone = m.phone || uProfile?.phone || uProfile?.phoneNumber || null;
          const displayName =
            m.displayName ||
            uProfile?.displayName ||
            (uProfile?.firstName && uProfile?.lastName
              ? `${uProfile.firstName} ${uProfile.lastName}`
              : null) ||
            email ||
            phone ||
            'Team Member';

          return {
            membershipId: m.memberId || m.membershipId || '',
            uid: m.uid || null,
            displayName,
            email,
            phone,
            role: m.role || 'STAFF',
            status: m.isActive ? 'active' : 'suspended',
            isActive: m.isActive,
            joinedAt: m.joinedAt || null,
            lastActive: m.lastActive || null,
            photoUrl: m.photoUrl || uProfile?.photoUrl || uProfile?.photoURL || null,
            granularPermissions: m.granularPermissions || null,
            verified: m.verified || uProfile?.verified || false,
          };
        });

        return reply.header('Cache-Control', 'private, max-age=120').send({
          success: true,
          members: [...mappedMembers, ...invitedMembers],
        });
      } catch (err: any) {
        if (err.statusCode)
          return reply
            .status(err.statusCode)
            .send(
              buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }),
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

  fastify.patch(
    '/partners/hosts/team/:memberId',
    {
      preHandler: [fastify.validate({ body: TeamMemberPatch }), fastify.requireAuth],
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
        requireType(ctx, 'host');
        return reply.send(
          await patchTeamMember(ctx.partnerId, request.params.memberId, asRecord(request.body)),
        );
      } catch (err: any) {
        if (err.statusCode)
          return reply
            .status(err.statusCode)
            .send(
              buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }),
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

  fastify.delete(
    '/partners/hosts/team/:memberId',
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
        requireType(ctx, 'host');
        return reply.send(await removeTeamMember(ctx.partnerId, request.params.memberId));
      } catch (err: any) {
        if (err.statusCode)
          return reply
            .status(err.statusCode)
            .send(
              buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }),
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

  fastify.post(
    '/partners/hosts/upload',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply: any) => {
      try {
        const ctx = await resolvePartnerContext(fastify.db, request);
        // Debug: log partner context resolution
         
        console.debug('[hosts.upload] resolvePartnerContext', {
          requestId: request.id,
          hasCtx: !!ctx,
        });
        if (!ctx) return;
        await requireType(ctx, 'host');

        // Use shared upload helper so host upload has same behavior as venue
        const uploadResult = await uploadPartnerAsset(request, {
          partnerId: ctx.partnerId,
          partnerType: 'host',
          maxBytes: 5 * 1024 * 1024,
        });

        const signedUrl = await signStorageUrl(uploadResult.url);

        return reply.send({
          success: true,
          url: signedUrl,
          filename: uploadResult.filename,
          storagePath: uploadResult.storagePath,
        });
      } catch (err: any) {
        fastify.log.error(`Error in host upload: ${err.message}`);
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: err.message || 'Failed to upload file',
            requestId: request.id,
          }),
        );
      }
    },
  );

  // ── Native parity dispatch ────────────────────────────────────────────────

  fastify.route({
    method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    url: '/partners/hosts/*',
    preHandler: [fastify.requireAuth],
    handler: async (request: any, reply: any) => {
      const ctx = await resolvePartnerContext(fastify.db, request);
      if (!ctx) {
        return reply.status(403).send(
          buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'No partner identity found',
            requestId: request.id,
          }),
        );
      }

      try {
        requireType(ctx, 'host');
        const rest = String(request.params?.['*'] || '').replace(/^\/+/, '');
        if (!rest) {
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Partner host endpoint not found',
              requestId: request.id,
            }),
          );
        }

        const body = asRecord(request.body);
        const query = asRecord(request.query);

        if (rest.startsWith('partners/') && request.method === 'GET') {
          const partnerId = rest.slice('partners/'.length);
          const result = await getPartnerProfileWithPii(fastify.db, {
            viewerRole: ctx.type,
            viewerId: ctx.partnerId,
            partnerId,
          });
          if (!result) {
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Partner profile not found',
                requestId: request.id,
              }),
            );
          }
          return reply.send(result);
        }

        if (rest === 'profile' && request.method === 'GET')
          return reply.send(await getHostProfile(ctx.partnerId));

        if (rest === 'promoters/connections' && request.method === 'GET') {
          const status = (query.status as string) || 'approved';
          const snap = await fastify.db
            .collection('promoter_connections')
            .where('hostId', '==', ctx.partnerId)
            .get();

          const connections = snap.docs
            .map((doc: any) => ({ id: doc.id, ...doc.data() }))
            .filter((c: any) => !status || c.status === status);

          const promoterIds = [
            ...new Set(connections.map((c: any) => c.promoterId).filter(Boolean)),
          ];
          const promoterProfiles = new Map();
          if (promoterIds.length > 0) {
            for (let i = 0; i < promoterIds.length; i += 30) {
              const batch = promoterIds.slice(i, i + 30);
              const profileSnap = await fastify.db
                .collection('promoters')
                .where('__name__', 'in', batch)
                .get();
              profileSnap.docs.forEach((d: any) => promoterProfiles.set(d.id, d.data()));
            }
          }

          const result = connections.map((c: any) => {
            const profile = promoterProfiles.get(c.promoterId);
            return {
              id: c.id,
              promoterId: c.promoterId,
              promoterName:
                profile?.displayName || profile?.name || c.promoterName || 'Unknown Promoter',
              promoterEmail: profile?.email || c.promoterEmail || '',
              promoterPhone: profile?.phone || c.promoterPhone || '',
              promoterInstagram: profile?.instagram || c.promoterInstagram || '',
              status: c.status,
              createdAt: c.createdAt || null,
            };
          });

          return reply.send({ connections: result });
        }
        if (rest === 'profile' && request.method === 'PATCH')
          return reply.send(
            await updateHostProfile(ctx.partnerId, asRecord(body.patch || body.updates)),
          );

        if (rest === 'partnerships' && request.method === 'GET')
          return reply.send(await getHostPartnerships(ctx.partnerId));
        if (rest.startsWith('partnerships/') && request.method === 'PATCH') {
          return reply.send(
            await updateHostPartnership(
              ctx.partnerId,
              rest.slice('partnerships/'.length),
              String(body.action || ''),
            ),
          );
        }

        if (rest === 'notifications' && request.method === 'GET')
          return reply.send(await getHostNotifications(ctx.partnerId));
        if (rest === 'notifications/read' && request.method === 'PATCH')
          return reply.send(await markHostNotificationsRead(ctx.partnerId, body));

        if (rest === 'orders' && request.method === 'GET')
          return reply.send(await getHostOrders(ctx.partnerId, query));

        if (rest === 'finance/disputes' && request.method === 'GET')
          return reply.send(await getHostFinanceDisputes(ctx));
        if (rest === 'finance/payouts' && request.method === 'GET')
          return reply.send(await getHostFinancePayouts(ctx, query));
        if (rest === 'finance/bank-accounts' && request.method === 'GET')
          return reply.send(await getHostBankAccounts(ctx));
        if (rest === 'finance/bank-accounts' && request.method === 'POST')
          return reply.status(201).send(await createHostBankAccount(ctx.partnerId, body));
        if (rest === 'finance/bank-accounts' && request.method === 'DELETE')
          return reply.send(await deleteHostBankAccount(ctx.partnerId, query, body));
        if (rest === 'finance/overview' && request.method === 'GET')
          return reply.send(await getHostFinanceOverview(ctx));

        if (rest === 'overview/summary' && request.method === 'GET')
          return reply.send(await getHostOverviewSummary(ctx));
        if (rest === 'promoters' && request.method === 'GET')
          return reply.send(await getHostPromoters(ctx.partnerId));
        if (rest === 'analytics/time-series' && request.method === 'GET')
          return reply.send(await getHostAnalyticsTimeSeries(ctx.partnerId, query));
        if (rest === 'venue-calendar' && request.method === 'GET')
          return reply.send(await getHostVenueCalendar(ctx.partnerId, query));

        const ticketsMatch = rest.match(/^events\/([^/]+)\/tickets$/);
        if (ticketsMatch && request.method === 'GET')
          return reply.send(await getHostEventTickets(ctx.partnerId, ticketsMatch[1]));
        if (ticketsMatch && request.method === 'PATCH')
          return reply.send(await updateHostEventTickets(ctx.partnerId, ticketsMatch[1], body));

        const submitMatch = rest.match(/^events\/([^/]+)\/submit$/);
        if (submitMatch && request.method === 'POST')
          return reply.send(await submitHostEvent(request, ctx.partnerId, submitMatch[1]));

        const resubmitMatch = rest.match(/^events\/([^/]+)\/resubmit$/);
        if (resubmitMatch && request.method === 'PATCH')
          return reply.send(
            await resubmitHostEvent(request, ctx.partnerId, resubmitMatch[1], body),
          );

        const eventOverviewMatch = rest.match(/^events\/([^/]+)\/overview$/);
        if (eventOverviewMatch && request.method === 'GET')
          return reply.send(await getHostEventOverview(ctx, eventOverviewMatch[1]));

        const hostEventFinanceMatch = rest.match(/^events\/([^/]+)\/finance$/);
        if (hostEventFinanceMatch && request.method === 'GET') {
          const evtId = hostEventFinanceMatch[1];
          const event = await getHostEventAndVerify(ctx.partnerId, evtId);
          const [ordersSnap, walkInsSnap, commerce] = await Promise.all([
            fastify.db
              .collection('orders')
              .where('eventId', '==', evtId)
              .where('status', 'in', ['confirmed', 'paid'])
              .get()
              .catch(() => ({ docs: [] as any[] })),
            fastify.db
              .collection('walk_in_entries')
              .doc(evtId)
              .collection('logs')
              .get()
              .catch(() => ({ docs: [] as any[] })),
            getEventCommerceMetrics(fastify.db, evtId),
          ]);
          const orderDocs = (ordersSnap as any).docs || [];
          const walkInDocs = (walkInsSnap as any).docs || [];
          const gross = commerce.grossRevenue;
          const refundAmount = commerce.refundAmount;
          const platformFee =
            commerce.ledgerEntries
              .filter((entry) => entry.type === 'platform_fee')
              .reduce((sum, entry) => sum + Number(entry.amountPaise || 0), 0) / 100;
          const venueCommission =
            commerce.ledgerEntries
              .filter((entry) => entry.type === 'venue_share')
              .reduce((sum, entry) => sum + Number(entry.amountPaise || 0), 0) / 100;
          const venueCommissionRate = gross > 0 ? (venueCommission / gross) * 100 : 0;
          const walkInRevenue = walkInDocs.reduce(
            (s: number, d: any) => s + toNumber(d.data().amount || 0),
            0,
          );
          const net =
            commerce.ledgerEntries
              .filter(
                (entry) =>
                  entry.toPartnerId === ctx.partnerId &&
                  ['host_payout', 'refund'].includes(entry.type),
              )
              .reduce((sum, entry) => sum + Number(entry.amountPaise || 0), 0) / 100;
          const tierMap = new Map<string, { tierName: string; sold: number; revenue: number }>();
          for (const d of orderDocs) {
            const o = d.data();
            const tierId = o.tierId || 'unknown';
            const tierName = o.tierName || 'Ticket';
            if (!tierMap.has(tierId)) tierMap.set(tierId, { tierName, sold: 0, revenue: 0 });
            const entry = tierMap.get(tierId)!;
            entry.sold += toNumber(o.ticketCount || 1);
            entry.revenue += Number(commerce.orderRevenuePaise[d.id]?.netPaise || 0) / 100;
          }
          const ticketMix = Array.from(tierMap.entries()).map(([tierId, v]) => ({
            tierId,
            tierName: v.tierName,
            revenue: v.revenue,
            sold: v.sold,
          }));
          const ev = event as PlainRecord;
          return reply.send({
            gross,
            platformFee,
            venueCommission,
            venueCommissionRate,
            refundAmount,
            expenses: 0,
            net,
            walkInRevenue,
            walkInOrders: walkInDocs.length,
            onlineRevenue: commerce.netRevenue,
            onlineOrders: commerce.orderCount,
            settlementStatus: ev.settlementStatus || 'pending',
            paidAt: ev.settledAt || null,
            paymentSources: [
              { label: 'Online', amount: commerce.netRevenue, orders: commerce.orderCount },
            ],
            intakeChannels: [
              { label: 'App', amount: commerce.netRevenue, orders: commerce.orderCount },
            ],
            ticketMix,
            hostPayout: null,
            promoterPayouts: [],
            payoutSummary: null,
          });
        }

        const hostEventAttendeesMatchSingle = rest.match(/^events\/([^/]+)\/attendees\/([^/]+)$/);
        if (hostEventAttendeesMatchSingle && request.method === 'GET') {
          const [, evtId, attendeeId] = hostEventAttendeesMatchSingle;
          const event = await getHostEventAndVerify(ctx.partnerId, evtId);
          const [orderDoc, allOrdersSnap] = await Promise.all([
            fastify.db.collection('orders').doc(attendeeId).get(),
            fastify.db
              .collection('orders')
              .where('eventId', '==', evtId)
              .where('status', 'in', ['confirmed', 'paid'])
              .limit(200)
              .get()
              .catch(() => ({ docs: [] as any[] })),
          ]);
          if (!orderDoc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Attendee not found',
                requestId: request.id,
              }),
            );
          const o = orderDoc.data() as PlainRecord;
          const lifetimeSnap = await fastify.db
            .collection('orders')
            .where('buyerPhone', '==', o.buyerPhone || '')
            .where('status', 'in', ['confirmed', 'paid'])
            .limit(50)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const lifetimeDocs = (lifetimeSnap as any).docs || [];
          const orderAmounts = await getOrderCommerceAmounts(fastify.db, [
            attendeeId,
            ...lifetimeDocs.map((document: any) => document.id),
          ]);
          const lifetimeOrders = lifetimeDocs.map((d: any) => {
            const od = d.data() || {};
            return {
              id: d.id,
              orderIndex: null,
              orderNumber: d.id.slice(0, 8).toUpperCase(),
              eventId: od.eventId || evtId,
              eventName: od.eventTitle || od.eventName || 'Event',
              eventImage: od.eventImage || '',
              customerName: od.buyerName || 'Guest',
              email: od.buyerEmail || '',
              phone: od.buyerPhone || '',
              amount: Number(orderAmounts[d.id]?.netPaise || 0) / 100,
              ticketsCount: toNumber(od.ticketCount || 1),
              createdAt: od.createdAt || null,
              confirmedAt: od.confirmedAt || null,
              checkedInAt: od.checkedInAt || null,
              cancelledAt: od.cancelledAt || null,
              updatedAt: od.updatedAt || null,
              status: od.checkedInAt ? 'checked_in' : 'paid',
              source: od.source || 'ticket',
              tags: od.tags || [],
              promoterCode: od.promoterCode || null,
              note: od.note || null,
              items: [],
            };
          });
          const allOrders = (allOrdersSnap as any).docs || [];
          const buyerOrders = allOrders.filter(
            (d: any) =>
              d.data().buyerPhone === o.buyerPhone || d.data().buyerEmail === o.buyerEmail,
          );
          const attendee = {
            id: attendeeId,
            attendeeId,
            fullName: o.buyerName || 'Guest',
            email: o.buyerEmail || '',
            phone: o.buyerPhone || '',
            instagram: o.instagram || '',
            ticketTier: o.tierName || '',
            tierId: o.tierId || '',
            quantity: toNumber(o.ticketCount || 1),
            totalSpend: Number(orderAmounts[attendeeId]?.netPaise || 0) / 100,
            source: o.source || 'online',
            status: o.checkedInAt ? 'checked_in' : 'paid',
            purchasedAt: o.createdAt || null,
            checkedInAt: o.checkedInAt || null,
            city: o.city || '',
            area: o.area || '',
            isVip: !!o.isVip,
            tags: o.tags || [],
            orderId: attendeeId,
            orderSummary: `${o.ticketCount || 1} ticket(s)`,
            orderNumber: attendeeId.slice(0, 8).toUpperCase(),
            stats: {
              eventsAttended: buyerOrders.length,
              lifetimeSpend:
                lifetimeDocs.reduce(
                  (sum: number, document: any) =>
                    sum + Number(orderAmounts[document.id]?.netPaise || 0),
                  0,
                ) / 100,
            },
            joinedAt: o.createdAt || null,
          };
          const timeline: any[] = [
            {
              id: 'purchase',
              label: 'Ticket Purchased',
              timestamp: o.createdAt || null,
              kind: 'purchase',
            },
            ...(o.checkedInAt
              ? [{ id: 'checkin', label: 'Checked In', timestamp: o.checkedInAt, kind: 'checkin' }]
              : []),
          ];
          return reply.send({
            attendee,
            orders: lifetimeOrders,
            timeline,
            selectedOrderId: attendeeId,
          });
        }

        const hostEventAttendeesMatch = rest.match(/^events\/([^/]+)\/attendees$/);
        if (hostEventAttendeesMatch && request.method === 'GET') {
          const evtId = hostEventAttendeesMatch[1];
          const event = await getHostEventAndVerify(ctx.partnerId, evtId);
          const ev = event as PlainRecord;
          const page = parseInt(String(query.page || '1'), 10) || 1;
          const limit = Math.min(parseInt(String(query.limit || '50'), 10) || 50, 100);

          let qOrders: any = fastify.db
            .collection('orders')
            .where('eventId', '==', evtId)
            .where('status', 'in', ['confirmed', 'paid']);
          if (query.tierId) qOrders = qOrders.where('tierId', '==', query.tierId);

          let qRsvps: any = fastify.db
            .collection('rsvp_orders')
            .where('eventId', '==', evtId)
            .where('status', '==', 'confirmed');

          const [ordersSnap, rsvpsSnap, entitlementsSnap] = await Promise.all([
            qOrders
              .limit(500)
              .get()
              .catch(() => ({ docs: [] })),
            qRsvps
              .limit(500)
              .get()
              .catch(() => ({ docs: [] })),
            fastify.db
              .collection('entitlements')
              .where('eventId', '==', evtId)
              .get()
              .catch(() => ({ docs: [] })),
          ]);

          const orderCheckedInTimes = new Map<string, string>();
          entitlementsSnap.docs.forEach((doc: any) => {
            const data = doc.data();
            if (
              data.orderId &&
              (data.state === 'CONSUMED' || (data.scanCountUsed && data.scanCountUsed > 0))
            ) {
              if (data.consumedAt) {
                orderCheckedInTimes.set(data.orderId, data.consumedAt);
              } else {
                orderCheckedInTimes.set(data.orderId, new Date().toISOString());
              }
            }
          });

          let orderDocs = [
            ...ordersSnap.docs.map((d: any) => ({ doc: d, isRSVP: false })),
            ...rsvpsSnap.docs.map((d: any) => ({ doc: d, isRSVP: true })),
          ];
          const orderAmounts = await getOrderCommerceAmounts(
            fastify.db,
            orderDocs.filter((item: any) => !item.isRSVP).map((item: any) => item.doc.id),
          );

          let attendeesList = orderDocs.map((item: any) => {
            const doc = item.doc;
            const o = doc.data() || {};
            const isRSVP = item.isRSVP;
            const rawName = o.buyerName || o.customerName || o.name || 'Guest';
            const checkedInAt = o.checkedInAt || orderCheckedInTimes.get(doc.id) || null;
            const source = isRSVP ? 'online' : o.source || 'online';

            return {
              id: doc.id,
              attendeeId: doc.id,
              fullName: rawName,
              email: o.buyerEmail || o.email || '',
              phone: o.buyerPhone || o.phone || '',
              instagram: o.instagram || '',
              ticketTier: o.tierName || (isRSVP ? 'RSVP' : ''),
              tierId: o.tierId || '',
              quantity: toNumber(o.ticketCount || o.quantity || 1),
              totalSpend: isRSVP ? 0 : Number(orderAmounts[doc.id]?.netPaise || 0) / 100,
              source,
              status: checkedInAt ? 'checked_in' : 'paid',
              purchasedAt: o.createdAt || null,
              checkedInAt,
              city: o.city || '',
              area: o.area || '',
              isVip: !!o.isVip,
              tags: o.tags || [],
              orderId: doc.id,
              orderSummary: `${o.ticketCount || o.quantity || 1} ticket(s)`,
            };
          });

          // Apply filters
          if (query.source && query.source !== 'all') {
            if (query.source === 'walkin') {
              attendeesList = attendeesList.filter(
                (a: any) => a.source === 'door' || a.source === 'manual',
              );
            } else {
              attendeesList = attendeesList.filter((a: any) => a.source === query.source);
            }
          }
          if (query.status && query.status !== 'all') {
            if (query.status === 'checked_in') {
              attendeesList = attendeesList.filter((a: any) => !!a.checkedInAt);
            } else if (query.status === 'not_arrived') {
              attendeesList = attendeesList.filter((a: any) => !a.checkedInAt);
            }
          }
          if (query.q) {
            const term = String(query.q).toLowerCase();
            attendeesList = attendeesList.filter(
              (a: any) =>
                (a.fullName || '').toLowerCase().includes(term) ||
                (a.phone || '').includes(term) ||
                (a.email || '').toLowerCase().includes(term),
            );
          }

          // Sort by purchasedAt descending
          attendeesList.sort((a: any, b: any) => {
            const ad = a.purchasedAt ? new Date(a.purchasedAt).getTime() : 0;
            const bd = b.purchasedAt ? new Date(b.purchasedAt).getTime() : 0;
            return bd - ad;
          });

          const total = attendeesList.length;
          const totalPages = Math.ceil(total / limit);
          const attendees = attendeesList.slice((page - 1) * limit, page * limit);
          const rawTiers = asArray(ev.ticketTiers || ev.tiers || []);
          const tierOptions = rawTiers.map((t: any, i: number) => ({
            id: t.id || String(i),
            name: t.name || 'Ticket',
          }));
          return reply.send({
            attendees,
            pagination: { page, limit, total, totalPages },
            filters: {
              tierOptions,
              sourceOptions: ['online', 'door', 'promoter'],
              statusOptions: ['checked_in', 'not_arrived'],
            },
          });
        }

        const hostEventPromotersMatch = rest.match(/^events\/([^/]+)\/promoters$/);
        if (hostEventPromotersMatch && request.method === 'GET') {
          const evtId = hostEventPromotersMatch[1];
          await getHostEventAndVerify(ctx.partnerId, evtId);
          const [assignmentsSnap, settingsDoc, connectionsSnap, commerce] = await Promise.all([
            fastify.db
              .collection('promoter_assignments')
              .where('eventId', '==', evtId)
              .get()
              .catch(() => ({ docs: [] as any[] })),
            fastify.db
              .collection('event_promoter_settings')
              .doc(evtId)
              .get()
              .catch(() => null),
            fastify.db
              .collection('promoter_connections')
              .where('hostId', '==', ctx.partnerId)
              .where('status', 'in', ['approved', 'active'])
              .get()
              .catch(() => ({ docs: [] as any[] })),
            getEventCommerceMetrics(fastify.db, evtId),
          ]);
          const settingsData =
            settingsDoc && (settingsDoc as any).exists ? (settingsDoc as any).data() || {} : {};
          const promoterSettings = {
            mode: settingsData.mode || 'all',
            commissionRate: settingsData.commissionRate || 10,
            ...settingsData,
          };
          const assignedPromoters = ((assignmentsSnap as any).docs || []).map((doc: any) => {
            const data = doc.data() || {};
            const promoterId = data.promoterId || '';
            const promoterTickets = commerce.soldTickets.filter(
              (ticket) => ticket.promoterId === promoterId,
            );
            const attributedOrderIds = new Set(
              promoterTickets.map((ticket) => ticket.orderId).filter(Boolean),
            );
            return {
              assignmentId: doc.id,
              ...data,
              id: doc.id,
              promoterId,
              ticketsSold: promoterTickets.length,
              sales: promoterTickets.length,
              revenue: [...attributedOrderIds].reduce(
                (sum, orderId) =>
                  sum + Number(commerce.orderRevenuePaise[orderId]?.netPaise || 0) / 100,
                0,
              ),
              commissionPaise: commerce.ledgerEntries
                .filter(
                  (entry) =>
                    entry.type === 'promoter_commission' && entry.toPartnerId === promoterId,
                )
                .reduce((sum, entry) => sum + Number(entry.amountPaise || 0), 0),
            };
          });
          const assignedIds = new Set(
            assignedPromoters.map((p: any) => p.promoterId).filter(Boolean),
          );
          const unassignedPromoters = ((connectionsSnap as any).docs || [])
            .map((doc: any) => {
              const conn = doc.data() || {};
              const promoterId = conn.promoterId;
              if (!promoterId || assignedIds.has(promoterId)) return null;
              return {
                assignmentId: null,
                id: promoterId,
                promoterId,
                promoterName: conn.promoterName || 'Promoter',
                avatar: conn.promoterAvatar || conn.avatarUrl || null,
                status: 'disabled',
                isActive: false,
                shortCode: null,
                sales: 0,
                revenue: 0,
                clicks: 0,
                commissionRate: promoterSettings.commissionRate || 10,
              };
            })
            .filter(Boolean);
          const promoters = [...assignedPromoters, ...unassignedPromoters];
          const totalPromoters = promoters.length;
          const activePromoters = promoters.filter(
            (p: any) => p.isActive !== false && p.status === 'active',
          ).length;
          const disabledPromoters = totalPromoters - activePromoters;
          const ticketsSold = promoters.reduce(
            (s: number, p: any) => s + toNumber(p.ticketsSold || 0),
            0,
          );
          const revenue = promoters.reduce((s: number, p: any) => s + toNumber(p.revenue || 0), 0);
          const clicks = promoters.reduce((s: number, p: any) => s + toNumber(p.clicks || 0), 0);
          return reply.send({
            promoters,
            promoterSettings,
            summary: {
              totalPromoters,
              selectedPromoters: activePromoters,
              activePromoters,
              disabledPromoters,
              ticketsSold,
              revenue,
              clicks,
            },
          });
        }

        if (hostEventPromotersMatch && request.method === 'PATCH') {
          const evtId = hostEventPromotersMatch[1];
          await getHostEventAndVerify(ctx.partnerId, evtId);

          await fastify.db
            .collection('event_promoter_settings')
            .doc(evtId)
            .set(
              {
                ...body,
                eventId: evtId,
                hostId: ctx.partnerId,
                updatedAt: new Date().toISOString(),
              },
              { merge: true },
            );

          await updateEventPromoterCompensation(fastify.db, evtId, body);

          // Assignment terms authorize checkout commission, so this work is
          // part of the command's success boundary and must be awaited.
          await (async () => {
            try {
              const eventDoc = await fastify.db
                .collection('events')
                .doc(evtId)
                .get()
                .catch(() => null);
              const eventData = (eventDoc?.exists ? (eventDoc.data() as any) : {}) ?? {};

              // If event is a draft, do not assign or notify promoters
              if (eventData.lifecycle === 'draft' || eventData.status === 'draft') {
                return;
              }

              const eventName: string = eventData.title ?? 'Untitled Event';
              const venueName: string = eventData.venueName ?? '';
              // Resolve rates per-promoter from the canonical promoterCompensation
              // object (standard flat rate, custom per-tier map, or salary's 0),
              // falling back to the old flat field only for pre-migration docs.
              const pc = eventData.promoterCompensation
                ? normalizeCompensationForRead(eventData.promoterCompensation)
                : null;
              const fallbackRate: number =
                body?.defaultCommission ?? eventData.promoterSettings?.commissionRate ?? 10;
              const now = new Date().toISOString();

              const nextIds: string[] = Array.isArray(body?.allowedPromoterIds)
                ? body.allowedPromoterIds
                : [];
              const isEnabled: boolean = body?.enabled !== false;

              // Query promoter_assignments for active assignments to find the previous state
              const activeAssignmentsSnap = await fastify.db
                .collection('promoter_assignments')
                .where('eventId', '==', evtId)
                .where('status', '==', 'active')
                .get()
                .catch(() => null);
              const prevIds: string[] =
                activeAssignmentsSnap?.docs.map((d: any) => d.data().promoterId) ?? [];

              const newlyAdded = nextIds.filter((id: string) => !prevIds.includes(id));
              const removed = prevIds.filter((id: string) => !nextIds.includes(id));

              // Encrypt event data to be stored securely
              const encryptedEventName = encrypt(eventName);
              const encryptedVenueName = encrypt(venueName);

              // Create assignment docs for newly added promoters
              await Promise.all(
                newlyAdded.map(async (promoterId: string) => {
                  const effective = pc
                    ? resolveEffectiveCommission(pc, promoterId)
                    : { rate: fallbackRate, type: 'percentage' as const, tierCommissions: null };
                  const trackingCode = await ensurePromoterLink(
                    fastify.db,
                    promoterId,
                    evtId,
                    eventName,
                    effective.rate,
                    effective.type,
                    effective.tierCommissions,
                  );
                  const assignId = `${promoterId}_${evtId}`;
                  await fastify.db
                    .collection('promoter_assignments')
                    .doc(assignId)
                    .set(
                      {
                        id: assignId,
                        promoterId,
                        eventId: evtId,
                        eventName: encryptedEventName,
                        venueName: encryptedVenueName,
                        status: 'active',
                        commissionRate: effective.rate,
                        commissionType: effective.type,
                        tierCommissions: effective.tierCommissions,
                        assignmentVersion: 2,
                        termsVersion: 2,
                        approvedByPartnerId: ctx.partnerId,
                        approvedByPartnerType: 'host',
                        linkCode: trackingCode || null,
                        totalSales: 0,
                        totalRevenue: 0,
                        totalCommission: 0,
                        guestlistAllowance: 0,
                        guestlistUsed: 0,
                        guests: [],
                        assignedAt: now,
                        createdAt: now,
                        updatedAt: now,
                      },
                      { merge: true },
                    );
                }),
              );

              // Mark removed promoters as inactive
              await Promise.all(
                removed.map(async (promoterId: string) => {
                  const assignId = `${promoterId}_${evtId}`;
                  await fastify.db
                    .collection('promoter_assignments')
                    .doc(assignId)
                    .set({ status: 'inactive', updatedAt: now }, { merge: true });
                }),
              );

              // If all disabled, mark all as inactive
              if (!isEnabled && nextIds.length === 0 && prevIds.length > 0) {
                await Promise.all(
                  prevIds.map(async (promoterId: string) => {
                    const assignId = `${promoterId}_${evtId}`;
                    await fastify.db
                      .collection('promoter_assignments')
                      .doc(assignId)
                      .set({ status: 'inactive', updatedAt: now }, { merge: true });
                  }),
                );
              }

              // Send notifications to newly added promoters
              if (newlyAdded.length > 0) {
                // Encrypt notification title and message
                const rawTitle = "You've been added to an event!";
                const rawMessage = `${eventName} is live — start sharing your link`;
                const encryptedTitle = encrypt(rawTitle);
                const encryptedMessage = encrypt(rawMessage);

                await Promise.all([
                  ...newlyAdded.map((promoterId: string) =>
                    fastify.db.collection('notifications').add({
                      recipientId: promoterId,
                      recipientType: 'promoter',
                      type: 'promoter_assignment',
                      title: encryptedTitle,
                      message: encryptedMessage,
                      read: false,
                      createdAt: now,
                      data: {
                        eventId: evtId,
                        type: 'promoter_assignment',
                      },
                    }),
                  ),
                  sendPushToUsers(fastify.db, newlyAdded, rawTitle, rawMessage, {
                    eventId: evtId,
                    type: 'promoter_assignment',
                  }),
                ]);
              }
            } catch (err: any) {
              fastify.log.error(`[Promoter] Assignment sync error: ${err.message}`);
              throw err;
            }
          })();

          return reply.send({ success: true });
        }

        const checkInMatch = rest.match(/^events\/([^/]+)\/check-in$/);
        if (checkInMatch && request.method === 'POST')
          return reply.send(await processGuestCheckIn(ctx, checkInMatch[1], body));

        const guestlistMatch = rest.match(/^events\/([^/]+)\/guestlist$/);
        if (guestlistMatch && request.method === 'GET') {
          const limit = parseInt(String(query.limit || '100'));
          const snap = await fastify.db
            .collection('orders')
            .where('eventId', '==', guestlistMatch[1])
            .where('status', 'in', ['confirmed', 'checked_in'])
            .limit(limit)
            .get();
          const guests = snap.docs.map((d) => {
            const d2 = d.data() as any;
            return {
              id: d.id,
              ...d2,
              checkedIn: d2.status === 'checked_in' || !!d2.checkedInAt,
            };
          });
          return reply.send({
            guests,
            totalCount: guests.length,
            enteredCount: guests.filter((g: any) => g.checkedIn).length,
            pendingCount: guests.filter((g: any) => !g.checkedIn).length,
          });
        }

        if (rest === 'ops/tonight' && request.method === 'GET') {
          const today = new Date().toISOString().slice(0, 10);
          const snap = await fastify.db
            .collection('events')
            .where('creatorId', '==', ctx.partnerId)
            .where('startDate', '==', today)
            .limit(10)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const events = ((snap as any).docs || []).map((doc: any) => ({
            id: doc.id,
            ...(doc.data() || {}),
          }));
          if (!events.length) return reply.send({ hasEvent: false, event: null, ops: null });
          const event = events[0];
          const [commerce, checkinsSnap] = await Promise.all([
            getEventCommerceMetrics(fastify.db, event.id),
            fastify.db
              .collection('check_ins')
              .where('eventId', '==', event.id)
              .get()
              .catch(() => ({ docs: [] as any[], size: 0 })),
          ]);
          return reply.send({
            hasEvent: true,
            event: {
              id: event.id,
              title: event.title || event.name,
              startDate: event.startDate,
              startTime: event.startTime,
              venueName: event.venueName,
            },
            ops: {
              revenue: commerce.netRevenue,
              checkedIn: (checkinsSnap as any).size || 0,
              ticketsSold: commerce.ticketsSold,
              entryRate:
                commerce.ticketsSold > 0
                  ? Math.round((((checkinsSnap as any).size || 0) / commerce.ticketsSold) * 100)
                  : 0,
            },
          });
        }

        if (rest === 'promoter-requests' && request.method === 'GET') {
          const snap = await fastify.db
            .collection('promoter_connections')
            .where('hostId', '==', ctx.partnerId)
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const requests = ((snap as any).docs || []).map((doc: any) => ({
            id: doc.id,
            ...(doc.data() || {}),
          }));
          return reply.send({ requests, total: requests.length });
        }

        if (rest === 'partnerships/request' && request.method === 'POST') {
          const venueId = String(body.venueId || '');
          if (!venueId)
            return reply.status(400).send(
              buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'venueId required',
                requestId: request.id,
              }),
            );
          const existing = await fastify.db
            .collection('partnerships')
            .where('hostId', '==', ctx.partnerId)
            .where('venueId', '==', venueId)
            .where('status', 'in', ['pending', 'active'])
            .limit(1)
            .get()
            .catch(() => ({ empty: true }));
          if (!(existing as any).empty) {
            const doc = (existing as any).docs[0];
            return reply
              .status(200)
              .send({ success: true, partnershipId: doc.id, alreadyExists: true });
          }
          const now = new Date().toISOString();
          const ref = await fastify.db.collection('partnerships').add({
            hostId: ctx.partnerId,
            venueId,
            status: 'pending',
            message: String(body.message || ''),
            createdAt: now,
            updatedAt: now,
          });
          return reply.status(201).send({ success: true, partnershipId: ref.id });
        }

        if (rest === 'team' && request.method === 'POST') {
          const { email, phone, firstName, lastName, role, granularPermissions, partnerName } =
            body;
          if (!email && !phone)
            return reply.status(400).send(
              buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'email or phone required',
                requestId: request.id,
              }),
            );
          const now = new Date().toISOString();
          const tempPassword = generateTemporaryPassword();
          const inviteToken = randomUUID();
          const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

          const ref = await fastify.db.collection('host_team_invitations').add({
            hostId: ctx.partnerId,
            email: email || null,
            phone: phone || null,
            firstName: firstName || null,
            lastName: lastName || null,
            role: role || 'member',
            granularPermissions: granularPermissions || {},
            partnerName: partnerName || null,
            status: 'pending',
            tempPassword: encrypt(tempPassword),
            inviteToken,
            inviteExpires,
            createdAt: now,
          });

          // Dispatch invitation email if email is provided
          if (email) {
            let origin = 'http://localhost:3001';
            if (request.headers.referer) {
              try {
                origin = new URL(request.headers.referer).origin;
              } catch {
                if (request.headers.origin) origin = request.headers.origin;
              }
            } else if (request.headers.origin) {
              origin = request.headers.origin;
            }

            const acceptLink = `${origin}/auth/staff-invite?code=${inviteToken}&host=${ctx.partnerId}`;
            const pName = partnerName || ctx.displayName || 'Host Partner';
            const roleLabels: Record<string, string> = {
              COHOST: 'Co-Host',
              MANAGER: 'Manager',
              STAFF: 'Staff',
            };
            const roleLabel = roleLabels[role] || role || 'Member';

            await sendHostInvitationEmail({
              recipient: email.toLowerCase().trim(),
              name: firstName && lastName ? `${firstName} ${lastName}` : 'Team Member',
              roleLabel,
              partnerName: pName,
              tempPassword,
              acceptLink,
            }).catch((err: any) => {
              fastify.log.error({ err }, 'Failed to send host invitation email');
            });
          }

          return reply.status(201).send({ success: true, invitationId: ref.id });
        }

        if (rest === 'invite' && request.method === 'POST') {
          const email = String(body.email || '')
            .toLowerCase()
            .trim();
          const role = String(body.role || 'PROMOTER');
          if (!email)
            return reply.status(400).send(
              buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'email required',
                requestId: request.id,
              }),
            );
          const now = new Date().toISOString();
          const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          const ref = await fastify.db.collection('host_invitations').add({
            hostId: ctx.partnerId,
            email,
            role,
            status: 'pending',
            expiresAt: expires,
            createdAt: now,
          });
          return reply.status(201).send({ success: true, invitationId: ref.id, email, role });
        }

        if (rest === 'broadcast' && request.method === 'POST') {
          const message = String(body.message || '').trim();
          const title = String(body.title || 'Update from your host').trim();
          if (!message)
            return reply.status(400).send(
              buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'message required',
                requestId: request.id,
              }),
            );
          const followersSnap = await fastify.db
            .collection('follows')
            .where('hostId', '==', ctx.partnerId)
            .limit(500)
            .get()
            .catch(() => ({ docs: [] as any[] }));
          const batch = fastify.db.batch();
          const now = new Date().toISOString();
          let count = 0;
          for (const doc of (followersSnap as any).docs || []) {
            const followData = doc.data() || {};
            const ref = fastify.db.collection('notifications').doc();
            batch.set(ref, {
              recipientId: followData.userId || followData.guestId,
              type: 'host_broadcast',
              title,
              message,
              hostId: ctx.partnerId,
              read: false,
              createdAt: now,
            });
            count++;
          }
          if (count > 0) await batch.commit();
          return reply.send({ success: true, recipientCount: count });
        }

        if (rest === 'audience' && request.method === 'GET') {
          const limit = Math.min(toNumber(query.limit) || 50, 100);
          const filterVip = query.vip === 'true';
          const filterSource = String(query.source || '');

          // Pull all paid orders for this host to build a guest profile per buyer
          const [ordersSnap, vipSnap] = await Promise.all([
            fastify.db
              .collection('orders')
              .where('hostId', '==', ctx.partnerId)
              .where('status', 'in', ['confirmed', 'paid'])
              .limit(500)
              .get()
              .catch(() => ({ docs: [] as any[] })),
            fastify.db
              .collection('host_vip_guests')
              .where('hostId', '==', ctx.partnerId)
              .get()
              .catch(() => ({ docs: [] as any[] })),
          ]);

          const vipSet = new Set<string>(
            ((vipSnap as any).docs || []).map((d: any) => String(d.data()?.guestId || d.id)),
          );

          // Group orders by buyer key (phone > email > uid)
          const guestMap = new Map<string, { orders: any[]; eventIds: Set<string> }>();
          for (const doc of (ordersSnap as any).docs || []) {
            const o = doc.data() || {};
            const key = String(o.buyerPhone || o.buyerEmail || o.buyerId || o.userId || doc.id);
            if (!key) continue;
            if (!guestMap.has(key)) guestMap.set(key, { orders: [], eventIds: new Set() });
            const entry = guestMap.get(key)!;
            entry.orders.push({ ...o, _docId: doc.id });
            if (o.eventId) entry.eventIds.add(o.eventId);
          }

          // Build guest profiles
          let guests: any[] = [];
          for (const [guestId, { orders: gOrders, eventIds }] of guestMap) {
            const latest = gOrders.reduce((a: any, b: any) =>
              new Date(a.createdAt || 0) > new Date(b.createdAt || 0) ? a : b,
            );
            const rawName: string = latest.buyerName || latest.customerName || '';
            const maskedName =
              rawName.length > 2
                ? rawName.slice(0, 2) + '*'.repeat(Math.max(2, rawName.length - 2))
                : rawName || 'Guest';
            const source: string = latest.source || (latest.isComp ? 'comp' : 'ticket');
            const isVip = vipSet.has(guestId);
            if (filterVip && !isVip) continue;
            if (filterSource && source !== filterSource) continue;
            guests.push({
              guestId,
              maskedName,
              eventsAttended: eventIds.size,
              lastEventNames: gOrders
                .map((o: any) => o.eventTitle || o.eventName || '')
                .filter(Boolean)
                .slice(0, 3),
              lastSeen: latest.createdAt || null,
              source,
              isVip,
              city: latest.city || latest.buyerCity || null,
              isRepeat: eventIds.size > 1,
            });
          }

          // Sort by lastSeen desc
          guests.sort(
            (a, b) => new Date(b.lastSeen || 0).getTime() - new Date(a.lastSeen || 0).getTime(),
          );

          const cursor = toNumber(query.cursor) || 0;
          const page = guests.slice(cursor, cursor + limit);
          const hasMore = guests.length > cursor + limit;
          return reply.send({
            guests: page,
            total: guests.length,
            hasMore,
            nextCursor: hasMore ? String(cursor + limit) : null,
          });
        }

        if (rest === 'audience' && request.method === 'PATCH') {
          const guestId = String(body.guestId || '');
          const isVip = body.isVip === true;
          if (!guestId)
            return reply.status(400).send(
              buildErrorResponse({
                code: 'BAD_REQUEST',
                message: 'guestId required',
                requestId: request.id,
              }),
            );
          const docId = `${ctx.partnerId}_${guestId}`;
          if (isVip) {
            await fastify.db.collection('host_vip_guests').doc(docId).set(
              {
                hostId: ctx.partnerId,
                guestId,
                isVip: true,
                updatedAt: new Date().toISOString(),
              },
              { merge: true },
            );
          } else {
            await fastify.db
              .collection('host_vip_guests')
              .doc(docId)
              .delete()
              .catch(() => {});
          }
          return reply.send({ success: true, guestId, isVip });
        }

        if (rest === 'settings' && request.method === 'PATCH') {
          const patch = asRecord(body.patch || body);
          const allowedFields = [
            'orgName',
            'supportEmail',
            'legalPhone',
            'website',
            'logoUrl',
            'defaultTimezone',
            'defaultCurrency',
            'notificationPreferences',
            'displayName',
            'bio',
            'contactEmail',
            'contactPhone',
            'socialLinks',
            'bookingPolicy',
            'coverCharge',
            'dressCode',
            'ageRestriction',
            'instagramHandle',
            'youtubeHandle',
            'spotifyHandle',
            'isPublic',
            'allowDirectBooking',
          ];
          const safe: PlainRecord = {};
          for (const key of allowedFields) if (patch[key] !== undefined) safe[key] = patch[key];
          safe.updatedAt = new Date().toISOString();
          await fastify.db.collection('hosts').doc(ctx.partnerId).set(safe, { merge: true });
          const doc = await fastify.db.collection('hosts').doc(ctx.partnerId).get();
          const data = doc.exists ? doc.data() || {} : {};
          const settings = {
            hostId: ctx.partnerId,
            orgName: data.orgName || data.displayName || data.name || '',
            supportEmail: data.supportEmail || data.contactEmail || data.email || '',
            legalPhone: data.legalPhone || data.contactPhone || data.phone || '',
            website: data.website || '',
            logoUrl: data.profileImage || data.photoURL || null,
            defaultTimezone: data.defaultTimezone || 'Asia/Kolkata',
            defaultCurrency: data.defaultCurrency || 'INR',
            notificationPreferences: data.notificationPreferences || {},
          };
          return reply.send({ success: true, settings });
        }

        if (rest === 'settings' && request.method === 'POST') {
          const action = String(body.action || '');
          if (action === 'WRITE_SESSION') {
            const sessionData = asRecord(body.sessionData || {});
            const sessionId = String(sessionData.sessionId || body.sessionId || '');
            if (sessionId) {
              await fastify.db
                .collection('host_sessions')
                .doc(`${ctx.uid}_${sessionId}`)
                .set(
                  {
                    uid: ctx.uid,
                    hostId: ctx.partnerId,
                    sessionId,
                    userAgent: String(sessionData.userAgent || ''),
                    deviceType: String(sessionData.deviceType || 'desktop'),
                    lastActiveAt: String(sessionData.lastActiveAt || new Date().toISOString()),
                    createdAt: new Date().toISOString(),
                  },
                  { merge: true },
                );
            }
            return reply.send({ success: true });
          }
          if (action === 'REVOKE_SESSION') {
            const sessionId = String(body.sessionId || '');
            if (sessionId) {
              await fastify.db
                .collection('host_sessions')
                .doc(`${ctx.uid}_${sessionId}`)
                .delete()
                .catch(() => {});
            }
            return reply.send({ success: true });
          }
          return reply.status(400).send(
            buildErrorResponse({
              code: 'BAD_REQUEST',
              message: 'Unknown settings action',
              requestId: request.id,
            }),
          );
        }

        if (rest === 'settings/session/revoke' && request.method === 'POST') {
          try {
            await fastify.auth.revokeRefreshTokens(ctx.uid);
          } catch {
            fastify.log.warn(
              `[partners/hosts] revokeRefreshTokens not available for uid=${ctx.uid}`,
            );
          }
          await fastify.db
            .collection('host_sessions')
            .where('uid', '==', ctx.uid)
            .limit(50)
            .get()
            .then((snap: any) => {
              if (snap.empty) return;
              const batch = fastify.db.batch();
              snap.docs.forEach((d: any) => batch.delete(d.ref));
              return batch.commit();
            })
            .catch(() => {});
          return reply.send({ success: true });
        }

        if (rest === 'page' && request.method === 'GET') {
          const doc = await fastify.db
            .collection('host_pages')
            .doc(ctx.partnerId)
            .get()
            .catch(() => null);
          if (!doc || !doc.exists)
            return reply.send({
              hostId: ctx.partnerId,
              sections: [],
              isActive: false,
              theme: { primary: '#F44A22' },
            });
          return reply.send({ id: doc.id, ...(doc.data() || {}) });
        }

        if (rest === 'page' && (request.method === 'POST' || request.method === 'PATCH')) {
          const now = new Date().toISOString();
          await fastify.db
            .collection('host_pages')
            .doc(ctx.partnerId)
            .set({ ...body, hostId: ctx.partnerId, updatedAt: now }, { merge: true });
          return reply.send({ success: true });
        }

        const orderActionMatch = rest.match(/^orders\/([^/]+)\/(cancel|resend-receipt)$/);
        if (orderActionMatch && request.method === 'POST') {
          const [, orderId, action] = orderActionMatch;
          const ref = fastify.db.collection('orders').doc(orderId);
          const doc = await ref.get();
          if (!doc.exists)
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Order not found',
                requestId: request.id,
              }),
            );
          const order = doc.data() as PlainRecord;
          if (order.hostId && order.hostId !== ctx.partnerId)
            return reply.status(403).send(
              buildErrorResponse({
                code: 'FORBIDDEN',
                message: 'Order not accessible',
                requestId: request.id,
              }),
            );
          if (action === 'cancel') {
            return reply.status(503).send(
              buildErrorResponse({
                code: 'PARTNER_ORDER_CANCELLATION_NOT_LAUNCH_ENABLED',
                message:
                  'Partner-initiated cancellation is unavailable until canonical refund orchestration is enabled',
                requestId: request.id,
              }),
            );
          }
          return reply.send({ success: true });
        }

        if (rest === 'analytics/overview' && request.method === 'GET') {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const [eventsSnap, commerceRows, checkinsSnap] = await Promise.all([
            fastify.db
              .collection('events')
              .where('creatorId', '==', ctx.partnerId)
              .get()
              .catch(() => ({ docs: [] as any[], size: 0 })),
            getPartnerCommerceRows(fastify.db, ctx.partnerId, 'hostId'),
            fastify.db
              .collection('check_ins')
              .where('hostId', '==', ctx.partnerId)
              .where('checkedInAt', '>=', thirtyDaysAgo)
              .get()
              .catch(() => ({ size: 0 })),
          ]);
          const totalRevenuePaise = commerceRows.ledger
            .filter((row) => !row.createdAtIso || row.createdAtIso >= thirtyDaysAgo)
            .reduce((sum, row) => sum + Number(row.amountPaise || 0), 0);
          const totalTickets = commerceRows.tickets.filter(
            (ticket) => !ticket.createdAtIso || ticket.createdAtIso >= thirtyDaysAgo,
          ).length;
          const eventCount = (eventsSnap as any).size || ((eventsSnap as any).docs || []).length;
          return reply.send({
            period: '30d',
            events: { total: eventCount },
            revenue: { totalPaise: totalRevenuePaise, total: totalRevenuePaise / 100 },
            tickets: { sold: totalTickets },
            attendance: { checkedIn: (checkinsSnap as any).size || 0 },
          });
        }

        return reply.status(404).send(
          buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Partner host endpoint not found',
            requestId: request.id,
          }),
        );
      } catch (err: any) {
        if (err.statusCode) {
          return reply.status(err.statusCode).send(
            buildErrorResponse({
              code: err.code || 'FORBIDDEN',
              message: err.message,
              requestId: request.id,
            }),
          );
        }
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: request.id,
          }),
        );
      }
    },
  });
}
