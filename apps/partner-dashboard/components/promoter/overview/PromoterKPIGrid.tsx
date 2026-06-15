'use client';

import { CreditCard, TrendingUp, CalendarDays, MousePointerClick } from 'lucide-react';

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function PromoterKPIGrid({ kpis }: { kpis?: any }) {
  const defaultData = [
    {
      title: 'Total Clicks',
      icon: MousePointerClick,
      amount: kpis?.totalClicks != null ? kpis.totalClicks.toLocaleString('en-IN') : '—',
    },
    {
      title: 'Tickets Sold',
      icon: TrendingUp,
      amount: kpis?.ticketsSold != null ? kpis.ticketsSold.toLocaleString('en-IN') : '—',
    },
    {
      title: 'Commission Earned',
      icon: CreditCard,
      amount: kpis?.commission != null ? formatINR(kpis.commission) : '—',
    },
    {
      title: 'Active Events',
      icon: CalendarDays,
      amount: kpis?.activeEvents != null ? String(kpis.activeEvents) : '—',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {defaultData.map((stat, i) => (
        <div
          key={i}
          className="bg-surface-elevated border-border-subtle p-5 rounded-2xl border flex flex-col gap-2"
        >
          <p className="text-sm font-semibold text-text-tertiary flex items-center gap-2">
            <stat.icon className="h-4 w-4 text-emerald-500" />
            {stat.title}
          </p>
          <span className="text-3xl font-black tabular-nums tracking-tighter text-text-primary">
            {stat.amount}
          </span>
        </div>
      ))}
    </div>
  );
}
