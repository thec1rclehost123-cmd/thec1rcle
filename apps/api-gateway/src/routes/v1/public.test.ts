import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import validatePlugin from '../../plugins/validate';
import publicRoutes from './public';

async function buildServer() {
    const server = Fastify({ logger: false });
    const publicDiscoveryService = {
        listEvents: vi.fn(async (query) => ({ items: [{ id: 'event_1' }], nextCursor: null, hasMore: false, appliedFilters: query })),
        listFeaturedEvents: vi.fn(async () => ({ items: [{ id: 'event_featured' }], nextCursor: null, hasMore: false, appliedFilters: { sort: 'heatScore' } })),
        getEventDetail: vi.fn(async (idOrSlug) => ({ event: { id: idOrSlug }, interestedData: { count: 0, users: [] } })),
        listHosts: vi.fn(async (query) => ({ items: [{ id: 'host_1' }], nextCursor: null, hasMore: false, appliedFilters: query })),
        getHostPublicProfile: vi.fn(async (slug) => ({ host: { id: 'host_1', slug }, stats: {}, posts: [], highlights: [], upcomingEvents: [], pastEvents: [] })),
        listVenues: vi.fn(async (query) => ({ items: [{ id: 'venue_1' }], nextCursor: null, hasMore: false, appliedFilters: query })),
        getVenuePublicProfile: vi.fn(async (slug) => ({ venue: { id: 'venue_1', slug }, stats: {}, highlights: [], upcomingEvents: [], pastEvents: [], similarVenues: [], menu: null })),
        search: vi.fn(async (query) => ({ events: [{ id: 'event_1', title: query }], hosts: [], venues: [] })),
    };

    server.decorate('cache', {
        get: vi.fn(async () => null),
        set: vi.fn(async () => undefined),
    } as any);
    server.decorate('publicDiscoveryService', publicDiscoveryService as any);
    await server.register(validatePlugin);
    await server.register(publicRoutes, { prefix: '/public' });
    return { server, publicDiscoveryService };
}

describe('public discovery routes GP-2 contracts', () => {
    it('GET /public/events accepts legacy guest query params and returns paginated items', async () => {
        const { server, publicDiscoveryService } = await buildServer();

        const response = await server.inject({
            method: 'GET',
            url: '/public/events?limit=12&city=Pune%2C%20IN&lastId=event_0&sort=Popular&search=party',
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ items: [{ id: 'event_1' }], hasMore: false });
        expect(publicDiscoveryService.listEvents).toHaveBeenCalledWith(expect.objectContaining({
            limit: 12,
            city: 'Pune, IN',
            lastId: 'event_0',
            sort: 'Popular',
            search: 'party',
        }));

        await server.close();
    });

    it('GET /public/events/featured is registered before event detail and returns featured items', async () => {
        const { server, publicDiscoveryService } = await buildServer();

        const response = await server.inject({ method: 'GET', url: '/public/events/featured?limit=6' });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ items: [{ id: 'event_featured' }] });
        expect(publicDiscoveryService.listFeaturedEvents).toHaveBeenCalledWith(expect.objectContaining({ limit: 6 }));
        expect(publicDiscoveryService.getEventDetail).not.toHaveBeenCalled();

        await server.close();
    });

    it('GET /public/events/:idOrSlug returns event detail with social proof and 404s missing events', async () => {
        const { server, publicDiscoveryService } = await buildServer();

        const found = await server.inject({ method: 'GET', url: '/public/events/event_1' });
        publicDiscoveryService.getEventDetail.mockResolvedValueOnce(null as any);
        const missing = await server.inject({ method: 'GET', url: '/public/events/private_event' });

        expect(found.statusCode).toBe(200);
        expect(found.json()).toMatchObject({ event: { id: 'event_1' }, interestedData: { count: 0, users: [] } });
        expect(missing.statusCode).toBe(404);
        expect(missing.json().error.code).toBe('NOT_FOUND');

        await server.close();
    });

    it('GET /public/hosts and /public/venues accept GP-2 filters and sort aliases', async () => {
        const { server, publicDiscoveryService } = await buildServer();

        const hosts = await server.inject({ method: 'GET', url: '/public/hosts?role=DJ&vibe=House&status=Verified&sort=Most%20followed' });
        const venues = await server.inject({ method: 'GET', url: '/public/venues?area=Koregaon%20Park&vibe=Techno&tablesOnly=true&sort=Soonest%20event' });

        expect(hosts.statusCode).toBe(200);
        expect(venues.statusCode).toBe(200);
        expect(publicDiscoveryService.listHosts).toHaveBeenCalledWith(expect.objectContaining({
            role: 'DJ',
            vibe: 'House',
            status: 'Verified',
            sort: 'Most followed',
        }));
        expect(publicDiscoveryService.listVenues).toHaveBeenCalledWith(expect.objectContaining({
            area: 'Koregaon Park',
            vibe: 'Techno',
            tablesOnly: 'true',
            sort: 'Soonest event',
        }));

        await server.close();
    });

    it('GET /public/search caches by full query and returns public search groups', async () => {
        const { server, publicDiscoveryService } = await buildServer();

        const response = await server.inject({ method: 'GET', url: '/public/search?q=after&type=hosts&limit=10' });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ events: [{ id: 'event_1', title: 'after' }] });
        expect(publicDiscoveryService.search).toHaveBeenCalledWith('after', 10);

        await server.close();
    });

    it('returns 404 for missing private or absent host and venue profiles', async () => {
        const { server, publicDiscoveryService } = await buildServer();
        publicDiscoveryService.getHostPublicProfile.mockResolvedValueOnce(null as any);
        publicDiscoveryService.getVenuePublicProfile.mockResolvedValueOnce(null as any);

        const host = await server.inject({ method: 'GET', url: '/public/hosts/private-host' });
        const venue = await server.inject({ method: 'GET', url: '/public/venues/private-venue' });

        expect(host.statusCode).toBe(404);
        expect(host.json().error.code).toBe('NOT_FOUND');
        expect(venue.statusCode).toBe(404);
        expect(venue.json().error.code).toBe('NOT_FOUND');

        await server.close();
    });
});
