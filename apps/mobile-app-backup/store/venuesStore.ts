import { create } from 'zustand';
// @c1rcle/types provides the canonical Venue shape. The local Venue interface below
// extends it with mobile-specific fields (coordinates, popularityScore, etc.).
// When harmonizing: import type { Venue as BaseVenue } from '@c1rcle/types';
import { getFirebaseApp } from '@/lib/firebase/client';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { type Coordinates } from '@/lib/venueDiscovery';

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
  loading: boolean;
  error: string | null;
  fetchVenues: (filters?: {
    area?: string;
    search?: string;
    tablesOnly?: boolean;
  }) => Promise<void>;
}

export const useVenuesStore = create<VenuesState>((set) => ({
  venues: [],
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
}));
