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
    expect(ranked[0].reasonLabel).toContain('live music');
    expect(ranked[0].reasonLabel).toContain('Pune');
  });

  it('maps onboarding taxonomy to event vocabulary and changes ordering by city', () => {
    const candidates = [
      { id: 'pune-club', city: 'Pune', category: 'club', status: 'upcoming' },
      { id: 'mumbai-club', city: 'Mumbai', category: 'club', status: 'upcoming' },
    ];
    const base = {
      preferredTags: new Set(),
      preferredHosts: new Set(),
      pastEventIds: new Set(),
      onboardingTags: new Set(['clubs']),
      intents: new Set(),
    };

    expect(
      rankEventsForProfile(candidates, { ...base, preferredCities: new Set(['pune']) }, 2)[0].event
        .id,
    ).toBe('pune-club');
    expect(
      rankEventsForProfile(candidates, { ...base, preferredCities: new Set(['mumbai']) }, 2)[0]
        .event.id,
    ).toBe('mumbai-club');
  });

  it('excludes past and previously attended events', () => {
    const profile = {
      preferredTags: new Set(),
      preferredCities: new Set(),
      preferredHosts: new Set(),
      pastEventIds: new Set(['attended']),
      onboardingTags: new Set(),
      intents: new Set(),
    };
    const ranked = rankEventsForProfile(
      [
        { id: 'attended', status: 'upcoming' },
        { id: 'ended', lifecycle: 'ended' },
        { id: 'future', status: 'upcoming' },
      ],
      profile,
      5,
    );
    expect(ranked.map((item) => item.event.id)).toEqual(['future']);
  });
});
