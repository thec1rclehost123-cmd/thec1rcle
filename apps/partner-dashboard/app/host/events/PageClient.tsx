'use client';

import { useState, useEffect, forwardRef, memo, useCallback, useMemo } from 'react';
import { VirtuosoGrid } from 'react-virtuoso';
import {
  Calendar,
  Search,
  Plus,
  Edit,
  Loader2,
  BarChart3,
  List,
  CalendarDays,
  ArrowUpRight,
  AlertCircle,
  Edit3,
  Share2,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardEventCard } from '@c1rcle/ui';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { mapEventForClient, EVENT_LIFECYCLE } from '@c1rcle/core/events';
import { parseAsIST } from '@c1rcle/core/time';
import { VenuePageShell, VenueFilterTabs } from '@/components/venue-layout/VenuePageShell';
import { useHubTab } from '@/lib/hooks/useHubTab';
import CalendarClient from '../calendar/PageClient';

interface Event {
  id: string;
  title: string;
  date: Date;
  startDate?: string;
  hostId: string;
  hostName: string;
  venueId: string;
  venueName: string;
  lifecycle?: string;
  status: 'draft' | 'pending' | 'approved' | 'live' | 'completed' | 'cancelled' | 'scheduled';
  ticketsSold: number;
  ticketsTotal: number;
  capacity?: number;
  expectedCrowd: number;
  promotersEnabled: boolean;
  promotersCount?: number;
  revenue?: number;
  stats?: { ticketsSold?: number; revenue?: number };
  eventType: 'venue' | 'host';
  canApprove: boolean;
  canEdit: boolean;
  canRequestEdits: boolean;
  slug?: string;
}

// ── Virtuoso grid containers ──
const GridList = forwardRef<HTMLDivElement>((props, ref) => (
  <div {...props} ref={ref} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8" />
));
GridList.displayName = 'GridList';

const GridItem = forwardRef<HTMLDivElement>((props, ref) => (
  <div {...props} ref={ref} className="h-full w-full" />
));
GridItem.displayName = 'GridItem';

// ── Memoized event card ──
const MemoizedHostEventCard = memo(({ event, index }: any) => {
  const effectiveStatus = event.lifecycle || event.status;

  const getPrimaryAction = (e: any) => {
    if (
      effectiveStatus === EVENT_LIFECYCLE.DRAFT ||
      effectiveStatus === EVENT_LIFECYCLE.NEEDS_CHANGES
    ) {
      return { label: 'Continue', href: `/host/create?id=${e.id}`, icon: <Edit size={16} /> };
    }
    return { label: 'More Info', href: `/host/events/${e.id}`, icon: <BarChart3 size={16} /> };
  };

  const secondaryActions: any[] = [];
  if (event.canEdit)
    secondaryActions.push({
      label: 'Edit Event',
      icon: <Edit size={16} />,
      href: `/host/create?id=${event.id}`,
    });
  secondaryActions.push({
    label: 'Analytics',
    icon: <BarChart3 size={16} />,
    href: `/host/analytics/overview?eventId=${event.id}`,
  });

  return (
    <DashboardEventCard
      event={event}
      index={index}
      role="host"
      primaryAction={getPrimaryAction(event)}
      secondaryActions={secondaryActions}
      showStats={true}
      priority={index < 2}
    />
  );
});
MemoizedHostEventCard.displayName = 'MemoizedHostEventCard';

