import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { fetchPublicEvents } from "../features/discovery/publicDiscovery";

/**
 * ⚡ Zustand Cache for Explore Page Events
 *
 * - First visit ever: fetches from API, shows skeleton, caches to localStorage.
 * - Subsequent visits (any session, < 5 min fresh): instant from localStorage,
 *   no skeleton, zero network.
 * - Stale (> 5 min): shows cached data IMMEDIATELY, silently revalidates in
 *   the background (stale-while-revalidate). No skeleton on return visits.
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function buildQueryKey({ city = "", filtersKey = "all", sort = "soonest" } = {}) {
    return JSON.stringify({
        city: city || "all",
        filtersKey: filtersKey || "all",
        sort: sort || "soonest",
    });
}

const dedupeEvents = (events = []) => {
    const seen = new Set();
    return events.filter((event) => {
        const id = event?.id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
    });
};

export const useExploreStore = create(
    persist(
        (set, get) => ({
            events: [],
            // 'idle' | 'loading' | 'ready' | 'error'
            status: "idle",
            // true while silently revalidating stale data in the background
            revalidating: false,
            error: "",
            nextCursor: null,
            hasMore: true,
            lastFetchedAt: null,
            lastQueryKey: buildQueryKey(),

            fetchEvents: async (city = null, reset = false, sort = "soonest", filtersKey = "all", backendFilters = {}) => {
                const queryKey = buildQueryKey({ city, filtersKey, sort });
                const {
                    lastFetchedAt,
                    status,
                    nextCursor,
                    events: existingEvents,
                    revalidating,
                    lastQueryKey,
                } = get();
                const queryChanged = lastQueryKey !== queryKey;

                // ⚡ Guard: Already fetching
                if (status === "loading" || revalidating) return;

                const isFresh = !queryChanged && lastFetchedAt !== null && Date.now() - lastFetchedAt < CACHE_TTL_MS;

                if (!reset && isFresh) {
                    // Cache is fresh. If status is still "idle" (just rehydrated from localStorage),
                    // flip it to "ready" so the page renders data instead of a skeleton.
                    if (status === "idle" && existingEvents.length > 0) {
                        set({ status: "ready" });
                    }
                    return;
                }

                const hasExistingData = !queryChanged && existingEvents.length > 0;

                if (hasExistingData && !reset) {
                    // Stale-while-revalidate: show current data, fetch silently
                    set({ revalidating: true, error: "" });
                } else {
                    // No cached data or explicit reset — skeleton is appropriate
                    set({
                        status: "loading",
                        revalidating: false,
                        error: "",
                        events: queryChanged ? [] : existingEvents,
                        nextCursor: queryChanged ? null : nextCursor,
                        hasMore: queryChanged ? true : get().hasMore,
                        lastQueryKey: queryKey,
                    });
                }

                try {
                    const cursor = reset || queryChanged ? "" : (nextCursor || "");

                    const query = {
                        limit: "24",
                        sort,
                        ...backendFilters,
                    };
                    if (city) query.city = city;
                    if (cursor) query.lastId = cursor;

                    const payload = await fetchPublicEvents(query);
                    const newEvents = Array.isArray(payload.events)
                        ? payload.events
                        : Array.isArray(payload.items)
                            ? payload.items
                            : [];
                    // Only append when paginating (cursor set). Without a cursor we're
                    // fetching from page 1 — replace to avoid duplicating stale entries.
                    const updatedEvents = dedupeEvents((reset || !cursor) ? newEvents : [...existingEvents, ...newEvents]);

                    set({
                        events: updatedEvents,
                        nextCursor: payload.nextCursor || null,
                        hasMore: payload.hasMore !== undefined ? payload.hasMore : false,
                        status: "ready",
                        revalidating: false,
                        lastFetchedAt: Date.now(),
                        lastQueryKey: queryKey,
                        error: "",
                    });

                } catch (err) {
                    set((state) => ({
                        status: state.events.length > 0 ? "ready" : "error",
                        revalidating: false,
                        error: err.message || "Unable to fetch events",
                    }));
                }
            },

            seedEvents: ({ city = null, filtersKey = "all", sort = "soonest", events = [] }) => {
                const queryKey = buildQueryKey({ city, filtersKey, sort });
                set({
                    error: "",
                    events,
                    hasMore: true,
                    lastFetchedAt: Date.now(),
                    lastQueryKey: queryKey,
                    nextCursor: null,
                    revalidating: false,
                    status: events.length > 0 ? "ready" : "idle",
                });
            },

            invalidate: () => set({ lastFetchedAt: null }),
        }),
        {
            name: "explore-cache",
            // Guard localStorage access: during SSR (Next.js server), window is undefined.
            // Returning undefined tells Zustand to skip persistence server-side and only
            // hydrate on the client — prevents "storage.setItem is not a function" crash.
            // Additionally, wrap setItem to catch QuotaExceededError so persistence
            // failures don't crash the app — the store works fine without cache.
            storage: createJSONStorage(() => {
                if (typeof window === "undefined") return undefined;
                return {
                    getItem: (name) => localStorage.getItem(name),
                    setItem: (name, value) => {
                        try {
                            localStorage.setItem(name, value);
                        } catch (e) {
                            // QuotaExceededError — silently skip cache write
                            console.warn("[explore-cache] localStorage quota exceeded, skipping cache write.");
                        }
                    },
                    removeItem: (name) => localStorage.removeItem(name),
                };
            }),
            // Persist only the data — transient UI state (status, revalidating, error) is not persisted.
            // Cap cached events at 24 to keep the payload within localStorage limits.
            partialize: (state) => ({
                events: state.events.slice(0, 24),
                lastFetchedAt: state.lastFetchedAt,
                lastQueryKey: state.lastQueryKey,
                nextCursor: state.nextCursor,
                hasMore: state.hasMore,
            }),
            version: 1,
            migrate: (persistedState) => persistedState,
        }
    )
);
