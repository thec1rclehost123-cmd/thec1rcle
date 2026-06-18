import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { DiscoverProfile } from './useDiscoverProfiles';

export interface PublicProfileResponse {
  success: boolean;
  data: DiscoverProfile & { datingActive: boolean };
}

export function usePublicProfile(userId: string) {
  return useQuery({
    queryKey: ['users', userId, 'public'],
    queryFn: async () => {
      const response = await apiFetch<PublicProfileResponse>(`/api/v1/users/${userId}`);
      if (!response.success) {
        throw new Error('Failed to fetch public profile');
      }
      return response.data;
    },
    enabled: !!userId,
  });
}
