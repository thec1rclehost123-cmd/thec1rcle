'use client';

import { useState, useEffect, forwardRef, memo, useCallback, useMemo } from 'react';
import { VirtuosoGrid } from 'react-virtuoso';
import {
  Calendar,
  DollarSign,
  Search,
  Plus,
  CheckCircle2,
  AlertCircle,
  Edit,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Play,
  Pause,
  List,
  CalendarDays,
  Clock,
  Archive,
  Radio,
  FileEdit,
  ArrowUpRight,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import { DashboardEventCard } from '@c1rcle/ui';
import { EventDetailsModal } from '@/components/venue-layout/EventDetailsModal';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { mapEventForClient, EVENT_LIFECYCLE } from '@c1rcle/core/events';
import { parseAsIST } from '@c1rcle/core/time';
import { VenuePageShell } from '@/components/venue-layout/VenuePageShell';
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
}

// ── Virtuoso grid containers ──
const GridList = forwardRef<HTMLDivElement>((props, ref) => (
  <div {...props} ref={ref} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" />
));
GridList.displayName = 'GridList';

const GridItem = forwardRef<HTMLDivElement>((props, ref) => (
  <div {...props} ref={ref} className="h-[380px] w-full" />
));
GridItem.displayName = 'GridItem';

// ── Memoized event card ──
const MemoizedVenueEventCard = memo(({ event, index, handleEventUpdate }: any) => {
  const effectiveStatus = event.lifecycle || event.status;

  const getPrimaryAction = (e: any) => {
    if (e.canApprove)
      return {
        label: 'Review Submission',
        href: `/venue/events/${e.id}`,
        icon: <ShieldCheck size={16} />,
      };
    // Local HEAD prefers analytics link for existing events
    return {
      label: 'Explore Event',
      href: `/venue/events/${e.id}/analytics`,
      icon: <ArrowRight size={16} />,
    };
  };

  const secondaryActions: any[] = [];
  if (event.canEdit)
    secondaryActions.push({
      label: 'Edit Event',
      icon: <Edit size={16} />,
      href: `/venue/create?id=${event.id}`,
    });
  if (effectiveStatus === 'live')
    secondaryActions.push({
      label: 'Pause Ticket Sales',
      icon: <Pause size={16} />,
      onClick: () => handleEventUpdate('pause', null, event.id),
      color: 'red',
    });
  else if (effectiveStatus === 'paused')
    secondaryActions.push({
      label: 'Resume Ticket Sales',
      icon: <Play size={16} />,
      onClick: () => handleEventUpdate('resume', null, event.id),
    });

  return (
    <DashboardEventCard
      event={event}
      index={index}
      role="venue"
      primaryAction={getPrimaryAction(event)}
      secondaryActions={secondaryActions}
      showStats={true}
      height="h-full"
      priority={index < 2}
    />
  );
});
MemoizedVenueEventCard.displayName = 'MemoizedVenueEventCard';

