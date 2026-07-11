import { describe, expect, it } from 'vitest';

import { rankEventsForProfile } from './recommendation-engine.js';

describe('explore-v2 recommendation ranking', () => {
  it('ranks onboarding city and taste matches and emits truthful reason metadata', () => {
    const profile = {
      preferredTags: new Set(),
      preferredCities: new Set(['pune']),
      preferredHosts: new Set(),
      pastEventIds: new Set(),
      onboardingTags: new Set(['live_music']),
      intents: new Set(['discover']),
    };
    const ranked = rankEventsForProfile(
      [
        { id: 'other', city: 'Mumbai', tags: ['club'], status: 'upcoming', heatScore: 100 },
        { id: 'match', city: 'Pune', tags: ['live_music'], status: 'upcoming', heatScore: 1 },
      ],
      profile,
      2,
    );

    expect(ranked[0]).toMatchObject({
      event: { id: 'match' },
      reasonCode: 'VIBE_AND_CITY_MATCH',
    });
    expect(ranked[0].reasonLabel).toContain('Pune');
  });
});
