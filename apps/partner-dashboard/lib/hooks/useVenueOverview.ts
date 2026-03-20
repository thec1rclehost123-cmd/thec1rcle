"use client";

import { useQuery } from "@tanstack/react-query";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useLiveEvent } from "./useLiveEvent";
import { useVenueAlerts } from "./useVenueAlerts";
import type {
    VenueOverviewSummary,
    UpcomingEvent,
    DateRange,
} from "@/lib/types/venueOverview";

interface UpcomingEventsResponse {
    events: UpcomingEvent[];
}

/**
 * useVenueOverview
 *
 * Umbrella hook that composes all data needed by the venue dashboard overview.
 * PageClient calls this one hook and passes slices down to each sub-component.
 *
 *   summary   — KPIs + finance snapshot (2 min stale, refetch on focus)
 *   upcoming  — Next 6 events (5 min stale)
 *   liveEvent — Firestore onSnapshot + polling fallback for live ops
 *   alerts    — Venue alerts polled every 60 s
 */
export function useVenueOverview(
    venueId: string | undefined,
    range: DateRange,
) {
    const { user } = useDashboardAuth();

    // ── Summary KPIs + finance ────────────────────────────────────────────────
    const summary = useQuery<VenueOverviewSummary>({
        queryKey: ["venue-overview-summary", venueId ?? "", range],
        queryFn: async () => {
            const token = await user!.getIdToken();
            const res = await fetch(
                `/api/venue/overview/summary?venueId=${venueId}&range=${range}`,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (!res.ok) throw new Error(`Summary fetch failed: ${res.status}`);
            return res.json();
        },
        enabled: !!user && !!venueId,
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: true,
    });

    // ── Upcoming events ───────────────────────────────────────────────────────
    const upcoming = useQuery<UpcomingEventsResponse>({
        queryKey: ["venue-upcoming-events", venueId ?? ""],
        queryFn: async () => {
            const token = await user!.getIdToken();
            const res = await fetch(
                `/api/venue/events?venueId=${venueId}&limit=6`,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (!res.ok) throw new Error(`Events fetch failed: ${res.status}`);
            return res.json();
        },
        enabled: !!user && !!venueId,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // ── Live event (Firestore snapshot + polling fallback) ───────────────────
    const liveEvent = useLiveEvent(venueId);

    // ── Alerts (60 s polling) ─────────────────────────────────────────────────
    const alerts = useVenueAlerts(venueId);

    return { summary, upcoming, liveEvent, alerts };
}
