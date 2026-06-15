import { useQuery } from '@tanstack/react-query';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';

/**
 * Shared hook: fetches data from a partner-dashboard API route with auth.
 * Mirrors the pattern in useVenueQueries.ts.
 */
function useAuthenticatedQuery<T = any>(
  key: string[],
  url: string,
  options: { enabled?: boolean; staleTime?: number } = {},
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
    enabled: !!user && options.enabled !== false,
    staleTime: options.staleTime ?? 5 * 60 * 1000,
  });
}

/**
 * Hook: Promoter partnership list
 * Used by promoter/partnerships/PageClient.tsx
 */
export function usePromoterPartnerships(promoterId: string | undefined) {
  return useAuthenticatedQuery(
    ['promoter-partnerships', promoterId || ''],
    '/api/partners/promoters/connections',
    { enabled: !!promoterId },
  );
}
