'use client';

import Image from 'next/image';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  IndianRupee,
  PencilLine,
  Link as LinkIcon,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Ticket,
  Users,
} from 'lucide-react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { VenuePageShell } from '@/components/venue-layout/VenuePageShell';
import { ErrorState } from '@/components/ui/ErrorState';
import { CITY_MAP } from '@c1rcle/core/events';
import GenerateLinkModal from '@/components/promoter/links/GenerateLinkModal';
import AnalyticsDrawer from '@/components/promoter/links/AnalyticsDrawer';

const GUEST_PORTAL_URL =
  process.env.NEXT_PUBLIC_GUEST_PORTAL_URL || process.env.NEXT_PUBLIC_SITE_URL || '';

type PromoterTab = 'all' | 'available' | 'linked';

interface PromoterEvent {
  id: string;
  title: string;
  summary: string;
  image: string;
  date: string;
  startDate: string;
  startTime?: string;
  time: string;
  location: string;
  venue: string;
  venueName?: string;
  hostName?: string;
  city: string;
  category: string;
  creatorRole?: string;
  priceRange: { min: number; max: number };
  commissionRate: number;
  tickets: { id: string; name: string; price: number; promoterEnabled: boolean }[];
  stats: { interested: number };
}

interface PromoterLink {
  id: string;
  code: string;
  eventId: string;
  eventTitle: string;
  clicks: number;
  conversions: number;
  revenue: number;
  commission: number;
  isActive: boolean;
  fullUrl?: string | null;
  eventSlug?: string | null;
  vanityPrefix?: string | null;
  vanitySlug?: string | null;
  vanityAlias?: string | null;
}

function formatINR(paiseOrRupees: number) {
  const amount = Number(paiseOrRupees || 0);
  if (!amount) return '₹0';
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function formatEventDate(startDate?: string) {
  if (!startDate) {
    return { day: '--', month: '---', weekday: 'Schedule pending', full: 'Date TBA' };
  }

  return {
    day: new Intl.DateTimeFormat('en-IN', { day: '2-digit', timeZone: 'Asia/Kolkata' }).format(
      new Date(startDate),
    ),
    month: new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' })
      .format(new Date(startDate))
      .toUpperCase(),
    weekday: new Intl.DateTimeFormat('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(
      new Date(startDate),
    ),
    full: new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(startDate)),
  };
}

function buildLinkUrl(link: PromoterLink) {
  if (link.fullUrl) return link.fullUrl;
  const slug = link.eventSlug || link.eventId;
  return `${GUEST_PORTAL_URL}/e/${slug}?ref=${link.code}`;
}

function formatTimeStr(timeStr: string) {
  timeStr = timeStr.trim();
  const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hour = Number(match24[1]);
    const minute = Number(match24[2]);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const normalizedHour = hour % 12 || 12;
    return `${normalizedHour}:${String(minute).padStart(2, '0')} ${suffix}`;
  }
  return timeStr.replace(/am/i, 'AM').replace(/pm/i, 'PM');
}

function resolveEventTime(event: PromoterEvent) {
  if (event.time && event.time !== 'Time TBA') {
    return event.time
      .split('-')
      .map((t) => formatTimeStr(t))
      .join(' - ');
  }
  if (event.startTime) {
    return formatTimeStr(event.startTime);
  }
  if (event.startDate) {
    const date = new Date(event.startDate);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      })
        .format(date)
        .replace(/am/i, 'AM')
        .replace(/pm/i, 'PM');
    }
  }
  return 'Time TBA';
}

function LoadingCard() {
  return (
    <div className="relative overflow-hidden rounded-[30px] border border-white/5 bg-[linear-gradient(180deg,rgba(35,35,40,0.98),rgba(24,24,28,0.98))] p-3.5">
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-[linear-gradient(100deg,transparent,rgba(255,255,255,0.08),transparent)]" />
      <div className="relative space-y-4">
        <div className="aspect-[16/10] rounded-[24px] bg-white/[0.04]" />
        <div className="h-6 w-2/3 rounded-xl bg-white/[0.05]" />
        <div className="h-20 rounded-[20px] bg-white/[0.04]" />
        <div className="h-14 rounded-[20px] bg-white/[0.04]" />
      </div>
    </div>
  );
}

