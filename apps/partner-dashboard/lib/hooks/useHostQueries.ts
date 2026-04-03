import { useQuery } from "@tanstack/react-query";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

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
        `/api/host/overview/summary?${params.toString()}`,
        { enabled: !!hostId }
    );
}
