import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import { DEMO_EVENTS, PUBLIC_DEMO_MODE } from '@/lib/demo';

// Event type matching Firestore schema
export interface Event {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  venue?: string;
  location?: string;
  city?: string;
  hostId?: string;
  hostName?: string;
  coverImage?: string;
  tickets?: TicketTier[];
  minPrice?: number;
  status?: string;
  lifecycle?: string; // Canonical state: draft, scheduled, live, etc.
  heatScore?: number;
  category?: string; // e.g., "club", "concert", "festival", "party", "brunch"
  type?: string; // Alternative categorization
  tags?: string[];
  stats?: {
    views?: number;
    saves?: number;
    shares?: number;
    rsvps?: number;
  };
  isFeatured?: boolean;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  activeAvatars?: string[];
  poster?: string; // Standard DB field
  image?: string; // Standard DB field
  images?: string[];
  venueId?: string;
  venueName?: string;
  address?: string;
  slug?: string;
  statusKey?: string;
  ticketTiers?: TicketTier[];
  tiers?: TicketTier[];
  interestedData?: {
    count?: number;
    users?: any[];
  };
}

export interface TicketTier {
  id: string;
  tierId?: string;
  name: string;
  price: number;
  quantity: number;
  remaining: number;
  soldPercent?: number;
  description?: string;
  entryType?: string;
}

export interface SearchFilters {
  query?: string;
  city?: string;
  category?: string;
  dateFrom?: Date;
  dateTo?: Date;
  priceMin?: number;
  priceMax?: number;
}

// Robust heat score extractor (mirrors Guest Portal logic)
export function getHeatScore(e: Event): number {
  return e.heatScore ?? (e as any).stats?.heatScore ?? 0;
}

interface EventsState {
  events: Event[];
  featuredEvents: Event[];
  featuredLoading: boolean;
  searchResults: Event[];
  categoryEvents: Record<string, Event[]>;
  categoryLoading: Record<string, boolean>;
  categoryLastId: Record<string, string | null>;
  categoryHasMore: Record<string, boolean>;
  loading: boolean;
  searching: boolean;
  error: string | null;
  lastId: string | null;
  hasMore: boolean;

  // Actions
  fetchEvents: (city?: string) => Promise<void>;
  fetchFeaturedEvents: () => Promise<void>;
  fetchPublicEvents: (options?: { limit?: number }) => Promise<void>;
  searchEvents: (filters: SearchFilters) => Promise<void>;
  loadMoreEvents: () => Promise<void>;
  getEventById: (id: string) => Promise<Event | null>;
  clearSearch: () => void;
  fetchByCategory: (category: string, city?: string) => Promise<void>;
  loadMoreByCategory: (category: string, city?: string) => Promise<void>;
}

type EventListResponse = {
  items?: any[];
  events?: any[];
  data?: {
    items?: any[];
    events?: any[];
  };
  nextCursor?: string | null;
  lastId?: string | null;
  hasMore?: boolean;
};

function toIsoString(value: any): string {
  try {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value.seconds != null) return new Date(value.seconds * 1000).toISOString();
  } catch {
    // ignore malformed date fields
  }
  return '';
}

function normalizeTicketTier(raw: any): TicketTier {
  const id = String(raw?.id || raw?.tierId || raw?.ticketId || raw?.name || 'ticket-tier');
  const quantity = Number(raw?.quantity ?? raw?.capacity ?? raw?.total ?? 0);
  const remaining = Number(raw?.remaining ?? raw?.available ?? raw?.availableQuantity ?? quantity);
  const price =
    raw?.price ??
    raw?.amount ??
    (raw?.pricePaise !== undefined ? Number(raw.pricePaise) / 100 : undefined) ??
    (raw?.amountPaise !== undefined ? Number(raw.amountPaise) / 100 : undefined) ??
    0;

  return {
    ...raw,
    id,
    tierId: raw?.tierId || id,
    name: String(raw?.name || raw?.tierName || raw?.label || 'General Entry'),
    price: Number(price),
    quantity,
    remaining: Number.isFinite(remaining) ? remaining : 0,
    soldPercent: Number(raw?.soldPercent ?? 0),
    description: raw?.description,
    entryType: raw?.entryType,
  };
}

