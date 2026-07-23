import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { DiscoverProfile } from './useDiscoverProfiles';

export interface MatchData {
  matchId: string;
  conversationId?: string;
  matchedAt: string;
  profile: Pick<DiscoverProfile, 'id' | 'firstName' | 'age'> & { photo: string | null };
}

export interface MatchesResponse {
  success: boolean;
  data: {
    matches: MatchData[];
  };
}

export function useMatches() {
  return useQuery({
    queryKey: ['social', 'matches'],
    queryFn: async () => {
      const response = await apiFetch<MatchesResponse>('/api/v1/social/matches');
      if (!response.success) {
        throw new Error('Failed to fetch matches');
      }
      return response.data.matches;
    },
    staleTime: 60 * 1000, // 1 min — matches change at moderate pace
  });
}
