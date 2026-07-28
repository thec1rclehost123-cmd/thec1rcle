import { describe, expect, it } from 'vitest';
import { MockFirestore } from '../test-utils/mock-firestore';
import { loadVenueScopedEvent } from './venueEventScope';

describe('loadVenueScopedEvent', () => {
  it('returns the event only for its exact venue', async () => {
    const db = new MockFirestore();
    db.seed('events/event_1', { venueId: 'venue_1', title: 'QA Cover Event' });

    await expect(loadVenueScopedEvent(db as any, 'event_1', 'venue_1')).resolves.toEqual({
      id: 'event_1',
      data: { venueId: 'venue_1', title: 'QA Cover Event' },
    });
  });

  it('returns the same non-enumerating null for missing and cross-venue events', async () => {
    const db = new MockFirestore();
    db.seed('events/event_1', { venueId: 'venue_1', title: 'Private Revenue Event' });

    await expect(loadVenueScopedEvent(db as any, 'event_1', 'venue_2')).resolves.toBeNull();
    await expect(loadVenueScopedEvent(db as any, 'missing', 'venue_2')).resolves.toBeNull();
  });
});
