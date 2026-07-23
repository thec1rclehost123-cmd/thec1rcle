jest.mock('../../lib/api', () => ({
  apiFetch: jest.fn(),
}));

jest.mock('../../lib/demo', () => ({
  DEMO_EVENTS: [],
  PUBLIC_DEMO_MODE: false,
}));

import { useEventsStore, getHeatScore } from '../../store/eventsStore';
import { apiFetch } from '../../lib/api';

const mockApiFetch = apiFetch as jest.Mock;

const makeEvent = (overrides: Record<string, any> = {}) => ({
  id: 'evt_1',
  title: 'Test Event',
  description: 'A test event',
  startDate: '2026-07-01T18:00:00Z',
  endDate: '2026-07-01T23:00:00Z',
  venue: 'Test Venue',
  location: 'Mumbai',
  city: 'Mumbai',
  hostId: 'host_1',
  hostName: 'Test Host',
  coverImage: 'https://example.com/poster.jpg',
  category: 'party',
  isFeatured: true,
  heatScore: 85,
  ...overrides,
});

describe('eventsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useEventsStore.setState({
      events: [],
      featuredEvents: [],
      featuredLoading: false,
      searchResults: [],
      categoryEvents: {},
      categoryLoading: {},
      categoryLastId: {},
      categoryHasMore: {},
      loading: false,
      searching: false,
      error: null,
      lastId: null,
      hasMore: true,
    });
  });

  describe('fetchEvents', () => {
    it('reuses a fresh city result while allowing an explicit refresh', async () => {
      mockApiFetch.mockResolvedValue({ items: [makeEvent()], nextCursor: null });

      await useEventsStore.getState().fetchEvents('Mumbai');
      await useEventsStore.getState().fetchEvents('mumbai');
      expect(mockApiFetch).toHaveBeenCalledTimes(1);

      await useEventsStore.getState().fetchEvents('Mumbai', undefined, true);
      expect(mockApiFetch).toHaveBeenCalledTimes(2);
    });

    it('fetches events and appends on pagination', async () => {
      mockApiFetch.mockResolvedValueOnce({
        items: [makeEvent({ id: 'evt_1', title: 'Event 1' })],
        nextCursor: 'cursor_abc',
      });

      await useEventsStore.getState().fetchEvents('Mumbai');

      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/v1/events?city=Mumbai&limit=24&sort=soonest',
        { requireAuth: false },
      );
      let state = useEventsStore.getState();
      expect(state.events).toHaveLength(1);
      expect(state.events[0].id).toBe('evt_1');
      expect(state.lastId).toBe('cursor_abc');
      expect(state.hasMore).toBe(true);

      mockApiFetch.mockResolvedValueOnce({
        items: [makeEvent({ id: 'evt_2', title: 'Event 2' })],
        nextCursor: null,
      });

      await useEventsStore.getState().fetchEvents('Mumbai', 'cursor_abc');

      state = useEventsStore.getState();
      expect(state.events).toHaveLength(2);
      expect(state.hasMore).toBe(false);
    });

    it('skips duplicate fetch when already loading', async () => {
      useEventsStore.setState({ loading: true });

      await useEventsStore.getState().fetchEvents('Mumbai');

      expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it('handles fetch error gracefully', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(useEventsStore.getState().fetchEvents('Mumbai')).rejects.toThrow(
        'Network error',
      );

      const state = useEventsStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.loading).toBe(false);
    });

    it('sorts events by start date', async () => {
      mockApiFetch.mockResolvedValueOnce({
        items: [
          makeEvent({ id: 'evt_2', startDate: '2026-08-01T18:00:00Z' }),
          makeEvent({ id: 'evt_1', startDate: '2026-07-01T18:00:00Z' }),
        ],
      });

      await useEventsStore.getState().fetchEvents();

      const events = useEventsStore.getState().events;
      expect(events[0].id).toBe('evt_1');
      expect(events[1].id).toBe('evt_2');
    });

    it('uses startAt as the canonical event start when legacy fields disagree', async () => {
      mockApiFetch.mockResolvedValueOnce({
        items: [
          makeEvent({
            startAt: '2026-08-02T20:00:00.000Z',
            startDate: '2026-07-01T18:00:00.000Z',
          }),
        ],
      });

      await useEventsStore.getState().fetchEvents('Mumbai', undefined, true);

      expect(useEventsStore.getState().events[0].startDate).toBe('2026-08-02T20:00:00.000Z');
    });
  });

  describe('fetchFeaturedEvents', () => {
    it('uses heat-sorted events when fewer than 3 are featured', async () => {
      mockApiFetch.mockResolvedValueOnce({
        items: [
          makeEvent({ id: 'evt_1', isFeatured: true, heatScore: 80 }),
          makeEvent({ id: 'evt_2', isFeatured: false, heatScore: 90 }),
          makeEvent({ id: 'evt_3', isFeatured: false, heatScore: 70 }),
        ],
      });

      await useEventsStore.getState().fetchFeaturedEvents();

      const featured = useEventsStore.getState().featuredEvents;
      expect(featured.length).toBeGreaterThanOrEqual(1);
      expect(featured[0].heatScore || 0).toBeGreaterThanOrEqual(
        featured[featured.length - 1].heatScore || 0,
      );
    });

    it('falls back to heat-sorted when not enough featured events', async () => {
      mockApiFetch.mockResolvedValueOnce({
        items: [
          makeEvent({ id: 'evt_1', isFeatured: true, heatScore: 80 }),
          makeEvent({ id: 'evt_2', isFeatured: false, heatScore: 90 }),
          makeEvent({ id: 'evt_3', isFeatured: false, heatScore: 70 }),
        ],
      });

      await useEventsStore.getState().fetchFeaturedEvents();

      const featured = useEventsStore.getState().featuredEvents;
      expect(featured.length).toBeGreaterThanOrEqual(1);
      expect(featured[0].heatScore || 0).toBeGreaterThanOrEqual(
        featured[featured.length - 1].heatScore || 0,
      );
    });

    it('sets featuredLoading guard', async () => {
      useEventsStore.setState({ featuredLoading: true });

      await useEventsStore.getState().fetchFeaturedEvents();

      expect(mockApiFetch).not.toHaveBeenCalled();
    });
  });

  describe('fetchPublicEvents', () => {
    it('fetches public events with limit', async () => {
      mockApiFetch.mockResolvedValueOnce({
        items: [makeEvent({ id: 'evt_1' }), makeEvent({ id: 'evt_2' })],
      });

      await useEventsStore.getState().fetchPublicEvents({ limit: 10 });

      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/events?limit=10&sort=soonest', {
        requireAuth: false,
      });
      expect(useEventsStore.getState().events).toHaveLength(2);
    });
  });

  describe('searchEvents', () => {
    it('searches with query and returns filtered results', async () => {
      mockApiFetch.mockResolvedValueOnce({
        items: [
          makeEvent({ id: 'evt_1', title: 'Summer Party', city: 'Mumbai' }),
          makeEvent({ id: 'evt_2', title: 'Winter Gala', city: 'Mumbai' }),
        ],
      });

      await useEventsStore.getState().searchEvents({
        query: 'Summer',
        city: 'Mumbai',
      });

      const results = useEventsStore.getState().searchResults;
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Summer Party');
    });

    it('filters by price range', async () => {
      mockApiFetch.mockResolvedValueOnce({
        items: [
          makeEvent({
            id: 'evt_1',
            tickets: [{ id: 't1', name: 'GA', price: 500, remaining: 100, quantity: 100 }],
          }),
          makeEvent({
            id: 'evt_2',
            tickets: [{ id: 't2', name: 'VIP', price: 2000, remaining: 50, quantity: 50 }],
          }),
        ],
      });

      await useEventsStore.getState().searchEvents({ priceMin: 100, priceMax: 1000 });

      const results = useEventsStore.getState().searchResults;
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('evt_1');
    });

    it('filters by date range', async () => {
      mockApiFetch.mockResolvedValueOnce({
        items: [
          makeEvent({ id: 'evt_1', startDate: '2026-07-01T18:00:00Z' }),
          makeEvent({ id: 'evt_2', startDate: '2026-08-15T18:00:00Z' }),
        ],
      });

      await useEventsStore.getState().searchEvents({
        dateFrom: new Date('2026-08-01'),
        dateTo: new Date('2026-08-31'),
      });

      const results = useEventsStore.getState().searchResults;
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('evt_2');
    });

    it('honours searching guard', async () => {
      useEventsStore.setState({ searching: true });

      await useEventsStore.getState().searchEvents({ query: 'test' });

      expect(mockApiFetch).not.toHaveBeenCalled();
    });
  });

  describe('loadMoreEvents', () => {
    it('does not load when hasMore is false', async () => {
      useEventsStore.setState({ hasMore: false });

      await useEventsStore.getState().loadMoreEvents();

      expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it('does not load when already loading', async () => {
      useEventsStore.setState({ loading: true });

      await useEventsStore.getState().loadMoreEvents();

      expect(mockApiFetch).not.toHaveBeenCalled();
    });
  });

  describe('getEventById', () => {
    it('fetches and normalizes event by id', async () => {
      mockApiFetch.mockResolvedValueOnce({
        event: makeEvent({ id: 'evt_detail', title: 'Detail Event' }),
      });

      const event = await useEventsStore.getState().getEventById('evt_detail');

      expect(event).not.toBeNull();
      expect(event?.id).toBe('evt_detail');
      expect(event?.title).toBe('Detail Event');
      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/events/evt_detail', {
        requireAuth: false,
      });
    });

    it('returns null for empty id', async () => {
      const event = await useEventsStore.getState().getEventById('');
      expect(event).toBeNull();
    });

    it('deduplicates in-flight requests for same id', async () => {
      const resolveLater: (value: any) => void = jest.fn();
      mockApiFetch.mockImplementationOnce(
        () =>
          new Promise((r) => {
            setTimeout(() => r({ event: makeEvent({ id: 'evt_inflight' }) }), 100);
          }),
      );

      const p1 = useEventsStore.getState().getEventById('evt_inflight');
      const p2 = useEventsStore.getState().getEventById('evt_inflight');

      const [e1, e2] = await Promise.all([p1, p2]);

      expect(mockApiFetch).toHaveBeenCalledTimes(1);
      expect(e1?.id).toBe('evt_inflight');
      expect(e2?.id).toBe('evt_inflight');
    });

    it('returns null on fetch error', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('Not found'));

      const event = await useEventsStore.getState().getEventById('evt_missing_unique');
      expect(event).toBeNull();
    });
  });

  describe('clearSearch', () => {
    it('clears search results and searching flag', () => {
      useEventsStore.setState({ searchResults: [makeEvent()], searching: true });

      useEventsStore.getState().clearSearch();

      const state = useEventsStore.getState();
      expect(state.searchResults).toEqual([]);
      expect(state.searching).toBe(false);
    });
  });

  describe('fetchByCategory', () => {
    it('fetches events filtered by category', async () => {
      mockApiFetch.mockResolvedValueOnce({
        items: [
          makeEvent({ id: 'evt_cat_1', category: 'party' }),
          makeEvent({ id: 'evt_cat_2', category: 'party' }),
        ],
      });

      await useEventsStore.getState().fetchByCategory('party');

      expect(useEventsStore.getState().categoryEvents['party']).toHaveLength(2);
    });

    it('respects category loading guard', async () => {
      useEventsStore.setState({ categoryLoading: { concert: true } });

      await useEventsStore.getState().fetchByCategory('concert');

      expect(mockApiFetch).not.toHaveBeenCalled();
    });
  });

  describe('getHeatScore', () => {
    it('returns heatScore field', () => {
      expect(getHeatScore(makeEvent({ heatScore: 95 }))).toBe(95);
    });

    it('falls back to stats.heatScore', () => {
      expect(getHeatScore(makeEvent({ heatScore: undefined, stats: { heatScore: 70 } }))).toBe(70);
    });

    it('returns 0 when no heat score available', () => {
      expect(getHeatScore(makeEvent({ heatScore: undefined }))).toBe(0);
    });
  });

  describe('normalizeEvent field mapping', () => {
    it('maps alternative field names', async () => {
      mockApiFetch.mockResolvedValueOnce({
        event: {
          eventId: 'evt_alt',
          name: 'Alt Named Event',
          startAt: '2026-07-15T20:00:00Z',
          endAt: '2026-07-16T02:00:00Z',
          venueName: 'Alt Venue',
          address: 'Alt Address',
          hostData: { id: 'host_alt', name: 'Alt Host' },
          posterUrl: 'https://example.com/alt.jpg',
          cityName: 'Delhi',
        },
      });

      const event = await useEventsStore.getState().getEventById('evt_alt_mapping');

      expect(event).not.toBeNull();
      expect(event?.id).toBe('evt_alt');
      expect(event?.title).toBe('Alt Named Event');
      expect(event?.venue).toBe('Alt Venue');
      expect(event?.hostName).toBe('Alt Host');
      expect(event?.hostId).toBe('host_alt');
      expect(event?.city).toBe('Delhi');
    });

    it('handles ticket normalization from multiple sources', async () => {
      mockApiFetch.mockResolvedValueOnce({
        items: [
          makeEvent({
            id: 'evt_tickets',
            tickets: [
              { tierId: 't1', tierName: 'Early Bird', price: 500, capacity: 100, available: 80 },
              { name: 'VIP', amountPaise: 200000, quantity: 50, remaining: 30 },
            ],
          }),
        ],
      });

      await useEventsStore.getState().fetchEvents();

      const event = useEventsStore.getState().events.find((e) => e.id === 'evt_tickets');
      expect(event).toBeDefined();
      expect(event!.tickets).toHaveLength(2);
      expect(event!.minPrice).toBe(500);
    });
  });
});
