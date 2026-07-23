/**
 * entitlement-engine — public share token.
 *
 * The share token is the unguessable capability that authorises anonymous
 * viewing of a ticket (deterministic entitlement IDs must never do that). These
 * tests pin its shape/entropy and prove issuance writes one, stably across the
 * idempotent-retry path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = vi.hoisted(() => ({ events: new Map(), entitlements: new Map() }));

// Minimal in-memory Firestore: enough for issueEntitlements' event read plus its
// transactional get/set against known entitlement doc refs.
vi.mock('./admin.js', () => {
  const docRef = (map, id) => ({
    id,
    get: async () => ({ exists: map.has(id), data: () => map.get(id) ?? null }),
    set: (data) => map.set(id, data),
  });
  const collection = (name) => {
    const map = name === 'events' ? store.events : store.entitlements;
    return { doc: (id) => docRef(map, id) };
  };
  const db = {
    collection,
    runTransaction: async (fn) =>
      fn({
        get: async (ref) => ref.get(),
        set: (ref, data) => ref.set(data),
      }),
  };
  return { getAdminDb: () => db, isFirebaseConfigured: () => true, isToyMode: () => false };
});

vi.mock('./secret-registry.js', () => ({ getQrSecret: () => 'test-qr-secret' }));

beforeEach(() => {
  store.events.clear();
  store.entitlements.clear();
});

describe('generatePublicToken', () => {
  it('is prefixed, URL-safe, and high-entropy', async () => {
    const { generatePublicToken, PUBLIC_TOKEN_PREFIX } = await import('./entitlement-engine.js');
    const token = generatePublicToken();

    expect(PUBLIC_TOKEN_PREFIX).toBe('stk_');
    expect(token.startsWith('stk_')).toBe(true);
    const body = token.slice(PUBLIC_TOKEN_PREFIX.length);
    // 24 random bytes → 32 base64url chars, no padding, URL-safe alphabet only.
    expect(body).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it('does not collide across many draws', async () => {
    const { generatePublicToken } = await import('./entitlement-engine.js');
    const tokens = new Set(Array.from({ length: 1000 }, () => generatePublicToken()));
    expect(tokens.size).toBe(1000);
  });
});

describe('issueEntitlements — share token issuance', () => {
  const order = { id: 'ORD-1', eventId: 'EVT-1', userId: 'user-1' };

  it('writes a distinct share token on every issued entitlement', async () => {
    const { issueEntitlements, PUBLIC_TOKEN_PREFIX } = await import('./entitlement-engine.js');
    store.events.set('EVT-1', { title: 'Test' });

    const result = await issueEntitlements(order, [
      { ticketId: 'GEN', quantity: 2, name: 'General' },
    ]);

    expect(result).toHaveLength(2);
    for (const ent of result) {
      expect(ent.publicToken.startsWith(PUBLIC_TOKEN_PREFIX)).toBe(true);
    }
    expect(result[0].publicToken).not.toBe(result[1].publicToken);
  });

  it('keeps the share token stable across an idempotent re-issue', async () => {
    const { issueEntitlements } = await import('./entitlement-engine.js');
    store.events.set('EVT-1', { title: 'Test' });

    const first = await issueEntitlements(order, [
      { ticketId: 'GEN', quantity: 1, name: 'General' },
    ]);
    const retry = await issueEntitlements(order, [
      { ticketId: 'GEN', quantity: 1, name: 'General' },
    ]);

    // A retry must return the already-persisted docs — same deterministic ID and
    // the same token, never a regenerated one.
    expect(retry[0].id).toBe(first[0].id);
    expect(retry[0].publicToken).toBe(first[0].publicToken);
  });
});
