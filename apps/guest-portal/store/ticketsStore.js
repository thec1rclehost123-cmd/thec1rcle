"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * ⚡ Tickets Cache Store
 *
 * Problem: `TicketsContent` called `getUserTickets(user.uid)` every time the
 * component mounted — i.e., on every tab switch to /tickets.
 * This meant a Firestore read + data transformation on every revisit.
 *
 * Solution: Cache the grouped tickets per user UID with a 2-minute TTL.
 * - Shorter TTL than explore (2min) because ticket data is more time-sensitive
 *   (transfers, claims, and cancellations can change state quickly).
 * - Cache is keyed by user.uid so multi-account use or sign-out is handled cleanly.
 * - After a mutation (transfer, cancel, claim), call `invalidate(uid)` to force refetch.
 *
 * Rules followed:
 * - ✅ Zustand for global shared state
 * - ✅ Every API call has loading + error + success state
 * - ✅ No silent failures (errors are stored and surfaced)
 */

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes — tickets change more frequently

const EMPTY_TICKETS = {
    upcomingTickets: [],
    pastTickets: [],
    actionNeeded: [],
    cancelledTickets: [],
};

function createSafeLocalStorage() {
    if (typeof window === "undefined") return undefined;

    return {
        getItem: (name) => localStorage.getItem(name),
        setItem: (name, value) => {
            try {
                localStorage.setItem(name, value);
            } catch (error) {
                console.warn("[tickets-cache] localStorage quota exceeded, skipping cache write.", error);
            }
        },
        removeItem: (name) => localStorage.removeItem(name),
    };
}

function getMostRecentCacheEntry(cache, lastUid) {
    if (!cache || typeof cache !== "object") return {};

    if (lastUid && cache[lastUid]) {
        return { [lastUid]: cache[lastUid] };
    }

    const latestEntry = Object.entries(cache)
        .filter(([, value]) => value?.fetchedAt)
        .sort((a, b) => b[1].fetchedAt - a[1].fetchedAt)[0];

    return latestEntry ? { [latestEntry[0]]: latestEntry[1] } : {};
}

/**
 * Group a flat list of tickets by orderId (or eventId as fallback).
 * Extracted here so the store owns this logic, not the UI component.
 */
function groupTickets(list) {
    const groups = {};
    list.forEach((t) => {
        const key = t.orderId || t.eventId;
        if (!groups[key]) {
            groups[key] = { ...t, isGroup: true, tickets: [] };
        }
        groups[key].tickets.push(t);
    });
    return Object.values(groups);
}

export const useTicketsStore = create(
    persist(
        (set, get) => ({
            // Cache keyed by user.uid: { [uid]: { data: {...}, fetchedAt: number } }
            cache: {},

            // Tracks which user's cache should survive persistence.
            lastUid: null,

            // Currently visible grouped tickets
            tickets: EMPTY_TICKETS,

            // 'idle' | 'loading' | 'ready' | 'error'
            status: "idle",

            // Error message
            error: null,

            /**
             * Load tickets for a given user, using the cache when available.
             * Call this in a useEffect whenever user.uid changes.
             *
             * @param {string} uid - Firebase user UID
             */
            loadTickets: async (uid) => {
                if (!uid) return;

                const { cache } = get();
                const cached = cache[uid];

                // ⚡ Cache Hit: Return stored data instantly if still fresh (< 2 min)
                if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
                    set({ tickets: cached.data, status: "ready", error: null });
                    return;
                }

                // Cache Miss or Stale: Fetch via GET API route (replaces Server Action POST overhead)
                set({ status: "loading", error: null });

                try {
                    const res = await fetch("/api/tickets", {
                        credentials: "same-origin",
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data = await res.json();

                    const grouped = {
                        upcomingTickets: groupTickets(data.upcomingTickets || []),
                        pastTickets: groupTickets(data.pastTickets || []),
                        actionNeeded: data.actionNeeded || [],
                        cancelledTickets: data.cancelledTickets || [],
                    };

                    set((state) => ({
                        cache: {
                            ...state.cache,
                            [uid]: { data: grouped, fetchedAt: Date.now() },
                        },
                        lastUid: uid,
                        tickets: grouped,
                        status: "ready",
                        error: null,
                    }));
                } catch (err) {
                    console.error("Failed to load tickets:", err);
                    set({ status: "error", error: err.message || "Failed to load tickets" });
                }
            },

            /**
             * Force-invalidate cache for a specific user.
             * Call this after any mutation: ticket transfer, cancel, claim, etc.
             *
             * @param {string} uid - Firebase user UID
             */
            invalidate: (uid) =>
                set((state) => ({
                    cache: {
                        ...state.cache,
                        [uid]: undefined,
                    },
                    lastUid: state.lastUid === uid ? null : state.lastUid,
                })),

            /**
             * Clear all cached ticket data (call on sign-out).
             */
            clearAll: () => set({ cache: {}, lastUid: null, tickets: EMPTY_TICKETS, status: "idle" }),
        }),
        {
            name: 'tickets-cache',
            storage: createJSONStorage(createSafeLocalStorage),
            partialize: (state) => ({
                cache: getMostRecentCacheEntry(state.cache, state.lastUid),
                lastUid: state.lastUid,
            }),
            version: 1,
            migrate: (persistedState) => {
                const state = persistedState && typeof persistedState === "object" ? persistedState : {};
                const nextCache = getMostRecentCacheEntry(state.cache, state.lastUid);
                const nextLastUid = Object.keys(nextCache)[0] || null;

                return {
                    cache: nextCache,
                    lastUid: nextLastUid,
                };
            },
        }
    )
);
