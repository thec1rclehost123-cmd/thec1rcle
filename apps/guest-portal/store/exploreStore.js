import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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

            fetchEvents: async (reset = false) => {
                const { lastFetchedAt, status, nextCursor, events: existingEvents, revalidating } = get();

                // ⚡ Guard: Already fetching
                if (status === "loading" || revalidating) return;

                const isFresh = lastFetchedAt !== null && Date.now() - lastFetchedAt < CACHE_TTL_MS;

                if (!reset && isFresh) {
                    // Cache is fresh. If status is still "idle" (just rehydrated from localStorage),
                    // flip it to "ready" so the page renders data instead of a skeleton.
                    if (status === "idle" && existingEvents.length > 0) {
                        set({ status: "ready" });
                    }
                    return;
                }

                const hasExistingData = existingEvents.length > 0;

                if (hasExistingData && !reset) {
                    // Stale-while-revalidate: show current data, fetch silently
                    set({ revalidating: true, error: "" });
                } else {
                    // No cached data or explicit reset — skeleton is appropriate
                    set({ status: "loading", revalidating: false, error: "" });
                }

                try {
                    const cursor = reset ? "" : (nextCursor || "");

                    let url = `/api/events?limit=12&sort=soonest`;
                    if (cursor) url += `&lastId=${cursor}`;

                    const response = await fetch(url);
                    if (!response.ok) throw new Error("Unable to fetch events");

                    const payload = await response.json();
                    const newEvents = payload.events || [];
                    const updatedEvents = reset ? newEvents : [...existingEvents, ...newEvents];

                    set({
                        events: updatedEvents,
                        nextCursor: payload.nextCursor || null,
                        hasMore: payload.hasMore !== undefined ? payload.hasMore : false,
                        status: "ready",
                        revalidating: false,
                        lastFetchedAt: Date.now(),
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

            invalidate: () => set({ lastFetchedAt: null }),
        }),
        {
            name: "explore-cache",
            storage: createJSONStorage(() => localStorage),
            // Persist only the data — transient UI state (status, revalidating, error) is not persisted
            partialize: (state) => ({
                events: state.events,
                lastFetchedAt: state.lastFetchedAt,
                nextCursor: state.nextCursor,
                hasMore: state.hasMore,
            }),
            version: 1,
        }
    )
);
