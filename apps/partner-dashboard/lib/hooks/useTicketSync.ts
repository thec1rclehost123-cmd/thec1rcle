"use client";

/**
 * useTicketSync — Bridges the event-creation wizard and the Ticket Types
 * management page via a shared localStorage layer.
 *
 * Data priority (highest → lowest):
 *   1. Firestore via API  (source of truth in production)
 *   2. Dedicated tickets key in localStorage  `c1rcle_event_tickets_${eventId}`
 *   3. Wizard draft key in localStorage  `c1rcle_draft_event_v2_*_${eventId}`
 *
 * When the API succeeds its data is written back to localStorage so the page
 * survives a hard refresh even if the API is temporarily unreachable.
 * When the API fails, the hook falls back to whatever is in localStorage so
 * the UI always has something to render.
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TicketStatus = "on_sale" | "hidden" | "sold_out" | "scheduled";

export interface TicketTier {
    id: string;
    name: string;
    status: TicketStatus;
    price: number | null;
    sold: number;
    capacity: number;
    openSale: string | null;
    endSale: string | null;
}

export interface TicketFormValues {
    name: string;
    price: string;
    quantity: string;
    openSale: string;
    endSale: string;
}

// ─── localStorage helpers ───────────────────────────────────────────────────────

const TICKETS_KEY = (eventId: string) => `c1rcle_event_tickets_${eventId}`;

/**
 * Normalise any raw tier shape (wizard format OR API format) into the
 * canonical TicketTier shape used by the management page.
 */
function normalise(raw: any): TicketTier {
    return {
        id: raw.id || raw.name || String(Date.now()),
        name: raw.name || "Unnamed Tier",
        status: raw.status || "on_sale",
        price: raw.price !== undefined && raw.price !== null && raw.price !== ""
            ? Number(raw.price)
            : null,
        sold: Number(raw.sold) || 0,
        // wizard uses `quantity`, API normalised form uses `capacity`
        capacity: Number(raw.capacity ?? raw.quantity ?? raw.maxQuantity ?? 0),
        openSale: raw.openSale || raw.openSaleDate || raw.saleStart || null,
        endSale: raw.endSale || raw.endSaleDate || raw.saleEnd || null,
    };
}

function readLocalTiers(eventId: string): TicketTier[] {
    if (typeof window === "undefined") return [];

    // 1. Dedicated tickets key (written by this hook)
    try {
        const raw = localStorage.getItem(TICKETS_KEY(eventId));
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(normalise);
        }
    } catch { /* ignore parse errors */ }

    // 2. Wizard draft key — `c1rcle_draft_event_v2_<uid>_<eventId>`
    //    We scan all keys because we don't have the uid here.
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key?.endsWith(`_${eventId}`)) continue;
            if (!key.startsWith("c1rcle_draft_event_v2_")) continue;
            const draft = JSON.parse(localStorage.getItem(key) || "{}");
            if (Array.isArray(draft.tickets) && draft.tickets.length > 0) {
                return draft.tickets.map(normalise);
            }
        }
    } catch { /* ignore */ }

    return [];
}

function writeLocalTiers(eventId: string, tiers: TicketTier[]): void {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(TICKETS_KEY(eventId), JSON.stringify(tiers));
    } catch { /* quota exceeded etc */ }
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export interface UseTicketSyncReturn {
    /** Resolved tiers: API data when available, localStorage fallback otherwise. */
    tiers: TicketTier[];
    isLoading: boolean;
    /** True only when the API failed AND localStorage is also empty. */
    isError: boolean;
    /** True when the API failed but localStorage tiers are being shown. */
    isLocalFallback: boolean;
    /** True when localStorage data is shown while API data is still being fetched. */
    isStale: boolean;
    addTier: (form: TicketFormValues) => Promise<unknown>;
    deleteTier: (tierId: string) => Promise<unknown>;
    addMutationPending: boolean;
    deleteMutationPending: boolean;
    deletingId: string | null;
}

