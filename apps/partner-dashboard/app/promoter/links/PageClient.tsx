'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { VenuePageShell } from '@/components/venue-layout/VenuePageShell';
import { ErrorState } from '@/components/ui/ErrorState';
import GenerateLinkModal from '@/components/promoter/links/GenerateLinkModal';
import AnalyticsDrawer from '@/components/promoter/links/AnalyticsDrawer';

const GUEST_PORTAL_URL =
  process.env.NEXT_PUBLIC_GUEST_PORTAL_URL || process.env.NEXT_PUBLIC_SITE_URL || '';

type LinkStatus = 'all' | 'active' | 'deactivated' | 'expired';

type PromoLink = {
  id: string;
  eventId?: string | null;
  eventTitle?: string | null;
  eventSlug?: string | null;
  eventImage?: string | null;
  venueName?: string | null;
  city?: string | null;
  startDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  category?: string | null;
  campaignLabel?: string | null;
  label?: string | null;
  code?: string | null;
  shortCode?: string | null;
  channel?: string | null;
  status?: string | null;
  clicks?: number;
  clickCount?: number;
  conversions?: number;
  conversionCount?: number;
  commission?: number;
  clearedCommission?: number;
  commissionRate?: number;
  commissionType?: string | null;
  tierCommissions?: Record<string, { rate: number; type: 'percentage' | 'fixed' }> | null;
  fullUrl?: string | null;
};

function formatINR(paise: number) {
  if (!paise) return '₹0';
  const rupees = paise / 100;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`;
  return `₹${Math.round(rupees).toLocaleString('en-IN')}`;
}

function formatIndianDate(value?: string, options?: Intl.DateTimeFormatOptions) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    ...options,
  }).format(new Date(value));
}

function formatTimeRange(start?: string | null, end?: string | null) {
  const formatTime = (value?: string | null) => {
    if (!value) return '';
    const [rawHour = '0', rawMinute = '00'] = String(value).split(':');
    const hour = Number(rawHour);
    const minute = Number(rawMinute);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return value;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const normalizedHour = hour % 12 || 12;
    return `${normalizedHour}:${String(minute).padStart(2, '0')} ${suffix}`;
  };

  const formattedStart = formatTime(start);
  const formattedEnd = formatTime(end);
  return formattedStart && formattedEnd
    ? `${formattedStart} - ${formattedEnd}`
    : formattedStart || formattedEnd || 'Time TBA';
}

function getDateParts(date?: string | null) {
  if (!date) {
    return { day: '--', month: '---', weekday: 'Schedule pending', full: 'Date TBA' };
  }

  return {
    day: formatIndianDate(date, { day: '2-digit' }),
    month: formatIndianDate(date, { month: 'short' }).toUpperCase(),
    weekday: formatIndianDate(date, { weekday: 'long' }),
    full: formatIndianDate(date, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
  };
}

function getLinkUrl(link: PromoLink) {
  if (link.fullUrl) return link.fullUrl;
  const slug = link.eventSlug || link.eventId || '';
  const ref = link.code || link.shortCode || link.id;
  const channel = link.channel ? `&s=${encodeURIComponent(link.channel)}` : '';
  return `${GUEST_PORTAL_URL}/e/${slug}?ref=${encodeURIComponent(ref)}${channel}`;
}

function getStatusConfig(status?: string | null) {
  const normalized = status || 'active';
  const configs: Record<string, { label: string; dot: string; shell: string }> = {
    active: {
      label: 'Active',
      dot: 'bg-emerald-400',
      shell: 'bg-white/8 border border-white/10 text-white/90',
    },
    deactivated: {
      label: 'Off',
      dot: 'bg-zinc-400',
      shell: 'bg-white/8 border border-white/10 text-white/90',
    },
    expired: {
      label: 'Expired',
      dot: 'bg-rose-400',
      shell: 'bg-white/8 border border-white/10 text-white/90',
    },
  };

  return configs[normalized] || configs.active;
}

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: 'orange' | 'emerald' | 'violet' | 'sky';
}) {
  const accentClasses = {
    orange: 'bg-orange-50 text-orange-500',
    emerald: 'bg-emerald-50 text-emerald-500',
    violet: 'bg-violet-50 text-violet-500',
    sky: 'bg-sky-50 text-sky-500',
  };

  return (
    <div className="bg-surface-elevated border border-border-default rounded-2xl p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-text-tertiary">{label}</p>
          <p className="mt-1 text-3xl font-black text-text-primary">{value}</p>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${accentClasses[accent]}`}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
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

