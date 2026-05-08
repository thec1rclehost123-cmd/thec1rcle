import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { getPromoterStats, listConnections, manageConnection } from '@c1rcle/core/promoter-engine';
import { z } from 'zod';
import { resolvePartnerContext, requireType } from '../../../lib/partner-context.js';
import { FinanceService } from '../../../services/unified/finance-service.js';
import { PromoterService } from '../../../services/unified/promoter-service.js';
import { buildErrorResponse } from '../../../lib/api-contracts.js';
import { buildPayoutAccountRecord, normalizePromoterCommissionRate } from '../../../lib/partner-hardening.js';

const AnalyticsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  linkId: z.string().optional(),
  range: z.string().optional(),
  eventId: z.string().optional(),
}).passthrough();

const LinksQuerySchema = z.object({
  eventId: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
}).passthrough();

const CreateLinkSchema = z.object({
  eventId: z.string().optional(),
  commissionRate: z.coerce.number().min(0).max(10000).optional(),
}).passthrough();

const UpdateLinkSchema = z.object({
  active: z.boolean().optional(),
  action: z.string().optional(),
  editableSlug: z.string().optional(),
}).passthrough();

const EventsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.string().optional(),
  city: z.string().optional(),
}).passthrough();

const ConnectionsQuerySchema = z.object({
  status: z.string().optional(),
}).passthrough();

const ConnectionRequestSchema = z.object({
  targetPartnerId: z.string().optional(),
  targetId: z.string().optional(),
  targetType: z.string().optional(),
  targetName: z.string().optional(),
  message: z.string().optional(),
  eventId: z.string().optional(),
}).passthrough();

const ConnectionRespondSchema = z.object({
  action: z.string().optional(),
  reason: z.string().optional(),
}).passthrough();

const TrackClickSchema = z.object({
  code: z.string(),
});

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

