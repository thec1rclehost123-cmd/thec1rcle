'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Users,
  Eye,
  Heart,
  MapPin,
  Calendar,
  UserPlus,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Globe,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';

interface FollowerAnalyticsSectionProps {
  stats: any;
  venue: any;
}

export default function FollowerAnalyticsSection({ stats, venue }: FollowerAnalyticsSectionProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const followerGrowth = stats?.followerGrowth ?? null;
  const cityBreakdown: any[] = stats?.cityBreakdown ?? [];
  const conversionMetrics = stats?.conversionMetrics ?? null;
  const topFollowers: any[] = stats?.topFollowers ?? [];

  return (
    <div className="space-y-12">
      {/* Header Stats */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-violet-500/10 rounded-xl">
              <TrendingUp className="w-5 h-5 text-violet-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary">Audience Insights</h3>
              <p className="text-sm text-text-tertiary">Understand your community and engagement</p>
            </div>
          </div>

          {/* Time Range Toggle */}
          <div className="flex p-1 bg-surface-secondary rounded-xl border border-border-subtle">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg text-[11px] font-bold transition-all ${
                  timeRange === range
                    ? 'bg-surface-base text-text-primary shadow-sm'
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Followers"
            value={(stats?.followersCount || 0).toLocaleString()}
            change={followerGrowth?.growthRate != null ? `+${followerGrowth.growthRate}%` : ''}
            positive
            icon={Users}
            iconColor="text-violet-500"
            iconBg="bg-violet-500/10"
          />
          <StatCard
            label="New This Month"
            value={
              followerGrowth?.thisMonth != null ? followerGrowth.thisMonth.toLocaleString() : '—'
            }
            change=""
            positive
            icon={UserPlus}
            iconColor="text-emerald-500"
            iconBg="bg-green-500/10"
          />
          <StatCard
            label="Page Views"
            value={(stats?.totalViews || 0).toLocaleString()}
            change=""
            positive
            icon={Eye}
            iconColor="text-blue-500"
            iconBg="bg-blue-500/10"
          />
          <StatCard
            label="Engagement Rate"
            value={stats?.engagementRate != null ? `${stats.engagementRate}%` : '—'}
            change=""
            positive
            icon={Heart}
            iconColor="text-rose-500"
            iconBg="bg-rose-500/10"
          />
        </div>
      </section>

      {/* Follower Growth Chart */}
      <section className="space-y-4 pt-8 border-t border-border-subtle">
        <h4 className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">
          Growth Trend
        </h4>
        <div className="p-8 bg-gradient-to-br from-violet-900/20 to-slate-900/40 rounded-3xl border border-violet-500/10 flex items-center justify-center h-48">
          <p className="text-[13px] text-text-tertiary">
            Insufficient historical data to calculate growth trend
          </p>
        </div>
      </section>

      {/* City Breakdown & Top Followers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t border-border-subtle">
        {/* City Breakdown */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-text-tertiary" />
            <h4 className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">
              Audience by City
            </h4>
          </div>
          <div className="space-y-3">
            {cityBreakdown.length === 0 && (
              <p className="text-[13px] text-text-tertiary">
                No geographic data available for followers
              </p>
            )}
            {cityBreakdown.map((city: any, idx: number) => (
              <div key={city.city} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">{city.city}</span>
                  <span className="text-[11px] font-bold text-text-tertiary">
                    {city.count.toLocaleString()} ({city.percentage}%)
                  </span>
                </div>
                <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${city.percentage}%` }}
                    transition={{ delay: idx * 0.1, duration: 0.5 }}
                    className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Top Followers */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-text-tertiary" />
            <h4 className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">
              Top Attending Followers
            </h4>
          </div>
          <div className="space-y-3">
            {topFollowers.length === 0 && (
              <p className="text-[13px] text-text-tertiary">No active followers found</p>
            )}
            {topFollowers.map((follower: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center gap-4 p-4 bg-surface-secondary rounded-2xl border border-border-subtle"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-text-primary font-bold text-sm">
                  {follower.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{follower.name}</p>
                  <p className="text-[10px] text-text-tertiary">
                    {follower.events} events attended
                  </p>
                </div>
                <div className="px-3 py-1 bg-amber-500/10 rounded-full">
                  <span className="text-[10px] font-bold text-amber-500">VIP</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Conversion Metrics */}
      <section className="space-y-4 pt-8 border-t border-border-subtle">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-text-tertiary" />
          <h4 className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">
            Follower Conversion
          </h4>
        </div>
        {conversionMetrics ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ConversionCard
              label="Ticket Purchases"
              value={conversionMetrics.ticketPurchases ?? 0}
              total={stats?.followersCount || 1}
              color="emerald"
            />
            <ConversionCard
              label="Event Attendance"
              value={conversionMetrics.eventAttendance ?? 0}
              total={stats?.followersCount || 1}
              color="violet"
            />
            <ConversionCard
              label="Table Reservations"
              value={conversionMetrics.tableReservations ?? 0}
              total={stats?.followersCount || 1}
              color="amber"
            />
          </div>
        ) : (
          <p className="text-[13px] text-text-tertiary">No conversion events recorded</p>
        )}
      </section>

      {/* Broadcast CTA */}
      <section className="pt-8 border-t border-border-subtle">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-violet-700 p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-surface-elevated/10 rounded-full blur-3xl" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-text-primary" />
                <span className="text-[10px] font-bold text-text-primary/60 uppercase tracking-widest">
                  Reach Your Audience
                </span>
              </div>
              <h3 className="text-2xl font-bold text-text-primary mb-2">Send a Broadcast</h3>
              <p className="text-text-primary/60 text-sm max-w-md">
                Push notifications, announcements, and event drops directly to your{' '}
                {(stats?.followersCount || 0).toLocaleString()} followers
              </p>
            </div>
            <a
              href="#broadcast"
              className="flex items-center gap-2 px-8 py-4 bg-surface-elevated text-violet-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-surface-elevated/90 transition-all shadow-lg"
            >
              <Zap className="w-4 h-4" />
              Create Broadcast
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  change,
  positive,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  icon: any;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <div className="p-6 bg-surface-secondary/50 rounded-2xl border border-border-subtle hover:border-border-strong transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div
          className={`flex items-center gap-1 text-[11px] font-bold ${positive ? 'text-emerald-500' : 'text-red-500'}`}
        >
          {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {change}
        </div>
      </div>
      <p className="text-2xl font-bold text-text-primary mb-1">{value}</p>
      <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">{label}</p>
    </div>
  );
}

function ConversionCard({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: 'emerald' | 'violet' | 'amber';
}) {
  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
  const colorClasses = {
    emerald: {
      bg: 'bg-green-500/10',
      text: 'text-emerald-500',
      bar: 'from-emerald-500 to-emerald-400',
    },
    violet: {
      bg: 'bg-violet-500/10',
      text: 'text-violet-500',
      bar: 'from-violet-500 to-fuchsia-500',
    },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-500', bar: 'from-amber-500 to-orange-500' },
  }[color];

  return (
    <div className="p-6 bg-surface-secondary/50 rounded-2xl border border-border-subtle">
      <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-4">
        {label}
      </p>
      <div className="flex items-end gap-2 mb-3">
        <p className="text-3xl font-bold text-text-primary">{percentage}%</p>
        <p className="text-sm text-text-tertiary pb-1">({value.toLocaleString()} users)</p>
      </div>
      <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8 }}
          className={`h-full bg-gradient-to-r ${colorClasses.bar} rounded-full`}
        />
      </div>
    </div>
  );
}
