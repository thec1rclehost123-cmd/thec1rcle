/**
 * THE C1RCLE Mobile - Events Store
 * 
 * This store properly connects to Firestore using the same logic as the guest portal.
 * Uses lifecycle states for filtering and mapEventForClient-equivalent logic.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    doc,
    getDoc,
    Timestamp,
    startAfter,
    QueryDocumentSnapshot,
    onSnapshot,
    documentId,
    writeBatch,
    increment,
    limitToLast,
} from "firebase/firestore";
import { Image } from "react-native";
import { getFirebaseDb } from "@/lib/firebase";
import { WEB_BASE_URL } from "@/lib/config";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics";

// ============================================================================
// CONSTANTS (from @c1rcle/core/events)
// ============================================================================

export const EVENT_LIFECYCLE = {
    DRAFT: "draft",
    SUBMITTED: "submitted",
    NEEDS_CHANGES: "needs_changes",
    APPROVED: "approved",
    SCHEDULED: "scheduled",       // Publicly listed, tickets available
    LIVE: "live",                 // Currently happening
    COMPLETED: "completed",
    CANCELLED: "cancelled"
};

// Events visible to the public
export const PUBLIC_LIFECYCLE_STATES = [
    EVENT_LIFECYCLE.SCHEDULED,
    EVENT_LIFECYCLE.LIVE
];

// City normalization map
const CITY_MAP = [
    { key: "pune-in", label: "Pune, IN", matches: ["pune", "kp", "koregaon", "baner", "viman", "magarpatta", "hinjewadi", "kalyani"] },
    { key: "mumbai-in", label: "Mumbai, IN", matches: ["mumbai", "bandra", "andheri", "juhu", "worli", "colaba", "powai", "thane", "navi mumbai"] },
    { key: "bengaluru-in", label: "Bengaluru, IN", matches: ["bangalore", "bengaluru", "blr", "koramangala", "indiranagar", "hsr", "whitefield", "electronic city"] },
    { key: "goa-in", label: "Goa, IN", matches: ["goa", "anjuna", "morjim", "panjim", "panaji", "vagator", "baga", "calangute", "siolim", "assagao"] },
    { key: "delhi-in", label: "Delhi NCR, IN", matches: ["delhi", "gurgaon", "noida", "ncr", "saket", "hauz khas", "gurugram"] },
    { key: "hyderabad-in", label: "Hyderabad, IN", matches: ["hyderabad", "jubilee", "banjara", "hitech", "gachibowli"] },
    { key: "chennai-in", label: "Chennai, IN", matches: ["chennai", "madras", "adyar", "velachery", "omr"] },
    { key: "kolkata-in", label: "Kolkata, IN", matches: ["kolkata", "calcutta", "salt lake", "new town"] },
    { key: "jaipur-in", label: "Jaipur, IN", matches: ["jaipur", "pink city"] },
    { key: "chandigarh-in", label: "Chandigarh, IN", matches: ["chandigarh", "mohali", "panchkula"] }
];

// ============================================================================
// HELPER FUNCTIONS (equivalent to @c1rcle/core/events)
// ============================================================================

function normalizeCity(cityStr: string | undefined, locationStr: string = ""): string {
    const input = `${cityStr || ""} ${locationStr || ""}`.toLowerCase();

    // Find first matching city (exact same logic as core)
    const found = CITY_MAP.find(c =>
        c.matches.some(m => input.includes(m)) ||
        input.includes(c.key) ||
        input.includes(c.label.toLowerCase())
    );

    return found ? found.key : "other-in";
}

function getCityLabel(key: string): string {
    const found = CITY_MAP.find(c => c.key === key);
    return found ? found.label : "Other City";
}

/**
 * Helper to resolve an image URL (handles remote, relative, and storage paths)
 */
export const resolveImageUrl = (url: any): string | undefined => {
    if (!url) return undefined;

    // Handle Object if passed (common in some Firestore schemas where media is an object)
    let rawUrl = (typeof url === "string") ? url : (url.url || url.uri || url.path);
    if (!rawUrl || typeof rawUrl !== "string") return undefined;

    // 1. Full URL - return as is
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://") || rawUrl.startsWith("data:")) {
        return rawUrl;
    }

    // 2. Firebase Storage Paths (e.g. 'events/abc.jpg' or 'covers/xyz.png')
    // If it doesn't start with a slash and contains a slash (and it's not a full URL),
    // it's almost certainly a Firebase Storage path in the C1RCLE ecosystem.
    const isStoragePath = !rawUrl.startsWith("/") && rawUrl.includes("/");

    if (isStoragePath) {
        const BUCKET = "thec1rcle-india.firebasestorage.app";
        // We MUST encode the path for the API
        const encodedPath = encodeURIComponent(rawUrl);
        return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodedPath}?alt=media`;
    }

    // 3. Relative path - fallback to main production domain
    // These are usually for static assets or legacy site images.
    const cleanPath = rawUrl.startsWith("/") ? rawUrl.slice(1) : rawUrl;
    return `https://thec1rcle.com/${cleanPath}`;
};

