import { buildPublicSearchPath, mapPublicSearchResponse } from '@/lib/publicSearch';

describe('public search contract', () => {
  it('uses the bounded public endpoint for all groups', () => {
    expect(buildPublicSearchPath('after dark', 'all', 'All Cities')).toBe(
      '/api/v1/public/search?q=after+dark&limit=8',
    );
  });

  it('sends the selected type and city for a focused search', () => {
    expect(buildPublicSearchPath('NOWL', 'venues', 'Pune')).toBe(
      '/api/v1/public/search?q=NOWL&limit=24&type=venues&city=Pune',
    );
  });

  it('maps event, venue, and host groups without losing navigation ids', () => {
    expect(
      mapPublicSearchResponse(
        {
          events: [{ eventId: 'event_1', title: 'After Dark', venueName: 'NOWL' }],
          venues: [{ id: 'venue_1', name: 'NOWL', city: 'Pune' }],
          hosts: [{ id: 'host_1', displayName: 'Ritz', upcomingEventsCount: 2 }],
        },
        'all',
      ),
    ).toMatchObject([
      { id: 'event_1', type: 'event', title: 'After Dark' },
      { id: 'venue_1', type: 'venue', title: 'NOWL', data: { venueId: 'venue_1' } },
      { id: 'host_1', type: 'host', title: 'Ritz', data: { hostId: 'host_1' } },
    ]);
  });

  it('returns only the requested result group', () => {
    const results = mapPublicSearchResponse(
      {
        events: [{ id: 'event_1', title: 'NOWL Party' }],
        venues: [{ id: 'venue_1', name: 'NOWL' }],
        hosts: [{ id: 'host_1', name: 'NOWL Crew' }],
      },
      'venues',
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: 'venue_1', type: 'venue', title: 'NOWL' });
  });
});
