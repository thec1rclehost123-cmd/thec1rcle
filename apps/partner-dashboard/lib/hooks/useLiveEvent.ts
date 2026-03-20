"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import type {
    TonightOpsData,
    OccupancySnapshot,
    LiveEventStatus,
    UpcomingEvent,
} from "@/lib/types/venueOverview";

// ── Velocity helper ───────────────────────────────────────────────────────────

/**
 * Buckets an array of ISO timestamps into per-minute scan counts.
 * Returns an array of `minutes` entries, oldest first.
 */
function buildVelocityBuckets(timestamps: string[], minutes: number): number[] {
    const buckets = new Array<number>(minutes).fill(0);
    const now = Date.now();
    for (const ts of timestamps) {
        const minsAgo = Math.floor((now - new Date(ts).getTime()) / 60_000);
        if (minsAgo >= 0 && minsAgo < minutes) {
            buckets[minutes - 1 - minsAgo]++;
        }
    }
    return buckets;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useLiveEvent
 *
 * Real-time live-operations hook for the venue dashboard.
 *
 * Strategy:
 *   1. Fetch today's event via React Query (cached 2 min).
 *   2. Attach Firestore `onSnapshot` to `events/{eventId}` for occupancy
 *      and to the `scan_logs` subcollection for velocity.
 *   3. If Firestore is unavailable (e.g. not configured, permission error),
 *      fall back to polling /api/venue/overview/tonight every 30 s.
 *
 * The hook signals its state via `liveStatus` so the UI can show
 * "Live", "Connecting", "Delayed (30s)" or "No Event Tonight".
 */
export function useLiveEvent(venueId: string | undefined) {
    const { user } = useDashboardAuth();

    const [occupancy, setOccupancy] = useState<OccupancySnapshot | null>(null);
    const [velocity, setVelocity] = useState<number[]>(new Array(15).fill(0));
    const [liveStatus, setLiveStatus] = useState<LiveEventStatus>("no_event");

    // Keep unsubscribe callbacks so we can clean up on eventId change
    const unsubRefs = useRef<Array<() => void>>([]);

    // ── Step 1: Today's event (React Query, cached 2 min) ────────────────────
    const eventsQuery = useQuery<{ events: UpcomingEvent[] }>({
        queryKey: ["venue-events-today", venueId ?? ""],
        queryFn: async () => {
            const token = await user!.getIdToken();
            const res = await fetch(
                `/api/venue/events?venueId=${venueId}&date=today`,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (!res.ok) throw new Error(`Events fetch failed: ${res.status}`);
            return res.json();
        },
        enabled: !!user && !!venueId,
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });

    const todayEvent = eventsQuery.data?.events?.[0] ?? null;

    // ── Step 2: Firestore onSnapshot ─────────────────────────────────────────
    useEffect(() => {
        // Clean up previous subscriptions before attaching new ones
        unsubRefs.current.forEach((u) => u());
        unsubRefs.current = [];

        if (!todayEvent?.id) {
            setLiveStatus("no_event");
            setOccupancy(null);
            setVelocity(new Array(15).fill(0));
            return;
        }

        setLiveStatus("connecting");

        const setupSnapshot = async () => {
            try {
                // Dynamic imports so the hook doesn't break when Firestore isn't
                // configured — if the import fails we fall through to the catch.
                const [{ getFirebaseFirestore }, firestoreSDK] = await Promise.all([
                    import("@/lib/firebase/client"),
                    import("firebase/firestore"),
                ]);

                const { onSnapshot, doc, collection, query, where, orderBy, limit } =
                    firestoreSDK;

                const db = getFirebaseFirestore();
                const cap = todayEvent.capacity ?? 0;

                // ── Occupancy: listen to the event document ───────────────────
                const eventUnsub = onSnapshot(
                    doc(db, "events", todayEvent.id),
                    (snap) => {
                        if (!snap.exists()) return;
                        const d = snap.data();
                        const checkedIn = (d.checkedInCount as number) ?? 0;
                        const capacity = cap || (d.capacity as number) || 0;
                        setOccupancy({
                            checkedIn,
                            capacity,
                            occupancyPct:
                                capacity > 0 ? Math.round((checkedIn / capacity) * 100) : 0,
                            lastScanAt: (d.lastScanAt as string) ?? null,
                        });
                        setLiveStatus("live");
                    },
                    (err) => {
                        console.warn("[useLiveEvent] Snapshot failed:", err.code);
                        setLiveStatus("degraded");
                    },
                );

                // ── Velocity: scan_logs subcollection (last 15 min) ───────────
                const fifteenMinsAgo = new Date(
                    Date.now() - 15 * 60 * 1000,
                ).toISOString();

                const velocityUnsub = onSnapshot(
                    query(
                        collection(db, "events", todayEvent.id, "scan_logs"),
                        where("scannedAt", ">=", fifteenMinsAgo),
                        orderBy("scannedAt", "desc"),
                        limit(300),
                    ),
                    (snap) => {
                        const timestamps = snap.docs.map(
                            (d) => d.data().scannedAt as string,
                        );
                        setVelocity(buildVelocityBuckets(timestamps, 15));
                    },
                    () => {
                        // Velocity failure is non-critical — keep last known state
                    },
                );

                unsubRefs.current.push(eventUnsub, velocityUnsub);
            } catch (err) {
                // Firestore not available — polling fallback will activate via
                // liveStatus === 'degraded'
                console.warn(
                    "[useLiveEvent] Firestore unavailable, falling back to polling.",
                    err,
                );
                setLiveStatus("degraded");
            }
        };

        setupSnapshot();

        return () => {
            unsubRefs.current.forEach((u) => u());
            unsubRefs.current = [];
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [todayEvent?.id, todayEvent?.capacity]);

    // ── Step 3: Polling fallback when snapshot degraded ──────────────────────
    const pollingFallback = useQuery<TonightOpsData>({
        queryKey: ["venue-tonight-ops-fallback", todayEvent?.id ?? ""],
        queryFn: async () => {
            const token = await user!.getIdToken();
            const res = await fetch(
                `/api/venue/overview/tonight?eventId=${todayEvent!.id}`,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (!res.ok) throw new Error(`Tonight fetch failed: ${res.status}`);
            return res.json();
        },
        enabled: !!user && !!todayEvent?.id && liveStatus === "degraded",
        staleTime: 30 * 1000,
        refetchInterval: 30 * 1000,
        refetchIntervalInBackground: false,
        gcTime: 5 * 60 * 1000,
    });

    // ── Merge polling velocity into sparkline when degraded ──────────────────
    // When Firestore snapshot is down, the scan_logs listener goes silent.
    // Append the polling entryVelocity (scans/min) as the latest bucket so the
    // sparkline stays alive at 30 s resolution instead of showing stale zeros.
    useEffect(() => {
        if (liveStatus === "degraded" && pollingFallback.data?.entryVelocity != null) {
            setVelocity((prev) => [...prev.slice(1), pollingFallback.data!.entryVelocity!]);
        }
    }, [liveStatus, pollingFallback.data]);

    // ── Merge snapshot + polling fallback ────────────────────────────────────
    const effectiveOccupancy: OccupancySnapshot | null =
        liveStatus === "degraded" && pollingFallback.data
            ? {
                  checkedIn: pollingFallback.data.checkedIn,
                  capacity: todayEvent?.capacity ?? 0,
                  occupancyPct:
                      (todayEvent?.capacity ?? 0) > 0
                          ? Math.round(
                                (pollingFallback.data.checkedIn /
                                    todayEvent!.capacity!) *
                                    100,
                            )
                          : 0,
                  lastScanAt: null,
              }
            : occupancy;

    return {
        todayEvent,
        occupancy: effectiveOccupancy,
        velocity,
        liveStatus,
        /** tonightOps is populated only when snapshot is degraded (polling fallback) */
        tonightOps: pollingFallback.data ?? null,
        isLoadingEvent: eventsQuery.isLoading,
    };
}
