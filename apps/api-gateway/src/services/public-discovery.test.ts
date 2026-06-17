import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicDiscoveryService } from '@c1rcle/core/public-discovery-service';

function buildService() {
  const service = new PublicDiscoveryService({} as any);
  return service as any;
}

describe('PublicDiscoveryService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('listEvents hides ended and non-public lifecycle items by default and dedupes ids', async () => {
    const service = buildService();
    service.events = {
      queryList: vi.fn(async () => [
        {
          id: 'event_live',
          visibility: 'public',
          lifecycle: 'live',
          statusKey: 'live',
          startAt: '2099-04-20T20:00:00.000Z',
          endAt: '2099-04-21T04:00:00.000Z',
        },
        {
          id: 'event_upcoming',
          visibility: 'public',
          lifecycle: 'scheduled',
          statusKey: 'upcoming',
          startAt: '2099-04-21T20:00:00.000Z',
          endAt: '2099-04-22T04:00:00.000Z',
        },
        {
          id: 'event_upcoming',
          visibility: 'public',
          lifecycle: 'scheduled',
          statusKey: 'upcoming',
          startAt: '2099-04-21T20:00:00.000Z',
          endAt: '2099-04-22T04:00:00.000Z',
        },
        {
          id: 'event_ended',
          visibility: 'public',
          lifecycle: 'scheduled',
          statusKey: 'ended',
          startAt: '2020-04-10T20:00:00.000Z',
          endAt: '2020-04-11T04:00:00.000Z',
        },
        {
          id: 'event_cancelled',
          visibility: 'public',
          lifecycle: 'cancelled',
          statusKey: 'canceled',
          startAt: '2099-04-22T20:00:00.000Z',
          endAt: '2099-04-23T04:00:00.000Z',
        },
        {
          id: 'event_approved',
          visibility: 'public',
          lifecycle: 'approved',
          statusKey: 'upcoming',
          startAt: '2099-04-23T20:00:00.000Z',
          endAt: '2099-04-24T04:00:00.000Z',
        },
      ]),
    };

    const result = await service.listEvents({ limit: 12, sort: 'soonest' });

    expect(result.items.map((item: any) => item.id)).toEqual([
      'event_live',
      'event_upcoming',
      'event_approved',
    ]);
  });

  it('listEvents preserves legacy city normalization for human city labels', async () => {
    const service = buildService();
    service.events = {
      queryList: vi.fn(async () => [
        {
          id: 'event_pune',
          visibility: 'public',
          lifecycle: 'scheduled',
          statusKey: 'upcoming',
          cityKey: 'pune-in',
          startAt: '2099-04-21T20:00:00.000Z',
          endAt: '2099-04-22T04:00:00.000Z',
        },
        {
          id: 'event_mumbai',
          visibility: 'public',
          lifecycle: 'scheduled',
          statusKey: 'upcoming',
          cityKey: 'mumbai-in',
          startAt: '2099-04-22T20:00:00.000Z',
          endAt: '2099-04-23T04:00:00.000Z',
        },
      ]),
    };

    const result = await service.listEvents({ limit: 12, city: 'Pune', sort: 'soonest' });

    expect(result.items.map((item: any) => item.id)).toEqual(['event_pune']);
    expect(result.appliedFilters.cityKey).toBe('pune-in');
  });

  it('listEvents accepts Explore aliases for category and date=tonight', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2099-04-20T12:00:00.000Z'));

    const service = buildService();
    service.events = {
      queryList: vi.fn(async () => [
        {
          id: 'event_club_today',
          visibility: 'public',
          lifecycle: 'scheduled',
          statusKey: 'upcoming',
          cityKey: 'mumbai-in',
          category: 'Club',
          eventType: 'club',
          startAt: '2099-04-20T20:00:00.000Z',
          endAt: '2099-04-21T04:00:00.000Z',
        },
        {
          id: 'event_art_today',
          visibility: 'public',
          lifecycle: 'scheduled',
          statusKey: 'upcoming',
          cityKey: 'mumbai-in',
          category: 'Gallery',
          eventType: 'gallery',
          startAt: '2099-04-20T19:00:00.000Z',
          endAt: '2099-04-21T01:00:00.000Z',
        },
        {
          id: 'event_club_tomorrow',
          visibility: 'public',
          lifecycle: 'scheduled',
          statusKey: 'upcoming',
          cityKey: 'mumbai-in',
          category: 'club',
          eventType: 'club',
          startAt: '2099-04-21T20:00:00.000Z',
          endAt: '2099-04-22T04:00:00.000Z',
        },
      ]),
    };

    const result = await service.listEvents({
      limit: 12,
      city: 'Mumbai',
      category: 'club',
      date: 'tonight',
      sort: 'soonest',
    });

    expect(result.items.map((item: any) => item.id)).toEqual(['event_club_today']);
    expect(result.appliedFilters).toMatchObject({
      cityKey: 'mumbai-in',
      category: 'club',
      eventType: 'club',
      datePreset: 'tonight',
    });
  });

  it('listEvents uses bounded read-model queries for first-page city browsing', async () => {
    const service = buildService();
    service.events = {
      queryList: vi.fn(async () => [
        {
          id: 'event_pune',
          visibility: 'public',
          lifecycle: 'scheduled',
          statusKey: 'upcoming',
          cityKey: 'pune-in',
          startAt: '2099-04-21T20:00:00.000Z',
          endAt: '2099-04-22T04:00:00.000Z',
        },
      ]),
      listAll: vi.fn(async () => {
        throw new Error('should not full-scan');
      }),
    };

    const result = await service.listEvents({ limit: 12, city: 'Pune', sort: 'soonest' });

    expect(result.items.map((item: any) => item.id)).toEqual(['event_pune']);
    expect(service.events.queryList).toHaveBeenCalled();
    expect(service.events.queryList).toHaveBeenCalledWith(
      expect.objectContaining({
        cityKey: 'pune-in',
        limit: 24,
      }),
    );
    expect(service.events.listAll).not.toHaveBeenCalled();
  });

  it('listFeaturedEvents reads heat-ranked cards directly instead of delegating through listEvents', async () => {
    const service = buildService();
    service.db = {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn(async () => ({
            exists: true,
            data: () => ({ featured: ['event_pin'] }),
          })),
        })),
      })),
    };
    service.events = {
      getByIdOrSlug: vi.fn(async (id: string) => ({
        id,
        visibility: 'public',
        lifecycle: 'scheduled',
        statusKey: 'upcoming',
        cityKey: 'pune-in',
        startAt: '2099-04-21T20:00:00.000Z',
        endAt: '2099-04-22T04:00:00.000Z',
      })),
      queryList: vi.fn(async () => [
        {
          id: 'event_heat',
          visibility: 'public',
          lifecycle: 'scheduled',
          statusKey: 'upcoming',
          cityKey: 'pune-in',
          startAt: '2099-04-22T20:00:00.000Z',
          endAt: '2099-04-23T04:00:00.000Z',
        },
      ]),
    };
    const listEventsSpy = vi.spyOn(service, 'listEvents');

    const result = await service.listFeaturedEvents({ limit: 6, city: 'Pune', sort: 'Trending' });

    expect(result.items.map((item: any) => item.id)).toEqual(['event_pin', 'event_heat']);
    expect(service.events.queryList).toHaveBeenCalledWith(
      expect.objectContaining({
        cityKey: 'pune-in',
        orderByField: 'heatScore',
        direction: 'desc',
      }),
    );
    expect(listEventsSpy).not.toHaveBeenCalled();
  });

  it('listHosts and listVenues use bounded read-model queries on first-page browse requests', async () => {
    const service = buildService();
    service.hosts = {
      queryList: vi.fn(async () => [
        { id: 'host_1', visibility: 'public', followersCount: 10, cityKey: 'pune-in' },
      ]),
      listAll: vi.fn(async () => {
        throw new Error('should not full-scan hosts');
      }),
    };
    service.venues = {
      queryList: vi.fn(async () => [
        {
          id: 'venue_1',
          visibility: 'public',
          followersCount: 20,
          tablesAvailable: true,
          cityKey: 'pune-in',
        },
      ]),
      listAll: vi.fn(async () => {
        throw new Error('should not full-scan venues');
      }),
    };

    const hosts = await service.listHosts({ limit: 12, city: 'Pune', sort: 'Most followed' });
    const venues = await service.listVenues({
      limit: 12,
      city: 'Pune',
      tablesOnly: 'true',
      sort: 'Most followed',
    });

    expect(hosts.items.map((item: any) => item.id)).toEqual(['host_1']);
    expect(venues.items.map((item: any) => item.id)).toEqual(['venue_1']);
    expect(service.hosts.queryList).toHaveBeenCalled();
    expect(service.venues.queryList).toHaveBeenCalled();
  });

  it('listHosts keeps scanning backend slices until filtered matches fill the page', async () => {
    const service = buildService();
    const firstChunk = Array.from({ length: 48 }, (_, index) => ({
      id: `host_${index + 1}`,
      visibility: 'public',
      cityKey: 'pune-in',
      role: 'DJ',
      vibes: ['Techno'],
      followersCount: 200 - index,
      trending: false,
    }));
    service.hosts = {
      queryList: vi.fn(async ({ cursor }: any) => {
        if (!cursor) {
          return firstChunk;
        }
        if (cursor.id === 'host_48') {
          return [
            {
              id: 'host_49',
              visibility: 'public',
              cityKey: 'pune-in',
              role: 'DJ',
              vibes: ['House'],
              followersCount: 70,
              trending: true,
            },
          ];
        }
        return [];
      }),
    };

    const result = await service.listHosts({
      limit: 1,
      city: 'Pune',
      role: 'DJ',
      vibe: 'House',
      status: 'Trending',
      sort: 'Most followed',
    });

    expect(result.items.map((item: any) => item.id)).toEqual(['host_49']);
    expect(service.hosts.queryList).toHaveBeenCalledTimes(2);
  });

  it('listVenues keeps scanning backend slices until filtered matches fill the page', async () => {
    const service = buildService();
    const firstChunk = Array.from({ length: 48 }, (_, index) => ({
      id: `venue_${index + 1}`,
      visibility: 'public',
      cityKey: 'pune-in',
      areaKey: 'koregaon-park',
      tags: ['Bollywood'],
      tablesAvailable: true,
      followersCount: 300 - index,
    }));
    service.venues = {
      queryList: vi.fn(async ({ cursor }: any) => {
        if (!cursor) {
          return firstChunk;
        }
        if (cursor.id === 'venue_48') {
          return [
            {
              id: 'venue_49',
              visibility: 'public',
              cityKey: 'pune-in',
              areaKey: 'koregaon-park',
              tags: ['House'],
              tablesAvailable: true,
              followersCount: 100,
            },
          ];
        }
        return [];
      }),
    };

    const result = await service.listVenues({
      limit: 1,
      city: 'Pune',
      area: 'Koregaon Park',
      vibe: 'House',
      tablesOnly: 'true',
      sort: 'Most followed',
    });

    expect(result.items.map((item: any) => item.id)).toEqual(['venue_49']);
    expect(service.venues.queryList).toHaveBeenCalledTimes(2);
  });

  it('search uses bounded prefix queries before falling back to full scans', async () => {
    const service = buildService();
    service.events = {
      querySearchPrefix: vi.fn(async () => [
        { id: 'event_1', visibility: 'public', searchText: 'after dark', heatScore: 40 },
      ]),
      listAll: vi.fn(async () => {
        throw new Error('should not full-scan events');
      }),
    };
    service.hosts = {
      querySearchPrefix: vi.fn(async () => [
        { id: 'host_1', visibility: 'public', searchText: 'after host', followersCount: 10 },
      ]),
      listAll: vi.fn(async () => {
        throw new Error('should not full-scan hosts');
      }),
    };
    service.venues = {
      querySearchPrefix: vi.fn(async () => [
        { id: 'venue_1', visibility: 'public', searchText: 'after venue', followersCount: 20 },
      ]),
      listAll: vi.fn(async () => {
        throw new Error('should not full-scan venues');
      }),
    };

    const result = await service.search('after', 6);

    expect(result.events.map((item: any) => item.id)).toEqual(['event_1']);
    expect(result.hosts.map((item: any) => item.id)).toEqual(['host_1']);
    expect(result.venues.map((item: any) => item.id)).toEqual(['venue_1']);
    expect(service.events.querySearchPrefix).toHaveBeenCalledWith('after', 36);
    expect(service.hosts.querySearchPrefix).toHaveBeenCalledWith('after', 36);
    expect(service.venues.querySearchPrefix).toHaveBeenCalledWith('after', 36);
    expect(service.events.listAll).not.toHaveBeenCalled();
    expect(service.hosts.listAll).not.toHaveBeenCalled();
    expect(service.venues.listAll).not.toHaveBeenCalled();
  });

  it('search stays bounded and returns empty groups when prefix queries fail', async () => {
    const service = buildService();
    service.events = {
      querySearchPrefix: vi.fn(async () => {
        throw new Error('missing index');
      }),
    };
    service.hosts = {
      querySearchPrefix: vi.fn(async () => []),
    };
    service.venues = {
      querySearchPrefix: vi.fn(async () => []),
    };

    const result = await service.search('after', 6);

    expect(result).toEqual({ events: [], hosts: [], venues: [] });
  });

  it('host and venue detail helpers avoid full collection scans when queryList fails', async () => {
    const service = buildService();
    service.hosts = {
      getBySlug: vi.fn(async () => ({
        id: 'host_1',
        slug: 'after-dark',
        followersCount: 10,
        upcomingEventsCount: 1,
      })),
    };
    service.venues = {
      getBySlug: vi.fn(async () => ({
        id: 'venue_1',
        slug: 'high-spirits',
        followersCount: 20,
        upcomingEventsCount: 2,
        cityKey: 'pune-in',
        areaKey: 'kp',
      })),
      queryList: vi.fn(async () => {
        throw new Error('missing index');
      }),
    };
    service.events = {
      queryList: vi.fn(async () => {
        throw new Error('missing index');
      }),
    };
    service.db = {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn(async () => ({ exists: false, data: () => null })),
        })),
        where: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn(async () => ({ empty: true, docs: [], size: 0 })),
            })),
            get: vi.fn(async () => ({ empty: true, docs: [], size: 0 })),
          })),
          limit: vi.fn(() => ({
            get: vi.fn(async () => ({ empty: true, docs: [], size: 0 })),
          })),
          get: vi.fn(async () => ({ empty: true, docs: [], size: 0 })),
        })),
      })),
    };

    const [hostDetail, venueDetail] = await Promise.all([
      service.getHostPublicProfile('after-dark'),
      service.getVenuePublicProfile('high-spirits'),
    ]);

    expect(hostDetail.upcomingEvents).toEqual([]);
    expect(hostDetail.pastEvents).toEqual([]);
    expect(venueDetail.upcomingEvents).toEqual([]);
    expect(venueDetail.pastEvents).toEqual([]);
    expect(venueDetail.similarVenues).toEqual([]);
  });

  it('syncEventReadModels stores normalized date fields for event cards', async () => {
    const service = buildService();
    const timestamp = { toDate: () => new Date('2026-04-24T18:30:00.000Z') };
    const upsert = vi.fn(async () => undefined);
    service.events = { upsert, delete: vi.fn(async () => undefined) };
    service.db = {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn(async () => ({
            exists: true,
            id: 'event_1',
            data: () => ({
              title: 'After Dark',
              visibility: 'public',
              lifecycle: 'scheduled',
              category: 'Party',
              city: 'Pune, IN',
              venue: 'High Spirits',
              startDate: timestamp,
              startTime: '21:00',
              tickets: [],
            }),
          })),
        })),
      })),
    };

    await service.syncEventReadModels('event_1');

    expect(upsert).toHaveBeenCalledWith(
      'event_1',
      expect.objectContaining({
        date: '2026-04-24T18:30:00.000Z',
        startDate: '2026-04-24T18:30:00.000Z',
        startDateTime: '2026-04-24T18:30:00.000Z',
        time: '21:00',
        startTime: '21:00',
      }),
    );
  });

  it('syncEventReadModels normalizes venue approved lifecycle and date-only end boundaries', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-21T12:00:00.000Z'));

    const service = buildService();
    const upsert = vi.fn(async () => undefined);
    service.events = { upsert, delete: vi.fn(async () => undefined) };
    service.db = {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn(async () => ({
            exists: true,
            id: 'event_today',
            data: () => ({
              title: 'Today Event',
              visibility: 'public',
              lifecycle: 'approved',
              creatorRole: 'venue',
              venueId: 'venue_1',
              category: 'Party',
              city: 'Pune',
              startDate: '2026-04-21',
              endDate: '2026-04-21',
              tickets: [],
            }),
          })),
        })),
      })),
    };

    await service.syncEventReadModels('event_today');

    expect(upsert).toHaveBeenCalledWith(
      'event_today',
      expect.objectContaining({
        lifecycle: 'live',
        statusKey: 'live',
        cityKey: 'pune-in',
        readModelVersion: 2,
      }),
    );
  });

  it('ensureEventCardsSeeded backfills legacy event card read models', async () => {
    const upsert = vi.fn(async () => undefined);
    const eventDoc = {
      exists: true,
      id: 'event_legacy',
      data: () => ({
        title: 'Legacy Event',
        visibility: 'public',
        lifecycle: 'approved',
        creatorRole: 'venue',
        venueId: 'venue_1',
        category: 'Music',
        city: 'Pune, IN',
        startDate: '2099-04-21',
        endDate: '2099-04-21',
        tickets: [],
      }),
    };
    const eventsCollection = {
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => ({
          get: vi.fn(async () => ({ empty: false, docs: [eventDoc] })),
        })),
      })),
      doc: vi.fn(() => ({ get: vi.fn(async () => eventDoc) })),
    };
    const db = {
      collection: vi.fn((name: string) => {
        if (name === 'system_meta')
          return {
            doc: vi.fn(() => ({
              get: vi.fn(async () => ({ exists: false })),
              set: vi.fn(async () => undefined),
            })),
          };
        if (name === 'events') return eventsCollection;
        return { limit: vi.fn(() => ({ get: vi.fn(async () => ({ empty: true, docs: [] })) })) };
      }),
    };
    const service = new PublicDiscoveryService(db as any) as any;
    service.events = {
      listAll: vi.fn(async () => [
        {
          id: 'event_legacy',
          visibility: 'public',
          lifecycle: 'approved',
          statusKey: 'upcoming',
          startDate: '2099-04-21',
          startDateTime: '2099-04-21',
          category: 'Music',
        },
      ]),
      upsert,
      delete: vi.fn(async () => undefined),
    };

    await service.ensureEventCardsSeeded();

    expect(eventsCollection.orderBy).toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(
      'event_legacy',
      expect.objectContaining({
        lifecycle: 'scheduled',
        readModelVersion: 2,
      }),
    );
  });

  it('bootstrapReadModels skips collection scans when bootstrap metadata is current', async () => {
    const set = vi.fn(async () => undefined);
    const db = {
      collection: vi.fn((name: string) => {
        if (name === 'system_meta') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn(async () => ({
                exists: true,
                data: () => ({
                  eventCardIndexVersion: 2,
                  hostSummaryVersion: 1,
                  venueSummaryVersion: 1,
                }),
              })),
              set,
            })),
          };
        }
        throw new Error(`Unexpected collection: ${name}`);
      }),
    };

    const service = new PublicDiscoveryService(db as any) as any;
    service.events = { listAll: vi.fn(async () => []) };
    service.hosts = { listAll: vi.fn(async () => []) };
    service.venues = { listAll: vi.fn(async () => []) };

    await service.bootstrapReadModels();

    expect(service.events.listAll).not.toHaveBeenCalled();
    expect(service.hosts.listAll).not.toHaveBeenCalled();
    expect(service.venues.listAll).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('bootstrapReadModels shares a single in-flight bootstrap run', async () => {
    let resolveBootstrap: (() => void) | undefined;
    const ensureEventCardsSeeded = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveBootstrap = resolve;
        }),
    );
    const ensureHostSummarySeeded = vi.fn(async () => undefined);
    const ensureVenueSummarySeeded = vi.fn(async () => undefined);
    const writeBootstrapState = vi.fn(async () => undefined);

    const service = new PublicDiscoveryService({} as any) as any;
    service.getBootstrapState = vi.fn(async () => null);
    service.ensureEventCardsSeeded = ensureEventCardsSeeded;
    service.ensureHostSummarySeeded = ensureHostSummarySeeded;
    service.ensureVenueSummarySeeded = ensureVenueSummarySeeded;
    service.writeBootstrapState = writeBootstrapState;
    service.events = { listAll: vi.fn(async () => []) };

    const first = service.bootstrapReadModels();
    const second = service.bootstrapReadModels();
    await Promise.resolve();

    expect(ensureEventCardsSeeded).toHaveBeenCalledTimes(1);

    const completeBootstrap = resolveBootstrap as () => void;
    completeBootstrap();
    await Promise.all([first, second]);

    expect(writeBootstrapState).toHaveBeenCalledTimes(1);
  });
});
