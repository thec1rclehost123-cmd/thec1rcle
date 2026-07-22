// @ts-nocheck
'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Users,
  Building2,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  History,
  Activity,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Download,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { apiGet, getToken } from '@/lib/api/client';
import { queryKeys } from '@/lib/api/queryKeys';

interface LogEntry {
  id: string;
  action: string;
  timestamp: string;
  reason?: string;
}

interface AlertEntry {
  id: string;
  message: string;
  priority: string;
  type: string;
}

interface TrendData {
  thisWeek?: number;
  percentChange: number;
}

interface SnapshotData {
  snapshot: {
    revenue?: { total?: number };
    hosts_total?: number;
    venues_total?: { active?: number; pending?: number; suspended?: number };
    users_total?: number;
    events?: { live?: number; total?: number };
    tickets_sold_total?: number;
    queues?: {
      venues?: number;
      hosts?: number;
      refunds?: number;
      incidents?: number;
      webhooks?: number;
      payouts?: number;
    };
  };
  trends?: {
    users?: TrendData;
    revenue?: TrendData;
  };
  alertsCount: number;
  recentLogs: LogEntry[];
  alerts: AlertEntry[];
}

function Sparkline({ percentChange }: { percentChange: number }) {
  const up = percentChange >= 0;
  const path = up
    ? 'M0,20 Q12,0 24,8 T48,4'
    : 'M0,4 Q12,20 24,12 T48,16';
  return (
    <svg width="48" height="24" viewBox="0 0 48 24" className="flex-shrink-0">
      <path d={path} fill="none" stroke={up ? '#10b981' : '#f43f5e'} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function formatter(value: number): string {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
  if (value >= 1_000) return (value / 1_000).toFixed(1) + 'K';
  return value.toLocaleString();
}

export default function AdminDashboard() {
  const { user } = useAuth();

  const { data, isLoading, isError, refetch, dataUpdatedAt } = useQuery<SnapshotData>({
    queryKey: queryKeys.dashboard.kpi(),
    queryFn: async () => {
      const token = await getToken(user);
      return apiGet<SnapshotData>('/api/snapshot', token);
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });

  const snapshot = data?.snapshot || {};
  const logs = data?.recentLogs || [];
  const alerts = data?.alerts || [];
  const trends = data?.trends;

  const totalPartners = (snapshot.hosts_total || 0) + (snapshot.venues_total?.active || 0);
  const userTrend = trends?.users;
  const revenueTrend = trends?.revenue;

  const stats = [
    {
      label: 'Total Revenue',
      value: (snapshot.revenue?.total || 0).toLocaleString(),
      prefix: '₹',
      icon: TrendingUp,
      trend: revenueTrend
        ? `${revenueTrend.percentChange > 0 ? '+' : ''}${revenueTrend.percentChange}%`
        : '—',
      trendUp: revenueTrend ? revenueTrend.percentChange >= 0 : null,
      sparkline: revenueTrend?.percentChange,
      href: '/payments',
    },
    {
      label: 'Verified Partners',
      value: formatter(totalPartners),
      icon: Building2,
      trend: userTrend ? `${userTrend.percentChange > 0 ? '+' : ''}${userTrend.percentChange}%` : '—',
      trendUp: userTrend ? userTrend.percentChange >= 0 : null,
      sparkline: userTrend?.percentChange,
      href: '/hosts',
    },
    {
      label: 'Platform Users',
      value: formatter(snapshot.users_total || 0),
      icon: Users,
      trend: userTrend
        ? `${userTrend.thisWeek ? '+' + userTrend.thisWeek + ' this week' : '—'}`
        : '—',
      trendUp: userTrend ? (userTrend.thisWeek || 0) >= 0 : null,
      href: '/users',
    },
    {
      label: 'Active Nodes',
      value: `${alerts.length}`,
      icon: Activity,
      trend: alerts.length === 0 ? 'All clear' : `${alerts.length} flag${alerts.length > 1 ? 's' : ''}`,
      trendUp: alerts.length === 0 ? true : false,
      href: '/health',
    },
  ];

  const handleExport = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getToken(user);
      const res = await fetch('/api/exports?collection=admin_audit_logs&limit=500', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `c1rcle_audit_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
    }
  }, [user]);

  const cleanJargon = (text: string) => {
    if (!text) return text;
    const normalized = text.replace(/ /g, '_').toUpperCase();
    const mapping: Record<string, string> = {
      IDENTITY_MIGRATION_RUN: 'System Profile Sync',
      IDENTITY_MIGRATION: 'System Profile Sync',
      ONBOARDING_REJECT: 'Application Denied',
      ONBOARDING_APPROVE: 'Member Verified',
      EVENT_PAUSE: 'Sales Restricted',
      EVENT_RESUME: 'Sales Restored',
      USER_BAN: 'Access Revoked',
      USER_UNBAN: 'Access Restored',
      VENUE_SUSPEND: 'Partner Restricted',
      VENUE_REINSTATE: 'Partner Restored',
      PROMOTER_SUSPEND: 'Network Access Restricted',
      PROMOTER_ACTIVATE: 'Network Access Restored',
      PROMOTER_DISABLE: 'Access Permanently Revoked',
      DISCOVERY_WEIGHT_ADJUST: 'Priority Score Update',
      WARNING_ISSUE: 'Compliance Notice Sent',
      VERIFICATION_ISSUE: 'Partner Verified',
      VERIFICATION_REVOKE: 'Verification Withdrawn',
      COMMISSION_ADJUST: 'Fee Structure Modified',
      PAYOUT_FREEZE: 'Payouts Restricted',
      PAYOUT_RELEASE: 'Payouts Authorized',
    };
    const cleaned =
      mapping[normalized] ||
      text
        .replace(/_/g, ' ')
        .split(' ')
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ');
    return cleaned
      .replace(/Manual Migration Bridge Executed/i, 'Administrative bridge sync completed')
      .replace(/Processed (\d+) Identities/i, '$1 profiles updated')
      .replace(/Admin action recorded in log/i, 'System verification recorded');
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse pb-20">
        <div className="h-32 bg-white/5 rounded-xl border border-white/5" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_: unknown, i: number) => (
            <div key={i} className="h-32 bg-white/5 rounded-xl border border-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-32 rounded-xl border border-iris/20 bg-iris/5 gap-4 text-center">
        <ShieldAlert className="h-10 w-10 text-iris" strokeWidth={1.5} />
        <div>
          <p className="text-sm font-bold text-white">Failed to load dashboard</p>
          <p className="text-[11px] text-zinc-500 mt-1">
            Could not reach the platform snapshot. Check your connection and try again.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-[11px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-24">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-1.5 w-1.5 rounded-full bg-iris shadow-[0_0_8px_rgba(99,102,241,0.4)]"></div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-iris">
              Platform Overview
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Authority Node</h1>
          <p className="text-sm text-zinc-500 font-medium max-w-xl">
            High-level health metrics and governance controls for THE C1RCLE.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="h-9 px-4 rounded-md bg-white/5 border border-white/10 text-zinc-400 text-[11px] font-bold uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="h-9 px-4 rounded-md bg-white text-black text-[11px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            Export Audit
          </button>
        </div>
      </header>

      {/* Metrics Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {displayedStats.map((stat, i) => (
          <Link href={stat.href} key={i} className="group">
            <div className="p-6 rounded-xl bg-obsidian-surface border border-[#ffffff08] hover:border-[#ffffff12] transition-all relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500 group-hover:text-zinc-300 transition-colors">
                  {stat.label}
                </p>
                <stat.icon
                  className="h-4 w-4 text-zinc-600 group-hover:text-white transition-colors"
                  strokeWidth={1.5}
                />
              </div>
              <div className="flex items-baseline gap-1">
                {stat.prefix && (
                  <span className="text-xl font-medium text-zinc-500 tracking-tighter">
                    {stat.prefix}
                  </span>
                )}
                <span className="text-4xl font-light tracking-tight text-white font-mono-numbers">
                  {stat.value}
                </span>
              </div>
              <div className="mt-5 flex items-center gap-2">
                {stat.trendUp !== null ? (
                  <div
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-[10px] font-bold ${stat.trendUp ? 'text-emerald-500 bg-emerald-500/10' : 'text-iris bg-iris/10'}`}
                  >
                    {stat.trendUp ? (
                      <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" strokeWidth={2} />
                    )}
                    {stat.trend}
                  </div>
                ) : (
                  <div className="h-1.5 w-6 rounded-full bg-white/5"></div>
                )}
                {stat.sparkline !== undefined && (
                  <Sparkline percentChange={stat.sparkline} />
                )}
              </div>
            </div>
          </Link>
        ))}
      </section>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Alerts & Tasks */}
        <div className="lg:col-span-8 space-y-12">
          {/* Active Tasks */}
          <section>
            <div className="flex items-center justify-between mb-6 px-1">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Pending Approvals
              </h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Venues', count: snapshot.queues?.venues || 0, href: '/venues' },
                { label: 'Hosts', count: snapshot.queues?.hosts || 0, href: '/hosts' },
                { label: 'Refunds', count: snapshot.queues?.refunds || 0, href: '/payments' },
                { label: 'Support', count: snapshot.queues?.incidents || 0, href: '/support' },
              ].map((q, i) => (
                <Link href={q.href} key={i}>
                  <div className="p-5 rounded-xl bg-obsidian-surface border border-[#ffffff08] hover:bg-white/[0.02] hover:border-[#ffffff15] transition-all group">
                    <p className="text-3xl font-light text-white mb-1 font-mono-numbers group-hover:translate-x-1 transition-transform">
                      {q.count}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      {q.label}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Alerts */}
          <section>
            <div className="flex items-center justify-between mb-6 px-1">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 uppercase">
                Security Alerts
              </h2>
              <div className="px-2 py-1 rounded bg-zinc-900 border border-white/5 text-[9px] font-bold text-iris uppercase tracking-widest">
                {alerts.length} Flagged
              </div>
            </div>
            <div className="space-y-2">
              {alerts.length > 0 ? (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-obsidian-surface border border-[#ffffff08] group"
                  >
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center ${alert.priority === 'high' ? 'bg-iris/10 text-iris' : 'bg-amber-500/10 text-amber-500'}`}
                    >
                      <AlertCircle className="h-4.5 w-4.5" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{alert.message}</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5 font-bold">
                        Priority: {alert.priority}
                      </p>
                    </div>
                    <Link href={alert.type === 'approval' ? '/approvals' : '/support'}>
                      <button className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100">
                        Resolve Tool
                      </button>
                    </Link>
                  </div>
                ))
              ) : (
                <div className="py-16 text-center rounded-xl border border-[#ffffff08] bg-white/[0.01]">
                  <CheckCircle2 className="h-8 w-8 text-zinc-800 mx-auto mb-4" strokeWidth={1} />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                    No active alerts detected.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Activity Feed */}
        <aside className="lg:col-span-4 h-fit">
          <div className="p-6 rounded-xl bg-obsidian-surface border border-[#ffffff08] bg-obsidian-surface/50 sticky top-28 shadow-2xl">
            <div className="flex items-center justify-between mb-10 px-2">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Audit Log
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest">
                  {dataUpdatedAt
                    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : ''}
                </span>
                <button
                  onClick={() => refetch()}
                  className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-zinc-600 hover:text-zinc-400 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            <div className="space-y-8 relative">
              {/* Linear timeline line */}
              <div className="absolute left-[7px] top-1 bottom-1 w-px bg-white/5" />

              {logs.map((log) => (
                <div key={log.id} className="relative pl-8">
                  <div className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full bg-obsidian-surface border border-white/10 flex items-center justify-center z-10 shadow-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                  </div>
                  <p className="text-[11px] font-bold text-white uppercase tracking-widest mb-1.5 leading-none">
                    {cleanJargon(log.action)}
                  </p>
                  <p className="text-[10px] text-zinc-600 mb-2 font-bold uppercase tracking-widest">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    •{' '}
                    {new Date(log.timestamp).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.03] text-[10px] text-zinc-500 leading-relaxed font-bold uppercase tracking-tight transition-colors hover:border-white/10 hover:text-zinc-400">
                    {cleanJargon(log.reason) || 'System verification recorded.'}
                  </div>
                </div>
              ))}

              {logs.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                    Monitoring active traffic...
                  </p>
                </div>
              )}
            </div>
            <Link href="/logs">
              <button className="w-full mt-10 py-4 rounded-xl bg-white/5 border border-white/5 text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                View Full History
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
