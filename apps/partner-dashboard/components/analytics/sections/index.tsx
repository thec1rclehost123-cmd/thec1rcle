'use client';

/**
 * THE C1RCLE — Analytics Sections v4 (Visual Overhaul)
 *
 * Bold, bright, large-format analytics. Every section is designed for
 * instant readability on a dark dashboard — big numbers, vivid colors,
 * generous spacing, and clear visual hierarchy.
 *
 * 1. SummarySection  → "How did this event do?"
 * 2. FunnelSection   → "Where am I losing people?"
 * 3. RevenueSection  → "Where's the money?"
 * 4. CrowdSection    → "Who showed up?" — gender split with avg age, age bands
 * 5. DoorSection     → "How did the night run?"
 * 6. CompareSection  → "How does this stack up?"
 */

import { useState, lazy, Suspense } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Users,
  Ticket,
  BarChart3,
  Target,
  ArrowDownRight,
  Zap,
  Shield,
  Clock,
  UserCheck,
  UserX,
  Repeat2,
  Star,
  Crown,
} from 'lucide-react';
import type { AnalyticsV2, MetricCell } from '@/lib/analytics/types';
import { ChartSkeleton } from '@/components/ui/VenueChart';
import { formatINRCompact, formatNumberCompact } from '@/lib/utils/format';

// ── Lazy chart loaders ──────────────────────────────────────────────────────

const LazyDonut = lazy(() =>
  (import('recharts') as any).then((m: any) => ({
    default: function DonutChart({
      data,
      colors,
      size = 220,
    }: {
      data: { name: string; value: number }[];
      colors: string[];
      size?: number;
    }) {
      const { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } = m;
      return (
        <ResponsiveContainer width="100%" height={size}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={size * 0.28}
              outerRadius={size * 0.42}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
              cornerRadius={4}
            >
              {data.map((_: any, i: number) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#18181b',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                padding: '10px 16px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      );
    },
  })),
);

const LazyBar = lazy(() =>
  (import('recharts') as any).then((m: any) => ({
    default: function BarChart({
      data,
      xKey,
      yKey,
      color,
      height,
    }: {
      data: any[];
      xKey: string;
      yKey: string;
      color: string;
      height: number;
    }) {
      const { BarChart: BC, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } = m;
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BC data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="rgba(128,128,128,0.06)" vertical={false} />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11, fill: '#71717A', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#71717A', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: '#18181b',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                padding: '10px 16px',
              }}
            />
            <Bar dataKey={yKey} fill={color} radius={[6, 6, 0, 0]} maxBarSize={36} />
          </BC>
        </ResponsiveContainer>
      );
    },
  })),
);

const LazyArea = lazy(() =>
  (import('recharts') as any).then((m: any) => ({
    default: function AreaChart({
      data,
      xKey,
      yKey,
      color,
      height,
    }: {
      data: any[];
      xKey: string;
      yKey: string;
      color: string;
      height: number;
    }) {
      const { AreaChart: AC, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } = m;
      const Defs = 'defs' as any;
      const LG = 'linearGradient' as any;
      const Stop = 'stop' as any;
      return (
        <ResponsiveContainer width="100%" height={height}>
          <AC data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <Defs>
              <LG id={`grad-${yKey}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <Stop offset="100%" stopColor={color} stopOpacity={0} />
              </LG>
            </Defs>
            <CartesianGrid stroke="rgba(128,128,128,0.06)" vertical={false} />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11, fill: '#71717A', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#71717A', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: '#18181b',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                padding: '10px 16px',
              }}
            />
            <Area
              type="monotone"
              dataKey={yKey}
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#grad-${yKey})`}
            />
          </AC>
        </ResponsiveContainer>
      );
    },
  })),
);

// ── Shared helpers ──────────────────────────────────────────────────────────

