import {
    getFirestore,
    doc,
    getDoc,
    getDocs,
    collection,
    query,
    where,
} from "firebase/firestore";
import { create } from "zustand";

import { getFirebaseApp } from "@/lib/firebase/client";
import {
    type Coordinates,
    findKnownVenueCoordinates,
    resolveVenueCoordinates,
} from "@/lib/venueDiscovery";

function getDb() { return getFirestore(getFirebaseApp()); }

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
            const db = getDb();
            let venueDoc: any = null;
            let venueId = venueIdOrSlug;

            // 1. Try fetch by doc ID first
            const directSnap = await getDoc(doc(db, "venues", venueIdOrSlug));
            if (directSnap.exists()) {
                venueDoc = { id: directSnap.id, ...directSnap.data() };
            } else {
                // 2. Fall back to slug query
                const slugSnap = await getDocs(
                    query(collection(db, "venues"), where("slug", "==", venueIdOrSlug))
                );
                if (!slugSnap.empty) {
                    const d = slugSnap.docs[0];
                    venueDoc = { id: d.id, ...d.data() };
                    venueId = d.id;
                }
            }

            if (!venueDoc) {
                set({ loading: false, error: "Venue not found" });
                return;
            }

            // 3. Fetch all sub-data in parallel — sort client-side to avoid composite index requirements
            const now = new Date().toISOString();

            const [highlightsSnap, gallerySnap, menuSnap, facilitiesSnap, eventsSnap] = await Promise.all([
                getDocs(query(
                    collection(db, "venue_highlights"),
                    where("venueId", "==", venueId),
                    where("isActive", "==", true)
                )).catch(() => null),
                getDocs(query(
                    collection(db, "venue_gallery"),
                    where("venueId", "==", venueId)
                )).catch(() => null),
                getDocs(query(
                    collection(db, "venue_menu"),
                    where("venueId", "==", venueId)
                )).catch(() => null),
                getDocs(query(
                    collection(db, "venue_facilities"),
                    where("venueId", "==", venueId),
                    where("isEnabled", "==", true)
                )).catch(() => null),
                getDocs(query(
                    collection(db, "events"),
                    where("venueId", "==", venueId)
                )).catch(() => null),
            ]);

            const toItems = (snap: any) =>
                snap ? snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) : [];

            const highlights: VenueHighlight[] = toItems(highlightsSnap)
                .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
            const gallery: VenueGalleryPhoto[] = toItems(gallerySnap)
                .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
                .slice(0, 9);
            const menu: VenueMenuItem[] = toItems(menuSnap)
                .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
            const facilities: VenueFacility[] = toItems(facilitiesSnap)
                .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
            const upcomingEvents: any[] = toItems(eventsSnap)
                .filter((e: any) => {
                    const end = e.endDate || e.startDate;
                    const normalized = end && end.length === 10 ? end + "T23:59:59.999Z" : end;
                    return normalized && normalized >= now && !e.isDeleted;
                })
                .sort((a: any, b: any) => {
                    const aDate = a.startDate ?? "";
                    const bDate = b.startDate ?? "";
                    return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
                })
                .slice(0, 10);

            const leadEventWithCoords = upcomingEvents.find((e: any) => resolveVenueCoordinates(e));

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
