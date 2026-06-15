'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, RefreshCw, XCircle, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { formatINR } from '@/lib/finance/definitions';

type CommissionStatus = 'pending' | 'clearing' | 'cleared' | 'paid' | 'reversed';

interface Commission {
  id: string;
  eventId: string;
  eventName: string;
  linkCode?: string;
  ticketsSold: number;
  revenue: number;
  commissionRate: number;
  commissionAmount: number;
  status: CommissionStatus;
  createdAt?: string;
  settledAt?: string;
}

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  pending: { label: 'Pending', classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  clearing: { label: 'Clearing', classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  cleared: {
    label: 'Cleared',
    classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  paid: { label: 'Paid', classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  reversed: { label: 'Reversed', classes: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

export default function PromoterCommissionsPage() {
  const { profile, getIdToken } = useDashboardAuth();
  const promoterId = profile?.activeMembership?.partnerId;

  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = useCallback(async () => {
    if (!promoterId) return;
    setLoading(true);
    setError(null);
    try {
      const token = typeof getIdToken === 'function' ? await getIdToken() : '';
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const params = new URLSearchParams({ promoterId, limit: '100' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/partners/promoters/commissions?${params}`, { headers });
      if (!res.ok) throw new Error('Failed to load commissions');
      const d = await res.json();
      setCommissions(d.commissions || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load commissions');
    } finally {
      setLoading(false);
    }
  }, [promoterId, getIdToken, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Aggregate summary
  const totalPending = commissions
    .filter((c) => c.status === 'pending' || c.status === 'clearing')
    .reduce((s, c) => s + (c.commissionAmount || 0), 0);
  const totalCleared = commissions
    .filter((c) => c.status === 'cleared' || c.status === 'paid')
    .reduce((s, c) => s + (c.commissionAmount || 0), 0);
  const totalAll = commissions.reduce((s, c) => s + (c.commissionAmount || 0), 0);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col items-start gap-4 pb-6 border-b border-border-subtle sm:flex-row sm:items-center">
        <Link
          href="/promoter/finance"
          className="p-2 border border-border-subtle hover:bg-surface-elevated rounded-xl transition-colors text-text-secondary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Commissions</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Per-event commission breakdown across all your assignments.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2.5 border border-border-subtle hover:bg-surface-elevated rounded-xl transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 text-text-secondary ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary KPIs */}
      {!loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'Lifetime', value: formatINR(totalAll), dim: false },
            { label: 'Cleared', value: formatINR(totalCleared), dim: false },
            { label: 'Pending', value: formatINR(totalPending), dim: true },
          ].map((s) => (
            <div
              key={s.label}
              className={`flex flex-col p-5 rounded-2xl border ${s.dim ? 'border-amber-500/20 bg-amber-500/5' : 'border-border-subtle bg-surface-elevated'}`}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">
                {s.label}
              </span>
              <p
                className={`text-xl font-bold tabular-nums ${s.dim ? 'text-amber-400' : 'text-text-primary'}`}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {['all', 'pending', 'cleared', 'paid'].map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
              statusFilter === f
                ? 'bg-emerald-500 text-white'
                : 'bg-surface-elevated border border-border-subtle text-text-secondary hover:text-text-primary'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="w-full animate-pulse space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-16 bg-surface-elevated rounded-2xl border border-border-subtle"
            />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-6 bg-red-500/5 border border-red-500/20 rounded-2xl text-red-400">
          <XCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Failed to load commissions</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
          <button onClick={fetchData} className="ml-auto text-sm underline">
            Retry
          </button>
        </div>
      ) : (
        <div className="bg-surface-elevated rounded-2xl border border-border-subtle overflow-hidden">
          <div className="p-5 border-b border-border-subtle bg-surface-base/50 flex items-center justify-between">
            <h3 className="font-bold text-text-primary flex items-center gap-2">
              <Receipt className="h-4 w-4 text-emerald-500" />
              Commission Ledger
            </h3>
            <span className="text-xs text-text-muted">
              {commissions.length} record{commissions.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-base/30">
                  <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                    Tickets
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider text-right">
                    Commission
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {commissions.map((c) => {
                  const sc = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.pending;
                  return (
                    <tr key={c.id} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-text-primary text-sm">
                          {c.eventName || 'Event'}
                        </p>
                        {c.linkCode && (
                          <span className="text-[10px] font-mono text-text-muted bg-surface-tertiary border border-border-subtle px-1.5 py-0.5 rounded mt-0.5 inline-block">
                            /e/{c.linkCode}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 tabular-nums text-sm text-text-secondary font-medium">
                        {c.ticketsSold ?? 0}
                      </td>
                      <td className="px-6 py-4 tabular-nums text-sm text-text-secondary font-medium">
                        {formatINR(c.revenue ?? 0)}
                      </td>
                      <td className="px-6 py-4 tabular-nums text-sm text-text-secondary font-medium">
                        {c.commissionRate ?? 0}%
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${sc.classes}`}
                        >
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold tabular-nums text-emerald-400">
                        +{formatINR(c.commissionAmount ?? 0)}
                      </td>
                    </tr>
                  );
                })}
                {commissions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                      No commissions found
                      {statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