function extractTicketTiers(source: any): TicketTier[] {
  const raw =
    source?.tickets ||
    source?.ticketTiers ||
    source?.tiers ||
    source?.data?.tiers ||
    source?.data?.tickets ||
    [];

  return Array.isArray(raw) ? raw.map(normalizeTicketTier) : [];
}

function calculateMinPrice(source: any, tickets: TicketTier[]): number | undefined {
  const explicit = source?.minPrice ?? source?.lowestPrice ?? source?.priceFrom;
  if (explicit !== undefined && explicit !== null && Number.isFinite(Number(explicit))) {
    return Number(explicit);
  }

  const availablePrices = tickets
    .filter((tier) => tier.remaining > 0)
    .map((tier) => Number(tier.price))
    .filter((price) => Number.isFinite(price));
  if (availablePrices.length > 0) return Math.min(...availablePrices);

  const allPrices = tickets
    .map((tier) => Number(tier.price))
    .filter((price) => Number.isFinite(price));
  if (allPrices.length > 0) return Math.min(...allPrices);

  return undefined;
}

function toFiniteNumber(value: any): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeCoordinates(source: any): Event['coordinates'] | undefined {
  const raw = source?.coordinates || source?.geo || source?._geoloc || source?.locationCoordinates;
  const latitude =
    toFiniteNumber(raw?.latitude) ?? toFiniteNumber(raw?.lat) ?? toFiniteNumber(source?.latitude);
  const longitude =
    toFiniteNumber(raw?.longitude) ??
    toFiniteNumber(raw?.lng) ??
    toFiniteNumber(raw?.lon) ??
    toFiniteNumber(source?.longitude);
  if (latitude === null || longitude === null) return undefined;
  return { latitude, longitude };
}

function normalizeEvent(raw: any): Event {
  const tickets = extractTicketTiers(raw);
  const startDate =
    toIsoString(raw?.startDate) ||
    toIsoString(raw?.startAt) ||
    toIsoString(raw?.startsAt) ||
    toIsoString(raw?.date);
  const endDate = toIsoString(raw?.endDate) || toIsoString(raw?.endAt) || toIsoString(raw?.endsAt);
  const coverImage =
    raw?.coverImage ||
    raw?.coverPhoto ||
    raw?.posterUrl ||
    raw?.poster ||
    raw?.image ||
    raw?.images?.[0] ||
    '';

  return {
    ...raw,
    id: String(raw?.id || raw?.eventId || raw?.slug || ''),
    title: String(raw?.title || raw?.name || 'Untitled event'),
    description: raw?.description,
    startDate,
    endDate,
    venue: raw?.venue || raw?.venueName || raw?.venueData?.name || raw?.locationName,
    location: raw?.location || raw?.address || raw?.area || raw?.venueData?.area,
    city: raw?.city || raw?.cityName || raw?.cityKey,
    hostId: raw?.hostId || raw?.hostData?.id,
    hostName: raw?.hostName || raw?.hostData?.name || raw?.host,
    coverImage,
    category: raw?.category || raw?.eventType || raw?.curatedCategory,
    type: raw?.type || raw?.eventType || raw?.category,
    poster: raw?.poster || raw?.posterUrl || coverImage,
    image: raw?.image || coverImage,
    tickets,
    ticketTiers: tickets,
    tiers: tickets,
    minPrice: calculateMinPrice(raw, tickets),
    coordinates: normalizeCoordinates(raw),
  };
}

function extractEvents(response: EventListResponse | any): Event[] {
  const rawItems =
    response?.items || response?.events || response?.data?.items || response?.data?.events || [];
  return Array.isArray(rawItems) ? rawItems.map(normalizeEvent).filter((event) => event.id) : [];
}

function getDemoEvents(): Event[] {
  return (DEMO_EVENTS as any).map(normalizeEvent).filter((event: Event) => event.id);
}

function appendPublicDemoEvents(events: Event[]): Event[] {
  if (!PUBLIC_DEMO_MODE) return events;

  const seenIds = new Set(events.map((event) => event.id));
  const demoEvents = getDemoEvents().filter((event) => {
    if (seenIds.has(event.id)) return false;
    seenIds.add(event.id);
    return true;
  });

  return [...events, ...demoEvents];
}