export function useTicketSync(eventId: string, venueId: string): UseTicketSyncReturn {
    const { user } = useDashboardAuth();
    const queryClient = useQueryClient();
    const isDev = process.env.NODE_ENV === "development";

    // Seed from localStorage immediately so the table isn't blank on first render
    const [localTiers, setLocalTiers] = useState<TicketTier[]>(() =>
        readLocalTiers(eventId)
    );
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [isLocalFallback, setIsLocalFallback] = useState(false);

    // Re-seed when eventId changes (user navigates between events)
    useEffect(() => {
        setLocalTiers(readLocalTiers(eventId));
        setIsLocalFallback(false);
    }, [eventId]);

    const saveLocal = useCallback((tiers: TicketTier[]) => {
        setLocalTiers(tiers);
        writeLocalTiers(eventId, tiers);
    }, [eventId]);

    // ── Authenticated fetch helper ─────────────────────────────────────────
    const authedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        const token = await user?.getIdToken();
        return fetch(url, {
            ...options,
            headers: {
                ...(options.headers ?? {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                "Content-Type": "application/json",
            },
        });
    }, [user]);

    const baseUrl = `/api/venue/events/${eventId}/tickets?venueId=${venueId}`;

    // ── Fetch from API ─────────────────────────────────────────────────────
    const { data, isLoading, isError } = useQuery<{ tiers: TicketTier[] }>({
        queryKey: ["venue-tickets", eventId, venueId],
        queryFn: async () => {
            if (!venueId) throw new Error("venueId not resolved yet");

            let res: Response;
            try {
                res = await authedFetch(baseUrl);
            } catch (networkErr: any) {
                if (isDev) console.warn("[useTicketSync] Network error — using local data:", networkErr);
                setIsLocalFallback(true);
                return { tiers: localTiers };
            }

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                if (isDev) console.warn(`[useTicketSync] API ${res.status} — falling back to local:`, body);
                setIsLocalFallback(true);
                return { tiers: localTiers.length ? localTiers : [] };
            }

            setIsLocalFallback(false);
            return res.json();
        },
        enabled: !!eventId,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
    });

    // Sync API data → localStorage whenever a fresh response arrives
    useEffect(() => {
        if (data?.tiers && data.tiers.length > 0 && !isLocalFallback) {
            saveLocal(data.tiers);
        }
    }, [data, isLocalFallback, saveLocal]);

    // Resolve which data to show
    const tiers: TicketTier[] =
        data?.tiers && data.tiers.length > 0 ? data.tiers :
        localTiers.length > 0 ? localTiers :
        [];

    const isStale = isLoading && localTiers.length > 0;

    // ── Add tier ───────────────────────────────────────────────────────────
    const addMutation = useMutation({
        mutationFn: async (form: TicketFormValues) => {
            const res = await authedFetch(baseUrl, {
                method: "POST",
                body: JSON.stringify({
                    name: form.name.trim(),
                    price: form.price,
                    quantity: form.quantity,
                    openSale: form.openSale || null,
                    endSale: form.endSale || null,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to save ticket");
            }
            return res.json() as Promise<{ tier: any }>;
        },
        onMutate: async (form) => {
            // Optimistic insert with a temporary id
            const optimistic: TicketTier = normalise({
                id: `optimistic_${Date.now()}`,
                name: form.name.trim(),
                status: "scheduled",
                price: form.price,
                quantity: form.quantity || "50",
                openSale: form.openSale || null,
                endSale: form.endSale || null,
                sold: 0,
            });
            const next = [...tiers, optimistic];
            saveLocal(next);
            return { optimistic };
        },
        onSuccess: (result, _form, context) => {
            const real = normalise(result.tier);
            // Replace the optimistic entry with the real one from the API
            const confirmed = tiers.map(t =>
                t.id === context?.optimistic.id ? real : t
            );
            // If it wasn't swapped (API was skipped), just append
            const finalTiers = confirmed.some(t => t.id === real.id)
                ? confirmed
                : [...confirmed.filter(t => !t.id.startsWith("optimistic_")), real];
            saveLocal(finalTiers);
            queryClient.invalidateQueries({ queryKey: ["venue-tickets", eventId, venueId] });
        },
        onError: (_err, _form, context) => {
            // Keep the optimistic tier in localStorage so work isn't lost
            if (isDev) console.warn("[useTicketSync] Add failed — keeping optimistic entry locally");
        },
    });

    // ── Delete tier ────────────────────────────────────────────────────────
    const deleteMutation = useMutation({
        mutationFn: async (tierId: string) => {
            const res = await authedFetch(`${baseUrl}&tierId=${tierId}`, { method: "DELETE" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to delete ticket");
            }
            return res.json();
        },
        onMutate: async (tierId) => {
            setDeletingId(tierId);
            // Optimistic remove
            saveLocal(tiers.filter(t => t.id !== tierId));
        },
        onSuccess: (_result, tierId) => {
            setDeletingId(null);
            queryClient.invalidateQueries({ queryKey: ["venue-tickets", eventId, venueId] });
        },
        onError: (_err, tierId) => {
            // Restore the deleted tier in localStorage
            setDeletingId(null);
            saveLocal(tiers);
            if (isDev) console.warn("[useTicketSync] Delete failed — tier restored locally");
        },
    });

    return {
        tiers,
        isLoading: isLoading && !isStale,
        isError: isError && tiers.length === 0,
        isLocalFallback,
        isStale,
        addTier: (form) => addMutation.mutateAsync(form),
        deleteTier: (id) => deleteMutation.mutateAsync(id),
        addMutationPending: addMutation.isPending,
        deleteMutationPending: deleteMutation.isPending,
        deletingId,
    };
}
