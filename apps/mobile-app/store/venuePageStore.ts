import { create } from "zustand";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

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
            const db = getFirebaseDb();
            let venueDoc: any = null;
            let venueId = venueIdOrSlug;

            const directSnap = await getDoc(doc(db, "venues", venueIdOrSlug));
            if (directSnap.exists()) {
                venueDoc = { id: directSnap.id, ...directSnap.data() };
                venueId = directSnap.id;
            } else {
                const slugSnap = await getDocs(query(collection(db, "venues"), where("slug", "==", venueIdOrSlug)));
                if (!slugSnap.empty) {
                    const matched = slugSnap.docs[0];
                    venueDoc = { id: matched.id, ...matched.data() };
                    venueId = matched.id;
                }
            }

            if (!venueDoc) {
                set({ loading: false, error: "Venue not found" });
                return;
            }

            const now = new Date().toISOString();
            const [highlightsSnap, gallerySnap, menuSnap, facilitiesSnap, eventsSnap] = await Promise.all([
                getDocs(
                    query(
                        collection(db, "venue_highlights"),
                        where("venueId", "==", venueId),
                        where("isActive", "==", true),
                        orderBy("order", "asc")
                    )
                ).catch(() => ({ docs: [] as any[] })),
                getDocs(
                    query(collection(db, "venue_gallery"), where("venueId", "==", venueId), orderBy("order", "asc"), limit(9))
                ).catch(() => ({ docs: [] as any[] })),
                getDocs(
                    query(collection(db, "venue_menu"), where("venueId", "==", venueId), orderBy("order", "asc"))
                ).catch(() => ({ docs: [] as any[] })),
                getDocs(
                    query(
                        collection(db, "venue_facilities"),
                        where("venueId", "==", venueId),
                        where("isEnabled", "==", true),
                        orderBy("order", "asc")
                    )
                ).catch(() => ({ docs: [] as any[] })),
                getDocs(
                    query(
                        collection(db, "events"),
                        where("venueId", "==", venueId),
                        where("startDate", ">=", now),
                        orderBy("startDate", "asc"),
                        limit(10)
                    )
                ).catch(() => ({ docs: [] as any[] })),
            ]);

            set({
                venue: venueDoc,
                highlights: highlightsSnap.docs.map((item: any) => ({ id: item.id, ...item.data() })) as VenueHighlight[],
                gallery: gallerySnap.docs.map((item: any) => ({ id: item.id, ...item.data() })) as VenueGalleryPhoto[],
                menu: menuSnap.docs.map((item: any) => ({ id: item.id, ...item.data() })) as VenueMenuItem[],
                facilities: facilitiesSnap.docs.map((item: any) => ({ id: item.id, ...item.data() })) as VenueFacility[],
                upcomingEvents: eventsSnap.docs.map((item: any) => ({ id: item.id, ...item.data() })),
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
