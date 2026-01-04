"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { Search, Filter, ShieldCheck, Mail, Phone, Users, History, Activity, AlertCircle, TrendingUp, BadgeCheck, ShieldAlert, Ban, RotateCcw, ChevronRight, User } from "lucide-react";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";

export default function AdminHosts() {
    const { user } = useAuth();
    const [hosts, setHosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedHost, setSelectedHost] = useState(null);
    const [modalConfig, setModalConfig] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchHosts = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/list?collection=hosts', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            setHosts(json.data || []);
        } catch (err) {
            console.error("Failed to fetch host registry", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchHosts();
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
                    targetId: selectedHost.id,
                    reason,
                    evidence,
                    params: {
                        type: 'host',
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

            await fetchHosts();
            const updated = hosts.find(h => h.id === selectedHost.id);
            if (updated) setSelectedHost(updated);

        } catch (err) {
            alert(`Authority Error: ${err.message}`);
            throw err;
        }
    };

    const filteredHosts = hosts.filter(h =>
        h.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.ownerUid?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-12 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 border-b border-slate-200 pb-12">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <Users className="h-6 w-6 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Governance Registry</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900">Host Directory</h1>
                    <p className="text-base text-slate-500 mt-3 font-medium max-w-2xl leading-relaxed">
                        Managed registry of authorized event organizers and hosts. <span className="text-slate-900">Enforce compliance, manage algorithmic bias, and control capital flow.</span>
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">

                {/* Hosts List */}
                <div className="lg:col-span-3 space-y-8">
                    <div className="flex gap-4 p-3 rounded-[2.5rem] bg-white border border-slate-200 shadow-sm">
                        <div className="relative flex-1">
                            <Search className="absolute left-8 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by host name, ID or owner reference..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 rounded-[1.8rem] pl-16 pr-8 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all font-semibold placeholder:text-slate-300"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <div key={i} className="h-32 rounded-[2.5rem] bg-slate-50 animate-pulse border border-slate-100" />
                            ))
                        ) : filteredHosts.length > 0 ? filteredHosts.map((host) => (
                            <div
                                key={host.id}
                                onClick={() => setSelectedHost(host)}
                                className={`flex items-center gap-8 p-8 rounded-[3rem] border transition-all cursor-pointer group shadow-sm ${selectedHost?.id === host.id ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <div className="h-16 w-16 rounded-2xl bg-slate-900 flex items-center justify-center font-black text-xl text-white shadow-inner group-hover:scale-105 transition-transform">
                                    {host.name?.[0] || 'H'}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-black text-xl tracking-tight text-slate-900">{host.name || 'Anonymous Host'}</h3>
                                        {host.isVerified && <BadgeCheck className="h-4 w-4 text-indigo-600" />}
                                    </div>
                                    <div className="flex items-center gap-4 mt-1.5">
                                        <span className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">{host.role || 'Standard'}</span>
                                        <span className="h-1 w-1 rounded-full bg-slate-200"></span>
                                        <span className="text-[10px] text-slate-400 font-bold italic tracking-wide">ID: {host.id}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`inline-flex items-center gap-2.5 px-5 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest ${host.status === 'active' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                                        host.status === 'suspended' ? 'bg-red-50 border-red-100 text-red-600' :
                                            'bg-amber-50 border-amber-100 text-amber-600'
                                        }`}>
                                        <span className={`h-2 w-2 rounded-full ${host.status === 'active' ? 'bg-emerald-500' :
                                            host.status === 'suspended' ? 'bg-red-500' : 'bg-amber-500'
                                            }`}></span>
                                        {host.status}
                                    </div>
                                    <p className="text-[10px] text-slate-300 mt-3 font-black uppercase tracking-widest">OWNER: {host.ownerUid?.slice(0, 8)}</p>
                                </div>
                            </div>
                        )) : (
                            <div className="p-24 text-center rounded-[4rem] border-2 border-slate-200 border-dashed bg-slate-50/50">
                                <Users className="h-16 w-16 text-slate-200 mx-auto mb-6" />
                                <p className="text-sm text-slate-400 font-black uppercase tracking-widest leading-relaxed">The host registry<br />is currently empty.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Inspection Panel */}
                <aside className="lg:col-span-1">
                    {selectedHost ? (
                        <div className="sticky top-24 p-12 rounded-[3.5rem] border border-slate-200 bg-white shadow-2xl space-y-12 animate-in fade-in slide-in-from-right-8 duration-500">
                            <div className="space-y-4">
                                <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-600">Registry Insight</h2>
                                <h3 className="text-3xl font-black tracking-tighter text-slate-900 leading-none">{selectedHost.name}</h3>
                            </div>

                            <div className="space-y-10">
                                <div className="space-y-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ownership Chain</p>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100 shadow-inner">
                                            <User className="h-5 w-5 text-indigo-600" />
                                            <div className="flex-1">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">UID Reference</span>
                                                <span className="text-xs font-bold text-slate-900 break-all">{selectedHost.ownerUid}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Tier 1 Interventions */}
                                <div className="pt-10 border-t border-slate-100 space-y-6">
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 border-b border-slate-100 pb-2">Operational Controls — Tier 1</p>

                                    <div className="grid grid-cols-1 gap-3">
                                        <button
                                            onClick={() => setModalConfig({
                                                action: 'WARNING_ISSUE',
                                                title: 'Issue Host Warning',
                                                message: 'Dispatches a non-restrictive compliance signal. Audit required.',
                                                label: 'Log Warning',
                                                inputLabel: 'Warning Context',
                                                inputPlaceholder: 'Behavioral violation regarding...',
                                                type: 'warning'
                                            })}
                                            className="flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-200 hover:border-amber-600 hover:bg-slate-50 transition-all group shadow-sm"
                                        >
                                            <div className="flex items-center gap-4">
                                                <AlertCircle className="h-5 w-5 text-amber-500" />
                                                <span className="text-xs font-black uppercase tracking-widest text-slate-900">Warn Host</span>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-amber-600 transition-transform group-hover:translate-x-1" />
                                        </button>

                                        <button
                                            onClick={() => setModalConfig({
                                                action: 'DISCOVERY_WEIGHT_ADJUST',
                                                title: 'Adjust Host Weight',
                                                message: 'Tweak algorithmic visibility. (Range: -10 to 50)',
                                                label: 'Update Bias',
                                                inputLabel: 'Numerical Bias',
                                                inputPlaceholder: '0.0',
                                                inputType: 'number',
                                                type: 'info'
                                            })}
                                            className="flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-600 hover:bg-slate-50 transition-all group shadow-sm"
                                        >
                                            <div className="flex items-center gap-4">
                                                <TrendingUp className="h-5 w-5 text-indigo-600" />
                                                <span className="text-xs font-black uppercase tracking-widest text-slate-900">Visibility Bias</span>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-600 transition-transform group-hover:translate-x-1" />
                                        </button>
                                    </div>
                                </div>

                                {/* Tier 3 Capital Control */}
                                <div className="pt-10 border-t border-slate-100 space-y-6">
                                    <div className="flex items-center gap-3">
                                        <ShieldAlert className="h-5 w-5 text-red-600" />
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-red-600">Capital Authority — Tier 3</p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        <button
                                            onClick={() => setModalConfig({
                                                action: 'PAYOUT_FREEZE',
                                                title: 'Freeze Settlement Pipeline',
                                                message: 'Immediately halt all automated payouts to this host. Used for investigating financial irregularities.',
                                                label: 'Executive Freeze',
                                                type: 'danger',
                                                isTier3: true
                                            })}
                                            className="w-full flex items-center justify-between p-6 rounded-3xl bg-red-600 text-white hover:bg-red-700 transition-all shadow-xl shadow-red-200 group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <Ban className="h-6 w-6" />
                                                <div className="text-left">
                                                    <span className="block text-sm font-black uppercase tracking-widest">Freeze Payouts</span>
                                                    <span className="block text-[9px] opacity-70 mt-1 font-bold">Suspends Transfer Batches</span>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-5 w-5 opacity-40 group-hover:translate-x-1 transition-transform" />
                                        </button>

                                        <button
                                            onClick={() => setModalConfig({
                                                action: 'PAYOUT_RELEASE',
                                                title: 'Release Settlement Pipeline',
                                                message: 'Authorize the resumption of automated payouts for this host.',
                                                label: 'Executive Release',
                                                type: 'info',
                                                isTier3: true
                                            })}
                                            className="w-full flex items-center justify-between p-6 rounded-3xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <RotateCcw className="h-6 w-6" />
                                                <div className="text-left">
                                                    <span className="block text-sm font-black uppercase tracking-widest">Release Payouts</span>
                                                    <span className="block text-[9px] opacity-70 mt-1 font-bold">Restore Settlement Flow</span>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-5 w-5 opacity-40 group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-10 border-t border-slate-100 flex items-center justify-between">
                                <p className="text-[10px] text-slate-400 font-bold italic tracking-tight text-center">
                                    Capital actions require dual-signature authorization.<br />Active surveillance registry.
                                </p>
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-16 rounded-[4rem] border-2 border-slate-200 border-dashed text-center bg-slate-50/50">
                            <ShieldCheck className="h-16 w-16 text-slate-200 mb-6" />
                            <p className="text-sm text-slate-400 font-black uppercase tracking-widest leading-relaxed">Select a host<br />from the registry<br />for investigation.</p>
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
                    isTier3={modalConfig.isTier3}
                />
            )}
        </div>
    );
}
