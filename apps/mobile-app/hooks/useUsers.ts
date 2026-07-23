import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface UserProfile {
  id: string;
  name?: string;
  firstName?: string;
  datingActive?: boolean;
  photos?: string[];
  prompts?: any[];
  bio?: string;
  [key: string]: any;
}

export function useSyncAuth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch<{ success: boolean; data: { profile: UserProfile } }>('/api/v1/auth/sync', {
        method: 'POST',
      });
      if (!res.success) throw new Error('Failed to sync auth user');
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['users', 'me'], data.profile);
    },
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['users', 'me'],
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: { profile: UserProfile } }>('/api/v1/users/me');
      if (!res.success) throw new Error('Failed to fetch user profile');
      return res.data.profile;
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      const res = await apiFetch<{ success: boolean; data: { profile: UserProfile } }>('/api/v1/users/me', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      if (!res.success) throw new Error('Failed to update user profile');
      return res.data.profile;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['users', 'me'], data);
    },
  });
}

export function useBlockUser() {
  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const res = await apiFetch<{ success: boolean; data: { success: boolean, blockedUsers: string[] } }>(`/api/v1/users/me/block/${targetUserId}`, {
        method: 'POST',
      });
      if (!res.success) throw new Error('Failed to block user');
      return res.data;
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch<{ success: boolean; data: { success: boolean } }>('/api/v1/users/me', {
        method: 'DELETE',
      });
      if (!res.success) throw new Error('Failed to delete user account');
      return res.data;
    },
    onSuccess: () => {
      queryClient.clear(); // Clear all cached user data
    },
  });
}
