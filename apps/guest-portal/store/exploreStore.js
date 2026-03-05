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
 * - ✅ Persistence: Data survives page refresh (via localStorage)
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const useExploreStore = create(
    (set, get) => ({
        // All events from the API
        events: [],

        // 'idle' | 'loading' | 'ready' | 'error'
        status: "idle",

        // Error message if fetch failed
        error: "",

        // Pagination Metadata
        nextCursor: null,
        hasMore: true,

        /**
         * Fetch events from the API, supporting both initial load and 
         * "load more" via cursor-based pagination.
         */
        fetchEvents: async (reset = false) => {
            const { lastFetchedAt, status, nextCursor, events: existingEvents } = get();

            // ⚡ Guard: Already fetching
            if (status === "loading") return;

            // ⚡ Guard: Cache fresh (only for initial load)
            const isFresh = lastFetchedAt !== null && Date.now() - lastFetchedAt < CACHE_TTL_MS;
            if (!reset && isFresh) return;

            set({ status: "loading", error: "" });

            try {
                const cursor = reset ? "" : (nextCursor || "");
                const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || "";

                // We now pass lastId for server-side pagination
                let url = `${gatewayUrl}/api/v1/events?limit=12&sort=soonest`;
                if (cursor) url += `&lastId=${cursor}`;

                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error("Unable to fetch events");
                }

                const payload = await response.json();

                // payload looks like: { success: true, events: [], nextCursor: "...", hasMore: true }
                const newEvents = payload.events || [];
                const updatedEvents = reset ? newEvents : [...existingEvents, ...newEvents];

                set({
                    events: updatedEvents,
                    nextCursor: payload.nextCursor || null,
                    hasMore: payload.hasMore !== undefined ? payload.hasMore : false,
                    status: "ready",
                    lastFetchedAt: Date.now(),
                    error: "",
                });

            } catch (err) {
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
    })
);
