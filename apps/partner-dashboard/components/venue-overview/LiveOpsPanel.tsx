'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ChevronRight, Users, Ticket } from 'lucide-react';
import { formatINRCompact } from '@/lib/utils/format';
import { PermissionGate } from '@/components/shared/PermissionGate';
import type {
  OccupancySnapshot,
  TonightOpsData,
  LiveEventStatus,
  UpcomingEvent,
} from '@/lib/types/venueOverview';

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({
  liveStatus,
  checkedIn,
}: {
  liveStatus: LiveEventStatus;
  checkedIn?: number;
}) {
  if (liveStatus === 'no_event') {
    return (
      <div
        className="px-3 py-1.5 rounded-full text-[11px] font-semibold"
        style={{
          background: 'rgba(255,255,255,0.06)',
          color: 'var(--v-text-muted)',
        }}
      >
        No Event Tonight
      </div>
    );
  }
  if (liveStatus === 'connecting') {
    return (
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold"
        style={{
          background: 'rgba(245,158,11,0.08)',
          color: '#F59E0B',
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        Connecting…
      </div>
    );
  }
  if (liveStatus === 'degraded') {
    return (
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold"
        style={{
          background: 'rgba(245,158,11,0.08)',
          color: '#F59E0B',
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Delayed · 30s
      </div>
    );
  }
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold"
      style={{
        background: 'rgba(16,185,129,0.1)',
        color: '#34D399',
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      Live · {checkedIn ?? 0} In
    </div>
  );
}

// ── Occupancy ring ────────────────────────────────────────────────────────────

function OccupancyRing({ pct }: { pct: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = Math.min((pct / 100) * circ, circ);
  const color = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#34D399';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={70} height={70} className="-rotate-90">
        <circle cx={35} cy={35} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
        <motion.circle
          cx={35}
          cy={35}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <span
        className="absolute text-[14px] font-black tabular-nums"
        style={{ color: 'var(--v-text-primary)' }}
      >
        {pct}%
      </span>
    </div>
  );
}

// ── Scan velocity sparkline ───────────────────────────────────────────────────

function VelocitySparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((v, i) => (
        <motion.div
          key={i}
          className="flex-1 rounded-t"
          style={{
            background: i === data.length - 1 ? 'var(--v-success)' : 'rgba(52,211,153,0.2)',
          }}
          initial={{ height: 0 }}
          animate={{ height: `${(v / max) * 100}%` }}
          transition={{ delay: i * 0.025, duration: 0.35 }}
        />
      ))}
    </div>
  );
}

// ── Turnout bar ───────────────────────────────────────────────────────────────

function TurnoutBar({ checked, expected }: { checked: number; expected: number }) {
  const pct = expected > 0 ? Math.min((checked / expected) * 100, 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium" style={{ color: 'var(--v-text-secondary)' }}>
          Turnout Rate
        </span>
        <span
          className="text-[11px] font-bold tabular-nums"
          style={{ color: 'var(--v-text-primary)' }}
        >
          {checked} / {expected || '—'}
        </span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: 'var(--v-elevated)' }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'var(--v-success)' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// ── LiveOpsPanel ──────────────────────────────────────────────────────────────

interface LiveOpsPanelProps {
  todayEvent: UpcomingEvent | null;
  occupancy: OccupancySnapshot | null;
  velocity: number[];
  liveStatus: LiveEventStatus;
  /** Populated from polling fallback when onSnapshot is degraded */
  tonightOps: TonightOpsData | null;
}

/**
 * LiveOpsPanel
 *
 * Shows real-time door operations for tonight's event.
 * Occupancy comes from Firestore onSnapshot (sub-second updates).
 * Revenue + ticket count come from /tonight polling (30 s when snapshot active,
 * also 30 s when degraded).
 *
 * Revenue card is gated by VIEW_FINANCIALS — staff/security see dashes.
 */
export const LiveOpsPanel = memo(function LiveOpsPanel({
  todayEvent,
  occupancy,
  velocity,
  liveStatus,
  tonightOps,
}: LiveOpsPanelProps) {
  const checkedIn = occupancy?.checkedIn ?? tonightOps?.checkedIn ?? 0;
  const expected = tonightOps?.expected ?? todayEvent?.capacity ?? 0;
  const occupancyPct =
    occupancy?.occupancyPct ?? (expected > 0 ? Math.round((checkedIn / expected) * 100) : 0);
  const revenue = tonightOps?.revenue ?? 0;
  const ticketsSold = tonightOps?.ticketsSold ?? 0;
  const scansLastMin = velocity[velocity.length - 1] ?? 0;

  return (
    <div className="rounded-[32px] p-5 sm:p-6" style={{ background: 'var(--v-card)' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-3">
        <div>
          <h2 className="v-text-section" style={{ color: 'var(--v-text-primary)' }}>
            Live Operations
          </h2>
          <p
            className="text-[12px] mt-0.5 truncate max-w-[240px]"
            style={{ color: 'var(--v-text-tertiary)' }}
          >
            {todayEvent ? todayEvent.title : 'No event scheduled tonight'}
          </p>
        </div>
        <StatusBadge liveStatus={liveStatus} checkedIn={checkedIn} />
      </div>

      {/* No event state */}
      {!todayEvent ? (
        <div className="py-10 flex flex-col items-center gap-2 text-center">
          <Users className="w-8 h-8" style={{ color: 'var(--v-text-muted)' }} />
          <p className="text-[13px]" style={{ color: 'var(--v-text-tertiary)' }}>
            Your venue is quiet tonight
          </p>
        </div>
      ) : (
        /* Live grid */
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-start">
          {/* Occupancy ring + turnout bar */}
          <div className="flex flex-col items-center gap-3">
            <OccupancyRing pct={occupancyPct} />
            <TurnoutBar checked={checkedIn} expected={expected} />
          </div>

          {/* Revenue — VIEW_FINANCIALS gated */}
          <PermissionGate
            require="VIEW_FINANCIALS"
            fallback={
              <div className="flex flex-col justify-center gap-1">
                <p className="v-label text-[9px]">Live Revenue</p>
                <p className="text-[22px] font-black" style={{ color: 'var(--v-text-primary)' }}>
                  ₹ —
                </p>
                <p className="text-[10px]" style={{ color: 'var(--v-text-muted)' }}>
                  Restricted
                </p>
              </div>
            }
          >
            <div className="flex flex-col justify-center gap-1.5">
              <p className="v-label text-[9px]">Live Revenue</p>
              <p
                className="text-[22px] font-black tabular-nums"
                style={{ color: 'var(--v-text-primary)' }}
              >
                {formatINRCompact(revenue)}
              </p>
              <div className="flex items-center gap-1.5">
                <Ticket className="w-3 h-3" style={{ color: 'var(--v-text-muted)' }} />
                <p className="text-[10px]" style={{ color: 'var(--v-text-muted)' }}>
                  {ticketsSold} sold
                </p>
              </div>
            </div>
          </PermissionGate>

          {/* Scan velocity sparkline */}
          <div className="flex flex-col justify-center gap-2">
            <div className="flex items-center justify-between">
              <p className="v-label text-[9px]">Entry Velocity</p>
              <span
                className="text-[10px] font-bold tabular-nums"
                style={{ color: 'var(--v-text-secondary)' }}
              >
                {scansLastMin}/min
              </span>
            </div>
            <VelocitySparkline data={velocity} />
            <p className="text-[10px]" style={{ color: 'var(--v-text-muted)' }}>
              Last 15 minutes
            </p>
          </div>

          {/* Guest entry CTA */}
          <div className="flex items-stretch">
            <Link
              href="/venue/guest-ops/door"
              className="group w-full flex items-center justify-between p-4 rounded-2xl transition-all hover:brightness-110"
              style={{ background: 'var(--v-elevated)' }}
            >
              <div>
                <p className="v-label text-[9px] mb-0.5" style={{ color: 'var(--v-text-muted)' }}>
                  Control Panel
                </p>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--v-text-primary)' }}>
                  Guest Entry
                </p>
              </div>
              <ChevronRight
                className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                style={{ color: 'var(--v-text-tertiary)' }}
              />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
});
