import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface Venue {
  id: string;
  name: string;
  city: string;
  photos: string[];
  address: string;
  bio: string;
  entryRules: string;
  status: string;
}

export function useVenues(city?: string) {
  return useQuery({
    queryKey: ['venues', city],
    queryFn: async () => {
      const qs = city ? `?city=${encodeURIComponent(city)}` : '';
      const res = await apiFetch<{ success: boolean; data: Venue[] }>(`/api/v1/venues${qs}`);
      if (!res.success) throw new Error('Failed to fetch venues');
      return res.data;
    },
  });
}

export function useVenue(venueId: string) {
  return useQuery({
    queryKey: ['venues', venueId],
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: Venue }>(`/api/v1/venues/${venueId}`);
      if (!res.success) throw new Error('Failed to fetch venue');
      return res.data;
    },
    enabled: !!venueId,
  });
}

export function useVenueEvents(venueId: string) {
  return useQuery({
    queryKey: ['venues', venueId, 'events'],
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: any[] }>(
        `/api/v1/venues/${venueId}/events`,
      );
      if (!res.success) throw new Error('Failed to fetch venue events');
      return res.data;
    },
    enabled: !!venueId,
  });
}

export function useToggleVenueFollow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (venueId: string) => {
      const res = await apiFetch<{ success: boolean; data: { followed: boolean } }>(
        `/api/v1/venues/${venueId}/follow`,
        { method: 'POST' },
      );
      if (!res.success) throw new Error('Failed to toggle follow');
      return res.data;
    },
    onSuccess: (_, venueId) => {
      // Invalidate related queries so UI updates
      queryClient.invalidateQueries({ queryKey: ['venues', venueId] });
    },
  });
}
