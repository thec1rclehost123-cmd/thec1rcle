/**
 * useEventAttendees
 *
 * Aggregates attendees from two live sources:
 *   1. Online orders — /api/partners/venues/events/[id]/attendees  (online purchases + manual adds)
 *   2. Walk-ins      — /api/partners/venues/walk-ins/[id]          (door / scanner walk-in entries)
 *
 * Both are polled every 30 s. When the backend fails, the hook exposes an
 * explicit error state and clears rendered attendee data.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';

// ─── Public types ──────────────────────────────────────────────────────────────

export type ContactChannel = 'instagram' | 'chat' | 'phone';

export interface Attendee {
  id: string;
  name: string;
  avatarUrl?: string;
  /** Total tickets held (online qty + door walk-ins) */
  tickets: number;
  /** Total amount paid in ₹ */
  totalSpend: number;
  contact: ContactChannel[];
  tags: string[];
  /** ISO date string of most recent transaction */
  lastPurchase: string;
  /** Where the record came from */
  source: 'online' | 'door' | 'manual';
}

export interface UseEventAttendeesReturn {
  attendees: Attendee[];
  totalCount: number;
  isLoading: boolean;
  isError: boolean;
  /** Force an immediate re-fetch (e.g. after a manual action) */
  refresh: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000;

export function useEventAttendees(eventId: string, venueId?: string): UseEventAttendeesReturn {
  const { user } = useDashboardAuth();

  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  // Prevent state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Authenticated fetch ─────────────────────────────────────────────────
  const authedFetch = useCallback(
    async (url: string) => {
      const token = await user?.getIdToken();
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return res;
    },
    [user],
  );

  // ── Normalise a record from /api/partners/venues/events/[id]/attendees → Attendee ───
  function normaliseOrderRow(raw: any): Attendee {
    const contact: ContactChannel[] = [];
    if (raw.instagram) contact.push('instagram');
    if (raw.phone) contact.push('phone');
    if (raw.phone || raw.email) contact.push('chat');

    const tags: string[] = Array.isArray(raw.tags) ? [...raw.tags] : [];
    if (raw.isVip && !tags.includes('VIP')) tags.push('VIP');

    // API source: "ticket" | "rsvp" → display as "online"; "manual" stays
    const source: Attendee['source'] =
      raw.source === 'manual' ? 'manual' : raw.source === 'rsvp' ? 'online' : 'online';

    return {
      id: raw.id,
      name: raw.fullName || 'Guest',
      avatarUrl: raw.avatarUrl || undefined,
      tickets: Number(raw.quantity ?? 1),
      totalSpend: Number(raw.totalSpend ?? 0),
      contact,
      tags,
      lastPurchase: raw.purchasedAt || new Date().toISOString(),
      source,
    };
  }

  // ── Normalise a walk-in record from /api/partners/venues/walk-ins/[id] → Attendee ──
  function normaliseWalkInRow(raw: any): Attendee {
    const contact: ContactChannel[] = [];
    if (raw.contact) contact.push('phone');

    const tags: string[] = [];
    if (raw.category && raw.category !== 'general') {
      tags.push(String(raw.category).toUpperCase());
    }

    return {
      id: `walkin_${raw.id || raw.addedAt}`,
      name: raw.guestName || 'Guest',
      avatarUrl: undefined,
      tickets: Number(raw.totalGuests ?? 1),
      totalSpend: Number(raw.amountPaise ?? 0) / 100,
      contact,
      tags,
      lastPurchase: raw.addedAt || raw.createdAt || new Date().toISOString(),
      source: 'door',
    };
  }

  // ── Core fetch ──────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!eventId || !mountedRef.current) return;

    try {
      // Fetch both sources in parallel
      const [attendeesRes, walkInsRes] = await Promise.all([
        authedFetch(`/api/partners/venues/events/${eventId}/attendees?limit=100`),
        authedFetch(`/api/partners/venues/walk-ins/${eventId}`),
      ]);

      if (!mountedRef.current) return;

      if (!attendeesRes.ok && !walkInsRes.ok) {
        throw new Error(`HTTP ${attendeesRes.status}`);
      }

      const data = await res.json();
      const rows: Attendee[] = (data.attendees ?? []).map(normaliseRow);

      setAttendees(rows);
      setTotalCount(data.pagination?.total ?? rows.length);
      setIsError(false);
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.error('[useEventAttendees] fetch error:', err?.message);
      setAttendees([]);
      setIsError(true);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [eventId, authedFetch]);

  // ── Initial load + re-seed when eventId changes ─────────────────────────
  useEffect(() => {
    if (!eventId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setAttendees([]);
    setTotalCount(0);
    fetchAll();
  }, [eventId, fetchAll]);

  // ── Polling every 30 s ──────────────────────────────────────────────────
  useEffect(() => {
    if (!eventId) return;
    const timer = setInterval(fetchAll, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [eventId, fetchAll]);

  return {
    attendees,
    totalCount,
    isLoading,
    isError,
    refresh: fetchAll,
  };
}
