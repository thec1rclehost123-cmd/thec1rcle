import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import validatePlugin from '../../plugins/validate';
import ticketRoutes from './tickets';

// Stub the entitlement engine so the test needs no QR signing secret / Firebase
// Admin app, and so "did we mint a credential / a share token?" is observable.
vi.mock('@c1rcle/core/entitlement-engine', () => ({
  PUBLIC_TOKEN_PREFIX: 'stk_',
  generatePublicToken: () => 'stk_freshly-minted-token',
}));

vi.mock('@c1rcle/core/ticket-checkout-wallet-service', () => ({
  createTicketQrForEntitlement: vi.fn(async ({ entitlementId }: { entitlementId: string }) => ({
    qrPayload: `signed-ticket-jwt:${entitlementId}`,
    qrExpiresAt: '2026-08-01T20:00:15.000Z',
  })),
  getUserTicketWallet: vi.fn(),
}));

// NOTE: entitlements store the holder in `ownerUserId` and the anonymous share
// capability in `publicToken` — the fields issueEntitlements()/transferEntitlement()
// actually write in packages/core/entitlement-engine.js.
function entitlementFixture(id: string, ownerUserId: string, publicToken: string | null = null) {
  return {
    id,
    entitlementId: id,
    ownerUserId,
    ...(publicToken ? { publicToken } : {}),
    eventId: 'event-1',
    checkedIn: false,
    state: 'ACTIVE',
    scanCountUsed: 0,
    scanCountAllowed: 1,
    metadata: { tierName: 'General', entryType: 'general' },
    eventSummary: { title: 'Test Event', venue: 'Test Venue', city: 'Test City' },
  };
}

// Records every entitlement doc write so the lazy-backfill path is observable.
const updates: Array<{ id: string; patch: any }> = [];

function mockDb() {
  const entitlements: Record<string, ReturnType<typeof entitlementFixture>> = {
    'ENT-ORD-100-GEN-1': entitlementFixture(
      'ENT-ORD-100-GEN-1',
      'user-owner-123',
      'stk_owner-token',
    ),
    'ENT-ORD-200-GEN-1': entitlementFixture(
      'ENT-ORD-200-GEN-1',
      'user-attacker-999',
      'stk_attacker-token',
    ),
    // Legacy ticket issued before publicToken existed — exercises backfill.
    'ENT-ORD-300-LEG-1': entitlementFixture('ENT-ORD-300-LEG-1', 'user-owner-123', null),
  };

  const makeRef = (id: string) => ({
    update: vi.fn(async (patch: any) => {
      updates.push({ id, patch });
      Object.assign(entitlements[id], patch);
    }),
  });

  const docSnap = (id: string) => {
    const data = entitlements[id];
    return { exists: Boolean(data), data: () => data ?? null, ref: makeRef(id) };
  };

  return {
    collection: vi.fn((name: string) => {
      if (name === 'entitlements') {
        return {
          doc: vi.fn((id: string) => ({ get: vi.fn(async () => docSnap(id)) })),
          where: vi.fn((field: string, _op: string, value: string) => ({
            limit: vi.fn(() => ({
              get: vi.fn(async () => {
                const match = Object.values(entitlements).find((e: any) => e[field] === value);
                const docs = match
                  ? [{ id: match.id, data: () => match, ref: makeRef(match.id) }]
                  : [];
                return { empty: docs.length === 0, docs };
              }),
            })),
          })),
        };
      }
      if (name === 'events') {
        return {
          doc: vi.fn((id: string) => ({
            get: vi.fn(async () => ({
              exists: id === 'event-1',
              data: () =>
                id === 'event-1'
                  ? {
                      title: 'Test Event',
                      startDate: '2026-08-01T20:00:00.000Z',
                      venue: 'Test Venue',
                      city: 'Test City',
                      image: 'https://example.com/poster.jpg',
                    }
                  : null,
            })),
          })),
        };
      }
      return {
        doc: vi.fn(() => ({ get: vi.fn(async () => ({ exists: false, data: () => null })) })),
      };
    }),
  };
}

async function buildServer() {
  updates.length = 0;
  const server = Fastify({ logger: false });
  server.decorate('db', mockDb() as any);
  await server.register(validatePlugin);

  // Stand in for the gateway's global optional-auth hook.
  server.addHook('onRequest', (request: any, _reply, done) => {
    const auth = request.headers.authorization;
    if (auth === 'Bearer owner-token') request.user = { uid: 'user-owner-123' };
    else if (auth === 'Bearer attacker-token') request.user = { uid: 'user-attacker-999' };
    done();
  });

  await server.register(ticketRoutes);
  return server;
}

