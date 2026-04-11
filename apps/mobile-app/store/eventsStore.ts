import { create } from "zustand";
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
    // Strictly mirror guest portal filterAndSortEvents from @c1rcle/core/event-engine:
    // 1. lifecycle must be in PUBLIC_LIFECYCLE_STATES — no fallback for missing field
    if (!e.lifecycle || !PUBLIC_LIFECYCLES.has(e.lifecycle)) return false;

    // 2. Reject deleted events
    if ((e as any).isDeleted === true) return false;

    // 3. Exclude past events — normalize date-only strings (YYYY-MM-DD) to end-of-day
    //    so today's events aren't filtered out (mirrors guest portal behaviour)
    const nowIso = new Date().toISOString();
    const end = e.endDate || e.startDate;
    const endNormalized = end && end.length === 10 ? end + "T23:59:59.999Z" : end;
    if (!endNormalized || endNormalized < nowIso) return false;

    // 4. Basic title sanity check
    if ((e.title ?? "").length < 2) return false;

    return true;
}

// Robust heat score extractor (mirrors Guest Portal logic)
export function getHeatScore(e: Event): number {
    return e.heatScore ?? (e as any).stats?.heatScore ?? 0;
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

            const featured = all.filter((e) => e.isFeatured).sort((a, b) => getHeatScore(b) - getHeatScore(a));
            const byHeat = [...all].sort((a, b) => getHeatScore(b) - getHeatScore(a));
            
            // Sync with Guest Portal: prioritises isFeatured flag, fills with heat, limit 6
            const featuredEvents = (featured.length >= 3 ? featured : byHeat).slice(0, 6);
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
            const snapshot = await getDocs(collection(getDb(), "events"));
            const limit = options?.limit || 50;
            const events = snapshot.docs.map(serialiseDoc).filter(isPublicEvent).slice(0, limit);
            set({ events, loading: false });
        } catch (error: any) {
            console.error("Error fetching public events:", error);
            set({ error: error.message, loading: false });
        }
    },

    searchEvents: async (filters: SearchFilters) => {
        if (get().searching) return;
        set({ searching: true, error: null });

        try {
            // Use in-memory events if already loaded, else do a fresh Firestore scan
            const base = get().events.length > 0
                ? get().events
                : (await getDocs(collection(getDb(), "events"))).docs.map(serialiseDoc).filter(isPublicEvent);

            let results = base;

            if (filters.city && filters.city !== "All Cities") {
                results = results.filter((e: Event) => (e.city ?? "").toLowerCase() === filters.city!.toLowerCase());
            }
            if (filters.category && filters.category !== "all") {
                results = results.filter((e: Event) => e.category === filters.category || e.type === filters.category);
            }
            if (filters.dateFrom) {
                results = results.filter((e: Event) => new Date(e.startDate) >= filters.dateFrom!);
            }
            if (filters.dateTo) {
                results = results.filter((e: Event) => new Date(e.startDate) <= filters.dateTo!);
            }
            if (filters.query) {
                const q = filters.query.toLowerCase();
                results = results.filter((e: Event) =>
                    e.title.toLowerCase().includes(q) ||
                    e.venue?.toLowerCase().includes(q) ||
                    e.location?.toLowerCase().includes(q) ||
                    e.hostName?.toLowerCase().includes(q) ||
                    e.description?.toLowerCase().includes(q)
                );
            }
            if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
                results = results.filter((e: Event) => {
                    const minPrice = Math.min(...(e.tickets?.map((t: TicketTier) => t.price) || [Infinity]));
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
        // fetchEvents loads the full collection at once; nothing more to page through
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

        set((s) => ({ categoryLoading: { ...s.categoryLoading, [category]: true } }));

        try {
            const base = get().events.length > 0
                ? get().events
                : (await getDocs(collection(getDb(), "events"))).docs.map(serialiseDoc).filter(isPublicEvent);

            let events = base.filter((e: Event) => e.category === category || e.type === category);
            if (city) events = events.filter((e: Event) => (e.city ?? "").toLowerCase() === city.toLowerCase());

            set((s) => ({
                categoryEvents: { ...s.categoryEvents, [category]: events },
                categoryHasMore: { ...s.categoryHasMore, [category]: false },
                categoryLoading: { ...s.categoryLoading, [category]: false },
            }));
        } catch (error: any) {
            if (!error.isAbort) console.error(`Error fetching category ${category}:`, error);
            set((s) => ({ categoryLoading: { ...s.categoryLoading, [category]: false } }));
        }
    },

    loadMoreByCategory: async (_category: string, _city?: string) => {
        // fetchByCategory loads all matching events at once; nothing more to page through
    },
}));
