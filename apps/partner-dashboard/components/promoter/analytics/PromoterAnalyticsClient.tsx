'use client';

import type { ReactNode } from 'react';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  MousePointerClick,
  IndianRupee,
  Ticket,
  BarChart3,
  RefreshCw,
  Copy,
  Check,
  Link2,
  PauseCircle,
  ShoppingBag,
  Clock3,
  ArrowRight,
  Activity,
  Target,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { VenuePageShell } from '@/components/venue-layout/VenuePageShell';

import { AnalyticsEmptyState } from './AnalyticsEmptyState';
import { KPICard } from './KPICard';
import { AnalyticsAreaChart, ChartMetric } from './AnalyticsAreaChart';
import { TopLinkRow } from './TopLinkRow';
import { ActivityRow } from './ActivityRow';

const GUEST_PORTAL_URL =
  process.env.NEXT_PUBLIC_GUEST_PORTAL_URL || process.env.NEXT_PUBLIC_SITE_URL || '';

const RANGES = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: 'ytd', label: 'YTD' },
  { value: 'all', label: 'All' },
] as const;

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatRelativeTime(value?: string | null) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';

  const diffMs = date.getTime() - Date.now();
  const minutes = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  const days = Math.round(hours / 24);
  return rtf.format(days, 'day');
}