function filterByCity(events: Event[], city?: string): Event[] {
  if (!city || city === 'All Cities') return events;
  const cityKey = city.toLowerCase();
  return events.filter((event) => (event.city ?? '').toLowerCase() === cityKey);
}

function filterByCategory(events: Event[], category?: string): Event[] {
  if (!category || category === 'all') return events;
  const categoryKey = category.toLowerCase();
  return events.filter(
    (event) =>
      event.category?.toLowerCase() === categoryKey || event.type?.toLowerCase() === categoryKey,
  );
}

function applySearchFilters(events: Event[], filters: SearchFilters): Event[] {
  let results = filterByCity(events, filters.city);
  results = filterByCategory(results, filters.category);

  if (filters.dateFrom) {
    results = results.filter((event) => new Date(event.startDate) >= filters.dateFrom!);
  }
  if (filters.dateTo) {
    results = results.filter((event) => new Date(event.startDate) <= filters.dateTo!);
  }
  if (filters.query) {
    const query = filters.query.toLowerCase();
    results = results.filter(
      (event) =>
        event.title.toLowerCase().includes(query) ||
        event.venue?.toLowerCase().includes(query) ||
        event.location?.toLowerCase().includes(query) ||
        event.hostName?.toLowerCase().includes(query) ||
        event.description?.toLowerCase().includes(query),
    );
  }
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    results = results.filter((event) => {
      const prices = event.tickets?.map((tier: TicketTier) => tier.price) || [];
      const minPrice = prices.length > 0 ? Math.min(...prices) : Infinity;
      if (filters.priceMin !== undefined && minPrice < filters.priceMin) return false;
      if (filters.priceMax !== undefined && minPrice > filters.priceMax) return false;
      return true;
    });
  }

  return results;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return query ? `?${query}` : '';
}

async function fetchEventTickets(eventId: string): Promise<TicketTier[]> {
  const response = await apiFetch<any>(`/api/v1/events/${encodeURIComponent(eventId)}/tickets`, {
    requireAuth: false,
  });
  return extractTicketTiers(response);
}

