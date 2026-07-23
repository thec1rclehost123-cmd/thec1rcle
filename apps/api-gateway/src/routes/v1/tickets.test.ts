import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import validatePlugin from '../../plugins/validate';
import ticketRoutes from './tickets';

function mockOwnerDb() {
  return {
    collection: vi.fn((name: string) => ({
      doc: vi.fn((id: string) => {
        if (name === 'entitlements' && id === 'ENT-ORD-100-GEN-1') {
          return {
            get: vi.fn(async () => ({
              exists: true,
              data: () => ({
                id: 'ENT-ORD-100-GEN-1',
                entitlementId: 'ENT-ORD-100-GEN-1',
                userId: 'user-owner-123',
                eventId: 'event-1',
                checkedIn: false,
                state: 'ACTIVE',
                scanCountUsed: 0,
                scanCountAllowed: 1,
                metadata: { tierName: 'General', entryType: 'general' },
                eventSummary: { title: 'Test Event', venue: 'Test Venue', city: 'Test City' },
              }),
            })),
          };
        }
        if (name === 'entitlements' && id === 'ENT-ORD-200-GEN-1') {
          return {
            get: vi.fn(async () => ({
              exists: true,
              data: () => ({
                id: 'ENT-ORD-200-GEN-1',
                entitlementId: 'ENT-ORD-200-GEN-1',
                userId: 'user-attacker-999',
                eventId: 'event-1',
                checkedIn: false,
                state: 'ACTIVE',
                scanCountUsed: 0,
                scanCountAllowed: 1,
                metadata: { tierName: 'General', entryType: 'general' },
                eventSummary: { title: 'Test Event', venue: 'Test Venue', city: 'Test City' },
              }),
            })),
          };
        }
        if (name === 'entitlements') {
          return { get: vi.fn(async () => ({ exists: false, data: () => null })) };
        }
        if (name === 'events' && id === 'event-1') {
          return {
            get: vi.fn(async () => ({
              exists: true,
              data: () => ({
                title: 'Test Event',
                startDate: '2026-08-01T20:00:00.000Z',
                venue: 'Test Venue',
                city: 'Test City',
                image: 'https://example.com/poster.jpg',
              }),
            })),
          };
        }
        return { get: vi.fn(async () => ({ exists: false, data: () => null })) };
      }),
    })),
  };
}

describe('GET /tickets/public/:entitlementId — C2 security regression', () => {
  it('never leaks qrPayload to unauthenticated requesters', async () => {
    const server = Fastify({ logger: false });
    server.decorate('db', mockOwnerDb() as any);
    await server.register(validatePlugin);

    // Simulate a route that checks Authorization and sets request.user
    server.addHook('onRequest', (request: any, _reply, done) => {
      const auth = request.headers.authorization;
      if (auth === 'Bearer owner-token') {
        request.user = { uid: 'user-owner-123' };
      } else if (auth === 'Bearer attacker-token') {
        request.user = { uid: 'user-attacker-999' };
      }
      done();
    });

    await server.register(ticketRoutes);
    const response = await server.inject({
      method: 'GET',
      url: '/tickets/public/ENT-ORD-100-GEN-1',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.ticket.qrPayload).toBeNull();
    expect(body.ticket.entitlementId).toBe('ENT-ORD-100-GEN-1');
    expect(body.ticket.eventTitle).toBe('Test Event');
    await server.close();
  });

  it('never leaks qrPayload to a non-owner authenticated requester', async () => {
    const server = Fastify({ logger: false });
    server.decorate('db', mockOwnerDb() as any);
    await server.register(validatePlugin);
    server.addHook('onRequest', (request: any, _reply, done) => {
      const auth = request.headers.authorization;
      if (auth === 'Bearer owner-token') {
        request.user = { uid: 'user-owner-123' };
      } else if (auth === 'Bearer attacker-token') {
        request.user = { uid: 'user-attacker-999' };
      }
      done();
    });
    await server.register(ticketRoutes);

    const response = await server.inject({
      method: 'GET',
      url: '/tickets/public/ENT-ORD-100-GEN-1',
      headers: { authorization: 'Bearer attacker-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.ticket.qrPayload).toBeNull();
    await server.close();
  });

  it('returns 404 for non-existent entitlement', async () => {
    const server = Fastify({ logger: false });
    server.decorate('db', mockOwnerDb() as any);
    await server.register(validatePlugin);
    server.addHook('onRequest', (request: any, _reply, done) => {
      const auth = request.headers.authorization;
      if (auth === 'Bearer owner-token') {
        request.user = { uid: 'user-owner-123' };
      }
      done();
    });
    await server.register(ticketRoutes);

    const response = await server.inject({
      method: 'GET',
      url: '/tickets/public/NONEXISTENT',
    });

    expect(response.statusCode).toBe(404);
    await server.close();
  });

  it('still returns ticket details (event, venue, status) without auth', async () => {
    const server = Fastify({ logger: false });
    server.decorate('db', mockOwnerDb() as any);
    await server.register(validatePlugin);
    server.addHook('onRequest', (request: any, _reply, done) => {
      const auth = request.headers.authorization;
      if (auth === 'Bearer owner-token') {
        request.user = { uid: 'user-owner-123' };
      }
      done();
    });
    await server.register(ticketRoutes);

    const response = await server.inject({
      method: 'GET',
      url: '/tickets/public/ENT-ORD-100-GEN-1',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.ticket.eventTitle).toBe('Test Event');
    expect(body.ticket.venueName).toBe('Test Venue');
    expect(body.ticket.city).toBe('Test City');
    expect(body.ticket.state).toBe('ACTIVE');
    expect(body.ticket.checkedIn).toBeFalsy();
    await server.close();
  });
});
