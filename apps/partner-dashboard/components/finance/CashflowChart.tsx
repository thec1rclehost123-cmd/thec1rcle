'use client';

import dynamic from 'next/dynamic';
import { Suspense, useState } from 'react';
import { cn } from '@/lib/utils';
import type { CashflowDataPoint } from '@/lib/finance/definitions';
import { formatINRCompact } from '@/lib/finance/definitions';
import { ChartSkeleton } from '@/components/ui/VenueChart';

// Disable SSR for recharts to prevent useContext/DOM errors during Next.js generation
const RechartsComposed = dynamic(
  () =>
    import('recharts').then((m: any) => {
      return function CashflowInner({
        data,
        series,
        height,
      }: {
        data: CashflowDataPoint[];
        series: SeriesConfig[];
        height: number;
      }) {
        const {
          ComposedChart,
          Area,
          Line,
          Bar,
          XAxis,
          YAxis,
          Tooltip,
          Legend,
          ResponsiveContainer,
          CartesianGrid,
        } = m;

        return (
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-in" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34D399" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-out" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F87171" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#F87171" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-net" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818CF8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#818CF8" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(128,128,128,0.12)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#9B9B9F' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9B9B9F' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatINRCompact}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--v-card)',
                  border: '1px solid var(--v-border)',
                  borderRadius: 14,
                  fontSize: 12,
                  color: 'var(--v-text-primary)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  padding: '10px 14px',
                }}
                labelStyle={{ color: 'var(--v-text-tertiary)', marginBottom: 6, fontSize: 10 }}
                cursor={{ stroke: 'rgba(128,128,128,0.20)' }}
                formatter={(value: number) => formatINRCompact(value)}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                formatter={(label: any) => (
                  <span
                    style={{
                      color: 'var(--v-text-secondary)',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {label}
                  </span>
                )}
              />

              {/* Money In — filled area */}
              {series.includes('moneyIn') && (
                <Area
                  type="monotone"
                  dataKey="moneyIn"
                  name="Money In"
                  stroke="#34D399"
                  strokeWidth={2}
                  fill="url(#grad-in)"
                  dot={false}
                  isAnimationActive={true}
                />
              )}
              {/* Money Out — filled area */}
              {series.includes('moneyOut') && (
                <Area
                  type="monotone"
                  dataKey="moneyOut"
                  name="Money Out"
                  stroke="#F87171"
                  strokeWidth={2}
                  fill="url(#grad-out)"
                  dot={false}
                  isAnimationActive={true}
                />
              )}
              {/* Net — line, most prominent */}
              {series.includes('net') && (
                <Line
                  type="monotone"
                  dataKey="net"
                  name="Net"
                  stroke="#818CF8"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={true}
                />
              )}
              {/* Fees — subtle bar */}
              {series.includes('fees') && (
                <Bar
                  dataKey="fees"
                  name="Fees"
                  fill="rgba(251,146,60,0.5)"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={8}
                  isAnimationActive={true}
                />
              )}
              {/* Refunds — bar */}
              {series.includes('refunds') && (
                <Bar
                  dataKey="refunds"
                  name="Refunds"
                  fill="rgba(148,163,184,0.5)"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={8}
                  isAnimationActive={true}
                />
              )}
              {/* Payouts — bar */}
              {series.includes('payouts') && (
                <Bar
                  dataKey="payouts"
                  name="Payouts"
                  fill="rgba(99,102,241,0.5)"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={8}
                  isAnimationActive={true}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        );
      };
    }),
  { ssr: false },
);

// ── Types ────────────────────────────────────────────────────────────────────

type SeriesConfig = 'moneyIn' | 'moneyOut' | 'net' | 'fees' | 'refunds' | 'payouts';
type TimeRange = '7d' | '30d' | '90d' | 'ytd';

interface CashflowChartProps {
  data: CashflowDataPoint[];
  height?: number;
  loading?: boolean;
  showSeriesToggle?: boolean;
  showTimeRangePicker?: boolean;
  onTimeRangeChange?: (range: TimeRange) => void;
  activeRange?: TimeRange;
  className?: string;
}

const SERIES_OPTIONS: { key: SeriesConfig; label: string; color: string }[] = [
  { key: 'moneyIn', label: 'Money In', color: '#34D399' },
  { key: 'moneyOut', label: 'Money Out', color: '#F87171' },
  { key: 'net', label: 'Net', color: '#818CF8' },
  { key: 'fees', label: 'Fees', color: '#FB923C' },
  { key: 'refunds', label: 'Refunds', color: '#94A3B8' },
  { key: 'payouts', label: 'Payouts', color: '#6366F1' },
];

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'ytd', label: 'YTD' },
];