export const useEventsStore = create<EventsState>((set, get) => ({
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

  fetchEvents: async (city?: string) => {
    if (get().loading) return;
    set({ loading: true, error: null });

    try {
      const response = await apiFetch<EventListResponse>(
        `/api/v1/events${buildQuery({ city, limit: 24, sort: 'soonest' })}`,
        { requireAuth: false },
      );
      const events = filterByCity(appendPublicDemoEvents(extractEvents(response)), city);

      events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

      set({ events, loading: false, lastId: null, hasMore: false });
    } catch (error: any) {
      console.error('Error fetching events:', error);
      if (PUBLIC_DEMO_MODE) {
        const events = filterByCity(getDemoEvents(), city).sort(
          (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
        );
        set({ events, loading: false, lastId: null, hasMore: false, error: null });
        return;
      }
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchFeaturedEvents: async () => {
    if (get().featuredLoading) return;
    set({ featuredLoading: true });

    try {
      const response = await apiFetch<EventListResponse>(
        `/api/v1/events${buildQuery({ limit: 24, sort: 'featured' })}`,
        { requireAuth: false },
      );
      const all = appendPublicDemoEvents(extractEvents(response));

      const featured = all
        .filter((e) => e.isFeatured)
        .sort((a, b) => getHeatScore(b) - getHeatScore(a));
      const byHeat = [...all].sort((a, b) => getHeatScore(b) - getHeatScore(a));

      // Sync with Guest Portal: prioritises isFeatured flag, fills with heat, limit 6
      const featuredEvents = (featured.length >= 3 ? featured : byHeat).slice(0, 6);
      set({ featuredEvents, featuredLoading: false });
    } catch (error: any) {
      console.error('Error fetching featured events:', error);
      if (PUBLIC_DEMO_MODE) {
        const all = getDemoEvents();
        const featured = all
          .filter((event) => event.isFeatured)
          .sort((a, b) => getHeatScore(b) - getHeatScore(a));
        const byHeat = [...all].sort((a, b) => getHeatScore(b) - getHeatScore(a));
        set({
          featuredEvents: (featured.length >= 3 ? featured : byHeat).slice(0, 6),
          featuredLoading: false,
        });
        return;
      }
      set({ featuredLoading: false });
    }
  },

  fetchPublicEvents: async (options?: { limit?: number }) => {
    if (get().loading) return;
    set({ loading: true, error: null });

    try {
      const limitVal = Math.min(options?.limit || 24, 24);
      const response = await apiFetch<EventListResponse>(
        `/api/v1/events${buildQuery({ limit: limitVal, sort: 'soonest' })}`,
        { requireAuth: false },
      );
      const events = appendPublicDemoEvents(extractEvents(response));
      set({ events, loading: false });
    } catch (error: any) {
      console.error('Error fetching public events:', error);
      if (PUBLIC_DEMO_MODE) {
        set({ events: getDemoEvents(), error: null, loading: false });
        return;
      }
      set({ error: error.message, loading: false });
    }
  },

  searchEvents: async (filters: SearchFilters) => {
    if (get().searching) return;
    set({ searching: true, error: null });

    try {
      const response = await apiFetch<EventListResponse>(
        `/api/v1/events${buildQuery({
          city: filters.city && filters.city !== 'All Cities' ? filters.city : undefined,
          category: filters.category && filters.category !== 'all' ? filters.category : undefined,
          search: filters.query,
          limit: 24,
          sort: 'soonest',
        })}`,
        { requireAuth: false },
      );
      const results = applySearchFilters(appendPublicDemoEvents(extractEvents(response)), filters);

      set({ searchResults: results, searching: false });
    } catch (error: any) {
      console.error('Error searching events:', error);
      if (PUBLIC_DEMO_MODE) {
        set({ searchResults: applySearchFilters(getDemoEvents(), filters), searching: false });
        return;
      }
      set({ error: error.message, searching: false });
    }
  },

  loadMoreEvents: async () => {
    // fetchEvents loads the full collection at once; nothing more to page through
  },

  getEventById: async (id: string): Promise<Event | null> => {
    if (!id || typeof id !== 'string') return null;
    try {
      const detail = await apiFetch<any>(`/api/v1/events/${encodeURIComponent(id)}`, {
        requireAuth: false,
      });
      const event = normalizeEvent(detail?.event || detail?.data?.event || detail);
      const tickets = event.tickets?.length ? event.tickets : await fetchEventTickets(event.id);
      return {
        ...event,
        tickets,
        ticketTiers: tickets,
        tiers: tickets,
        minPrice: calculateMinPrice(event, tickets),
        interestedData: detail?.interestedData || detail?.data?.interestedData,
      };
    } catch (error: any) {
      console.warn('Error fetching event by id:', error);
      if (PUBLIC_DEMO_MODE) {
        const event = getDemoEvents().find((demoEvent) => demoEvent.id === id);
        return event || null;
      }
      return null;
    }
  },

  clearSearch: () => {
    set({ searchResults: [], searching: false });
  },

  fetchByCategory: async (category: string, city?: string) => {
    const { categoryLoading } = get();
    if (categoryLoading[category]) return;

    set((s) => ({ categoryLoading: { ...s.categoryLoading, [category]: true } }));

    try {
      const response = await apiFetch<EventListResponse>(
        `/api/v1/events${buildQuery({ category, city, limit: 24, sort: 'soonest' })}`,
        { requireAuth: false },
      );
      const events = filterByCity(
        filterByCategory(appendPublicDemoEvents(extractEvents(response)), category),
        city,
      );

      set((s) => ({
        categoryEvents: { ...s.categoryEvents, [category]: events },
        categoryHasMore: { ...s.categoryHasMore, [category]: false },
        categoryLoading: { ...s.categoryLoading, [category]: false },
      }));
    } catch (error: any) {
      if (!error.isAbort) console.error(`Error fetching category ${category}:`, error);
      if (PUBLIC_DEMO_MODE) {
        const events = filterByCity(filterByCategory(getDemoEvents(), category), city);
        set((s) => ({
          categoryEvents: { ...s.categoryEvents, [category]: events },
          categoryHasMore: { ...s.categoryHasMore, [category]: false },
          categoryLoading: { ...s.categoryLoading, [category]: false },
        }));
        return;
      }
      set((s) => ({ categoryLoading: { ...s.categoryLoading, [category]: false } }));
    }
  },

  loadMoreByCategory: async (_category: string, _city?: string) => {
    // fetchByCategory loads all matching events at once; nothing more to page through
  },
}));
