import { create } from "zustand";

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

export const useHostsStore = create((set, get) => ({
    // Cache: { [queryKey]: { data: [], fetchedAt: number } }
    cache: {},

    // Current active results (what the page renders)
    results: [],

    // 'idle' | 'loading' | 'ready' | 'error'
    status: "idle",

    // Error message
    error: null,

    /**
     * Fetch hosts or venues, using the cache when available.
     *
     * @param {object} params - All active filter values
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
    } = {}) => {
        const cacheKey = buildCacheKey(
            activeTab, search, activeArea, activeVibe,
            activeRole, activeStatus, activeSort, tablesOnly
        );

        const { cache } = get();
        const cached = cache[cacheKey];

        // ⚡ Cache Hit: Return stored data instantly if still fresh (< 5 min)
        if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
            set({ results: cached.data, status: "ready", error: null });
            return;
        }

        // Cache Miss or Stale: Fetch from API
        set({ status: "loading", error: null });

        try {
            const endpoint = activeTab === "venues" ? "/api/venues" : "/api/hosts";
            const params = new URLSearchParams();

            if (search) params.append("search", search);
            if (activeVibe) params.append("vibe", activeVibe);
            if (activeSort) params.append("sort", activeSort);

            if (activeTab === "venues") {
                if (activeArea) params.append("area", activeArea);
                if (tablesOnly) params.append("tablesOnly", "true");
            } else {
                if (activeRole) params.append("role", activeRole);
                if (activeStatus) params.append("status", activeStatus);
            }

            const res = await fetch(`${endpoint}?${params.toString()}`);
            if (!res.ok) throw new Error(`Failed to load ${activeTab}`);
            const data = await res.json();

            // Store in cache and update current results
            set((state) => ({
                cache: {
                    ...state.cache,
                    [cacheKey]: { data, fetchedAt: Date.now() },
                },
                results: data,
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
}));
