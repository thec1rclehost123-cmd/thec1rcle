'use client';

import { useCallback, useState, useMemo } from 'react';
import {
  Activity,
  BarChart3,
  Building2,
  Copy,
  DoorOpen,
  Edit3,
  ExternalLink,
  GitCompare,
  ImageIcon,
  Info,
  MapPin,
  RefreshCw,
  Ticket,
  TrendingUp,
  Users,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { useQuery } from '@tanstack/react-query';
import { normalizeAnalyticsV2 } from '@/lib/analytics/zeroState';
import { mapEventForClient } from '@c1rcle/core/events';
import { parseAsIST } from '@c1rcle/core/time';
import { formatDatetime, formatNumber, formatPercent } from '@/lib/utils/format';
import { cn } from '@/lib/utils';

import {
  SummarySection,
  FunnelSection,
  RevenueSection,
  CrowdSection,
  DoorSection,
  CompareSection,
} from './sections';

type DateRange = { from: Date; to: Date } | undefined;
function subDays(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 86_400_000);
}

// ── Local helpers (mirrors PageClient design tokens) ─────────────────────────

function humanizeLabel(value: string) {
  if (value === 'door' || value === 'manual') return 'Walk-in';
  return String(value || '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusPill({ status }: { status: string }) {
  const normalized = String(status || 'draft')
    .toLowerCase()
    .replace(/\s+/g, '_');
  const tone =
    normalized.includes('live') ||
    normalized.includes('on_sale') ||
    normalized.includes('checked_in')
      ? 'emerald'
      : normalized.includes('pending') || normalized.includes('submitted')
        ? 'amber'
        : normalized.includes('cancel') ||
            normalized.includes('denied') ||
            normalized.includes('disabled')
          ? 'rose'
          : normalized.includes('hidden') || normalized.includes('sold_out')
            ? 'slate'
            : 'indigo';

  const palette: Record<string, string> = {
    emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    rose: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
    slate: 'border-white/10 bg-white/[0.05] text-[var(--v-text-secondary)]',
    indigo: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300',
  };

  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em]',
        palette[tone],
      )}
    >
      {humanizeLabel(status)}
    </span>
  );
}

function HeaderStatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-[22px] bg-white/[0.045] p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white">{label}</p>
        <Icon className="h-4 w-4 text-[var(--v-orange)]" />
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight text-[var(--v-text-primary)]">
        {value}
      </p>
    </div>
  );
}

