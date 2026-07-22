import { describe, expect, it } from 'vitest';
import { buildSafeProfileSettingsUpdate } from './profile-settings-service';

const completeNightlifeProfile = {
  datingPhotos: ['https://storage.googleapis.com/c1rcle/users/user-1/profile.jpg'],
  datingVitals: { height: `5'8"`, pronouns: 'Prefer not to say', lifestyle: 'Sober' },
  nightlifeVibeTags: ['Techno'],
  prompts: [
    {
      promptId: 'night-out',
      question: 'My perfect night out starts with',
      answer: 'Good music',
      type: 'text' as const,
    },
  ],
};

describe('buildSafeProfileSettingsUpdate Nightlife activation', () => {
  it('stores a complete profile without overwriting consumer recommendation tastes', () => {
    const result = buildSafeProfileSettingsUpdate(
      { ...completeNightlifeProfile, datingActive: true },
      { vibeTags: ['clubs', 'live_music', 'lounges'] },
      '2026-07-17T20:00:00.000Z',
    );

    expect(result.error).toBeUndefined();
    expect(result.safeUpdates).toMatchObject({
      datingActive: true,
      nightlifeProfileComplete: true,
      nightlifeVibeTags: ['Techno'],
      lastActiveAt: '2026-07-17T20:00:00.000Z',
    });
    expect(result.safeUpdates).not.toHaveProperty('vibeTags');
    expect(result.safeUpdates).not.toHaveProperty('photos');
  });

  it('keeps basic and Nightlife photo arrays independent', () => {
    const nightlifeUpdate = buildSafeProfileSettingsUpdate({
      datingPhotos: completeNightlifeProfile.datingPhotos,
    });
    const basicUpdate = buildSafeProfileSettingsUpdate({
      photos: ['https://storage.googleapis.com/c1rcle/users/user-1/basic.jpg'],
    });

    expect(nightlifeUpdate.safeUpdates).toMatchObject({
      datingPhotos: completeNightlifeProfile.datingPhotos,
    });
    expect(nightlifeUpdate.safeUpdates).not.toHaveProperty('photos');
    expect(basicUpdate.safeUpdates).toMatchObject({
      photos: ['https://storage.googleapis.com/c1rcle/users/user-1/basic.jpg'],
    });
    expect(basicUpdate.safeUpdates).not.toHaveProperty('datingPhotos');
  });

  it('rejects device-local photos when activating', () => {
    const result = buildSafeProfileSettingsUpdate({
      ...completeNightlifeProfile,
      datingPhotos: ['file:///data/user/0/com.c1rcle.app/cache/profile.jpg'],
      datingActive: true,
    });

    expect(result).toMatchObject({
      error: 'Add at least one uploaded profile photo',
      statusCode: 400,
    });
  });

  it('rejects activation until required vitals, vibes, and prompts are complete', () => {
    const result = buildSafeProfileSettingsUpdate({
      datingPhotos: completeNightlifeProfile.datingPhotos,
      datingVitals: { height: `5'8"`, lifestyle: 'Sober' },
      nightlifeVibeTags: [],
      prompts: [],
      datingActive: true,
    });

    expect(result).toMatchObject({
      error: 'Height, pronouns, and lifestyle are required',
      statusCode: 400,
    });
  });

  it('allows an incomplete profile to be paused', () => {
    const result = buildSafeProfileSettingsUpdate(
      { datingActive: false },
      { datingActive: true },
      '2026-07-17T20:00:00.000Z',
    );

    expect(result.error).toBeUndefined();
    expect(result.safeUpdates.datingActive).toBe(false);
  });

  it('prevents an active profile from deleting its last photo', () => {
    const result = buildSafeProfileSettingsUpdate(
      { datingPhotos: [] },
      { datingActive: true, ...completeNightlifeProfile },
    );

    expect(result).toMatchObject({
      error: 'Add at least one uploaded profile photo',
      statusCode: 400,
    });
  });
});