const SEED_IMAGE_MAP: Record<string, any> = {
    "/events/neon-nights.jpg": require("@/assets/events/neon-nights.jpg"),
    "/events/poolside-vibes.jpg": require("@/assets/events/poolside-vibes.jpg"),
    "/events/rooftop-jazz.jpg": require("@/assets/events/rooftop-jazz.jpg"),
    "/events/techno-bunker.jpg": require("@/assets/events/techno-bunker.jpg"),
    "/events/art-collective.jpg": require("@/assets/events/art-collective.jpg"),
    "/events/urban-oasis.jpg": require("@/assets/events/urban-oasis.jpg"),
    "/events/electric-dreams.jpg": require("@/assets/events/electric-dreams.jpg"),
    "/events/sunday-soul.jpg": require("@/assets/events/sunday-soul.jpg"),
    "/events/indie-jam.jpg": require("@/assets/events/indie-jam.jpg"),
    "/events/vintage-market.jpg": require("@/assets/events/vintage-market.jpg"),
    "/events/midnight-run.jpg": require("@/assets/events/midnight-run.jpg"),
    "/events/comedy-club.jpg": require("@/assets/events/comedy-club.jpg"),
    "/events/after-dark-mansion.jpg": require("@/assets/events/after-dark-mansion.jpg"),
};

function resolvePoster(data: any): string | undefined {
    if (!data) return undefined;

    // Internal placeholders that should be skipped
    const isInternalPlaceholder = (url: any): boolean => {
        if (!url || typeof url !== "string") return true;
        const low = url.toLowerCase();
        return low.includes("placeholder.svg") || low.includes("holi-edit.svg") || low.includes("default");
    };

    // Check all possible field names for posters across different versions
    const fields = [
        data.poster,
        data.coverImage,
        data.image,
        data.flyer,
        data.banner,
        data.posterUrl,
        data.imageUrl,
        data.eventImage,
        data.attachment
    ];

    // Find first valid string OR object with a URL
    const found = fields.find(f => {
        if (!f) return false;
        if (typeof f === "string") return !isInternalPlaceholder(f) || SEED_IMAGE_MAP[f];
        if (typeof f === "object" && (f.url || f.uri || f.path)) return true;
        return false;
    });

    if (found && typeof found === "string" && SEED_IMAGE_MAP[found]) {
        return Image.resolveAssetSource(SEED_IMAGE_MAP[found]).uri;
    }

    if (!found) {
        // If no valid poster found, check if we have an internal placeholder
        // If so, return a nice fallback image for development/seeded data
        const hasPlaceholder = fields.some(f => typeof f === "string" && isInternalPlaceholder(f));
        if (hasPlaceholder) {
            // console.log("[resolvePoster] Replaced placeholder with Unsplash for", data.title || data.id);
            return "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&q=80&w=1000";
        }

        // Check gallery array as fallback
        const gallery = data.images || data.gallery || data.attachments || [];
        if (Array.isArray(gallery) && gallery.length > 0) {
            const first = gallery.find(img => {
                if (!img) return false;
                if (typeof img === "string") return !isInternalPlaceholder(img);
                if (typeof img === "object" && (img.url || img.uri || img.path)) return true;
                return false;
            });
            if (first) return resolveImageUrl(first);
        }

        // console.warn("[resolvePoster] No poster found for event:", data.title || data.id);
        return undefined;
    }

    return resolveImageUrl(found);
}

/**
 * Convert Firestore Timestamp to ISO string
 */
