import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface DiscoverProfile {
  id: string;
  firstName: string;
  age: number | null;
  photos: string[];
  prompts: any[];
  upcomingEvents: string[];
}

export interface DiscoverResponse {
  success: boolean;
  data: {
    profiles: DiscoverProfile[];
  };
}

export function useDiscoverProfiles() {
  return useQuery({
    queryKey: ['social', 'discover'],
    queryFn: async () => {
      const response = await apiFetch<DiscoverResponse>('/api/v1/social/discover');
      if (!response.success) {
        throw new Error('Failed to fetch profiles');
      }
      return response.data.profiles;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
