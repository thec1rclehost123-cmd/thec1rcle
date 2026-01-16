"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
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
    User
} from "lucide-react";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";

export default function AdminPromoters() {
    const { user } = useAuth();
    const [promoters, setPromoters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPromoter, setSelectedPromoter] = useState(null);
    const [modalConfig, setModalConfig] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchPromoters = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/list?collection=promoters', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            setPromoters(json.data || []);
        } catch (err) {
            console.error("Failed to fetch promoters", err);
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
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: modalConfig.action,
                    targetId: selectedPromoter.id,
                    reason,
                    evidence,
                    params: {
                        type: 'promoter',
                        message: modalConfig.action === 'WARNING_ISSUE' ? inputValue : undefined,
                        weight: modalConfig.action === 'DISCOVERY_WEIGHT_ADJUST' ? Number(inputValue) : undefined
                    }
                })
            });

            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error || "Action failed");
            }

            if (json.message) alert(json.message);

            await fetchPromoters();
            if (selectedPromoter) {
                const updated = json.data || promoters.find(p => p.id === selectedPromoter.id);
                if (updated) setSelectedPromoter(updated);
            }

        } catch (err) {
            alert(`Authority Error: ${err.message}`);
            throw err;
        }
    };

    const [showOnlySuspended, setShowOnlySuspended] = useState(false);

    const exportToCSV = () => {
        const headers = ["ID", "Name", "Status", "Conversion Count", "Joined Date"];
        const rows = filtered.map(p => [
            p.id,
            p.name || 'Unnamed Partner',
            p.status || 'Active',
            p.conversionCount || 0,
            p.createdAt ? new Date(p.createdAt).toISOString() : 'N/A'
        ]);

        const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `promoter_network_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    const filtered = promoters.filter(p => {
        const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-iris">Agent Network</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Promoter Network</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        Manage distribution partners and monitor verified conversion metrics across the ecosystem.
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* List Area */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-500 group-focus-within:text-zinc-300 transition-colors" strokeWidth={1.5} />
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
                                <div key={i} className="h-48 rounded-xl bg-obsidian-surface animate-pulse border border-[#ffffff08]" />
                            ))
                        ) : filtered.length > 0 ? (
                            filtered.map((promoter) => (
                                <div
                                    key={promoter.id}
                                    onClick={() => setSelectedPromoter(promoter)}
                                    className={`p-6 rounded-xl border transition-all cursor-pointer group relative overflow-hidden ${selectedPromoter?.id === promoter.id ? 'bg-white/[0.05] border-white/10 shadow-lg' : 'bg-obsidian-surface border-[#ffffff08] hover:border-white/10 hover:bg-white/[0.02]'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center text-sm font-bold text-white group-hover:scale-105 transition-transform">
                                            {promoter.name?.[0] || 'P'}
                                        </div>
                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[9px] font-bold uppercase tracking-widest ${promoter.status === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                                            promoter.status === 'suspended' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                                                'bg-iris/10 border-iris/20 text-iris'
                                            }`}>
                                            <div className={`h-1 w-1 rounded-full ${promoter.status === 'active' ? 'bg-emerald-500' :
                                                promoter.status === 'suspended' ? 'bg-amber-500' : 'bg-iris'
                                                }`} />
                                            {promoter.status || 'Active'}
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <h3 className="text-lg font-semibold tracking-tight text-white">{promoter.name || 'Unnamed Partner'}</h3>
                                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">ID: {promoter.id?.slice(0, 12)}</p>
                                    </div>

                                    <div className="mt-6 grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-lg bg-black/20 border border-white/[0.02]">
                                            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-500 mb-0.5">Impact</p>
                                            <p className="text-lg font-semibold text-white tracking-tight">{promoter.conversionCount || 0}</p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-black/20 border border-white/[0.02]">
                                            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-500 mb-0.5">Created</p>
                                            <p className="text-lg font-semibold text-white tracking-tight">{promoter.createdAt ? new Date(promoter.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full py-24 text-center rounded-xl border border-[#ffffff08] bg-white/[0.01]">
                                <Zap className="h-12 w-12 text-zinc-800 mx-auto mb-4" strokeWidth={1} />
                                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">No active partners<br />detected in the network.</p>
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
                                            <h3 className="text-2xl font-semibold tracking-tight text-white mb-1">{selectedPromoter.name}</h3>
                                            <p className="text-[10px] font-bold text-iris uppercase tracking-widest">Network Partner</p>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="space-y-6 pt-6 border-t border-[#ffffff05]">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 px-1">Partner Controls</p>

                                        <div className="space-y-3">
                                            <button
                                                onClick={() => setModalConfig({
                                                    action: 'WARNING_ISSUE',
                                                    title: 'Issue Partner Warning',
                                                    message: 'Dispatches a compliance notice regarding policy violations.',
                                                    label: 'Send Warning',
                                                    inputLabel: 'Warning Reason',
                                                    inputPlaceholder: 'Describe the policy violation...',
                                                    type: 'warning'
                                                })}
                                                className="w-full flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <AlertCircle className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
                                                    <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">Warn Partner</span>
                                                </div>
                                                <ChevronRight className="h-3.5 w-3.5 text-zinc-600 transition-transform group-hover:translate-x-1" />
                                            </button>

                                            {selectedPromoter.status === 'active' ? (
                                                <button
                                                    onClick={() => setModalConfig({
                                                        action: 'PROMOTER_SUSPEND',
                                                        title: 'Suspend Partner',
                                                        message: 'Temporarily halts all distribution links and platform access.',
                                                        label: 'Confirm Suspension',
                                                        type: 'danger'
                                                    })}
                                                    className="w-full flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-iris/30 hover:bg-iris/5 transition-all group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Ban className="h-4 w-4 text-iris" strokeWidth={1.5} />
                                                        <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">Suspend Access</span>
                                                    </div>
                                                    <ChevronRight className="h-3.5 w-3.5 text-zinc-600 transition-transform group-hover:translate-x-1" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setModalConfig({
                                                        action: 'PROMOTER_ACTIVATE',
                                                        title: 'Activate Partner',
                                                        message: 'Restores full distribution capabilities and platform access.',
                                                        label: 'Confirm Activation',
                                                        type: 'info'
                                                    })}
                                                    className="w-full flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 transition-all group shadow-lg shadow-emerald-500/10"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                                                        <span className="text-[11px] font-bold uppercase tracking-widest">Restore Access</span>
                                                    </div>
                                                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-[#ffffff05] space-y-4">
                                        <div className="flex items-center gap-2 px-1">
                                            <ShieldAlert className="h-4 w-4 text-iris" strokeWidth={1.5} />
                                            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-iris">Admin Revocation</p>
                                        </div>
                                        <button
                                            onClick={() => setModalConfig({
                                                action: 'PROMOTER_DISABLE',
                                                title: 'Permanently Deactivate',
                                                message: 'Permanently removes this partner from the network. This action cannot be undone.',
                                                label: 'Execute Deactivation',
                                                type: 'danger'
                                            })}
                                            className="w-full flex items-center justify-between p-5 rounded-xl bg-iris/10 border border-iris/20 text-white hover:bg-iris/20 transition-all group"
                                        >
                                            <div className="flex items-center gap-4 text-left">
                                                <ShieldAlert className="h-6 w-6 text-iris" strokeWidth={1.5} />
                                                <div>
                                                    <span className="block text-sm font-bold tracking-tight">Deactivate Partner</span>
                                                    <span className="block text-[9px] text-iris font-bold uppercase tracking-widest mt-0.5 opacity-80">Permanent Removal</span>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-iris group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-2 text-center">
                                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest italic opacity-50">Monitoring immutable network logs.</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[400px] flex flex-col items-center justify-center rounded-xl border border-[#ffffff05] bg-white/[0.01] text-center p-8 sticky top-28">
                            <Zap className="h-12 w-12 text-zinc-800 mb-6" strokeWidth={1} />
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">Select a partner node<br />for deep audit.</p>
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
                />
            )}
        </div>
    );
}
