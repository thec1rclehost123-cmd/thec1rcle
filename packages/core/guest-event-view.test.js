import { describe, expect, it, vi } from 'vitest';

vi.mock('./analytics-service.js', () => ({
  trackEventView: vi.fn(async () => true),
}));

import { trackGuestEventView } from './guest-event-conversion.js';

function ref(path) {
  return { path };
}

describe('guest event view persistence', () => {
  it('writes the durable event view counter even when analytics is fire-and-forget', async () => {
    const writes = [];
    const db = {
      collection: (name) => ({ doc: (id) => ref(`${name}/${id}`) }),
      runTransaction: async (handler) =>
        handler({
          get: async () => ({ exists: false }),
          set: (target, data, options) => writes.push({ path: target.path, data, options }),
        }),
    };

    await expect(
      trackGuestEventView(db, { eventId: 'event_1', viewerId: 'guest_1' }),
    ).resolves.toEqual({ ok: true });

    expect(writes.map((write) => write.path)).toEqual(
      expect.arrayContaining([
        'event_views/event_1',
        'events/event_1',
        expect.stringMatching(/^event_view_sessions\/event_1_/),
      ]),
    );
    expect(writes.find((write) => write.path === 'event_views/event_1')?.data).toMatchObject({
      eventId: 'event_1',
    });
  });
});
