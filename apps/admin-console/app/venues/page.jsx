"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { Search, Filter, MapPin, Building2, Calendar, ShieldCheck, ChevronRight, AlertCircle, TrendingUp, BadgeCheck, Lock, Unlock, ShieldAlert, Percent, X } from "lucide-react";
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

            if (json.message) alert(json.message);

            await fetchVenues();
            const updatedRes = await fetch('/api/list?collection=venues', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const updatedJson = await updatedRes.json();
            const updated = updatedJson.data?.find(v => v.id === selectedVenue.id);
            if (updated) setSelectedVenue(updated);

        } catch (err) {
            alert(`Error: ${err.message}`);
            throw err;
        }
    };

    const [showOnlyVerified, setShowOnlyVerified] = useState(false);

    const exportToCSV = () => {
        const headers = ["ID", "Name", "City", "Area", "Tier", "Verified", "Status"];
        const rows = filtered.map(v => [
            v.id,
            v.name,
            v.city || 'Global',
            v.area || 'General',
            v.tier || 'Standard',
            v.isVerified ? 'Yes' : 'No',
            v.status
        ]);

        const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `venue_registry_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    const filtered = venues.filter(v => {
        const matchesSearch = v.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.id?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = showOnlyVerified ? v.isVerified : true;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-12 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Building2 className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Venue Registry</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Platform Partners</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        Monitor active locations and manage venue relationships across the network.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowOnlyVerified(!showOnlyVerified)}
                        className={`flex items-center gap-2.5 px-6 py-3 rounded-xl border text-[11px] font-bold uppercase tracking-widest transition-all ${showOnlyVerified ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'}`}
                    >
                        <ShieldCheck className="w-4 h-4" />
                        {showOnlyVerified ? 'Showing Verified' : 'Filter Verified'}
                    </button>
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-400 text-[11px] font-bold uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all font-mono-numbers"
                    >
                        <TrendingUp className="w-4 h-4" />
                        Export Registry
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* List Area */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-600 group-focus-within:text-zinc-300 transition-colors" strokeWidth={1.5} />
                        <input
                            type="text"
                            placeholder="Find venue by name, city or registry ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 transition-all font-medium placeholder:text-zinc-700 text-white"
                        />
                    </div>

                    <div className="bg-obsidian-surface rounded-xl border border-[#ffffff08] overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/[0.02] border-b border-[#ffffff08]">
                                        <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Partner Details</th>
                                        <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Location</th>
                                        <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Classification</th>
                                        <th className="px-8 py-4 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#ffffff05]">
                                    {loading ? (
                                        [...Array(8)].map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan={4} className="px-8 py-8 h-20 bg-white/[0.01]" />
                                            </tr>
                                        ))
                                    ) : filtered.length > 0 ? filtered.map((v) => (
                                        <tr
                                            key={v.id}
                                            onClick={() => setSelectedVenue(v)}
                                            className={`hover:bg-white/[0.01] transition-colors cursor-pointer group ${selectedVenue?.id === v.id ? 'bg-white/[0.05]' : ''}`}
                                        >
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center font-bold text-xs text-zinc-600 group-hover:text-white transition-colors">
                                                        {v.name?.[0] || 'V'}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="text-sm font-semibold text-white truncate uppercase tracking-tight">{v.name}</p>
                                                            {v.isVerified && <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" strokeWidth={1.5} />}
                                                        </div>
                                                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-0.5">ID: {v.id.slice(0, 8)}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">{v.city || 'Global'}</p>
                                                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mt-0.5 font-bold">{v.area || 'General'}</p>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${v.tier === 'premium' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-white/5 text-zinc-500 border-white/5'}`}>
                                                    {v.tier || 'Standard'}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex items-center justify-end gap-2.5">
                                                    <div className={`h-1.5 w-1.5 rounded-full ${v.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : v.status === 'pending' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'bg-iris shadow-[0_0_8px_rgba(244,74,34,0.4)]'}`}></div>
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{v.status}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={4} className="px-8 py-24 text-center">
                                            <div className="h-16 w-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/5 shadow-inner">
                                                <Building2 className="h-8 w-8 text-zinc-800" strokeWidth={1} />
                                            </div>
                                            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">No partners found</h4>
                                            <p className="text-[10px] text-zinc-600 mt-2 font-bold uppercase tracking-[0.2em]">Try adjusting your search criteria.</p>
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Inspection Panel */}
                <aside className="lg:col-span-4 h-fit">
                    {selectedVenue ? (
                        <div className="sticky top-28 space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="bg-obsidian-surface border border-[#ffffff08] rounded-xl p-8 space-y-8 shadow-2xl relative">
                                <button
                                    onClick={() => setSelectedVenue(null)}
                                    className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                                >
                                    <X className="h-4 w-4" strokeWidth={1.5} />
                                </button>

                                <div className="flex items-center gap-4 pt-2">
                                    <div className="h-16 w-16 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center shadow-inner">
                                        <Building2 className="h-8 w-8 text-emerald-500" strokeWidth={1.5} />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-2xl font-semibold tracking-tight text-white mb-0.5 truncate uppercase uppercase">{selectedVenue.name}</h3>
                                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Registry Profile</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-px bg-[#ffffff10] border border-[#ffffff10] rounded-xl overflow-hidden shadow-sm">
                                        <div className="bg-obsidian-surface p-5">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1.5">Network Status</p>
                                            <div className="flex items-center gap-2">
                                                <div className={`h-1.5 w-1.5 rounded-full ${selectedVenue.status === 'active' ? 'bg-emerald-500' : 'bg-iris'}`} />
                                                <p className="text-[11px] font-bold uppercase tracking-widest text-white">{selectedVenue.status}</p>
                                            </div>
                                        </div>
                                        <div className="bg-obsidian-surface p-5 text-right">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1.5">Account Tier</p>
                                            <p className="text-2xl font-light text-white uppercase">{selectedVenue.tier || 'Standard'}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-2">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 px-1">Authority Controls</p>

                                        <div className="grid grid-cols-1 gap-2">
                                            <button
                                                onClick={() => setModalConfig({
                                                    action: selectedVenue.isVerified ? 'VERIFICATION_REVOKE' : 'VERIFICATION_ISSUE',
                                                    title: selectedVenue.isVerified ? 'Revoke Verification' : 'Verify Partner',
                                                    message: 'Update the official verification status for this location.',
                                                    label: 'Update Status',
                                                    type: 'info'
                                                })}
                                                className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/[0.02] hover:border-white/10 hover:bg-white/[0.02] transition-all group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <BadgeCheck className={`h-4 w-4 ${selectedVenue.isVerified ? 'text-emerald-500' : 'text-zinc-600'}`} strokeWidth={1.5} />
                                                    <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">Set Verification</span>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:translate-x-1 transition-transform" />
                                            </button>

                                            <button
                                                onClick={() => setModalConfig({
                                                    action: 'WARNING_ISSUE',
                                                    title: 'Issue Official Notice',
                                                    message: 'Send a formal compliance notice to the partner. This action is logged.',
                                                    label: 'Send Notice',
                                                    inputLabel: 'Notice Details',
                                                    inputPlaceholder: 'Describe the policy violation...',
                                                    type: 'warning'
                                                })}
                                                className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/[0.02] hover:border-white/10 hover:bg-white/[0.02] transition-all group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <AlertCircle className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
                                                    <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">Issue Notice</span>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:translate-x-1 transition-transform" />
                                            </button>

                                            <button
                                                onClick={() => setModalConfig({
                                                    action: 'DISCOVERY_WEIGHT_ADJUST',
                                                    title: 'Adjust Visibility Score',
                                                    message: 'Change how prominently this partner appears in discovery feeds.',
                                                    label: 'Save Profile Weight',
                                                    inputLabel: 'Visibility Priority (0-10)',
                                                    inputPlaceholder: '1.0',
                                                    inputType: 'number',
                                                    type: 'info'
                                                })}
                                                className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/[0.02] hover:border-white/10 hover:bg-white/[0.02] transition-all group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <TrendingUp className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                                                    <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">Adjust Weight</span>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:translate-x-1 transition-transform" />
                                            </button>
                                        </div>

                                        <div className="pt-4 space-y-3">
                                            {selectedVenue.status === 'suspended' ? (
                                                <button
                                                    onClick={() => setModalConfig({
                                                        action: 'VENUE_REINSTATE',
                                                        title: 'Reinstate Relationship',
                                                        message: 'Allow the partner to resume hosting and sales. High priority update.',
                                                        label: 'Review & Restore',
                                                        type: 'info',
                                                        isTier2: true
                                                    })}
                                                    className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 transition-all font-bold text-[11px] uppercase tracking-widest"
                                                >
                                                    <Unlock className="h-4 w-4" strokeWidth={2} />
                                                    Restore Partner
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setModalConfig({
                                                        action: 'VENUE_SUSPEND',
                                                        title: 'Restrict Collaboration',
                                                        message: 'Deactivate partner operations immediately. Requires security clearance.',
                                                        label: 'Confirm Restriction',
                                                        type: 'danger',
                                                        isTier2: true
                                                    })}
                                                    className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-iris/10 border border-iris/20 text-white hover:bg-iris/20 transition-all font-bold text-[11px] uppercase tracking-widest shadow-lg shadow-iris/10"
                                                >
                                                    <Lock className="h-4 w-4" strokeWidth={2} />
                                                    Restrict Partner
                                                </button>
                                            )}

                                            <button
                                                onClick={() => setModalConfig({
                                                    action: 'COMMISSION_ADJUST',
                                                    title: 'Adjust Service Fee',
                                                    message: 'Modify the platform service fee percentage for this partner.',
                                                    label: 'Confirm Adjustment',
                                                    inputLabel: 'New Service Fee (%)',
                                                    inputType: 'number',
                                                    inputPlaceholder: selectedVenue.platformFeeRate || '10',
                                                    type: 'danger',
                                                    isTier3: true
                                                })}
                                                className="w-full flex items-center justify-center gap-2.5 p-3.5 rounded-xl border border-white/5 text-zinc-600 hover:text-white hover:bg-white/5 transition-all font-bold text-[10px] uppercase tracking-widest"
                                            >
                                                <Percent className="h-3.5 w-3.5" strokeWidth={1.5} />
                                                Override Commission
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[400px] flex flex-col items-center justify-center rounded-xl border border-[#ffffff05] bg-white/[0.01] text-center p-8 sticky top-28">
                            <Building2 className="h-12 w-12 text-zinc-800 mb-6" strokeWidth={1} />
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">Select a venue partner<br />to review registry details.</p>
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
