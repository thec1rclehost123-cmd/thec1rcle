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
    CheckCircle2
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

    const filtered = promoters.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-12 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 border-b border-slate-200 pb-12">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <Zap className="h-6 w-6 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Distribution Governance</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900">Promoter Network</h1>
                    <p className="text-base text-slate-500 mt-3 font-medium max-w-2xl leading-relaxed">
                        Authorize distribution partners and monitor individual conversion metrics. <span className="text-slate-900">Scale the circle through verified network effects.</span>
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
                {/* List Area */}
                <div className="lg:col-span-3 space-y-8">
                    <div className="flex gap-4 p-3 rounded-[2.5rem] bg-white border border-slate-200 shadow-sm">
                        <div className="relative flex-1">
                            <Search className="absolute left-8 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Filter distribution nodes by name or identifier..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 rounded-[1.8rem] pl-16 pr-8 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all font-semibold placeholder:text-slate-300"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {loading ? (
                            [...Array(6)].map((_, i) => (
                                <div key={i} className="h-64 rounded-[3rem] bg-slate-50 animate-pulse border border-slate-100" />
                            ))
                        ) : filtered.length > 0 ? (
                            filtered.map((promoter) => (
                                <div
                                    key={promoter.id}
                                    onClick={() => setSelectedPromoter(promoter)}
                                    className={`p-10 rounded-[3.5rem] border transition-all cursor-pointer group relative overflow-hidden ${selectedPromoter?.id === promoter.id ? 'bg-indigo-50 border-indigo-200 shadow-xl shadow-indigo-100/50' : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xl hover:shadow-slate-200/50'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-10">
                                        <div className="h-16 w-16 rounded-[1.8rem] bg-slate-900 flex items-center justify-center text-xl font-black text-white shadow-xl shadow-slate-200 group-hover:scale-110 transition-transform">
                                            {promoter.name?.[0] || 'P'}
                                        </div>
                                        <div className={`inline-flex items-center gap-2.5 px-5 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest ${promoter.status === 'active' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                                                promoter.status === 'suspended' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                                                    'bg-red-50 border-red-100 text-red-600'
                                            }`}>
                                            <span className={`h-2 w-2 rounded-full ${promoter.status === 'active' ? 'bg-emerald-500' :
                                                    promoter.status === 'suspended' ? 'bg-amber-500' : 'bg-red-500'
                                                }`}></span>
                                            {promoter.status || 'Active'}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-black tracking-tighter text-slate-900">{promoter.name || 'Unnamed Partner'}</h3>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">ID: {promoter.id}</p>
                                    </div>

                                    <div className="mt-10 grid grid-cols-2 gap-4">
                                        <div className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100">
                                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Impact</p>
                                            <p className="text-xl font-black text-slate-900">{promoter.conversionCount || 0}</p>
                                        </div>
                                        <div className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100">
                                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Created</p>
                                            <p className="text-xl font-black text-slate-900 uppercase tracking-tight">{promoter.createdAt ? new Date(promoter.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full p-32 text-center rounded-[4rem] border-2 border-slate-200 border-dashed bg-slate-50/50">
                                <Zap className="h-16 w-16 text-slate-200 mx-auto mb-6" />
                                <p className="text-sm text-slate-400 font-black uppercase tracking-widest leading-relaxed">No active promoters<br />found in the network.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Detail Panel */}
                <aside className="lg:col-span-1">
                    {selectedPromoter ? (
                        <div className="sticky top-24 p-12 rounded-[4rem] border border-slate-200 bg-white shadow-2xl space-y-12 animate-in fade-in slide-in-from-right-8 duration-500">
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-600">Promoter Insight</h2>
                                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                </div>
                                <h3 className="text-3xl font-black tracking-tighter text-slate-900 leading-[0.9]">{selectedPromoter.name}</h3>
                            </div>

                            <div className="space-y-10">
                                {/* Actions */}
                                <div className="pt-10 border-t border-slate-100 space-y-6">
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 border-b border-slate-100 pb-2">Operational Controls — Tier 1</p>

                                    <div className="grid grid-cols-1 gap-3">
                                        <button
                                            onClick={() => setModalConfig({
                                                action: 'WARNING_ISSUE',
                                                title: 'Issue Promoter Warning',
                                                message: 'Dispatches a compliance signal. Audit required.',
                                                label: 'Log Warning',
                                                inputLabel: 'Warning Context',
                                                inputPlaceholder: 'Policy violation regarding...',
                                                type: 'warning'
                                            })}
                                            className="flex items-center justify-between p-6 rounded-3xl bg-white border border-slate-200 hover:border-amber-600 hover:bg-amber-50/30 transition-all group shadow-sm"
                                        >
                                            <div className="flex items-center gap-4">
                                                <AlertCircle className="h-5 w-5 text-amber-500" />
                                                <span className="text-xs font-black uppercase tracking-widest text-slate-900">Warn Partner</span>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-amber-600 transition-transform group-hover:translate-x-1" />
                                        </button>

                                        {selectedPromoter.status === 'active' ? (
                                            <button
                                                onClick={() => setModalConfig({
                                                    action: 'PROMOTER_SUSPEND',
                                                    title: 'Suspend Promoter',
                                                    message: 'Temporarily halts all distribution links and platform access.',
                                                    label: 'Confirm Suspension',
                                                    type: 'danger'
                                                })}
                                                className="flex items-center justify-between p-6 rounded-3xl bg-white border border-slate-200 hover:border-red-600 hover:bg-red-50/30 transition-all group shadow-sm"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <Ban className="h-5 w-5 text-red-500" />
                                                    <span className="text-xs font-black uppercase tracking-widest text-slate-900">Suspend Access</span>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-red-600 transition-transform group-hover:translate-x-1" />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setModalConfig({
                                                    action: 'PROMOTER_ACTIVATE',
                                                    title: 'Activate Promoter',
                                                    message: 'Restores full distribution capabilities and platform access.',
                                                    label: 'Authorize Activation',
                                                    type: 'info'
                                                })}
                                                className="flex items-center justify-between p-6 rounded-3xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all group shadow-xl shadow-emerald-100"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <CheckCircle2 className="h-5 w-5" />
                                                    <span className="text-xs font-black uppercase tracking-widest">Active Access</span>
                                                </div>
                                                <ChevronRight className="h-4 w-4 opacity-50 group-hover:translate-x-1 transition-transform" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-10 border-t border-slate-100 space-y-6">
                                    <div className="flex items-center gap-3">
                                        <ShieldAlert className="h-5 w-5 text-red-600" />
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-red-600">Administrative Revocation</p>
                                    </div>
                                    <button
                                        onClick={() => setModalConfig({
                                            action: 'PROMOTER_DISABLE',
                                            title: 'Hard Revoke Linkage',
                                            message: 'Permanently disables this promoter from the network. This action is immutable.',
                                            label: 'Execute Revocation',
                                            type: 'danger'
                                        })}
                                        className="w-full flex items-center justify-between p-6 rounded-3xl bg-slate-900 text-white hover:bg-black transition-all shadow-xl shadow-slate-200 group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <ShieldAlert className="h-6 w-6 text-red-500" />
                                            <div className="text-left">
                                                <span className="block text-sm font-black uppercase tracking-widest">Disable Partner</span>
                                                <span className="block text-[9px] opacity-60 mt-1 font-bold">Hard De-provisioning</span>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-5 w-5 opacity-40 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>

                            <div className="pt-10 border-t border-slate-100 text-center">
                                <p className="text-[10px] text-slate-400 font-bold italic tracking-tight">Observing Immutable Distribution Log</p>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[500px] flex flex-col items-center justify-center p-16 rounded-[4rem] border-2 border-slate-200 border-dashed text-center bg-slate-50/50">
                            <Zap className="h-16 w-16 text-slate-200 mb-6" />
                            <p className="text-sm text-slate-400 font-black uppercase tracking-widest leading-relaxed">Select a distribution node<br />to begin deep<br />registry audit.</p>
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
