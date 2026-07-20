import { create } from 'zustand';
import {
  type Coordinates,
  findKnownVenueCoordinates,
  resolveVenueCoordinates,
} from '@/lib/venueDiscovery';
import { fetchPublicVenuePage } from '@/lib/publicDetailRequests';
import { createLatestRequestGuard } from '@/lib/requestGuard';

export interface VenueHighlight {
  id: string;
  venueId: string;
  title: string;
  coverImage: string;
  images: string[];
  order: number;
  isActive: boolean;
}

export interface VenueGalleryPhoto {
  id: string;
  venueId: string;
  imageUrl: string;
  caption?: string;
  order: number;
}

export interface VenueMenuItem {
  id: string;
  venueId: string;
  imageUrl: string;
  title?: string;
  order: number;
}

export interface VenueFacility {
  id: string;
  venueId: string;
  name: string;
  icon: string;
  isEnabled: boolean;
  order: number;
}

export interface VenuePageData {
  id: string;
  slug?: string;
  name?: string;
  displayName?: string;
  tagline?: string;
  description?: string;
  bannerImage?: string;
  coverURL?: string;
  logoImage?: string;
  photoURL?: string;
  address?: string;
  city?: string;
  neighborhood?: string;
  timings?: Record<string, string>;
  phone?: string;
  whatsapp?: string;
  isVerified?: boolean;
  primaryCta?: string;
  hasReservation?: boolean;
  venueType?: string;
  followers?: number;
  tags?: string[];
  vibes?: string[];
  genres?: string[];
  coordinates?: Coordinates | null;
  upcomingEventsCount?: number;
}

interface VenuePageState {
  venue: VenuePageData | null;
  highlights: VenueHighlight[];
  gallery: VenueGalleryPhoto[];
  menu: VenueMenuItem[];
  facilities: VenueFacility[];
  upcomingEvents: any[];
  loading: boolean;
  error: string | null;
  fetchVenuePage: (venueIdOrSlug: string) => Promise<void>;
  clearVenuePage: () => void;
}

const venuePageRequestGuard = createLatestRequestGuard();

export const useVenuePageStore = create<VenuePageState>((set) => ({
  venue: null,
  highlights: [],
  gallery: [],
  menu: [],
  facilities: [],
  upcomingEvents: [],
  loading: false,
  error: null,

  clearVenuePage: () => {
    venuePageRequestGuard.invalidate();
    set({
      venue: null,
      highlights: [],
      gallery: [],
      menu: [],
      facilities: [],
      upcomingEvents: [],
      loading: false,
      error: null,
    });
  },

  fetchVenuePage: async (venueIdOrSlug: string) => {
    const requestToken = venuePageRequestGuard.begin(venueIdOrSlug);
    set({ loading: true, error: null });

    try {
      const response = await fetchPublicVenuePage<any>(venueIdOrSlug);
      if (!venuePageRequestGuard.isCurrent(requestToken)) return;
      const venueDoc = response.venue || response.profile || response;

      if (!venueDoc) {
        set({ loading: false, error: 'Venue not found' });
        return;
      }

      const highlights: VenueHighlight[] = (response.highlights || venueDoc.highlights || []).sort(
        (a: any, b: any) => (a.order ?? 0) - (b.order ?? 0),
      );
      const gallery: VenueGalleryPhoto[] = (response.gallery || venueDoc.gallery || [])
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        .slice(0, 9);
      const menu: VenueMenuItem[] = (response.menu || venueDoc.menu || []).sort(
        (a: any, b: any) => (a.order ?? 0) - (b.order ?? 0),
      );
      const facilities: VenueFacility[] = (response.facilities || venueDoc.facilities || []).sort(
        (a: any, b: any) => (a.order ?? 0) - (b.order ?? 0),
      );
      const upcomingEvents: any[] = (response.upcomingEvents || venueDoc.upcomingEvents || [])
        .sort((a: any, b: any) => {
          const aDate = a.startDate ?? '';
          const bDate = b.startDate ?? '';
          return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
        })
        .slice(0, 10);

      const leadEventWithCoords = upcomingEvents.find((e: any) => resolveVenueCoordinates(e));

      set({
        venue: {
          ...venueDoc,
          followers:
            typeof venueDoc.followers === 'number'
              ? venueDoc.followers
              : typeof venueDoc.followersCount === 'number'
                ? venueDoc.followersCount
                : 0,
          hasReservation:
            Boolean(venueDoc.hasReservation) ||
            Boolean(venueDoc.tablesAvailable) ||
            Boolean(venueDoc.whatsapp) ||
            Boolean(venueDoc.phone),
          coordinates:
            resolveVenueCoordinates(venueDoc) ||
            (leadEventWithCoords ? resolveVenueCoordinates(leadEventWithCoords) : null) ||
            findKnownVenueCoordinates(
              venueDoc.displayName,
              venueDoc.name,
              venueDoc.neighborhood,
              venueDoc.city,
              venueDoc.address,
            ),
          upcomingEventsCount: upcomingEvents.length,
        },
        highlights,
        gallery,
        menu,
        facilities,
        upcomingEvents,
        loading: false,
      });
    } catch (error: any) {
      if (!venuePageRequestGuard.isCurrent(requestToken)) return;
      console.error('[VenuePageStore] Failed to fetch venue page:', error);
      set({ loading: false, error: error?.message || 'Failed to load venue page' });
    }
  },
}));

export function getFacilityEmoji(iconId: string): string {
  const icons: Record<string, string> = {
    car: 'P',
    key: 'K',
    sun: 'S',
    cigarette: 'C',
    music: 'M',
    wine: 'W',
    accessibility: 'A',
    star: '*',
    tree: 'T',
    mic: 'Mic',
    wifi: 'WiFi',
    food: 'Food',
  };

  return icons[iconId] || '*';
}
