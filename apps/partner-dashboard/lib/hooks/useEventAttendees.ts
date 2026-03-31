/**
 * useEventAttendees
 *
 * Aggregates attendees from two live sources:
 *   1. Guest list  — /api/venue/guest-ops/[id]/guests        (online purchases + manual adds)
 *   2. Scanner stream — /api/venue/guest-ops/[id]/scanner/stream  (door / offline scans)
 *
 * Both are polled every 30 s.  In dev, if either source fails the hook
 * automatically falls back to mock data and sets `isUsingMock = true`.
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
    isUsingMock: boolean;
    /** Force an immediate re-fetch (e.g. after a manual action) */
    refresh: () => void;
}

// ─── Dev mock data ─────────────────────────────────────────────────────────────

const MOCK_ATTENDEES: Attendee[] = [
    { id: "m1",  name: "Jaden Boreanaz",      tickets: 1, totalSpend: 500,  contact: ["chat", "phone"],              tags: [],          lastPurchase: "2026-03-12", source: "online" },
    { id: "m2",  name: "Saad Azam",           tickets: 3, totalSpend: 1500, contact: ["instagram","chat","phone"],   tags: ["VIP"],     lastPurchase: "2026-03-11", source: "online" },
    { id: "m3",  name: "Jeff Clayton",        tickets: 1, totalSpend: 500,  contact: ["instagram"],                  tags: [],          lastPurchase: "2026-03-11", source: "online" },
    { id: "m4",  name: "Antoine Bell",        tickets: 1, totalSpend: 500,  contact: ["instagram","chat","phone"],   tags: [],          lastPurchase: "2026-03-11", source: "online" },
    { id: "m5",  name: "William Nolan",       tickets: 1, totalSpend: 500,  contact: ["chat","phone"],               tags: [],          lastPurchase: "2026-03-11", source: "door"   },
    { id: "m6",  name: "Trey Revis",          tickets: 1, totalSpend: 500,  contact: ["instagram","chat","phone"],   tags: ["Promoter"],lastPurchase: "2026-03-11", source: "manual" },
    { id: "m7",  name: "Benjamin Gotfredson", tickets: 2, totalSpend: 1000, contact: [],                             tags: [],          lastPurchase: "2026-03-11", source: "online" },
    { id: "m8",  name: "Michael Porter",      tickets: 1, totalSpend: 500,  contact: ["chat","phone"],               tags: [],          lastPurchase: "2026-03-11", source: "door"   },
    { id: "m9",  name: "Aria Patel",          tickets: 2, totalSpend: 1000, contact: ["instagram","phone"],          tags: ["VIP"],     lastPurchase: "2026-03-10", source: "online" },
    { id: "m10", name: "Rohan Mehta",         tickets: 1, totalSpend: 500,  contact: ["instagram","chat"],           tags: [],          lastPurchase: "2026-03-10", source: "online" },
];

// ─── Normalisation helpers ─────────────────────────────────────────────────────

/**
 * Derives contact channels from a raw guest record.
 * The guest portal stores instagram handle / phone presence — we infer channels.
 */
function deriveContact(raw: any): ContactChannel[] {
    const ch: ContactChannel[] = [];
    if (raw.instagramHandle || raw.instagram) ch.push("instagram");
    if (raw.phone || raw.maskedPhone || raw.fullPhone) ch.push("phone");
    // chat is shown when there's any messaging-capable contact
    if (raw.phone || raw.maskedPhone || raw.fullPhone || raw.email) ch.push("chat");
    return ch;
}

/** Map guestType / tags array → display tag strings */
function deriveTags(raw: any): string[] {
    const tags: string[] = Array.isArray(raw.tags) ? [...raw.tags] : [];

    const guestTypeTagMap: Record<string, string> = {
        venue_vip:     "VIP",
        venue_comp:    "Comp",
        host_manual:   "Host",
        promoter_manual: "Promoter",
        staff_override: "Staff",
    };

    const mapped = guestTypeTagMap[raw.guestType as string];
    if (mapped && !tags.includes(mapped)) tags.push(mapped);

    return tags;
}

/** Normalise a guest-list record → Attendee */
function normaliseGuest(raw: any): Attendee {
    const name =
        raw.displayName ||
        [raw.firstName, raw.lastName].filter(Boolean).join(" ") ||
        raw.name ||
        "Unknown";

    const isManual = ["venue_manual", "venue_comp", "venue_vip", "staff_override"].includes(raw.guestType);

    return {
        id: raw.id || raw.guestId || String(Math.random()),
        name,
        avatarUrl: raw.avatarUrl || undefined,
        tickets: Number(raw.quantity ?? raw.tickets ?? 1),
        totalSpend: Number(raw.orderAmount ?? raw.totalAmount ?? raw.totalSpend ?? 0),
        contact: deriveContact(raw),
        tags: deriveTags(raw),
        lastPurchase: raw.addedAt || raw.createdAt || new Date().toISOString(),
        source: isManual ? "manual" : "online",
    };
}

