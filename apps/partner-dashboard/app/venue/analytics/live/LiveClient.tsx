'use client';

/**
 * THE C1RCLE — Live Event Dashboard
 *
 * Polls the analytics overview endpoint every 30 seconds.
 * When an event with status "live" is detected in eventScorecards,
 * switches from idle state to the live operations view.
 *
 * Shows: headcount · entry velocity · revenue ticker · capacity
 *        scan outcomes · peak entry hour · no-show alert
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio,
  Users,
  TrendingUp,
  Zap,
  Shield,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  DollarSign,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import StudioShell from '@/components/studio/StudioShell';
import { normalizeAnalyticsV2 } from '@/lib/analytics/zeroState';
import type { AnalyticsV2 } from '@/lib/analytics/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000;

// ── Formatters ────────────────────────────────────────────────────────────────

const cur = (v: number) => {
  if (v >= 10_00_000) return `₹${(v / 10_00_000).toFixed(2)}Cr`;
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(1)}K`;
  return `₹${v.toLocaleString('en-IN')}`;
};
const pct = (v: number) => `${v.toFixed(1)}%`;
const num = (v: number) => v.toLocaleString('en-IN');

// ── Sub-components ─────────────────────────────────────────────────────────────

function LivePulse() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
      </span>
      <span className="text-[11px] font-black uppercase tracking-widest text-red-500">Live</span>
    </span>
  );
}

function BigStat({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-3xl border p-6 flex flex-col gap-2"
      style={{ background: 'var(--v-elevated)', borderColor: 'var(--v-border)' }}
    >
      <div className="flex items-center justify-between">
        <p
          className="text-[10px] font-black uppercase tracking-widest"
          style={{ color: 'var(--v-text-muted)' }}
        >
          {label}
        </p>
        {icon && (
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--v-neutral-bg)' }}
          >
            {icon}
          </div>
        )}
      </div>
      <p
        className="text-[38px] font-black tabular-nums leading-none"
        style={{ color: color || 'var(--v-text-primary)' }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[11px] font-medium" style={{ color: 'var(--v-text-tertiary)' }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function ScanOutcomeRow({
  label,
  count,
  color,
  icon,
}: {
  label: string;
  count: number;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3.5 rounded-2xl"
      style={{ background: color + '12', border: `1px solid ${color}28` }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: color + '20' }}
        >
          {icon}
        </div>
        <span className="text-[13px] font-semibold" style={{ color: 'var(--v-text-secondary)' }}>
          {label}
        </span>
      </div>
      <span className="text-[20px] font-black tabular-nums" style={{ color }}>
        {num(count)}
      </span>
    </div>
  );
}

function CapacityBar({ sold, scanned, total }: { sold: number; scanned: number; total: number }) {
  const soldPct = total > 0 ? Math.min(100, (sold / total) * 100) : 0;
  const scannedPct = total > 0 ? Math.min(100, (scanned / total) * 100) : 0;
  return (
    <div
      className="rounded-3xl border p-6"
      style={{ background: 'var(--v-elevated)', borderColor: 'var(--v-border)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <p
          className="text-[10px] font-black uppercase tracking-widest"
          style={{ color: 'var(--v-text-muted)' }}
        >
          Capacity
        </p>
        <span className="text-[13px] font-black" style={{ color: 'var(--v-text-secondary)' }}>
          {num(total)} total
        </span>
      </div>
      {/* Stacked bar */}
      <div
        className="relative h-4 rounded-full overflow-hidden"
        style={{ background: 'var(--v-border)' }}
      >
        {/* Sold (background layer) */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: 'var(--v-chart-2)', opacity: 0.4 }}
          initial={{ width: 0 }}
          animate={{ width: `${soldPct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
        {/* Scanned in (foreground layer) */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: 'var(--v-success)' }}
          initial={{ width: 0 }}
          animate={{ width: `${scannedPct}%` }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--v-success)' }} />
            <span className="text-[11px] font-medium" style={{ color: 'var(--v-text-tertiary)' }}>
              {num(scanned)} in ({pct(scannedPct)})
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full opacity-50"
              style={{ background: 'var(--v-chart-2)' }}
            />
            <span className="text-[11px] font-medium" style={{ color: 'var(--v-text-tertiary)' }}>
              {num(sold)} sold ({pct(soldPct)})
            </span>
          </div>
        </div>
        <span className="text-[11px] font-bold" style={{ color: 'var(--v-text-tertiary)' }}>
          {num(total - sold)} remaining
        </span>
      </div>
    </div>
  );
}

// ── Idle state ─────────────────────────────────────────────────────────────────

function IdleState({
  countdown,
  onRefresh,
  isRefreshing,
}: {
  countdown: number;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="relative mb-8">
        <div
          className="absolute inset-0 rounded-full blur-3xl opacity-20"
          style={{ background: 'var(--v-orange)', transform: 'scale(1.5)' }}
        />
        <div
          className="relative w-24 h-24 rounded-full flex items-center justify-center"
          style={{ background: 'var(--v-neutral-bg)', border: '1px solid var(--v-border)' }}
        >
          <Radio className="w-10 h-10" style={{ color: 'var(--v-text-muted)' }} />
        </div>
      </div>
      <h2 className="text-[24px] font-black mb-3" style={{ color: 'var(--v-text-primary)' }}>
        No live event right now
      </h2>
      <p
        className="text-[14px] max-w-sm leading-relaxed mb-8"
        style={{ color: 'var(--v-text-tertiary)' }}
      >
        This dashboard activates automatically when an event starts. Entry counts, revenue, and scan
        data update in real time.
      </p>
      <div className="flex items-center gap-4">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:bg-[var(--v-neutral-bg)] disabled:opacity-50"
          style={{ border: '1px solid var(--v-border)', color: 'var(--v-text-secondary)' }}
        >
          {isRefreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Refresh
        </button>
        <span className="text-[12px] font-medium" style={{ color: 'var(--v-text-muted)' }}>
          Auto-refresh in {countdown}s
        </span>
      </div>
    </div>
  );
}

// ── Live state ─────────────────────────────────────────────────────────────────

function LiveState({
  data,
  eventName,
  countdown,
  onRefresh,
  isRefreshing,
}: {
  data: AnalyticsV2;
  eventName: string;
  countdown: number;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const ops = data.doorOps;
  const ex = data.executive;
  const cy = data.capacityYield;

  const velocityColor =
    ops.peakEntryVelocity > 5
      ? 'var(--v-success)'
      : ops.peakEntryVelocity > 1
        ? 'var(--v-warning)'
        : 'var(--v-text-tertiary)';

  return (
    <div className="space-y-6">
      {/* Live header */}
      <div
        className="flex items-center justify-between px-5 py-4 rounded-2xl"
        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
      >
        <div className="flex items-center gap-4">
          <LivePulse />
          <div>
            <p className="text-[15px] font-black" style={{ color: 'var(--v-text-primary)' }}>
              {eventName}
            </p>
            <p
              className="text-[11px] mt-0.5 font-medium"
              style={{ color: 'var(--v-text-tertiary)' }}
            >
              Event in progress
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium" style={{ color: 'var(--v-text-muted)' }}>
            Refreshes in {countdown}s
          </span>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all hover:bg-[var(--v-neutral-bg)] disabled:opacity-50"
            style={{ border: '1px solid var(--v-border)', color: 'var(--v-text-tertiary)' }}
          >
            {isRefreshing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Now
          </button>
        </div>
      </div>

      {/* Hero stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <BigStat
          label="Inside right now"
          value={num(ops.successfulScans)}
          sub={`of ${num(cy.totalCapacity)} capacity`}
          color="var(--v-success)"
          icon={<Users className="w-4 h-4" style={{ color: 'var(--v-success)' }} />}
        />
        <BigStat
          label="Entry velocity"
          value={ops.peakEntryVelocity > 0 ? `${ops.peakEntryVelocity.toFixed(1)}/min` : '—'}
          sub="Guests per minute at peak"
          color={velocityColor}
          icon={<Zap className="w-4 h-4" style={{ color: velocityColor }} />}
        />
        <BigStat
          label="Gross revenue"
          value={ex.grossRevenue.formatted}
          sub="Total collected tonight"
          color="var(--v-orange)"
          icon={<DollarSign className="w-4 h-4" style={{ color: 'var(--v-orange)' }} />}
        />
        <BigStat
          label="Scan success rate"
          value={pct(ops.scanSuccessRate)}
          sub={`${num(ops.rejectedScans)} denied · ${num(ops.duplicateScans)} duplicate`}
          color={ops.scanSuccessRate >= 95 ? 'var(--v-success)' : 'var(--v-warning)'}
          icon={
            <Shield
              className="w-4 h-4"
              style={{ color: ops.scanSuccessRate >= 95 ? 'var(--v-success)' : 'var(--v-warning)' }}
            />
          }
        />
      </div>

      {/* Capacity bar */}
      <CapacityBar sold={cy.soldCapacity} scanned={cy.scannedCapacity} total={cy.totalCapacity} />

      {/* Scan outcomes + timing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          className="rounded-3xl border p-6 space-y-2.5"
          style={{ background: 'var(--v-elevated)', borderColor: 'var(--v-border)' }}
        >
          <p
            className="text-[10px] font-black uppercase tracking-widest mb-4"
            style={{ color: 'var(--v-text-muted)' }}
          >
            Scan outcomes
          </p>
          <ScanOutcomeRow
            label="Successful entries"
            count={ops.successfulScans}
            color="var(--v-success)"
            icon={<CheckCircle className="w-3.5 h-3.5" style={{ color: 'var(--v-success)' }} />}
          />
          <ScanOutcomeRow
            label="Rejected"
            count={ops.rejectedScans}
            color="var(--v-error)"
            icon={<XCircle className="w-3.5 h-3.5" style={{ color: 'var(--v-error)' }} />}
          />
          <ScanOutcomeRow
            label="Duplicate attempts"
            count={ops.duplicateScans}
            color="var(--v-warning)"
            icon={<AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--v-warning)' }} />}
          />
          <ScanOutcomeRow
            label="Manual overrides"
            count={ops.manualOverrides}
            color="var(--v-chart-3)"
            icon={<Shield className="w-3.5 h-3.5" style={{ color: 'var(--v-chart-3)' }} />}
          />
        </div>

        <div
          className="rounded-3xl border p-6"
          style={{ background: 'var(--v-elevated)', borderColor: 'var(--v-border)' }}
        >
          <p
            className="text-[10px] font-black uppercase tracking-widest mb-4"
            style={{ color: 'var(--v-text-muted)' }}
          >
            Operations
          </p>
          {[
            {
              label: 'Peak entry hour',
              value: ops.peakEntryHour != null ? `${ops.peakEntryHour}:00` : '—',
              icon: <Clock className="w-3.5 h-3.5" />,
            },
            {
              label: 'Avg processing time',
              value:
                ops.avgProcessingTimeSeconds > 0
                  ? `${ops.avgProcessingTimeSeconds.toFixed(1)}s`
                  : '—',
              icon: <Activity className="w-3.5 h-3.5" />,
            },
            {
              label: 'Re-entry count',
              value: num(ops.reEntryCount),
              icon: <ArrowUpRight className="w-3.5 h-3.5" />,
            },
            {
              label: 'Optimal staffing window',
              value: ops.optimalStaffingWindow || '—',
              icon: <Users className="w-3.5 h-3.5" />,
            },
            {
              label: 'Friction score',
              value: ops.frictionScore > 0 ? `${ops.frictionScore}/100` : '—',
              icon: <TrendingUp className="w-3.5 h-3.5" />,
            },
            {
              label: 'Late arrivals',
              value: ops.lateArrivalPct > 0 ? pct(ops.lateArrivalPct) : '—',
              icon: <Clock className="w-3.5 h-3.5" />,
            },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between py-3 border-b"
              style={{ borderColor: 'var(--v-divider)' }}
            >
              <div className="flex items-center gap-2.5">
                <span style={{ color: 'var(--v-text-muted)' }}>{row.icon}</span>
                <span
                  className="text-[12px] font-medium"
                  style={{ color: 'var(--v-text-secondary)' }}
                >
                  {row.label}
                </span>
              </div>
              <span
                className="text-[13px] font-bold tabular-nums"
                style={{ color: 'var(--v-text-primary)' }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* No-show alert */}
      {ex.noShowRate.raw > 20 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-5 py-4 rounded-2xl"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: 'var(--v-warning)' }} />
          <p className="text-[13px] font-medium" style={{ color: 'var(--v-text-secondary)' }}>
            No-show rate is {pct(ex.noShowRate.raw)} — consider a waitlist release or a push
            notification to guestlist signups.
          </p>
        </motion.div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function LiveClient() {
  const { user, profile } = useDashboardAuth();
  const [data, setData] = useState<AnalyticsV2 | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(POLL_INTERVAL_MS / 1000);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(
    async (silent = false) => {
      const venueId = profile?.activeMembership?.partnerId;
      if (!venueId || !user) return;
      if (!silent) setIsLoading(true);
      else setIsRefreshing(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch(
          `/api/partners/venues/analytics/overview?venueId=${venueId}&range=1d`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const payload = await res.json();
          setData(normalizeAnalyticsV2((payload as any)?.analytics ?? payload));
        }
      } catch {
        // keep stale data on error
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setCountdown(POLL_INTERVAL_MS / 1000);
      }
    },
    [profile, user],
  );

  // WebSocket: push-based updates when check-ins happen on the live event
  const liveEventId = data?.eventScorecards.find((e) => e.status === 'live')?.id ?? null;
  useWebSocket({
    topics: liveEventId ? [`event:${liveEventId}`] : [],
    getToken: async () => (user ? user.getIdToken() : null),
    enabled: Boolean(liveEventId),
    onMessage: (msg) => {
      if (msg.type === 'TICKET_CHECKED_IN' || msg.type === 'ORDER_CONFIRMED') {
        fetchData(true);
      }
    },
  });

  // Initial fetch + polling loop (30s fallback when WS is down)
  useEffect(() => {
    fetchData();
    timerRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countRef.current) clearInterval(countRef.current);
    };
  }, [fetchData]);

  // Countdown display
  useEffect(() => {
    countRef.current = setInterval(
      () => setCountdown((c) => (c <= 1 ? POLL_INTERVAL_MS / 1000 : c - 1)),
      1000,
    );
    return () => {
      if (countRef.current) clearInterval(countRef.current);
    };
  }, []);

  // Detect live event
  const liveEvent = data?.eventScorecards.find((e) => e.status === 'live');
  const isLive = Boolean(liveEvent);

  return (
    <StudioShell
      role="venue"
      title="Live Operations"
      subtitle="Real-time view of your event in progress."
      sections={[]}
    >
      <div className="pb-20">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: 'var(--v-orange)' }} />
            <p
              className="text-[12px] font-bold uppercase tracking-widest"
              style={{ color: 'var(--v-text-muted)' }}
            >
              Connecting…
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {isLive && data ? (
              <motion.div
                key="live"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                <LiveState
                  data={data}
                  eventName={liveEvent!.title}
                  countdown={countdown}
                  onRefresh={() => fetchData(true)}
                  isRefreshing={isRefreshing}
                />
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                <IdleState
                  countdown={countdown}
                  onRefresh={() => fetchData(true)}
                  isRefreshing={isRefreshing}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </StudioShell>
  );
}