function toISOString(value: any): string | undefined {
    if (!value) return undefined;

    if (value instanceof Timestamp) {
        return value.toDate().toISOString();
    }
    if (value?.toDate && typeof value.toDate === "function") {
        return value.toDate().toISOString();
    }
    if (value?.seconds !== undefined) {
        return new Timestamp(value.seconds, value.nanoseconds).toDate().toISOString();
    }
    if (typeof value === "string") {
        return value;
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    return undefined;
}

/**
 * Map Firestore document to client-side Event object
 * Equivalent to mapEventForClient in guest portal
 */
function mapEventForClient(data: any, docId: string): Event {
    const eventId = docId || data.id || data.slug;
    const poster = resolvePoster(data);
    const cityKey = data.cityKey || normalizeCity(data.city, data.location);

    // Determine lifecycle state
    let lifecycle = data.lifecycle || data.status || EVENT_LIFECYCLE.DRAFT;

    // Determine event type
    const creatorRole = data.creatorRole || (data.hostId ? "host" : "venue");
    const eventType = creatorRole === "host" ? "host" : "venue";

    // Club events never need approval - normalize legacy states
    if (eventType === "venue" && (lifecycle === EVENT_LIFECYCLE.SUBMITTED || lifecycle === "pending")) {
        lifecycle = EVENT_LIFECYCLE.SCHEDULED;
    }

    // Parse dates
    const startDate = toISOString(data.startDate) || toISOString(data.date) || new Date().toISOString();
    const endDate = toISOString(data.endDate) || startDate;
    const createdAt = toISOString(data.createdAt) || new Date().toISOString();
    const updatedAt = toISOString(data.updatedAt) || createdAt;

    // Get host name from either hostName or host object
    const hostName = data.hostName || data.host?.name || data.host || undefined;

    // Get venue display
    const venue = data.venue?.trim() || data.location?.trim() || undefined;
    const venueId = data.venueId || undefined;
    const location = data.location?.trim() || undefined;
    const city = data.city?.trim() || undefined;
    const coordinates = data.coordinates ? {
        latitude: data.coordinates.latitude || data.coordinates._lat,
        longitude: data.coordinates.longitude || data.coordinates._long,
    } : undefined;

    // Derive tickets array
    const tickets: TicketTier[] = (data.tickets || []).map((t: any) => ({
        id: t.id,
        name: t.name || "General Entry",
        description: t.description,
        price: Number(t.price) || 0,
        quantity: Number(t.quantity) || 0,
        remaining: Number(t.remaining ?? t.quantity) || 0,
        entryType: t.entryType || "general",
    }));

    // Derive price range
    const prices = tickets.map(t => t.price).filter(p => p >= 0);
    const priceRange = {
        min: prices.length > 0 ? Math.min(...prices) : 0,
        max: prices.length > 0 ? Math.max(...prices) : 0,
    };

    return {
        id: eventId,
        slug: data.slug || eventId,
        title: data.title || "Untitled Event",
        summary: data.summary || "",
        description: data.description || data.summary || "",

        // Dates
        startDate,
        endDate,
        date: data.date || undefined, // Pre-formatted date string from Firestore
        time: data.time || undefined, // Pre-formatted time string from Firestore
        startTime: data.startTime || undefined,
        endTime: data.endTime || undefined,

        // Location
        venue,
        venueId,
        location,
        city,
        cityKey,
        cityLabel: getCityLabel(cityKey),
        coordinates,

        // Host
        hostId: data.hostId,
        hostName,

        // Media
        posterUrl: poster,
        coverImage: poster,
        poster,
        image: poster, // Legacy compat
        gallery: data.gallery || [],
        gradient: data.gradient,
        accentColor: data.accentColor,

        // Tickets
        tickets,
        priceRange,
        isRSVP: !!data.isRSVP || data.type === "rsvp",

        // Refined Price Logic
        startingPrice: priceRange.min,
        priceDisplay: data.isRSVP ? "RSVP" :
            priceRange.min === 0 ? "Free" :
                `₹${priceRange.min}`,

        // Categorization
        category: data.category || "Event",
        type: eventType,
        tags: data.tags || [],

        // Stats
        stats: {
            views: Number(data.stats?.views) || 0,
            saves: Number(data.stats?.saves) || 0,
            shares: Number(data.stats?.shares) || 0,
            rsvps: Number(data.stats?.rsvps) || 0,
        },
        heatScore: Number(data.heatScore) || 0,

        // State
        lifecycle,
        status: data.status || lifecycle,
        isPublic: PUBLIC_LIFECYCLE_STATES.includes(lifecycle),
        isFeatured: !!data.isFeatured,
        isTonight: new Date(startDate).toDateString() === new Date().toDateString(),
        isSoldOut: tickets.length > 0 && tickets.every(t => t.remaining <= 0),
        isHighDemand: tickets.some(t => t.remaining > 0 && t.remaining < t.quantity * 0.2),

        // Compliance & Safety
        ageLimit: data.ageLimit || (data.category === "Nightlife" ? "21+" : undefined),
        dressCode: data.dressCode || "Vibe-appropriate",
        capacity: data.capacity || 0,
        rating: data.rating || 4.8, // Fallback for premium feel

        // Partner/Promoter
        promoterIds: data.promoterIds || [],

        // Timestamps
        createdAt,
        updatedAt: toISOString(data.updatedAt) || updatedAt,
    };
}

// ============================================================================
// TYPES
// ============================================================================

export interface SearchFilters {
    query?: string;
    city?: string;
    category?: string;
    date?: string;
    price?: { min?: number; max?: number };
}

export interface TicketTier {
    id: string;
    name: string;
    description?: string;
    price: number;
    quantity: number;
    remaining: number;
    entryType: string;
    minPurchase?: number;
    maxPurchase?: number;
}

export interface Event {
    id: string;
    slug: string;
    title: string;
    summary: string;
    description: string;

    // Dates
    startDate: string;
    endDate: string;
    date?: string;
    time?: string;
    startTime?: string;
    endTime?: string;

    // Location
    venue?: string;
    venueId?: string;
    location?: string;
    city?: string;
    cityKey: string;
    cityLabel: string;
    coordinates?: {
        latitude: number;
        longitude: number;
    };

    // Host
    hostId?: string;
    hostName?: string;

    // Media
    posterUrl?: string;
    coverImage?: string;
    poster?: string;
    image?: string;
    gallery: string[];
    gradient?: any;
    accentColor?: string;

    // Tickets
    tickets: TicketTier[];
    priceRange: { min: number; max: number };
    startingPrice?: number;
    priceDisplay?: string;
    isRSVP: boolean;

    // Categorization
    category: string;
    type: string;
    tags: string[];

    // Stats
    stats: {
        views: number;
        saves: number;
        shares: number;
        rsvps: number;
    };
    heatScore: number;

    // Social Data
    interestedUsers?: Array<{
        id: string;
        name: string;
        photoURL?: string | null;
        initials: string;
    }>;
    attendees?: Array<{
        userId: string;
        name: string;
        avatar?: string | null;
        badge?: string;
        isFriend?: boolean; // Added for 'Friends Going' logic
    }>;

    // Compliance & Safety
    ageLimit?: string;      // e.g. "21+", "18+"
    dressCode?: string;     // e.g. "Smart Casual", "Black Tie"
    capacity?: number;
    rating?: number;

    // Partner/Promoter
    promoterIds?: string[];
    attachedPromoters?: Array<{
        id: string;
        name: string;
        avatar?: string;
    }>;

    // State
    lifecycle: string;
    status: string;
    isFeatured: boolean;
    isTonight: boolean;
    isSoldOut: boolean;
    isHighDemand: boolean;
    isPublic: boolean;

    // Timestamps
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// ZUSTAND STORE
// ============================================================================

interface EventsState {
    events: Event[];
    featuredEvents: Event[];
    loading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    error: string | null;
    currentEvent: Event | null;
    lastVisible: QueryDocumentSnapshot | null;
    inventorySubscriptions: Record<string, () => void>;
    trackedImpressions: Set<string>;

    // Actions
    fetchEvents: (options?: { city?: string; limit?: number; isRefresh?: boolean }) => Promise<void>;
    fetchMoreEvents: (options?: { city?: string; limit?: number }) => Promise<void>;
    batchFetchSocialContext: (eventIds: string[]) => Promise<void>;
    subscribeToEventStock: (eventIds: string[]) => void;
    unsubscribeFromAllStock: () => void;
    logEventImpression: (eventId: string) => Promise<void>;
    fetchPublicEvents: (options?: { city?: string; limit?: number; isRefresh?: boolean }) => Promise<void>;
    fetchFeaturedEvents: (options?: { city?: string }) => Promise<void>;
    getEventById: (id: string) => Promise<Event | null>;
    getEventInterested: (eventId: string) => Promise<void>;
    getEventAttendees: (eventId: string) => Promise<void>;
    searchEvents: (query: string, options?: { city?: string }) => Promise<Event[]>;
    clearCurrentEvent: () => void;
    clearError: () => void;
}

export const useEventsStore = create<EventsState>()(
    persist(
        (set, get) => ({
            events: [],
            featuredEvents: [],
            loading: false,
            loadingMore: false,
            hasMore: true,
            error: null,
            currentEvent: null,
            lastVisible: null,
            inventorySubscriptions: {},
            trackedImpressions: new Set(),

            clearError: () => set({ error: null }),
            clearCurrentEvent: () => set({ currentEvent: null }),

            getEventInterested: async (eventId: string) => {
                try {
                    const db = getFirebaseDb();
                    const eventDoc = await getDoc(doc(db, "events", eventId));
                    if (!eventDoc.exists()) return;

                    const eventData = eventDoc.data();

                    // Fetch likes for user previews
                    const likesQuery = query(
                        collection(db, "likes"),
                        where("eventId", "==", eventId),
                        orderBy("createdAt", "desc"),
                        limit(10)
                    );
                    const likesSnap = await getDocs(likesQuery);
                    const userIds = likesSnap.docs.map(doc => doc.data().userId);

                    if (userIds.length === 0) {
                        set(state => ({
                            currentEvent: state.currentEvent?.id === eventId
                                ? { ...state.currentEvent, interestedUsers: [] }
                                : state.currentEvent
                        }));
                        return;
                    }

                    // Fetch profiles
                    const users = await Promise.all(userIds.map(async (uid) => {
                        const userSnap = await getDoc(doc(db, "users", uid));
                        if (userSnap.exists()) {
                            const d = userSnap.data();
                            return {
                                id: uid,
                                name: d.displayName || "C1RCLE Member",
                                photoURL: d.photoURL || null,
                                initials: (d.displayName || "C").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                            };
                        }
                        return null;
                    }));

                    const interestedUsers = users.filter((u): u is NonNullable<typeof u> => u !== null);

                    set(state => ({
                        currentEvent: state.currentEvent?.id === eventId
                            ? { ...state.currentEvent, interestedUsers }
                            : state.currentEvent
                    }));
                } catch (error) {
                    console.warn("[EventsStore] Failed to fetch interested users", error);
                }
            },

            getEventAttendees: async (eventId: string) => {
                try {
                    const db = getFirebaseDb();

                    // Get confirmed orders
                    const ordersQuery = query(
                        collection(db, "orders"),
                        where("eventId", "==", eventId),
                        where("status", "in", ["confirmed", "checked_in"]),
                        limit(50)
                    );
                    const ordersSnap = await getDocs(ordersQuery);
                    const userIds = [...new Set(ordersSnap.docs.map(doc => doc.data().userId).filter(Boolean))];

                    if (userIds.length === 0) return;

                    // Fetch profiles
                    const attendeesList = await Promise.all(userIds.slice(0, 10).map(async (uid) => {
                        const userSnap = await getDoc(doc(db, "users", uid as string));
                        if (userSnap.exists()) {
                            const d = userSnap.data();
                            return {
                                userId: uid as string,
                                name: d.displayName || "Guest",
                                avatar: d.photoURL || null,
                                badge: d.role === "host" ? "host" : undefined
                            };
                        }
                        return null;
                    }));

                    const validAttendees = attendeesList.filter((a): a is NonNullable<typeof a> => a !== null);

                    set(state => ({
                        currentEvent: state.currentEvent?.id === eventId
                            ? { ...state.currentEvent, attendees: validAttendees }
                            : state.currentEvent
                    }));
                } catch (error) {
                    console.warn("[EventsStore] Failed to fetch attendees", error);
                }
            },

            fetchEvents: async (options = {}) => {
                const { city, limit: maxEvents = 50, isRefresh = false } = options;

                if (isRefresh) {
                    set({ loading: true, error: null, lastVisible: null, hasMore: true });
                } else {
                    set({ loading: true, error: null });
                }

                try {
                    const db = getFirebaseDb();
                    const eventsRef = collection(db, "events");
                    const nowIso = new Date().toISOString();

                    let snapshot;
                    let fetchedEvents: Event[] = [];

                    try {
                        // Base filters
                        const queryConstraints = [
                            where("lifecycle", "in", PUBLIC_LIFECYCLE_STATES),
                            where("endDate", ">=", nowIso),
                            orderBy("endDate", "asc"),
                            limit(maxEvents)
                        ];

                        // Add city filter at source if provided
                        if (city) {
                            queryConstraints.unshift(where("cityKey", "==", city));
                        }

                        const q = query(eventsRef, ...queryConstraints);
                        snapshot = await getDocs(q);

                        fetchedEvents = snapshot.docs.map((doc: any) =>
                            mapEventForClient(doc.data(), doc.id)
                        );

                        // SUPPLEMENTAL FALLBACK: If we have very few events in this city (< 10), 
                        // fetch additional public events from other cities to maintain a high-density 'premium' feed.
                        if (city && fetchedEvents.length < 10) {
                            console.log(`[EventsStore] Supplementing ${fetchedEvents.length} city events with global content`);
                            const qSupplement = query(
                                eventsRef,
                                where("lifecycle", "in", PUBLIC_LIFECYCLE_STATES),
                                where("endDate", ">=", nowIso),
                                orderBy("endDate", "asc"),
                                limit(maxEvents)
                            );
                            const supplementSnap = await getDocs(qSupplement);
                            const supplementEvents = supplementSnap.docs.map((doc: any) =>
                                mapEventForClient(doc.data(), doc.id)
                            );

                            // Merge and deduplicate
                            const existingIds = new Set(fetchedEvents.map(e => e.id));
                            supplementEvents.forEach(e => {
                                if (!existingIds.has(e.id)) {
                                    fetchedEvents.push(e);
                                    existingIds.add(e.id);
                                }
                            });
                        }

                        // Ensure we respect maxEvents limit
                        fetchedEvents = fetchedEvents.slice(0, maxEvents);
                        snapshot = { docs: snapshot.docs }; // Keep for lastVisibleDoc logic below if needed, though we use fetchedEvents now
                    } catch (indexError: any) {
                        console.warn("[EventsStore] Index error or query failed:", indexError.message);
                        // Fallback to simpler query
                        const qFallback = query(
                            eventsRef,
                            where("lifecycle", "in", PUBLIC_LIFECYCLE_STATES),
                            orderBy("endDate", "asc"),
                            limit(maxEvents)
                        );
                        const fallbackSnap = await getDocs(qFallback);
                        fetchedEvents = fallbackSnap.docs.map((doc: any) =>
                            mapEventForClient(doc.data(), doc.id)
                        );
                    }

                    const lastVisibleDoc = (snapshot?.docs && snapshot.docs.length > 0)
                        ? (snapshot.docs[snapshot.docs.length - 1] as QueryDocumentSnapshot)
                        : null;

                    // DATA QUALITY FILTERING: Hide events with missing critical info
                    fetchedEvents = fetchedEvents.filter(event => {
                        const title = (event.title || "").trim();
                        const titleLower = title.toLowerCase();

                        // 1. Must have a real title (ignore placeholders)
                        if (!title || titleLower === "untitled event") return false;

                        // 2. Must have a real location/venue
                        const location = (event.location || event.venue || "").trim().toLowerCase();
                        if (!location || location === "tbd" || location === "tba") return false;

                        return true;
                    });

                    set({
                        events: fetchedEvents,
                        loading: false,
                        lastVisible: lastVisibleDoc,
                        hasMore: fetchedEvents.length >= maxEvents // Using fetchedEvents count for hasMore
                    });

                    // Proactive: Fetch social context for the first batch
                    if (fetchedEvents.length > 0) {
                        get().batchFetchSocialContext(fetchedEvents.slice(0, 10).map((e: Event) => e.id));
                    }
                } catch (error: any) {
                    console.error("[EventsStore] Error fetching events:", error);
                    set({ error: error.message, loading: false });
                }
            },

            fetchMoreEvents: async (options = {}) => {
                const { city, limit: maxEvents = 30 } = options;
                const { lastVisible, hasMore, loadingMore, events } = get();

                if (loadingMore || !hasMore || !lastVisible) return;

                set({ loadingMore: true });

                try {
                    const db = getFirebaseDb();
                    const eventsRef = collection(db, "events");
                    const nowIso = new Date().toISOString();

                    const queryConstraints = [
                        where("lifecycle", "in", PUBLIC_LIFECYCLE_STATES),
                        where("endDate", ">=", nowIso),
                        orderBy("endDate", "asc"),
                        startAfter(lastVisible),
                        limit(maxEvents)
                    ];

                    if (city) {
                        queryConstraints.unshift(where("cityKey", "==", city));
                    }

                    const q = query(eventsRef, ...queryConstraints);
                    const snapshot = await getDocs(q);

                    const newLastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
                    let moreEvents = snapshot.docs.map((doc: any) =>
                        mapEventForClient(doc.data(), doc.id)
                    );

                    // Apply same data quality filtering to additional pages
                    moreEvents = moreEvents.filter(event => {
                        const title = (event.title || "").trim();
                        const titleLower = title.toLowerCase();
                        if (!title || titleLower === "untitled event") return false;

                        const location = (event.location || event.venue || "").trim().toLowerCase();
                        if (!location || location === "tbd" || location === "tba") return false;

                        return true;
                    });

                    set({
                        events: [...events, ...moreEvents],
                        loadingMore: false,
                        lastVisible: newLastVisible,
                        hasMore: snapshot.docs.length === maxEvents
                    });
                } catch (error: any) {
                    console.error("[EventsStore] Error fetching more events:", error);
                    set({ loadingMore: false });
                }
            },

            fetchPublicEvents: async (options) => {
                return get().fetchEvents(options);
            },

            batchFetchSocialContext: async (eventIds: string[]) => {
                if (eventIds.length === 0) return;

                // Limit to 10 per batch (Firestore 'in' query limit is 30, but 10 is safer for performance)
                const targetIds = eventIds.slice(0, 10);

                try {
                    const db = getFirebaseDb();

                    // 1. Fetch Likes (Interested)
                    const likesQuery = query(
                        collection(db, "likes"),
                        where("eventId", "in", targetIds),
                        orderBy("createdAt", "desc")
                    );
                    const likesSnap = await getDocs(likesQuery);

                    // Group likes by eventId
                    const likesByEvent: Record<string, any[]> = {};
                    likesSnap.docs.forEach(doc => {
                        const data = doc.data();
                        if (!likesByEvent[data.eventId]) likesByEvent[data.eventId] = [];
                        if (likesByEvent[data.eventId].length < 5) { // Only need a few previews
                            likesByEvent[data.eventId].push({
                                userId: data.userId,
                                createdAt: data.createdAt
                            });
                        }
                    });

                    // 2. Map back to events state
                    set(state => ({
                        events: state.events.map(event => {
                            if (targetIds.includes(event.id) && likesByEvent[event.id]) {
                                // In a real app, we'd fetch profile details here or use a cache
                                // For now, we update the interest count
                                return {
                                    ...event,
                                    stats: {
                                        ...event.stats,
                                        saves: likesByEvent[event.id].length // Approximation for demo
                                    }
                                };
                            }
                            return event;
                        })
                    }));

                } catch (error) {
                    console.warn("[EventsStore] Batch social fetch failed", error);
                }
            },

            subscribeToEventStock: (eventIds: string[]) => {
                const { inventorySubscriptions } = get();
                const db = getFirebaseDb();

                // Only subscribe to new ones
                const newIds = eventIds.filter(id => !inventorySubscriptions[id]);
                if (newIds.length === 0) return;

                const newSubs = { ...inventorySubscriptions };

                // Firestore 'in' query for document IDs
                // Note: We might need to split this if newIds > 10
                const q = query(
                    collection(db, "events"),
                    where(documentId(), "in", newIds.slice(0, 10))
                );

                const unsubscribe = onSnapshot(q, (snapshot) => {
                    set(state => {
                        const updatedEvents = [...state.events];
                        snapshot.docChanges().forEach(change => {
                            const data = change.doc.data();
                            const index = updatedEvents.findIndex(e => e.id === change.doc.id);
                            if (index !== -1) {
                                const current = updatedEvents[index];
                                // Only update if essential inventory stats changed
                                updatedEvents[index] = {
                                    ...current,
                                    tickets: data.tickets || current.tickets,
                                    isSoldOut: (data.tickets || []).every((t: any) => (t.remaining ?? 0) <= 0),
                                    lifecycle: data.lifecycle || current.lifecycle
                                };
                            }
                        });
                        return { events: updatedEvents };
                    });
                });

                newIds.slice(0, 10).forEach(id => {
                    newSubs[id] = unsubscribe;
                });

                set({ inventorySubscriptions: newSubs });
            },

            unsubscribeFromAllStock: () => {
                const { inventorySubscriptions } = get();
                Object.values(inventorySubscriptions).forEach(unsub => unsub());
                set({ inventorySubscriptions: {} });
            },

            logEventImpression: async (eventId: string) => {
                const { trackedImpressions } = get();

                // Prevent duplicate tracking in the same session
                if (trackedImpressions.has(eventId)) return;

                try {
                    // 1. Mark as tracked locally
                    trackedImpressions.add(eventId);

                    // 2. Track to analytics (this is safe and non-blocking)
                    await trackEvent(ANALYTICS_EVENTS.EVENT_VIEWED, {
                        eventId,
                        source: "explore_feed"
                    });

                    // NOTE: Direct Firestore increments are disabled from the client 
                    // due to security rules. The backend service now auto-aggregates these 
                    // from the analytics stream to update heatScore/views safely.
                } catch (error) {
                    // fail silently
                }
            },

            fetchFeaturedEvents: async (options = {}) => {
                const { city } = options;
                try {
                    const db = getFirebaseDb();
                    const eventsRef = collection(db, "events");
                    const nowIso = new Date().toISOString();

                    // 1. Fetch top events by heat score for the city
                    // We also try to fetch explicitly featured ones if they exist
                    let queryConstraints = [
                        where("lifecycle", "in", PUBLIC_LIFECYCLE_STATES),
                        where("endDate", ">=", nowIso),
                        orderBy("endDate", "asc"),
                        limit(50)
                    ];

                    if (city) {
                        queryConstraints.unshift(where("cityKey", "==", city));
                    }

                    const q = query(eventsRef, ...queryConstraints);
                    const snapshot = await getDocs(q);

                    let allEvents: Event[] = snapshot.docs.map(doc =>
                        mapEventForClient(doc.data(), doc.id)
                    );

                    // 2. Filter out junk
                    allEvents = allEvents.filter(event => {
                        const title = (event.title || "").trim().toLowerCase();
                        if (!title || title === "untitled event") return false;
                        const location = (event.location || event.venue || "").trim().toLowerCase();
                        if (!location || location === "tbd" || location === "tba") return false;
                        if (!event.posterUrl && !event.coverImage) return false;
                        return true;
                    });

                    // 3. Sort by priority: isFeatured (Admin control) then heatScore (Organic heat)
                    allEvents.sort((a, b) => {
                        // Admin-featured events always go first
                        if (a.isFeatured && !b.isFeatured) return -1;
                        if (!a.isFeatured && b.isFeatured) return 1;

                        // Then by heat score
                        return (b.heatScore || 0) - (a.heatScore || 0);
                    });

                    // 4. Take top 6 for the carousel
                    set({ featuredEvents: allEvents.slice(0, 6) });

                } catch (error: any) {
                    console.error("[EventsStore] Error fetching featured events:", error);
                    // Fallback to memory
                    const { events } = get();
                    set({ featuredEvents: events.slice(0, 5) });
                }
            },

            getEventById: async (id: string): Promise<Event | null> => {
                // First check if already loaded
                const { events } = get();
                const cached = events.find(e => e.id === id || e.slug === id);
                if (cached) {
                    set({ currentEvent: cached });
                    return cached;
                }

                // Fetch from Firestore
                try {
                    const db = getFirebaseDb();

                    // Try by document ID first
                    const docRef = doc(db, "events", id);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        const event = mapEventForClient(docSnap.data(), docSnap.id);
                        set({ currentEvent: event });
                        return event;
                    }

                    // Try by slug
                    const slugQuery = query(
                        collection(db, "events"),
                        where("slug", "==", id),
                        limit(1)
                    );
                    const slugSnapshot = await getDocs(slugQuery);

                    if (!slugSnapshot.empty) {
                        const doc = slugSnapshot.docs[0];
                        const event = mapEventForClient(doc.data(), doc.id);
                        set({ currentEvent: event });
                        return event;
                    }

                    console.warn(`[EventsStore] Event not found: ${id}`);
                    return null;
                } catch (error: any) {
                    console.error(`[EventsStore] Error fetching event ${id}:`, error);
                    return null;
                }
            },

            searchEvents: async (searchQuery, options = {}) => {
                const { city } = options;
                if (!searchQuery.trim()) return [];

                try {
                    const db = getFirebaseDb();
                    const eventsRef = collection(db, "events");
                    const nowIso = new Date().toISOString();
                    const lowerQuery = searchQuery.toLowerCase();
                    const words = lowerQuery.split(/\s+/).filter(w => w.length > 2);

                    if (words.length === 0) return [];

                    // Fire a query using the first significant word in the keywords array
                    const q = query(
                        eventsRef,
                        where("lifecycle", "in", PUBLIC_LIFECYCLE_STATES),
                        where("endDate", ">=", nowIso),
                        where("keywords", "array-contains", words[0]),
                        limit(40)
                    );

                    const snapshot = await getDocs(q);
                    let results = snapshot.docs.map(doc => mapEventForClient(doc.data(), doc.id));

                    // Refine in memory for multi-word matches and city
                    results = results.filter(event => {
                        const title = event.title.toLowerCase();
                        const venue = (event.venue || event.location || "").toLowerCase();
                        const category = event.category.toLowerCase();

                        const matchesAllWords = words.every(word =>
                            title.includes(word) || venue.includes(word) || category.includes(word)
                        );

                        const matchesCity = !city || city === "All Cities" || event.cityKey === city;

                        return matchesAllWords && matchesCity;
                    });

                    return results;
                } catch (error) {
                    console.error("[EventsStore] Search failed:", error);
                    return [];
                }
            },
        }),
        {
            name: "c1rcle-events-storage",
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                events: state.events,
                featuredEvents: state.featuredEvents,
                currentEvent: state.currentEvent,
            }),
        }
    )
);

// Export helper functions for use elsewhere
export { mapEventForClient, resolvePoster, normalizeCity, getCityLabel, toISOString };