/** Normalise a scanner-stream scan record → Attendee */
function normaliseScan(raw: any): Attendee {
    const name =
        raw.displayName ||
        raw.guestName ||
        raw.name ||
        "Door Guest";

    return {
        id: `scan_${raw.scanId || raw.id || String(Math.random())}`,
        name,
        avatarUrl: undefined,
        tickets: 1,
        totalSpend: Number(raw.doorPrice ?? raw.price ?? 0),
        contact: deriveContact(raw),
        tags: raw.tags ?? [],
        lastPurchase: raw.scannedAt || raw.timestamp || new Date().toISOString(),
        source: "door",
    };
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000;
const isDev = process.env.NODE_ENV === "development";

export function useEventAttendees(
    eventId: string,
    venueId: string
): UseEventAttendeesReturn {
    const { user } = useDashboardAuth();

    const [attendees, setAttendees] = useState<Attendee[]>([]);
    const [isLoading,  setIsLoading]  = useState(true);
    const [isError,    setIsError]    = useState(false);
    const [isUsingMock, setIsUsingMock] = useState(false);

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

    // ── Core fetch + merge ──────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        if (!eventId || !mountedRef.current) return;

        const base = `/api/venue/guest-ops/${eventId}`;
        const qs   = `venueId=${venueId}&limit=500`;

        try {
            // Fetch both sources in parallel — one failing doesn't block the other
            const [guestsRes, scansRes] = await Promise.allSettled([
                authedFetch(`${base}/guests?${qs}`),
                authedFetch(`${base}/scanner/stream?venueId=${venueId}&limit=200`),
            ]);

            let guests: Attendee[]  = [];
            let scans: Attendee[]   = [];
            let anyFailed = false;

            if (guestsRes.status === "fulfilled" && guestsRes.value.ok) {
                const data = await guestsRes.value.json();
                guests = (data.guests ?? data.items ?? []).map(normaliseGuest);
            } else {
                anyFailed = true;
                if (isDev) console.warn("[useEventAttendees] guests fetch failed:", guestsRes);
            }

            if (scansRes.status === "fulfilled" && scansRes.value.ok) {
                const data = await scansRes.value.json();
                scans = (data.scans ?? []).map(normaliseScan);
            } else {
                if (isDev) console.warn("[useEventAttendees] scanner/stream fetch failed:", scansRes);
            }

            if (!mountedRef.current) return;

            if (anyFailed && guests.length === 0 && scans.length === 0) {
                // Both sources failed — fall back to mock in dev, error in prod
                if (isDev) {
                    setAttendees(MOCK_ATTENDEES);
                    setIsUsingMock(true);
                    setIsError(false);
                } else {
                    setIsError(true);
                }
            } else {
                // Merge: guest list is source of truth; door scans fill in anyone not in guest list
                const guestIds = new Set(guests.map(g => g.id));
                const uniqueScans = scans.filter(s => {
                    // A scan may reference a guest already in the list via a shared id
                    const rawId = s.id.replace("scan_", "");
                    return !guestIds.has(rawId) && !guestIds.has(s.id);
                });

                const merged = [...guests, ...uniqueScans].sort(
                    (a, b) => new Date(b.lastPurchase).getTime() - new Date(a.lastPurchase).getTime()
                );

                setAttendees(merged);
                setIsUsingMock(false);
                setIsError(false);
            }
        } catch (err: any) {
            if (!mountedRef.current) return;
            if (isDev) {
                console.warn("[useEventAttendees] fetch error — using mock data:", err?.message);
                setAttendees(MOCK_ATTENDEES);
                setIsUsingMock(true);
                setIsError(false);
            } else {
                console.error("[useEventAttendees] fetch error:", err);
                setIsError(true);
            }
        } finally {
            if (mountedRef.current) setIsLoading(false);
        }
    }, [eventId, venueId, authedFetch]);

    // ── Initial load + re-seed when eventId changes ─────────────────────────
    useEffect(() => {
        if (!eventId) { setIsLoading(false); return; }
        setIsLoading(true);
        setAttendees([]);
        fetchAll();
    }, [eventId, fetchAll]);

    // ── Polling every 30 s ──────────────────────────────────────────────────
    useEffect(() => {
        if (!eventId || !venueId) return;
        const timer = setInterval(fetchAll, POLL_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [eventId, venueId, fetchAll]);

    return {
        attendees,
        totalCount: attendees.length,
        isLoading,
        isError,
        isUsingMock,
        refresh: fetchAll,
    };
}
