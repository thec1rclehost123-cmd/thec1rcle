"use client";

import { useQuery } from "@tanstack/react-query";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import type { VenueAlert } from "@/lib/types/venueOverview";

interface AlertsResponse {
    alerts: VenueAlert[];
}

/**
 * useVenueAlerts
 *
 * Polls /api/venue/overview/alerts every 60 seconds.
 * Returns an empty array on failure so the dashboard never breaks.
 */
export function useVenueAlerts(venueId: string | undefined) {
    const { user } = useDashboardAuth();

    return useQuery<AlertsResponse>({
        queryKey: ["venue-alerts", venueId ?? ""],
        queryFn: async () => {
            const token = await user!.getIdToken();
            const res = await fetch(
                `/api/venue/overview/alerts?venueId=${venueId}`,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            // Return empty array on error instead of throwing — alerts are
            // non-critical and must not crash the dashboard
            if (!res.ok) return { alerts: [] };
            return res.json();
        },
        enabled: !!user && !!venueId,
        staleTime: 60 * 1000,
        refetchInterval: 60 * 1000,
        // Don't poll when the tab is in background — alerts aren't urgent enough
        refetchIntervalInBackground: false,
        gcTime: 5 * 60 * 1000,
        // Return empty array as placeholder while loading
        placeholderData: { alerts: [] },
    });
}
