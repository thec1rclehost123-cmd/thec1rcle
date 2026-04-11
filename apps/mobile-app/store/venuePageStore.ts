import { create } from "zustand";
import { apiFetch } from "@/lib/api";
import {
    type Coordinates,
    findKnownVenueCoordinates,
    resolveVenueCoordinates,
} from "@/lib/venueDiscovery";

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

export const useVenuePageStore = create<VenuePageState>((set) => ({
    venue: null,
    highlights: [],
    gallery: [],
    menu: [],
    facilities: [],
    upcomingEvents: [],
    loading: false,
    error: null,

    clearVenuePage: () =>
        set({
            venue: null,
            highlights: [],
            gallery: [],
            menu: [],
            facilities: [],
            upcomingEvents: [],
            error: null,
        }),

    fetchVenuePage: async (venueIdOrSlug: string) => {
        set({ loading: true, error: null });

        try {
            const data = await apiFetch<any>(`/api/v1/venues/${venueIdOrSlug}`, { requireAuth: false });
            
            if (!data || !data.venue) {
                set({ loading: false, error: "Venue not found" });
                return;
            }

            const { venue: venueDoc, highlights, gallery, menu, facilities, upcomingEvents } = data;

            const leadEventWithCoords = upcomingEvents?.find((event: any) => resolveVenueCoordinates(event));

            set({
                venue: {
                    ...venueDoc,
                    followers:
                        typeof venueDoc.followers === "number"
                            ? venueDoc.followers
                            : typeof venueDoc.followersCount === "number"
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
                            venueDoc.address
                        ),
                    upcomingEventsCount: upcomingEvents?.length || 0,
                },
                highlights: highlights || [],
                gallery: gallery || [],
                menu: menu || [],
                facilities: facilities || [],
                upcomingEvents: upcomingEvents || [],
                loading: false,
            });
        } catch (error: any) {
            console.error("[VenuePageStore] Failed to fetch venue page:", error);
            set({ loading: false, error: error?.message || "Failed to load venue page" });
        }
    },
}));

export function getFacilityEmoji(iconId: string): string {
    const icons: Record<string, string> = {
        car: "P",
        key: "K",
        sun: "S",
        cigarette: "C",
        music: "M",
        wine: "W",
        accessibility: "A",
        star: "*",
        tree: "T",
        mic: "Mic",
        wifi: "WiFi",
        food: "Food",
    };

    return icons[iconId] || "*";
}
