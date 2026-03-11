import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getUserTickets } from "../app/tickets/actions";

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

                // Cache Miss or Stale: Fetch from Firestore via server action
                set({ status: "loading", error: null });

                try {
                    const data = await getUserTickets(uid);

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
                })),

            /**
             * Clear all cached ticket data (call on sign-out).
             */
            clearAll: () => set({ cache: {}, tickets: EMPTY_TICKETS, status: "idle" }),
        }),
        {
            name: 'tickets-cache',
            storage: createJSONStorage(() =>
                typeof window !== "undefined" ? localStorage : undefined
            ),
        }
    )
);
