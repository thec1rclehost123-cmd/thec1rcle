/**
 * THE C1RCLE Mobile - Venue Page Store
 * 
 * Complete store for fetching venue page data including:
 * - Highlights (story sets)
 * - Gallery photos
 * - Menu images
 * - Facilities
 * - Upcoming events
 */

import { create } from "zustand";
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    orderBy,
    limit,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

// Types
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
    slug: string;
    name: string;
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
    timings?: { [key: string]: string };
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

    // Actions
    fetchVenuePage: (venueIdOrSlug: string) => Promise<void>;
    clearVenuePage: () => void;
}

export const useVenuePageStore = create<VenuePageState>((set, get) => ({
    venue: null,
    highlights: [],
    gallery: [],
    menu: [],
    facilities: [],
    upcomingEvents: [],
    loading: false,
    error: null,

    clearVenuePage: () => set({
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

            // Try by document ID first
            const venueRef = doc(db, "venues", venueIdOrSlug);
            const snap = await getDoc(venueRef);

            if (snap.exists()) {
                venueDoc = { id: snap.id, ...snap.data() };
                venueId = snap.id;
            } else {
                // Try by slug
                const slugQuery = query(
                    collection(db, "venues"),
                    where("slug", "==", venueIdOrSlug)
                );
                const slugSnap = await getDocs(slugQuery);
                if (!slugSnap.empty) {
                    const doc = slugSnap.docs[0];
                    venueDoc = { id: doc.id, ...doc.data() };
                    venueId = doc.id;
                }
            }

            if (!venueDoc) {
                set({ loading: false, error: "Venue not found" });
                return;
            }

            // Fetch highlights
            const highlightsQuery = query(
                collection(db, "venue_highlights"),
                where("venueId", "==", venueId),
                where("isActive", "==", true),
                orderBy("order", "asc")
            );
            const highlightsSnap = await getDocs(highlightsQuery);
            const highlights = highlightsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as VenueHighlight[];

            // Fetch gallery
            const galleryQuery = query(
                collection(db, "venue_gallery"),
                where("venueId", "==", venueId),
                orderBy("order", "asc"),
                limit(9)
            );
            const gallerySnap = await getDocs(galleryQuery);
            const gallery = gallerySnap.docs.map(d => ({ id: d.id, ...d.data() })) as VenueGalleryPhoto[];

            // Fetch menu
            const menuQuery = query(
                collection(db, "venue_menu"),
                where("venueId", "==", venueId),
                orderBy("order", "asc")
            );
            const menuSnap = await getDocs(menuQuery);
            const menuItems = menuSnap.docs.map(d => ({ id: d.id, ...d.data() })) as VenueMenuItem[];

            // Fetch facilities (only enabled)
            const facilitiesQuery = query(
                collection(db, "venue_facilities"),
                where("venueId", "==", venueId),
                where("isEnabled", "==", true),
                orderBy("order", "asc")
            );
            const facilitiesSnap = await getDocs(facilitiesQuery);
            const facilities = facilitiesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as VenueFacility[];

            // Fetch upcoming events
            const now = new Date().toISOString();
            const eventsQuery = query(
                collection(db, "events"),
                where("venueId", "==", venueId),
                where("startDate", ">=", now),
                orderBy("startDate", "asc"),
                limit(10)
            );
            const eventsSnap = await getDocs(eventsQuery);
            const upcomingEvents = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            set({
                venue: venueDoc,
                highlights,
                gallery,
                menu: menuItems,
                facilities,
                upcomingEvents,
                loading: false,
            });
        } catch (error: any) {
            console.error("[VenuePageStore] Error fetching venue page:", error);
            set({ loading: false, error: error.message });
        }
    },
}));

// Utility: Get emoji for facility icon
export function getFacilityEmoji(iconId: string): string {
    const icons: { [key: string]: string } = {
        car: "🅿️",
        key: "🔑",
        sun: "☀️",
        cigarette: "🚬",
        music: "💃",
        wine: "🍷",
        accessibility: "♿",
        star: "⭐",
        tree: "🌳",
        mic: "🎤",
        wifi: "📶",
        food: "🍽️",
    };
    return icons[iconId] || "⭐";
}
