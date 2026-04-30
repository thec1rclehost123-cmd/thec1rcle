/**
 * useEventAttendees
 *
 * Aggregates attendees from two live sources:
 *   1. Guest list  — /api/partners/venues/guest-ops/[id]/guests        (online purchases + manual adds)
 *   2. Scanner stream — /api/partners/venues/guest-ops/[id]/scanner/stream  (door / offline scans)
 *
 * Both are polled every 30 s. When the backend fails, the hook exposes an
 * explicit error state and clears rendered attendee data.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

// ─── Public types ──────────────────────────────────────────────────────────────

export type ContactChannel = "instagram" | "chat" | "phone";

export interface Attendee {
    id: string;
    name: string;
    avatarUrl?: string;
    /** Total tickets held (online qty + door scans) */
    tickets: number;
    /** Total amount paid in ₹ */
    totalSpend: number;
    contact: ContactChannel[];
    tags: string[];
    /** ISO date string of most recent transaction */
    lastPurchase: string;
    /** Where the record came from */
    source: "online" | "door" | "manual";
}

export interface UseEventAttendeesReturn {
    attendees: Attendee[];
    totalCount: number;
    isLoading: boolean;
    isError: boolean;
    /** Force an immediate re-fetch (e.g. after a manual action) */
    refresh: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000;

export function useEventAttendees(
    eventId: string,
    venueId?: string
): UseEventAttendeesReturn {
    const { user } = useDashboardAuth();

    const [attendees, setAttendees] = useState<Attendee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError,   setIsError]   = useState(false);

    // Prevent state updates after unmount
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // ── Authenticated fetch ─────────────────────────────────────────────────
    const authedFetch = useCallback(async (url: string) => {
        const token = await user?.getIdToken();
        const res = await fetch(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        return res;
    }, [user]);

    // ── Normalise a record from /api/partners/venues/events/[id]/attendees → Attendee ───
    function normaliseRow(raw: any): Attendee {
        const contact: ContactChannel[] = [];
        if (raw.instagram) contact.push("instagram");
        if (raw.phone) contact.push("phone");
        if (raw.phone || raw.email) contact.push("chat");

        const tags: string[] = Array.isArray(raw.tags) ? [...raw.tags] : [];
        if (raw.isVip && !tags.includes("VIP")) tags.push("VIP");

        // API source: "ticket" | "rsvp" → display as "online"; "manual" stays
        const source: Attendee["source"] =
            raw.source === "manual" ? "manual" :
            raw.source === "rsvp"   ? "online" : "online";

        return {
            id: raw.id,
            name: raw.fullName || "Guest",
            avatarUrl: raw.avatarUrl || undefined,
            tickets: Number(raw.quantity ?? 1),
            totalSpend: Number(raw.totalSpend ?? 0),
            contact,
            tags,
            lastPurchase: raw.purchasedAt || new Date().toISOString(),
            source,
        };
    }

    // ── Core fetch ──────────────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        if (!eventId || !mountedRef.current) return;

        try {
            const res = await authedFetch(
                `/api/partners/venues/events/${eventId}/attendees?limit=100`
            );

            if (!mountedRef.current) return;

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            const rows: Attendee[] = (data.attendees ?? []).map(normaliseRow);

            setAttendees(rows);
            setIsError(false);
        } catch (err: any) {
            if (!mountedRef.current) return;
            console.error("[useEventAttendees] fetch error:", err?.message);
            setAttendees([]);
            setIsError(true);
        } finally {
            if (mountedRef.current) setIsLoading(false);
        }
    }, [eventId, authedFetch]);

    // ── Initial load + re-seed when eventId changes ─────────────────────────
    useEffect(() => {
        if (!eventId) { setIsLoading(false); return; }
        setIsLoading(true);
        setAttendees([]);
        fetchAll();
    }, [eventId, fetchAll]);

    // ── Polling every 30 s ──────────────────────────────────────────────────
    useEffect(() => {
        if (!eventId) return;
        const timer = setInterval(fetchAll, POLL_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [eventId, fetchAll]);

    return {
        attendees,
        totalCount: attendees.length,
        isLoading,
        isError,
        refresh: fetchAll,
    };
}
