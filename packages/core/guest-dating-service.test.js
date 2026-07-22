import { describe, expect, it } from 'vitest';
import { getDiscoverProfiles, getPublicUserProfile } from './guest-dating-service.js';

function doc(id, data) {
  return { id, exists: Boolean(data), data: () => data };
}

function createDb(users) {
  return {
    collection(name) {
      if (name === 'userSwipes') {
        return {
          doc(id) {
            return { get: async () => doc(id, null) };
          },
        };
      }
      if (name !== 'users') throw new Error(`Unexpected collection: ${name}`);

      const query = {
        where() { return query; },
        orderBy() { return query; },
        limit() { return query; },
        startAfter() { return query; },
        async get() {
          return { docs: Object.entries(users).map(([id, value]) => doc(id, value)) };
        },
      };
      return {
        ...query,
        doc(id) {
          return { get: async () => doc(id, users[id]) };
        },
      };
    },
  };
}

describe('guest dating Nightlife profile contract', () => {
  it('returns portable photos, Nightlife-only vibes, and DOB-derived age', async () => {
    const currentYear = new Date().getUTCFullYear();
    const db = createDb({
      member: {
        displayName: 'Member Example',
        dateOfBirth: '2000-01-01',
        datingActive: true,
        datingPhotos: [
          'file:///private/profile.jpg',
          'https://storage.googleapis.com/c1rcle/member/profile.jpg',
        ],
        photos: ['https://example.com/legacy-should-not-win.jpg'],
        vibeTags: ['live_music', 'Techno'],
        nightlifeVibeTags: ['House', 'Dancing'],
        datingVitals: { height: `5'8"`, gender: 'Woman', location: 'Pune' },
      },
    });

    const profile = await getPublicUserProfile(db, 'member');

    expect(profile).toMatchObject({
      id: 'member',
      userId: 'member',
      age: currentYear - 2000,
      city: 'Pune',
      photos: ['https://storage.googleapis.com/c1rcle/member/profile.jpg'],
      nightlifeVibeTags: ['House', 'Dancing'],
      vibeTags: ['House', 'Dancing'],
    });
    expect(profile.vibeTags).not.toContain('live_music');
  });

  it('bridges only known legacy Nightlife labels and excludes consumer taste IDs', async () => {
    const db = createDb({
      viewer: { upcomingEvents: [] },
      legacy: {
        displayName: 'Legacy Member',
        datingActive: true,
        lastActiveAt: new Date().toISOString(),
        photos: ['https://example.com/legacy.jpg'],
        vibeTags: ['clubs', 'live_music', 'Techno', 'Low-Key'],
      },
    });

    const result = await getDiscoverProfiles(db, 'viewer');
    const profile = result.profiles.find((candidate) => candidate.id === 'legacy');

    expect(profile).toMatchObject({
      nightlifeVibeTags: ['Techno', 'Low-Key'],
      vibeTags: ['Techno', 'Low-Key'],
    });
    expect(profile.vibeTags).not.toContain('clubs');
    expect(profile.vibeTags).not.toContain('live_music');
  });
});
