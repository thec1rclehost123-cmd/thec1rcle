'use client';

import { DollarSign, MousePointerClick, TrendingUp, ShoppingCart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function PromoterSalesPanel({
  stats,
  commissionRate,
}: {
  stats: any;
  commissionRate: number;
}) {
  const rateType = stats.commissionType || 'percentage';
  const isFixed = rateType === 'fixed' || rateType === 'flat';
  const isCustom = stats.compensationModel === 'custom';

  const kpis = [
    { title: 'Total Revenue', amount: formatINR(stats.totalRevenue), icon: DollarSign, trend: '' },
    {
      title: 'Your Commission',
      amount: formatINR(stats.estimatedCommission),
      icon: TrendingUp,
      trend: isCustom
        ? 'Varying rate'
        : isFixed
          ? `₹${commissionRate} flat`
          : `${commissionRate}% rate`,
    },
    {
      title: 'Total Clicks',
      amount: (stats.totalClicks ?? 0).toLocaleString(),
      icon: MousePointerClick,
      trend: '',
    },
    {
      title: 'Tickets Sold',
      amount: (stats.totalPurchases ?? 0).toLocaleString(),
      icon: ShoppingCart,
      trend: '',
    },
  ];

  const conversionRate = ((stats.totalPurchases / Math.max(stats.totalClicks, 1)) * 100).toFixed(1);

  // Conversion funnel data for bar chart
  const funnelData = [
    { stage: 'Clicks', value: stats.totalClicks },
    { stage: 'Purchases', value: stats.totalPurchases },
    { stage: 'Converted', value: stats.totalPurchases > 0 ? stats.totalPurchases : 0 },
  ];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-text-primary">Sales & Conversion</h2>
        <p className="text-sm text-text-secondary mt-1">
          Track how effectively your audience is converting for this event.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {kpis.map((stat, i) => (
          <div
            key={i}
            className="bg-surface-elevated border-border-subtle p-5 rounded-2xl border flex flex-col gap-2 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <stat.icon className="h-20 w-20" />
            </div>
            <p className="text-sm font-semibold text-text-tertiary flex items-center gap-2">
              <stat.icon className="h-4 w-4 text-emerald-500" />
              {stat.title}
            </p>
            <span className="text-3xl font-black tabular-nums tracking-tighter text-text-primary mt-1">
              {stat.amount}
            </span>
            {stat.trend && (
              <span className="text-xs font-medium text-emerald-500 mt-auto bg-emerald-500/10 px-2 py-1 rounded inline-flex self-start">
                {stat.trend}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Conversion rate ring + progress bar */}
      <div className="bg-surface-elevated border-border-subtle p-6 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="h-16 w-16 rounded-full border-[6px] border-emerald-500 flex items-center justify-center bg-surface-base shrink-0">
            <span className="font-bold text-sm tabular-nums text-text-primary">
              {conversionRate}%
            </span>
          </div>
          <div>
            <h4 className="font-bold text-lg text-text-primary tracking-tight">Conversion Rate</h4>
            <p className="text-sm text-text-secondary max-w-sm">
              {stats.totalClicks} clicks → {stats.totalPurchases} purchases
            </p>
          </div>
        </div>
        <div className="w-full md:w-1/3 h-2 bg-surface-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full"
            style={{ width: `${Math.min(100, Math.max(2, parseFloat(conversionRate) * 10))}%` }}
          />
        </div>
      </div>

      {/* Funnel bar chart */}
      <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-6 flex flex-col gap-4">
        <p className="text-xs font-bold uppercase tracking-widest text-text-tertiary">
          Conversion Funnel
        </p>
        <div className="w-full h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(255,255,255,0.06)"
              />
              <XAxis
                dataKey="stage"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#A1A1AA', fontSize: 12 }}
                dy={8}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#A1A1AA', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(24,24,27,0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                }}
                itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                labelStyle={{ color: '#A1A1AA' }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={80} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
