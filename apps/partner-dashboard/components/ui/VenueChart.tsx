'use client';

import React, { Suspense, lazy } from 'react';
import { cn } from '@/lib/utils';

function formatTooltipValue(value: unknown, title: string) {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) return String(value ?? '—');
  if (title.toLowerCase().includes('revenue')) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(numericValue);
  }
  return `${new Intl.NumberFormat('en-IN').format(numericValue)} tickets`;
}

function ChartTooltip({
  active,
  payload,
  label,
  title,
}: {
  active?: boolean;
  payload?: Array<{ value?: unknown }>;
  label?: string;
  title: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: 'var(--v-card)',
        border: '1px solid var(--v-border)',
        borderRadius: 20,
        padding: '14px 16px',
        color: 'var(--v-text-primary)',
        boxShadow: '0 18px 40px rgba(0,0,0,0.22)',
      }}
    >
      <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 700 }}>
        {formatTooltipValue(payload[0]?.value, title)}
      </p>
    </div>
  );
}

// ── Lazy-load recharts to keep it out of non-analytics bundles ──
const RechartsArea = lazy(() =>
  (import('recharts') as any).then((m: any) => ({
    default: function AreaChartWrapper({
      data,
      dataKey,
      xKey,
      color,
      height,
      title,
      gradientId,
      empty,
    }: {
      data: any[];
      dataKey: string;
      xKey: string;
      color: string;
      height: number;
      title: string;
      gradientId: string;
      empty?: boolean;
    }) {
      const { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } = m;
      const Defs = (m as any).defs || 'defs';
      const LinearGradient = (m as any).linearGradient || 'linearGradient';
      const Stop = (m as any).stop || 'stop';

      return (
        <div role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <Defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={color} stopOpacity={0.5} />
                  <Stop offset="28%" stopColor={color} stopOpacity={0.26} />
                  <Stop offset="72%" stopColor={color} stopOpacity={0.08} />
                  <Stop offset="95%" stopColor={color} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <CartesianGrid
                vertical={false}
                stroke="rgba(255,255,255,0.03)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 10, fill: '#9B9B9F', fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                hide={false}
                dy={10}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9B9B9F', fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                domain={empty ? [0, 20] : ['auto', 'auto']}
                tickCount={5}
                hide={false}
                width={30}
              />
              {!empty && (
                <Tooltip
                  content={<ChartTooltip title={title} />}
                  cursor={{ stroke: 'rgba(128,128,128,0.20)' }}
                />
              )}
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={empty ? 3 : 2.5}
                fill={`url(#${gradientId})`}
                isAnimationActive={!empty}
                strokeOpacity={1}
                fillOpacity={empty ? 0.08 : 1}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    },
  })),
);

const RechartsBar = lazy(() =>
  (import('recharts') as any).then((m: any) => ({
    default: function BarChartWrapper({
      data,
      dataKey,
      xKey,
      color,
      height,
      title,
      empty,
    }: {
      data: any[];
      dataKey: string;
      xKey: string;
      color: string;
      height: number;
      title: string;
      empty?: boolean;
    }) {
      const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } = m;
      return (
        <div role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid
                vertical={false}
                stroke="rgba(255,255,255,0.03)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.30)', fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.30)', fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                domain={empty ? [0, 20] : ['auto', 'auto']}
                tickCount={5}
                width={30}
              />
              {!empty && (
                <Tooltip
                  content={<ChartTooltip title={title} />}
                  cursor={{ fill: 'rgba(128,128,128,0.08)' }}
                />
              )}
              <Bar
                dataKey={dataKey}
                fill={color}
                radius={[4, 4, 0, 0]}
                isAnimationActive={!empty}
                opacity={empty ? 0 : 1}
              >
                {data.map((_, index) => (
                  <Cell key={index} fill={color} opacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    },
  })),
);

const RechartsLine = lazy(() =>
  (import('recharts') as any).then((m: any) => ({
    default: function LineChartWrapper({
      data,
      dataKey,
      xKey,
      color,
      height,
      title,
      gradientId,
      empty,
    }: {
      data: any[];
      dataKey: string;
      xKey: string;
      color: string;
      height: number;
      title: string;
      gradientId: string;
      empty?: boolean;
    }) {
      const { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } = m;
      const Defs = (m as any).defs || 'defs';
      const LinearGradient = (m as any).linearGradient || 'linearGradient';
      const Stop = (m as any).stop || 'stop';
      return (
        <div role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <Defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={color} stopOpacity={0.65} />
                  <Stop offset="40%" stopColor={color} stopOpacity={0.3} />
                  <Stop offset="100%" stopColor={color} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <CartesianGrid
                vertical={false}
                stroke="rgba(255,255,255,0.03)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 10, fill: '#9B9B9F', fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9B9B9F', fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                domain={empty ? [0, 20] : ['auto', 'auto']}
                tickCount={5}
                width={30}
              />
              {!empty && (
                <Tooltip
                  content={<ChartTooltip title={title} />}
                  cursor={{ stroke: 'rgba(128,128,128,0.20)' }}
                />
              )}
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={empty ? 3 : 2.5}
                fill={`url(#${gradientId})`}
                dot={false}
                isAnimationActive={!empty}
                strokeOpacity={1}
                fillOpacity={empty ? 0.08 : 1}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    },
  })),
);

// ── Public VenueChart interface ──

export interface VenueChartConfig {
  dataKey: string;
  xKey: string;
  color?: string;
  gradientId?: string;
}

export interface VenueChartProps {
  type: 'area' | 'bar' | 'line';
  data: any[];
  config: VenueChartConfig;
  height?: number;
  loading?: boolean;
  empty?: boolean;
  emptyLabels?: string[];
  title: string;
  className?: string;
}

function buildEmptyChartData({
  labels,
  xKey,
  dataKey,
}: {
  labels: string[];
  xKey: string;
  dataKey: string;
}) {
  const fallbackLabels = labels.length > 0 ? labels : ['', '', '', '', '', ''];
  return fallbackLabels.map((label) => ({
    [xKey]: label,
    [dataKey]: 0,
  }));
}

export function VenueChart({
  type,
  data,
  config,
  height = 240,
  loading = false,
  empty = false,
  emptyLabels = [],
  title,
  className,
}: VenueChartProps) {
  const color = config.color || 'var(--v-chart-1)';
  const gradientId = config.gradientId || `grad-${config.dataKey}`;

  if (loading) {
    return <ChartSkeleton height={height} className={className} />;
  }

  const isEmptyData = !data || data.length === 0;
  const resolvedData = isEmptyData
    ? buildEmptyChartData({
        labels: emptyLabels,
        xKey: config.xKey,
        dataKey: config.dataKey,
      })
    : data;
  const resolvedEmpty = empty || isEmptyData;

  const chartProps = {
    data: resolvedData,
    dataKey: config.dataKey,
    xKey: config.xKey,
    color,
    height,
    title,
    gradientId,
    empty: resolvedEmpty,
  };

  return (
    <div className={cn('w-full', className)}>
      <Suspense fallback={<ChartSkeleton height={height} />}>
        {type === 'area' && <RechartsArea {...chartProps} />}
        {type === 'bar' && <RechartsBar {...chartProps} />}
        {type === 'line' && <RechartsLine {...chartProps} />}
      </Suspense>
    </div>
  );
}

// ── Chart loading skeleton ──
export function ChartSkeleton({
  height = 240,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('v-skeleton w-full rounded-2xl', className)}
      style={{ height }}
      aria-label="Loading chart..."
    />
  );
}

export default VenueChart;
