import { create } from 'zustand';
// @c1rcle/types provides the canonical Venue shape. The local Venue interface below
// extends it with mobile-specific fields (coordinates, popularityScore, etc.).
// When harmonizing: import type { Venue as BaseVenue } from '@c1rcle/types';
import { type Coordinates } from '@/lib/venueDiscovery';
import { apiFetch, fetchPublicVenues } from '@/lib/api';

export interface Venue {
  id: string;
  name?: string;
  displayName?: string;
  slug?: string;
  area?: string;
  neighborhood?: string;
  city?: string;
  address?: string;
  image?: string;
  coverURL?: string;
  coverImage?: string;
  photoURL?: string;
  tags?: string[];
  vibes?: string[];
  genres?: string[];
  tablesAvailable?: boolean;
  isVerified?: boolean;
  venueType?: string;
  description?: string;
  whatsapp?: string;
  phone?: string;
  addressLine1?: string;
  bannerImage?: string;
  logoImage?: string;
  followers?: number;
  hasReservation?: boolean;
  coordinates?: Coordinates | null;
  upcomingEventsCount?: number;
  nextEventDate?: string;
  nextEventId?: string;
  nextEventTitle?: string;
  popularityScore?: number;
}

interface VenuesState {
  venues: Venue[];
  followedVenueIds: Set<string>;
  followLoadingVenueIds: Set<string>;
  loading: boolean;
  error: string | null;
  fetchVenues: (filters?: {
    city?: string;
    area?: string;
    search?: string;
    tablesOnly?: boolean;
    force?: boolean;
  }) => Promise<void>;
  setFollowedVenueIds: (venueIds: string[]) => void;
  toggleVenueFollow: (
    venueId: string,
    shouldFollow: boolean,
    venueName?: string,
  ) => Promise<boolean>;
}

let venueRequestGeneration = 0;
let venueRequestKey: string | null = null;
let venueRequestPromise: Promise<void> | null = null;
let lastSuccessfulVenueRequestKey: string | null = null;
let lastSuccessfulVenueRequestAt = 0;
const VENUE_DISCOVERY_CACHE_MS = 2 * 60 * 1000;

function buildVenueRequestKey(filters: {
  city?: string;
  area?: string;
  search?: string;
  tablesOnly?: boolean;
}) {
  return JSON.stringify({
    city: filters.city || null,
    area: filters.area || null,
    search: filters.search || null,
    tablesOnly: filters.tablesOnly === true,
  });
}

export const useVenuesStore = create<VenuesState>((set, get) => ({
  venues: [],
  followedVenueIds: new Set(),
  followLoadingVenueIds: new Set(),
  loading: false,
  error: null,

  fetchVenues: (filters = {}) => {
    const { force = false, ...requestFilters } = filters;
    const requestKey = buildVenueRequestKey(requestFilters);
    if (venueRequestKey === requestKey && venueRequestPromise) return venueRequestPromise;
    if (
      !force &&
      lastSuccessfulVenueRequestKey === requestKey &&
      Date.now() - lastSuccessfulVenueRequestAt < VENUE_DISCOVERY_CACHE_MS &&
      get().venues.length > 0
    ) {
      return Promise.resolve();
    }

    const requestGeneration = ++venueRequestGeneration;
    let request!: Promise<void>;
    request = (async () => {
      set({ loading: true, error: null });
      try {
        const response = await fetchPublicVenues({ ...requestFilters, limit: 100 });
        if (requestGeneration !== venueRequestGeneration) return;
        const venues = (response.venues || response.items || []) as Venue[];
        lastSuccessfulVenueRequestKey = requestKey;
        lastSuccessfulVenueRequestAt = Date.now();
        set({ venues, loading: false });
      } catch (e: any) {
        if (requestGeneration !== venueRequestGeneration) return;
        set({ error: e?.message || 'Failed to fetch venues', loading: false });
      } finally {
        if (venueRequestPromise === request) {
          venueRequestKey = null;
          venueRequestPromise = null;
        }
      }
    })();

    venueRequestKey = requestKey;
    venueRequestPromise = request;
    return request;
  },

  setFollowedVenueIds: (venueIds) => {
    set({ followedVenueIds: new Set(venueIds) });
  },

  toggleVenueFollow: async (venueId, shouldFollow, venueName) => {
    const { followedVenueIds, followLoadingVenueIds, venues } = get();
    const previousFollowed = new Set(followedVenueIds);
    const previousLoading = new Set(followLoadingVenueIds);
    const nextFollowed = new Set(followedVenueIds);
    const nextLoading = new Set(followLoadingVenueIds);

    if (shouldFollow) nextFollowed.add(venueId);
    else nextFollowed.delete(venueId);
    nextLoading.add(venueId);

    const countDelta = shouldFollow ? 1 : -1;
    set({
      followedVenueIds: nextFollowed,
      followLoadingVenueIds: nextLoading,
      venues: venues.map((venue) =>
        venue.id === venueId
          ? { ...venue, followers: Math.max(0, (venue.followers || 0) + countDelta) }
          : venue,
      ),
    });

    try {
      await apiFetch(`/api/v1/venues/${encodeURIComponent(venueId)}/follow`, {
        method: shouldFollow ? 'POST' : 'DELETE',
        body: shouldFollow ? JSON.stringify({ venueName }) : undefined,
      });
      const doneLoading = new Set(get().followLoadingVenueIds);
      doneLoading.delete(venueId);
      set({ followLoadingVenueIds: doneLoading });
      return true;
    } catch (e: any) {
      const rollbackLoading = new Set(previousLoading);
      rollbackLoading.delete(venueId);
      set({
        followedVenueIds: previousFollowed,
        followLoadingVenueIds: rollbackLoading,
        venues,
        error: e?.message || 'Failed to update venue follow',
      });
      return false;
    }
  },
}));
