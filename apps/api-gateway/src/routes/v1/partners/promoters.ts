import type { FastifyInstance } from 'fastify';
import { AggregateField } from 'firebase-admin/firestore';
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

const PaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
}).passthrough();

const BankAccountSchema = z.object({
  bankName: z.string().min(1),
  accountNumber: z.string().min(1),
  ifsc: z.string().min(1),
  accountHolderName: z.string().min(1),
  accountType: z.string().optional(),
}).passthrough();

const PayoutRequestSchema = z.object({
  amountPaise: z.coerce.number().min(100), // Min 1 INR
  bankAccountId: z.string().min(1),
}).passthrough();

const UploadSchema = z.object({
  field: z.enum(['profileImage', 'coverImage', 'logoUrl']),
  url: z.string().url(),
}).passthrough();

const UpdateIdentitySchema = z.object({
  displayName: z.string().optional(),
  bio: z.string().optional(),
  instagramHandle: z.string().optional(),
  twitterHandle: z.string().optional(),
  website: z.string().optional(),
  city: z.string().optional(),
  genres: z.array(z.string()).optional(),
}).passthrough();

const UpdateNotificationsSchema = z.object({
  notificationsEnabled: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
}).passthrough();

const SettingsVerificationSchema = z.object({
  documentType: z.string().optional(),
  documentUrl: z.string().optional(),
  legalName: z.string().optional(),
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
    let status = normalizeLegacyLinkStatus(link);
    const eventStatus = String(event.lifecycle || event.status || '').toLowerCase();
    
    if (status === 'active' && ['completed', 'ended', 'closed', 'finished'].includes(eventStatus)) {
      status = 'expired';
    }
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



  const createLegacyLink = async (promoterId: string, body: Record<string, any>) => {
    const eventId = String(body.eventId || '');
    if (!eventId) {
      const err: any = new Error('promoterId and eventId are required');
      err.statusCode = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }
    const assignmentSnap = await fastify.db.collection('promoter_assignments')
      .where('promoterId', '==', promoterId)
      .where('eventId', '==', eventId)
      .limit(1)
      .get();

    let assignment;
    const eventDoc = await fastify.db.collection('events').doc(eventId).get();
    
    if (!eventDoc.exists) {
      const err: any = new Error('Event not found');
      err.statusCode = 404; err.code = 'NOT_FOUND'; throw err;
    }

    const event: Record<string, any> = { id: eventDoc.id, ...(eventDoc.data() || {}) };
    
    const status = event.lifecycle || event.status || 'draft';
    if (status !== 'published' && status !== 'live') {
      const err: any = new Error('This event is not active or accepting promoters');
      err.statusCode = 403; err.code = 'FORBIDDEN'; throw err;
    }

    if (assignmentSnap.empty) {
      if (!isPromoterAllowedForEvent(event, promoterId)) {
        const err: any = new Error('Promoter is not assigned to this event');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
      // Auto-create assignment
      const assignmentRef = fastify.db.collection('promoter_assignments').doc();
      assignment = {
        id: assignmentRef.id,
        promoterId,
        eventId,
        status: 'active',
        commissionRate: event.promoterSettings?.commissionRate || event.commissionRate || 0,
        createdAt: new Date().toISOString(),
      };
      await assignmentRef.set(assignment);
    } else {
      assignment = assignmentSnap.docs[0].data();
    }

    const existingSnap = await fastify.db.collection('promoter_links')
      .where('promoterId', '==', promoterId)
      .where('eventId', '==', eventId)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (!existingSnap.empty) {
      const existing = { id: existingSnap.docs[0].id, ...(existingSnap.docs[0].data() || {}) };
      return { link: buildLegacyLink(existing, event), duplicate: true };
    }

    const promoterRef = fastify.db.collection('promoters').doc(promoterId);
    const promoterDoc = await promoterRef.get();
    let trackingCode = promoterDoc.exists ? promoterDoc.data()?.trackingCode : null;

    if (!trackingCode) {
      if (body.customTrackingCode) {
        const cleanCode = String(body.customTrackingCode).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanCode.length < 3) {
          const err: any = new Error('Custom code must be at least 3 characters');
          err.statusCode = 400; err.code = 'BAD_REQUEST'; throw err;
        }
        const existingGlobal = await fastify.db.collection('promoters').where('trackingCode', '==', cleanCode).limit(1).get();
        if (!existingGlobal.empty) {
          const err: any = new Error('This custom code is already taken. Please choose another.');
          err.statusCode = 409; err.code = 'CONFLICT'; throw err;
        }
        trackingCode = cleanCode;
      } else {
        const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
        let base = (body.promoterName || 'promo').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (base.length > 10) base = base.substring(0, 10);
        if (base.length < 3) base = 'promo';
        
        let isUnique = false;
        let newCode = '';
        while (!isUnique) {
          const suffix = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
          newCode = `${base}${suffix}`;
          const existingGlobal = await fastify.db.collection('promoters').where('trackingCode', '==', newCode).limit(1).get();
          if (existingGlobal.empty) {
            isUnique = true;
          }
        }
        trackingCode = newCode;
      }
      await promoterRef.set({ trackingCode }, { merge: true });
    }
    
    let code = trackingCode;
    
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
      commissionRate: normalizePromoterCommissionRate(assignment.commissionRate || event.promoterSettings?.commissionRate || event.commissionRate || 0),
      commissionType: pickString(body.commissionType, 'percentage'),
      code,
      clicks: 0,
      conversions: 0,
      revenue: 0,
      commission: 0,
      isActive: true,
      active: true,
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
      updates.active = false;
      updates.status = 'deactivated';
    } else if (action === 'reactivate') {
      updates.isActive = true;
      updates.active = true;
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



  const getLegacyEvents = async (promoterId: string, query: Record<string, any>) => {
    const pageSize = Math.min(parseInt(String(query.limit || '20'), 10) || 20, 100);
    
    let eventsQuery = fastify.db.collection('events')
      .where('promotersEnabled', '==', true)
      .where('status', 'in', ['published', 'active']);

    if (query.cursor) {
      const cursorDoc = await fastify.db.collection('events').doc(String(query.cursor)).get().catch(() => null);
      if (cursorDoc?.exists) {
        eventsQuery = eventsQuery.startAfter(cursorDoc);
      }
    }

    const [eventsSnap, linksSnap] = await Promise.all([
      eventsQuery.limit(pageSize * 2).get().catch(() => ({ docs: [] as any[] })),
      fastify.db.collection('promoter_links').where('promoterId', '==', promoterId).limit(200).get().catch(() => ({ docs: [] as any[] })),
    ]);

    const activeLinkByEventId = new Map<string, Record<string, any>>();
    for (const doc of (linksSnap as any).docs || []) {
      const link = { id: doc.id, ...(doc.data() || {}) } as Record<string, any>;
      if ((link.isActive !== false) && link.eventId && !activeLinkByEventId.has(String(link.eventId))) {
        activeLinkByEventId.set(String(link.eventId), link);
      }
    }

    const validEvents: Record<string, any>[] = [];
    let nextCursor: string | null = null;

    for (const doc of (eventsSnap as any).docs || []) {
      const event = { id: doc.id, ...(doc.data() || {}) };
      
      if (!isPromoterAllowedForEvent(event, promoterId)) continue;
      
      if (query.city) {
        const cityStr = pickString(event.city, event.cityName).toLowerCase();
        if (!cityStr.includes(String(query.city).trim().toLowerCase())) continue;
      }

      validEvents.push(event);
      nextCursor = doc.id;

      if (validEvents.length >= pageSize) break;
    }

    const events = validEvents.map((event) => buildLegacyPromoterEvent(event, activeLinkByEventId.get(String(event.id))));
    return { events, nextCursor: validEvents.length === pageSize ? nextCursor : null };
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
      let eventStatus = String(event.lifecycle || event.status || assignment.status || 'upcoming').toLowerCase();

      const startDateIso = String(event.startDate || event.date || event.eventDate || '');
      if (startDateIso && new Date(startDateIso) < new Date()) {
        eventStatus = 'completed';
      }

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
    
    const isSender = String(current.promoterId || current.fromPartnerId || '') === promoterId;
    const isTarget = String(current.targetId || current.toPartnerId || '') === promoterId;

    if (!isSender && !isTarget) {
      const err: any = new Error('Forbidden');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    if (isSender && ['approve', 'reject'].includes(action)) {
      const err: any = new Error('Sender cannot approve or reject their own request');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    if (isTarget && ['revoke'].includes(action)) {
      const err: any = new Error('Target cannot revoke a request they did not send');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
    await ref.update({ status: nextStatus, updatedAt: new Date().toISOString(), ...(body.reason ? { reason: String(body.reason) } : {}) });

    // Link Revocation Logic
    if (['revoked', 'blocked', 'rejected', 'removed'].includes(nextStatus)) {
      try {
        let eventIds: string[] = [];
        if (current.targetType === 'event') {
          eventIds = [String(current.targetId)];
        } else if (current.targetType === 'host' || current.targetType === 'venue') {
          const eventsSnap = await fastify.db.collection('events').where('hostId', '==', String(current.targetId)).get();
          eventIds = eventsSnap.docs.map((doc: any) => doc.id);
        }

        if (eventIds.length > 0) {
          // Deactivate all links for this promoter and these events
          const linksSnap = await fastify.db.collection('promoter_links').where('promoterId', '==', current.promoterId || current.fromPartnerId).get();
          const batch = fastify.db.batch();
          let count = 0;
          for (const linkDoc of linksSnap.docs) {
            const link = linkDoc.data() as any;
            if (eventIds.includes(String(link.eventId))) {
              batch.update(linkDoc.ref, {
                isActive: false,
                status: 'deactivated',
                revokedAt: new Date().toISOString()
              });
              count++;
            }
          }
          if (count > 0) {
            await batch.commit();
          }
        }
      } catch (e) {
        console.error('Failed to revoke promoter links:', e);
      }
    }

    return { success: true, status: nextStatus };
  };

  const resolvePromoterGuests = async (promoterId: string, limit: number, cursor?: string, status?: string, eventId?: string) => {
    const linksSnap = await fastify.db.collection('promoter_links').where('promoterId', '==', promoterId).get();
    const allCodes: string[] = linksSnap.docs.map((doc: any) => doc.data().code).filter(Boolean);
    if (allCodes.length === 0) return { guests: [], hasMore: false, nextCursor: null };

    // Firestore `in` query limits to 30 items
    const codes = allCodes.slice(0, 30);
    
    let query = fastify.db.collection('orders')
      .where('promoterCode', 'in', codes);
      
    if (eventId) {
      query = query.where('eventId', '==', eventId);
    }
    
    if (status === 'checked_in') {
      // Must have checkedInAt or be explicitly marked checked_in
      // For simplicity, if we filter by status we'll use the 'status' field.
      // Assuming 'checked_in' is a valid status string
      query = query.where('status', '==', 'checked_in');
    } else if (status === 'pending') {
      query = query.where('status', '==', 'confirmed');
    }

    query = query.orderBy('createdAt', 'desc').limit(limit + 1);

    if (cursor) {
      const cursorDoc = await fastify.db.collection('orders').doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snap = await query.get();
    const allDocs = snap.docs;
    const hasMore = allDocs.length > limit;
    const orderDocs = allDocs.slice(0, limit);

    const eventIds = [...new Set(orderDocs.map((d: any) => String(d.data().eventId || '')).filter(Boolean))];
    const eventSnaps = eventIds.length > 0 ? await Promise.all(eventIds.map((id) => fastify.db.collection('events').doc(id).get())) : [];
    const eventMap = new Map<string, string>();
    for (const doc of eventSnaps) {
      if (doc.exists) eventMap.set(doc.id, (doc.data() as any).title || (doc.data() as any).name || '');
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

    const ledgerEntries = asArray(ledger.data);
    const orderIds = [...new Set(ledgerEntries.map((e) => e.referenceId).filter(Boolean))];
    const eventIds = [...new Set(ledgerEntries.map((e) => e.eventId).filter(Boolean))];

    const orderMap = new Map<string, any>();
    const eventMap = new Map<string, string>();
    const userMap = new Map<string, any>();

    if (orderIds.length > 0) {
      const orderChunks = [];
      for (let i = 0; i < orderIds.length; i += 30) orderChunks.push(orderIds.slice(i, i + 30));
      for (const chunk of orderChunks) {
        const snap = await fastify.db.collection('orders').where('__name__', 'in', chunk).get();
        snap.forEach((doc: any) => orderMap.set(doc.id, doc.data()));
      }
    }

    const userIds = [...new Set(Array.from(orderMap.values()).map(o => o.buyerId || o.userId).filter(Boolean))];
    if (userIds.length > 0) {
      const userChunks = [];
      for (let i = 0; i < userIds.length; i += 30) userChunks.push(userIds.slice(i, i + 30));
      for (const chunk of userChunks) {
        const snap = await fastify.db.collection('users').where('__name__', 'in', chunk).get();
        snap.forEach((doc: any) => userMap.set(doc.id, doc.data()));
      }
    }

    if (eventIds.length > 0) {
      const eventChunks = [];
      for (let i = 0; i < eventIds.length; i += 30) eventChunks.push(eventIds.slice(i, i + 30));
      for (const chunk of eventChunks) {
        const snap = await fastify.db.collection('events').where('__name__', 'in', chunk).get();
        snap.forEach((doc: any) => eventMap.set(doc.id, doc.data().title || doc.data().name || 'Event'));
      }
    }

    return {
      balance: {
        totalEarned: toNumber(balances.available) + toNumber(balances.pending),
        available: toNumber(balances.available),
        pending: toNumber(balances.pending),
        totalPaid,
        instantAvailable: 0,
      },
      payouts: payoutRows,
      commissionDetails: ledgerEntries.map((entry: Record<string, any>) => {
        const order = entry.referenceId ? orderMap.get(entry.referenceId) : null;
        let eventName = entry.eventId ? eventMap.get(entry.eventId) : null;
        let buyerName = order?.guestName || order?.buyerName || null;
        const userId = order?.buyerId || order?.userId || null;
        const user = userId ? userMap.get(userId) : null;
        const buyerAvatar = user?.photoURL || user?.avatar || null;

        if (!eventName && order?.eventId && eventMap.has(order.eventId)) {
          eventName = eventMap.get(order.eventId) || null;
        }
        return {
          id: entry.entryId,
          eventId: entry.eventId || null,
          eventName: eventName || null,
          buyerName: buyerName || null,
          buyerAvatar: buyerAvatar || null,
          amount: toNumber(entry.amount),
          revenue: toNumber(entry.amount),
          status: String(entry.status || 'pending').toLowerCase(),
          date: entry.createdAt || null,
          source: 'partner_ledger',
        };
      }),
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

      const [result, assignmentsPayload] = await Promise.all([
        promoterService.getOverview(ctx),
        buildLegacyAssignments(ctx.partnerId, 'active'),
      ]);
      const assignments = asArray(assignmentsPayload);
      const topLinks = asArray(result.topLinks);
      
      const stats: PlainRecord = {
        ...asRecord(result.stats),
        earnings: toNumber(result.stats.totalCommissionEarned),
        clicks: toNumber(result.stats.totalClicks),
        conversions: toNumber(result.stats.totalConversions),
        payoutsPending: 0,
      };
      
      const topLinkData = topLinks[0] || null;
      const topLink = topLinkData
        ? {
            id: topLinkData.id || topLinkData.linkId,
            event: { name: topLinkData.eventTitle || 'Event' },
            eventName: topLinkData.eventTitle || 'Event',
            linkCode: topLinkData.code,
            attributedRevenue: toNumber(topLinkData.revenue),
            clicks: toNumber(topLinkData.clicks),
            conversions: toNumber(topLinkData.conversions),
            commission: toNumber(topLinkData.commissionRate || topLinkData.commission),
          }
        : null;

      const normalized = {
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
          rate: `${(toNumber(stats.conversionRate || result.stats.conversionRate || 0) * 100).toFixed(1)}%`,
          clicks: toNumber(stats.clicks),
          purchases: toNumber(stats.conversions),
        },
        topLink,
        leaderboardPosition: null,
        topLinks,
        recentActivity: asArray(result.recentActivity),
        activeLinks: toNumber(result.stats.totalLinks),
        upcomingEvents: assignments.length,
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
      const [result, overview] = await Promise.all([
        promoterService.getAnalytics(ctx, filters),
        promoterService.getOverview(ctx),
      ]);
      const stats = asRecord(overview.stats);
      
      const byLink = asArray(result.byLink);
      const timeline = asArray(result.timeSeries).map((point: PlainRecord) => ({
        date: point.date ?? point.label ?? null,
        clicks: toNumber(point.clicks ?? point.value),
        sales: toNumber(point.sales ?? point.conversions),
        revenue: toNumber(point.revenue ?? point.amount),
      }));
      const overviewPayload = {
        totalClicks: toNumber(stats.totalClicks),
        ticketsSold: toNumber(stats.totalConversions),
        revenue: toNumber(stats.totalRevenue),
        commission: toNumber(stats.totalCommissionEarned),
        conversionRate: `${(toNumber(stats.conversionRate) * 100).toFixed(1)}%`,
        activeLinks: asArray(overview.topLinks).filter((l: any) => l.active !== false).length,
        totalLinks: toNumber(stats.totalLinks),
      };
      const activities = asArray(overview.topLinks).slice(0, 8).map((link: any) => ({
        id: String(link.linkId || link.id || ''),
        type: 'link',
        title: link.eventTitle || 'Link activity',
        eventName: link.eventTitle || 'Event',
        linkCode: link.code || '',
        commission: toNumber(link.commissionRate),
        amount: toNumber(link.revenue),
        createdAt: link.updatedAt ?? link.createdAt ?? null,
      }));

      return reply.header('Cache-Control', 'private, max-age=120').send({
        overview: overviewPayload,
        timeline,
        topLinks: asArray(overview.topLinks),
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
      const unifiedById = mapByAnyId(asArray(result.data), ['linkId', 'id']);
      const links = asArray(result.data).map((link: any) => {
        const legacyFormat = {
          id: link.linkId,
          promoterId: ctx.partnerId,
          eventId: link.eventId,
          eventTitle: link.eventTitle || 'Event',
          code: link.code,
          isActive: link.active,
          status: link.status || (link.active ? 'active' : 'deactivated'),
          createdAt: link.createdAt,
          clicks: link.clicks || link.clickCount || 0,
          conversions: link.conversions || link.conversionCount || 0,
          revenue: link.revenue || 0,
          commission: link.commissionRate || link.commission || 0,
        };
        return normalizePromoterLink(legacyFormat, unifiedById.get(String(link.linkId || '')));
      });
      return reply.header('Cache-Control', 'private, max-age=60').send({
        links,
        data: links,
        hasMore: Boolean(result.hasMore),
        nextCursor: result.nextCursor ?? null,
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
      const analytics = await promoterService.getLinkAnalytics(ctx, request.params.linkId);
      if (!analytics) return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Link not found', requestId: request.id }));
      
      const linkData = analytics.link as any;
      const legacyFormat = {
        id: linkData.linkId,
        promoterId: ctx.partnerId,
        eventId: linkData.eventId,
        eventTitle: linkData.eventTitle || 'Event',
        code: linkData.code,
        isActive: linkData.active,
        status: linkData.status || (linkData.active ? 'active' : 'deactivated'),
        createdAt: linkData.createdAt,
        clicks: analytics.clicks,
        conversions: analytics.conversions,
        revenue: analytics.revenue,
        commission: linkData.commissionRate || linkData.commission || 0,
      };
      
      const rawLink = await loadRawLink(request.params.linkId);
      const link = normalizePromoterLink(legacyFormat, linkData, rawLink);
      
      return reply.header('Cache-Control', 'private, max-age=120').send({
        link,
        funnel: {
          clicks: analytics.clicks,
          conversions: analytics.conversions,
          revenue: analytics.revenue,
        },
        analytics,
        clicks: analytics.clicks,
        conversions: analytics.conversions,
        revenue: analytics.revenue,
        conversionRate: analytics.conversionRate,
        timeSeries: analytics.timeSeries,
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
        discoverCursor: legacyEventsBody.nextCursor ?? null,
      });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.get('/partners/promoters/events/:assignmentId', {
    preHandler: [fastify.requireAuth],
  }, async (request: any, reply: any) => {
    console.log(`[ROUTE HIT] /events/:assignmentId with ID: ${request.params.assignmentId}`);
    const ctx = await resolvePartnerContext(fastify.db, request);
    if (!ctx) {
      console.log(`[ROUTE HIT] No ctx found`);
      return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'No partner identity found', requestId: request.id }));
    }

    try {
      requireType(ctx, 'promoter');
      const assignments = await buildLegacyAssignments(ctx.partnerId);
      console.log(`[ROUTE HIT] assignments length: ${assignments.length}`);
      const assignment = assignments.find((a: any) => a.id === request.params.assignmentId);
      if (!assignment) {
        console.log(`[ROUTE HIT] assignment NOT FOUND in array. Array IDs:`, assignments.map((a: any) => a.id));
        return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Assignment not found', requestId: request.id }));
      }
      return reply.header('Cache-Control', 'private, max-age=60').send({
        assignment
      });
    } catch (err: any) {
      console.log(`[ROUTE HIT] Error:`, err);
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
      const connections = await promoterService.getConnections(ctx, request.query.status as any);
      const unifiedById = mapByAnyId(asArray(connections), ['connectionId', 'id']);
      const mergedConnections = asArray(connections).map((conn: any) => {
        const isSender = conn.fromPartnerId === ctx.partnerId;
        const targetId = isSender ? conn.toPartnerId : conn.fromPartnerId;
        const legacyFormat = {
          id: conn.connectionId,
          promoterId: ctx.partnerId,
          status: conn.status,
          targetId: targetId,
          otherId: targetId,
          targetName: 'Partner',
          otherName: 'Partner',
          targetType: 'venue',
          otherType: 'venue',
          createdAt: conn.createdAt || null,
          updatedAt: conn.updatedAt || null,
          message: '',
        };
        return normalizePromoterConnection(legacyFormat, unifiedById.get(String(conn.connectionId || '')));
      });
      return reply.header('Cache-Control', 'private, max-age=60').send({
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

  // ── Explicit Parity Routes ────────────────────────────────────────────────

  fastify.get('/partners/promoters/profile', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      return reply.send(await getPromoterProfile(ctx.partnerId));
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.put('/partners/promoters/profile', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      const body = UpdateIdentitySchema.parse(asRecord(request.body));
      return reply.send(await updatePromoterProfile(ctx.partnerId, body));
    } catch (err: any) {
      if (err instanceof z.ZodError) return reply.status(400).send(buildErrorResponse({ code: 'VALIDATION_ERROR', message: 'Invalid payload: ' + (err as any).errors[0]?.message, requestId: request.id }));
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.get('/partners/promoters/guests', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      const query = PaginationQuerySchema.parse(asRecord(request.query));
      const limit = Math.min(query.limit || 20, 100);
      return reply.send(await resolvePromoterGuests(ctx.partnerId, limit, query.cursor, query.status as string, query.eventId as string));
    } catch (err: any) {
      if (err instanceof z.ZodError) return reply.status(400).send(buildErrorResponse({ code: 'VALIDATION_ERROR', message: 'Invalid query parameters', requestId: request.id }));
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.get('/partners/promoters/finance', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      return reply.send(await buildPromoterFinancePayload(ctx.partnerId));
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.get('/partners/promoters/payouts', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      return reply.send(await buildPromoterFinancePayload(ctx.partnerId));
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.get('/partners/promoters/finance/bank-accounts', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      const accounts = await financeService.getBankAccounts({ partnerId: ctx.partnerId, uid: ctx.uid, type: 'promoter', roles: ctx.roles, venueIds: [], displayName: ctx.displayName });
      return reply.send({ accounts: accounts.map((account: any) => ({ id: account.accountId, bankName: account.bankName || 'Bank Account', last4: account.last4 || '0000', isDefault: account.isDefault ?? false, paymentType: account.paymentType || 'bank_account' })) });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.post('/partners/promoters/finance/bank-accounts', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      const body = BankAccountSchema.parse(asRecord(request.body));
      return reply.status(201).send(await createBankAccount(ctx.partnerId, body));
    } catch (err: any) {
      if (err instanceof z.ZodError) return reply.status(400).send(buildErrorResponse({ code: 'VALIDATION_ERROR', message: 'Invalid payload: ' + (err as any).errors[0]?.message, requestId: request.id }));
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.delete('/partners/promoters/finance/bank-accounts', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      const query = asRecord(request.query);
      const body = asRecord(request.body);
      return reply.send(await deleteBankAccount(ctx.partnerId, String(query.accountId || body.accountId || '')));
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.get('/partners/promoters/notifications', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      
      const query = PaginationQuerySchema.parse(asRecord(request.query));
      const limit = Math.min(query.limit || 50, 100);
      
      let q = fastify.db.collection('notifications')
        .where('recipientId', '==', ctx.partnerId)
        .orderBy('createdAt', 'desc')
        .limit(limit + 1);
        
      if (query.cursor) {
        const cursorDoc = await fastify.db.collection('notifications').doc(query.cursor).get();
        if (cursorDoc.exists) q = q.startAfter(cursorDoc);
      }
      
      const snap = await q.get().catch(() => ({ docs: [] as any[] }));
      const allDocs = snap.docs || [];
      const hasMore = allDocs.length > limit;
      const docsToReturn = allDocs.slice(0, limit);
      
      const notifications = docsToReturn.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
      const nextCursor = hasMore ? notifications[notifications.length - 1]?.id ?? null : null;
      
      return reply.send({ notifications, nextCursor, hasMore });
    } catch (err: any) {
      if (err instanceof z.ZodError) return reply.status(400).send(buildErrorResponse({ code: 'VALIDATION_ERROR', message: 'Invalid query parameters', requestId: request.id }));
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.get('/partners/promoters/commissions', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      
      const query = PaginationQuerySchema.parse(asRecord(request.query));
      const limit = Math.min(query.limit || 50, 100);
      
      let q = fastify.db.collection('promoter_commissions')
        .where('promoterId', '==', ctx.partnerId)
        .orderBy('createdAt', 'desc')
        .limit(limit + 1);
        
      if (query.cursor) {
        const cursorDoc = await fastify.db.collection('promoter_commissions').doc(query.cursor).get();
        if (cursorDoc.exists) q = q.startAfter(cursorDoc);
      }
      
      const snap = await q.get().catch(() => ({ docs: [] as any[] }));
      const allDocs = snap.docs || [];
      const hasMore = allDocs.length > limit;
      const docsToReturn = allDocs.slice(0, limit);
      
      const commissions = docsToReturn.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
      const nextCursor = hasMore ? commissions[commissions.length - 1]?.id ?? null : null;
      
      return reply.send({ commissions, nextCursor, hasMore });
    } catch (err: any) {
      if (err instanceof z.ZodError) return reply.status(400).send(buildErrorResponse({ code: 'VALIDATION_ERROR', message: 'Invalid query parameters', requestId: request.id }));
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.get('/partners/promoters/leaderboard', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      
      const timeframeQuery = request.query.timeframe ? String(request.query.timeframe).trim().toLowerCase() : 'all_time';
      const cityQuery = request.query.city ? String(request.query.city).trim().toLowerCase() : 'all';
      const cityFilter = cityQuery && cityQuery !== 'all' ? cityQuery : 'global';

      let periodType = 'all_time';
      let periodValue = 'all';

      if (timeframeQuery === 'month') {
        periodType = 'month';
        const d = new Date();
        periodValue = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      } else if (timeframeQuery === 'week') {
        periodType = 'week';
        const d = new Date();
        const d2 = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        const dayNum = d2.getUTCDay() || 7;
        d2.setUTCDate(d2.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d2.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d2.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        periodValue = `${d2.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
      }

      let statsSnap;
      if (periodType === 'all_time' && cityFilter === 'global') {
        statsSnap = await fastify.db.collection('promoter_stats')
          .orderBy('totalCommissionEarned', 'desc')
          .limit(20)
          .get();
      } else {
        statsSnap = await fastify.db.collection('leaderboard_stats')
          .where('periodType', '==', periodType)
          .where('periodValue', '==', periodValue)
          .where('city', '==', cityFilter)
          .orderBy('totalCommissionEarned', 'desc')
          .limit(20)
          .get();
      }

      const leaderboard = [];
      let rank = 1;
      let currentUserFound = false;

      for (const doc of statsSnap.docs) {
        const data = doc.data();
        const promoterId = data.promoterId || doc.id;
        const xpScore = Math.floor((data.totalCommissionEarned || 0) / 100);
        
        const promoterDoc = await fastify.db.collection('promoters').doc(promoterId).get();
        const profile = promoterDoc.data() || {};
        
        if (promoterId === ctx.partnerId) {
          currentUserFound = true;
        }

        leaderboard.push({
          promoterId,
          displayName: profile.displayName || profile.name || 'Unknown Promoter',
          avatarUrl: profile.avatarUrl || profile.photoURL || profile.profileImage || null,
          xpScore,
          rank
        });
        
        rank++;
      }

      let currentUserRank = null;
      if (!currentUserFound) {
        let currentUserStats;
        let higherScoresQuery: any;

        if (periodType === 'all_time' && cityFilter === 'global') {
          currentUserStats = await fastify.db.collection('promoter_stats').doc(ctx.partnerId).get();
          higherScoresQuery = fastify.db.collection('promoter_stats');
        } else {
          const docId = `${ctx.partnerId}_${periodType}_${periodValue}_${cityFilter}`;
          currentUserStats = await fastify.db.collection('leaderboard_stats').doc(docId).get();
          higherScoresQuery = fastify.db.collection('leaderboard_stats')
            .where('periodType', '==', periodType)
            .where('periodValue', '==', periodValue)
            .where('city', '==', cityFilter);
        }

        if (currentUserStats.exists) {
          const data = currentUserStats.data() || {};
          const xpScore = Math.floor((data.totalCommissionEarned || 0) / 100);

          const higherScoresSnap = await higherScoresQuery
            .where('totalCommissionEarned', '>', data.totalCommissionEarned || 0)
            .count()
            .get(); 
          
          const estimatedRank = higherScoresSnap.data().count + 1;
          
          const promoterDoc = await fastify.db.collection('promoters').doc(ctx.partnerId).get();
          const profile = promoterDoc.data() || {};
          
          currentUserRank = {
            promoterId: ctx.partnerId,
            displayName: profile.displayName || profile.name || 'Unknown Promoter',
            avatarUrl: profile.avatarUrl || profile.photoURL || profile.profileImage || null,
            xpScore,
            rank: estimatedRank
          };
        }
      }

      return reply.header('Cache-Control', 'public, max-age=60').send({ 
        success: true, 
        leaderboard,
        currentUserRank
      });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code, message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  // stats (aggregate, no id) optimized with Firestore Server-Side aggregations
  fastify.get('/partners/promoters/stats', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;

      const [linksCountSnap, activeConnectionsCountSnap, eventsCountSnap, linksAggregateSnap, activeLinksCountSnap] = await Promise.all([
        fastify.db.collection('promoter_links').where('promoterId', '==', ctx.partnerId).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
        fastify.db.collection('promoter_connections').where('promoterId', '==', ctx.partnerId).where('status', '==', 'active').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
        fastify.db.collection('events').where('promoterId', '==', ctx.partnerId).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
        fastify.db.collection('promoter_links').where('promoterId', '==', ctx.partnerId).aggregate({
            totalClicks: AggregateField.sum('clicks'),
            totalConversions: AggregateField.sum('conversions'),
            totalEarnings: AggregateField.sum('totalEarnings'),
            fallbackEarnings: AggregateField.sum('earnings')
        }).get().catch(() => ({ data: () => ({ totalClicks: 0, totalConversions: 0, totalEarnings: 0, fallbackEarnings: 0 }) })),
        fastify.db.collection('promoter_links').where('promoterId', '==', ctx.partnerId).where('isActive', '==', true).count().get().catch(() => ({ data: () => ({ count: 0 }) }))
      ]);

      const linksCount = linksCountSnap.data().count || 0;
      const activeConnectionsCount = activeConnectionsCountSnap.data().count || 0;
      const eventsCount = eventsCountSnap.data().count || 0;
      
      const aggData = linksAggregateSnap.data();
      const totalClicks = aggData.totalClicks || 0;
      const totalConversions = aggData.totalConversions || 0;
      // We sum both since previous logic did: `d.data().totalEarnings || d.data().earnings || 0`
      // For aggregations, we sum both and the schema should theoretically be normalized. 
      // If a document only has `earnings`, `totalEarnings` is 0 and vice versa. 
      const totalEarnings = (aggData.totalEarnings || 0) + (aggData.fallbackEarnings || 0);
      
      const activeLinksCount = activeLinksCountSnap.data().count || linksCount; // approximation if isActive not explicitly false

      return reply.send({
        links: linksCount,
        activeLinks: activeLinksCount,
        activeConnections: activeConnectionsCount,
        events: eventsCount,
        totalClicks,
        totalConversions,
        totalSales: totalConversions,
        totalEarnings,
        conversionRate: totalClicks > 0 ? Math.round((totalConversions / totalClicks) * 100) : 0
      });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.post('/partners/promoters/payouts', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      
      const body = PayoutRequestSchema.parse(asRecord(request.body));
      const amountPaise = body.amountPaise;

      const idempotencyKey = request.headers['x-idempotency-key'] as string;
      if (!idempotencyKey) return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'x-idempotency-key header is required', requestId: request.id }));

      const work = async () => {
        // Validate balance
        const promoterCtx = { partnerId: ctx.partnerId, uid: ctx.uid, type: 'promoter' as const, roles: [], venueIds: [], displayName: ctx.displayName || 'Promoter' };
        const balances = await financeService.getBalances(promoterCtx);
        if (amountPaise > balances.availableBalance) {
          throw Object.assign(new Error('Insufficient balance'), { statusCode: 400, code: 'INSUFFICIENT_FUNDS' });
        }

        const now = new Date().toISOString();
        const ref = fastify.db.collection('payout_requests').doc();
        
        const batch = fastify.db.batch();
        batch.set(ref, { 
          promoterId: ctx.partnerId, 
          amountPaise, 
          bankAccountId: body.bankAccountId || null, 
          status: 'pending', 
          requestedAt: now, 
          createdAt: now 
        });

        const auditRef = fastify.db.collection('promoter_audit_logs').doc();
        batch.set(auditRef, {
          promoterId: ctx.partnerId,
          action: 'PAYOUT_REQUESTED',
          targetId: ref.id,
          amountPaise,
          timestamp: now,
          performedBy: ctx.uid
        });

        await batch.commit();
        return { success: true, id: ref.id };
      };

      let result;
      if (fastify.idempotencyService?.executeOnce) {
        result = await fastify.idempotencyService.executeOnce(idempotencyKey, ctx.uid, work);
        if (result.cached) return reply.send(result.body);
      } else {
        result = await work();
      }

      return reply.send(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) return reply.status(400).send(buildErrorResponse({ code: 'VALIDATION_ERROR', message: 'Invalid payload: ' + (err as any).errors[0]?.message, requestId: request.id }));
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.delete('/partners/promoters/payouts', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      const query = asRecord(request.query);
      const body = asRecord(request.body);
      const payoutId = String(query.payoutId || body.payoutId || '');
      if (!payoutId) return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'payoutId required', requestId: request.id }));
      const ref = fastify.db.collection('payout_requests').doc(payoutId);
      const doc = await ref.get();
      if (!doc.exists) return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Payout request not found', requestId: request.id }));
      if ((doc.data() as any).promoterId !== ctx.partnerId) return reply.status(403).send(buildErrorResponse({ code: 'FORBIDDEN', message: 'Not your payout request', requestId: request.id }));
      await ref.update({ status: 'cancelled', cancelledAt: new Date().toISOString() });
      return reply.send({ success: true });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.post('/partners/promoters/upload', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      const body = UploadSchema.parse(asRecord(request.body));
      const fieldName = String(body.field || 'profileImage');
      const url = String(body.url || '');
      if (!url) return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'url required', requestId: request.id }));
      const allowed = ['profileImage', 'coverImage', 'logoUrl'];
      if (!allowed.includes(fieldName)) return reply.status(400).send(buildErrorResponse({ code: 'BAD_REQUEST', message: 'field must be one of: ' + allowed.join(', '), requestId: request.id }));
      await fastify.db.collection('promoters').doc(ctx.partnerId).set({ [fieldName]: url, updatedAt: new Date().toISOString() }, { merge: true });
      return reply.send({ success: true, [fieldName]: url });
    } catch (err: any) {
      if (err instanceof z.ZodError) return reply.status(400).send(buildErrorResponse({ code: 'VALIDATION_ERROR', message: 'Invalid payload: ' + (err as any).errors[0]?.message, requestId: request.id }));
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.get('/partners/promoters/partners/:id', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      const partnerId = String(request.params.id || '');
      const [venueDoc, hostDoc] = await Promise.all([
        fastify.db.collection('venues').doc(partnerId).get().catch(() => null),
        fastify.db.collection('hosts').doc(partnerId).get().catch(() => null),
      ]);
      if (venueDoc && venueDoc.exists) return reply.send({ partner: { id: venueDoc.id, type: 'venue', ...(venueDoc.data() || {}) } });
      if (hostDoc && hostDoc.exists) return reply.send({ partner: { id: hostDoc.id, type: 'host', ...(hostDoc.data() || {}) } });
      return reply.status(404).send(buildErrorResponse({ code: 'NOT_FOUND', message: 'Partner not found', requestId: request.id }));
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.get('/partners/promoters/settings', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      const doc = await fastify.db.collection('promoters').doc(ctx.partnerId).get().catch(() => null);
      const data = doc && doc.exists ? doc.data() || {} : {};
      return reply.send({ settings: { notificationsEnabled: data.notificationsEnabled ?? true, marketingEmails: data.marketingEmails ?? true, twoFactorEnabled: data.twoFactorEnabled ?? false, language: data.language || 'en', timezone: data.timezone || 'Asia/Kolkata' } });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.route({
    method: ['PUT', 'PATCH'],
    url: '/partners/promoters/settings/identity',
    preHandler: [fastify.requireAuth],
    handler: async (request: any, reply: any) => {
      try {
        const ctx = await requirePromoterContext(request, reply);
        if (!ctx) return;
        const body = UpdateIdentitySchema.parse(asRecord(request.body));
        const allowed = ['displayName', 'bio', 'instagramHandle', 'twitterHandle', 'website', 'city', 'genres'];
        const patch: Record<string, any> = {};
        for (const k of allowed) if (body[k] !== undefined) patch[k] = body[k];
        patch.updatedAt = new Date().toISOString();
        await fastify.db.collection('promoters').doc(ctx.partnerId).set(patch, { merge: true });
        return reply.send({ success: true });
      } catch (err: any) {
        if (err instanceof z.ZodError) return reply.status(400).send(buildErrorResponse({ code: 'VALIDATION_ERROR', message: 'Invalid payload: ' + (err as any).errors[0]?.message, requestId: request.id }));
        if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
        return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
      }
    }
  });

  fastify.patch('/partners/promoters/settings/notifications', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      const body = UpdateNotificationsSchema.parse(asRecord(request.body));
      const patch: Record<string, any> = { updatedAt: new Date().toISOString() };
      if (body.notificationsEnabled !== undefined) patch.notificationsEnabled = body.notificationsEnabled;
      if (body.marketingEmails !== undefined) patch.marketingEmails = body.marketingEmails;
      await fastify.db.collection('promoters').doc(ctx.partnerId).set(patch, { merge: true });
      return reply.send({ success: true });
    } catch (err: any) {
      if (err instanceof z.ZodError) return reply.status(400).send(buildErrorResponse({ code: 'VALIDATION_ERROR', message: 'Invalid payload: ' + (err as any).errors[0]?.message, requestId: request.id }));
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.get('/partners/promoters/settings/payout', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      const snap = await fastify.db.collection('bank_accounts').where('ownerId', '==', ctx.partnerId).where('ownerType', '==', 'promoter').get().catch(() => ({ docs: [] as any[] }));
      return reply.send({ accounts: ((snap as any).docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}), accountNumber: undefined })) });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.post('/partners/promoters/settings/payout', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      const body = BankAccountSchema.parse(asRecord(request.body));
      const account = buildPayoutAccountRecord(body, { partnerId: ctx.partnerId, ownerType: 'promoter' });
      const ref = await fastify.db.collection('bank_accounts').add(account.record);
      return reply.send({ success: true, id: ref.id, account: account.response(ref.id).account });
    } catch (err: any) {
      if (err instanceof z.ZodError) return reply.status(400).send(buildErrorResponse({ code: 'VALIDATION_ERROR', message: 'Invalid payload: ' + (err as any).errors[0]?.message, requestId: request.id }));
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.post('/partners/promoters/settings/security/logout-all', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      await (fastify as any).firebaseAdmin.auth().revokeRefreshTokens(ctx.uid).catch(() => {});
      return reply.send({ success: true });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.get('/partners/promoters/settings/verification', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      const doc = await fastify.db.collection('promoter_verifications').doc(ctx.partnerId).get().catch(() => null);
      return reply.send({ verification: doc && doc.exists ? doc.data() || {} : { status: 'unverified', submittedAt: null } });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });

  fastify.post('/partners/promoters/settings/verification', { preHandler: [fastify.requireAuth] }, async (request: any, reply: any) => {
    try {
      const ctx = await requirePromoterContext(request, reply);
      if (!ctx) return;
      const body = SettingsVerificationSchema.parse(asRecord(request.body));
      await fastify.db.collection('promoter_verifications').doc(ctx.partnerId).set({ ...body, promoterId: ctx.partnerId, status: 'pending', submittedAt: new Date().toISOString() }, { merge: true });
      return reply.send({ success: true });
    } catch (err: any) {
      if (err instanceof z.ZodError) return reply.status(400).send(buildErrorResponse({ code: 'VALIDATION_ERROR', message: 'Invalid payload: ' + (err as any).errors[0]?.message, requestId: request.id }));
      if (err.statusCode) return reply.status(err.statusCode).send(buildErrorResponse({ code: err.code || 'FORBIDDEN', message: err.message, requestId: request.id }));
      return reply.status(500).send(buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id }));
    }
  });
}
