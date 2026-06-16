/**
 * THE C1RCLE - Inventory Service
 * Reads ticket availability through the API gateway — no direct Firestore access.
 *
 * IMPORTANT: Actual inventory reservation happens SERVER-SIDE via the
 * /api/checkout/reserve endpoint (see lib/api.ts). These functions
 * are for UI display of remaining counts only.
 */

import { apiFetch } from './api';
import { TicketTier } from '@/store/eventsStore';

/**
 * Subscribe to ticket availability for an event via polling.
 * Polls every 10s instead of holding an open onSnapshot listener.
 */
export function subscribeToEventInventory(
  eventId: string,
  onUpdate: (tickets: TicketTier[]) => void,
): () => void {
  if (!eventId || typeof eventId !== 'string') {
    console.error('[Inventory] Invalid eventId:', eventId);
    return () => {};
  }

  let active = true;

  async function poll() {
    if (!active) return;
    try {
      const event = await apiFetch<any>(`/api/v1/events/${eventId}`, { requireAuth: false });
      if (event?.tickets) onUpdate(event.tickets);
    } catch (e) {
      // Silent fail — UI will just show stale count
    }
  }

  // Initial fetch immediately
  poll();
  const intervalId = setInterval(poll, 10000);

  return () => {
    active = false;
    clearInterval(intervalId);
  };
}

/**
 * Check if tickets are still available (one-time read).
 */
export async function checkAvailability(
  eventId: string,
  tierId: string,
  quantity: number,
): Promise<{ available: boolean; remaining: number }> {
  if (!eventId || typeof eventId !== 'string') {
    return { available: false, remaining: 0 };
  }

  try {
    const event = await apiFetch<any>(`/api/v1/events/${eventId}`, { requireAuth: false });
    const tickets: TicketTier[] = event?.tickets || [];
    const tier = tickets.find((t) => t.id === tierId);

    if (!tier) return { available: false, remaining: 0 };

    return {
      available: tier.remaining >= quantity,
      remaining: tier.remaining,
    };
  } catch (error) {
    console.error('Error checking availability:', error);
    return { available: false, remaining: 0 };
  }
}

/**
 * Get all ticket tiers for an event (one-time read).
 */
export async function getEventTickets(eventId: string): Promise<TicketTier[]> {
  if (!eventId || typeof eventId !== 'string') return [];

  try {
    const event = await apiFetch<any>(`/api/v1/events/${eventId}`, { requireAuth: false });
    return event?.tickets || [];
  } catch (error) {
    console.error('Error fetching event tickets:', error);
    return [];
  }
}
