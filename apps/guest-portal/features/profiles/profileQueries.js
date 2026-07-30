'use client';

import { useQuery } from '@tanstack/react-query';
import { getApiErrorMessage, guestApi } from '../../lib/api/client';

export function guestProfileQueryKey(userId, viewerId) {
  return ['profile', userId, viewerId || 'anonymous'];
}

export async function fetchGuestProfile(userId, viewerId) {
  const { response, data } = await guestApi.profiles.get(userId, { credentials: 'include' });
  if (!response.ok) throw new Error(getApiErrorMessage(data, 'Profile not found'));
  return data;
}

export function useGuestProfileQuery({ userId, viewerId }) {
  return useQuery({
    queryKey: guestProfileQueryKey(userId, viewerId),
    queryFn: async () => fetchGuestProfile(userId, viewerId),
    enabled: Boolean(userId) && userId !== '[userId]',
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
