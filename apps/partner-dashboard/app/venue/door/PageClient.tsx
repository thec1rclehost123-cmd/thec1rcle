'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { UserPlus, Ticket, UtensilsCrossed } from 'lucide-react';
import { HubTabBar } from '@/components/shared/HubTabBar';
import { useHubTab } from '@/lib/hooks/useHubTab';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { DoorHubContext } from '@/lib/context/DoorHubContext';
import type { DoorEntry } from '@/lib/context/DoorHubContext';
import { DoorSellClient } from './sell/PageClient';
import { DoorDineinClient } from './dinein/PageClient';
import { DoorWalkInsView } from './WalkInsView';

const TABS = [
  { key: 'sell', label: 'Entry Form', icon: Ticket },
  { key: 'walkins', label: 'Walk-Ins', icon: UserPlus },
  { key: 'dinein', label: 'Dine-in', icon: UtensilsCrossed },
];

function TabContent({ activeTab }: { activeTab: string }) {
  switch (activeTab) {
    case 'sell':
      return <DoorSellClient />;
    case 'walkins':
      return <DoorWalkInsView />;
    case 'dinein':
      return <DoorDineinClient />;
    default:
      return <DoorSellClient />;
  }
}

export default function DoorPageClient() {
  const { profile, user } = useDashboardAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeTab, setTab } = useHubTab('sell');

  const venueId = profile?.activeMembership?.partnerId ?? '';
  const eventId = searchParams.get('eventId') ?? '';

  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walkInEntries, setWalkInEntries] = useState<DoorEntry[]>([]);
  const [dineInEntries, setDineInEntries] = useState<DoorEntry[]>([]);

  useEffect(() => {
    if (!venueId || !user) return;
    (async () => {
      try {
        setError(null);
        const token = await user.getIdToken();
        const headers = { Authorization: `Bearer ${token}` };

        // Walk-ins are event-scoped — only fetch when an event is selected
        if (eventId) {
          const wiRes = await fetch(
            `/api/partners/venues/walk-ins?eventId=${eventId}&venueId=${venueId}&limit=200`,
            { headers },
          );
          if (wiRes.ok) {
            const d = await wiRes.json();

            const fetched: DoorEntry[] = (d.entries ?? []).map((e: any) => ({
              id: e.id,
              guestName: e.guestName,
              contact: e.phoneFull ?? e.phoneHash ?? '',
              gender: (e.gender ?? 'male') as DoorEntry['gender'],
              age: 0,
              type: 'walkins' as const,
              eventId: e.eventId,
              submittedAt: e.addedAt,
            }));
            setWalkInEntries(fetched);
          } else {
            console.error(`[GET Door Walk-Ins] Fetch failed: Status ${wiRes.status}`);
            throw new Error(`Failed to load walk-ins (${wiRes.status})`);
          }
        }

        // Dine-ins: scope purely to venue
        const diRes = await fetch(`/api/partners/venues/door/dinein?venueId=${venueId}&limit=200`, {
          headers,
        });
        if (diRes.ok) {
          const d = await diRes.json();

          const fetched: DoorEntry[] = (d.entries ?? []).map((e: any) => ({
            id: e.id,
            guestName: e.guestName,
            contact: e.contact || '',
            email: e.email || '',
            gender: (e.gender || 'male') as DoorEntry['gender'],
            age: Number(e.age ?? 0),
            contact: e.contact || '',
            email: e.email || '',
            gender: (e.gender || 'male') as DoorEntry['gender'],
            age: Number(e.age ?? 0),
            type: 'dinein' as const,
            totalGuests: Number(e.totalGuests || e.partySize || 1),
            totalGuests: Number(e.totalGuests || e.partySize || 1),
            eventId: e.eventId,
            submittedAt: e.addedAt || e.createdAt || new Date().toISOString(),
            submittedAt: e.addedAt || e.createdAt || new Date().toISOString(),
          }));
          setDineInEntries(fetched);
        } else {
          throw new Error(`Failed to load dine-ins (${diRes.status})`);
        }
      } catch (err: any) {
        setWalkInEntries([]);
        setDineInEntries([]);
        setError(err?.message || 'Failed to load door operations');
      }
    })();
  }, [venueId, eventId, user]);

  const addEntry = useCallback((entry: DoorEntry) => {
    if (entry.type === 'walkins') {
      setWalkInEntries((prev) => [entry, ...prev]);
    } else {
      setDineInEntries((prev) => [entry, ...prev]);
    }
  }, []);

  const handleEventChange = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('eventId', id);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  // Auto-select the first or today's event if no eventId is in the URL
  useEffect(() => {
    if (events.length > 0 && !eventId) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayEvent = events.find(
        (e: any) => String(e.startDate || e.date || '').slice(0, 10) === todayStr,
      );
      const defaultEvent = todayEvent || events[0];
      if (defaultEvent?.id) {
        handleEventChange(defaultEvent.id);
      }
    }
  }, [events, eventId, handleEventChange]);

  // Fetch events using a fresh Firebase ID token — same pattern as the Events page
  useEffect(() => {
    if (!venueId || !user) return;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/partners/venues/events?venueId=${venueId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const d = await res.json();
          setEvents(d.events ?? []);
        } else {
          throw new Error(`Failed to load events (${res.status})`);
        }
      } catch (err: any) {
        setEvents([]);
        setError(err?.message || 'Failed to load door events');
      }
    })();
  }, [venueId, user]);

  if (error) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="v-text-title font-semibold" style={{ color: 'var(--v-text-primary)' }}>
            Door
          </h1>
          <p className="mt-1 text-[14px]" style={{ color: 'var(--v-text-secondary)' }}>
            On-ground operations — guests, walk-ins, scanning, and registers.
          </p>
        </div>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <DoorHubContext.Provider
      value={{
        eventId,
        venueId,
        events,
        summary: null,
        openExceptions: 0,
        isLoading,
        setEventId: handleEventChange,
        walkInEntries,
        dineInEntries,
        addEntry,
      }}
    >
      <div className="space-y-4">
        {/* Hub header */}
        <div>
          <h1 className="v-text-title font-semibold" style={{ color: 'var(--v-text-primary)' }}>
            Door
          </h1>
          <p className="mt-1 text-[14px]" style={{ color: 'var(--v-text-secondary)' }}>
            On-ground operations — guests, walk-ins, scanning, and registers.
          </p>
        </div>

        {/* Tab bar */}
        <HubTabBar tabs={TABS} activeTab={activeTab} onTabChange={setTab} />

        {/* Tab content */}
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
          <TabContent activeTab={activeTab} />
        </Suspense>
      </div>
    </DoorHubContext.Provider>
  );
}