function SectionTitle({
  title,
  description,
  icon: Icon,
  accent = '#F44A22',
}: {
  title: string;
  description: string;
  icon?: any;
  accent?: string;
}) {
  return (
    <div className="mb-8 relative">
      {/* Top accent line */}
      <div
        className="h-px w-full mb-6"
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}40, transparent)` }}
      />

      <div className="flex items-center gap-4 mb-3">
        {Icon && (
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: `${accent}18`,
              border: `1px solid ${accent}25`,
              boxShadow: `0 0 20px ${accent}15`,
            }}
          >
            <Icon className="w-5 h-5" style={{ color: accent }} />
          </div>
        )}
        <h2
          className="text-[26px] sm:text-[30px] font-black tracking-tight"
          style={{ color: 'var(--v-text-primary)' }}
        >
          {title}
        </h2>
      </div>
      <p className="text-[14px] font-medium pl-1" style={{ color: 'rgba(255,255,255,0.38)' }}>
        {description}
      </p>
    </div>
  );
}

function HeroMetric({
  label,
  metric,
  prefix,
  suffix,
  accentColor,
  icon: Icon,
}: {
  label: string;
  metric: MetricCell;
  prefix?: string;
  suffix?: string;
  accentColor?: string;
  icon?: any;
}) {
  const TrendIcon =
    metric.trendDir === 'up' ? TrendingUp : metric.trendDir === 'down' ? TrendingDown : Minus;
  const trendColor = metric.isPositiveGood
    ? metric.trendDir === 'up'
      ? '#34D399'
      : metric.trendDir === 'down'
        ? '#F87171'
        : '#71717A'
    : metric.trendDir === 'up'
      ? '#F87171'
      : metric.trendDir === 'down'
        ? '#34D399'
        : '#71717A';
  const trendBg = metric.isPositiveGood
    ? metric.trendDir === 'up'
      ? 'rgba(52,211,153,0.12)'
      : metric.trendDir === 'down'
        ? 'rgba(248,113,113,0.12)'
        : 'rgba(113,113,122,0.12)'
    : metric.trendDir === 'up'
      ? 'rgba(248,113,113,0.12)'
      : metric.trendDir === 'down'
        ? 'rgba(52,211,153,0.12)'
        : 'rgba(113,113,122,0.12)';

  return (
    <div
      className="rounded-2xl p-5 sm:p-6 flex flex-col gap-3 relative overflow-visible group"
      style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
    >
      {metric.tooltip && (
        <div className="absolute left-1/2 -top-2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-30 whitespace-nowrap">
          <div
            className="px-3 py-2 rounded-xl text-[11px] font-bold max-w-xs"
            style={{
              background: '#18181b',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--v-text-primary)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            }}
          >
            {metric.tooltip}
          </div>
          <div
            className="w-2 h-2 mx-auto -mt-1 rotate-45"
            style={{
              background: '#18181b',
              borderRight: '1px solid rgba(255,255,255,0.1)',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}
          />
        </div>
      )}
      {/* Accent glow */}
      {accentColor && (
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
          <div
            className="absolute top-0 right-0 w-32 h-32 opacity-[0.07] rounded-full"
            style={{
              background: accentColor,
              filter: 'blur(40px)',
              transform: 'translate(30%, -30%)',
            }}
          />
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `${accentColor || 'var(--v-orange)'}20` }}
            >
              <Icon className="w-4 h-4" style={{ color: accentColor || 'var(--v-orange)' }} />
            </div>
          )}
          <span
            className="text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.12em]"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            {label}
          </span>
        </div>
        {metric.deltaPct !== 0 && (
          <span
            className="flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-full"
            style={{ color: trendColor, background: trendBg }}
          >
            <TrendIcon className="w-3.5 h-3.5" />
            {metric.deltaPct > 0 ? '+' : ''}
            {metric.deltaPct.toFixed(1)}%
          </span>
        )}
      </div>
      <span
        className="text-[36px] sm:text-[42px] font-black tabular-nums leading-none tracking-tight"
        style={{ color: 'var(--v-text-primary)' }}
      >
        {prefix}
        {metric.formatted}
        {suffix}
      </span>
    </div>
  );
}

function Ring({
  value,
  label,
  color,
  size = 110,
}: {
  value: number;
  label: string;
  color: string;
  size?: number;
}) {
  const S = 8;
  const R = (size - S) / 2;
  const C = 2 * Math.PI * R;
  const pct = Math.min(value / 100, 1);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: 'rotate(-90deg)' }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={S}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={S}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C - pct * C}
            style={{
              transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: `drop-shadow(0 0 6px ${color}60)`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[20px] font-black tabular-nums" style={{ color }}>
            {value.toFixed(1)}%
          </span>
        </div>
      </div>
      <span
        className="text-[11px] font-bold uppercase tracking-[0.14em]"
        style={{ color: 'rgba(255,255,255,0.45)' }}
      >
        {label}
      </span>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      className="flex items-center justify-between py-3 px-4 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <span className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {label}
      </span>
      <span
        className="text-[16px] font-black tabular-nums"
        style={{ color: color || 'var(--v-text-primary)' }}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div
      className="flex items-center justify-center py-12 rounded-2xl"
      style={{ background: 'rgba(255,255,255,0.02)', border: '2px dashed rgba(255,255,255,0.06)' }}
    >
      <p
        className="text-[13px] font-semibold uppercase tracking-widest text-center"
        style={{ color: 'rgba(255,255,255,0.2)' }}
      >
        {text}
      </p>
    </div>
  );
}

function HBar({
  value,
  max,
  color,
  height = 10,
}: {
  value: number;
  max: number;
  color: string;
  height?: number;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div
      className="rounded-full overflow-hidden flex-1"
      style={{ height, background: 'rgba(255,255,255,0.06)' }}
    >
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{
          width: `${pct}%`,
          background: color,
          boxShadow: pct > 5 ? `0 0 8px ${color}40` : 'none',
        }}
      />
    </div>
  );
}

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-6 sm:p-7 ${className || ''}`}
      style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
    >
      {children}
    </div>
  );
}

function CardLabel({ children }: { children: string }) {
  return (
    <span
      className="text-[11px] font-bold uppercase tracking-[0.14em] block mb-4"
      style={{ color: 'rgba(255,255,255,0.4)' }}
    >
      {children}
    </span>
  );
}

type SectionProps = { data: AnalyticsV2; loading: boolean; hideTitle?: boolean };

// ═══════════════════════════════════════════════════════════════════════════
// 1. SUMMARY — "How did this event do?"
// ═══════════════════════════════════════════════════════════════════════════

