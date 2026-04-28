import { FastifyInstance } from 'fastify';
// @ts-ignore
import { getPromoterByUsername } from '@c1rcle/core/promoter-engine';
import { buildErrorResponse } from '../lib/api-contracts';
import { config } from '../config';

function getBaseUrl() {
    const candidates = String(config.FRONTEND_URLS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

    const preferred = candidates.find((value) => /^https?:\/\//.test(value) && !value.includes('localhost'));
    return preferred || candidates[0] || 'https://thec1rcle.com';
}

function escapeXml(value: string) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function normalizeEventSeo(detail: any, baseUrl: string) {
    const event = detail?.event || null;
    if (!event) return null;

    const title = event.title || event.name || 'Event';
    const description = event.summary || event.description || 'Join us at THE C1RCLE.';
    const image = event.image || event.poster || event.coverImage || `${baseUrl}/logo-circle.jpg`;

    return {
        type: 'event',
        title,
        description,
        canonicalUrl: `${baseUrl}/event/${encodeURIComponent(event.slug || event.id)}`,
        image,
        snapshot: {
            event,
            interestedData: detail?.interestedData || { count: 0, users: [] },
        },
    };
}

function normalizeHostSeo(data: any, baseUrl: string) {
    const host = data?.host || null;
    if (!host) return null;

    return {
        type: 'host',
        title: host.name || host.displayName || 'Host',
        description: host.bio || `Discover events by ${host.name || host.displayName || 'this host'} on THE C1RCLE`,
        canonicalUrl: `${baseUrl}/host/${encodeURIComponent(host.slug || host.id)}`,
        image: host.coverURL || host.cover || host.avatar || `${baseUrl}/og-default.jpg`,
        snapshot: data,
    };
}

function normalizeVenueSeo(data: any, baseUrl: string) {
    const venue = data?.venue || null;
    if (!venue) return null;

    return {
        type: 'venue',
        title: venue.name || 'Venue',
        description: venue.bio || venue.description || `Discover events at ${venue.name || 'this venue'} on THE C1RCLE`,
        canonicalUrl: `${baseUrl}/venue/${encodeURIComponent(venue.slug || venue.id)}`,
        image: venue.coverURL || venue.image || `${baseUrl}/og-default.jpg`,
        snapshot: data,
    };
}

function normalizePromoterSeo(promoter: any, baseUrl: string) {
    if (!promoter) return null;
    const handle = promoter.username || promoter.handle || promoter.slug || promoter.id;
    const title = promoter.displayName || promoter.name || handle || 'Promoter';
    const city = promoter.city || 'India';
    const description = promoter.bio || promoter.summary || `Nightlife promoter in ${city}`;

    return {
        type: 'promoter',
        title,
        description,
        canonicalUrl: `${baseUrl}/${encodeURIComponent(handle)}`,
        image: promoter.avatar || promoter.photoURL || `${baseUrl}/og-default.jpg`,
        snapshot: { promoter },
    };
}

export default async function seoRoutes(fastify: FastifyInstance) {
    fastify.get('/robots.txt', async (_request, reply) => {
        const baseUrl = getBaseUrl();
        reply.type('text/plain; charset=utf-8');
        return [
            'User-agent: *',
            'Allow: /',
            'Disallow: /api/',
            'Disallow: /admin/',
            `Sitemap: ${baseUrl}/sitemap.xml`,
            '',
        ].join('\n');
    });

    fastify.get('/sitemap.xml', async (request: any, reply) => {
        const baseUrl = getBaseUrl();
        const staticRoutes = ['', '/explore', '/app', '/hosts', '/about', '/login', '/privacy', '/terms', '/tickets'];

        try {
            const result = await fastify.publicDiscoveryService.listEvents({ limit: 500 });
            const events = result?.items || [];
            const urls = [
                ...staticRoutes.map((path) => ({
                    loc: `${baseUrl}${path}`,
                    lastmod: new Date().toISOString(),
                })),
                ...events.map((event: any) => ({
                    loc: `${baseUrl}/event/${encodeURIComponent(event.slug || event.id)}`,
                    lastmod: new Date(event.updatedAt || event.createdAt || Date.now()).toISOString(),
                })),
            ];

            const xml = [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
                ...urls.map((entry) => [
                    '  <url>',
                    `    <loc>${escapeXml(entry.loc)}</loc>`,
                    `    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`,
                    '  </url>',
                ].join('\n')),
                '</urlset>',
            ].join('\n');

            reply.type('application/xml; charset=utf-8');
            return xml;
        } catch (error: any) {
            request.log.error({ requestId: request.id, error: error.message }, 'GET /sitemap.xml failed');
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Unable to build sitemap',
                requestId: request.id,
            }));
        }
    });

    fastify.get('/seo/public/events/:idOrSlug', async (request: any, reply) => {
        try {
            const detail = await fastify.publicDiscoveryService.getEventDetail(request.params.idOrSlug);
            const payload = normalizeEventSeo(detail, getBaseUrl());
            if (!payload) {
                return reply.status(404).send(buildErrorResponse({
                    code: 'NOT_FOUND',
                    message: 'Event not found',
                    requestId: request.id,
                }));
            }
            return payload;
        } catch (error: any) {
            request.log.error({ requestId: request.id, error: error.message }, 'GET /seo/public/events/:idOrSlug failed');
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Unable to build event SEO snapshot',
                requestId: request.id,
            }));
        }
    });

    fastify.get('/seo/public/hosts/:slug', async (request: any, reply) => {
        try {
            const data = await fastify.publicDiscoveryService.getHostPublicProfile(request.params.slug);
            const payload = normalizeHostSeo(data, getBaseUrl());
            if (!payload) {
                return reply.status(404).send(buildErrorResponse({
                    code: 'NOT_FOUND',
                    message: 'Host not found',
                    requestId: request.id,
                }));
            }
            return payload;
        } catch (error: any) {
            request.log.error({ requestId: request.id, error: error.message }, 'GET /seo/public/hosts/:slug failed');
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Unable to build host SEO snapshot',
                requestId: request.id,
            }));
        }
    });

    fastify.get('/seo/public/venues/:slug', async (request: any, reply) => {
        try {
            const data = await fastify.publicDiscoveryService.getVenuePublicProfile(request.params.slug);
            const payload = normalizeVenueSeo(data, getBaseUrl());
            if (!payload) {
                return reply.status(404).send(buildErrorResponse({
                    code: 'NOT_FOUND',
                    message: 'Venue not found',
                    requestId: request.id,
                }));
            }
            return payload;
        } catch (error: any) {
            request.log.error({ requestId: request.id, error: error.message }, 'GET /seo/public/venues/:slug failed');
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Unable to build venue SEO snapshot',
                requestId: request.id,
            }));
        }
    });

    fastify.get('/seo/public/promoters/:username', async (request: any, reply) => {
        try {
            const promoter = await getPromoterByUsername(String(request.params.username || '').toLowerCase());
            const payload = normalizePromoterSeo(promoter, getBaseUrl());
            if (!payload) {
                return reply.status(404).send(buildErrorResponse({
                    code: 'NOT_FOUND',
                    message: 'Promoter not found',
                    requestId: request.id,
                }));
            }
            return payload;
        } catch (error: any) {
            request.log.error({ requestId: request.id, error: error.message }, 'GET /seo/public/promoters/:username failed');
            return reply.status(500).send(buildErrorResponse({
                code: 'INTERNAL_ERROR',
                message: 'Unable to build promoter SEO snapshot',
                requestId: request.id,
            }));
        }
    });
}
