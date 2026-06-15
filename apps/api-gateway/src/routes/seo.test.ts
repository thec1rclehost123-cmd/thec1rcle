import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import seoRoutes from './seo';

const promoterEngine = vi.hoisted(() => ({
  env: Object.assign(process.env, {
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'test-project',
  }),
  getPromoterByUsername: vi.fn(async (username: string) => ({
    id: 'promoter_1',
    username,
    displayName: 'Night Shift',
    bio: 'Late-night promoter collective',
  })),
}));

vi.mock('@c1rcle/core/promoter-engine', () => promoterEngine);

async function buildServer() {
  const server = Fastify({ logger: false });
  server.decorate('publicDiscoveryService', {
    listEvents: vi.fn(async () => ({
      items: [{ id: 'event_1', slug: 'after-dark', updatedAt: '2026-04-22T00:00:00.000Z' }],
    })),
    getEventDetail: vi.fn(async (idOrSlug: string) => ({
      event: { id: idOrSlug, slug: idOrSlug, title: 'After Dark', summary: 'Late-night energy' },
      interestedData: { count: 12, users: [] },
    })),
    getHostPublicProfile: vi.fn(async (slug: string) => ({
      host: { id: 'host_1', slug, name: 'DJ Ash', bio: 'House all night' },
      stats: {},
      posts: [],
      highlights: [],
      upcomingEvents: [],
      pastEvents: [],
    })),
    getVenuePublicProfile: vi.fn(async (slug: string) => ({
      venue: { id: 'venue_1', slug, name: 'Vault', description: 'Industrial venue' },
      stats: {},
      highlights: [],
      upcomingEvents: [],
      pastEvents: [],
      similarVenues: [],
    })),
  } as any);
  await server.register(seoRoutes);
  return server;
}

describe('gateway SEO routes', () => {
  beforeEach(() => {
    promoterEngine.getPromoterByUsername.mockClear();
  });

  it('serves robots.txt and sitemap.xml from Fastify', async () => {
    const server = await buildServer();

    const robots = await server.inject({ method: 'GET', url: '/robots.txt' });
    const sitemap = await server.inject({ method: 'GET', url: '/sitemap.xml' });

    expect(robots.statusCode).toBe(200);
    expect(robots.body).toContain('Sitemap:');
    expect(sitemap.statusCode).toBe(200);
    expect(sitemap.body).toContain('<urlset');
    expect(sitemap.body).toContain('/event/after-dark');

    await server.close();
  });

  it('serves gateway-owned SEO snapshots for public entities', async () => {
    const server = await buildServer();

    const event = await server.inject({ method: 'GET', url: '/seo/public/events/event_1' });
    const host = await server.inject({ method: 'GET', url: '/seo/public/hosts/dj-ash' });
    const venue = await server.inject({ method: 'GET', url: '/seo/public/venues/vault' });
    const promoter = await server.inject({
      method: 'GET',
      url: '/seo/public/promoters/nightshift',
    });

    expect(event.statusCode).toBe(200);
    expect(event.json()).toMatchObject({ type: 'event', title: 'After Dark' });
    expect(host.statusCode).toBe(200);
    expect(host.json()).toMatchObject({ type: 'host', title: 'DJ Ash' });
    expect(venue.statusCode).toBe(200);
    expect(venue.json()).toMatchObject({ type: 'venue', title: 'Vault' });
    expect(promoter.statusCode).toBe(200);
    expect(promoter.json()).toMatchObject({ type: 'promoter', title: 'Night Shift' });

    await server.close();
  });
});
