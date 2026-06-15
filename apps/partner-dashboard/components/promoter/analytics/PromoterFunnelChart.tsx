'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export function PromoterFunnelChart({ timeline }: { timeline: any[] }) {
  // Reformat data for Recharts, handling any gaps gracefully
  const chartData = useMemo(() => {
    if (!timeline) return [];
    return timeline.map((t) => ({
      name: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      Clicks: t.clicks,
      Sales: t.sales,
    }));
  }, [timeline]);

  if (!chartData.length) {
    return (
      <div className="w-full h-80 flex flex-col items-center justify-center text-text-muted bg-surface-base border border-border-subtle rounded-2xl border-dashed">
        <p>No timeline data available for this range.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-80 bg-surface-elevated rounded-2xl border border-border-subtle p-6 flex flex-col pt-8">
      <h3 className="font-bold text-text-primary text-sm tracking-wide mb-6 uppercase absolute top-6">
        Performance Timeline
      </h3>

      <div className="flex-1 w-full min-h-0 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#A1A1AA', fontSize: 12 }}
              dy={10}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#A1A1AA', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(24, 24, 27, 0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                backdropFilter: 'blur(8px)',
              }}
              itemStyle={{ color: '#fff', fontWeight: 'bold' }}
              labelStyle={{ color: '#A1A1AA', marginBottom: '4px' }}
            />
            <Area
              type="monotone"
              dataKey="Clicks"
              stroke="#3b82f6"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorClicks)"
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="Sales"
              stroke="#10b981"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorSales)"
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
