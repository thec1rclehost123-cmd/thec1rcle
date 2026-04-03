import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * ⚡ Hosts/Venues Discovery Cache Store
 *
 * Problem: hosts/page.js called fetchData() on EVERY mount (every tab switch).
 * Each search/filter combination fired a fresh API call with no caching.
 *
 * Solution: Cache responses keyed by the full query string (tab + filters + search).
 * - Same filters within 5 minutes → instant response from memory
 * - Different filter combo → fetches fresh and caches that key too
 * - Cache is shared across tab switches — navigating away and back is instant
 * - Persistence: Cache survives page refresh.
 *
 * Cache structure: Map<queryKey, { data: [], fetchedAt: number }>
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Build a deterministic cache key from the current filter state.
 * Same filters always produce the same key.
 */
function buildCacheKey(tab, search, area, vibe, role, status, sort, tablesOnly) {
    return [tab, search, area, vibe, role, status, sort, tablesOnly].join("|");
}

export const useHostsStore = create(
    persist(
        (set, get) => ({
            // Cache: { [queryKey]: { data: [], fetchedAt: number } }
            cache: {},

            // Current results and pagination
            results: [],
            nextCursor: null,
            hasMore: true,

            // 'idle' | 'loading' | 'ready' | 'error'
            status: "idle",

            // Error message
            error: null,

            /**
             * Fetch hosts or venues, using the cache when available.
             *
             * @param {object} params - All active filter values
             * @param {boolean} reset - Whether to reset the list (initial load or filter change)
             */
            fetchData: async ({
                activeTab = "venues",
                search = "",
                activeArea = null,
                activeVibe = null,
                activeRole = null,
                activeStatus = null,
                activeSort = "Popular",
                tablesOnly = false,
            } = {}, reset = true) => {
                const queryKey = buildCacheKey(
                    activeTab, search, activeArea, activeVibe,
                    activeRole, activeStatus, activeSort, tablesOnly
                );

                const { cache, results: existingResults, nextCursor } = get();

                // Build a UNIQUE cache key including the cursor for pagination
                const fullCacheKey = `${queryKey}|${reset ? '' : (nextCursor || '')}`;
                const cached = cache[fullCacheKey];

                // ⚡ Cache Hit: Return stored data instantly if still fresh (< 5 min)
                if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
                    const updatedResults = reset ? cached.data.results : [...existingResults, ...cached.data.results];
                    set({
                        results: updatedResults,
                        nextCursor: cached.data.nextCursor,
                        hasMore: cached.data.hasMore,
                        status: "ready",
                        error: null
                    });
                    return;
                }

                // Cache Miss or Stale: Fetch from API
                set({ status: "loading", error: null });

                try {
                    const endpoint = activeTab === "venues" ? "/api/venues" : "/api/hosts";
                    const queryParams = new URLSearchParams();

                    if (search) queryParams.append("search", search);
                    if (activeVibe) queryParams.append("vibe", activeVibe);
                    if (activeSort) queryParams.append("sort", activeSort);
                    if (!reset && nextCursor) queryParams.append("lastId", nextCursor);
                    queryParams.append("limit", "12");

                    if (activeTab === "venues") {
                        if (activeArea) queryParams.append("area", activeArea);
                        if (tablesOnly) queryParams.append("tablesOnly", "true");
                    } else {
                        if (activeRole) queryParams.append("role", activeRole);
                        if (activeStatus) queryParams.append("status", activeStatus);
                    }

                    const res = await fetch(`${endpoint}?${queryParams.toString()}`);
                    if (!res.ok) throw new Error(`Failed to load ${activeTab}`);

                    const payload = await res.json();
                    // Normalizing response: { success, hosts: [], nextCursor, hasMore }
                    const newItems = Array.isArray(payload.hosts)
                        ? payload.hosts
                        : Array.isArray(payload.data)
                            ? payload.data
                            : [];
                    const updatedResults = reset ? newItems : [...existingResults, ...newItems];

                    // Store in cache and update current results
                    set((state) => ({
                        cache: {
                            ...state.cache,
                            [fullCacheKey]: {
                                data: { results: newItems, nextCursor: payload.nextCursor, hasMore: payload.hasMore },
                                fetchedAt: Date.now()
                            },
                        },
                        results: updatedResults,
                        nextCursor: payload.nextCursor || null,
                        hasMore: payload.hasMore !== undefined ? payload.hasMore : false,
                        status: "ready",
                        error: null,
                    }));
                } catch (err) {
                    set({ status: "error", error: err.message });
                }
            },

            /**
             * Invalidate the entire cache (call after follow/unfollow actions).
             */
            invalidate: () => set({ cache: {} }),
        }),
        {
            name: 'hosts-cache-v2',
            storage: createJSONStorage(() =>
                typeof window !== "undefined" ? localStorage : undefined
            ),
        }
    )
);
