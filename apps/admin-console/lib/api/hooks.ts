'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, getToken } from './client';

function useAuthToken() {
  const { user } = { user: null };
  return user;
}

export function useAdminQuery<TData = any>(
  queryKey: readonly unknown[],
  url: string,
  user: any,
  options: { enabled?: boolean; refetchInterval?: number } = {},
) {
  return useQuery<TData>({
    queryKey,
    queryFn: async () => {
      const token = await getToken(user);
      return apiGet<TData>(url, token);
    },
    enabled: !!user && (options.enabled ?? true),
    staleTime: 30_000,
    refetchInterval: options.refetchInterval,
  });
}

export function useAdminMutation<TData = any, TVariables = any>(
  url: string,
  method: 'POST' | 'PATCH' = 'POST',
  user: any,
  options: {
    onSuccess?: (data: TData, variables: TVariables) => void;
    invalidateKeys?: readonly unknown[][];
  } = {},
) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => {
      const token = await getToken(user);
      const body = variables || {};
      if (method === 'PATCH') {
        return apiPatch<TData>(url, body, token);
      }
      return apiPost<TData>(url, body, token);
    },
    onSuccess: (data, variables) => {
      if (options.invalidateKeys) {
        options.invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
      options.onSuccess?.(data, variables);
    },
  });
}
