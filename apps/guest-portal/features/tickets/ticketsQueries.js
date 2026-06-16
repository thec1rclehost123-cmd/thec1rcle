'use client';

import { useQuery } from '@tanstack/react-query';
import { guestApi, getApiErrorMessage } from '../../lib/api/client';
import { isGuestBffEnabled } from '../../lib/bff/flags.js';
import { fetchGuestBffTicketsOverview } from '../../lib/bff/fetchers.js';
import { logGuestBffParity } from '../../lib/bff/parity.js';
import { EMPTY_TICKETS, normalizeTicketsWallet } from './ticketsModel.js';

export { EMPTY_TICKETS } from './ticketsModel.js';

const CACHE_TTL_MS = 2 * 60 * 1000;
const TICKETS_ROOT_QUERY_KEY = ['guest', 'tickets'];

export function ticketsWalletQueryKey(uid) {
  return [...TICKETS_ROOT_QUERY_KEY, 'wallet', uid || 'anonymous'];
}

export function ticketDetailQueryKey(uid, ticketId) {
  return [...TICKETS_ROOT_QUERY_KEY, 'detail', uid || 'anonymous', ticketId];
}

export async function fetchTicketsWallet() {
  if (isGuestBffEnabled('tickets')) {
    const overview = await fetchGuestBffTicketsOverview();
    const overviewWallet = overview?.wallet || EMPTY_TICKETS;
    const wallet = {
      ...overviewWallet,
      coverWalletsByOrder: overviewWallet.coverWalletsByOrder || {},
    };

    try {
      const { response, data } = await guestApi.tickets.wallet();
      if (response.ok) {
        logGuestBffParity('tickets.wallet', normalizeTicketsWallet(data), wallet, {
          source: overview?.meta?.source || 'bff',
        });
      }
    } catch {}

    return wallet;
  }

  const { response, data } = await guestApi.tickets.wallet();
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Failed to load tickets'));
  }
  return normalizeTicketsWallet(data);
}

export function useTicketsWalletQuery(uid, options = {}) {
  return useQuery({
    queryKey: ticketsWalletQueryKey(uid),
    queryFn: fetchTicketsWallet,
    enabled: Boolean(uid) && options.enabled !== false,
    staleTime: CACHE_TTL_MS,
    ...options,
  });
}

export async function fetchTicketDetail(ticketId) {
  const { response, data } = await guestApi.tickets.get(ticketId);
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Failed to load ticket'));
  }
  return data.ticket;
}

export function useTicketDetailQuery(uid, ticketId, options = {}) {
  return useQuery({
    queryKey: ticketDetailQueryKey(uid, ticketId),
    queryFn: () => fetchTicketDetail(ticketId),
    enabled: Boolean(uid) && Boolean(ticketId) && options.enabled !== false,
    staleTime: 30 * 1000, // Refresh QR more frequently
    refetchInterval: 60 * 1000, // Auto-rotate signature if engine supports it
    ...options,
  });
}

export async function invalidateTicketsQueries(queryClient, uid) {
  await queryClient.invalidateQueries({ queryKey: ticketsWalletQueryKey(uid) });
}
