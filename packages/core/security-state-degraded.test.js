/**
 * security-state — degraded-mode block resolution.
 *
 * Covers what happens to admin-suspension checks when Redis is unavailable and
 * the Firestore `security_blocks` mirror becomes the source of truth. The key
 * distinction under test: "we read the store and there is no block" must stay
 * separate from "we could not read any store at all", because the admin
 * middleware fails CLOSED only on the latter.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  // 'null' → toy mode (getAdminDb returns null)
  // 'throw' → configured but unreachable
  // 'doc'  → returns whatever `doc` holds
  dbMode: 'doc',
  doc: { exists: false, data: () => null },
}));

// Redis is hard-down for every test in this file: status is neither
// 'ready' nor 'connecting', which is what routes safeExec to its fallback.
vi.mock('./redis.js', () => ({
  getRedisClient: () => ({ status: 'end' }),
}));

vi.mock('./admin.js', () => ({
  getAdminDb: vi.fn(() => {
    if (state.dbMode === 'null') return null;
    if (state.dbMode === 'throw') throw new Error('Firestore unreachable');
    return {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn(async () => state.doc),
          ref: { delete: vi.fn(async () => {}) },
          delete: vi.fn(async () => {}),
        })),
      })),
    };
  }),
  isFirebaseConfigured: vi.fn(() => true),
  isToyMode: vi.fn(() => false),
}));

function blockDoc(expiresAt) {
  const data = { reason: 'compromised_credentials', expiresAt };
  return {
    exists: true,
    data: () => data,
    ref: { delete: vi.fn(async () => {}) },
  };
}

beforeEach(() => {
  state.dbMode = 'doc';
  state.doc = { exists: false, data: () => null };
  vi.restoreAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('isAdminSuspended — Redis down, Firestore reachable', () => {
  // The whole point of dual-writing suspensions to Firestore: a Redis-only
  // outage must NOT let a suspended admin back in.
  it('still reports a live suspension from the Firestore mirror', async () => {
    const { isAdminSuspended } = await import('./security-state.js');
    state.doc = blockDoc(new Date(Date.now() + 60_000).toISOString());

    const result = await isAdminSuspended('admin-123');
    expect(result.suspended).toBe(true);
    expect(result.reason).toBe('compromised_credentials');
    expect(result.unavailable).toBeFalsy();
  });

  it('reports not-suspended authoritatively when no block doc exists', async () => {
    const { isAdminSuspended } = await import('./security-state.js');
    state.doc = { exists: false, data: () => null };

    const result = await isAdminSuspended('admin-123');
    expect(result.suspended).toBe(false);
    // Authoritative answer — must not trip the middleware's fail-closed branch.
    expect(result.unavailable).toBeFalsy();
  });

  it('treats an expired suspension as not suspended', async () => {
    const { isAdminSuspended } = await import('./security-state.js');
    state.doc = blockDoc(new Date(Date.now() - 60_000).toISOString());

    const result = await isAdminSuspended('admin-123');
    expect(result.suspended).toBe(false);
    expect(result.unavailable).toBeFalsy();
  });
});

describe('isAdminSuspended — both stores unavailable', () => {
  // The genuine residual risk: Redis AND Firestore both down. We cannot prove
  // the admin isn't suspended, so we must surface that as indeterminate rather
  // than silently answering "not suspended".
  it('flags the result as unavailable so callers can fail closed', async () => {
    const { isAdminSuspended } = await import('./security-state.js');
    state.dbMode = 'throw';

    const result = await isAdminSuspended('admin-123');
    expect(result.suspended).toBe(false);
    expect(result.unavailable).toBe(true);
  });
});

describe('isAdminSuspended — no block store configured (toy mode)', () => {
  // getAdminDb() returns null under DEV_TOY_MODE. There is no mirror and nothing
  // was ever written to one, so this is an authoritative "no block" — not an
  // outage. Reporting it as unavailable would lock every admin out of local dev.
  it('reports not-suspended without flagging unavailable', async () => {
    const { isAdminSuspended } = await import('./security-state.js');
    state.dbMode = 'null';

    const result = await isAdminSuspended('admin-123');
    expect(result.suspended).toBe(false);
    expect(result.unavailable).toBeFalsy();
  });
});

describe('isUserBlocked / isIpBlocked — availability is preserved', () => {
  // Low-privilege paths intentionally keep failing open: a total outage must not
  // lock out the entire guest population.
  it('isUserBlocked returns not-blocked when both stores are down', async () => {
    const { isUserBlocked } = await import('./security-state.js');
    state.dbMode = 'throw';

    const result = await isUserBlocked('user-123');
    expect(result.blocked).toBe(false);
  });

  it('isIpBlocked still honours a live Firestore block during a Redis outage', async () => {
    const { isIpBlocked } = await import('./security-state.js');
    state.doc = blockDoc(new Date(Date.now() + 60_000).toISOString());

    const result = await isIpBlocked('1.2.3.4');
    expect(result.blocked).toBe(true);
  });
});
