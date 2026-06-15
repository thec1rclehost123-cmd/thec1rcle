'use client';

import { EMPTY_TICKETS, useTicketsWalletQuery } from '../features/tickets/ticketsQueries';

/**
 * Compatibility shim while old imports are removed.
 *
 * Ticket wallet server state is owned by React Query in
 * `features/tickets/ticketsQueries.js`. New code should call
 * `useTicketsWalletQuery(uid, options)` directly instead of using this file.
 */
export function useTicketsStore(uid, options = {}) {
  const query = useTicketsWalletQuery(uid, {
    enabled: Boolean(uid) && options.enabled !== false,
    ...options,
  });

  return {
    tickets: query.data || EMPTY_TICKETS,
    status: query.isLoading
      ? 'loading'
      : query.isError
        ? 'error'
        : query.isSuccess
          ? 'ready'
          : 'idle',
    error: query.error?.message || null,
    loadTickets: query.refetch,
    invalidate: query.refetch,
    clearAll: () => {},
  };
}
