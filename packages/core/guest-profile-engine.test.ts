import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  docGet: vi.fn(),
  docUpdate: vi.fn(),
  authGetUser: vi.fn(),
}));

vi.mock('@c1rcle/core/admin', () => ({
  getAdminApp: () => ({}),
  getAdminDb: () => ({
    collection: () => ({
      doc: () => ({
        get: mocks.docGet,
        update: mocks.docUpdate,
      }),
    }),
  }),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    getUser: mocks.authGetUser,
  }),
}));

import { getUserProfile } from './guest-profile-engine.js';

describe('guest-profile-engine', () => {
  it('uses stored gallery photos as the normalized profile image when avatar fields are blank', async () => {
    mocks.docGet.mockResolvedValueOnce({
      exists: true,
      id: 'user_1',
      data: () => ({
        uid: 'user_1',
        displayName: 'Aayush Divase',
        photoURL: '',
        avatar: '',
        photos: ['https://cdn.example.com/gallery-1.jpg', 'https://cdn.example.com/gallery-2.jpg'],
      }),
    });

    const profile = await getUserProfile('user_1', 'user_1');

    expect(profile).toMatchObject({
      displayName: 'Aayush Divase',
      photoURL: 'https://cdn.example.com/gallery-1.jpg',
      avatar: 'https://cdn.example.com/gallery-1.jpg',
    });
    expect(mocks.authGetUser).not.toHaveBeenCalled();
  });
});
