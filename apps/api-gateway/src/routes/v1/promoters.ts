import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { manageConnection, generatePromoterLink, getPromoterStats, listConnections, trackPromoterLinkClick } from '@c1rcle/core/promoter-engine';
import { z } from 'zod';
import { normalizePromoterCommissionRate } from '../../lib/partner-hardening.js';

const ConnectionsQuery = z.object({
    entityId: z.string(),
    entityType: z.string(),
    status: z.string().optional()
}).strict();

const ConnectBody = z.object({
    action: z.string()
}).catchall(z.any());

const PromoterIdParam = z.object({ id: z.string() }).strict();

const LinksBody = z.object({
    promoterId: z.string(),
    eventId: z.string()
}).strict();

const GuestPromoterLinkClickBody = z.object({
    code: z.string(),
    source: z.string().optional()
}).strict();
const ALLOWED_PROMOTER_PROFILE_FIELDS = [
    'displayName',
    'name',
    'handle',
    'avatarUrl',
    'photoURL',
    'profileImage',
    'phone',
    'contactPhone',
    'instagram',
    'bio',
    'summary',
    'city',
    'isPublic',
    'socialLinks',
    'website',
];

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

function pickString(...values: any[]) {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
}

function toNumber(value: any) {
    const amount = Number(value || 0);
    return Number.isFinite(amount) ? amount : 0;
}

function isPromoterAllowedForEvent(event: Record<string, any>, promoterId: string) {
    const globallyEnabled = event?.promotersEnabled === true || event?.promoterSettings?.enabled === true;
    if (!globallyEnabled) return false;
    const allowedIds = Array.isArray(event?.promoterSettings?.allowedPromoterIds)
        ? event.promoterSettings.allowedPromoterIds.map((value: any) => String(value))
        : [];
    return allowedIds.length === 0 || allowedIds.includes(String(promoterId));
}

function normalizeLinkStatus(link: Record<string, any>) {
    const explicit = String(link.status || '').toLowerCase();
    if (explicit) return explicit;
    return link.isActive === false ? 'deactivated' : 'active';
}

function buildLegacyLink(link: Record<string, any>, event: Record<string, any> = {}) {
    const clicks = toNumber(link.clicks ?? link.clickCount);
    const conversions = toNumber(link.conversions ?? link.conversionCount);
    const status = normalizeLinkStatus(link);

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
}

async function loadEventsByIds(fastify: FastifyInstance, eventIds: string[]) {
    const uniqueIds = Array.from(new Set(eventIds.filter(Boolean)));
    const docs = await Promise.all(uniqueIds.map((eventId) => fastify.db.collection('events').doc(eventId).get()));
    return docs.reduce((map, doc) => {
        if (doc.exists) map.set(doc.id, { id: doc.id, ...(doc.data() || {}) });
        return map;
    }, new Map<string, Record<string, any>>());
}

function buildLegacyPromoterEvent(event: Record<string, any>, activeLink?: Record<string, any>) {
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
}

