'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useEffect, useState } from 'react';
import {
  Search,
  Filter,
  ShieldCheck,
  Mail,
  Phone,
  Zap,
  History,
  Activity,
  AlertCircle,
  TrendingUp,
  BadgeCheck,
  ShieldAlert,
  Ban,
  RotateCcw,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  X,
  User,
  RotateCw,
  Lock,
  Unlock,
} from 'lucide-react';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';
import { useToast } from '@/components/providers/ToastProvider';

export default function AdminPromoters() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [promoters, setPromoters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPromoter, setSelectedPromoter] = useState(null);
  const [modalConfig, setModalConfig] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshedAt, setRefreshedAt] = useState(new Date());

  const fetchPromoters = async () => {
    try {
      setLoading(true);
      const token = await user.getIdToken();

      const [promotersRes, proposalsRes] = await Promise.all([
        fetch('/api/list?collection=promoters', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/list?collection=proposed_actions', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const promotersJson = await promotersRes.json();
      const proposalsJson = await proposalsRes.json();

      const activeProposals = (proposalsJson.data || []).filter((p) => p.status === 'pending');

      const mergedPromoters = (promotersJson.data || []).map((promoter) => {
        const pendingSuspend = activeProposals.find(
          (p) => p.targetId === promoter.id && p.action === 'PROMOTER_SUSPEND',
        );
        const pendingReinstate = activeProposals.find(
          (p) => p.targetId === promoter.id && p.action === 'PROMOTER_ACTIVATE',
        );

        if (pendingSuspend) {
          return { ...promoter, pendingAction: 'suspend', displayStatus: 'Restriction Requested' };
        } else if (pendingReinstate) {
          return { ...promoter, pendingAction: 'reinstate', displayStatus: 'Restore Requested' };
        }
        return { ...promoter, displayStatus: promoter.status };
      });

      setPromoters(mergedPromoters);

      if (selectedPromoter) {
        const updated = mergedPromoters.find((p) => p.id === selectedPromoter.id);
        if (updated) setSelectedPromoter(updated);
      }
      return mergedPromoters;
    } catch (err) {
      console.error('Failed to fetch promoters', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchPromoters();
  }, [user]);

  const handleAction = async (reason, targetId, inputValue, evidence) => {
    if (!modalConfig) return;

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: modalConfig.action,
          targetId: selectedPromoter.id,
          reason,
          evidence,
          params: {
            type: 'promoter',
            message: modalConfig.action === 'WARNING_ISSUE' ? inputValue : undefined,
            weight:
              modalConfig.action === 'DISCOVERY_WEIGHT_ADJUST' ? Number(inputValue) : undefined,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Action failed');
      }

      if (json.message) {
        toast({ type: 'success', message: json.message });
      } else {
        toast({ type: 'success', message: 'Action executed successfully.' });
      }

      await fetchPromoters();
    } catch (err) {
      throw err;
    }
  };

  const [showOnlySuspended, setShowOnlySuspended] = useState(false);

  const exportToCSV = () => {
    const headers = ['ID', 'Name', 'Status', 'Conversion Count', 'Joined Date'];
    const rows = filtered.map((p) => [
      p.id,
      p.name ?? 'Unnamed Partner',
      p.status ?? 'Active',
      p.conversionCount ?? 0,
      p.createdAt ? new Date(p.createdAt).toISOString() : 'N/A',
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `promoter_network_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const filtered = promoters.filter((p) => {
    const matchesSearch =
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = showOnlySuspended ? p.status === 'suspended' : true;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-12 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-iris" strokeWidth={1.5} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-iris">
              Agent Network
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">
            Promoter Network
          </h1>
          <p className="text-sm text-zinc-500 font-medium max-w-xl">
            Manage distribution partners and monitor verified conversion metrics across the
            ecosystem.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowOnlySuspended(!showOnlySuspended)}
            className={`flex items-center gap-2.5 px-6 py-3 rounded-xl border text-[11px] font-bold uppercase tracking-widest transition-all ${showOnlySuspended ? 'bg-iris text-white border-iris shadow-lg shadow-iris/20' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'}`}
          >
            <Filter className="w-4 h-4" />
            {showOnlySuspended ? 'Showing Suspended' : 'Filter Suspended'}
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-400 text-[11px] font-bold uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all font-mono-numbers"
          >
            <TrendingUp className="w-4 h-4" />
            Export Network
          </button>
        </div>
      </div>

      {/* Refresh Bar */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#A1A1AA]">
          Last updated{' '}
          {refreshedAt
            ? refreshedAt.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })
            : '—'}
        </span>
        <button
          onClick={async () => {
            await fetchPromoters();
            setRefreshedAt(new Date());
          }}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all text-[11px] font-bold uppercase tracking-widest disabled:opacity-50"
        >
          <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          REFRESH
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* List Area */}
        <div className="lg:col-span-8 space-y-6">
          <div className="relative group">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-500 group-focus-within:text-zinc-300 transition-colors"
              strokeWidth={1.5}
            />
            <input
              type="text"
              placeholder="Filter distribution partners by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 focus:bg-zinc-900 transition-all font-medium placeholder:text-zinc-600 text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-48 rounded-xl bg-obsidian-surface animate-pulse border border-[#ffffff08]"
                />
              ))
            ) : filtered.length > 0 ? (
              filtered.map((promoter) => (
                <div
                  key={promoter.id}
                  onClick={() => setSelectedPromoter(promoter)}
                  className={`p-6 rounded-xl border transition-all cursor-pointer group relative overflow-hidden ${
                    selectedPromoter?.id === promoter.id
                      ? 'bg-white/[0.05] border-white/10 shadow-lg'
                      : 'bg-obsidian-surface border-[#ffffff08] hover:border-white/10 hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center text-sm font-bold text-white group-hover:scale-105 transition-transform">
                      {promoter.name?.[0] || 'P'}
                    </div>
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[9px] font-bold uppercase tracking-widest ${
                        (promoter.displayStatus || promoter.status) === 'active'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                          : (promoter.displayStatus || promoter.status) ===
                                'Restriction Requested' ||
                              (promoter.displayStatus || promoter.status) === 'pending'
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                            : (promoter.displayStatus || promoter.status) === 'Restore Requested'
                              ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400'
                              : 'bg-iris/10 border-iris/20 text-iris'
                      }`}
                    >
                      <div
                        className={`h-1.5 w-1.5 rounded-full ${
                          (promoter.displayStatus || promoter.status) === 'active'
                            ? 'bg-emerald-500'
                            : (promoter.displayStatus || promoter.status) ===
                                  'Restriction Requested' ||
                                (promoter.displayStatus || promoter.status) === 'pending'
                              ? 'bg-amber-500 animate-pulse'
                              : (promoter.displayStatus || promoter.status) === 'Restore Requested'
                                ? 'bg-emerald-400 animate-pulse'
                                : 'bg-iris'
                        }`}
                      />
                      {(promoter.displayStatus || promoter.status) ?? 'Active'}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold tracking-tight text-white">
                      {promoter.name ?? 'Unnamed Partner'}
                    </h3>
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                      ID: {promoter.id?.slice(0, 12)}
                    </p>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-black/20 border border-white/[0.02]">
                      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-500 mb-0.5">
                        Impact
                      </p>
                      <p className="text-lg font-semibold text-white tracking-tight">
                        {promoter.conversionCount ?? 0}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-black/20 border border-white/[0.02]">
                      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-500 mb-0.5">
                        Created
                      </p>
                      <p className="text-lg font-semibold text-white tracking-tight">
                        {promoter.createdAt
                          ? new Date(promoter.createdAt).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-24 text-center rounded-xl border border-[#ffffff08] bg-white/[0.01]">
                <Zap className="h-12 w-12 text-zinc-800 mx-auto mb-4" strokeWidth={1} />
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">
                  No active partners
                  <br />
                  detected in the network.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <aside className="lg:col-span-4">
          {selectedPromoter ? (
            <div className="sticky top-28 space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="bg-obsidian-surface border border-[#ffffff08] rounded-xl p-8 space-y-8 shadow-2xl relative">
                <button
                  onClick={() => setSelectedPromoter(null)}
                  className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>

                <div className="space-y-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="h-20 w-20 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center text-2xl font-bold text-white shadow-inner">
                      {selectedPromoter.name?.[0]}
                    </div>
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight text-white mb-1">
                        {selectedPromoter.name}
                      </h3>
                      <p className="text-[10px] font-bold text-iris uppercase tracking-widest">
                        Network Partner
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-6 pt-6 border-t border-[#ffffff05]">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 px-1">
                      Partner Controls
                    </p>

                    <div className="space-y-3">
                      {selectedPromoter?.pendingAction && (
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[11px] font-semibold flex items-center gap-2 mb-2 select-none animate-in fade-in duration-300">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>
                            A request to{' '}
                            {selectedPromoter.pendingAction === 'suspend' ? 'restrict' : 'restore'}{' '}
                            this partner is currently pending approval. Duplicate requests are
                            disabled.
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() =>
                          setModalConfig({
                            action: 'WARNING_ISSUE',
                            title: 'Issue Partner Warning',
                            message: 'Dispatches a compliance notice regarding policy violations.',
                            label: 'Send Warning',
                            inputLabel: 'Warning Reason',
                            inputPlaceholder: 'Describe the policy violation...',
                            type: 'warning',
                          })
                        }
                        className="w-full flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <AlertCircle className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
                          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">
                            Warn Partner
                          </span>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-zinc-600 transition-transform group-hover:translate-x-1" />
                      </button>

                      {selectedPromoter.status === 'active' ? (
                        <button
                          disabled={!!selectedPromoter?.pendingAction}
                          onClick={() =>
                            setModalConfig({
                              action: 'PROMOTER_SUSPEND',
                              title: 'Restrict Collaboration',
                              message:
                                'Deactivate partner operations immediately. Requires security clearance.',
                              label: 'Confirm Restriction',
                              type: 'danger',
                              isTier2: true,
                            })
                          }
                          className="w-full flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-iris/30 hover:bg-iris/5 transition-all group disabled:opacity-20 disabled:cursor-not-allowed"
                        >
                          <div className="flex items-center gap-3">
                            <Lock className="h-4 w-4 text-iris" strokeWidth={1.5} />
                            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">
                              Restrict Partner
                            </span>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-zinc-600 transition-transform group-hover:translate-x-1" />
                        </button>
                      ) : (
                        <button
                          disabled={!!selectedPromoter?.pendingAction}
                          onClick={() =>
                            setModalConfig({
                              action: 'PROMOTER_ACTIVATE',
                              title: 'Restore Partner',
                              message:
                                'Restores full distribution capabilities and platform access.',
                              label: 'Restore Partner',
                              type: 'info',
                              isTier2: true,
                            })
                          }
                          className="w-full flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 transition-all group shadow-lg shadow-emerald-500/10 disabled:opacity-20 disabled:cursor-not-allowed"
                        >
                          <div className="flex items-center gap-3">
                            <Unlock className="h-4 w-4" strokeWidth={1.5} />
                            <span className="text-[11px] font-bold uppercase tracking-widest">
                              Restore Partner
                            </span>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2 text-center">
                  <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest italic opacity-50">
                    Monitoring immutable network logs.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[400px] flex flex-col items-center justify-center rounded-xl border border-[#ffffff05] bg-white/[0.01] text-center p-8 sticky top-28">
              <Zap className="h-12 w-12 text-zinc-800 mb-6" strokeWidth={1} />
              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">
                Select a partner node
                <br />
                for deep audit.
              </p>
            </div>
          )}
        </aside>
      </div>

      {modalConfig && (
        <AdminConfirmModal
          isOpen={!!modalConfig}
          onClose={() => setModalConfig(null)}
          onConfirm={handleAction}
          title={modalConfig.title}
          message={modalConfig.message}
          actionLabel={modalConfig.label}
          type={modalConfig.type}
          inputLabel={modalConfig.inputLabel}
          inputType={modalConfig.inputType}
          inputPlaceholder={modalConfig.inputPlaceholder}
          isTier2={modalConfig.isTier2}
          isTier3={modalConfig.isTier3}
        />
      )}
    </div>
  );
}