// ── Page ──
export default function EventsManagementPage() {
  const { activeTab: hubTab } = useHubTab('events');
  const { profile, user } = useDashboardAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!profile?.activeMembership?.partnerId || !user) return;
    const hostId = profile.activeMembership.partnerId;
    setLoading(true);

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/partners/hosts/events?hostId=${hostId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('API Route failed');
      const { events: raw } = await res.json();
      const mapped: Event[] = raw
        .map((r: any) => {
          const m = mapEventForClient(r, r.id) as any;
          return {
            ...m,
            title: m.title || m.name || 'Untitled Event',
            date: parseAsIST(m.startDate || m.date),
            hostName: m.hostName || m.host || profile?.displayName || 'Host',
            hostId: m.hostId || m.creatorId || hostId,
            venueId: m.venueId || r.venueId || '',
            venueName: m.venueName || r.venueName || r.venue || 'Venue pending',
            status: m.lifecycle as any,
            ticketsSold: m.stats?.ticketsSold || 0,
            ticketsTotal:
              m.capacity || m.tickets?.reduce((s: number, t: any) => s + (t.quantity || 0), 0) || 0,
            expectedCrowd: m.capacity || 0,
            promotersCount: m.promoterSettings?.allowedPromoterIds?.length || 0,
            revenue: m.stats?.revenue || 0,
            eventType: 'host',
            canApprove: false,
            canEdit: [EVENT_LIFECYCLE.DRAFT, EVENT_LIFECYCLE.NEEDS_CHANGES].includes(m.lifecycle),
            canRequestEdits: false,
          };
        })
        .sort((a: any, b: any) => {
          const now = new Date();
          const dateA = a.date instanceof Date ? a.date : new Date(a.date);
          const dateB = b.date instanceof Date ? b.date : new Date(b.date);

          const isFutureA = dateA > now && a.status !== 'draft';
          const isFutureB = dateB > now && b.status !== 'draft';

          if (isFutureA && !isFutureB) return -1;
          if (!isFutureA && isFutureB) return 1;

          if (isFutureA && isFutureB) {
            return dateA.getTime() - dateB.getTime();
          }

          return dateB.getTime() - dateA.getTime();
        });
      setEvents(mapped);
      setFetchError(null);
    } catch {
      setFetchError('Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [profile, user]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const getStatus = (e: Event) => e.lifecycle || e.status;

  const filteredEvents = useMemo(
    () =>
      events.filter((e) => {
        const s = getStatus(e);
        let match = false;
        if (filter === 'all') {
          match = [
            EVENT_LIFECYCLE.APPROVED,
            EVENT_LIFECYCLE.SCHEDULED,
            EVENT_LIFECYCLE.LIVE,
            EVENT_LIFECYCLE.DRAFT,
            EVENT_LIFECYCLE.COMPLETED,
          ].includes(s as string);
        }
        if (filter === 'draft') match = s === EVENT_LIFECYCLE.DRAFT;
        if (filter === 'live')
          match = [
            EVENT_LIFECYCLE.APPROVED,
            EVENT_LIFECYCLE.SCHEDULED,
            EVENT_LIFECYCLE.LIVE,
          ].includes(s as string);
        if (filter === 'approved') match = s === EVENT_LIFECYCLE.SUBMITTED;
        if (filter === 'completed') match = s === EVENT_LIFECYCLE.COMPLETED;
        return (
          match &&
          (e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.venueName.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }),
    [events, filter, searchQuery],
  );

  const allCount = useMemo(
    () =>
      events.filter((e) =>
        [
          EVENT_LIFECYCLE.APPROVED,
          EVENT_LIFECYCLE.SCHEDULED,
          EVENT_LIFECYCLE.LIVE,
          EVENT_LIFECYCLE.DRAFT,
          EVENT_LIFECYCLE.COMPLETED,
        ].includes(getStatus(e) as string),
      ).length,
    [events],
  );

  const liveCount = useMemo(
    () =>
      events.filter((e) =>
        [EVENT_LIFECYCLE.APPROVED, EVENT_LIFECYCLE.SCHEDULED, EVENT_LIFECYCLE.LIVE].includes(
          getStatus(e) as string,
        ),
      ).length,
    [events],
  );

  const draftCount = useMemo(
    () => events.filter((e) => getStatus(e) === EVENT_LIFECYCLE.DRAFT).length,
    [events],
  );

  const publishedCount = useMemo(
    () => events.filter((e) => getStatus(e) === EVENT_LIFECYCLE.SUBMITTED).length,
    [events],
  );

  const completedCount = useMemo(
    () => events.filter((e) => getStatus(e) === EVENT_LIFECYCLE.COMPLETED).length,
    [events],
  );

  const filterTabs = [
    { label: 'All', value: 'all', count: allCount },
    { label: 'Live', value: 'live', count: liveCount },
    { label: 'Published', value: 'approved', count: publishedCount },
    { label: 'Drafts', value: 'draft', count: draftCount },
    { label: 'Completed', value: 'completed', count: completedCount },
  ];

  return (
    <VenuePageShell
      title={hubTab === 'calendar' ? 'Calendar' : 'Events'}
      actions={
        hubTab === 'calendar' ? null : (
          <div className="flex items-center gap-3">
            {[
              { label: 'Live Now', value: loading ? '—' : liveCount, color: '#34d399' },
              { label: 'Deciding', value: loading ? '—' : publishedCount, color: '#f59e0b' },
            ].map((metric, i) => (
              <div
                key={i}
                className="min-w-[100px] rounded-[22px] px-4 py-2.5 text-center transition-all hover:scale-[1.02]"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <p
                  className="text-[20px] font-black tabular-nums leading-none tracking-tight"
                  style={{ color: metric.color }}
                >
                  {metric.value}
                </p>
                <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.15em] opacity-40 text-white">
                  {metric.label}
                </p>
              </div>
            ))}
            <Link
              href="/host/events/requests"
              className="inline-flex items-center gap-2 rounded-[22px] px-4 py-3 text-[12px] font-black uppercase tracking-[0.14em] transition-all hover:scale-[1.02] bg-white/5 border border-white/10 text-white shadow-xl"
            >
              Slot Requests
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        )
      }
    >
      {hubTab === 'calendar' ? (
        <CalendarClient />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <VenueFilterTabs tabs={filterTabs} active={filter} onChange={setFilter} />
            <div className="flex items-center gap-2 w-full lg:max-w-md">
              <div className="relative flex-1 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3 focus-within:border-orange-500/50 transition-colors">
                <Search className="w-4 h-4 text-white/30" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-[13px] text-white placeholder:text-white/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-white/30 hover:text-white"
                  >
                    ×
                  </button>
                )}
              </div>
              <button
                onClick={fetchEvents}
                className="p-2.5 rounded-2xl bg-white/5 border border-white/10 text-white/30 hover:text-white transition-colors shrink-0 flex items-center justify-center"
                title="Refresh Events"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {fetchError ? (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-20 rounded-[40px] border border-red-500/20 bg-red-500/5 flex flex-col items-center gap-4 text-center"
              >
                <AlertCircle className="w-10 h-10 text-red-400" />
                <div>
                  <h3 className="text-lg font-black text-white">Roster Sync Failed</h3>
                  <p className="text-sm text-white/40 mt-1">
                    We couldn't load your event portfolio. Please try again.
                  </p>
                </div>
                <button
                  onClick={fetchEvents}
                  className="px-8 py-3 rounded-xl bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-widest text-white"
                >
                  Retry
                </button>
              </motion.div>
            ) : loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
              >
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-80 rounded-[40px] bg-white/5 animate-pulse" />
                ))}
              </motion.div>
            ) : filteredEvents.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-32 rounded-[56px] border border-dashed border-white/10 bg-white/2 flex flex-col items-center text-center px-12"
              >
                <div className="p-6 rounded-3xl bg-white/5 mb-8">
                  <CalendarDays className="w-12 h-12 text-white/20" />
                </div>
                <h3 className="text-2xl font-black text-white tracking-tight">
                  {searchQuery ? 'No matches in roster' : 'Roster empty'}
                </h3>
                <p className="text-white/40 text-[15px] font-medium mt-4 mb-10 max-w-md">
                  {searchQuery
                    ? 'Try refining your search terms for the current filter.'
                    : 'Schedule your next production by securing a venue slot in the calendar.'}
                </p>
                <Link
                  href="/host/calendar"
                  className="h-14 px-10 rounded-2xl bg-orange-600 text-white text-[13px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-orange-950/20 hover:scale-105 transition-all"
                >
                  <Plus className="w-5 h-5" /> Browse Network Calendar
                </Link>
              </motion.div>
            ) : (
              <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <VirtuosoGrid
                  useWindowScroll
                  data={filteredEvents}
                  components={{ List: GridList, Item: GridItem }}
                  itemContent={(index, event) => (
                    <MemoizedHostEventCard key={event.id} event={event} index={index} />
                  )}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </VenuePageShell>
  );
}
