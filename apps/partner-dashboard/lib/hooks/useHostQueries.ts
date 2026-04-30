import { useQuery } from "@tanstack/react-query";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

export type OverviewRange = "1d" | "1w" | "1m" | "all";
export type OverviewMetric = "tickets" | "revenue";

export type PartnerHostOverviewResponse = {
    stats?: {
        totalTicketsSold?: number;
        totalRevenue?: number;
        activeEventsCount?: number;
        upcomingEventsCount?: number;
        completedEventsCount?: number;
        avgTicketsPerEvent?: number;
    };
    upcomingEvents?: Array<{
        eventId: string;
        title: string;
        startDate?: string | null;
        endDate?: string | null;
        venueId?: string;
        venueName?: string;
        status?: string;
        submissionStatus?: string;
        coverImage?: string | null;
        ticketsSold?: number;
        revenue?: number;
        capacity?: number;
    }>;
    recentActivity?: Array<{
        id: string;
        type?: string;
        title?: string;
        detail?: string | null;
        timestamp?: string | null;
    }>;
    latestOrders?: Array<{
        orderId: string;
        orderNumber: string;
        customerName: string;
        eventId: string;
        eventName: string;
        amount: number;
        ticketsCount: number;
        createdAt?: string | null;
        status?: string;
        source?: "ticket" | "rsvp";
    }>;
    performance?: {
        range?: OverviewRange;
        metric?: OverviewMetric;
        total?: number;
        series?: Array<{
            date: string;
            label?: string;
            value?: number;
            revenue?: number;
            ticketsSold?: number;
        }>;
    };
};

/**
 * Shared hook: fetches data from a partner-dashboard API route with auth.
 * Mirrors the pattern in useVenueQueries.ts.
 */
function useAuthenticatedQuery<T = any>(
    key: string[],
    url: string,
    options: { enabled?: boolean; staleTime?: number } = {}
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
        staleTime: options.staleTime ?? Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });
}

/**
 * Hook: Host overview summary
 * Used by host/PageClient.tsx overview hero
 */
export function useHostOverviewSummary(
    hostId: string | undefined,
    range: string = "7d",
    startDate?: string,
    endDate?: string
) {
    const params = new URLSearchParams({ hostId: hostId || "", range });
    if (range === "custom" && startDate && endDate) {
        params.set("startDate", startDate);
        params.set("endDate", endDate);
    }

    return useAuthenticatedQuery(
        ["host-overview-summary", hostId || "", range, startDate || "", endDate || ""],
        `/api/partners/hosts/overview/summary?${params.toString()}`,
        { enabled: !!hostId }
    );
}

export function usePartnerHostOverview(
    hostId: string | undefined,
    enabled: boolean,
    range: OverviewRange,
    metric: OverviewMetric,
) {
    return useAuthenticatedQuery<PartnerHostOverviewResponse>(
        ["partner-host-overview", hostId || "", range, metric],
        `/api/partners/hosts/overview?${new URLSearchParams({ range, metric }).toString()}`,
        {
            enabled,
            staleTime: 60_000,
        }
    );
}