// ── Page ──
export default function EventsManagementPage() {
  const { activeTab: hubTab } = useHubTab('events');
  const { profile, user } = useDashboardAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'host' | 'venue'>('venue');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // activeMembership may be null for direct venue owners — gateway resolves identity from auth token
    const venueId = profile?.activeMembership?.partnerId ?? null;

    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/partners/venues/events`, {
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
              hostName: m.hostName || m.host || 'Unknown Host',
              hostId: m.hostId || m.creatorId,
              venueId: m.venueId || r.venueId || venueId,
              venueName:
                m.venueName ||
                r.venueName ||
                r.venue ||
                profile?.activeMembership?.partnerName ||
                'Your Venue',
              status: m.lifecycle as any,
              ticketsSold: m.stats?.ticketsSold || 0,
              ticketsTotal: m.capacity || r.ticketsTotal || 0,
              expectedCrowd: m.expectedCrowd || m.capacity || 0,
              promotersCount: m.promoterSettings?.allowedPromoterIds?.length || 0,
              revenue: m.stats?.revenue || 0,
            };
          })
          .filter(
            (e: any) =>
              !(
                e.eventType === 'host' &&
                venueId &&
                e.creatorId !== venueId &&
                e.lifecycle === 'draft'
              ),
          )
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
    })();
  }, [profile, user]);

  const handleEventUpdate = useCallback(
    async (action: string, data?: any, overrideEventId?: string) => {
      const eventId = overrideEventId || selectedEvent?.id;
      if (!eventId || !user) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/partners/venues/events', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ eventId, action, data }),
        });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error || 'Failed');
        }
        const newStatusMap: Record<string, string> = {
          approve: EVENT_LIFECYCLE.SCHEDULED,
          reject: EVENT_LIFECYCLE.DENIED,
          pause: EVENT_LIFECYCLE.PAUSED,
          resume: EVENT_LIFECYCLE.SCHEDULED,
        };
        const mappedStatus = newStatusMap[action];
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId ? { ...e, status: (mappedStatus || e.status) as any } : e,
          ),
        );
      } catch (e: any) {
        alert(e.message);
      }
    },
    [selectedEvent?.id, user],
  );

  const getStatus = (e: Event) => (e as any).lifecycle || e.status;

  const isEventLiveNow = (e: any): boolean => {
    const s = getStatus(e);
    if (s === EVENT_LIFECYCLE.LIVE) return true;
    if (s !== EVENT_LIFECYCLE.SCHEDULED && s !== EVENT_LIFECYCLE.APPROVED) return false;
    const startDate: string = e.startDate || e.date || '';
    const startTime: string = e.startTime || '00:00';
    const endTime: string = e.endTime || '23:59';
    if (!startDate) return false;
    const now = new Date();
    const [sh, sm] = startTime.split(':').map(Number);
    const start = new Date(startDate);
    start.setHours(sh, sm, 0, 0);
    const [eh, em] = endTime.split(':').map(Number);
    const end = new Date(startDate);
    end.setHours(eh, em, 0, 0);
    if (end <= start) end.setDate(end.getDate() + 1);
    return now >= start && now <= end;
  };

  const isEventOver = (e: any): boolean => {
    const s = getStatus(e);
    if (
      [
        EVENT_LIFECYCLE.COMPLETED,
        EVENT_LIFECYCLE.CANCELLED,
        EVENT_LIFECYCLE.DENIED,
        EVENT_LIFECYCLE.DELETED,
        EVENT_LIFECYCLE.DRAFT,
      ].includes(s)
    )
      return false;
    const startDate: string = e.startDate || e.date || '';
    const endTime: string = e.endTime || '23:59';
    if (!startDate) return false;
    const [eh, em] = endTime.split(':').map(Number);
    const end = new Date(startDate);
    end.setHours(eh, em, 0, 0);
    const startTime: string = e.startTime || '00:00';
    const [sh, sm] = startTime.split(':').map(Number);
    if (eh * 60 + em < sh * 60 + sm) end.setDate(end.getDate() + 1);
    return new Date() > end;
  };

  const pendingCount = useMemo(
    () =>
      events.filter((e) => e.eventType === 'host' && getStatus(e) === EVENT_LIFECYCLE.SUBMITTED)
        .length,
    [events],
  );

  const typeFilteredEventsForCounts = useMemo(() => {
    return events.filter((e) => {
      if (e.eventType === 'host' && getStatus(e) === EVENT_LIFECYCLE.SUBMITTED) {
        return false;
      }
      return e.eventType === typeFilter;
    });
  }, [events, typeFilter]);

  const filteredEvents = useMemo(
    () =>
      typeFilteredEventsForCounts.filter((e) => {
        const s = getStatus(e);
        let match = false;
        if (filter === 'all') {
          match = s !== EVENT_LIFECYCLE.DELETED && s !== EVENT_LIFECYCLE.DENIED && !isEventOver(e);
        } else if (filter === 'draft') {
          match = e.eventType === 'venue' && s === EVENT_LIFECYCLE.DRAFT;
        } else if (filter === 'pending') {
          match = e.eventType === 'host' && s === EVENT_LIFECYCLE.SUBMITTED;
        } else if (filter === 'live') {
          match = isEventLiveNow(e);
        } else if (filter === 'approved') {
          match =
            (s === EVENT_LIFECYCLE.APPROVED || s === EVENT_LIFECYCLE.SCHEDULED) &&
            !isEventLiveNow(e) &&
            !isEventOver(e);
        } else if (filter === 'completed') {
          match = s === EVENT_LIFECYCLE.COMPLETED || isEventOver(e);
        }

        return (
          match &&
          (e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.hostName.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }),
    [typeFilteredEventsForCounts, filter, searchQuery],
  );

  const liveCount = useMemo(
    () => typeFilteredEventsForCounts.filter(isEventLiveNow).length,
    [typeFilteredEventsForCounts],
  );
  const draftCount = useMemo(
    () =>
      typeFilteredEventsForCounts.filter(
        (e) => e.eventType === 'venue' && getStatus(e) === EVENT_LIFECYCLE.DRAFT,
      ).length,
    [typeFilteredEventsForCounts],
  );
  const publishedCount = useMemo(
    () =>
      typeFilteredEventsForCounts.filter(
        (e) =>
          [EVENT_LIFECYCLE.SCHEDULED, EVENT_LIFECYCLE.APPROVED].includes(getStatus(e) as string) &&
          !isEventLiveNow(e) &&
          !isEventOver(e),
      ).length,
    [typeFilteredEventsForCounts],
  );
  const completedCount = useMemo(
    () =>
      typeFilteredEventsForCounts.filter(
        (e) => getStatus(e) === EVENT_LIFECYCLE.COMPLETED || isEventOver(e),
      ).length,
    [typeFilteredEventsForCounts],
  );

  const filterTabs = [
    { label: 'All', value: 'all', count: typeFilteredEventsForCounts.length },
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
              {
                label: 'Live Now',
                value: loading ? '—' : liveCount,
                color: 'var(--v-text-primary)',
              },
              { label: 'Requests', value: loading ? '—' : pendingCount, color: '#f59e0b' },
            ].map((metric, i) => (
              <div
                key={i}
                className="min-w-[100px] rounded-[22px] px-4 py-2.5 text-center transition-all hover:scale-[1.02]"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 4px 24px -12px rgba(0,0,0,0.5)',
                }}
              >
                <p
                  className="text-[20px] font-black tabular-nums leading-none tracking-tight"
                  style={{ color: metric.color }}
                >
                  {metric.value}
                </p>
                <p
                  className="mt-1.5 text-[10px] font-black uppercase tracking-[0.15em] opacity-40"
                  style={{ color: 'var(--v-text-primary)' }}
                >
                  {metric.label}
                </p>
              </div>
            ))}
            <Link
              href="/venue/events/requests"
              className={`inline-flex items-center gap-2 rounded-[22px] px-4 py-3 text-[12px] font-black uppercase tracking-[0.14em] transition-all hover:scale-[1.02] ${pendingCount > 0 ? 'animate-pulse' : ''}`}
              style={{
                background:
                  pendingCount > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                color: pendingCount > 0 ? '#fbbf24' : 'var(--v-text-primary)',
                border:
                  pendingCount > 0
                    ? '1px solid rgba(245, 158, 11, 0.45)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(12px)',
                boxShadow:
                  pendingCount > 0
                    ? '0 0 0 1px rgba(245,158,11,0.18), 0 8px 24px -12px rgba(245,158,11,0.45)'
                    : '0 4px 24px -12px rgba(0,0,0,0.5)',
              }}
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
          <div className="flex items-center gap-3">
            <div
              className="flex items-center p-1.5 rounded-2xl shrink-0 overflow-x-auto scrollbar-hide"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {filterTabs.map((t) => {
                const iconMap: Record<string, any> = {
                  all: List,
                  live: Radio,
                  pending: Clock,
                  approved: CheckCircle2,
                  draft: FileEdit,
                  completed: Archive,
                };
                const colorMap: Record<string, string> = {
                  all: 'var(--v-orange)',
                  live: 'var(--v-success)',
                  pending: 'var(--v-warning)',
                  approved: 'var(--v-info)',
                  draft: 'var(--v-text-tertiary)',
                  completed: 'var(--v-text-muted)',
                };
                const Icon = iconMap[t.value] || List;
                const isActive = filter === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => setFilter(t.value)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all shrink-0 whitespace-nowrap"
                    style={
                      isActive
                        ? { background: 'var(--v-elevated)', color: 'var(--v-text-primary)' }
                        : { color: 'var(--v-text-tertiary)' }
                    }
                  >
                    <Icon
                      className="w-3.5 h-3.5"
                      style={isActive ? { color: colorMap[t.value] } : {}}
                    />
                    {t.label}
                    {(t.count ?? 0) > 0 && (
                      <span
                        className="px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums"
                        style={{
                          background: isActive ? 'rgba(244,74,34,0.15)' : 'rgba(255,255,255,0.06)',
                          color: isActive ? '#F44A22' : 'var(--v-text-tertiary)',
                        }}
                      >
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div
              className="flex items-center p-1.5 rounded-2xl shrink-0"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {[
                { label: 'Hosts', value: 'host' },
                { label: 'Venue', value: 'venue' },
              ].map((t) => {
                const isActive = typeFilter === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => setTypeFilter(t.value as any)}
                    className="px-4 py-2 rounded-xl text-[13px] font-semibold transition-all shrink-0 whitespace-nowrap"
                    style={
                      isActive
                        ? { background: 'var(--v-elevated)', color: 'var(--v-text-primary)' }
                        : { color: 'var(--v-text-tertiary)' }
                    }
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div
              className="flex items-center gap-2 flex-1 px-4 py-2.5 rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <Search
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: 'var(--v-text-tertiary)' }}
              />
              <input
                type="text"
                placeholder="Search events or hosts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-[13px] font-medium outline-none"
                style={{ color: 'var(--v-text-primary)' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--v-text-tertiary)' }}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {fetchError ? (
            <div
              className="p-4 rounded-2xl text-sm font-medium"
              style={{
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.2)',
                color: 'var(--v-error)',
              }}
            >
              {fetchError}
            </div>
          ) : loading ? (
            <div
              className="rounded-[32px] py-24 flex flex-col items-center gap-4"
              style={{ background: 'transparent', border: '1px solid var(--v-divider)' }}
            >
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--v-orange)' }} />
              <p
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--v-text-tertiary)' }}
              >
                Loading events...
              </p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div
              className="rounded-[32px] py-24 flex flex-col items-center text-center gap-4"
              style={{ background: 'transparent', border: '1px solid var(--v-divider)' }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--v-elevated)' }}
              >
                <Calendar className="w-8 h-8" style={{ color: 'var(--v-text-muted)' }} />
              </div>
              <div>
                <h3
                  className="text-[17px] font-semibold mb-1"
                  style={{ color: 'var(--v-text-primary)' }}
                >
                  No events found
                </h3>
                <p className="text-[13px]" style={{ color: 'var(--v-text-tertiary)' }}>
                  Try adjusting your filters or search terms.
                </p>
              </div>
              <button
                onClick={() => {
                  setFilter('all');
                  setSearchQuery('');
                }}
                className="text-[13px] font-semibold underline"
                style={{ color: 'var(--v-orange)' }}
              >
                Reset filters
              </button>
            </div>
          ) : (
            <VirtuosoGrid
              useWindowScroll
              data={filteredEvents}
              components={{ List: GridList, Item: GridItem }}
              itemContent={(index, event) => (
                <MemoizedVenueEventCard
                  key={event.id}
                  event={event}
                  index={index}
                  handleEventUpdate={handleEventUpdate}
                />
              )}
            />
          )}
        </div>
      )}

      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent as any}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onEventUpdate={handleEventUpdate}
        />
      )}
    </VenuePageShell>
  );
}
