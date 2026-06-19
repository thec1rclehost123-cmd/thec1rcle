import { create } from 'zustand';
// @c1rcle/types provides the canonical Venue shape. The local Venue interface below
// extends it with mobile-specific fields (coordinates, popularityScore, etc.).
// When harmonizing: import type { Venue as BaseVenue } from '@c1rcle/types';
import { getFirebaseApp } from '@/lib/firebase/client';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { type Coordinates } from '@/lib/venueDiscovery';
import { apiFetch } from '@/lib/api';

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
    area?: string;
    search?: string;
    tablesOnly?: boolean;
  }) => Promise<void>;
  setFollowedVenueIds: (venueIds: string[]) => void;
  toggleVenueFollow: (
    venueId: string,
    shouldFollow: boolean,
    venueName?: string,
  ) => Promise<boolean>;
}

export const useVenuesStore = create<VenuesState>((set, get) => ({
  venues: [],
  followedVenueIds: new Set(),
  followLoadingVenueIds: new Set(),
  loading: false,
  error: null,

  fetchVenues: async (filters = {}) => {
    set({ loading: true, error: null });
    try {
      const db = getFirestore(getFirebaseApp());
      const snap = await getDocs(collection(db, 'venues'));
      let venues: Venue[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Venue);

      if (filters.tablesOnly) {
        venues = venues.filter((v: Venue) => v.tablesAvailable);
      }
      if (filters.area) {
        const clean = filters.area.toLowerCase().trim();
        venues = venues.filter((v: Venue) => {
          const a = (v.area || '').toLowerCase();
          const n = (v.neighborhood || '').toLowerCase();
          const addr = (v.address || '').toLowerCase();
          const c = (v.city || '').toLowerCase();
          return (
            a.includes(clean) || n.includes(clean) || addr.includes(clean) || c.includes(clean)
          );
        });
      }
      if (filters.search) {
        const s = filters.search.toLowerCase().trim();
        venues = venues.filter((v: Venue) => {
          const name = (v.displayName || v.name || '').toLowerCase();
          const tags = [...(v.tags || []), ...(v.genres || []), ...(v.vibes || [])]
            .join(' ')
            .toLowerCase();
          return (
            name.includes(s) ||
            (v.area || '').toLowerCase().includes(s) ||
            (v.city || '').toLowerCase().includes(s) ||
            tags.includes(s)
          );
        });
      }

      set({ venues, loading: false });
    } catch (e: any) {
      set({ error: e?.message || 'Failed to fetch venues', loading: false });
    }
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
