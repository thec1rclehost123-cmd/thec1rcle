import { create } from "zustand";
import { apiFetch } from "@/lib/api";
import { getFirebaseApp } from "@/lib/firebase/client";
import {
    getFirestore,
    collection,
    getDocs,
    getDoc,
    doc,
} from "firebase/firestore";

// Lazy Firestore singleton — reuses the same app instance as auth
function getDb() {
    return getFirestore(getFirebaseApp());
}

// Serialise Firestore doc to plain JSON (converts Timestamps to ISO strings)
function serialiseDoc(docSnap: any): any {
    const data = docSnap.data();
    const out: any = { id: docSnap.id };
    for (const key of Object.keys(data)) {
        const val = data[key];
        // Firestore Timestamp → ISO string
        if (val && typeof val === "object" && typeof val.toDate === "function") {
            out[key] = val.toDate().toISOString();
        } else {
            out[key] = val;
        }
    }
    return out;
}

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
    lifecycle?: string; // Canonical state: draft, scheduled, live, etc.
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
    coordinates?: {
        latitude: number;
        longitude: number;
    };
    poster?: string; // Standard DB field
    image?: string;  // Standard DB field
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

// Mirrors guest portal PUBLIC_LIFECYCLE_STATES from @c1rcle/core
const PUBLIC_LIFECYCLES = new Set(["scheduled", "live"]);

function isPublicEvent(e: Event): boolean {
    // Allow events with no lifecycle field (legacy data) but reject known non-public states
    if (e.lifecycle && !PUBLIC_LIFECYCLES.has(e.lifecycle)) return false;
    // Filter obvious test/garbage titles
    const title = e.title ?? "";
    if (title.length < 4) return false;
    if (/^(test|check|ssjd|dummy|aaa|bbb|xxx)/i.test(title)) return false;
    return true;
}

interface EventsState {
    events: Event[];
    featuredEvents: Event[];
    featuredLoading: boolean;
    searchResults: Event[];
    categoryEvents: Record<string, Event[]>;
    categoryLoading: Record<string, boolean>;
    categoryLastId: Record<string, string | null>;
    categoryHasMore: Record<string, boolean>;
    loading: boolean;
    searching: boolean;
    error: string | null;
    lastId: string | null;
    hasMore: boolean;

    // Actions
    fetchEvents: (city?: string) => Promise<void>;
    fetchFeaturedEvents: () => Promise<void>;
    fetchPublicEvents: (options?: { limit?: number }) => Promise<void>;
    searchEvents: (filters: SearchFilters) => Promise<void>;
    loadMoreEvents: () => Promise<void>;
    getEventById: (id: string) => Promise<Event | null>;
    clearSearch: () => void;
    fetchByCategory: (category: string, city?: string) => Promise<void>;
    loadMoreByCategory: (category: string, city?: string) => Promise<void>;
}