export default async function promoterRoutes(fastify: FastifyInstance) {
    /**
     * GET /api/v1/promoters/connections
     * Lists connections for a promoter or venue
     */
    fastify.get('/connections', {
        preHandler: [fastify.validate({ querystring: ConnectionsQuery })]
    }, async (request, reply) => {
        const { entityId, entityType, status } = request.query as { entityId: string, entityType: string, status?: string };

        try {
            const connections = await listConnections(entityId, entityType, status);
            return connections;
        } catch (error: any) {
            reply.status(500).send({ error: "Internal server error" });
        }
    });

    /**
     * POST /api/v1/promoters/connect
     * Requests or manages a partnership connection
     */
    fastify.post('/connect', {
        preHandler: [fastify.validate({ body: ConnectBody })]
    }, async (request, reply) => {
        const { action, ...data } = request.body as any;

        try {
            const result = await manageConnection(action, {
                ...data,
                actor: (request as any).user
            });
            return result;
        } catch (error: any) {
            reply.status(400).send({ error: "Request failed" });
        }
    });

    /**
     * GET /api/v1/promoters/stats/:id
     * Gets conversion stats for a promoter
     */
    fastify.get('/stats/:id', {
        preHandler: [fastify.validate({ params: PromoterIdParam })]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        try {
            const stats = await getPromoterStats(id);
            return stats;
        } catch (error: any) {
            reply.status(500).send({ error: "Internal server error" });
        }
    });

    fastify.get('/partner/promoter/profile', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { promoterId } = request.query as any;
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        await fastify.verifyPartnerAccess(request, promoterId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });

        const doc = await fastify.db.collection('promoters').doc(promoterId).get();
        if (!doc.exists) {
            return { profile: { id: promoterId } };
        }

        return { profile: { id: doc.id, ...doc.data() } };
    });

    fastify.put('/partner/promoter/profile', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const body = (request.body || {}) as Record<string, any>;
        const promoterId = String(body.promoterId || '');
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        await fastify.verifyPartnerAccess(request, promoterId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });

        const patch: Record<string, any> = { updatedAt: new Date().toISOString() };
        for (const field of ALLOWED_PROMOTER_PROFILE_FIELDS) {
            if (body[field] !== undefined) patch[field] = body[field];
        }
        if (patch.displayName && patch.name === undefined) patch.name = patch.displayName;

        await fastify.db.collection('promoters').doc(promoterId).set(patch, { merge: true });
        const doc = await fastify.db.collection('promoters').doc(promoterId).get();
        return { profile: { id: doc.id, ...doc.data() } };
    });

    /**
     * GET /api/v1/partner/promoter/overview
     * Dashboard overview for promoters
     */
    fastify.get('/partner/promoter/overview', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { promoterId } = request.query as any;
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        
        await fastify.verifyPartnerAccess(request, promoterId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        
        try {
            const cacheKey = `overview:${promoterId}`;
            const cached = await fastify.cache.get('promoter', cacheKey);
            if (cached) {
                return reply.header('Cache-Control', 'private, max-age=120').send(cached);
            }

            // Fetch stats, active links, and upcoming events
            const [stats, linksSnap] = await Promise.all([
                getPromoterStats(promoterId).catch(() => ({ totalEarnings: 0, totalClicks: 0, totalConversions: 0 })),
                fastify.db.collection('promoter_links').where('promoterId', '==', promoterId).where('isActive', '==', true).get()
            ]);

            const links = linksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

            const payload = {
                stats: {
                    earnings: stats.totalEarnings || 0,
                    clicks: stats.totalClicks || 0,
                    conversions: stats.totalConversions || 0,
                    payoutsPending: 0
                },
                activeLinks: links.length,
                upcomingEvents: 0, // Placeholder
                recentActivity: []
            };
            await fastify.cache.set('promoter', cacheKey, payload, 120);
            return reply.header('Cache-Control', 'private, max-age=120').send(payload);
        } catch (error: any) {
            fastify.log.error(`Promoter overview error: ${error.message}`);
            return reply.status(500).send({ error: "Internal server error" });
        }
    });

    /**
     * GET /api/v1/promoter/stats
     * Used by dashboard links page
     */
    fastify.get('/stats', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { promoterId } = request.query as any;
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        
        try {
            const stats = await getPromoterStats(promoterId);
            return stats;
        } catch (error: any) {
            return { totalEarnings: 0, totalClicks: 0, totalConversions: 0 };
        }
    });

    fastify.post('/links', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { promoterId, eventId } = request.body as { promoterId: string, eventId: string };
        await fastify.verifyPartnerAccess(request, promoterId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });

        try {
            const link = await generatePromoterLink(promoterId, eventId);
            return link;
        } catch (error: any) {
            reply.status(500).send({ error: "Internal server error" });
        }
    });

    fastify.get('/promoter/links', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { promoterId, eventId, isActive, limit = '100' } = request.query as any;
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        await fastify.verifyPartnerAccess(request, promoterId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });

        const pageSize = Math.min(parseInt(limit, 10) || 100, 200);
        const snap = await fastify.db.collection('promoter_links')
            .where('promoterId', '==', promoterId)
            .limit(pageSize)
            .get();

        let links = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        if (eventId) links = links.filter((link: any) => String(link.eventId || '') === String(eventId));
        if (isActive !== undefined) {
            const active = String(isActive) === 'true';
            links = links.filter((link: any) => (link.isActive !== false) === active);
        }

        links.sort((left: any, right: any) => {
            const leftTime = new Date(toIso(left.createdAt) || 0).getTime();
            const rightTime = new Date(toIso(right.createdAt) || 0).getTime();
            return rightTime - leftTime;
        });

        const eventMap = await loadEventsByIds(fastify, links.map((link: any) => String(link.eventId || '')));
        return {
            links: links.map((link: any) => buildLegacyLink(link, eventMap.get(String(link.eventId || '')) || {})),
        };
    });

    fastify.post('/promoter/links', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const body = request.body as Record<string, any>;
        const promoterId = String(body.promoterId || '');
        const eventId = String(body.eventId || '');

        if (!promoterId || !eventId) {
            return reply.status(400).send({ error: 'promoterId and eventId are required' });
        }

        await fastify.verifyPartnerAccess(request, promoterId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });

        const existingSnap = await fastify.db.collection('promoter_links')
            .where('promoterId', '==', promoterId)
            .where('eventId', '==', eventId)
            .where('isActive', '==', true)
            .limit(1)
            .get();

        const eventDoc = await fastify.db.collection('events').doc(eventId).get();
        const event: Record<string, any> = eventDoc.exists ? { id: eventDoc.id, ...(eventDoc.data() || {}) } : { id: eventId };

        if (existingSnap.empty === false) {
            const existing = { id: existingSnap.docs[0].id, ...existingSnap.docs[0].data() };
            return {
                link: buildLegacyLink(existing, event),
                duplicate: true,
            };
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
        return reply.status(201).send({
            link: buildLegacyLink(link, event),
            duplicate: false,
        });
    });

    fastify.patch('/promoter/links/:id', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as Record<string, any>;
        const promoterId = String(body.promoterId || '');
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        await fastify.verifyPartnerAccess(request, promoterId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });

        const ref = fastify.db.collection('promoter_links').doc(id);
        const doc = await ref.get();
        if (!doc.exists) return reply.status(404).send({ error: 'Link not found' });

        const current = { id: doc.id, ...(doc.data() || {}) } as Record<string, any>;
        if (String(current.promoterId || '') !== promoterId) return reply.status(403).send({ error: 'Forbidden' });

        const action = String(body.action || '').toLowerCase();
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
            return reply.status(400).send({ error: 'Unsupported link action' });
        }

        await ref.update(updates);
        const updatedDoc = await ref.get();
        const updated: Record<string, any> = { id: updatedDoc.id, ...(updatedDoc.data() || {}) };
        const eventDoc = updated.eventId ? await fastify.db.collection('events').doc(String(updated.eventId)).get() : null;
        const event: Record<string, any> = eventDoc?.exists ? { id: eventDoc.id, ...(eventDoc.data() || {}) } : {};
        return {
            success: true,
            link: buildLegacyLink(updated, event),
        };
    });

    fastify.get('/promoter/links/:id/analytics', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { promoterId } = request.query as any;
        const { id } = request.params as { id: string };
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        await fastify.verifyPartnerAccess(request, promoterId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });

        const doc = await fastify.db.collection('promoter_links').doc(id).get();
        if (!doc.exists) return reply.status(404).send({ error: 'Link not found' });
        const link = { id: doc.id, ...(doc.data() || {}) } as Record<string, any>;
        if (String(link.promoterId || '') !== String(promoterId)) return reply.status(403).send({ error: 'Forbidden' });
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
    });

    /**
     * POST /api/v1/promoter/links/click
     * Preserves the legacy guest promoter-click contract behind Fastify ownership.
     */
    fastify.post('/promoter/links/click', {
        preHandler: [fastify.validate({ body: GuestPromoterLinkClickBody })]
    }, async (request, reply) => {
        const body = request.body as { code: string, source?: string };
        const code = typeof body?.code === 'string' ? body.code.trim() : '';

        if (!code) {
            return reply.status(400).send({ error: 'code is required' });
        }

        try {
            const result = await trackPromoterLinkClick(code, {
                source: body?.source || 'guest-portal',
            });

            if (result.status === 'unavailable') {
                return reply.status(503).send({ success: false, reason: 'firebase_not_configured' });
            }

            if (result.status === 'inactive') {
                return reply.status(404).send({ error: 'Link not active' });
            }

            if (result.status !== 'ok' || !result.linkId) {
                return reply.status(404).send({ error: 'Link not found' });
            }

            return { success: true, linkId: result.linkId };
        } catch (error: any) {
            fastify.log.error({ requestId: request.id, code, error: error?.message }, 'POST /promoter/links/click failed');
            return reply.status(500).send({ error: 'Failed to record click' });
        }
    });

    // ── Promoter Analytics ────────────────────────────────────────────────────

    fastify.get('/partner/promoter/analytics', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { promoterId } = request.query as any;
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        await fastify.verifyPartnerAccess(request, promoterId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        try {
            const searchParams = new URLSearchParams(request.query as Record<string, string>);
            const cacheKey = `analytics:${promoterId}:${searchParams.toString()}`;
            const cached = await fastify.cache.get('promoter', cacheKey);
            if (cached) {
                return reply.header('Cache-Control', 'private, max-age=120').send(cached);
            }

            const stats = await getPromoterStats(promoterId);
            const payload = {
                clicks: stats.totalClicks || 0,
                conversions: stats.totalConversions || 0,
                earnings: stats.totalEarnings || 0,
                conversionRate: stats.totalClicks > 0
                    ? parseFloat(((stats.totalConversions / stats.totalClicks) * 100).toFixed(1))
                    : 0,
            };
            await fastify.cache.set('promoter', cacheKey, payload, 120);
            return reply.header('Cache-Control', 'private, max-age=120').send(payload);
        } catch (error: any) {
            fastify.log.error(`Promoter analytics error: ${error.message}`);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    fastify.get('/promoter/analytics/:type', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { promoterId } = request.query as any;
        const { type } = request.params as any;
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        await fastify.verifyPartnerAccess(request, promoterId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        try {
            const stats = await getPromoterStats(promoterId);
            return {
                type,
                clicks: stats.totalClicks || 0,
                conversions: stats.totalConversions || 0,
                earnings: stats.totalEarnings || 0,
            };
        } catch (error: any) {
            fastify.log.error(`Promoter analytics/${type} error: ${error.message}`);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    fastify.get('/promoter/events', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { promoterId, city, status, limit = '50' } = request.query as any;
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        await fastify.verifyPartnerAccess(request, promoterId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });

        const pageSize = Math.min(parseInt(limit, 10) || 50, 100);
        const [directEnabled, settingsEnabled, linksSnap] = await Promise.all([
            fastify.db.collection('events').where('promotersEnabled', '==', true).limit(pageSize * 2).get().catch(() => ({ docs: [] as any[] })),
            fastify.db.collection('events').where('promoterSettings.enabled', '==', true).limit(pageSize * 2).get().catch(() => ({ docs: [] as any[] })),
            fastify.db.collection('promoter_links').where('promoterId', '==', promoterId).limit(200).get().catch(() => ({ docs: [] as any[] })),
        ]);

        const activeLinkByEventId = new Map<string, Record<string, any>>();
        for (const doc of linksSnap.docs || []) {
            const link = { id: doc.id, ...(doc.data() || {}) } as Record<string, any>;
            if ((link.isActive !== false) && link.eventId && !activeLinkByEventId.has(String(link.eventId))) {
                activeLinkByEventId.set(String(link.eventId), link);
            }
        }

        const deduped = new Map<string, Record<string, any>>();
        for (const doc of [...(directEnabled.docs || []), ...(settingsEnabled.docs || [])]) {
            deduped.set(doc.id, { id: doc.id, ...(doc.data() || {}) });
        }

        let events = [...deduped.values()]
            .filter((event) => isPromoterAllowedForEvent(event, promoterId))
            .filter((event) => {
                if (!status) return ['scheduled', 'approved', 'upcoming', 'live'].includes(String(event.lifecycle || event.status || '').toLowerCase());
                return String(event.lifecycle || event.status || '').toLowerCase() === String(status).toLowerCase();
            })
            .filter((event) => {
                if (!city) return true;
                return pickString(event.city, event.cityName).toLowerCase().includes(String(city).trim().toLowerCase());
            })
            .sort((left, right) => {
                const leftTime = new Date(toIso(left.startDate || left.date || left.eventDate) || 0).getTime();
                const rightTime = new Date(toIso(right.startDate || right.date || right.eventDate) || 0).getTime();
                return leftTime - rightTime;
            })
            .slice(0, pageSize)
            .map((event) => buildLegacyPromoterEvent(event, activeLinkByEventId.get(String(event.id))));

        return { events };
    });

    async function buildLegacyAssignments(promoterId: string, status?: string) {
        const assignmentSnap = await fastify.db.collection('promoter_assignments')
            .where('promoterId', '==', promoterId)
            .limit(100)
            .get()
            .catch(() => ({ docs: [] as any[] }));

        const linkSnap = await fastify.db.collection('promoter_links')
            .where('promoterId', '==', promoterId)
            .limit(200)
            .get()
            .catch(() => ({ docs: [] as any[] }));

        const assignments = assignmentSnap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
        const links = linkSnap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
        const eventMap = await loadEventsByIds(
            fastify,
            [
                ...assignments.map((assignment: any) => String(assignment.eventId || '')),
                ...links.map((link: any) => String(link.eventId || '')),
            ],
        );

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
            rows = rows.filter((row) => normalized === 'completed' ? row.status === 'completed' : row.status !== 'completed');
        }

        rows.sort((left: any, right: any) => {
            const leftTime = new Date(left.event?.date || 0).getTime();
            const rightTime = new Date(right.event?.date || 0).getTime();
            return rightTime - leftTime;
        });

        return rows;
    }

    fastify.get('/partner/promoter/events', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { promoterId, status } = request.query as any;
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        await fastify.verifyPartnerAccess(request, promoterId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        return { assignments: await buildLegacyAssignments(promoterId, status) };
    });

    fastify.get('/partner/promoter/events/:id', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { promoterId } = request.query as any;
        const { id } = request.params as { id: string };
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        await fastify.verifyPartnerAccess(request, promoterId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        const assignments = await buildLegacyAssignments(promoterId);
        const assignment = assignments.find((item: any) => item.id === id || item.eventId === id);
        if (!assignment) return reply.status(404).send({ error: 'Assignment not found' });
        return { assignment };
    });

    fastify.get('/promoter/connections', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { promoterId, status } = request.query as any;
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        await fastify.verifyPartnerAccess(request, promoterId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });

        let q: any = fastify.db.collection('promoter_connections').where('promoterId', '==', promoterId).limit(100);
        const snap = await q.get();
        let connections = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
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
    });

    fastify.post('/promoter/connections', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const body = request.body as Record<string, any>;
        const promoterId = String(body.promoterId || '');
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        await fastify.verifyPartnerAccess(request, promoterId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });

        const id = randomUUID();
        const now = new Date().toISOString();
        const connection = {
            id,
            promoterId,
            targetId: String(body.targetId || ''),
            targetType: pickString(body.targetType, 'venue'),
            targetName: pickString(body.targetName),
            status: 'pending',
            message: pickString(body.message),
            createdAt: now,
            updatedAt: now,
        };

        await fastify.db.collection('promoter_connections').doc(id).set(connection);
        return reply.status(201).send({ connection });
    });

    fastify.patch('/promoter/connections', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const body = request.body as Record<string, any>;
        const promoterId = String(body.promoterId || '');
        const connectionId = String(body.connectionId || body.id || '');
        const action = String(body.action || '').toLowerCase();
        if (!promoterId || !connectionId) return reply.status(400).send({ error: 'promoterId and connectionId required' });
        await fastify.verifyPartnerAccess(request, promoterId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });

        const statusMap: Record<string, string> = {
            approve: 'approved',
            reject: 'rejected',
            block: 'blocked',
            revoke: 'revoked',
            remove: 'removed',
        };

        const nextStatus = statusMap[action];
        if (!nextStatus) return reply.status(400).send({ error: 'Invalid action' });

        await fastify.db.collection('promoter_connections').doc(connectionId).update({
            status: nextStatus,
            updatedAt: new Date().toISOString(),
            ...(body.reason ? { reason: String(body.reason) } : {}),
        });

        return { success: true, status: nextStatus };
    });

    // ── Promoter Guests ───────────────────────────────────────────────────────

    async function resolvePromoterGuests(fastify: any, promoterId: string, limit: number) {
        const linksSnap = await fastify.db.collection('promoter_links')
            .where('promoterId', '==', promoterId)
            .get();
        const codes: string[] = linksSnap.docs.map((d: any) => d.data().code).filter(Boolean);
        if (codes.length === 0) return { guests: [], hasMore: false, nextCursor: null };

        // Firestore 'in' supports at most 10 values — chunk and merge
        const chunks: string[][] = [];
        for (let i = 0; i < codes.length; i += 10) chunks.push(codes.slice(i, i + 10));
        const snapshots = await Promise.all(
            chunks.map((chunk) => fastify.db.collection('orders').where('promoterCode', 'in', chunk).get())
        );
        const allDocs = snapshots.flatMap((s: any) => s.docs);

        const hasMore = allDocs.length > limit;
        const guests = allDocs.slice(0, limit).map((d: any) => {
            const o = d.data();
            return { id: d.id, guestName: o.guestName || o.buyerName, eventId: o.eventId, promoterCode: o.promoterCode, createdAt: o.createdAt };
        });
        return { guests, hasMore, nextCursor: hasMore ? guests[guests.length - 1]?.id ?? null : null };
    }

    // ── Ticket lookup (preview before manual assignment) ─────────────────────
    // GET /promoter/guests/lookup?orderId=&eventId=
    // Returns order details without modifying anything.
    // Used to show a confirm preview before the promoter calls /assign.
    fastify.get('/promoter/guests/lookup', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { orderId, eventId } = request.query as any;
        const promoterId: string = request.user?.uid;

        if (!orderId || !eventId) {
            return reply.status(400).send({ error: 'orderId and eventId required' });
        }
        await fastify.verifyPartnerAccess(request, promoterId)
            .catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });

        try {
            const orderDoc = await fastify.db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) return reply.send({ case: 'invalid' });

            const order = orderDoc.data() as any;
            if (order.eventId !== eventId) return reply.send({ case: 'wrong_event' });
            if (!['confirmed', 'checked_in'].includes(order.status)) return reply.send({ case: 'invalid' });

            if (order.source === 'link' || order.source === 'promo_code' || order.promoterCode) {
                return reply.send({
                    case: 'already_assigned',
                    existingCode: order.promoterCode,
                    source: order.source || 'manual',
                });
            }

            return reply.send({
                case: 'can_assign',
                order: {
                    id: orderId,
                    guestName: order.userName || order.guestName || 'Guest',
                    userEmail: order.userEmail || '',
                    eventName: order.eventTitle || order.eventName || '',
                    totalAmount: order.totalAmount || 0,
                    ticketCount: (order.tickets || []).reduce((s: number, t: any) => s + (Number(t.quantity) || 1), 0) || 1,
                    checkedIn: order.status === 'checked_in' || !!order.checkedInAt,
                },
            });
        } catch (error: any) {
            fastify.log.error(`[Promoter] Guest lookup error: ${error.message}`);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    fastify.get('/promoter/guests', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { promoterId, limit = '20' } = request.query as any;
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        await fastify.verifyPartnerAccess(request, promoterId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        try {
            return await resolvePromoterGuests(fastify, promoterId, Math.min(parseInt(limit), 100));
        } catch (error: any) {
            fastify.log.error(`Promoter guests error: ${error.message}`);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    fastify.get('/partner/promoter/guests', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { promoterId, limit = '20' } = request.query as any;
        if (!promoterId) return reply.status(400).send({ error: 'promoterId required' });
        await fastify.verifyPartnerAccess(request, promoterId).catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });
        try {
            return await resolvePromoterGuests(fastify, promoterId, Math.min(parseInt(limit), 100));
        } catch (error: any) {
            fastify.log.error(`Promoter guests (partner) error: ${error.message}`);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    // ── Manual guest assignment ──────────────────────────────────────────────
    // POST /api/v1/promoters/promoter/guests/assign
    // Lets a promoter manually attribute a confirmed ticket to themselves by order ID.
    // Attribution priority guard: link > promo_code > manual.
    // Rate limited to 50 manual assignments per promoter per event.
    // Every assignment is audit-logged to `promoter_manual_assignments`.
    fastify.post('/promoter/guests/assign', {
        preHandler: [fastify.requireAuth]
    }, async (request: any, reply) => {
        const { orderId, eventId } = (request.body || {}) as Record<string, any>;
        const promoterId: string = request.user?.uid;

        if (!orderId || !eventId) {
            return reply.status(400).send({ error: 'orderId and eventId are required' });
        }

        await fastify.verifyPartnerAccess(request, promoterId)
            .catch(() => { throw reply.status(403).send({ error: 'Forbidden' }); });

        try {
            // 1. Fetch order
            const orderDoc = await fastify.db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) {
                return reply.send({ case: 'invalid', message: 'No confirmed order found with this ID' });
            }

            const order = orderDoc.data() as Record<string, any>;

            // 2. Validate event match
            if (order.eventId !== eventId) {
                return reply.send({ case: 'wrong_event', message: 'This ticket belongs to a different event' });
            }

            // 3. Validate order is confirmed / checked-in
            if (!['confirmed', 'checked_in'].includes(order.status)) {
                return reply.send({ case: 'invalid', message: 'Order is not in a confirmed state' });
            }

            // 4. Attribution priority guard — never override a tracked attribution
            if (order.source === 'link' || order.source === 'promo_code') {
                return reply.send({
                    case: 'already_assigned',
                    existingCode: order.promoterCode,
                    source: order.source,
                    message: 'This ticket is already attributed to a promoter via a tracking link',
                });
            }

            // 5. Already manually assigned (to any promoter)
            if (order.promoterCode) {
                return reply.send({
                    case: 'already_assigned',
                    existingCode: order.promoterCode,
                    source: order.source || 'manual',
                    message: 'This ticket is already assigned to a promoter',
                });
            }

            // 6. Rate limit — max 50 manual assignments per promoter per event
            const countSnap = await fastify.db
                .collection('promoter_manual_assignments')
                .where('promoterId', '==', promoterId)
                .where('eventId', '==', eventId)
                .limit(51)
                .get();
            if (countSnap.size >= 50) {
                return reply.status(429).send({
                    error: 'Manual assignment limit reached (50 per event)',
                });
            }

            // 7. Get promoter's active tracking link for this event
            const linkSnap = await fastify.db
                .collection('promoter_links')
                .where('promoterId', '==', promoterId)
                .where('eventId', '==', eventId)
                .where('isActive', '==', true)
                .limit(1)
                .get();

            if (linkSnap.empty) {
                return reply.send({
                    case: 'no_link',
                    message: 'Create a tracking link for this event first, then retry',
                });
            }

            const link = linkSnap.docs[0].data() as Record<string, any>;
            const now = new Date().toISOString();
            const assignmentId = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

            // 8. Atomic write: update order + write audit log
            await fastify.db.runTransaction(async (tx: any) => {
                tx.update(fastify.db.collection('orders').doc(orderId), {
                    promoterCode: link.code,
                    promoterId,
                    source: 'manual',
                    updatedAt: now,
                });
                tx.set(fastify.db.collection('promoter_manual_assignments').doc(assignmentId), {
                    id: assignmentId,
                    promoterId,
                    orderId,
                    eventId,
                    promoterCode: link.code,
                    addedBy: request.user.uid,
                    addedAt: now,
                });
            });

            fastify.log.info(`[Promoter] Manual assignment: promoter=${promoterId} order=${orderId} event=${eventId}`);
            return reply.send({ case: 'assigned', orderId, promoterId, promoterCode: link.code });

        } catch (error: any) {
            fastify.log.error(`[Promoter] Manual guest assign error: ${error.message}`);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });
}
