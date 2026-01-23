import { create } from "zustand";
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    doc,
    getDoc,
    startAfter,
    QueryDocumentSnapshot,
    Timestamp
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

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
    status?: string;
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
}

export interface TicketTier {
    id: string;
    name: string;
    price: number;
    quantity: number;
    remaining: number;
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

interface EventsState {
    events: Event[];
    featuredEvents: Event[];
    searchResults: Event[];
    loading: boolean;
    searching: boolean;
    error: string | null;
    lastDoc: QueryDocumentSnapshot | null;
    hasMore: boolean;

    // Actions
    fetchEvents: (city?: string) => Promise<void>;
    fetchFeaturedEvents: () => Promise<void>;
    fetchPublicEvents: (options?: { limit?: number }) => Promise<void>;
    searchEvents: (filters: SearchFilters) => Promise<void>;
    loadMoreEvents: () => Promise<void>;
    getEventById: (id: string) => Promise<Event | null>;
    clearSearch: () => void;
}

export const useEventsStore = create<EventsState>((set, get) => ({
    events: [],
    featuredEvents: [],
    searchResults: [],
    loading: false,
    searching: false,
    error: null,
    lastDoc: null,
    hasMore: true,

    fetchEvents: async (city?: string) => {
        set({ loading: true, error: null });

        try {
            const db = getFirebaseDb();
            const eventsRef = collection(db, "events");

            // Query for published events
            let q = query(
                eventsRef,
                where("status", "in", ["published", "scheduled", "live"]),
                orderBy("startDate", "asc"),
                limit(50)
            );

            // Add city filter if specified
            if (city) {
                q = query(
                    eventsRef,
                    where("status", "in", ["published", "scheduled", "live"]),
                    where("city", "==", city),
                    orderBy("startDate", "asc"),
                    limit(50)
                );
            }

            const snapshot = await getDocs(q);
            const events: Event[] = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Event[];

            const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

            set({
                events,
                loading: false,
                lastDoc,
                hasMore: snapshot.docs.length === 50,
            });
        } catch (error: any) {
            console.error("Error fetching events:", error);
            set({ error: error.message, loading: false });
        }
    },

    fetchFeaturedEvents: async () => {
        set({ loading: true, error: null });

        try {
            const db = getFirebaseDb();
            const eventsRef = collection(db, "events");

            // Query for featured/spotlight events
            const q = query(
                eventsRef,
                where("isFeatured", "==", true),
                where("status", "in", ["published", "scheduled", "live"]),
                limit(10)
            );

            const snapshot = await getDocs(q);
            const featuredEvents: Event[] = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Event[];

            set({ featuredEvents, loading: false });
        } catch (error: any) {
            console.error("Error fetching featured events:", error);
            set({ error: error.message, loading: false });
        }
    },

    fetchPublicEvents: async (options?: { limit?: number }) => {
        set({ loading: true, error: null });

        try {
            const db = getFirebaseDb();
            const eventsRef = collection(db, "events");

            const q = query(
                eventsRef,
                where("status", "in", ["published", "scheduled", "live"]),
                orderBy("startDate", "asc"),
                limit(options?.limit || 50)
            );

            const snapshot = await getDocs(q);
            const events: Event[] = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Event[];

            set({ events, loading: false });
        } catch (error: any) {
            console.error("Error fetching public events:", error);
            set({ error: error.message, loading: false });
        }
    },

    searchEvents: async (filters: SearchFilters) => {
        set({ searching: true, error: null });

        try {
            const db = getFirebaseDb();
            const eventsRef = collection(db, "events");

            // Build query constraints
            let constraints: any[] = [
                where("status", "in", ["published", "scheduled", "live"]),
            ];

            // City filter
            if (filters.city && filters.city !== "All Cities") {
                constraints.push(where("city", "==", filters.city));
            }

            // Category filter
            if (filters.category && filters.category !== "all") {
                constraints.push(where("category", "==", filters.category));
            }

            // Date range filter
            if (filters.dateFrom) {
                constraints.push(
                    where("startDate", ">=", filters.dateFrom.toISOString())
                );
            }

            // Order and limit
            constraints.push(orderBy("startDate", "asc"));
            constraints.push(limit(50));

            const q = query(eventsRef, ...constraints);
            const snapshot = await getDocs(q);

            let results: Event[] = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Event[];

            // Client-side text search (Firestore doesn't support full-text)
            if (filters.query) {
                const searchLower = filters.query.toLowerCase();
                results = results.filter((event) =>
                    event.title.toLowerCase().includes(searchLower) ||
                    event.venue?.toLowerCase().includes(searchLower) ||
                    event.location?.toLowerCase().includes(searchLower) ||
                    event.hostName?.toLowerCase().includes(searchLower) ||
                    event.description?.toLowerCase().includes(searchLower)
                );
            }

            // Price filter (client-side)
            if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
                results = results.filter((event) => {
                    const minPrice = Math.min(
                        ...(event.tickets?.map((t) => t.price) || [Infinity])
                    );

                    if (filters.priceMin && minPrice < filters.priceMin) return false;
                    if (filters.priceMax && minPrice > filters.priceMax) return false;
                    return true;
                });
            }

            set({ searchResults: results, searching: false });
        } catch (error: any) {
            console.error("Error searching events:", error);
            set({ error: error.message, searching: false });
        }
    },

    loadMoreEvents: async () => {
        const { lastDoc, hasMore, loading, events } = get();

        if (!hasMore || loading || !lastDoc) return;

        set({ loading: true });

        try {
            const db = getFirebaseDb();
            const eventsRef = collection(db, "events");

            const q = query(
                eventsRef,
                where("status", "in", ["published", "scheduled", "live"]),
                orderBy("startDate", "asc"),
                startAfter(lastDoc),
                limit(20)
            );

            const snapshot = await getDocs(q);
            const newEvents: Event[] = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Event[];

            const newLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

            set({
                events: [...events, ...newEvents],
                loading: false,
                lastDoc: newLastDoc,
                hasMore: snapshot.docs.length === 20,
            });
        } catch (error: any) {
            console.error("Error loading more events:", error);
            set({ error: error.message, loading: false });
        }
    },

    getEventById: async (id: string): Promise<Event | null> => {
        try {
            const db = getFirebaseDb();
            const eventRef = doc(db, "events", id);
            const eventDoc = await getDoc(eventRef);

            if (eventDoc.exists()) {
                return { id: eventDoc.id, ...eventDoc.data() } as Event;
            }
            return null;
        } catch (error: any) {
            console.error("Error fetching event:", error);
            return null;
        }
    },

    clearSearch: () => {
        set({ searchResults: [], searching: false });
    },
}));