// ── CashflowChart ────────────────────────────────────────────────────────────

export function CashflowChart({
  data,
  height = 240,
  loading = false,
  showSeriesToggle = true,
  showTimeRangePicker = true,
  onTimeRangeChange,
  activeRange = '30d',
  className,
}: CashflowChartProps) {
  const [activeSeries, setActiveSeries] = useState<SeriesConfig[]>(['moneyIn', 'moneyOut', 'net']);

  const toggleSeries = (key: SeriesConfig) => {
    setActiveSeries((prev) =>
      prev.includes(key)
        ? prev.length > 1
          ? prev.filter((s) => s !== key)
          : prev
        : [...prev, key],
    );
  };

  // Total money-in provided by backend headline metrics
  const totalMoneyIn = 0;

  return (
    <div
      className={cn(className)}
      style={{ position: 'relative', overflow: 'hidden', borderRadius: '1.5rem' }}
    >
      {/* Radial orange glow behind the card */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse at 55% -15%, rgba(244,74,34,0.20) 0%, transparent 60%)',
        }}
      />

      {/* Glass card surface */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          background: 'rgba(14,14,16,0.95)',
          border: '1px solid rgba(244,74,34,0.18)',
          borderRadius: '1.5rem',
          padding: '24px 24px 20px',
        }}
      >
        {/* Header row: headline number + controls */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
          <div>
            <p
              style={{
                fontSize: 10,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: 'rgba(244,74,34,0.8)',
                marginBottom: 6,
              }}
            >
              Cashflow
            </p>
            <p
              className="tabular-nums"
              style={{
                fontSize: 36,
                fontWeight: 700,
                color: '#fff',
                letterSpacing: '-0.025em',
                lineHeight: 1,
              }}
            >
              {formatINRCompact(totalMoneyIn)}
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.36)', marginTop: 4 }}>
              Total money in · {activeRange.toUpperCase()}
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            {/* Time range picker */}
            {showTimeRangePicker && (
              <div
                className="flex items-center gap-0.5 p-0.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                {TIME_RANGES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => onTimeRangeChange?.(r.value)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all duration-150"
                    style={{
                      background: activeRange === r.value ? 'rgba(244,74,34,0.2)' : 'transparent',
                      color: activeRange === r.value ? '#f44a22' : 'rgba(255,255,255,0.4)',
                      border:
                        activeRange === r.value
                          ? '1px solid rgba(244,74,34,0.3)'
                          : '1px solid transparent',
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}

            {/* Series toggles */}
            {showSeriesToggle && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {SERIES_OPTIONS.map((opt) => {
                  const active = activeSeries.includes(opt.key);
                  return (
                    <button
                      key={opt.key}
                      onClick={() => toggleSeries(opt.key)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition-all duration-150"
                      style={{
                        background: active ? `${opt.color}18` : 'transparent',
                        color: active ? opt.color : 'rgba(255,255,255,0.3)',
                        border: `1px solid ${active ? `${opt.color}30` : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: active ? opt.color : 'rgba(255,255,255,0.2)' }}
                      />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chart */}
        {loading ? (
          <ChartSkeleton height={height} />
        ) : !data || data.length === 0 ? (
          <div
            className="w-full rounded-xl flex items-center justify-center"
            style={{
              height,
              background: 'rgba(255,255,255,0.03)',
              border: '1px dashed rgba(255,255,255,0.08)',
            }}
          >
            <span
              className="text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: 'rgba(255,255,255,0.28)' }}
            >
              No data for this period
            </span>
          </div>
        ) : (
          <Suspense fallback={<ChartSkeleton height={height} />}>
            <RechartsComposed data={data} series={activeSeries} height={height} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

export default CashflowChart;
