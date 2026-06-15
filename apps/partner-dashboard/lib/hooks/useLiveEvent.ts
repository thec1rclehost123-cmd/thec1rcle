'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import type {
  TonightOpsData,
  OccupancySnapshot,
  LiveEventStatus,
  UpcomingEvent,
} from '@/lib/types/venueOverview';

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useLiveEvent
 *
 * Real-time live-operations hook for the venue dashboard.
 *
 * Strategy:
 *   1. Fetch today's event via React Query (cached 2 min).
 *   2. Poll /api/partners/venues/overview/tonight every 30 s for live ops metrics.
 *
 * The hook signals its state via `liveStatus` so the UI can show
 * "Live", "Connecting", "Delayed (30s)" or "No Event Tonight".
 */
export function useLiveEvent(venueId: string | undefined) {
  const { user } = useDashboardAuth();

  const [occupancy, setOccupancy] = useState<OccupancySnapshot | null>(null);
  const [velocity, setVelocity] = useState<number[]>(new Array(15).fill(0));
  const [liveStatus, setLiveStatus] = useState<LiveEventStatus>('no_event');

  // ── Step 1: Today's event (React Query, cached 2 min) ────────────────────
  const eventsQuery = useQuery<{ events: UpcomingEvent[] }>({
    queryKey: ['venue-events-today', venueId ?? ''],
    queryFn: async () => {
      const token = await user!.getIdToken();
      const res = await fetch(`/api/partners/venues/events?venueId=${venueId}&date=today`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Events fetch failed: ${res.status}`);
      return res.json();
    },
    enabled: !!user && !!venueId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const todayEvent = eventsQuery.data?.events?.[0] ?? null;

  // ── Step 2: Gateway polling for tonight ops ──────────────────────────────
  const tonightOpsQuery = useQuery<TonightOpsData>({
    queryKey: ['venue-tonight-ops-live', todayEvent?.id ?? ''],
    queryFn: async () => {
      const token = await user!.getIdToken();
      const res = await fetch(`/api/partners/venues/overview/tonight?eventId=${todayEvent!.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Tonight fetch failed: ${res.status}`);
      return res.json();
    },
    enabled: !!user && !!todayEvent?.id,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: false,
    gcTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!todayEvent?.id) {
      setLiveStatus('no_event');
      setOccupancy(null);
      setVelocity(new Array(15).fill(0));
      return;
    }

    if (tonightOpsQuery.isLoading && !tonightOpsQuery.data) {
      setLiveStatus('connecting');
      return;
    }

    if (tonightOpsQuery.data) {
      const tonightOps = tonightOpsQuery.data;
      const capacity = todayEvent.capacity ?? tonightOps.expected ?? 0;
      setOccupancy({
        checkedIn: tonightOps.checkedIn ?? 0,
        capacity,
        occupancyPct: capacity > 0 ? Math.round(((tonightOps.checkedIn ?? 0) / capacity) * 100) : 0,
        lastScanAt: tonightOps._meta?.fetchedAt ?? null,
      });

      const nextVelocity =
        Array.isArray(tonightOps.entryHistory) && tonightOps.entryHistory.length > 0
          ? [
              ...new Array(Math.max(0, 15 - tonightOps.entryHistory.length)).fill(0),
              ...tonightOps.entryHistory,
            ].slice(-15)
          : tonightOps.entryVelocity != null
            ? [...new Array(14).fill(0), tonightOps.entryVelocity]
            : new Array(15).fill(0);

      setVelocity(nextVelocity);
      setLiveStatus('live');
      return;
    }

    if (tonightOpsQuery.isError) {
      setLiveStatus('degraded');
    }
  }, [
    todayEvent?.id,
    todayEvent?.capacity,
    tonightOpsQuery.data,
    tonightOpsQuery.isError,
    tonightOpsQuery.isLoading,
  ]);

  return {
    todayEvent,
    occupancy,
    velocity,
    liveStatus,
    tonightOps: tonightOpsQuery.data ?? null,
    isLoadingEvent: eventsQuery.isLoading,
  };
}