function get(server: any, param: string, headers?: Record<string, string>) {
  return server.inject({
    method: 'GET',
    url: `/tickets/public/${param}`,
    ...(headers ? { headers } : {}),
  });
}

describe('GET /tickets/public — enumeration by raw entitlement ID is blocked', () => {
  it('404s an anonymous request that guesses a raw entitlement ID', async () => {
    const server = await buildServer();
    // The ID is real and exists, but anonymous access by ID must be indistinguishable
    // from a miss — this is the IDOR fix.
    const res = await get(server, 'ENT-ORD-100-GEN-1');
    expect(res.statusCode).toBe(404);
    await server.close();
  });

  it('404s an authenticated non-owner probing a raw entitlement ID', async () => {
    const server = await buildServer();
    const res = await get(server, 'ENT-ORD-100-GEN-1', { authorization: 'Bearer attacker-token' });
    expect(res.statusCode).toBe(404);
    await server.close();
  });

  it('404s a genuinely non-existent id/token', async () => {
    const server = await buildServer();
    expect((await get(server, 'ENT-DOES-NOT-EXIST')).statusCode).toBe(404);
    expect((await get(server, 'stk_does-not-exist')).statusCode).toBe(404);
    await server.close();
  });
});

describe('GET /tickets/public — owner access by raw entitlement ID', () => {
  it('serves the ticket, a QR, live state, and a share token to the owner', async () => {
    const server = await buildServer();
    const res = await get(server, 'ENT-ORD-100-GEN-1', { authorization: 'Bearer owner-token' });

    expect(res.statusCode).toBe(200);
    const { ticket } = res.json();
    expect(ticket.entitlementId).toBe('ENT-ORD-100-GEN-1');
    expect(ticket.state).toBe('ACTIVE');
    expect(ticket.qrPayload).toBe('signed-ticket-jwt:ENT-ORD-100-GEN-1');
    expect(ticket.qrExpiresAt).toBe('2026-08-01T20:00:15.000Z');
    expect(ticket.shareToken).toBe('stk_owner-token');
    await server.close();
  });

  it('signs the QR over the real entitlement id, never the share token', async () => {
    const server = await buildServer();
    // Owner reaches the page via the share-token URL.
    const res = await get(server, 'stk_owner-token', { authorization: 'Bearer owner-token' });
    expect(res.statusCode).toBe(200);
    expect(res.json().ticket.qrPayload).toBe('signed-ticket-jwt:ENT-ORD-100-GEN-1');
    await server.close();
  });

  it('lazily backfills a share token for a legacy ticket on first owner view', async () => {
    const server = await buildServer();
    const res = await get(server, 'ENT-ORD-300-LEG-1', { authorization: 'Bearer owner-token' });

    expect(res.statusCode).toBe(200);
    expect(res.json().ticket.shareToken).toBe('stk_freshly-minted-token');
    // ...and it was persisted so the next share is stable.
    expect(updates).toContainEqual({
      id: 'ENT-ORD-300-LEG-1',
      patch: { publicToken: 'stk_freshly-minted-token' },
    });
    await server.close();
  });
});

describe('GET /tickets/public — anonymous share via token', () => {
  it('serves ticket details to an anonymous holder of a valid token', async () => {
    const server = await buildServer();
    const res = await get(server, 'stk_owner-token');

    expect(res.statusCode).toBe(200);
    const { ticket } = res.json();
    expect(ticket.entitlementId).toBe('ENT-ORD-100-GEN-1');
    expect(ticket.eventTitle).toBe('Test Event');
    expect(ticket.venueName).toBe('Test Venue');
    await server.close();
  });

  it('withholds credential + live state + share token from a token-only viewer', async () => {
    const server = await buildServer();
    const res = await get(server, 'stk_owner-token');
    const { ticket } = res.json();

    expect(ticket.qrPayload).toBeNull();
    expect(ticket.state).toBeNull();
    expect(ticket.checkedIn).toBe(false);
    expect(ticket.shareToken).toBeNull();
    await server.close();
  });

  it('marks the response private so shared caches cannot cross-serve it', async () => {
    const server = await buildServer();
    const res = await get(server, 'stk_owner-token');
    expect(res.headers['cache-control']).toBe('private, no-store');
    await server.close();
  });
});
