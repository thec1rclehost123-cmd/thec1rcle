import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export function useInitiateTransfer() {
  return useMutation({
    mutationFn: async (ticketId: string) => {
      const response = await apiFetch<{ success: boolean; data: { transferToken: string } }>(
        `/api/v1/tickets/${ticketId}/transfer`,
        {
          method: 'POST',
        }
      );
      if (!response.success) throw new Error('Failed to initiate transfer');
      return response.data;
    },
  });
}

export function useClaimTransfer() {
  return useMutation({
    mutationFn: async (transferToken: string) => {
      const response = await apiFetch<{ success: boolean; data: { eventId: string; ticketId: string } }>(
        '/api/v1/tickets/claim',
        {
          method: 'POST',
          body: JSON.stringify({ transferToken }),
        }
      );
      if (!response.success) throw new Error('Failed to claim ticket');
      return response.data;
    },
  });
}
