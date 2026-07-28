import { describe, expect, it, vi } from 'vitest';
import { loadVenueDoorEntries } from './loadDoorEntries';

describe('loadVenueDoorEntries', () => {
  it('loads all venue door channels with exactly two bounded requests', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ entries: [{ id: 'walk-in-1' }] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ entries: [{ id: 'dine-in-1' }] }), { status: 200 }),
      );

    const result = await loadVenueDoorEntries({
      venueId: 'venue-1',
      eventId: 'event-1',
      token: 'token-1',
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      '/api/partners/venues/walk-ins?venueId=venue-1&limit=100&eventId=event-1',
      '/api/partners/venues/door/dinein?venueId=venue-1&limit=100&eventId=event-1',
    ]);
    expect(result).toEqual({
      walkIns: [{ id: 'walk-in-1' }],
      dineIns: [{ id: 'dine-in-1' }],
    });
  });
});