export function PromoterAnalyticsClient() {
  const [range, setRange] = useState('30d');
  const [chartMetric, setChartMetric] = useState<ChartMetric>('revenue');
  const [selectedEventId, setSelectedEventId] = useState('');
  const { user, profile } = useDashboardAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const promoterId = profile?.activeMembership?.partnerId;
  const eventId = searchParams.get('eventId') || '';

  useEffect(() => {
    setSelectedEventId(eventId);
  }, [eventId]);

  const { data: eventsData } = useQuery({
    queryKey: ['promoter', 'analytics-events', promoterId],
    queryFn: async () => {
      const token = await user!.getIdToken();
      const res = await fetch('/api/partners/promoters/links?limit=200', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch links');
      return res.json();
    },
    enabled: !!user && !!promoterId,
    staleTime: 10 * 60 * 1000,
  });

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['promoter', 'analytics', range, promoterId, selectedEventId],
    queryFn: async () => {
      const token = await user!.getIdToken();
      const params = new URLSearchParams({ range });
      if (selectedEventId) params.set('eventId', selectedEventId);
      const res = await fetch(`/api/partners/promoters/analytics?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
    enabled: !!user && !!promoterId,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  });

  const overview = data?.overview || {};
  const timeline = data?.timeline || [];
  const topLinks = data?.topLinks || [];
  const activities = data?.activities || [];
  const eventOptions = useMemo(() => {
    const links = Array.isArray(eventsData?.links) ? eventsData.links : [];
    return links; // Presume backend returns ready-to-use options or links map directly to options
  }, [eventsData]);

  // Chart data points based on selected metric
  const chartData = useMemo(() => {
    return timeline.map((d: any) => ({
      date: d.date,
      value:
        chartMetric === 'revenue'
          ? d.revenue || 0
          : chartMetric === 'clicks'
            ? d.clicks || 0
            : d.sales || 0,
    }));
  }, [timeline, chartMetric]);
  const hasOverviewData =
    (overview.totalClicks || 0) > 0 ||
    (overview.ticketsSold || 0) > 0 ||
    (overview.commission || 0) > 0 ||
    parseFloat(String(overview.conversionRate || '0')) > 0;
  const hasTimelineData = chartData.some((point: { value: number }) => point.value > 0);
  const isEmptyState =
    !isLoading &&
    !hasOverviewData &&
    !hasTimelineData &&
    topLinks.length === 0 &&
    activities.length === 0;

  const mp = (d: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay: d, ease: [0.22, 1, 0.36, 1] },
  });

  const handleEventFilterChange = (nextEventId: string) => {
    setSelectedEventId(nextEventId);
    const params = new URLSearchParams(searchParams.toString());
    if (nextEventId) params.set('eventId', nextEventId);
    else params.delete('eventId');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <VenuePageShell title="Analytics">
      {/* Period selector */}
      <motion.div {...mp(0)} className="flex items-center justify-end flex-wrap gap-3 mb-1">
        <div className="flex items-center gap-2">
          <select
            value={selectedEventId}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
              handleEventFilterChange(event.target.value)
            }
            className="rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] outline-none"
            style={{
              background: 'var(--v-elevated)',
              border: '1px solid var(--v-border)',
              color: 'var(--v-text-primary)',
            }}
          >
            <option value="">All Events</option>
            {eventOptions.map((event: any) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
          <div
            className="flex items-center rounded-xl overflow-hidden"
            style={{ background: 'var(--v-elevated)', border: '1px solid var(--v-border)' }}
          >
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className="relative px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-colors"
                style={{
                  color: range === r.value ? 'var(--v-text-primary)' : 'var(--v-text-muted)',
                }}
              >
                {range === r.value && (
                  <motion.div
                    layoutId="analytics-range-bg"
                    className="absolute inset-0"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: 12,
                      boxShadow: '0 0 0 1px var(--v-border)',
                    }}
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                  />
                )}
                <span className="relative z-10">{r.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            disabled={isRefetching || isLoading}
            className="p-2.5 rounded-xl transition-colors disabled:opacity-50"
            style={{ background: 'var(--v-elevated)', border: '1px solid var(--v-border)' }}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`}
              style={{ color: 'var(--v-text-muted)' }}
            />
          </button>
        </div>
      </motion.div>

      {isEmptyState ? (
        <motion.div
          {...mp(0.02)}
          className="mb-4 overflow-hidden rounded-[28px]"
          style={{ position: 'relative' }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                'radial-gradient(ellipse at 18% -10%, rgba(244,74,34,0.18) 0%, transparent 52%), radial-gradient(ellipse at 100% 0%, rgba(59,130,246,0.15) 0%, transparent 48%)',
            }}
          />
          <div
            className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
            style={{
              background: 'rgba(14,14,16,0.95)',
              border: '1px solid rgba(244,74,34,0.14)',
              borderRadius: '28px',
            }}
          >
            <div className="max-w-2xl">
              <p
                className="text-[11px] font-black uppercase tracking-[0.22em]"
                style={{ color: '#fb923c' }}
              >
                Zero Data State
              </p>
              <h2 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">
                Your analytics will light up after your first shared link starts getting traffic.
              </h2>
              <p
                className="mt-2 text-[13px] font-medium leading-6"
                style={{ color: 'var(--v-text-muted)' }}
              >
                Clicks, ticket sales, conversion rate, and earnings will populate here as guests
                open your links and complete purchases.
              </p>
            </div>
            <Link
              href="/promoter/links"
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[12px] font-black uppercase tracking-[0.18em] transition-colors"
              style={{
                background: 'rgba(244,74,34,0.12)',
                color: '#fb923c',
                border: '1px solid rgba(244,74,34,0.22)',
              }}
            >
              Manage Links
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      ) : null}

      {/* KPI Cards */}
      <motion.div {...mp(0.04)} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          icon={<MousePointerClick className="w-4 h-4" />}
          label="Total Clicks"
          value={isLoading ? '—' : (overview.totalClicks || 0).toLocaleString('en-IN')}
          color="#3b82f6"
          loading={isLoading}
        />
        <KPICard
          icon={<Ticket className="w-4 h-4" />}
          label="Tickets Sold"
          value={isLoading ? '—' : (overview.ticketsSold || 0).toLocaleString('en-IN')}
          color="#8b5cf6"
          loading={isLoading}
        />
        <KPICard
          icon={<BarChart3 className="w-4 h-4" />}
          label="Conversion Rate"
          value={isLoading ? '—' : overview.conversionRate || '0.00%'}
          color="#f59e0b"
          loading={isLoading}
        />
        <KPICard
          icon={<IndianRupee className="w-4 h-4" />}
          label="Total Earnings"
          value={isLoading ? '—' : formatINR(overview.commission || 0)}
          color="#22c55e"
          accent
          loading={isLoading}
        />
      </motion.div>

      {/* Chart Panel — glassmorphism */}
      <motion.div {...mp(0.08)}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '2rem' }}>
          {/* Glow behind chart — color shifts with selected metric */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                chartMetric === 'revenue'
                  ? 'radial-gradient(ellipse at 50% -10%, rgba(34,197,94,0.18) 0%, transparent 60%)'
                  : chartMetric === 'clicks'
                    ? 'radial-gradient(ellipse at 50% -10%, rgba(59,130,246,0.18) 0%, transparent 60%)'
                    : 'radial-gradient(ellipse at 50% -10%, rgba(139,92,246,0.18) 0%, transparent 60%)',
            }}
          />
          <div
            className="p-5 sm:p-6"
            style={{
              position: 'relative',
              zIndex: 1,
              background: 'rgba(14,14,16,0.95)',
              border:
                chartMetric === 'revenue'
                  ? '1px solid rgba(34,197,94,0.2)'
                  : chartMetric === 'clicks'
                    ? '1px solid rgba(59,130,246,0.2)'
                    : '1px solid rgba(139,92,246,0.2)',
              borderRadius: '2rem',
            }}
          >
            {/* Chart header */}
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div
                className="flex items-center gap-1 rounded-xl overflow-hidden"
                style={{ background: 'var(--v-elevated)', border: '1px solid var(--v-border)' }}
              >
                {(['revenue', 'clicks', 'sales'] as ChartMetric[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setChartMetric(m)}
                    className="relative px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors"
                    style={{
                      color: chartMetric === m ? 'var(--v-text-primary)' : 'var(--v-text-muted)',
                    }}
                  >
                    {chartMetric === m && (
                      <motion.div
                        layoutId="chart-metric-bg"
                        className="absolute inset-0"
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          borderRadius: 12,
                          boxShadow: '0 0 0 1px var(--v-border)',
                        }}
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                      />
                    )}
                    <span className="relative z-10">{m}</span>
                  </button>
                ))}
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--v-text-muted)' }}
              >
                Date-wise breakdown
              </span>
            </div>

            {/* Chart */}
            {isLoading ? (
              <div
                className="h-[220px] rounded-2xl animate-pulse"
                style={{ background: 'var(--v-skeleton, rgba(255,255,255,0.04))' }}
              />
            ) : chartData.length === 0 ? (
              <AnalyticsEmptyState
                className="h-[220px]"
                icon={<BarChart3 className="h-5 w-5" />}
                title="No timeline data yet"
                description="Daily performance will appear here once your links start generating clicks or ticket sales."
                pills={['Clicks', 'Sales', 'Revenue']}
              />
            ) : (
              <AnalyticsAreaChart data={chartData} metric={chartMetric} />
            )}
          </div>
        </div>
      </motion.div>

      {/* Top Performing Links */}
      <motion.div
        {...mp(0.12)}
        className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)] gap-4"
      >
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '2rem' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                'radial-gradient(ellipse at 55% -15%, rgba(244,74,34,0.15) 0%, transparent 60%)',
            }}
          />
          <div
            className="p-5 sm:p-6"
            style={{
              position: 'relative',
              zIndex: 1,
              background: 'rgba(14,14,16,0.95)',
              border: '1px solid rgba(244,74,34,0.15)',
              borderRadius: '2rem',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2
                  className="text-[13px] font-black uppercase tracking-widest"
                  style={{ color: 'var(--v-text-secondary)' }}
                >
                  Top Performing Links
                </h2>
                <p
                  className="mt-1 text-[12px] font-medium"
                  style={{ color: 'var(--v-text-muted)' }}
                >
                  {overview.activeLinks || 0} active of {overview.totalLinks || 0} total links
                </p>
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--v-text-muted)' }}
              >
                By Clicks
              </span>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-14 rounded-2xl animate-pulse"
                    style={{ background: 'var(--v-skeleton, rgba(255,255,255,0.04))' }}
                  />
                ))}
              </div>
            ) : topLinks.length === 0 ? (
              <AnalyticsEmptyState
                icon={<Target className="h-5 w-5" />}
                title="No tracked links in this range"
                description="Create or reactivate a promoter link to compare which campaigns are driving the most traffic."
                pills={['Rankings', 'Clicks', 'Conversion']}
                ctaHref="/promoter/links"
                ctaLabel="Open Links"
              />
            ) : (
              <div className="flex flex-col">
                {topLinks.map((link: any, i: number) => (
                  <TopLinkRow key={link.id || i} link={link} rank={i + 1} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Activity panel — glassmorphism */}
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '2rem' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                'radial-gradient(ellipse at 50% -15%, rgba(59,130,246,0.14) 0%, transparent 60%)',
            }}
          />
          <div
            className="p-5 sm:p-6"
            style={{
              position: 'relative',
              zIndex: 1,
              background: 'rgba(14,14,16,0.95)',
              border: '1px solid rgba(59,130,246,0.15)',
              borderRadius: '2rem',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2
                  className="text-[13px] font-black uppercase tracking-widest"
                  style={{ color: 'var(--v-text-secondary)' }}
                >
                  Recent Activity
                </h2>
                <p
                  className="mt-1 text-[12px] font-medium"
                  style={{ color: 'var(--v-text-muted)' }}
                >
                  Latest promoter link activity from the backend
                </p>
              </div>
              <Clock3 className="w-4 h-4" style={{ color: 'var(--v-text-muted)' }} />
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-2xl animate-pulse"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <AnalyticsEmptyState
                icon={<Activity className="h-5 w-5" />}
                title="No recent activity yet"
                description="New clicks, purchases, and link updates will stream into this feed as your audience engages."
                pills={['Clicks', 'Purchases', 'Updates']}
              />
            ) : (
              <div className="flex flex-col gap-2">
                {activities.map((activity: any) => (
                  <ActivityRow key={activity.id} activity={activity} />
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </VenuePageShell>
  );
}