export default function PromoterEventsPage() {
  const { profile, user } = useDashboardAuth();
  const promoterId = profile?.activeMembership?.partnerId;
  const promoterName = profile?.displayName;

  const [events, setEvents] = useState<PromoterEvent[]>([]);
  const [myLinks, setMyLinks] = useState<PromoterLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [activeTab, setActiveTab] = useState<PromoterTab>('available');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [selectedEventIdForModal, setSelectedEventIdForModal] = useState<string | null>(null);
  const [editingLink, setEditingLink] = useState<PromoterLink | null>(null);
  const [authToken, setAuthToken] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPageData = useCallback(
    async (manualRefresh = false) => {
      if (!promoterId) return;
      if (manualRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const authToken = await user?.getIdToken();
        if (authToken) setAuthToken(authToken);
        const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
        const params = new URLSearchParams();
        if (selectedCity) params.set('city', selectedCity);

        const [eventsRes, linksRes] = await Promise.all([
          fetch(`/api/partners/promoters/events?${params.toString()}`, { headers }),
          fetch('/api/partners/promoters/links?limit=100', { headers }),
        ]);

        if (!eventsRes.ok || !linksRes.ok) {
          throw new Error('Failed to load promoter events');
        }

        const eventsData = await eventsRes.json();
        const linksData = await linksRes.json();
        setEvents(Array.isArray(eventsData.events) ? eventsData.events : []);
        setNextCursor(eventsData.discoverCursor || null);
        setMyLinks(Array.isArray(linksData.links) ? linksData.links : []);
        setFetchError(null);
        setRefreshedAt(new Date());
      } catch (error) {
        console.error('Failed to fetch promoter events:', error);
        setFetchError('Failed to load events. Please try again.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [promoterId, selectedCity, user],
  );

  const loadMore = useCallback(async () => {
    if (!promoterId || !nextCursor || loadingMore) return;
    setLoadingMore(true);

    try {
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
      const params = new URLSearchParams();
      if (selectedCity) params.set('city', selectedCity);
      params.set('cursor', nextCursor);

      const res = await fetch(`/api/partners/promoters/events?${params.toString()}`, { headers });
      if (!res.ok) throw new Error('Failed to load more events');

      const data = await res.json();
      if (Array.isArray(data.events)) {
        setEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const newEvents = data.events.filter((e: PromoterEvent) => !existingIds.has(e.id));
          return [...prev, ...newEvents];
        });
      }
      setNextCursor(data.discoverCursor || null);
    } catch (error) {
      console.error('Failed to load more events:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [promoterId, nextCursor, loadingMore, authToken, selectedCity]);

  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);

  const getActiveLink = useCallback(
    (eventId: string) => {
      return myLinks.find((link) => link.eventId === eventId && link.isActive);
    },
    [myLinks],
  );

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const cityLower = selectedCity.trim().toLowerCase();

    return events.filter((event) => {
      const hasLink = Boolean(getActiveLink(event.id));
      const matchesTab =
        activeTab === 'all' ||
        (activeTab === 'linked' && hasLink) ||
        (activeTab === 'available' && !hasLink);

      const matchesSearch =
        !query ||
        [event.title, event.venue, event.city, event.category]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      const matchesCity =
        !cityLower ||
        [event.city, event.venue, event.venueName, event.location]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(cityLower));

      return matchesTab && matchesSearch && matchesCity;
    });
  }, [activeTab, events, getActiveLink, searchQuery, selectedCity]);

  const counts = useMemo(() => {
    const linked = events.filter((event) => Boolean(getActiveLink(event.id))).length;
    return {
      all: events.length,
      linked,
      available: Math.max(events.length - linked, 0),
    };
  }, [events, getActiveLink]);

  const copyLink = async (link: PromoterLink) => {
    await navigator.clipboard.writeText(buildLinkUrl(link));
    setCopiedCode(link.code);
    window.setTimeout(() => setCopiedCode(null), 1500);
  };

  return (
    <VenuePageShell
      title="Events"
      actions={
        <button
          onClick={() => fetchPageData(true)}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-5 py-3 bg-surface-elevated border border-border-default hover:border-border-strong text-text-secondary text-sm font-semibold rounded-xl transition-all disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing || loading ? 'animate-spin' : ''}`} />
          {refreshedAt
            ? refreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
            : 'Refresh'}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 p-1 bg-surface-secondary rounded-xl w-fit overflow-x-auto max-w-full scrollbar-hide">
          {[
            { id: 'available', label: 'Discover', count: counts.available },
            { id: 'linked', label: 'Linked Events', count: counts.linked },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as PromoterTab)}
              className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-surface-elevated text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {tab.label}
              <span
                className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-black ${activeTab === tab.id ? 'bg-[var(--c1rcle-orange,#F44A22)] text-white' : 'bg-surface-tertiary text-text-secondary'}`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search events, venues, or categories"
              className="w-full rounded-2xl border border-border-subtle bg-surface-secondary py-3 pl-11 pr-4 text-sm text-text-primary outline-none transition-all placeholder:text-text-tertiary focus:border-border-strong"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedCity}
              onChange={(event) => setSelectedCity(event.target.value)}
              className="rounded-2xl border border-border-subtle bg-surface-secondary px-4 py-3 text-sm text-text-primary outline-none transition-all focus:border-border-strong"
            >
              <option value="">All Cities</option>
              {CITY_MAP.map((city) => (
                <option key={city.key} value={city.label.split(',')[0]}>
                  {city.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <LoadingCard key={item} />
          ))}
        </div>
      ) : fetchError ? (
        <ErrorState
          title="Failed to load events"
          message={fetchError}
          onRetry={() => fetchPageData()}
        />
      ) : filteredEvents.length === 0 ? (
        <div className="relative overflow-hidden rounded-[34px] border border-white/5 bg-[linear-gradient(180deg,rgba(34,34,38,0.98),rgba(21,21,25,0.98))] p-12 text-center shadow-[0_24px_80px_rgba(0,0,0,0.16)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.08),transparent_60%)]">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04]">
              <Calendar className="h-7 w-7 text-white/75" />
              <Sparkles className="absolute -right-2 -top-2 h-4 w-4 text-amber-300/80" />
            </div>
          </div>
          <h3 className="mb-2 text-xl font-black tracking-[-0.03em] text-text-primary">
            {activeTab === 'linked' ? 'No linked events yet' : 'No events available right now'}
          </h3>
          <p className="mx-auto max-w-sm text-sm leading-6 text-text-tertiary">
            {activeTab === 'linked'
              ? 'Head over to the Discover tab to find upcoming events, generate your links, and start earning commission.'
              : "Try changing your city or search query. We're always adding new events, so check back soon!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredEvents.map((event) => {
            const link = getActiveLink(event.id);
            const hasLink = Boolean(link);
            const dateParts = formatEventDate(event.startDate);
            const partnerLabel = event.creatorRole === 'host' ? 'Host' : 'Venue';
            const partnerValue =
              event.creatorRole === 'host'
                ? event.hostName || event.venue || 'Host'
                : event.venueName || event.venue || 'Venue';
            const eventTime = resolveEventTime(event);

            return (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative rounded-[24px] transition-transform duration-500 hover:-translate-y-1 bg-[#0A0A0C] border border-white/5 hover:border-emerald-500/30 overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.7)]"
              >
                {/* Glowing aura on hover */}
                <div className="absolute inset-0 rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 shadow-[inset_0_0_60px_rgba(16,185,129,0.05)]" />

                <div className="relative w-full aspect-[4/3] bg-surface-secondary">
                  {event.image ? (
                    <Image
                      src={event.image}
                      alt={event.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover transition-transform duration-[5000ms] group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-surface-secondary">
                      <Calendar className="h-8 w-8 text-text-tertiary" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0C] via-transparent to-transparent" />

                  <div className="absolute top-4 left-4 right-4 flex justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full bg-black/60 border border-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${hasLink ? 'bg-violet-400' : 'bg-emerald-400'}`}
                      />
                      {hasLink ? 'Link Active' : 'Ready to Promote'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-black/60 px-3 py-1.5 text-xs font-bold text-emerald-400 backdrop-blur-md">
                      {event.commissionRate
                        ? `Earn ${event.commissionRate}%/ticket`
                        : `0% commission`}
                    </span>
                  </div>
                </div>

                <div className="relative px-5 pb-5 pt-0 flex flex-col gap-4 z-10 bg-[#0A0A0C] -mt-2">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-2xl font-black text-white tracking-tight line-clamp-2">
                      {event.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-text-tertiary">
                      <MapPin className="w-4 h-4 text-emerald-400/80" />
                      <span className="text-sm font-medium">
                        {event.venueName || event.venue}
                        {event.city ? `, ${event.city}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-white/90 text-[15px] font-semibold py-1">
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-5 h-5 text-emerald-400/80" />
                      <span>{`${dateParts.weekday}, ${dateParts.day} ${dateParts.month}`}</span>
                    </div>
                    <div className="w-px h-5 bg-white/15" />
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-5 h-5 text-emerald-400/80" />
                      <span>{eventTime}</span>
                    </div>
                  </div>

                  {hasLink && link ? (
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => setEditingLink(link)}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 text-black font-bold text-[15px] flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                      >
                        View Stats
                      </button>
                      <button
                        onClick={() => copyLink(link)}
                        className="text-text-tertiary text-sm font-medium hover:text-white transition-colors text-center w-full"
                      >
                        {copiedCode === link.code ? 'Copied!' : 'Copy Link'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedEventIdForModal(event.id)}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 text-black font-bold text-[15px] flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                    >
                      <LinkIcon className="w-5 h-5" />
                      Get Promoter Link
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {nextCursor && !loading && !fetchError && filteredEvents.length > 0 && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 rounded-xl bg-surface-elevated border border-border-default hover:border-emerald-500/50 px-6 py-3 text-sm font-semibold text-text-primary transition-all disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
                Loading...
              </>
            ) : (
              'Load More Events'
            )}
          </button>
        </div>
      )}

      <AnimatePresence>
        {selectedEventIdForModal ? (
          <GenerateLinkModal
            promoterId={promoterId || ''}
            promoterName={promoterName}
            token={authToken}
            initialEventId={selectedEventIdForModal}
            lockEvent
            preloadedEvent={events.find((e) => e.id === selectedEventIdForModal)}
            onClose={() => setSelectedEventIdForModal(null)}
            onCreated={(link) => {
              setMyLinks((prev) => {
                const withoutEvent = prev.filter((item) => item.eventId !== link.eventId);
                return [link, ...withoutEvent];
              });
            }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        <AnalyticsDrawer
          linkId={editingLink?.id || null}
          token={authToken}
          onClose={() => setEditingLink(null)}
          onDeactivated={() => {}}
          onReactivated={() => {}}
        />
      </AnimatePresence>
    </VenuePageShell>
  );
}
