import { describe, expect, it } from 'vitest';
import { recordRecommendationSignal } from './recommendation-signal-service.js';

function database(seed = {}) {
  let value = { discoveryProfile: { profileVersion: 2 }, ...seed };
  const ref = {
    get: async () => ({ exists: true, data: () => value }),
    set: async (update) => { value = { ...value, ...update }; },
  };
  return { db: { collection: () => ({ doc: () => ref }) }, read: () => value };
}

describe('recommendation signals', () => {
  it('normalizes and deduplicates privacy-safe category signals', async () => {
    const state = database();
    await recordRecommendationSignal(state.db, 'user-1', { type: 'category_browse', category: ' Live Music ' }, '2026-01-01T00:00:00.000Z');
    await recordRecommendationSignal(state.db, 'user-1', { type: 'category_browse', category: 'live-music' }, '2026-01-01T00:00:01.000Z');
    expect(state.read().discoveryProfile.behaviorSignals.browsedCategories).toEqual(['live_music']);
    expect(state.read().discoveryProfile).not.toHaveProperty('phoneNumber');
  });

  it('records event identifiers without accepting arbitrary fields', async () => {
    const state = database();
    await recordRecommendationSignal(state.db, 'user-1', { type: 'event_view', eventId: 'event-1', email: 'never@persist.test' });
    const signals = state.read().discoveryProfile.behaviorSignals;
    expect(signals.viewedEventIds).toEqual(['event-1']);
    expect(signals).not.toHaveProperty('email');
  });
});
