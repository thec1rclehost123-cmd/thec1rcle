'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { useDoorHub } from '@/lib/context/DoorHubContext';
import type { GuestOpsOverview } from '@/lib/types/guestOps';

export interface GuestOpsShellData {
  eventId: string;
  venueId: string;
  events: Array<{ id: string; title: string; startDate?: string; status?: string }>;
  summary: GuestOpsOverview | null;
  openExceptions: number;
  isLoading: boolean;
  authHeaders: () => Promise<{ 'Content-Type': string; Authorization: string }>;
}

/**
 * Returns shell context data for GuestOps pages.
 * When inside DoorHubContext (hub mode), uses hub's shared state to avoid redundant fetches.
 * When used standalone (direct /venue/guest-ops/* navigation), fetches its own data.
 */
export function useGuestOpsShellData(): GuestOpsShellData {
  const hub = useDoorHub();
  const { profile, getIdToken } = useDashboardAuth();
  const searchParams = useSearchParams();

  const venueId = hub?.venueId ?? profile?.activeMembership?.partnerId ?? '';
  const eventId = hub?.eventId ?? searchParams.get('eventId') ?? '';

  const authHeaders = useCallback(
    async () => ({
      'Content-Type': 'application/json' as const,
      Authorization: `Bearer ${await getIdToken()}`,
    }),
    [getIdToken],
  );

  // Standalone state — only populated when NOT in hub mode
  const [standaloneEvents, setStandaloneEvents] = useState<any[]>([]);
  const [standaloneSummary, setStandaloneSummary] = useState<GuestOpsOverview | null>(null);
  const [standaloneOpenExceptions, setStandaloneOpenExceptions] = useState(0);
  const [standaloneLoading, setStandaloneLoading] = useState(true);

  // Fetch events list whenever venueId is known (independent of eventId)
  useEffect(() => {
    if (hub) return;
    if (!venueId) return;
    let cancelled = false;
    void (async () => {
      try {
        const headers = await authHeaders();
        const response = await fetch(`/api/partners/venues/events?venueId=${venueId}`, {
          headers,
        });
        const data = response.ok ? await response.json() : { events: [] };
        if (!cancelled) setStandaloneEvents(data.events ?? []);
      } catch {
        if (!cancelled) setStandaloneEvents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hub, venueId, authHeaders]);

  // Fetch event-specific data only when an eventId is selected
  useEffect(() => {
    if (hub) return;
    if (!eventId || !venueId) {
      setStandaloneLoading(false);
      return;
    }

    setStandaloneLoading(true);
    let cancelled = false;
    void (async () => {
      try {
        const headers = await authHeaders();
        const [sumRes, excRes] = await Promise.all([
          fetch(`/api/partners/venues/guest-ops/${eventId}/summary?venueId=${venueId}`, {
            headers,
          }),
          fetch(
            `/api/partners/venues/guest-ops/${eventId}/exceptions?venueId=${venueId}&status=open`,
            { headers },
          ),
        ]);
        if (!cancelled && sumRes.ok) setStandaloneSummary(await sumRes.json());
        if (!cancelled && excRes.ok) {
          const data = await excRes.json();
          setStandaloneOpenExceptions(data.openCount ?? 0);
        }
      } finally {
        if (!cancelled) setStandaloneLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hub, eventId, venueId, authHeaders]);

  if (hub) {
    return {
      eventId,
      venueId,
      events: hub.events,
      summary: hub.summary,
      openExceptions: hub.openExceptions,
      isLoading: hub.isLoading,
      authHeaders,
    };
  }

  return {
    eventId,
    venueId,
    events: standaloneEvents,
    summary: standaloneSummary,
    openExceptions: standaloneOpenExceptions,
    isLoading: standaloneLoading,
    authHeaders,
  };
}