export const useEventsStore = create<EventsState>((set, get) => ({
    events: [],
    featuredEvents: [],
    featuredLoading: false,
    searchResults: [],
    categoryEvents: {},
    categoryLoading: {},
    categoryLastId: {},
    categoryHasMore: {},
    loading: false,
    searching: false,
    error: null,
    lastId: null,
    hasMore: true,

    fetchEvents: async (city?: string) => {
        if (get().loading) return;
        set({ loading: true, error: null });

        try {
            const db = getDb();
            // Plain collection scan — no query(), no where, no orderBy, no limit.
            // This is the simplest possible Firestore read and requires zero indexes.
            // isPublicEvent filters to scheduled/live + removes garbage client-side.
            const snapshot = await getDocs(collection(db, "events"));
            let events = snapshot.docs.map(serialiseDoc).filter(isPublicEvent);

            if (city) {
                events = events.filter((e) => (e.city ?? "").toLowerCase() === city.toLowerCase());
            }

            events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

            set({ events, loading: false, lastId: null, hasMore: false });
        } catch (error: any) {
            console.error("Error fetching events:", error);
            set({ error: error.message, loading: false });
            throw error;
        }
    },

    fetchFeaturedEvents: async () => {
        if (get().featuredLoading) return;
        set({ featuredLoading: true });

        try {
            // Reuse already-fetched events from store if available; else plain scan.
            const existing = get().events;
            const all = existing.length > 0
                ? existing
                : (await getDocs(collection(getDb(), "events"))).docs.map(serialiseDoc).filter(isPublicEvent);

            const featured = all.filter((e) => e.isFeatured).sort((a, b) => (b.heatScore ?? 0) - (a.heatScore ?? 0));
            const byHeat = [...all].sort((a, b) => (b.heatScore ?? 0) - (a.heatScore ?? 0));
            const featuredEvents = (featured.length >= 3 ? featured : byHeat).slice(0, 10);
            set({ featuredEvents, featuredLoading: false });
        } catch (error: any) {
            console.error("Error fetching featured events:", error);
            set({ featuredLoading: false });
        }
    },

    fetchPublicEvents: async (options?: { limit?: number }) => {
        if (get().loading) return;
        set({ loading: true, error: null });

        try {
            const response = await apiFetch<{ events: Event[] }>(`/api/v1/events?limit=${options?.limit || 50}`, { requireAuth: false });

            set({ events: response.events, loading: false });
        } catch (error: any) {
            console.error("Error fetching public events:", error);
            set({ error: error.message, loading: false });
        }
    },

    searchEvents: async (filters: SearchFilters) => {
        if (get().searching) return;
        set({ searching: true, error: null });

        try {
            const queryParams = new URLSearchParams();
            if (filters.city && filters.city !== "All Cities") queryParams.set("city", filters.city);
            if (filters.category && filters.category !== "all") queryParams.set("category", filters.category);
            if (filters.dateFrom) queryParams.set("dateFrom", filters.dateFrom.toISOString());
            if (filters.dateTo) queryParams.set("dateTo", filters.dateTo.toISOString());
            queryParams.set("limit", "50");

            const response = await apiFetch<{ events: Event[] }>(`/api/v1/events?${queryParams.toString()}`, { requireAuth: false });
            let results = response.events;

            // Client-side text search
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
        const { lastId, hasMore, loading, events } = get() as any;

        if (!hasMore || loading || !lastId) return;

        set({ loading: true });

        try {
            const response = await apiFetch<{ events: Event[] }>(`/api/v1/events?limit=20&lastId=${lastId}`, { requireAuth: false });
            const newEvents = response.events;

            set({
                events: [...events, ...newEvents],
                loading: false,
                lastId: newEvents.length > 0 ? newEvents[newEvents.length - 1].id : null,
                hasMore: newEvents.length === 20,
            });
        } catch (error: any) {
            console.error("Error loading more events:", error);
            set({ error: error.message, loading: false });
        }
    },

    getEventById: async (id: string): Promise<Event | null> => {
        if (!id || typeof id !== "string") return null;
        try {
            const db = getDb();
            const docSnap = await getDoc(doc(db, "events", id));
            if (!docSnap.exists()) return null;
            return serialiseDoc(docSnap) as Event;
        } catch (error: any) {
            console.error("Error fetching event by id:", error);
            return null;
        }
    },

    clearSearch: () => {
        set({ searchResults: [], searching: false });
    },

    fetchByCategory: async (category: string, city?: string) => {
        const { categoryLoading } = get();
        if (categoryLoading[category]) return;

        set((s) => ({
            categoryLoading: { ...s.categoryLoading, [category]: true },
        }));

        try {
            const queryParams = new URLSearchParams();
            queryParams.set("category", category);
            if (city) queryParams.set("city", city);
            queryParams.set("limit", "20");

            const response = await apiFetch<{ events: Event[] }>(`/api/v1/events?${queryParams.toString()}`, { requireAuth: false });
            const events = response.events.filter(isPublicEvent);

            set((s) => ({
                categoryEvents: { ...s.categoryEvents, [category]: events },
                categoryLastId: { ...s.categoryLastId, [category]: events.length > 0 ? events[events.length - 1].id : null } as any,
                categoryHasMore: { ...s.categoryHasMore, [category]: response.events.length === 20 },
                categoryLoading: { ...s.categoryLoading, [category]: false },
            }));
        } catch (error: any) {
            // Silence AbortError (timeout or cleanup) to prevent intrusive console.error overlays
            if (!error.isAbort) {
                console.error(`Error fetching category ${category}:`, error);
            }
            set((s) => ({
                categoryLoading: { ...s.categoryLoading, [category]: false },
            }));
        }
    },

    loadMoreByCategory: async (category: string, city?: string) => {
        const { categoryLoading, categoryHasMore } = get();
        const state = get() as any;
        const lastId = state.categoryLastId?.[category];
        
        if (categoryLoading[category] || !categoryHasMore[category] || !lastId) return;

        set((s) => ({
            categoryLoading: { ...s.categoryLoading, [category]: true },
        }));

        try {
            const queryParams = new URLSearchParams();
            queryParams.set("category", category);
            if (city) queryParams.set("city", city);
            queryParams.set("lastId", lastId);
            queryParams.set("limit", "20");

            const response = await apiFetch<{ events: Event[] }>(`/api/v1/events?${queryParams.toString()}`, { requireAuth: false });
            const newEvents = response.events;

            set((s: any) => ({
                categoryEvents: {
                    ...s.categoryEvents,
                    [category]: [...(s.categoryEvents[category] ?? []), ...newEvents],
                },
                categoryLastId: { ...s.categoryLastId, [category]: newEvents.length > 0 ? newEvents[newEvents.length - 1].id : null },
                categoryHasMore: { ...s.categoryHasMore, [category]: newEvents.length === 20 },
                categoryLoading: { ...s.categoryLoading, [category]: false },
            }));
        } catch (error: any) {
            console.error(`Error loading more for category ${category}:`, error);
            set((s) => ({
                categoryLoading: { ...s.categoryLoading, [category]: false },
            }));
        }
    },
}));
