import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import validatePlugin from '../../../plugins/validate.js';
import { MockFirestore } from '../../../test-utils/mock-firestore.js';
import partnersHostRoutes from './hosts.js';

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
  server.decorate('enrichAuthContext', async () => {});
  server.decorate('publicDiscoveryService', { syncEventReadModels: async () => undefined } as any);
  server.decorate('writeAuditLog', async () => undefined);
  server.addHook('onRequest', (request: any, _reply, done) => {
    const activeMembership = {
      partnerId: 'host-1',
      partnerType: 'host',
      role: 'owner',
      status: 'active',
      isActive: true,
    };
    request.user = {
      uid: 'host-user-1',
      activeMembership,
    };
    request.authContext = {
      memberships: [activeMembership],
      activeMembership,
    };
    done();
  });
  await server.register(validatePlugin);
  await server.register(partnersHostRoutes);
  return { server, db };
}

describe('host event scheduling submission', () => {
  it('serves a cached overview before reading the Host document', async () => {
    const { server, db } = await buildServer();
    const originalCollection = db.collection.bind(db);
    db.collection = ((name: string) => {
      if (name === 'hosts') {
        throw new Error('Host document must not be read on an overview cache hit');
      }
      return originalCollection(name);
    }) as typeof db.collection;
    server.cache.get = async () => ({
      success: true,
      stats: { ticketsSold: 7, revenue: 499 },
      performance: { range: '1m', metric: 'tickets', total: 7, series: [] },
      warnings: [{ message: 'Cached warning' }],
    });

    const response = await server.inject({
      method: 'GET',
      url: '/partners/hosts/overview?range=1m&metric=tickets',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      fromCache: true,
      stats: { ticketsSold: 7, revenue: 499 },
      warnings: [{ message: 'Cached warning' }],
    });
    await server.close();
  });

  it('serves the bounded canonical calendar contract and retires the split route', async () => {
    const { server, db } = await buildServer();
    db.seed('partnerships/host-venue-1', {
      hostId: 'host-1',
      venueId: 'venue-1',
      status: 'active',
    });
    db.seed('events/event-in-range', {
      creatorId: 'host-1',
      hostId: 'host-1',
      venueId: 'venue-1',
      title: 'In range',
      lifecycle: 'submitted',
      startDate: '2026-08-15',
      startTime: '21:00',
      endTime: '03:00',
    });
    db.seed('events/event-outside-range', {
      creatorId: 'host-1',
      hostId: 'host-1',
      venueId: 'venue-1',
      title: 'Outside range',
      lifecycle: 'approved',
      startDate: '2026-09-15',
      startTime: '21:00',
      endTime: '03:00',
    });

    const response = await server.inject({
      method: 'GET',
      url: '/partners/hosts/venue-calendar?venueId=venue-1&startDate=2026-08-01&endDate=2026-08-31',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().calendar).toHaveLength(31);
    expect(response.json().calendar.find((day: any) => day.date === '2026-08-15')).toMatchObject({
      state: 'CONFIRMED',
      events: [expect.objectContaining({ id: 'event-in-range', title: 'In range' })],
    });
    expect(JSON.stringify(response.json())).not.toContain('Outside range');
    expect(response.json().pagination).toEqual({ limit: 200, truncated: false });

    const retired = await server.inject({
      method: 'GET',
      url: '/partners/hosts/calendar?venueId=venue-1&startDate=2026-08-01&endDate=2026-08-31',
    });
    expect(retired.statusCode).toBe(410);
    expect(retired.json().error.code).toBe('LEGACY_ROUTE_GONE');
    await server.close();
  });

  it('atomically submits a venue event and creates its deterministic slot request', async () => {
    const { server, db } = await buildServer();
    db.seed('events/event-1', {
      creatorId: 'host-1',
      hostId: 'host-1',
      hostName: 'QA Host',
      venueId: 'venue-1',
      venueName: 'QA Venue',
      title: '[QA-TEST-2026] Host Slot',
      lifecycle: 'draft',
      status: 'draft',
      startDate: '2026-08-15',
      startTime: '21:00',
      endTime: '03:00',
    });
    db.seed('partnerships/host-venue-1', {
      hostId: 'host-1',
      venueId: 'venue-1',
      status: 'active',
    });

    const response = await server.inject({
      method: 'POST',
      url: '/partners/hosts/events/event-1/submit',
      payload: { hostNote: 'Please approve this slot.' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      lifecycle: 'submitted',
      slotRequestId: 'event-1',
    });
    expect(db.getDoc('events/event-1')).toMatchObject({
      lifecycle: 'submitted',
      status: 'submitted',
      submissionStatus: 'submitted',
      approvalState: 'pending',
    });
    expect(db.getDoc('availability_slots/event-1')).toMatchObject({
      eventId: 'event-1',
      hostId: 'host-1',
      venueId: 'venue-1',
      date: '2026-08-15',
      startTime: '21:00',
      endTime: '03:00',
      status: 'pending',
      source: 'host_event_request',
    });
    expect(db.listCollection('submission_history')).toHaveLength(1);
    expect(db.listCollection('notifications')).toHaveLength(1);
    await server.close();
  });

  it('fails closed without an active venue partnership and writes no artifacts', async () => {
    const { server, db } = await buildServer();
    db.seed('events/event-2', {
      creatorId: 'host-1',
      hostId: 'host-1',
      venueId: 'venue-2',
      title: '[QA-TEST-2026] Unauthorized Slot',
      lifecycle: 'draft',
      status: 'draft',
      startDate: '2026-08-16',
      startTime: '21:00',
      endTime: '03:00',
    });

    const response = await server.inject({
      method: 'POST',
      url: '/partners/hosts/events/event-2/submit',
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ACTIVE_PARTNERSHIP_REQUIRED');
    expect(db.getDoc('events/event-2')).toMatchObject({ lifecycle: 'draft', status: 'draft' });
    expect(db.getDoc('availability_slots/event-2')).toBeUndefined();
    expect(db.listCollection('submission_history')).toHaveLength(0);
    expect(db.listCollection('notifications')).toHaveLength(0);
    await server.close();
  });

  it('rejects an overnight conflict without transitioning the event', async () => {
    const { server, db } = await buildServer();
    db.seed('events/event-3', {
      creatorId: 'host-1',
      hostId: 'host-1',
      venueId: 'venue-1',
      title: '[QA-TEST-2026] Conflicting Slot',
      lifecycle: 'draft',
      status: 'draft',
      startDate: '2026-08-17',
      startTime: '01:00',
      endTime: '02:00',
    });
    db.seed('partnerships/host-venue-1', {
      hostId: 'host-1',
      venueId: 'venue-1',
      status: 'active',
    });
    db.seed('availability_slots/existing-event', {
      eventId: 'existing-event',
      hostId: 'another-host',
      venueId: 'venue-1',
      date: '2026-08-17',
      startTime: '21:00',
      endTime: '03:00',
      status: 'approved',
    });

    const response = await server.inject({
      method: 'POST',
      url: '/partners/hosts/events/event-3/submit',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('SLOT_CONFLICT');
    expect(db.getDoc('events/event-3')).toMatchObject({ lifecycle: 'draft', status: 'draft' });
    expect(db.getDoc('availability_slots/event-3')).toBeUndefined();
    expect(db.listCollection('submission_history')).toHaveLength(0);
    await server.close();
  });
});
