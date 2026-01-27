/**
 * THE C1RCLE Mobile - Venues Store
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    increment,
    updateDoc,
    runTransaction,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { resolveImageUrl } from "./eventsStore";

export interface Venue {
    id: string;
    slug: string;
    name: string;
    area: string;
    city?: string;
    neighborhood?: string;
    image: string;
    coverURL?: string;
    followers: number;
    tags: string[];
    vibes?: string[];
    genres?: string[];
    tablesAvailable: boolean;
    venueType?: string;
    description: string;
    rules: string[];
    dressCode: string;
    isVerified?: boolean;
    primaryCta?: string;
    whatsapp?: string;
    website?: string;
    phone?: string;
    socialLinks?: {
        instagram?: string;
        twitter?: string;
        spotify?: string;
    };
    isFollowing?: boolean;
}

interface VenuesState {
    venues: Venue[];
    loading: boolean;
    error: string | null;
    currentVenue: Venue | null;

    // Actions
    fetchVenues: (filters?: { area?: string; vibe?: string; search?: string; tablesOnly?: boolean }) => Promise<void>;
    getVenueById: (id: string) => Promise<Venue | null>;
    getVenueBySlug: (slug: string) => Promise<Venue | null>;
    followVenue: (venueId: string, userId: string) => Promise<void>;
    unfollowVenue: (venueId: string, userId: string) => Promise<void>;
    checkIfFollowing: (venueId: string, userId: string) => Promise<boolean>;
    clearCurrentVenue: () => void;
}

export const useVenuesStore = create<VenuesState>()(
    persist(
        (set, get) => ({
            venues: [],
            loading: false,
            error: null,
            currentVenue: null,

            clearCurrentVenue: () => set({ currentVenue: null }),

            fetchVenues: async (filters = {}) => {
                set({ loading: true, error: null });
                try {
                    const db = getFirebaseDb();
                    const venuesRef = collection(db, "venues");
                    let q = query(venuesRef);

                    if (filters.area) {
                        q = query(q, where("area", "==", filters.area));
                    }

                    const snapshot = await getDocs(q);
                    let venues: Venue[] = snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            ...data,
                            image: resolveImageUrl(data.image || data.coverURL) || "",
                        } as Venue;
                    });

                    // Client side filtering for more complex filters if needed
                    if (filters.vibe) {
                        venues = venues.filter(v =>
                            (v.tags || []).some(t => t.toLowerCase() === filters.vibe?.toLowerCase()) ||
                            (v.vibes || []).some(t => t.toLowerCase() === filters.vibe?.toLowerCase())
                        );
                    }

                    if (filters.search) {
                        const lowSearch = filters.search.toLowerCase();
                        venues = venues.filter(v =>
                            v.name.toLowerCase().includes(lowSearch) ||
                            v.area?.toLowerCase().includes(lowSearch) ||
                            v.neighborhood?.toLowerCase().includes(lowSearch)
                        );
                    }

                    if (filters.tablesOnly) {
                        venues = venues.filter(v => v.tablesAvailable);
                    }

                    // Fallback to dummy data if empty (matching web behavior)
                    if (venues.length === 0 && !filters.area && !filters.vibe && !filters.search) {
                        // We can add some fallback venues here if we want or just leave it empty
                    }

                    set({ venues, loading: false });
                } catch (error: any) {
                    console.error("[VenuesStore] Error fetching venues:", error);
                    set({ error: error.message, loading: false });
                }
            },

            getVenueById: async (id) => {
                try {
                    const db = getFirebaseDb();
                    const docRef = doc(db, "venues", id);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const venue = {
                            id: docSnap.id,
                            ...data,
                            image: resolveImageUrl(data.image || data.coverURL) || "",
                        } as Venue;
                        set({ currentVenue: venue });
                        return venue;
                    }
                    return null;
                } catch (error) {
                    console.error("[VenuesStore] Error getting venue by id:", error);
                    return null;
                }
            },

            getVenueBySlug: async (slug) => {
                try {
                    const db = getFirebaseDb();
                    const q = query(collection(db, "venues"), where("slug", "==", slug));
                    const snapshot = await getDocs(q);

                    if (!snapshot.empty) {
                        const doc = snapshot.docs[0];
                        const data = doc.data();
                        const venue = {
                            id: doc.id,
                            ...data,
                            image: resolveImageUrl(data.image || data.coverURL) || "",
                        } as Venue;
                        set({ currentVenue: venue });
                        return venue;
                    }
                    return null;
                } catch (error) {
                    console.error("[VenuesStore] Error getting venue by slug:", error);
                    return null;
                }
            },

            followVenue: async (venueId, userId) => {
                try {
                    const db = getFirebaseDb();
                    const followId = `${venueId}_${userId}`;
                    const followRef = doc(db, "venue_follows", followId);

                    await runTransaction(db, async (transaction) => {
                        const followDoc = await transaction.get(followRef);
                        if (followDoc.exists()) return;

                        transaction.set(followRef, {
                            venueId,
                            userId,
                            createdAt: new Date().toISOString()
                        });

                        const venueRef = doc(db, "venues", venueId);
                        transaction.update(venueRef, {
                            followers: increment(1)
                        });
                    });

                    // Update local state
                    set(state => ({
                        venues: state.venues.map(v => v.id === venueId ? { ...v, followers: v.followers + 1, isFollowing: true } : v),
                        currentVenue: state.currentVenue?.id === venueId ? { ...state.currentVenue, followers: state.currentVenue.followers + 1, isFollowing: true } : state.currentVenue
                    }));
                } catch (error) {
                    console.error("[VenuesStore] Error following venue:", error);
                }
            },

            unfollowVenue: async (venueId, userId) => {
                try {
                    const db = getFirebaseDb();
                    const followId = `${venueId}_${userId}`;
                    const followRef = doc(db, "venue_follows", followId);

                    await runTransaction(db, async (transaction) => {
                        const followDoc = await transaction.get(followRef);
                        if (!followDoc.exists()) return;

                        transaction.delete(followRef);

                        const venueRef = doc(db, "venues", venueId);
                        transaction.update(venueRef, {
                            followers: increment(-1)
                        });
                    });

                    // Update local state
                    set(state => ({
                        venues: state.venues.map(v => v.id === venueId ? { ...v, followers: Math.max(0, v.followers - 1), isFollowing: false } : v),
                        currentVenue: state.currentVenue?.id === venueId ? { ...state.currentVenue, followers: Math.max(0, state.currentVenue.followers - 1), isFollowing: false } : state.currentVenue
                    }));
                } catch (error) {
                    console.error("[VenuesStore] Error unfollowing venue:", error);
                }
            },

            checkIfFollowing: async (venueId, userId) => {
                if (!userId) return false;
                try {
                    const db = getFirebaseDb();
                    const followId = `${venueId}_${userId}`;
                    const followRef = doc(db, "venue_follows", followId);
                    const docSnap = await getDoc(followRef);
                    return docSnap.exists();
                } catch (error) {
                    console.error("[VenuesStore] Error checking follow status:", error);
                    return false;
                }
            }
        }),
        {
            name: "c1rcle-venues-storage",
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                venues: state.venues,
            }),
        }
    )
);