function toIso(value: any): string | null {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return null;
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

function normalizePromoterLink(legacyLink: PlainRecord = {}, unifiedLink: PlainRecord = {}, rawLink: PlainRecord = {}) {
  const id = String(legacyLink.id || unifiedLink.linkId || rawLink.id || '');
  const inferredStatus = String(legacyLink.status || rawLink.status || '').toLowerCase();
  const active = unifiedLink.active
    ?? legacyLink.isActive
    ?? rawLink.active
    ?? rawLink.isActive
    ?? !['deactivated', 'inactive', 'revoked'].includes(inferredStatus);
  const clicks = toNumber(unifiedLink.clickCount ?? legacyLink.clickCount ?? legacyLink.clicks ?? rawLink.clickCount ?? rawLink.clicks);
  const conversions = toNumber(unifiedLink.conversionCount ?? legacyLink.conversionCount ?? legacyLink.conversions ?? rawLink.conversionCount ?? rawLink.conversions);

  return {
    ...legacyLink,
    ...unifiedLink,
    id,
    linkId: id,
    promoterId: unifiedLink.promoterId ?? rawLink.promoterId ?? null,
    eventId: legacyLink.eventId ?? unifiedLink.eventId ?? rawLink.eventId ?? '',
    eventTitle: legacyLink.eventTitle ?? unifiedLink.eventTitle ?? rawLink.eventTitle ?? null,
    code: legacyLink.code ?? unifiedLink.code ?? rawLink.code ?? '',
    active: Boolean(active),
    isActive: legacyLink.isActive ?? Boolean(active),
    clickCount: clicks,
    clicks,
    conversionCount: conversions,
    conversions,
    commissionRate: toNumber(legacyLink.commissionRate ?? unifiedLink.commissionRate ?? rawLink.commissionRate),
    revenue: toNumber(legacyLink.revenue ?? unifiedLink.revenue ?? rawLink.revenue),
    commission: toNumber(legacyLink.commission ?? rawLink.commission),
    clearedCommission: toNumber(legacyLink.clearedCommission ?? legacyLink.commission ?? rawLink.commission),
    createdAt: unifiedLink.createdAt ?? toIso(rawLink.createdAt),
    updatedAt: unifiedLink.updatedAt ?? toIso(rawLink.updatedAt),
    status: legacyLink.status ?? rawLink.status ?? (active ? 'active' : 'deactivated'),
  };
}

function normalizePromoterConnection(legacyConnection: PlainRecord = {}, unifiedConnection: PlainRecord = {}, rawConnection: PlainRecord = {}) {
  const id = String(legacyConnection.id || unifiedConnection.connectionId || rawConnection.id || '');

  return {
    ...legacyConnection,
    ...unifiedConnection,
    id,
    connectionId: id,
    promoterId: legacyConnection.promoterId ?? rawConnection.promoterId ?? unifiedConnection.fromPartnerId ?? null,
    fromPartnerId: unifiedConnection.fromPartnerId ?? rawConnection.fromPartnerId ?? legacyConnection.promoterId ?? null,
    toPartnerId: unifiedConnection.toPartnerId ?? rawConnection.toPartnerId ?? legacyConnection.targetId ?? legacyConnection.otherId ?? null,
    targetId: legacyConnection.targetId ?? rawConnection.targetId ?? unifiedConnection.toPartnerId ?? null,
    targetName: legacyConnection.targetName ?? rawConnection.targetName ?? legacyConnection.otherName ?? 'Partner',
    targetType: legacyConnection.targetType ?? rawConnection.targetType ?? legacyConnection.otherType ?? 'venue',
    otherId: legacyConnection.otherId ?? legacyConnection.targetId ?? rawConnection.targetId ?? unifiedConnection.toPartnerId ?? null,
    otherName: legacyConnection.otherName ?? legacyConnection.targetName ?? rawConnection.targetName ?? 'Partner',
    otherType: legacyConnection.otherType ?? legacyConnection.targetType ?? rawConnection.targetType ?? 'venue',
    eventId: unifiedConnection.eventId ?? rawConnection.eventId ?? null,
    status: legacyConnection.status ?? unifiedConnection.status ?? rawConnection.status ?? 'pending',
    createdAt: legacyConnection.createdAt ?? unifiedConnection.createdAt ?? toIso(rawConnection.createdAt),
    updatedAt: legacyConnection.updatedAt ?? unifiedConnection.updatedAt ?? toIso(rawConnection.updatedAt),
    message: legacyConnection.message ?? rawConnection.message ?? '',
  };
}

function buildPromoterKpis(stats: PlainRecord, activeAssignments: PlainRecord[]) {
  return {
    totalClicks: toNumber(stats.totalClicks ?? stats.clicks),
    ticketsSold: toNumber(stats.totalConversions ?? stats.conversions),
    commission: toNumber(stats.totalCommissionEarned ?? stats.earnings),
    activeEvents: activeAssignments.length,
  };
}

function deriveLinkAction(body: PlainRecord) {
  if (typeof body.action === 'string' && body.action) return body.action;
  if (body.active === true) return 'reactivate';
  if (body.active === false) return 'deactivate';
  if (typeof body.editableSlug === 'string' && body.editableSlug) return 'update_alias';
  return undefined;
}

function deriveConnectionAction(body: PlainRecord) {
  const action = String(body.action || '').toLowerCase();
  if (!action) return undefined;
  if (action === 'accepted') return 'approve';
  if (action === 'rejected') return 'reject';
  return action;
}

export default async function partnersPromoterRoutes(fastify: FastifyInstance) {
  const svcCtx = { db: fastify.db, log: fastify.log, redis: fastify.redis };
  const promoterService = new PromoterService(svcCtx);
  const financeService = new FinanceService(svcCtx);

  const pickString = (...values: any[]) => {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  };

  const isPromoterAllowedForEvent = (event: Record<string, any>, promoterId: string) => {
    const globallyEnabled = event?.promotersEnabled === true || event?.promoterSettings?.enabled === true;
    if (!globallyEnabled) return false;
    const allowedIds = Array.isArray(event?.promoterSettings?.allowedPromoterIds)
      ? event.promoterSettings.allowedPromoterIds.map((value: any) => String(value))
      : [];
    return allowedIds.length === 0 || allowedIds.includes(String(promoterId));
  };

  const normalizeLegacyLinkStatus = (link: Record<string, any>) => {
    const explicit = String(link.status || '').toLowerCase();
    if (explicit) return explicit;
    return link.isActive === false ? 'deactivated' : 'active';
  };

  const buildLegacyLink = (link: Record<string, any>, event: Record<string, any> = {}) => {
    const clicks = toNumber(link.clicks ?? link.clickCount);
    const conversions = toNumber(link.conversions ?? link.conversionCount);
    const status = normalizeLegacyLinkStatus(link);
    return {
      id: String(link.id || ''),
      eventId: pickString(link.eventId),
      eventTitle: pickString(link.eventTitle, event.title, event.name, 'Event'),
      eventSlug: pickString(link.eventSlug, event.slug),
      eventImage: pickString(event.image, event.coverImage, event.poster, event.bannerImage),
      venueName: pickString(event.venueName, event.venue, event.locationName),
      city: pickString(event.city, event.cityName, link.city),
      startDate: toIso(event.startDate || event.date || event.eventDate),
      startTime: pickString(event.startTime),
      endTime: pickString(event.endTime),
      campaignLabel: pickString(link.campaignLabel, link.label),
      label: pickString(link.label, link.campaignLabel),
      code: pickString(link.code),
      shortCode: pickString(link.shortCode, link.code),
      channel: pickString(link.channel),
      status,
      isActive: status === 'active',
      clicks,
      clickCount: clicks,
      conversions,
      conversionCount: conversions,
      revenue: toNumber(link.revenue),
      commission: toNumber(link.commission),
      clearedCommission: toNumber(link.clearedCommission ?? link.commission),
      commissionRate: toNumber(link.commissionRate),
      fullUrl: pickString(link.fullUrl, link.url) || null,
      vanityPrefix: pickString(link.vanityPrefix) || null,
      vanitySlug: pickString(link.vanitySlug) || null,
      vanityAlias: pickString(link.vanityAlias) || null,
    };
  };

  const loadEventsByIds = async (eventIds: string[]) => {
    const uniqueIds = Array.from(new Set(eventIds.filter(Boolean)));
    const docs = await Promise.all(uniqueIds.map((eventId) => fastify.db.collection('events').doc(eventId).get()));
    return docs.reduce((map, doc) => {
      if (doc.exists) map.set(doc.id, { id: doc.id, ...(doc.data() || {}) });
      return map;
    }, new Map<string, Record<string, any>>());
  };

  const buildLegacyPromoterEvent = (event: Record<string, any>, activeLink?: Record<string, any>) => {
    const tickets = Array.isArray(event.tickets) ? event.tickets.map((ticket: any, index: number) => ({
      id: String(ticket?.id || ticket?.ticketTierId || index),
      name: pickString(ticket?.name, ticket?.title, `Tier ${index + 1}`),
      price: toNumber(ticket?.price || ticket?.amount),
      promoterEnabled: ticket?.promoterEnabled !== false,
    })) : [];

    return {
      id: String(event.id || ''),
      title: pickString(event.title, event.name, 'Event'),
      summary: pickString(event.summary, event.description),
      image: pickString(event.image, event.coverImage, event.poster, event.bannerImage),
      date: toIso(event.startDate || event.date || event.eventDate),
      startDate: toIso(event.startDate || event.date || event.eventDate),
      startTime: pickString(event.startTime),
      time: pickString(event.time, event.startTime, 'Time TBA'),
      location: pickString(event.location, event.address, event.venueName, event.venue),
      venue: pickString(event.venueName, event.venue, event.locationName),
      venueName: pickString(event.venueName, event.venue, event.locationName),
      hostName: pickString(event.hostName, event.host),
      city: pickString(event.city, event.cityName),
      category: pickString(event.category, event.genre),
      creatorRole: pickString(event.creatorRole),
      priceRange: {
        min: tickets.length ? Math.min(...tickets.map((ticket: any) => toNumber(ticket.price))) : 0,
        max: tickets.length ? Math.max(...tickets.map((ticket: any) => toNumber(ticket.price))) : 0,
      },
      commissionRate: toNumber(activeLink?.commissionRate || event.promoterSettings?.commissionRate || event.commissionRate || 0),
      tickets,
      stats: {
        interested: toNumber(event.interestedCount || event.rsvpCount || event.views || 0),
      },
    };
  };

  const getPromoterProfile = async (promoterId: string) => {
    const doc = await fastify.db.collection('promoters').doc(promoterId).get();
    return { profile: doc.exists ? { id: doc.id, ...(doc.data() || {}) } : { id: promoterId } };
  };

  const updatePromoterProfile = async (promoterId: string, body: Record<string, any>) => {
    const allowedFields = ['displayName', 'name', 'handle', 'avatarUrl', 'photoURL', 'profileImage', 'phone', 'contactPhone', 'instagram', 'bio', 'summary', 'city', 'isPublic', 'socialLinks', 'website'];
    const patch: Record<string, any> = { updatedAt: new Date().toISOString() };
    for (const field of allowedFields) {
      if (body[field] !== undefined) patch[field] = body[field];
    }
    if (patch.displayName && patch.name === undefined) patch.name = patch.displayName;
    await fastify.db.collection('promoters').doc(promoterId).set(patch, { merge: true });
    return getPromoterProfile(promoterId);
  };

  const getLegacyOverview = async (promoterId: string) => {
    const [stats, linksSnap] = await Promise.all([
      getPromoterStats(promoterId).catch(() => ({ totalEarnings: 0, totalClicks: 0, totalConversions: 0 })),
      fastify.db.collection('promoter_links').where('promoterId', '==', promoterId).where('isActive', '==', true).get().catch(() => ({ docs: [] as any[] })),
    ]);
    return {
      stats: {
        earnings: toNumber((stats as any).totalEarnings),
        clicks: toNumber((stats as any).totalClicks),
        conversions: toNumber((stats as any).totalConversions),
        payoutsPending: 0,
      },
      activeLinks: (linksSnap as any).docs.length,
      upcomingEvents: 0,
      recentActivity: [],
    };
  };

  const getLegacyAnalytics = async (promoterId: string) => {
    const stats = await getPromoterStats(promoterId).catch(() => ({ totalEarnings: 0, totalClicks: 0, totalConversions: 0 }));
    return {
      clicks: toNumber((stats as any).totalClicks),
      conversions: toNumber((stats as any).totalConversions),
      earnings: toNumber((stats as any).totalEarnings),
      conversionRate: toNumber((stats as any).totalClicks) > 0
        ? parseFloat(((toNumber((stats as any).totalConversions) / toNumber((stats as any).totalClicks)) * 100).toFixed(1))
        : 0,
    };
  };

  const getLegacyLinks = async (promoterId: string, query: Record<string, any>) => {
    const pageSize = Math.min(parseInt(String(query.limit || '100'), 10) || 100, 200);
    const snap = await fastify.db.collection('promoter_links')
      .where('promoterId', '==', promoterId)
      .limit(pageSize)
      .get()
      .catch(() => ({ docs: [] as any[] }));
    let links = (snap as any).docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
    if (query.eventId) links = links.filter((link: any) => String(link.eventId || '') === String(query.eventId));
    const activeParam = query.isActive ?? query.active;
    if (activeParam !== undefined) {
      const active = String(activeParam) === 'true';
      links = links.filter((link: any) => (link.isActive !== false) === active);
    }
    links.sort((left: any, right: any) => {
      const leftTime = new Date(toIso(left.createdAt) || 0).getTime();
      const rightTime = new Date(toIso(right.createdAt) || 0).getTime();
      return rightTime - leftTime;
    });
    const eventMap = await loadEventsByIds(links.map((link: any) => String(link.eventId || '')));
    return { links: links.map((link: any) => buildLegacyLink(link, eventMap.get(String(link.eventId || '')) || {})) };
  };

  const createLegacyLink = async (promoterId: string, body: Record<string, any>) => {
    const eventId = String(body.eventId || '');
    if (!eventId) {
      const err: any = new Error('promoterId and eventId are required');
      err.statusCode = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }
    const existingSnap = await fastify.db.collection('promoter_links')
      .where('promoterId', '==', promoterId)
      .where('eventId', '==', eventId)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    const eventDoc = await fastify.db.collection('events').doc(eventId).get();
    const event: Record<string, any> = eventDoc.exists ? { id: eventDoc.id, ...(eventDoc.data() || {}) } : { id: eventId };
    if (!existingSnap.empty) {
      const existing = { id: existingSnap.docs[0].id, ...(existingSnap.docs[0].data() || {}) };
      return { link: buildLegacyLink(existing, event), duplicate: true };
    }
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const now = new Date().toISOString();
    const id = randomUUID();
    const link = {
      id,
      promoterId,
      promoterName: body.promoterName || '',
      eventId,
      eventTitle: pickString(body.eventTitle, event.title, event.name),
      campaignLabel: pickString(body.campaignLabel),
      ticketTierIds: Array.isArray(body.ticketTierIds) ? body.ticketTierIds : [],
      commissionRate: normalizePromoterCommissionRate(body.commissionRate || event.promoterSettings?.commissionRate || event.commissionRate || 0),
      commissionType: pickString(body.commissionType, 'percentage'),
      code,
      clicks: 0,
      conversions: 0,
      revenue: 0,
      commission: 0,
      isActive: true,
      status: 'active',
      fullUrl: pickString(body.fullUrl) || null,
      vanityPrefix: pickString(body.vanityPrefix) || null,
      vanitySlug: pickString(body.editableSlug) || null,
      vanityAlias: pickString(body.editableSlug) || null,
      channel: pickString(body.channel, 'organic'),
      createdAt: now,
      updatedAt: now,
    };
    await fastify.db.collection('promoter_links').doc(id).set(link);
    return { link: buildLegacyLink(link, event), duplicate: false };
  };

  const updateLegacyLink = async (promoterId: string, linkId: string, body: Record<string, any>) => {
    const ref = fastify.db.collection('promoter_links').doc(linkId);
    const doc = await ref.get();
    if (!doc.exists) {
      const err: any = new Error('Link not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    const current = { id: doc.id, ...(doc.data() || {}) } as Record<string, any>;
    if (String(current.promoterId || '') !== promoterId) {
      const err: any = new Error('Forbidden');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
    const action = String(body.action || deriveLinkAction(body) || '').toLowerCase();
    const editableSlug = pickString(body.editableSlug);
    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (action === 'deactivate') {
      updates.isActive = false;
      updates.status = 'deactivated';
    } else if (action === 'reactivate') {
      updates.isActive = true;
      updates.status = 'active';
    } else if (action === 'update_alias') {
      updates.vanitySlug = editableSlug;
      updates.vanityAlias = editableSlug;
    } else {
      const err: any = new Error('Unsupported link action');
      err.statusCode = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }
    await ref.update(updates);
    const updatedDoc = await ref.get();
    const updated = { id: updatedDoc.id, ...(updatedDoc.data() || {}) } as Record<string, any>;
    const eventDoc = updated.eventId ? await fastify.db.collection('events').doc(String(updated.eventId)).get() : null;
    const event = eventDoc?.exists ? { id: eventDoc.id, ...(eventDoc.data() || {}) } : {};
    return { success: true, link: buildLegacyLink(updated, event) };
  };

  const getLegacyLinkAnalytics = async (promoterId: string, linkId: string) => {
    const doc = await fastify.db.collection('promoter_links').doc(linkId).get();
    if (!doc.exists) {
      const err: any = new Error('Link not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    const link = { id: doc.id, ...(doc.data() || {}) } as Record<string, any>;
    if (String(link.promoterId || '') !== promoterId) {
      const err: any = new Error('Forbidden');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
    const eventDoc = link.eventId ? await fastify.db.collection('events').doc(String(link.eventId)).get() : null;
    const event = eventDoc?.exists ? { id: eventDoc.id, ...(eventDoc.data() || {}) } : {};
    return {
      link: buildLegacyLink(link, event),
      funnel: {
        clicks: toNumber(link.clicks ?? link.clickCount),
        conversions: toNumber(link.conversions ?? link.conversionCount),
        revenue: toNumber(link.revenue),
      },
    };
  };

  const getLegacyEvents = async (promoterId: string, query: Record<string, any>) => {
    const pageSize = Math.min(parseInt(String(query.limit || '50'), 10) || 50, 100);
    const [directEnabled, settingsEnabled, linksSnap] = await Promise.all([
      fastify.db.collection('events').where('promotersEnabled', '==', true).limit(pageSize * 2).get().catch(() => ({ docs: [] as any[] })),
      fastify.db.collection('events').where('promoterSettings.enabled', '==', true).limit(pageSize * 2).get().catch(() => ({ docs: [] as any[] })),
      fastify.db.collection('promoter_links').where('promoterId', '==', promoterId).limit(200).get().catch(() => ({ docs: [] as any[] })),
    ]);
    const activeLinkByEventId = new Map<string, Record<string, any>>();
    for (const doc of (linksSnap as any).docs || []) {
      const link = { id: doc.id, ...(doc.data() || {}) } as Record<string, any>;
      if ((link.isActive !== false) && link.eventId && !activeLinkByEventId.has(String(link.eventId))) {
        activeLinkByEventId.set(String(link.eventId), link);
      }
    }
    const deduped = new Map<string, Record<string, any>>();
    for (const doc of [...((directEnabled as any).docs || []), ...((settingsEnabled as any).docs || [])]) {
      deduped.set(doc.id, { id: doc.id, ...(doc.data() || {}) });
    }
    const events = [...deduped.values()]
      .filter((event) => isPromoterAllowedForEvent(event, promoterId))
      .filter((event) => {
        if (!query.status) return ['scheduled', 'approved', 'upcoming', 'live'].includes(String(event.lifecycle || event.status || '').toLowerCase());
        return String(event.lifecycle || event.status || '').toLowerCase() === String(query.status).toLowerCase();
      })
      .filter((event) => {
        if (!query.city) return true;
        return pickString(event.city, event.cityName).toLowerCase().includes(String(query.city).trim().toLowerCase());
      })
      .sort((left, right) => {
        const leftTime = new Date(toIso(left.startDate || left.date || left.eventDate) || 0).getTime();
        const rightTime = new Date(toIso(right.startDate || right.date || right.eventDate) || 0).getTime();
        return leftTime - rightTime;
      })
      .slice(0, pageSize)
      .map((event) => buildLegacyPromoterEvent(event, activeLinkByEventId.get(String(event.id))));
    return { events };
  };

  const buildLegacyAssignments = async (promoterId: string, status?: string) => {
    const assignmentSnap = await fastify.db.collection('promoter_assignments').where('promoterId', '==', promoterId).limit(100).get().catch(() => ({ docs: [] as any[] }));
    const linkSnap = await fastify.db.collection('promoter_links').where('promoterId', '==', promoterId).limit(200).get().catch(() => ({ docs: [] as any[] }));
    const assignments = (assignmentSnap as any).docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
    const links = (linkSnap as any).docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
    const eventMap = await loadEventsByIds([
      ...assignments.map((assignment: any) => String(assignment.eventId || '')),
      ...links.map((link: any) => String(link.eventId || '')),
    ]);
    const activeLinkByEventId = new Map<string, Record<string, any>>();
    for (const link of links) {
      if ((link.isActive !== false) && link.eventId && !activeLinkByEventId.has(String(link.eventId))) {
        activeLinkByEventId.set(String(link.eventId), link);
      }
    }
    let rows = assignments.map((assignment: any) => {
      const event = eventMap.get(String(assignment.eventId || '')) || {};
      const activeLink = activeLinkByEventId.get(String(assignment.eventId || ''));
      const eventStatus = String(event.lifecycle || event.status || assignment.status || 'upcoming').toLowerCase();
      const normalizedStatus = ['completed', 'ended', 'closed', 'finished'].includes(eventStatus)
        ? 'completed'
        : ['active', 'approved', 'live', 'scheduled', 'upcoming'].includes(eventStatus)
          ? 'active'
          : eventStatus;
      const ticketCount = toNumber(assignment.totalSales || assignment.ticketsSold || activeLink?.conversions || activeLink?.conversionCount);
      const revenue = toNumber(assignment.totalRevenue || assignment.revenue || activeLink?.revenue);
      const commissionRate = toNumber(assignment.commissionRate || activeLink?.commissionRate);
      const estimatedCommission = toNumber(assignment.totalCommission || assignment.commissionEarned || activeLink?.commission);
      return {
        id: String(assignment.id),
        eventId: String(assignment.eventId || ''),
        status: normalizedStatus,
        commissionRate,
        linkCode: pickString(assignment.linkCode, assignment.code, activeLink?.code),
        event: {
          name: pickString(event.title, event.name, assignment.eventName, assignment.eventTitle, 'Event'),
          venue: pickString(event.venueName, event.venue, assignment.venueName),
          date: toIso(event.startDate || event.date || event.eventDate || assignment.eventDate || assignment.createdAt),
          coverUrl: pickString(event.image, event.coverImage, event.poster, event.bannerImage),
          status: pickString(event.lifecycle, event.status, assignment.status, 'upcoming'),
        },
        stats: {
          revenue,
          ticketsSold: ticketCount,
          commissionRate,
          totalRevenue: revenue,
          estimatedCommission,
          totalClicks: toNumber(activeLink?.clicks || activeLink?.clickCount),
          totalPurchases: ticketCount,
        },
        guestlist: {
          allowance: toNumber(assignment.guestlistAllowance || assignment.allowance),
          used: toNumber(assignment.guestlistUsed || assignment.used),
          guests: Array.isArray(assignment.guests) ? assignment.guests : [],
        },
        links: activeLink ? [buildLegacyLink(activeLink, event)] : [],
      };
    });

    if (rows.length === 0) {
      rows = [...activeLinkByEventId.entries()].map(([eventId, activeLink]) => {
        const event = eventMap.get(eventId) || {};
        const ticketCount = toNumber(activeLink?.conversions || activeLink?.conversionCount);
        const revenue = toNumber(activeLink?.revenue);
        const commissionRate = toNumber(activeLink?.commissionRate);
        const estimatedCommission = toNumber(activeLink?.commission);
        return {
          id: eventId,
          eventId,
          status: ['completed', 'ended', 'closed', 'finished'].includes(String(event.lifecycle || event.status || '').toLowerCase()) ? 'completed' : 'active',
          commissionRate,
          linkCode: pickString(activeLink?.code),
          event: {
            name: pickString(event.title, event.name, 'Event'),
            venue: pickString(event.venueName, event.venue),
            date: toIso(event.startDate || event.date || event.eventDate),
            coverUrl: pickString(event.image, event.coverImage, event.poster, event.bannerImage),
            status: pickString(event.lifecycle, event.status, 'upcoming'),
          },
          stats: {
            revenue,
            ticketsSold: ticketCount,
            commissionRate,
            totalRevenue: revenue,
            estimatedCommission,
            totalClicks: toNumber(activeLink?.clicks || activeLink?.clickCount),
            totalPurchases: ticketCount,
          },
          guestlist: { allowance: 0, used: 0, guests: [] },
          links: [buildLegacyLink(activeLink, event)],
        };
      });
    }

    if (status) {
      const normalized = String(status).toLowerCase();
      rows = rows.filter((row: any) => normalized === 'completed' ? row.status === 'completed' : row.status !== 'completed');
    }

    rows.sort((left: any, right: any) => {
      const leftTime = new Date(left.event?.date || 0).getTime();
      const rightTime = new Date(right.event?.date || 0).getTime();
      return rightTime - leftTime;
    });
    return rows;
  };

  const getLegacyConnections = async (promoterId: string, status?: string) => {
    const snap = await fastify.db.collection('promoter_connections').where('promoterId', '==', promoterId).limit(100).get();
    let connections = snap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
    if (status) connections = connections.filter((connection: any) => String(connection.status || '').toLowerCase() === String(status).toLowerCase());
    return {
      connections: connections.map((connection: any) => ({
        id: connection.id,
        promoterId: connection.promoterId,
        status: connection.status,
        otherId: connection.targetId || null,
        otherName: connection.targetName || 'Partner',
        otherType: connection.targetType || 'venue',
        targetId: connection.targetId || null,
        targetName: connection.targetName || 'Partner',
        targetType: connection.targetType || 'venue',
        createdAt: connection.createdAt || null,
        updatedAt: connection.updatedAt || null,
        message: connection.message || '',
      })),
    };
  };

  const createLegacyConnection = async (promoterId: string, body: Record<string, any>) => {
    const id = randomUUID();
    const now = new Date().toISOString();
    const connection = {
      id,
      promoterId,
      targetId: String(body.targetId || body.targetPartnerId || ''),
      targetType: pickString(body.targetType, 'venue'),
      targetName: pickString(body.targetName),
      status: 'pending',
      message: pickString(body.message),
      createdAt: now,
      updatedAt: now,
    };
    await fastify.db.collection('promoter_connections').doc(id).set(connection);
    return { connection };
  };

  const updateLegacyConnection = async (promoterId: string, connectionId: string, body: Record<string, any>) => {
    const action = String(deriveConnectionAction(body) || '').toLowerCase();
    const statusMap: Record<string, string> = { approve: 'approved', reject: 'rejected', block: 'blocked', revoke: 'revoked', remove: 'removed' };
    const nextStatus = statusMap[action];
    if (!nextStatus) {
      const err: any = new Error('Invalid action');
      err.statusCode = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }
    const ref = fastify.db.collection('promoter_connections').doc(connectionId);
    const doc = await ref.get();
    if (!doc.exists) {
      const err: any = new Error('Connection not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    const current = doc.data() as Record<string, any>;
    if (String(current.promoterId || '') !== promoterId) {
      const err: any = new Error('Forbidden');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
    await ref.update({ status: nextStatus, updatedAt: new Date().toISOString(), ...(body.reason ? { reason: String(body.reason) } : {}) });
    return { success: true, status: nextStatus };
  };

  const resolvePromoterGuests = async (promoterId: string, limit: number) => {
    const linksSnap = await fastify.db.collection('promoter_links').where('promoterId', '==', promoterId).get();
    const codes: string[] = linksSnap.docs.map((doc: any) => doc.data().code).filter(Boolean);
    if (codes.length === 0) return { guests: [], hasMore: false, nextCursor: null };
    const chunks: string[][] = [];
    for (let i = 0; i < codes.length; i += 10) chunks.push(codes.slice(i, i + 10));
    const snapshots = await Promise.all(chunks.map((chunk) => fastify.db.collection('orders').where('promoterCode', 'in', chunk).get()));
    const allDocs = snapshots.flatMap((snapshot: any) => snapshot.docs);
    const hasMore = allDocs.length > limit;
    const orderDocs = allDocs.slice(0, limit);
    const eventIds = [...new Set(orderDocs.map((d: any) => String(d.data().eventId || '')).filter(Boolean))];
    const eventChunks: string[][] = [];
    for (let i = 0; i < eventIds.length; i += 10) eventChunks.push(eventIds.slice(i, i + 10));
    const eventSnaps = eventChunks.length > 0 ? await Promise.all(eventChunks.map((chunk) => fastify.db.collection('events').where('__name__', 'in', chunk).get())) : [];
    const eventMap = new Map<string, string>();
    for (const snap of eventSnaps) {
      for (const doc of (snap as any).docs || []) eventMap.set(doc.id, (doc.data() as any).title || (doc.data() as any).name || '');
    }
    const guests = orderDocs.map((doc: any) => {
      const order = doc.data() as Record<string, any>;
      const totalPaise = toNumber(order.totalPaise || 0);
      const amount = totalPaise > 0 ? totalPaise / 100 : toNumber(order.amount || 0);
      const commissionRate = toNumber(order.commissionRate || 0.1);
      return { id: doc.id, guestName: order.guestName || order.buyerName || 'Guest', eventTitle: eventMap.get(String(order.eventId || '')) || 'Event', eventId: order.eventId, amount, commission: Math.round(amount * commissionRate * 100) / 100, ticketCount: toNumber(order.ticketCount || 1), status: String(order.status || 'paid'), checkedIn: !!order.checkedIn, source: order.promoterCode || 'link', promoterCode: order.promoterCode, createdAt: order.createdAt };
    });
    return { guests, hasMore, nextCursor: hasMore ? guests[guests.length - 1]?.id ?? null : null };
  };

  const buildPromoterFinancePayload = async (promoterId: string) => {
    const promoterCtx = { partnerId: promoterId, uid: promoterId, type: 'promoter' as const, roles: [], venueIds: [], displayName: 'Promoter' };
    const [balances, payouts, ledger] = await Promise.all([
      financeService.getBalances(promoterCtx),
      financeService.getPayouts(promoterCtx, { limit: 100 }),
      financeService.getLedger(promoterCtx, { type: 'promoter_commission', limit: 100 }),
    ]);
    const payoutRows = asArray(payouts.data).map((item: Record<string, any>) => ({
      id: item.payoutId,
      amount: toNumber(item.amount),
      status: String(item.status || 'pending').toLowerCase(),
      paymentMethod: item.paymentMethod || null,
      requestedAt: item.requestedAt || null,
      completedAt: item.completedAt || null,
      paymentDetails: null,
      bankName: null,
      last4: null,
    }));
    const totalPaid = payoutRows.filter((row) => ['completed', 'paid', 'cleared'].includes(row.status)).reduce((sum, row) => sum + toNumber(row.amount), 0);
    return {
      balance: {
        totalEarned: toNumber(balances.available) + toNumber(balances.pending),
        available: toNumber(balances.available),
        pending: toNumber(balances.pending),
        totalPaid,
        instantAvailable: 0,
      },
      payouts: payoutRows,
      commissionDetails: asArray(ledger.data).map((entry: Record<string, any>) => ({
        id: entry.entryId,
        eventId: entry.eventId || null,
        eventName: null,
        buyerName: null,
        amount: toNumber(entry.amount),
        revenue: toNumber(entry.amount),
        status: String(entry.status || 'pending').toLowerCase(),
        date: entry.createdAt || null,
        source: 'partner_ledger',
      })),
    };
  };

  const createBankAccount = async (promoterId: string, body: Record<string, any>) => {
    const account = buildPayoutAccountRecord(body, { partnerId: promoterId, ownerType: 'promoter' });
    const ref = await fastify.db.collection('bank_accounts').add(account.record);
    return account.response(ref.id);
  };

  const deleteBankAccount = async (promoterId: string, accountId: string) => {
    const ref = fastify.db.collection('bank_accounts').doc(accountId);
    const doc = await ref.get();
    if (!doc.exists) {
      const err: any = new Error('Account not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    const account = doc.data() as Record<string, any>;
    if (String(account.partnerId || '') !== promoterId) {
      const err: any = new Error('Forbidden');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
    await ref.delete();
    return { success: true };
  };

  const requirePromoterContext = async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) {
      reply.status(403).send(buildErrorResponse({
        code: 'FORBIDDEN',
        message: 'No partner identity found',
        requestId: request.id,
      }));
      return null;
    }

    requireType(ctx, 'promoter');
    return ctx;
  };

  const loadRawLink = async (linkId: string): Promise<PlainRecord> => {
    if (!linkId) return {};
    const doc = await fastify.db.collection('promoter_links').doc(linkId).get().catch(() => null);
    return doc?.exists ? { id: doc.id, ...(doc.data() || {}) } : {};
  };

  const loadRawConnection = async (connectionId: string): Promise<PlainRecord> => {
    if (!connectionId) return {};
    const doc = await fastify.db.collection('promoter_connections').doc(connectionId).get().catch(() => null);
    return doc?.exists ? { id: doc.id, ...(doc.data() || {}) } : {};
  };

  fastify.get('/partners/promoters/stats/:id', async (request: any, reply: any) => {
    try {
      return reply.send(await getPromoterStats(request.params.id));
    } catch {
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.get('/partners/promoters/network/connections', async (request: any, reply: any) => {
    const query = asRecord(request.query);
    try {
      return reply.send(await listConnections(String(query.entityId || ''), String(query.entityType || ''), query.status ? String(query.status) : undefined));
    } catch {
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.post('/partners/promoters/network/connect', async (request: any, reply: any) => {
    const body = asRecord(request.body);
    try {
      return reply.send(await manageConnection(String(body.action || ''), { ...body, actor: request.user }));
    } catch {
      return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'Request failed', requestId: request.id }));
    }
  });

  // ── Overview ───────────────────────────────────────────────────────────────

  fastify.get('/partners/promoters/overview', {
    preHandler: [fastify.requireAuth],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'promoter');
      const cacheKey = `partners:promoter:overview:${ctx.partnerId}:contract-v1`;
      const cached = await fastify.cache.get('partners', cacheKey);
      if (cached) return reply.header('Cache-Control', 'private, max-age=120').send({ ...cached, fromCache: true });

      const [result, legacyBody, assignmentsPayload, linksPayload] = await Promise.all([
        promoterService.getOverview(ctx),
        getLegacyOverview(ctx.partnerId),
        buildLegacyAssignments(ctx.partnerId, 'active'),
        getLegacyLinks(ctx.partnerId, { limit: 5, isActive: 'true' }),
      ]);
      const legacyStats = asRecord(legacyBody.stats);
      const assignments = asArray(assignmentsPayload);
      const normalizedLinks = asArray(linksPayload.links).map((link: PlainRecord) => normalizePromoterLink(link));
      const stats: PlainRecord = {
        ...legacyStats,
        ...asRecord(result.stats),
        earnings: toNumber(legacyStats.earnings ?? result.stats.totalCommissionEarned),
        clicks: toNumber(legacyStats.clicks ?? result.stats.totalClicks),
        conversions: toNumber(legacyStats.conversions ?? result.stats.totalConversions),
        payoutsPending: toNumber(legacyStats.payoutsPending),
      };
      const topLink = normalizedLinks[0]
        ? {
            id: normalizedLinks[0].id,
            event: { name: normalizedLinks[0].eventTitle || 'Event' },
            eventName: normalizedLinks[0].eventTitle || 'Event',
            linkCode: normalizedLinks[0].code,
            attributedRevenue: toNumber(normalizedLinks[0].revenue),
            clicks: toNumber(normalizedLinks[0].clicks),
            conversions: toNumber(normalizedLinks[0].conversions),
            commission: toNumber(normalizedLinks[0].commission),
          }
        : null;
      const normalized = {
        ...legacyBody,
        stats,
        kpis: buildPromoterKpis(stats, assignments),
        activeAssignments: assignments.map((a: PlainRecord) => ({
          ...a,
          eventName: String(asRecord(a.event).name || a.eventName || a.eventTitle || ''),
          venueName: String(asRecord(a.event).venue || a.venueName || ''),
          eventDate: (asRecord(a.event).date || a.eventDate) ?? null,
          coverImage: String(asRecord(a.event).coverUrl || a.coverImage || '') || null,
          ticketsSold: toNumber(asRecord(a.stats).ticketsSold ?? a.ticketsSold ?? 0),
          commission: toNumber(asRecord(a.stats).estimatedCommission ?? a.commission ?? 0),
        })),
        conversionSnapshot: {
          rate: (legacyBody as any).conversionRate ?? `${(toNumber((stats as any).conversionRate) * 100).toFixed(1)}%`,
          clicks: toNumber(stats.totalClicks ?? stats.clicks),
          purchases: toNumber(stats.totalConversions ?? stats.conversions),
        },
        topLink,
        leaderboardPosition: null,
        topLinks: normalizedLinks.length ? normalizedLinks : asArray(result.topLinks),
        recentActivity: asArray(result.recentActivity).length ? result.recentActivity : asArray(legacyBody.recentActivity),
        activeLinks: toNumber(legacyBody.activeLinks ?? result.stats.totalLinks ?? normalizedLinks.length),
        upcomingEvents: legacyBody.upcomingEvents ?? assignments.length,
      };

      await fastify.cache.set('partners', cacheKey, normalized, 120);
      return reply.header('Cache-Control', 'private, max-age=120').send(normalized);
    } catch (err: any) {
      fastify.log.error({ err: err.message, partnerId: ctx.partnerId }, 'partners/promoters/overview error');
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  // ── Analytics ──────────────────────────────────────────────────────────────

  fastify.get('/partners/promoters/analytics', {
    preHandler: [
      fastify.validate({ querystring: AnalyticsQuerySchema }),
      fastify.requireAuth,
    ],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'promoter');
      const filters = {
        from: request.query.from,
        to: request.query.to,
        linkId: request.query.linkId,
      };
      const [result, overview, legacyBody, legacyLinksBody] = await Promise.all([
        promoterService.getAnalytics(ctx, filters),
        promoterService.getOverview(ctx),
        getLegacyAnalytics(ctx.partnerId),
        getLegacyLinks(ctx.partnerId, {
          eventId: request.query.eventId,
          limit: 25,
          isActive: request.query.isActive ?? request.query.active,
        }),
      ]);
      const stats = asRecord(overview.stats);
      const normalizedLinks = asArray(legacyLinksBody.links).map((link: PlainRecord) => normalizePromoterLink(link));
      const byLink = asArray(result.byLink).length
        ? result.byLink
        : normalizedLinks.map((link: PlainRecord) => ({
            linkId: String(link.linkId || link.id || ''),
            code: String(link.code || ''),
            clicks: toNumber(link.clickCount ?? link.clicks),
            conversions: toNumber(link.conversionCount ?? link.conversions),
            revenue: toNumber(link.revenue),
          }));
      const timeline = asArray(result.timeSeries).map((point: PlainRecord) => ({
        date: point.date ?? point.label ?? null,
        clicks: toNumber(point.clicks ?? point.value),
        sales: toNumber(point.sales ?? point.conversions),
        revenue: toNumber(point.revenue ?? point.amount),
      }));
      const overviewPayload = {
        totalClicks: toNumber(legacyBody.clicks ?? stats.totalClicks),
        ticketsSold: toNumber(legacyBody.conversions ?? stats.totalConversions),
        revenue: toNumber(stats.totalRevenue ?? byLink.reduce((sum, link) => sum + toNumber(link.revenue), 0)),
        commission: toNumber(legacyBody.earnings ?? stats.totalCommissionEarned),
        conversionRate: legacyBody.conversionRate ?? `${(toNumber(stats.conversionRate) * 100).toFixed(1)}%`,
        activeLinks: normalizedLinks.filter((link: PlainRecord) => link.isActive !== false).length,
        totalLinks: toNumber(stats.totalLinks ?? normalizedLinks.length),
      };
      const activities = normalizedLinks.slice(0, 8).map((link: PlainRecord) => ({
        id: String(link.id || link.linkId || ''),
        type: 'link',
        title: link.campaignLabel || link.label || link.eventTitle || 'Link activity',
        eventName: link.eventTitle || 'Event',
        linkCode: link.code || '',
        commission: toNumber(link.commission),
        amount: toNumber(link.revenue),
        createdAt: link.updatedAt ?? link.createdAt ?? null,
      }));

      return reply.header('Cache-Control', 'private, max-age=120').send({
        ...legacyBody,
        overview: overviewPayload,
        timeline,
        topLinks: normalizedLinks,
        activities,
        timeSeries: result.timeSeries,
        byLink,
      });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  // ── Links CRUD ─────────────────────────────────────────────────────────────

  fastify.get('/partners/promoters/links', {
    preHandler: [
      fastify.validate({ querystring: LinksQuerySchema }),
      fastify.requireAuth,
    ],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'promoter');
      const { eventId, cursor, limit } = request.query;
      const activeParam = request.query.active ?? request.query.isActive;
      const result = await promoterService.getLinks(ctx, {
        eventId,
        active: activeParam === 'true' ? true : activeParam === 'false' ? false : undefined,
        cursor,
        limit,
      });
      const legacyBody = await getLegacyLinks(ctx.partnerId, {
        eventId,
        limit,
        isActive: activeParam,
      });
      const unifiedById = mapByAnyId(asArray(result.data), ['linkId', 'id']);
      const links = asArray(legacyBody.links).map((link: PlainRecord) => normalizePromoterLink(link, unifiedById.get(String(link.id || ''))));
      return reply.header('Cache-Control', 'private, max-age=60').send({
        ...legacyBody,
        links,
        data: links,
        hasMore: Boolean(result.hasMore ?? (legacyBody as any).hasMore),
        nextCursor: result.nextCursor ?? (legacyBody as any).nextCursor ?? null,
      });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.post('/partners/promoters/links', {
    preHandler: [
      fastify.validate({ body: CreateLinkSchema }),
      fastify.requireAuth,
    ],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'promoter');
      const legacyBody = await createLegacyLink(ctx.partnerId, asRecord(request.body));
      const legacyLink = asRecord(legacyBody.link);
      const rawLink = await loadRawLink(String(legacyLink.id || ''));
      return reply.status(legacyBody.duplicate ? 200 : 201).send({
        ...legacyBody,
        link: normalizePromoterLink(legacyLink, {}, rawLink),
      });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.patch('/partners/promoters/links/:linkId', {
    preHandler: [
      fastify.validate({ body: UpdateLinkSchema }),
      fastify.requireAuth,
    ],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'promoter');
      const legacyBody = await updateLegacyLink(ctx.partnerId, request.params.linkId, asRecord(request.body));
      const legacyLink = asRecord(legacyBody.link);
      const rawLink = await loadRawLink(String(legacyLink.id || request.params.linkId));
      return reply.send({
        ...legacyBody,
        link: normalizePromoterLink(legacyLink, {}, rawLink),
      });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.get('/partners/promoters/links/:linkId/analytics', {
    preHandler: [fastify.requireAuth],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'promoter');
      const [analytics, legacyBody] = await Promise.all([
        promoterService.getLinkAnalytics(ctx, request.params.linkId),
        getLegacyLinkAnalytics(ctx.partnerId, request.params.linkId),
      ]);
      const rawLink = await loadRawLink(request.params.linkId);
      const link = normalizePromoterLink(asRecord(legacyBody.link), {}, rawLink);
      const funnel = asRecord(legacyBody.funnel);
      return reply.header('Cache-Control', 'private, max-age=120').send({
        ...legacyBody,
        link,
        funnel: {
          clicks: toNumber(funnel.clicks ?? analytics?.clicks),
          conversions: toNumber(funnel.conversions ?? analytics?.conversions),
          revenue: toNumber(funnel.revenue ?? analytics?.revenue),
        },
        analytics,
        clicks: toNumber(analytics?.clicks ?? funnel.clicks),
        conversions: toNumber(analytics?.conversions ?? funnel.conversions),
        revenue: toNumber(analytics?.revenue ?? funnel.revenue),
        conversionRate: analytics?.conversionRate ?? 0,
        timeSeries: analytics?.timeSeries ?? [],
      });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  // ── Click tracking (public — no auth) ─────────────────────────────────────

  fastify.post('/partners/promoters/links/click', {
    preHandler: [fastify.validate({ body: TrackClickSchema })],
  }, async (request: any, reply: any) => {
    try {
      await promoterService.trackClick(request.body.code);
      return reply.send({ success: true });
    } catch {
      return reply.send({ success: true }); // never surface tracking errors to client
    }
  });

  // ── Events ─────────────────────────────────────────────────────────────────

  fastify.get('/partners/promoters/events', {
    preHandler: [
      fastify.validate({ querystring: EventsQuerySchema }),
      fastify.requireAuth,
    ],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'promoter');
      const filters = {
        cursor: request.query.cursor,
        limit: request.query.limit,
      };
      const [result, legacyEventsBody, legacyAssignments] = await Promise.all([
        promoterService.getEvents(ctx, filters),
        getLegacyEvents(ctx.partnerId, request.query),
        buildLegacyAssignments(ctx.partnerId, request.query.status),
      ]);
      return reply.header('Cache-Control', 'private, max-age=60').send({
        ...legacyEventsBody,
        assignments: legacyAssignments,
        events: asArray(legacyEventsBody.events),
        data: asArray(result.data),
        hasMore: Boolean(result.hasMore),
        nextCursor: result.nextCursor ?? null,
      });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  // ── Connections ────────────────────────────────────────────────────────────

  fastify.get('/partners/promoters/connections', {
    preHandler: [
      fastify.validate({ querystring: ConnectionsQuerySchema }),
      fastify.requireAuth,
    ],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'promoter');
      const [connections, legacyBody] = await Promise.all([
        promoterService.getConnections(ctx, request.query.status as any),
        getLegacyConnections(ctx.partnerId, request.query.status as any),
      ]);
      const unifiedById = mapByAnyId(asArray(connections), ['connectionId', 'id']);
      const mergedConnections = asArray(legacyBody.connections).map((connection: PlainRecord) => (
        normalizePromoterConnection(connection, unifiedById.get(String(connection.id || '')))
      ));
      return reply.header('Cache-Control', 'private, max-age=60').send({
        ...legacyBody,
        connections: mergedConnections,
      });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.post('/partners/promoters/connections/request', {
    preHandler: [
      fastify.validate({ body: ConnectionRequestSchema }),
      fastify.requireAuth,
    ],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'promoter');
      const legacyBody = await createLegacyConnection(ctx.partnerId, asRecord(request.body));
      const rawConnection = await loadRawConnection(String(asRecord(legacyBody.connection).id || ''));
      return reply.status(201).send({
        ...legacyBody,
        connection: normalizePromoterConnection(asRecord(legacyBody.connection), {}, rawConnection),
      });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.patch('/partners/promoters/connections/:connectionId', {
    preHandler: [
      fastify.validate({ body: ConnectionRespondSchema }),
      fastify.requireAuth,
    ],
  }, async (request: any, reply: any) => {
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));

    try {
      requireType(ctx, 'promoter');
      const legacyBody = await updateLegacyConnection(ctx.partnerId, request.params.connectionId, asRecord(request.body));
      const rawConnection = await loadRawConnection(request.params.connectionId);
      return reply.send({
        ...legacyBody,
        connection: normalizePromoterConnection({}, {}, rawConnection),
      });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  // ── Native parity dispatch ────────────────────────────────────────────────

  fastify.route({
    method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    url: '/partners/promoters/*',
    preHandler: [fastify.requireAuth],
    handler: async (request: any, reply: any) => {
      try {
        const ctx = await requirePromoterContext(request, reply);
        if (!ctx) return;

        const rest = String(request.params?.['*'] || '').replace(/^\/+/, '');
        if (!rest) {
          return reply.status(404).send(buildErrorResponse({
            code: 'NOT_FOUND',
            message: 'Partner promoter endpoint not found',
            requestId: request.id,
          }));
        }

        const query = asRecord(request.query);
        const body = asRecord(request.body);

        if (rest === 'profile' && request.method === 'GET') return reply.send(await getPromoterProfile(ctx.partnerId));
        if (rest === 'profile' && request.method === 'PUT') return reply.send(await updatePromoterProfile(ctx.partnerId, body));
        if (rest === 'guests' && request.method === 'GET') return reply.send(await resolvePromoterGuests(ctx.partnerId, Math.min(parseInt(String(query.limit || '20'), 10) || 20, 100)));
        if (rest === 'finance' && request.method === 'GET') return reply.send(await buildPromoterFinancePayload(ctx.partnerId));
        if (rest === 'payouts' && request.method === 'GET') return reply.send(await buildPromoterFinancePayload(ctx.partnerId));
        if (rest === 'finance/bank-accounts' && request.method === 'GET') {
          const accounts = await financeService.getBankAccounts({ partnerId: ctx.partnerId, uid: ctx.uid, type: 'promoter', roles: ctx.roles, venueIds: [], displayName: ctx.displayName });
          return reply.send({ accounts: accounts.map((account) => ({ id: account.accountId, bankName: account.bankName || 'Bank Account', last4: account.last4 || '0000', isDefault: account.isDefault ?? false, paymentType: account.paymentType || 'bank_account' })) });
        }
        if (rest === 'finance/bank-accounts' && request.method === 'POST') return reply.status(201).send(await createBankAccount(ctx.partnerId, body));
        if (rest === 'finance/bank-accounts' && request.method === 'DELETE') return reply.send(await deleteBankAccount(ctx.partnerId, String(query.accountId || body.accountId || '')));

        // notifications
        if (rest === 'notifications' && request.method === 'GET') {
          const snap = await fastify.db.collection('notifications').where('recipientId', '==', ctx.partnerId).limit(100).get().catch(() => ({ docs: [] as any[] }));
          const notifications = ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
          notifications.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          return reply.send({ notifications: notifications.slice(0, 50) });
        }

        // commissions
        if (rest === 'commissions' && request.method === 'GET') {
          const snap = await fastify.db.collection('promoter_commissions').where('promoterId', '==', ctx.partnerId).limit(100).get().catch(() => ({ docs: [] as any[] }));
          const commissions = ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
          commissions.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          return reply.send({ commissions });
        }

        // stats (aggregate, no id)
        if (rest === 'stats' && request.method === 'GET') {
          const [linksSnap, connectionsSnap, eventsSnap] = await Promise.all([
            fastify.db.collection('promoter_links').where('promoterId', '==', ctx.partnerId).get().catch(() => ({ docs: [] as any[], size: 0 })),
            fastify.db.collection('promoter_connections').where('promoterId', '==', ctx.partnerId).where('status', '==', 'active').get().catch(() => ({ docs: [] as any[], size: 0 })),
            fastify.db.collection('events').where('promoterId', '==', ctx.partnerId).get().catch(() => ({ docs: [] as any[], size: 0 })),
          ]);
          const allLinkDocs = (linksSnap as any).docs || [];
          const activeLinks = allLinkDocs.filter((d: any) => d.data().isActive !== false).length;
          const totalClicks = allLinkDocs.reduce((s: number, d: any) => s + (d.data().clicks || 0), 0);
          const totalConversions = allLinkDocs.reduce((s: number, d: any) => s + (d.data().conversions || 0), 0);
          const totalEarnings = allLinkDocs.reduce((s: number, d: any) => s + (d.data().totalEarnings || d.data().earnings || 0), 0);
          return reply.send({ links: (linksSnap as any).size || 0, activeLinks, activeConnections: (connectionsSnap as any).size || 0, events: (eventsSnap as any).size || 0, totalClicks, totalConversions, totalSales: totalConversions, totalEarnings, conversionRate: totalClicks > 0 ? Math.round((totalConversions / totalClicks) * 100) : 0 });
        }

        // payouts POST (request payout) / DELETE (cancel payout)
        if (rest === 'payouts' && request.method === 'POST') {
          const now = new Date().toISOString();
          const ref = await fastify.db.collection('payout_requests').add({ promoterId: ctx.partnerId, amountPaise: body.amountPaise || 0, bankAccountId: body.bankAccountId || null, status: 'pending', requestedAt: now, createdAt: now });
          return reply.send({ success: true, id: ref.id });
        }
        if (rest === 'payouts' && request.method === 'DELETE') {
          const payoutId = String(query.payoutId || body.payoutId || '');
          if (!payoutId) return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'payoutId required', requestId: request.id }));
          const ref = fastify.db.collection('payout_requests').doc(payoutId);
          const doc = await ref.get();
          if (!doc.exists) return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Payout request not found', requestId: request.id }));
          if ((doc.data() as any).promoterId !== ctx.partnerId) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'Not your payout request', requestId: request.id }));
          await ref.update({ status: 'cancelled', cancelledAt: new Date().toISOString() });
          return reply.send({ success: true });
        }

        // upload (profile image / cover)
        if (rest === 'upload' && request.method === 'POST') {
          const fieldName = String(body.field || 'profileImage');
          const url = String(body.url || '');
          if (!url) return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'url required', requestId: request.id }));
          const allowed = ['profileImage', 'coverImage', 'logoUrl'];
          if (!allowed.includes(fieldName)) return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'field must be one of: ' + allowed.join(', '), requestId: request.id }));
          await fastify.db.collection('promoters').doc(ctx.partnerId).set({ [fieldName]: url, updatedAt: new Date().toISOString() }, { merge: true });
          return reply.send({ success: true, [fieldName]: url });
        }

        // partners/:id — get a specific partner (venue or host) by id
        const partnerByIdMatch = rest.match(/^partners\/([^/]+)$/);
        if (partnerByIdMatch && request.method === 'GET') {
          const partnerId = partnerByIdMatch[1];
          const [venueDoc, hostDoc] = await Promise.all([
            fastify.db.collection('venues').doc(partnerId).get().catch(() => null),
            fastify.db.collection('hosts').doc(partnerId).get().catch(() => null),
          ]);
          if (venueDoc && venueDoc.exists) return reply.send({ partner: { id: venueDoc.id, type: 'venue', ...(venueDoc.data() || {}) } });
          if (hostDoc && hostDoc.exists) return reply.send({ partner: { id: hostDoc.id, type: 'host', ...(hostDoc.data() || {}) } });
          return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Partner not found', requestId: request.id }));
        }

        // settings/*
        if (rest === 'settings' && request.method === 'GET') {
          const doc = await fastify.db.collection('promoters').doc(ctx.partnerId).get().catch(() => null);
          const data = doc && doc.exists ? doc.data() || {} : {};
          return reply.send({ settings: { notificationsEnabled: data.notificationsEnabled ?? true, marketingEmails: data.marketingEmails ?? true, twoFactorEnabled: data.twoFactorEnabled ?? false, language: data.language || 'en', timezone: data.timezone || 'Asia/Kolkata' } });
        }

        if (rest === 'settings/identity' && (request.method === 'PUT' || request.method === 'PATCH')) {
          const allowed = ['displayName', 'bio', 'instagramHandle', 'twitterHandle', 'website', 'city', 'genres'];
          const patch: Record<string, any> = {};
          for (const k of allowed) if (body[k] !== undefined) patch[k] = body[k];
          patch.updatedAt = new Date().toISOString();
          await fastify.db.collection('promoters').doc(ctx.partnerId).set(patch, { merge: true });
          return reply.send({ success: true });
        }

        if (rest === 'settings/notifications' && request.method === 'PATCH') {
          const patch: Record<string, any> = { updatedAt: new Date().toISOString() };
          if (body.notificationsEnabled !== undefined) patch.notificationsEnabled = body.notificationsEnabled;
          if (body.marketingEmails !== undefined) patch.marketingEmails = body.marketingEmails;
          await fastify.db.collection('promoters').doc(ctx.partnerId).set(patch, { merge: true });
          return reply.send({ success: true });
        }

        if (rest === 'settings/payout' && request.method === 'GET') {
          const snap = await fastify.db.collection('bank_accounts').where('ownerId', '==', ctx.partnerId).where('ownerType', '==', 'promoter').get().catch(() => ({ docs: [] as any[] }));
          return reply.send({ accounts: ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}), accountNumber: undefined })) });
        }
        if (rest === 'settings/payout' && request.method === 'POST') {
          const account = buildPayoutAccountRecord(body, { partnerId: ctx.partnerId, ownerType: 'promoter' });
          const ref = await fastify.db.collection('bank_accounts').add(account.record);
          return reply.send({ success: true, id: ref.id, account: account.response(ref.id).account });
        }

        if (rest === 'settings/security/logout-all' && request.method === 'POST') {
          await (fastify as any).firebaseAdmin.auth().revokeRefreshTokens(ctx.uid).catch(() => {});
          return reply.send({ success: true });
        }

        if (rest === 'settings/verification' && request.method === 'GET') {
          const doc = await fastify.db.collection('promoter_verifications').doc(ctx.partnerId).get().catch(() => null);
          return reply.send({ verification: doc && doc.exists ? doc.data() || {} : { status: 'unverified', submittedAt: null } });
        }
        if (rest === 'settings/verification' && request.method === 'POST') {
          await fastify.db.collection('promoter_verifications').doc(ctx.partnerId).set({ ...body, promoterId: ctx.partnerId, status: 'pending', submittedAt: new Date().toISOString() }, { merge: true });
          return reply.send({ success: true });
        }

        return reply.status(404).send(buildErrorResponse({
          code: 'NOT_FOUND',
          message: 'Partner promoter endpoint not found',
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