function MetaItem({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 text-[var(--v-orange)]" />
      <span>{label}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EventAnalyticsClient({
  role,
  idParam,
  eventId,
  embedded = false,
}: {
  role: 'venue' | 'host';
  idParam: string;
  eventId: string;
  embedded?: boolean;
}) {
  const { profile, user } = useDashboardAuth();
  const entityId = profile?.activeMembership?.partnerId;
  const useComputedEventAnalytics = role === 'venue' && Boolean(eventId);

  const [rangeDays, setRangeDays] = useState<number>(30);
  const [activeTab, setActiveTab] = useState<string>('summary');
  const [copied, setCopied] = useState(false);
  const range: DateRange = {
    from: subDays(new Date(), rangeDays),
    to: new Date(),
  };

  // 1. Fetch event details for the card header
  const {
    data: eventDetails,
    isLoading: isEventLoading,
    refetch: refetchEventDetails,
    isFetching: isFetchingEventDetails,
  } = useQuery({
    queryKey: [role, 'events', entityId, eventId, 'details'],
    queryFn: async () => {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/${role}/events?${idParam}=${entityId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const { events } = await res.json();
      const rawEvent = events.find((e: any) => e.id === eventId);
      if (!rawEvent) return null;
      const mapped = mapEventForClient(rawEvent, rawEvent.id) as any;
      return {
        title: mapped.title || mapped.name || 'Untitled Event',
        date: parseAsIST(mapped.startDate || mapped.date),
        status: mapped.lifecycle || mapped.status || 'draft',
        venue: mapped.venue || rawEvent.venue || '',
        city: mapped.city || rawEvent.city || '',
        hostName: mapped.hostName || rawEvent.hostName || null,
        eventUrl: mapped.eventUrl || rawEvent.eventUrl || '',
        coverImage:
          mapped.coverImage || mapped.image || rawEvent.coverImage || rawEvent.image || null,
        creatorRole: mapped.creatorRole || rawEvent.creatorRole || null,
        eventType: mapped.eventType || rawEvent.eventType || null,
      };
    },
    enabled: !!entityId && !!user,
  });

  const isHostManagedEvent =
    String(eventDetails?.creatorRole || eventDetails?.eventType || '').toLowerCase() === 'host';

  // 2. Fetch analytics strictly scoped to this event
  const {
    data: analyticsData,
    isLoading: isAnalyticsLoading,
    isError,
    refetch: refetchAnalytics,
    isFetching: isFetchingAnalytics,
  } = useQuery({
    queryKey: [role, 'analytics', 'event', entityId, eventId, rangeDays],
    queryFn: async () => {
      const token = await user?.getIdToken();
      const headers: Record<string, string> = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(entityId ? { 'x-partner-id': entityId, 'x-venue-id': entityId } : {}),
      };

      if (useComputedEventAnalytics && eventId) {
        const res = await fetch(`/api/partners/venues/events/${eventId}/computed-analytics`, {
          headers,
        });
        if (!res.ok) throw new Error('Failed to load event analytics');
        return res.json();
      }

      const url = `/api/${role}/analytics/overview?${idParam}=${entityId}&eventId=${eventId}`;
      const r = await fetch(url, { headers });
      if (!r.ok) throw new Error('Failed to load analytics');
      return r.json();
    },
    enabled: !!entityId && !!user,
  });

  const normalizedPayload =
    analyticsData && typeof analyticsData === 'object' && 'analytics' in analyticsData
      ? ((analyticsData as { analytics?: Record<string, unknown> }).analytics ?? null)
      : analyticsData;
  const data = normalizeAnalyticsV2(
    normalizedPayload as Record<string, unknown> | null | undefined,
  );
  const isLoading = isEventLoading || isAnalyticsLoading;
  const isRefreshing = isFetchingEventDetails || isFetchingAnalytics;

  // Derive header KPIs from analytics data
  const pageViews =
    data.conversionFunnel.stages.find((s: any) => s.name === 'Page Views')?.count ?? 0;
  const conversionPct = data.conversionFunnel.viewToPurchase;

  const handleRefresh = () => {
    void Promise.all([refetchEventDetails(), refetchAnalytics()]);
  };

  const handleCopyLink = useCallback(async () => {
    if (!eventDetails?.eventUrl) return;
    try {
      await navigator.clipboard.writeText(eventDetails.eventUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [eventDetails?.eventUrl]);

  // ── Range picker (shown below card for standalone mode) ──────────────────
  const rangePicker = (
    <div
      className="flex items-center gap-1 p-1 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {[
        { id: 7, label: '7 Days' },
        { id: 30, label: '30 Days' },
        { id: 1000, label: 'All Time' },
      ].map((r) => {
        const active = rangeDays === r.id;
        return (
          <button
            key={r.id}
            onClick={() => setRangeDays(r.id)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
            style={{
              background: active ? 'var(--v-orange)' : 'transparent',
              color: active ? '#FFF' : 'var(--v-text-secondary)',
              boxShadow: active ? '0 2px 12px rgba(244,74,34,0.4)' : 'none',
            }}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );

  // ── Embedded toolbar (used when this component is embedded in PageClient) ─
  const embeddedToolbar = embedded ? (
    <div className="flex items-center justify-between gap-3 flex-wrap rounded-[24px] border border-border-default bg-[var(--v-card)] px-5 py-4">
      <div>
        <p
          className="text-[11px] font-black uppercase tracking-[0.16em]"
          style={{ color: 'var(--v-text-secondary)' }}
        >
          Event Analytics
        </p>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--v-text-muted)' }}>
          Click refresh to pull the latest event metrics.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-bold transition-all disabled:opacity-50"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            color: 'var(--v-text-primary)',
          }}
        >
          <RefreshCw className={`w-3.5 h-3.5${isRefreshing ? ' animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
    </div>
  ) : null;

  // ── Standalone event card header (matches PageClient event card design) ───
  const eventCard = !embedded ? (
    <section
      className="overflow-hidden rounded-[32px] border border-border-default"
      style={{ background: '#000000', boxShadow: '0 22px 80px rgba(0,0,0,0.28)' }}
    >
      <div className="grid gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Poster */}
        <div className="relative min-h-[280px] bg-[#000000]">
          {eventDetails?.coverImage ? (
            <img
              src={eventDetails.coverImage}
              alt={eventDetails.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full min-h-[280px] items-center justify-center bg-[linear-gradient(135deg,rgba(244,74,34,0.2),rgba(52,211,153,0.08))]">
              <div className="flex flex-col items-center gap-3 text-center text-[var(--v-text-secondary)]">
                <ImageIcon className="h-10 w-10" />
                <span className="text-[12px] font-semibold uppercase tracking-[0.16em]">
                  No Poster Available
                </span>
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(7,8,10,0.72)] via-transparent to-transparent" />
        </div>

        {/* Event info */}
        <div className="relative flex flex-col gap-5 p-5 sm:p-6">
          {/* Status / date / action buttons row */}
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.16em]">
                {eventDetails?.status && <StatusPill status={eventDetails.status} />}
                <span className="text-[14px] font-semibold tracking-[0.12em] text-white">
                  {eventDetails?.date ? formatDatetime(eventDetails.date) : 'Date TBD'}
                </span>
              </div>

              <h1 className="mt-3 text-2xl font-black leading-none tracking-tight text-white uppercase sm:text-3xl">
                {eventDetails?.title || (isEventLoading ? 'Loading…' : 'Event Analytics')}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3 xl:max-w-[320px] xl:justify-end">
              {role === 'venue' && isHostManagedEvent ? null : (
                <Link
                  href={`/${role}/create?id=${eventId}`}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border border-white/12 bg-white/[0.02] px-5 py-3 text-[14px] font-semibold text-[var(--v-text-primary)] transition-all hover:border-white/18 hover:bg-white/[0.05]"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </Link>
              )}
              {eventDetails?.eventUrl && (
                <a
                  href={eventDetails.eventUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border border-white/12 bg-white/[0.02] px-5 py-3 text-[14px] font-semibold text-[var(--v-text-primary)] transition-all hover:border-white/18 hover:bg-white/[0.05]"
                >
                  <ExternalLink className="h-4 w-4" />
                  View
                </a>
              )}
            </div>
          </div>

          {/* 3 KPI boxes */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <HeaderStatCard
              label="Tickets Sold"
              value={isAnalyticsLoading ? '—' : data.executive.ticketsSold.formatted}
              icon={Ticket}
            />
            <HeaderStatCard
              label="Page Visits"
              value={isAnalyticsLoading ? '—' : formatNumber(pageViews)}
              icon={Eye}
            />
            <HeaderStatCard
              label="Conversions"
              value={isAnalyticsLoading ? '—' : formatPercent(conversionPct / 100, 1)}
              icon={TrendingUp}
            />
          </div>

          {/* Meta tags */}
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-[var(--v-text-secondary)]">
            {eventDetails?.venue && <MetaItem icon={Building2} label={eventDetails.venue} />}
            {eventDetails?.city && <MetaItem icon={MapPin} label={eventDetails.city} />}
            {eventDetails?.hostName && (
              <MetaItem icon={Users} label={`Host: ${eventDetails.hostName}`} />
            )}
          </div>

          {/* Shareable URL bar */}
          {eventDetails?.eventUrl && (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[20px] border border-white/10 bg-black px-3 py-3 sm:px-4">
              <div className="flex h-14 min-w-0 items-center overflow-hidden rounded-[16px] border border-white/10 bg-white/[0.02] px-5">
                <p className="truncate text-[15px] font-medium leading-none tracking-[-0.02em] text-[var(--v-text-primary)] sm:text-[16px]">
                  {eventDetails.eventUrl}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={eventDetails.eventUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.14] text-[var(--v-text-primary)] transition-colors hover:bg-white/[0.22]"
                  aria-label="Open guest event link"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.14] text-[var(--v-text-primary)] transition-colors hover:bg-white/[0.22]"
                  aria-label="Copy guest event link"
                >
                  {copied ? (
                    <span className="text-[10px] font-bold text-emerald-400">✓</span>
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  ) : null;

  // ── Tab definitions ──────────────────────────────────────────────────────
  const tabs = useMemo(
    () => [
      { id: 'summary', label: 'Summary', Icon: BarChart3 },
      { id: 'funnel', label: 'Funnel', Icon: TrendingUp },
      { id: 'revenue', label: 'Revenue', Icon: Activity },
      { id: 'crowd', label: 'Crowd', Icon: Users },
      { id: 'door', label: 'Door', Icon: DoorOpen },
      { id: 'compare', label: 'Compare', Icon: GitCompare },
    ],
    [],
  );

  return (
    <div
      style={{
        minHeight: embedded ? undefined : '100vh',
        background: embedded ? 'transparent' : 'var(--v-canvas, #111113)',
      }}
    >
      <main className={embedded ? 'pt-0' : 'px-6 py-8'}>
        <div className={embedded ? 'space-y-4' : 'max-w-7xl mx-auto space-y-6'}>
          {/* Event card header */}
          {eventCard}

          {/* Embedded refresh toolbar */}
          {embeddedToolbar}

          {/* Info / error banners */}
          {!embedded && isError && (
            <div
              className="flex items-center gap-3 px-5 py-3 rounded-2xl border"
              style={{ background: 'var(--v-error-bg)', borderColor: 'var(--v-error)' }}
            >
              <RefreshCw className="w-4 h-4" style={{ color: 'var(--v-error)' }} />
              <p className="text-[13px]" style={{ color: 'var(--v-error)' }}>
                Could not load event analytics data. Showing last-known values.
              </p>
            </div>
          )}

          {/* ── Tab bar + optional range picker row ─────────────────────── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Scrollable tab pill strip */}
            <div
              role="tablist"
              aria-label="Analytics sections"
              className="flex items-center gap-1 overflow-x-auto rounded-2xl p-1 scrollbar-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {tabs.map(({ id, label, Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-5 py-2 text-[12px] font-bold transition-all',
                      active
                        ? 'text-white'
                        : 'text-[var(--v-text-secondary)] hover:bg-white/[0.06] hover:text-white',
                    )}
                    style={{
                      background: active ? 'var(--v-orange)' : undefined,
                      boxShadow: active ? '0 2px 12px rgba(244,74,34,0.35)' : 'none',
                      whiteSpace: 'nowrap',
                      minWidth: '90px',
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Right side: info hint OR range picker */}
            {!embedded && !isLoading && !data.hasData ? (
              <p className="flex items-center gap-1.5 text-[12px] text-amber-200/60 shrink-0">
                <Info className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                No analytics recorded yet for this event — metrics will populate after tickets are
                sold or guests arrive.
              </p>
            ) : (
              !embedded && !useComputedEventAnalytics && rangePicker
            )}
          </div>

          {/* ── Active section ───────────────────────────────────────────── */}
          {activeTab === 'summary' && (
            <SummarySection data={data} loading={isLoading} hideTitle={embedded} />
          )}
          {activeTab === 'funnel' && <FunnelSection data={data} loading={isLoading} />}
          {activeTab === 'revenue' && <RevenueSection data={data} loading={isLoading} />}
          {activeTab === 'crowd' && <CrowdSection data={data} loading={isLoading} />}
          {activeTab === 'door' && <DoorSection data={data} loading={isLoading} />}
          {activeTab === 'compare' && <CompareSection data={data} loading={isLoading} />}
        </div>
      </main>
    </div>
  );
}
