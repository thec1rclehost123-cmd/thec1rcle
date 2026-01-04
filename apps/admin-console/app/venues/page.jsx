"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { Search, Filter, MapPin, Building2, Calendar, ShieldCheck, ChevronRight, AlertCircle, TrendingUp, BadgeCheck, Lock, Unlock, ShieldAlert, Percent } from "lucide-react";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";

export default function AdminVenues() {
    const { user } = useAuth();
    const [venues, setVenues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedVenue, setSelectedVenue] = useState(null);
    const [modalConfig, setModalConfig] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchVenues = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/list?collection=venues', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            setVenues(json.data || []);
        } catch (err) {
            console.error("Failed to fetch venues", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchVenues();
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
                    targetId: selectedVenue.id,
                    reason,
                    evidence,
                    params: {
                        type: 'venue',
                        message: modalConfig.action === 'WARNING_ISSUE' ? inputValue : undefined,
                        weight: modalConfig.action === 'DISCOVERY_WEIGHT_ADJUST' ? Number(inputValue) : undefined,
                        rate: modalConfig.action === 'COMMISSION_ADJUST' ? Number(inputValue) : undefined
                    }
                })
            });

            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error || "Action failed");
            }

            if (json.message) alert(json.message); // Governance feedback (e.g. Dual Approval)

            await fetchVenues();
            const updated = venues.find(v => v.id === selectedVenue.id);
            if (updated) setSelectedVenue(updated);

        } catch (err) {
            alert(`Authority Error: ${err.message}`);
            throw err;
        }
    };

    return (
        <div className="space-y-12 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 border-b border-slate-200 pb-12">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <Building2 className="h-6 w-6 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Governance Registry</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900">Venue Directory</h1>
                    <p className="text-base text-slate-500 mt-3 font-medium max-w-2xl leading-relaxed">
                        Observational registry of all onboarded venues. <span className="text-slate-900">Track status, manage verification, and audit performance.</span>
                    </p>
                </div>
            </div>

            {/* Filter Hub */}
            <div className="flex gap-4 p-3 rounded-[2.5rem] bg-white border border-slate-200 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-8 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Filter by name, city or unique identifier..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 rounded-[1.8rem] pl-16 pr-8 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all font-semibold placeholder:text-slate-300"
                    />
                </div>
                <button className="px-8 py-4 rounded-[1.8rem] bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Advanced Filters
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
                {/* Table Area */}
                <div className="lg:col-span-3 rounded-[3rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                    <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Venue Identity</th>
                                    <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Geography</th>
                                    <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Class</th>
                                    <th className="px-10 py-6 text-right text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Operational Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    [...Array(8)].map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={4} className="px-10 py-10"><div className="h-4 bg-slate-100 rounded-full w-full"></div></td>
                                        </tr>
                                    ))
                                ) : venues.filter(v =>
                                    v.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    v.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    v.id?.toLowerCase().includes(searchTerm.toLowerCase())
                                ).length > 0 ? venues.filter(v =>
                                    v.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    v.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    v.id?.toLowerCase().includes(searchTerm.toLowerCase())
                                ).map((venue) => (
                                    <tr
                                        key={venue.id}
                                        onClick={() => setSelectedVenue(venue)}
                                        className={`hover:bg-slate-50 transition-all cursor-pointer group ${selectedVenue?.id === venue.id ? 'bg-indigo-50/50' : ''}`}
                                    >
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-5">
                                                <div className="h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center font-black text-xs text-white shadow-lg shadow-slate-200 group-hover:scale-105 transition-transform">
                                                    {venue.name?.[0] || 'V'}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-base font-black tracking-tight text-slate-900">{venue.name}</p>
                                                        {venue.isVerified && <BadgeCheck className="h-4 w-4 text-indigo-600" />}
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1">ID: {venue.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <p className="text-sm font-bold text-slate-700">{venue.city || 'GLOBAL'}</p>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1 font-bold">{venue.area || 'Unknown'}</p>
                                        </td>
                                        <td className="px-10 py-8">
                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${venue.tier === 'premium' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                                                }`}>
                                                {venue.tier || 'standard'}
                                            </span>
                                        </td>
                                        <td className="px-10 py-8 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <span className={`h-2.5 w-2.5 rounded-full ring-4 ${venue.status === 'active' ? 'bg-emerald-500 ring-emerald-50' :
                                                    venue.status === 'pending' ? 'bg-amber-500 ring-amber-50' : 'bg-red-500 ring-red-50'
                                                    }`}></span>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">{venue.status}</span>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={4} className="px-10 py-24 text-center text-sm text-slate-400 font-bold uppercase tracking-widest italic bg-slate-50/30">No venues found in secondary registry.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Detail View */}
                <aside className="lg:col-span-1">
                    {selectedVenue ? (
                        <div className="sticky top-24 p-10 rounded-[3rem] border border-slate-200 bg-white shadow-xl space-y-10 animate-in fade-in slide-in-from-right-8 duration-500">
                            <div className="flex items-center gap-5 border-b border-slate-100 pb-10">
                                <div className="h-16 w-16 rounded-[1.5rem] bg-slate-50 border border-slate-200 flex items-center justify-center shadow-inner">
                                    <Building2 className="h-8 w-8 text-indigo-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-black text-2xl tracking-tighter text-slate-900 truncate">{selectedVenue.name}</h3>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] mt-1 font-black">Registry Profile</p>
                                </div>
                            </div>

                            <div className="space-y-10">
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 shadow-inner">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Operational Health</p>
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-black uppercase tracking-widest text-slate-900">{selectedVenue.status}</p>
                                            <div className={`h-2 w-2 rounded-full ${selectedVenue.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                        </div>
                                    </div>
                                    <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 shadow-inner">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Current Commission</p>
                                        <p className="text-2xl font-black tracking-tighter text-slate-900">{selectedVenue.platformFeeRate || 0}%</p>
                                    </div>
                                </div>

                                {/* Tier 1 & 2 Actions */}
                                <div className="pt-10 border-t border-slate-100 space-y-10">
                                    <div className="space-y-6">
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 border-b border-slate-100 pb-2">Operational Controls — Tier 1</p>

                                        <div className="grid grid-cols-1 gap-3">
                                            <button
                                                onClick={() => setModalConfig({
                                                    action: selectedVenue.isVerified ? 'VERIFICATION_REVOKE' : 'VERIFICATION_ISSUE',
                                                    title: selectedVenue.isVerified ? 'Revoke Verification' : 'Issue Verification',
                                                    message: 'Toggles the verified trust badge on the platform. Impacts perceived reliability.',
                                                    label: 'Update Trust Seal',
                                                    type: 'info'
                                                })}
                                                className="flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-600 hover:bg-slate-50 transition-all group shadow-sm"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <BadgeCheck className={`h-5 w-5 ${selectedVenue.isVerified ? 'text-indigo-600' : 'text-slate-300'}`} />
                                                    <span className="text-xs font-black uppercase tracking-widest text-slate-900">Verification</span>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-600 transition-transform group-hover:translate-x-1" />
                                            </button>

                                            <button
                                                onClick={() => setModalConfig({
                                                    action: 'WARNING_ISSUE',
                                                    title: 'Venue Formal Warning',
                                                    message: 'Logs a behavioral compliance notice. Context is preserved in the audit registry.',
                                                    label: 'Log Warning',
                                                    inputLabel: 'Incident Context',
                                                    inputPlaceholder: 'Briefly describe the operational violation...',
                                                    type: 'warning'
                                                })}
                                                className="flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-200 hover:border-amber-600 hover:bg-slate-50 transition-all group shadow-sm"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <AlertCircle className="h-5 w-5 text-amber-500" />
                                                    <span className="text-xs font-black uppercase tracking-widest text-slate-900">Issue Warning</span>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-amber-600 transition-transform group-hover:translate-x-1" />
                                            </button>

                                            <button
                                                onClick={() => setModalConfig({
                                                    action: 'DISCOVERY_WEIGHT_ADJUST',
                                                    title: 'Adjust Venue Bias',
                                                    message: 'Modify algorithmic visibility for this venue. Impacts event distribution.',
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

                                    <div className="space-y-6">
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 border-b border-slate-100 pb-2">Platform Authority — Tier 2</p>

                                        <div className="grid grid-cols-1 gap-3">
                                            {selectedVenue.status === 'suspended' ? (
                                                <button
                                                    onClick={() => setModalConfig({
                                                        action: 'VENUE_REINSTATE',
                                                        title: 'Reinstate Venue Authority',
                                                        message: 'Restores the venues ability to host events. Requires verification.',
                                                        label: 'Execute Reinstatement',
                                                        type: 'info',
                                                        isTier2: true
                                                    })}
                                                    className="flex items-center justify-between p-6 rounded-3xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 group"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <Unlock className="h-6 w-6" />
                                                        <div className="text-left">
                                                            <span className="block text-sm font-black uppercase tracking-widest">Reinstate Asset</span>
                                                            <span className="block text-[9px] opacity-70 mt-1 font-bold">Restore Operations</span>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="h-5 w-5 opacity-40 group-hover:translate-x-1 transition-transform" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setModalConfig({
                                                        action: 'VENUE_SUSPEND',
                                                        title: 'Suspend Venue Authority',
                                                        message: 'Halt all venue operations immediately.',
                                                        label: 'Execute Suspension',
                                                        type: 'danger',
                                                        isTier2: true
                                                    })}
                                                    className="flex items-center justify-between p-6 rounded-3xl bg-red-600 text-white hover:bg-red-700 transition-all shadow-xl shadow-red-200 group"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <Lock className="h-6 w-6" />
                                                        <div className="text-left">
                                                            <span className="block text-sm font-black uppercase tracking-widest">Suspend Asset</span>
                                                            <span className="block text-[9px] opacity-70 mt-1 font-bold">Immediate Operational Freeze</span>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="h-5 w-5 opacity-40 group-hover:translate-x-1 transition-transform" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Tier 3 Financial Authority */}
                                    <div className="pt-10 border-t border-slate-100 space-y-6">
                                        <div className="flex items-center gap-3">
                                            <ShieldAlert className="h-5 w-5 text-orange-600" />
                                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-600">Financial Authority — Tier 3</p>
                                        </div>

                                        <button
                                            onClick={() => setModalConfig({
                                                action: 'COMMISSION_ADJUST',
                                                title: 'Adjust Platform Fee Contract',
                                                message: 'Update the contract rate. Impacts future revenue streams.',
                                                label: 'Update Fee Rate',
                                                inputLabel: 'New Rate (%)',
                                                inputType: 'number',
                                                inputPlaceholder: selectedVenue.platformFeeRate || '10',
                                                type: 'danger',
                                                isTier3: true
                                            })}
                                            className="w-full flex items-center justify-between p-6 rounded-3xl bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-xl shadow-slate-300 group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <Percent className="h-6 w-6 text-indigo-400" />
                                                <div className="text-left">
                                                    <span className="block text-sm font-black uppercase tracking-widest">Adjust Commission</span>
                                                    <span className="block text-[9px] opacity-60 mt-1">Dual Approval Protocol</span>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-5 w-5 opacity-40 group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-10 border-t border-slate-100 flex items-center justify-between">
                                <p className="text-[10px] text-slate-400 font-bold italic tracking-tight">Active Surveillance Registry</p>
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            </div>
                        </div>

                    ) : (
                        <div className="h-full min-h-[500px] flex flex-col items-center justify-center p-16 rounded-[4rem] border-2 border-slate-200 border-dashed text-center bg-slate-50/50">
                            <Building2 className="h-16 w-16 text-slate-200 mb-6" />
                            <p className="text-sm text-slate-400 font-black uppercase tracking-widest leading-relaxed">Select a venue<br />from the registry<br />to begin audit.</p>
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
