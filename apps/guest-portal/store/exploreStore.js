import { create } from "zustand";

/**
 * ⚡ FIX 2: Zustand Cache for Explore Page Events
 *
 * Problem: explore/page.js called `fetch('/api/events')` on EVERY mount.
 * Every tab switch to /explore triggered a full network round-trip,
 * causing a 1-2 second blank loading state on revisit.
 *
 * Solution: This store acts as an in-memory cache with a 5-minute TTL.
 * - First visit: fetches from API and caches in Zustand state.
 * - Subsequent visits (< 5 min): returns cached data instantly — zero network.
 * - After 5 min: silently revalidates in the background.
 *
 * Rules followed:
 * - ✅ Zustand for global shared state (data lives across tab switches)
 * - ✅ No heavy logic in UI components (fetch logic moved here, out of page)
 * - ✅ Efficient state updates (guard prevents duplicate fetches)
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const useExploreStore = create((set, get) => ({
    // All events from the API
    events: [],

    // 'idle' | 'loading' | 'ready' | 'error'
    status: "idle",

    // Error message if fetch failed
    error: "",

    // Timestamp of last successful fetch (null = never fetched)
    lastFetchedAt: null,

    /**
     * Fetch events from the API, respecting the 5-minute cache TTL.
     * Call this in a useEffect on the Explore page.
     * On revisit within 5 minutes, this is a no-op.
     */
    fetchEvents: async () => {
        const { lastFetchedAt, status } = get();

        // ⚡ Guard 1: Already fetching — don't fire a duplicate request
        if (status === "loading") return;

        // ⚡ Guard 2: Cache is still fresh — skip network entirely
        const isFresh =
            lastFetchedAt !== null && Date.now() - lastFetchedAt < CACHE_TTL_MS;
        if (isFresh) return;

        set({ status: "loading", error: "" });

        try {
            const response = await fetch("/api/events?limit=60&sort=heat");

            if (!response.ok) {
                throw new Error("Unable to fetch events");
            }

            const payload = await response.json();

            set({
                events: Array.isArray(payload) ? payload : [],
                status: "ready",
                lastFetchedAt: Date.now(),
                error: "",
            });
        } catch (err) {
            // Don't clear existing cached data on error — show stale data instead
            set((state) => ({
                status: state.events.length > 0 ? "ready" : "error",
                error: err.message || "Unable to fetch events",
            }));
        }
    },

    /**
     * Force-invalidate the cache. Call this if the user manually refreshes
     * or if you know the data has changed (e.g. after creating an event).
     */
    invalidate: () => set({ lastFetchedAt: null }),
}));
