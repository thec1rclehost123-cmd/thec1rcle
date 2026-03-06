"use client";

import { useQuery } from "@tanstack/react-query";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

/**
 * Shared hook: fetches data from a partner-dashboard API route with auth.
 * Handles token retrieval, caching, and deduplication automatically.
 */
function useAuthenticatedQuery<T = any>(
    key: string[],
    url: string,
    options: { enabled?: boolean; staleTime?: number; refetchInterval?: number } = {}
) {
    const { user } = useDashboardAuth();

    return useQuery<T>({
        queryKey: key,
        queryFn: async () => {
            const token = await user!.getIdToken();
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`Request failed: ${res.status}`);
            return res.json();
        },
        enabled: !!user && (options.enabled !== false),
        staleTime: options.staleTime ?? 5 * 60 * 1000, // 5 min default
        refetchInterval: options.refetchInterval,
    });
}

/**
 * Hook: Venue KPI overview summary
 * Used by KPIGridModule
 */
export function useVenueOverviewSummary(venueId: string | undefined) {
    return useAuthenticatedQuery(
        ["venue-overview-summary", venueId || ""],
        `/api/venue/overview/summary?venueId=${venueId}`,
        { enabled: !!venueId, staleTime: 5 * 60 * 1000 }
    );
}

/**
 * Hook: Tonight's event data
 * Used by TonightOpsModule — refetches every 30s for live ops
 */
export function useTonightEvent(venueId: string | undefined) {
    // Step 1: Fetch today's events (uses the ?date=today server filter)
    const eventsQuery = useAuthenticatedQuery<{ events: any[] }>(
        ["venue-events-today", venueId || ""],
        `/api/venue/events?venueId=${venueId}&date=today`,
        { enabled: !!venueId, staleTime: 2 * 60 * 1000 }
    );

    const tonightEventId = eventsQuery.data?.events?.[0]?.id;

    // Step 2: Fetch tonight's ops data (only if there's an event today)
    const tonightQuery = useAuthenticatedQuery(
        ["venue-tonight-ops", tonightEventId || ""],
        `/api/venue/overview/tonight?eventId=${tonightEventId}`,
        {
            enabled: !!tonightEventId,
            staleTime: 30 * 1000, // 30s — live ops data
            refetchInterval: 30 * 1000,
        }
    );

    return {
        tonight: tonightQuery.data,
        isLoading: eventsQuery.isLoading || tonightQuery.isLoading,
        error: eventsQuery.error || tonightQuery.error,
        todayEvent: eventsQuery.data?.events?.[0],
    };
}
