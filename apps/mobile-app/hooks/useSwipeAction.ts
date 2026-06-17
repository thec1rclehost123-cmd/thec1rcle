import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

interface SwipePayload {
  targetUserId: string;
  action: 'like' | 'pass';
}

interface SwipeResponse {
  success: boolean;
  data: {
    match: boolean;
    conversationId?: string;
  };
}

export function useSwipeAction() {
  return useMutation({
    mutationFn: async (payload: SwipePayload) => {
      const response = await apiFetch<SwipeResponse>('/api/v1/social/swipe', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.success) {
        throw new Error('Failed to record swipe action');
      }

      return response.data;
    },
  });
}
