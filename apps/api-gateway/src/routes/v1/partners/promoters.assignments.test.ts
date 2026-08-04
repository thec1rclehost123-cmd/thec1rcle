import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import validatePlugin from '../../../plugins/validate.js';
import { MockFirestore } from '../../../test-utils/mock-firestore.js';
import partnersPromoterRoutes from './promoters.js';

async function buildServer() {
  const server = Fastify({ logger: false });
  const db = new MockFirestore();
  server.decorate('db', db as any);
  server.decorate('redis', null as any);
  server.decorate('cache', {
    get: async () => null,
    set: async () => undefined,
    delete: async () => undefined,
  } as any);
  server.decorate('requireAuth', async () => {});
  server.decorate('auth', { revokeRefreshTokens: async () => undefined } as any);
  server.addHook('onRequest', (request: any, _reply, done) => {
    const activeMembership = {
      partnerId: 'promoter-1',
      partnerType: 'promoter',
      role: 'owner',
      status: 'active',
      isActive: true,
    };
    request.user = { uid: 'promoter-user-1', activeMembership };
    request.authContext = { memberships: [activeMembership], activeMembership };
    done();
  });
  await server.register(validatePlugin);
  await server.register(partnersPromoterRoutes);
  return { server, db };
}

describe('promoter assignment and link flow', () => {
  it('serves Overview and Analytics without a composite aggregate index', async () => {
    const { server, db } = await buildServer();
    db.seed('promoter_links/link-1', {
      promoterId: 'promoter-1',
      eventId: 'event-1',
      eventTitle: 'Index Independent Night',
      code: 'indexfree',
      active: true,
      clicks: 12,
      conversions: 3,
      attributedRevenue: 450,
    });
    db.seed('promoter_daily_stats/promoter-1/daily/2026-07-29', {
      date: '2026-07-29',
      clicks: 12,
      revenue: 450,
    });

    const overview = await server.inject({
      method: 'GET',
      url: '/partners/promoters/overview',
    });
    const analytics = await server.inject({
      method: 'GET',
      url: '/partners/promoters/analytics?from=2026-07-29&to=2026-07-29',
    });

    expect(overview.statusCode).toBe(200);
    expect(overview.json().stats).toMatchObject({
      totalLinks: 1,
      totalClicks: 12,
      totalConversions: 3,
      totalRevenue: 450,
    });
    expect(analytics.statusCode).toBe(200);
    expect(analytics.json().overview).toMatchObject({
      totalClicks: 12,
      ticketsSold: 3,
      revenue: 450,
    });
    expect(analytics.json().timeline).toEqual([
      expect.objectContaining({ date: '2026-07-29', clicks: 12 }),
    ]);
    await server.close();
  });

  it('shows host-assigned events under linked events even when not in public discovery', async () => {
    const { server, db } = await buildServer();
    db.seed('events/host-event-1', {
      hostId: 'host-1',
      title: 'Host Assigned Night',
      lifecycle: 'scheduled',
      status: 'scheduled',
      promotersEnabled: false,
      startDate: '2026-08-12T20:00:00.000Z',
    });
    db.seed('promoter_assignments/promoter-1_host-event-1', {
      id: 'promoter-1_host-event-1',
      promoterId: 'promoter-1',
      eventId: 'host-event-1',
      status: 'active',
      assignmentVersion: 2,
      approvedByPartnerId: 'host-1',
    });

    const response = await server.inject({
      method: 'GET',
      url: '/partners/promoters/events',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().events).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'host-event-1' })]),
    );
    expect(response.json().assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventId: 'host-event-1', status: 'active' }),
      ]),
    );
    await server.close();
  });

  it('creates an idempotent access request for an unassigned discover event', async () => {
    const { server, db } = await buildServer();
    db.seed('events/discover-event-1', {
      hostId: 'host-1',
      title: 'Discover Night',
      lifecycle: 'published',
      status: 'published',
      promotersEnabled: true,
    });

    const first = await server.inject({
      method: 'POST',
      url: '/partners/promoters/events/discover-event-1/request',
      payload: { promoterName: 'QA Promoter' },
    });
    const replay = await server.inject({
      method: 'POST',
      url: '/partners/promoters/events/discover-event-1/request',
      payload: { promoterName: 'QA Promoter' },
    });

    expect(first.statusCode).toBe(201);
    expect(first.json().request).toMatchObject({ status: 'pending', duplicate: false });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().request).toMatchObject({ status: 'pending', duplicate: true });
    expect(db.getDoc('promoter_assignment_requests/promoter-1_discover-event-1')).toMatchObject({
      targetPartnerId: 'host-1',
      status: 'pending',
    });
    await server.close();
  });

  it('generates a link only for an approved active assignment', async () => {
    const { server, db } = await buildServer();
    db.seed('events/assigned-event-1', {
      hostId: 'host-1',
      title: 'Assigned Night',
      lifecycle: 'scheduled',
      status: 'scheduled',
      promotersEnabled: true,
    });
    db.seed('promoters/promoter-1', {
      displayName: 'QA Promoter',
      handle: 'qa_promoter',
      trackingCode: 'qapromo',
    });
    db.seed('promoter_assignments/promoter-1_assigned-event-1', {
      id: 'promoter-1_assigned-event-1',
      promoterId: 'promoter-1',
      eventId: 'assigned-event-1',
      status: 'active',
      assignmentVersion: 2,
      termsVersion: 2,
      approvedByPartnerId: 'host-1',
      commissionRate: 10,
      commissionType: 'percentage',
    });

    const response = await server.inject({
      method: 'POST',
      url: '/partners/promoters/links',
      payload: {
        eventId: 'assigned-event-1',
        promoterName: 'QA Promoter',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().link).toMatchObject({
      eventId: 'assigned-event-1',
      promoterHandle: 'qa_promoter',
      vanityPrefix: '/qa_promoter/',
      code: 'qapromo',
      isActive: true,
    });
    expect(db.getDoc('promoter_links/promoter-1_assigned-event-1')).toMatchObject({
      eventId: 'assigned-event-1',
      promoterName: 'QA Promoter',
      code: 'qapromo',
      isActive: true,
    });

    const aliasResponse = await server.inject({
      method: 'PATCH',
      url: '/partners/promoters/links/promoter-1_assigned-event-1',
      payload: {
        action: 'update_alias',
        editableSlug: 'e2e-20260729t203208z',
      },
    });

    expect(aliasResponse.statusCode).toBe(200);
    expect(aliasResponse.json().link).toMatchObject({
      promoterHandle: 'qa_promoter',
      vanityPrefix: '/qa_promoter/',
      vanityAlias: 'e2e-20260729t203208z',
    });
    await server.close();
  });
});