export default function PromoLinksPage() {
  const { profile, user } = useDashboardAuth();
  const promoterId = profile?.activeMembership?.partnerId;

  const [links, setLinks] = useState<PromoLink[]>([]);
  const [stats, setStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isError, setIsError] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<LinkStatus>('all');
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [token, setToken] = useState('');

  const fetchData = useCallback(
    async (isManualRefresh = false) => {
      if (!promoterId) return;
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setIsError(false);

      try {
        const nextToken = await user?.getIdToken();
        if (nextToken) setToken(nextToken);
        const headers: Record<string, string> = nextToken
          ? { Authorization: `Bearer ${nextToken}` }
          : {};

        const [linksRes, statsRes] = await Promise.all([
          fetch('/api/partners/promoters/links?limit=100', { headers }),
          fetch('/api/partners/promoters/stats', { headers }),
        ]);

        if (!linksRes.ok || !statsRes.ok) {
          throw new Error('Failed to fetch promoter links');
        }

        const linksData = await linksRes.json();
        const statsData = await statsRes.json();

        setLinks(Array.isArray(linksData.links) ? linksData.links : []);
        setStats(statsData || {});
        setRefreshedAt(new Date());
      } catch (error) {
        console.error('[PromoLinks] fetch error:', error);
        setIsError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [promoterId, user],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredLinks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return links.filter((link) => {
      const matchesSearch =
        !query ||
        [
          link.campaignLabel,
          link.label,
          link.code,
          link.eventTitle,
          link.venueName,
          link.city,
          link.channel,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      const linkStatus = (link.status || 'active') as LinkStatus;
      const matchesStatus = activeTab === 'all' || linkStatus === activeTab;
      return matchesSearch && matchesStatus;
    });
  }, [activeTab, links, searchQuery]);

  const counts = useMemo(() => {
    return links.reduce(
      (acc, link) => {
        const status = (link.status || 'active') as Exclude<LinkStatus, 'all'>;
        if (status === 'deactivated' || status === 'expired' || status === 'active') {
          acc[status] += 1;
        }
        acc.all += 1;
        return acc;
      },
      { all: 0, active: 0, deactivated: 0, expired: 0 },
    );
  }, [links]);

  const handleCopy = async (link: PromoLink, event?: React.MouseEvent) => {
    event?.stopPropagation();
    await navigator.clipboard.writeText(getLinkUrl(link));
    setCopiedId(link.id);
    window.setTimeout(() => setCopiedId(null), 1500);
  };

  const handleLinkCreated = (link: PromoLink) => {
    setLinks((prev) => {
      if (prev.some((item) => item.id === link.id)) return prev;
      return [link, ...prev];
    });
    fetchData();
  };

  const handleDeactivated = (linkId: string) => {
    setLinks((prev) =>
      prev.map((link) => (link.id === linkId ? { ...link, status: 'deactivated' } : link)),
    );
  };

  const handleReactivated = (linkId: string) => {
    setLinks((prev) =>
      prev.map((link) => (link.id === linkId ? { ...link, status: 'active' } : link)),
    );
    fetchData();
  };

  const kpiActiveLinks = stats.activeLinks ?? 0;
  const kpiClicks = stats.totalClicks ?? 0;
  const kpiSales = stats.totalSales ?? 0;
  const kpiEarnings = stats.totalEarnings ?? 0;

  return (
    <VenuePageShell
      title="Get Links"
      subtitle="Create trackable event links, keep an eye on conversion flow, and manage every active campaign from one place."
      actions={
        <>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-5 py-3 bg-surface-elevated border border-border-default hover:border-border-strong text-text-secondary text-sm font-semibold rounded-xl transition-all disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing || loading ? 'animate-spin' : ''}`} />
            {refreshedAt
              ? refreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
              : 'Refresh'}
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-[var(--c1rcle-orange,#F44A22)] text-white text-sm font-semibold rounded-xl transition-all hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            New Link
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active Links" value={kpiActiveLinks} icon={Link2} accent="orange" />
        <MetricCard
          label="Total Clicks"
          value={kpiClicks.toLocaleString()}
          icon={TrendingUp}
          accent="sky"
        />
        <MetricCard
          label="Sales"
          value={kpiSales.toLocaleString()}
          icon={CheckCircle2}
          accent="emerald"
        />
        <MetricCard
          label="Earnings"
          value={formatINR(kpiEarnings)}
          icon={Sparkles}
          accent="violet"
        />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 p-1 bg-surface-secondary rounded-xl w-fit overflow-x-auto max-w-full scrollbar-hide">
          {[
            { id: 'all', label: 'All', count: counts.all },
            { id: 'active', label: 'Active', count: counts.active },
            { id: 'deactivated', label: 'Off', count: counts.deactivated },
            { id: 'expired', label: 'Expired', count: counts.expired },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as LinkStatus)}
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

        <div className="flex flex-col gap-3 rounded-3xl border border-border-default bg-surface-elevated p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search by event, label, venue, or channel"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-2xl border border-border-subtle bg-surface-secondary py-3 pl-11 pr-4 text-sm text-text-primary outline-none transition-all placeholder:text-text-tertiary focus:border-border-strong"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-tertiary">
            <Clock3 className="h-4 w-4" />
            {loading
              ? 'Loading links'
              : `${filteredLinks.length} campaign${filteredLinks.length === 1 ? '' : 's'} visible`}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <LoadingCard key={item} />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to load links"
          message="We couldn't fetch your promoter links. Check your connection and try again."
          onRetry={() => fetchData()}
        />
      ) : filteredLinks.length === 0 ? (
        <div className="relative overflow-hidden rounded-[34px] border border-white/5 bg-[linear-gradient(180deg,rgba(34,34,38,0.98),rgba(21,21,25,0.98))] p-12 text-center shadow-[0_24px_80px_rgba(0,0,0,0.16)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.08),transparent_60%)]">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04]">
              <Link2 className="h-7 w-7 text-white/75" />
              <Sparkles className="absolute -right-2 -top-2 h-4 w-4 text-amber-300/80" />
            </div>
          </div>
          <h3 className="mb-2 text-xl font-black tracking-[-0.03em] text-text-primary">
            {searchQuery || activeTab !== 'all'
              ? 'No links match this view'
              : 'No links created yet'}
          </h3>
          <p className="mx-auto max-w-sm text-sm leading-6 text-text-tertiary">
            {searchQuery || activeTab !== 'all'
              ? 'Adjust your search or switch tabs to view other link campaigns.'
              : 'Generate your first promoter link and start tracking clicks, sales, and earnings by event.'}
          </p>
          {!searchQuery && activeTab === 'all' ? (
            <button
              onClick={() => setShowGenerateModal(true)}
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-text-primary transition hover:bg-white/[0.08]"
            >
              <Plus className="h-4 w-4" />
              Create new link
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredLinks.map((link) => {
            const statusConfig = getStatusConfig(link.status);
            const clicks = Number(link.clicks || link.clickCount || 0);
            const sales = Number(link.conversions || link.conversionCount || 0);
            const earnings = Number(link.commission || link.clearedCommission || 0);
            const dateParts = getDateParts(link.startDate);
            const timeRange = formatTimeRange(link.startTime, link.endTime);
            const displayLabel = link.campaignLabel || link.label || link.code || 'Untitled Link';
            const displayVenue =
              [link.venueName, link.city].filter(Boolean).join(', ') || 'Venue pending';

            return (
              <motion.div
                key={link.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative rounded-[30px] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1"
              >
                {link.eventImage ? (
                  <div
                    className="pointer-events-none absolute -inset-[10px] rounded-[38px] opacity-75 blur-3xl saturate-[1.6]"
                    style={{
                      backgroundImage: `url(${link.eventImage})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                ) : (
                  <div className="pointer-events-none absolute -inset-[10px] rounded-[38px] bg-[radial-gradient(circle_at_center,rgba(203,132,255,0.34),transparent_62%)] blur-3xl opacity-100" />
                )}

                <div className="relative overflow-hidden rounded-[30px] border border-white/[0.04] bg-[linear-gradient(180deg,rgba(38,38,42,0.98),rgba(24,24,28,0.98))] p-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.3),0_24px_80px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.06)]">
                  {link.eventImage ? (
                    <div
                      className="pointer-events-none absolute inset-0 rounded-[30px] opacity-95"
                      style={{
                        backgroundImage: `url(${link.eventImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'saturate(1.7) brightness(1.2)',
                      }}
                    />
                  ) : (
                    <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[linear-gradient(180deg,rgba(244,196,255,0.98),rgba(214,144,255,0.94))] opacity-100 shadow-[0_0_22px_rgba(210,138,255,0.75),0_0_48px_rgba(182,97,255,0.42)]" />
                  )}
                  <div className="pointer-events-none absolute inset-[2px] rounded-[28px] bg-[linear-gradient(180deg,rgba(38,38,42,0.985),rgba(24,24,28,0.985))]" />
                  {link.eventImage ? (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]">
                      <img
                        src={link.eventImage}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-[0.15] blur-[72px] saturate-150"
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,18,20,0.58)_0%,rgba(18,18,20,0.88)_46%,rgba(18,18,20,0.98)_100%)]" />
                    </div>
                  ) : null}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.09),transparent_70%)]" />

                  <div className="relative flex h-full flex-col">
                    <div className="relative overflow-hidden rounded-[24px] bg-black/30">
                      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${statusConfig.shell}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
                          {statusConfig.label}
                        </span>
                      </div>

                      <div className="pointer-events-none absolute right-3 top-3 z-10">
                        <button
                          type="button"
                          onClick={() => setSelectedLinkId(link.id)}
                          className="pointer-events-auto inline-flex h-9 items-center gap-2 overflow-hidden rounded-full border border-white/10 bg-black/35 px-2.5 text-xs font-bold text-white/90 backdrop-blur-md transition-all duration-300 hover:w-[118px] hover:bg-black/50"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span className="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 group-hover:max-w-[82px]">
                            Analytics
                          </span>
                        </button>
                      </div>

                      <div className="aspect-[16/10] w-full">
                        {link.eventImage ? (
                          <img
                            src={link.eventImage}
                            alt={link.eventTitle || 'Event image'}
                            className="h-full w-full object-cover transition-transform duration-[6000ms] ease-out group-hover:scale-[1.06]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-surface-secondary">
                            <Calendar className="h-8 w-8 text-text-tertiary" />
                          </div>
                        )}
                      </div>
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center_80%,transparent_40%,rgba(0,0,0,0.95)_100%)]" />
                      <div className="absolute inset-x-4 bottom-4">
                        <div className="text-[24px] font-black leading-[1.05] text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.6)] line-clamp-2">
                          {link.eventTitle || 'Untitled Event'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3.5 flex flex-1 flex-col">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-[20px] font-black tracking-[-0.03em] text-text-primary">
                            {displayLabel}
                          </p>
                          <p className="text-[11px] font-medium text-text-tertiary">
                            {displayVenue}
                          </p>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-text-tertiary">
                          {link.category || 'Event'}
                        </div>
                      </div>

                      <div className="rounded-[22px] bg-black/18 p-4">
                        <div className="grid grid-cols-[auto_1px_minmax(0,1fr)] items-center gap-4">
                          <div className="min-w-[64px] text-center">
                            <div className="text-[52px] font-black leading-none text-text-primary">
                              {dateParts.day}
                            </div>
                            <div className="mt-1 text-[11px] font-black uppercase tracking-[0.3em] text-text-tertiary">
                              {dateParts.month}
                            </div>
                          </div>
                          <div className="h-14 w-px bg-white/10" />
                          <div className="min-w-0">
                            <div className="text-[25px] font-black leading-tight text-text-primary">
                              {timeRange}
                            </div>
                            <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.24em] text-text-tertiary">
                              {dateParts.weekday}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4">
                          <div className="relative h-1 rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
                              style={{ width: '100%' }}
                            />
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-950/90 px-2 py-0.5 text-[11px] font-medium text-text-tertiary">
                              {link.tierCommissions && Object.keys(link.tierCommissions).length > 0
                                ? 'Varying commission'
                                : link.commissionRate !== undefined && link.commissionRate !== null
                                  ? link.commissionType === 'fixed' ||
                                    link.commissionType === 'flat'
                                    ? `₹${link.commissionRate} commission`
                                    : `${link.commissionRate}% commission`
                                  : 'Tracked link'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="rounded-2xl bg-white/[0.04] px-4 py-3">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                            Clicks
                          </div>
                          <div className="mt-1 text-lg font-black text-text-primary">
                            {clicks.toLocaleString()}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/[0.04] px-4 py-3">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                            Sales
                          </div>
                          <div className="mt-1 text-lg font-black text-text-primary">
                            {sales.toLocaleString()}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/[0.04] px-4 py-3">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                            Earned
                          </div>
                          <div className="mt-1 text-lg font-black text-emerald-300">
                            {formatINR(earnings)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3.5 flex gap-2">
                        <button
                          onClick={(event) => handleCopy(link, event)}
                          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-500/95 px-4 py-3 text-white shadow-[0_0_24px_rgba(16,185,129,0.3)] transition duration-300 hover:scale-[1.02] hover:bg-emerald-500 active:scale-[0.97]"
                        >
                          {copiedId === link.id ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                          <div className="text-sm font-black">
                            {copiedId === link.id ? 'Copied' : 'Copy Link'}
                          </div>
                        </button>
                        <button
                          onClick={() => setSelectedLinkId(link.id)}
                          className="flex items-center justify-center gap-2 rounded-full border border-white/12 px-4 py-3 text-text-secondary transition duration-300 hover:bg-white/8 hover:text-text-primary active:scale-[0.97]"
                        >
                          <TrendingUp className="h-4 w-4" />
                          <div className="text-sm font-black">Details</div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showGenerateModal && (
          <GenerateLinkModal
            promoterId={promoterId || ''}
            promoterName={profile?.displayName}
            token={token}
            onClose={() => setShowGenerateModal(false)}
            onCreated={(link) => {
              handleLinkCreated(link);
              setShowGenerateModal(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnalyticsDrawer
        linkId={selectedLinkId}
        token={token}
        onClose={() => setSelectedLinkId(null)}
        onDeactivated={handleDeactivated}
        onReactivated={handleReactivated}
      />
    </VenuePageShell>
  );
}
