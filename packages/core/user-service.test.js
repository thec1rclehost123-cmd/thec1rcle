import { beforeEach, describe, expect, it, vi } from 'vitest';

import { syncAuthUser } from './user-service.js';

function makeDb(initialUsers = {}) {
  const users = new Map(Object.entries(initialUsers));

  return {
    users,
    db: {
      collection: vi.fn((name) => {
        if (name !== 'users') throw new Error(`Unexpected collection: ${name}`);
        return {
          doc: vi.fn((id) => ({
            get: vi.fn(async () => ({
              exists: users.has(id),
              data: () => users.get(id),
            })),
            set: vi.fn(async (payload, options) => {
              users.set(id, options?.merge ? { ...(users.get(id) || {}), ...payload } : payload);
            }),
          })),
        };
      }),
    },
  };
}

describe('syncAuthUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a canonical guest profile with login timestamps for a new Firebase user', async () => {
    const { db, users } = makeDb();
    const auth = { setCustomUserClaims: vi.fn(async () => undefined) };

    const profile = await syncAuthUser(
      db,
      'user_new',
      {
        email: 'new@example.com',
        displayName: 'New User',
        photoURL: 'https://example.com/avatar.png',
      },
      { auth },
    );

    const saved = users.get('user_new');
    expect(saved).toMatchObject({
      uid: 'user_new',
      email: 'new@example.com',
      displayName: 'New User',
      role: 'guest',
      roles: ['guest'],
      isActive: true,
      onboardingComplete: false,
      profileComplete: false,
    });
    expect(saved.lastLoginAt).toEqual(expect.any(String));
    expect(saved.lastAuthSyncAt).toEqual(expect.any(String));
    expect(profile).toMatchObject({
      uid: 'user_new',
      role: 'guest',
      roles: ['guest'],
      isNewUser: true,
      lastLoginAt: saved.lastLoginAt,
      lastAuthSyncAt: saved.lastAuthSyncAt,
    });
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith(
      'user_new',
      expect.objectContaining({ role: 'guest', roles: ['guest'], app: 'thec1rcle' }),
    );
  });

  it('updates login timestamps without overwriting existing canonical profile fields', async () => {
    const { db, users } = makeDb({
      user_existing: {
        uid: 'user_existing',
        email: 'existing@example.com',
        displayName: 'Existing User',
        role: 'member',
        roles: ['member'],
        onboardingComplete: true,
        profileComplete: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-02T00:00:00.000Z',
        lastLoginAt: '2025-01-02T00:00:00.000Z',
      },
    });

    const profile = await syncAuthUser(db, 'user_existing', {
      email: 'ignored@example.com',
      displayName: 'Ignored Name',
      customClaims: { role: 'member', roles: ['member'], app: 'thec1rcle' },
    });

    const saved = users.get('user_existing');
    expect(saved.email).toBe('ignored@example.com');
    expect(saved.displayName).toBe('Existing User');
    expect(saved.role).toBe('member');
    expect(saved.roles).toEqual(['member']);
    expect(saved.createdAt).toBe('2025-01-01T00:00:00.000Z');
    expect(saved.lastLoginAt).not.toBe('2025-01-02T00:00:00.000Z');
    expect(saved.lastAuthSyncAt).toEqual(expect.any(String));
    expect(profile).toMatchObject({
      uid: 'user_existing',
      email: 'ignored@example.com',
      displayName: 'Existing User',
      role: 'member',
      roles: ['member'],
      onboardingComplete: true,
      profileComplete: true,
      isNewUser: false,
      lastLoginAt: saved.lastLoginAt,
      lastAuthSyncAt: saved.lastAuthSyncAt,
    });
  });
});
