'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useEffect, useState, useMemo } from 'react';
import { Search, Percent, Users, TrendingUp, AlertCircle, Plus, X } from 'lucide-react';
import { PageSkeleton } from '@/components/ui/PageSkeleton';

interface Promo {
  id: string;
  code?: string;
  type?: string;
  value?: number;
  limit?: number;
  expiry?: string;
  used?: number;
  disabled?: boolean;
  flagged?: boolean;
  isPartner?: boolean;
}

interface PromoForm {
  code: string;
  type: string;
  value: string;
  limit: string;
  expiry: string;
}

export default function AdminPromotions() {
  const { user } = useAuth();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PromoForm>({ code: '', type: 'percent', value: '', limit: '', expiry: '' });

  const fetchPromos = async () => {
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/list?collection=promotions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { data: Promo[] };
      setPromos(json.data || []);
    } catch (err) {
      console.error('Failed to fetch promotions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchPromos();
  }, [user]);

  const filtered = useMemo(
    () =>
      promos.filter(
        (p: Promo) =>
          p.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.id?.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [promos, searchTerm],
  );

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.code.trim() || !form.value) return;
    setCreating(true);
    try {
      const token = await user.getIdToken();
      const promoId = `promo_${Date.now()}`;
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DATABASE_CORRECTION',
          targetId: 'promotions',
          reason: `New promo code created: ${form.code.toUpperCase()}`,
          params: {
            type: 'config',
            id: promoId,
            after: {
              code: form.code.toUpperCase().trim(),
              type: form.type,
              value: Number(form.value),
              limit: form.limit ? Number(form.limit) : null,
              expiry: form.expiry || null,
              used: 0,
              disabled: false,
              createdAt: new Date().toISOString(),
            },
          },
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Failed to create promo');
      setShowCreate(false);
      setForm({ code: '', type: 'percent', value: '', limit: '', expiry: '' });
      await fetchPromos();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <PageSkeleton sections={['header', 'kpi', 'table']} />;

  return (
    <div className="space-y-12 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Percent className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">
              Marketing & Growth
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">
            Promo Management
          </h1>
          <p className="text-sm text-zinc-500 font-medium max-w-xl">
            Create discount codes, manage influencer campaigns, and track referral performance.
          </p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white text-black text-[11px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-lg shadow-white/5"
        >
          <Plus className="h-4 w-4" />
          New Promo Code
        </button>
      </div>

      {/* Strategy Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Active Codes',
            value: loading
              ? '--'
              : promos.filter((p: Promo) => !p.disabled && (!p.expiry || new Date(p.expiry) > new Date()))
                  .length,
            icon: Percent,
            color: 'text-emerald-500',
          },
          {
            label: 'Partner Codes',
            value: loading ? '--' : promos.filter((p: Promo) => p.isPartner).length,
            icon: Users,
            color: 'text-emerald-500',
          },
          {
            label: 'Total Usage',
            value: loading ? '--' : promos.reduce((sum: number, p: Promo) => sum + (p.used || 0), 0),
            icon: TrendingUp,
            color: 'text-emerald-500',
          },
          {
            label: 'Flagged Codes',
            value: loading ? '--' : promos.filter((p: Promo) => p.flagged).length,
            icon: AlertCircle,
            color: 'text-zinc-600',
          },
        ].map((item, i) => (
          <div
            key={i}
            className="p-8 rounded-xl bg-obsidian-surface border border-[#ffffff08] shadow-sm group hover:border-[#ffffff15] transition-all"
          >
            <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center mb-6 shadow-inner group-hover:scale-105 transition-transform">
              <item.icon className={`h-5 w-5 ${item.color}`} strokeWidth={1.5} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1">
              {item.label}
            </p>
            <p className="text-3xl font-light text-white tracking-tight font-mono-numbers">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Active Registry */}
      <div className="space-y-6">
        <div className="flex gap-4 items-center px-1">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-600 group-focus-within:text-zinc-300 transition-colors" />
            <input
              type="text"
              placeholder="Find promo codes or active campaigns..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 transition-all font-medium placeholder:text-zinc-700 text-white"
            />
          </div>
        </div>

        <div className="rounded-xl border border-[#ffffff08] bg-obsidian-surface shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-[#ffffff08]">
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Promo Identifier
                </th>
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Discount Logic
                </th>
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Utilization
                </th>
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Valid Until
                </th>
                <th className="px-8 py-4 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ffffff05]">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-8 py-10 h-20 bg-white/[0.01]" />
                  </tr>
                ))
              ) : filtered.length > 0 ? (
                filtered.map((p: Promo) => (
                  <tr
                    key={p.id}
                    className="hover:bg-white/[0.01] transition-all cursor-pointer group"
                  >
                    <td className="px-8 py-8">
                      <p className="text-base font-semibold tracking-tight text-white uppercase">
                        {p.code || 'No Code'}
                      </p>
                    </td>
                    <td className="px-8 py-8">
                      <div className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">
                          {p.type === 'percent' ? `${p.value}% OFF` : `₹${p.value} OFF`}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-8">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                        {p.used ?? 0} / {p.limit ?? 'Unlimited'} Uses
                      </p>
                    </td>
                    <td className="px-8 py-8">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                        {p.expiry
                          ? new Date(p.expiry).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'Always Active'}
                      </p>
                    </td>
                    <td className="px-8 py-8 text-right">
                      <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border ${p.disabled ? 'bg-zinc-800 border-white/5 text-zinc-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}
                      >
                        <div
                          className={`h-1 w-1 rounded-full ${p.disabled ? 'bg-zinc-500' : 'bg-emerald-500'}`}
                        />
                        <span className="text-[9px] font-bold uppercase tracking-widest">
                          {p.disabled ? 'Disabled' : 'Active'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-8 py-24 text-center">
                    <div className="h-16 w-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/5 shadow-inner">
                      <Percent className="h-8 w-8 text-zinc-800" strokeWidth={1} />
                    </div>
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">
                      {searchTerm ? 'No matching codes' : 'No active promos'}
                    </h4>
                    <p className="text-[10px] text-zinc-600 mt-2 font-bold uppercase tracking-[0.2em]">
                      Create a code to start a new campaign.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Promo Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-[#ffffff12] rounded-2xl p-8 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setShowCreate(false)}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <h2 className="text-xl font-semibold text-white mb-1 tracking-tight">New Promo Code</h2>
            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mb-8">
              Requires Super Admin clearance
            </p>
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Code
                </label>
                <input
                  required
                  value={form.code}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. LAUNCH20"
                  className="w-full bg-black/40 border border-[#ffffff08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-white/10 font-mono uppercase"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Type
                  </label>
                  <select
                    value={form.type}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full bg-black/40 border border-[#ffffff08] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/10"
                  >
                    <option value="percent">Percent %</option>
                    <option value="fixed">Fixed ₹</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Value
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={form.value}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, value: e.target.value }))}
                    placeholder="e.g. 20"
                    className="w-full bg-black/40 border border-[#ffffff08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-white/10"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Usage Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.limit}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, limit: e.target.value }))}
                    placeholder="Unlimited"
                    className="w-full bg-black/40 border border-[#ffffff08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-white/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={form.expiry}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, expiry: e.target.value }))}
                    className="w-full bg-black/40 border border-[#ffffff08] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/10"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={creating}
                className="w-full py-3.5 rounded-xl bg-white text-black text-[11px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Promo Code'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
