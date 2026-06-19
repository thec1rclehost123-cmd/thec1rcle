import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface TicketEvent {
  title: string;
  poster: string | null;
  date: string;
  venue: string;
}

export interface Ticket {
  id: string;
  orderId: string;
  eventId: string;
  userId: string;
  tierId: string;
  tierName?: string;
  quantity?: number;
  entryType?: string;
  status: string;
  qrMode: string;
  qrPayload: string | null;
  event: TicketEvent | null;
}

export interface TicketsResponse {
  success: boolean;
  data: {
    upcomingTickets: Ticket[];
    pastTickets: Ticket[];
  };
}

export function useTickets() {
  return useQuery({
    queryKey: ['tickets', 'me'],
    queryFn: async () => {
      // The backend returns an envelope with `{ success: true, data: { ... } }`
      // where `data` is from our buildSuccessResponse wrapper
      const response = await apiFetch<TicketsResponse>('/api/v1/tickets/me');
      if (!response.success) {
        throw new Error('Failed to fetch tickets');
      }
      return response.data;
    },
  });
}