export function SummarySection({ data, loading, hideTitle = false }: SectionProps) {
  const ex = data.executive;

  if (loading) {
    return (
      <div>
        {!hideTitle && (
          <SectionTitle title="Summary" description="" icon={BarChart3} accent="#F44A22" />
        )}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-2xl p-6 animate-pulse"
              style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
            >
              <div className="h-3 w-20 rounded bg-white/5 mb-3" />
              <div className="h-10 w-28 rounded bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Derive tickets per day from revenue series + avg ticket price
  const avgPrice = ex.avgTicketPrice.raw || 1;
  const ticketsByDay = data.revenueIntelligence.series.revenueByDay.map((d) => ({
    date: d.date,
    tickets: avgPrice > 0 ? Math.round(d.gross / avgPrice) : 0,
  }));

  return (
    <div>
      {!hideTitle && (
        <SectionTitle title="Summary" description="" icon={BarChart3} accent="#F44A22" />
      )}

      {/* Hero KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <HeroMetric
          label="Gross Revenue"
          metric={ex.grossRevenue}
          icon={DollarSign}
          accentColor="#F44A22"
        />
        <HeroMetric
          label="Tickets Sold"
          metric={ex.ticketsSold}
          icon={Ticket}
          accentColor="#818CF8"
        />
        <HeroMetric
          label="Check-ins"
          metric={ex.confirmedCheckins}
          icon={UserCheck}
          accentColor="#34D399"
        />
        <HeroMetric
          label="Avg Ticket Price"
          metric={ex.avgTicketPrice}
          icon={Target}
          accentColor="#FBBF24"
        />
      </div>

      {/* Performance rings + Tickets per day side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <SectionCard>
          <CardLabel>Performance Rings</CardLabel>
          <div className="flex items-center justify-center gap-8 sm:gap-12 py-4">
            <Ring value={ex.occupancyRate.raw} label="Fill Rate" color="#818CF8" />
            <Ring value={data.conversionFunnel.viewToPurchase} label="Conversion" color="#F44A22" />
            <Ring value={ex.sellThroughRate.raw} label="Sell-through" color="#34D399" />
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex items-center justify-between mb-4">
            <CardLabel>Daily Ticket Sales</CardLabel>
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(129,140,248,0.12)', color: '#818CF8' }}
            >
              Est. from avg price
            </span>
          </div>
          {ticketsByDay.some((d) => d.tickets > 0) ? (
            <Suspense fallback={<ChartSkeleton height={180} />}>
              <LazyBar
                data={ticketsByDay}
                xKey="date"
                yKey="tickets"
                color="#818CF8"
                height={180}
              />
            </Suspense>
          ) : (
            <EmptyHint text="Ticket sales chart populates after first sale" />
          )}
        </SectionCard>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatPill
          label="No-show Rate"
          value={`${ex.noShowRate.raw.toFixed(1)}%`}
          color={ex.noShowRate.raw > 15 ? '#F87171' : '#34D399'}
        />
        <StatPill
          label="Refund Rate"
          value={`${ex.refundRate.raw.toFixed(1)}%`}
          color={ex.refundRate.raw > 5 ? '#F87171' : '#34D399'}
        />
        <StatPill
          label="Repeat Guests"
          value={`${ex.repeatGuestRate.raw.toFixed(1)}%`}
          color="#818CF8"
        />
        <StatPill
          label="Rev / Attendee"
          value={ex.avgRevenuePerAttendee.formatted}
          color="#FBBF24"
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. FUNNEL — "Where am I losing people?"
// ═══════════════════════════════════════════════════════════════════════════

const FUNNEL_COLORS = [
  '#F44A22', // orange — impressions
  '#818CF8', // indigo — page views
  '#A78BFA', // violet — interested
  '#FBBF24', // amber — checkout
  '#34D399', // emerald — purchase
  '#22D3EE', // cyan — check-in
];

const FUNNEL_LABELS: Record<string, string> = {
  Impressions: 'Impressions',
  'Page Views': 'Page Views',
  'Guestlist Starts': 'Interested',
  'Ticket Starts': 'Checkout Started',
  Purchases: 'Ticket Bought',
  'Arrived & Checked In': 'Checked In',
};

export function FunnelSection({ data, loading }: SectionProps) {
  const stages = data.conversionFunnel.stages;
  const maxCount = Math.max(...stages.map((s) => s.count), 1);
  const cf = data.conversionFunnel;

  if (loading) {
    return (
      <div>
        <SectionTitle title="Conversion Funnel" description="" icon={Target} accent="#A78BFA" />

        <div
          className="rounded-2xl p-8 animate-pulse"
          style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
        >
          <div className="space-y-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-white/5" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle title="Conversion Funnel" description="" icon={Target} accent="#A78BFA" />

      {/* Quick conversion stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'View → Purchase', value: cf.viewToPurchase, color: '#F44A22' },
          { label: 'Checkout Abandon', value: cf.checkoutAbandonRate, color: '#F87171' },
          { label: 'Purchase → Arrival', value: cf.purchaseToArrival, color: '#34D399' },
          { label: 'Guestlist → Arrival', value: cf.guestlistToArrival, color: '#818CF8' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl p-5"
            style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
          >
            <div
              className="text-[11px] font-bold uppercase tracking-[0.12em] mb-2"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              {s.label}
            </div>
            <div
              className="text-[32px] font-black tabular-nums leading-none"
              style={{ color: s.color }}
            >
              {s.value.toFixed(1)}
              <span className="text-[18px]">%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Funnel steps */}
      <SectionCard>
        <CardLabel>Funnel Stages</CardLabel>
        <div className="flex flex-col gap-1.5 max-w-4xl mx-auto">
          {stages.map((step, i) => {
            // barPct intentionally unused — HBar handles its own width calculation
            const color = FUNNEL_COLORS[i % FUNNEL_COLORS.length];
            const displayName = FUNNEL_LABELS[step.name] ?? step.name;

            return (
              <div key={step.name}>
                {/* Drop indicator */}
                {i > 0 && step.dropPct > 0 && (
                  <div className="flex items-center gap-2.5 py-1.5 pl-8">
                    <ArrowDownRight className="w-4 h-4" style={{ color: '#F87171' }} />
                    <span
                      className="text-[12px] font-bold tabular-nums"
                      style={{ color: '#F87171' }}
                    >
                      {data.hasData ? `${step.dropPct.toFixed(0)}% drop` : '0% drop'}
                    </span>
                  </div>
                )}

                {/* Step row */}
                <div
                  className="flex items-center gap-4 sm:gap-6 px-5 py-4 rounded-xl transition-colors"
                  style={{ background: `${color}08`, borderLeft: `4px solid ${color}` }}
                >
                  <span
                    className="text-[12px] sm:text-[13px] font-bold uppercase tracking-[0.10em] w-36 sm:w-44 shrink-0"
                    style={{ color }}
                  >
                    {displayName}
                  </span>
                  <div className="flex-1">
                    <HBar value={step.count} max={maxCount} color={color} height={12} />
                  </div>
                  <span
                    className="text-[22px] sm:text-[26px] font-black tabular-nums w-20 text-right"
                    style={{ color: 'var(--v-text-primary)' }}
                  >
                    {step.count > 0 ? step.count.toLocaleString() : '0'}
                  </span>
                </div>
              </div>
            );
          })}

          {!data.hasData && (
            <EmptyHint text="Funnel populates after discovery & booking activity begins" />
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. REVENUE — "Where's the money?"
// ═══════════════════════════════════════════════════════════════════════════

export function RevenueSection({ data, loading }: SectionProps) {
  const ri = data.revenueIntelligence;
  const fin = data.finance;
  const bd = ri.breakdown;

  const breakdownRows = [
    { label: 'Gross Ticket Revenue', value: bd.grossTicketRevenue, color: '#F44A22' },
    { label: 'Net Ticket Revenue', value: bd.netTicketRevenue, color: '#34D399' },
    { label: 'Platform Fee', value: bd.platformFee, color: '#FBBF24' },
    { label: 'Refund Value', value: bd.refundValue, color: '#F87171' },
    { label: 'Discount Value', value: bd.discountValue, color: '#818CF8' },
  ];
  const maxBd = Math.max(...breakdownRows.map((r) => r.value), 1);

  const payoutTotal = fin.pendingPayout + fin.completedPayout;
  const payoutPct = payoutTotal > 0 ? (fin.completedPayout / payoutTotal) * 100 : 0;

  // Ticket type revenue
  const ticketTypeRevenue = ri.series.revenueByTicketType.filter((t) => t.revenue > 0);
  const maxTicketRev = Math.max(...ticketTypeRevenue.map((t) => t.revenue), 1);

  if (loading) {
    return (
      <div>
        <SectionTitle title="Revenue" description="" icon={DollarSign} accent="#34D399" />

        <div
          className="rounded-2xl p-8 animate-pulse"
          style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
        >
          <div className="h-64 rounded-xl bg-white/5" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle title="Revenue" description="" icon={DollarSign} accent="#34D399" />

      {/* Revenue chart — full width */}
      <SectionCard className="mb-6">
        <CardLabel>Revenue Over Time</CardLabel>
        <Suspense fallback={<ChartSkeleton height={280} />}>
          <LazyArea
            data={ri.series.revenueByDay.map((d) => ({ date: d.date, revenue: d.gross }))}
            xKey="date"
            yKey="revenue"
            color="#F44A22"
            height={280}
          />
        </Suspense>
        {!data.hasData && <EmptyHint text="Revenue chart populates after your first ticket sale" />}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        {/* Revenue breakdown */}
        <SectionCard>
          <CardLabel>Breakdown</CardLabel>
          <div className="space-y-4">
            {breakdownRows.map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: row.color }}
                    />
                    <span
                      className="text-[13px] font-semibold"
                      style={{ color: 'rgba(255,255,255,0.6)' }}
                    >
                      {row.label}
                    </span>
                  </div>
                  <span
                    className="text-[16px] font-black tabular-nums"
                    style={{ color: 'var(--v-text-primary)' }}
                  >
                    {formatINRCompact(row.value)}
                  </span>
                </div>
                <HBar value={row.value} max={maxBd} color={row.color} height={8} />
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Payout status */}
        <SectionCard>
          <CardLabel>Payout Status</CardLabel>

          <div className="grid grid-cols-2 gap-5 mb-6">
            <div
              className="rounded-xl p-4"
              style={{
                background: 'rgba(52,211,153,0.06)',
                border: '1px solid rgba(52,211,153,0.12)',
              }}
            >
              <div
                className="text-[11px] font-bold uppercase tracking-[0.12em] mb-1.5"
                style={{ color: '#34D399' }}
              >
                Completed
              </div>
              <div
                className="text-[28px] font-black tabular-nums leading-none"
                style={{ color: '#34D399' }}
              >
                {formatINRCompact(fin.completedPayout)}
              </div>
            </div>
            <div
              className="rounded-xl p-4"
              style={{
                background: 'rgba(251,191,36,0.06)',
                border: '1px solid rgba(251,191,36,0.12)',
              }}
            >
              <div
                className="text-[11px] font-bold uppercase tracking-[0.12em] mb-1.5"
                style={{ color: '#FBBF24' }}
              >
                Pending
              </div>
              <div
                className="text-[28px] font-black tabular-nums leading-none"
                style={{ color: '#FBBF24' }}
              >
                {formatINRCompact(fin.pendingPayout)}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-5">
            <div
              className="h-4 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${payoutPct}%`,
                  background: 'linear-gradient(90deg, #34D399, #22D3EE)',
                  boxShadow: '0 0 12px rgba(52,211,153,0.4)',
                }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {payoutPct.toFixed(0)}% settled
              </span>
              <span className="text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Total: {formatINRCompact(payoutTotal)}
              </span>
            </div>
          </div>

          {/* Settlement splits */}
          <div
            className="space-y-2.5 pt-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            {[
              { label: 'Venue Settlement', value: fin.venueSettlement, color: '#F44A22' },
              { label: 'Host Settlement', value: fin.hostSettlement, color: '#818CF8' },
              { label: 'Promoter Commissions', value: fin.promoterCommissions, color: '#34D399' },
            ]
              .filter((s) => s.value > 0)
              .map((s) => (
                <div key={s.label} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    <span
                      className="text-[13px] font-semibold"
                      style={{ color: 'rgba(255,255,255,0.5)' }}
                    >
                      {s.label}
                    </span>
                  </div>
                  <span
                    className="text-[15px] font-black tabular-nums"
                    style={{ color: 'var(--v-text-primary)' }}
                  >
                    {formatINRCompact(s.value)}
                  </span>
                </div>
              ))}
          </div>
        </SectionCard>
      </div>

      {/* Ticket Type Revenue */}
      {ticketTypeRevenue.length > 0 && (
        <SectionCard>
          <CardLabel>Revenue by Ticket Type</CardLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ticketTypeRevenue.map((t, i) => {
              const typeColors = ['#F44A22', '#818CF8', '#34D399', '#FBBF24', '#22D3EE', '#A78BFA'];
              const color = typeColors[i % typeColors.length];
              return (
                <div
                  key={t.type}
                  className="rounded-xl p-4 relative overflow-hidden"
                  style={{ background: `${color}08`, border: `1px solid ${color}20` }}
                >
                  <div
                    className="absolute bottom-0 left-0 h-1 transition-all duration-700"
                    style={{ width: `${(t.revenue / maxTicketRev) * 100}%`, background: color }}
                  />
                  <div
                    className="text-[12px] font-bold uppercase tracking-[0.10em] mb-2"
                    style={{ color }}
                  >
                    {t.type}
                  </div>
                  <div
                    className="text-[24px] font-black tabular-nums leading-none"
                    style={{ color: 'var(--v-text-primary)' }}
                  >
                    {formatINRCompact(t.revenue)}
                  </div>
                  {t.pct > 0 && (
                    <div
                      className="text-[12px] font-bold mt-1 tabular-nums"
                      style={{ color: 'rgba(255,255,255,0.35)' }}
                    >
                      {t.pct.toFixed(1)}% of total
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. CROWD — "Who showed up?" — Gender split with avg ages + demographics
// ═══════════════════════════════════════════════════════════════════════════

const GENDER_COLORS = ['#EC4899', '#6366F1', '#A78BFA'];
const AGE_COLORS = ['#F44A22', '#818CF8', '#34D399', '#FBBF24', '#22D3EE', '#A78BFA'];

export function CrowdSection({ data, loading }: SectionProps) {
  const au = data.audience;
  const genderTotal = au.genderRatio.female + au.genderRatio.male + au.genderRatio.other;

  const ageBands = Object.entries(au.ageBands).map(([band, count]) => ({ band, count }));
  const maxAge = Math.max(...ageBands.map((a) => a.count), 1);

  const genderData = [
    { name: 'Female', value: au.genderRatio.female },
    { name: 'Male', value: au.genderRatio.male },
    { name: 'Other', value: au.genderRatio.other },
  ].filter((g) => g.value > 0);

  // Calculate avg age per gender from age bands (approximate midpoints)
  const ageMidpoints: Record<string, number> = {
    '18-21': 19.5,
    '18-24': 21,
    '21-25': 23,
    '22-27': 24.5,
    '25-30': 27.5,
    '25-34': 29.5,
    '28-35': 31.5,
    '30-35': 32.5,
    '35-40': 37.5,
    '35-44': 39.5,
    '40-45': 42.5,
    '45-50': 47.5,
    '45+': 50,
    '50+': 55,
    '55+': 60,
  };

  // We don't have per-gender age data from the backend, so we show overall avg age
  const totalCount = ageBands.reduce((sum, a) => sum + a.count, 0);
  const avgAge =
    totalCount > 0
      ? ageBands.reduce((sum, a) => sum + (ageMidpoints[a.band] || 25) * a.count, 0) / totalCount
      : 0;

  if (loading) {
    return (
      <div>
        <SectionTitle title="Crowd & Demographics" description="" icon={Users} accent="#EC4899" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl p-8 animate-pulse"
              style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
            >
              <div className="h-48 rounded-xl bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle title="Crowd & Demographics" description="" icon={Users} accent="#EC4899" />
      {/* Top row: Gender + Age */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        {/* Gender Split — large donut */}
        <SectionCard>
          <CardLabel>Gender Split</CardLabel>

          {genderTotal > 0 ? (
            <div>
              <Suspense fallback={<ChartSkeleton height={240} />}>
                <LazyDonut data={genderData} colors={GENDER_COLORS} size={240} />
              </Suspense>

              {/* Gender legend with counts and percentages */}
              <div className="flex justify-center gap-6 mt-4">
                {genderData.map((g, i) => {
                  const pct = genderTotal > 0 ? ((g.value / genderTotal) * 100).toFixed(0) : '0';
                  return (
                    <div key={g.name} className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ background: GENDER_COLORS[i] }}
                        />
                        <span
                          className="text-[14px] font-bold"
                          style={{ color: 'var(--v-text-primary)' }}
                        >
                          {g.name}
                        </span>
                      </div>
                      <span
                        className="text-[24px] font-black tabular-nums"
                        style={{ color: GENDER_COLORS[i] }}
                      >
                        {pct}%
                      </span>
                      <span
                        className="text-[12px] font-semibold tabular-nums"
                        style={{ color: 'rgba(255,255,255,0.35)' }}
                      >
                        {g.value.toLocaleString()} guests
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Avg age (overall since we don't have per-gender age data) */}
              {avgAge > 0 && (
                <div
                  className="mt-6 pt-4 flex justify-center"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center">
                      <span
                        className="text-[11px] font-bold uppercase tracking-[0.12em] mb-1"
                        style={{ color: 'rgba(255,255,255,0.4)' }}
                      >
                        Avg Age
                      </span>
                      <span
                        className="text-[28px] font-black tabular-nums"
                        style={{ color: 'var(--v-text-primary)' }}
                      >
                        {avgAge.toFixed(0)}
                      </span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span
                        className="text-[11px] font-bold uppercase tracking-[0.12em] mb-1"
                        style={{ color: 'rgba(255,255,255,0.4)' }}
                      >
                        Avg Party Size
                      </span>
                      <span
                        className="text-[28px] font-black tabular-nums"
                        style={{ color: 'var(--v-text-primary)' }}
                      >
                        {au.avgPartySize > 0 ? au.avgPartySize.toFixed(1) : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyHint text="Gender data appears after check-ins begin" />
          )}
        </SectionCard>

        {/* Age Distribution — horizontal bars */}
        <SectionCard>
          <CardLabel>Age Distribution</CardLabel>
          {ageBands.length > 0 ? (
            <div className="space-y-3.5">
              {ageBands.map((a, i) => {
                const pct = totalCount > 0 ? ((a.count / totalCount) * 100).toFixed(0) : '0';
                const color = AGE_COLORS[i % AGE_COLORS.length];
                return (
                  <div key={a.band}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className="text-[14px] font-bold tabular-nums"
                        style={{ color: 'var(--v-text-primary)' }}
                      >
                        {a.band}
                      </span>
                      <div className="flex items-center gap-3">
                        <span
                          className="text-[13px] font-bold tabular-nums"
                          style={{ color: 'rgba(255,255,255,0.5)' }}
                        >
                          {a.count.toLocaleString()}
                        </span>
                        <span
                          className="text-[12px] font-bold tabular-nums px-2 py-0.5 rounded-full"
                          style={{ background: `${color}15`, color }}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <HBar value={a.count} max={maxAge} color={color} height={12} />
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyHint text="Age data appears after check-ins begin" />
          )}
        </SectionCard>
      </div>

      {/* Guest composition */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* New vs Repeat vs VIP */}
        {[
          {
            label: 'New Guests',
            value: au.newGuests,
            icon: UserCheck,
            color: '#34D399',
            desc: 'First time at your venue',
          },
          {
            label: 'Repeat Guests',
            value: au.repeatGuests,
            icon: Repeat2,
            color: '#818CF8',
            desc: 'Have attended before',
          },
          {
            label: 'VIP Guests',
            value: au.vipGuests,
            icon: Crown,
            color: '#FBBF24',
            desc: 'High-value regulars',
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl p-5 relative overflow-hidden"
            style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
          >
            <div
              className="absolute top-0 right-0 w-24 h-24 opacity-[0.06] rounded-full"
              style={{
                background: item.color,
                filter: 'blur(30px)',
                transform: 'translate(30%, -30%)',
              }}
            />
            <div className="flex items-center gap-2.5 mb-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: `${item.color}15` }}
              >
                <item.icon className="w-4.5 h-4.5" style={{ color: item.color }} />
              </div>
              <span
                className="text-[12px] font-bold uppercase tracking-[0.12em]"
                style={{ color: 'rgba(255,255,255,0.45)' }}
              >
                {item.label}
              </span>
            </div>
            <div
              className="text-[36px] font-black tabular-nums leading-none mb-1"
              style={{ color: 'var(--v-text-primary)' }}
            >
              {item.value.toLocaleString()}
            </div>
            <span className="text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {item.desc}
            </span>
          </div>
        ))}
      </div>

      {/* Loyalty tiers */}
      {au.loyaltyDistribution.length > 0 && (
        <SectionCard className="mt-6">
          <CardLabel>Loyalty Tiers</CardLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {au.loyaltyDistribution.map((tier, i) => {
              const color = AGE_COLORS[i % AGE_COLORS.length];
              return (
                <div
                  key={tier.tier}
                  className="rounded-xl p-4 text-center"
                  style={{ background: `${color}08`, border: `1px solid ${color}15` }}
                >
                  <div
                    className="text-[12px] font-bold uppercase tracking-[0.10em] mb-2"
                    style={{ color }}
                  >
                    {tier.tier}
                  </div>
                  <div
                    className="text-[28px] font-black tabular-nums leading-none"
                    style={{ color: 'var(--v-text-primary)' }}
                  >
                    {tier.count}
                  </div>
                  {tier.pct > 0 && (
                    <div
                      className="text-[12px] font-bold mt-1 tabular-nums"
                      style={{ color: 'rgba(255,255,255,0.35)' }}
                    >
                      {tier.pct.toFixed(0)}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. DOOR — "How did the night run?"
// ═══════════════════════════════════════════════════════════════════════════

export function DoorSection({ data, loading }: SectionProps) {
  const ops = data.doorOps;

  const scanBreakdown = [
    { label: 'Successful', value: ops.successfulScans, color: '#34D399', icon: Shield },
    { label: 'Rejected', value: ops.rejectedScans, color: '#F87171', icon: UserX },
    { label: 'Duplicates', value: ops.duplicateScans, color: '#FBBF24', icon: Repeat2 },
  ];
  const maxScan = Math.max(...scanBreakdown.map((s) => s.value), 1);

  if (loading) {
    return (
      <div>
        <SectionTitle title="Door & Operations" description="" icon={Zap} accent="#22D3EE" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl p-8 animate-pulse"
              style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
            >
              <div className="h-56 rounded-xl bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle title="Door & Operations" description="" icon={Zap} accent="#22D3EE" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        {/* Entry velocity chart */}
        <SectionCard>
          <div className="flex items-center justify-between mb-4">
            <CardLabel>Entry Velocity by Hour</CardLabel>
            {ops.peakEntryHour != null && (
              <span
                className="text-[12px] font-bold px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(244,74,34,0.12)', color: '#F44A22' }}
              >
                Peak: {String(ops.peakEntryHour).padStart(2, '0')}:00
              </span>
            )}
          </div>
          <Suspense fallback={<ChartSkeleton height={260} />}>
            <LazyBar data={ops.entryCurve} xKey="hour" yKey="count" color="#818CF8" height={260} />
          </Suspense>
          {!data.hasData && <EmptyHint text="Entry curve appears after your first event night" />}
        </SectionCard>

        {/* Scanner efficiency */}
        <SectionCard>
          <CardLabel>Scanner Performance</CardLabel>

          <div className="flex items-center gap-8 mb-6">
            <Ring value={ops.scanSuccessRate} label="Success Rate" color="#34D399" size={120} />
            <div className="flex-1">
              <div
                className="text-[13px] font-bold mb-1"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                Total Scans
              </div>
              <div
                className="text-[36px] font-black tabular-nums leading-none mb-2"
                style={{ color: 'var(--v-text-primary)' }}
              >
                {ops.totalScans.toLocaleString()}
              </div>
              {ops.peakEntryVelocity > 0 && (
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" style={{ color: '#FBBF24' }} />
                  <span className="text-[13px] font-bold" style={{ color: '#FBBF24' }}>
                    {ops.peakEntryVelocity} guests/hr peak
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Scan breakdown */}
          <div className="space-y-3.5">
            {scanBreakdown.map((s) => (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: `${s.color}15` }}
                    >
                      <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                    </div>
                    <span
                      className="text-[13px] font-semibold"
                      style={{ color: 'rgba(255,255,255,0.55)' }}
                    >
                      {s.label}
                    </span>
                  </div>
                  <span
                    className="text-[16px] font-black tabular-nums"
                    style={{ color: 'var(--v-text-primary)' }}
                  >
                    {s.value.toLocaleString()}
                  </span>
                </div>
                <HBar value={s.value} max={maxScan} color={s.color} height={8} />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Quick ops metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Capacity Used',
            value: `${ops.capacityUtilization.toFixed(0)}%`,
            color: ops.capacityUtilization > 80 ? '#34D399' : '#FBBF24',
            icon: Users,
          },
          {
            label: 'Late Arrivals',
            value: `${ops.lateArrivalPct.toFixed(0)}%`,
            color: ops.lateArrivalPct > 30 ? '#F87171' : '#818CF8',
            icon: Clock,
          },
          {
            label: 'Re-entries',
            value: ops.reEntryCount.toLocaleString(),
            color: '#A78BFA',
            icon: Repeat2,
          },
          {
            label: 'Manual Overrides',
            value: ops.manualOverrides.toLocaleString(),
            color: ops.manualOverrides > 10 ? '#F87171' : '#71717A',
            icon: Shield,
          },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-2xl p-5 relative overflow-hidden"
            style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${m.color}15` }}
              >
                <m.icon className="w-3.5 h-3.5" style={{ color: m.color }} />
              </div>
              <span
                className="text-[11px] font-bold uppercase tracking-[0.12em]"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                {m.label}
              </span>
            </div>
            <div
              className="text-[28px] font-black tabular-nums leading-none"
              style={{ color: m.color }}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. COMPARE — "How does this stack up?"
// ═══════════════════════════════════════════════════════════════════════════

type CompareMetric = 'revenue' | 'attendance' | 'occupancy' | 'sellThrough';

const COMPARE_DEFS: { key: CompareMetric; label: string; fmt: (v: number) => string }[] = [
  { key: 'revenue', label: 'Revenue', fmt: formatINRCompact },
  { key: 'attendance', label: 'Attendance', fmt: (v) => formatNumberCompact(v) },
  { key: 'occupancy', label: 'Fill Rate', fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'sellThrough', label: 'Sell-through', fmt: (v) => `${v.toFixed(1)}%` },
];

const RANK_COLORS = ['#F44A22', '#818CF8', '#34D399', '#FBBF24', '#22D3EE', '#A78BFA'];

export function CompareSection({ data, loading }: SectionProps) {
  const [focus, setFocus] = useState<CompareMetric>('revenue');
  const cards = data.eventScorecards;
  const sorted = [...cards].sort((a, b) => (b[focus] ?? 0) - (a[focus] ?? 0));
  const primary = sorted[0];
  const rest = sorted.slice(1, 6);

  const maxVal = Math.max(...sorted.map((e) => e[focus] ?? 0), 1);
  const focusDef = COMPARE_DEFS.find((d) => d.key === focus)!;

  if (loading) {
    return (
      <div>
        <SectionTitle title="Event Comparison" description="" icon={Star} accent="#FBBF24" />
        <div
          className="rounded-2xl p-8 animate-pulse"
          style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
        >
          <div className="h-80 rounded-xl bg-white/5" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle title="Event Comparison" description="" icon={Star} accent="#FBBF24" />

      <SectionCard>
        {/* Metric tabs */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <span
            className="text-[12px] font-bold uppercase tracking-[0.12em]"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            Ranked by
          </span>
          <div
            className="flex items-center gap-1 p-1 rounded-xl"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {COMPARE_DEFS.map((d) => (
              <button
                key={d.key}
                onClick={() => setFocus(d.key)}
                className="px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-[0.08em] transition-all"
                style={{
                  background: focus === d.key ? 'var(--v-card)' : 'transparent',
                  color: focus === d.key ? 'var(--v-text-primary)' : 'rgba(255,255,255,0.35)',
                  boxShadow: focus === d.key ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Primary event — #1 */}
        {primary && (
          <div
            className="rounded-2xl p-6 mb-6 relative overflow-hidden"
            style={{ background: 'rgba(244,74,34,0.06)', border: '1px solid rgba(244,74,34,0.2)' }}
          >
            {/* Glow */}
            <div
              className="absolute top-0 left-0 w-48 h-48 opacity-[0.08]"
              style={{ background: '#F44A22', filter: 'blur(60px)', borderRadius: '50%' }}
            />

            <div className="flex items-start justify-between gap-4 mb-5 relative">
              <div>
                <div
                  className="text-[11px] font-black uppercase tracking-[0.16em] mb-2 flex items-center gap-2"
                  style={{ color: '#F44A22' }}
                >
                  <Star className="w-4 h-4" fill="currentColor" />
                  #1 — Best {focusDef.label}
                </div>
                <div
                  className="text-[20px] sm:text-[22px] font-black"
                  style={{ color: 'var(--v-text-primary)' }}
                >
                  {primary.title}
                </div>
                {primary.date !== '—' && (
                  <div
                    className="text-[13px] font-semibold mt-1"
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                  >
                    {primary.date}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div
                  className="text-[36px] sm:text-[42px] font-black tabular-nums leading-none"
                  style={{ color: '#F44A22' }}
                >
                  {focusDef.fmt(primary[focus] ?? 0)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {COMPARE_DEFS.map((d) => (
                <div
                  key={d.key}
                  className="rounded-xl p-3"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                >
                  <div
                    className="text-[11px] font-bold uppercase tracking-[0.10em] mb-1"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                  >
                    {d.label}
                  </div>
                  <div
                    className="text-[20px] font-black tabular-nums"
                    style={{ color: d.key === focus ? '#F44A22' : 'var(--v-text-primary)' }}
                  >
                    {d.fmt(primary[d.key] ?? 0)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comparison rows */}
        {rest.length > 0 && (
          <div className="space-y-2">
            {rest.map((event, i) => {
              const val = event[focus] ?? 0;
              const color = RANK_COLORS[(i + 1) % RANK_COLORS.length];
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-4 px-5 py-4 rounded-xl transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <span
                    className="text-[14px] font-black tabular-nums w-8 shrink-0"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                  >
                    #{i + 2}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-[15px] font-bold truncate block"
                      style={{
                        color: data.hasData ? 'var(--v-text-primary)' : 'rgba(255,255,255,0.3)',
                      }}
                    >
                      {event.title}
                    </span>
                    {event.date !== '—' && (
                      <span
                        className="text-[11px] font-medium"
                        style={{ color: 'rgba(255,255,255,0.25)' }}
                      >
                        {event.date}
                      </span>
                    )}
                  </div>
                  <div className="w-32 sm:w-48 hidden sm:block">
                    <HBar value={val} max={maxVal} color={color} height={8} />
                  </div>
                  <span
                    className="text-[18px] font-black tabular-nums w-20 text-right shrink-0"
                    style={{ color }}
                  >
                    {focusDef.fmt(val)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {!data.hasData && (
          <EmptyHint text="Event comparison appears after your first event completes" />
        )}
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Legacy re-exports (keep backward compat for host/promoter analytics pages)
// ═══════════════════════════════════════════════════════════════════════════

export {
  SummarySection as KPISection,
  SummarySection as PerformanceRingsSection,
  RevenueSection as TicketsGuestlistSection,
  CrowdSection as AudienceSection,
  DoorSection as ScannerSection,
  CompareSection as EventComparisonSection,
  RevenueSection as FinanceSection,
  RevenueSection as SourceHeatmapSection,
  CompareSection as TableSection,
  DoorSection as InsightsSection,
};
