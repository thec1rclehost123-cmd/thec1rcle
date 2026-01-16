"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { Search, Filter, ShieldCheck, Mail, Phone, Users, History, Activity, AlertCircle, TrendingUp, BadgeCheck, ShieldAlert, Ban, RotateCcw, ChevronRight, User, X } from "lucide-react";
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
            const updatedRes = await fetch('/api/list?collection=hosts', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const updatedJson = await updatedRes.json();
            const updated = updatedJson.data?.find(h => h.id === selectedHost.id);
            if (updated) setSelectedHost(updated);

        } catch (err) {
            alert(`Error: ${err.message}`);
            throw err;
        }
    };

    const [showOnlySuspended, setShowOnlySuspended] = useState(false);

    const exportToCSV = () => {
        const headers = ["ID", "Name", "Role", "Status", "Owner UID"];
        const rows = filteredHosts.map(h => [
            h.id,
            h.name || 'Anonymous Organizer',
            h.role || 'Member',
            h.status,
            h.ownerUid
        ]);

        const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `organizer_ledger_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    const filteredHosts = hosts.filter(h => {
        const matchesSearch = h.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            h.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            h.ownerUid?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = showOnlySuspended ? h.status === 'suspended' : true;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-12 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Creator Network</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Organizer Profiles</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        Manage all platform organizers and monitor event hosting permissions.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowOnlySuspended(!showOnlySuspended)}
                        className={`flex items-center gap-2.5 px-6 py-3 rounded-xl border text-[11px] font-bold uppercase tracking-widest transition-all ${showOnlySuspended ? 'bg-iris text-white border-iris shadow-lg shadow-iris/20' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'}`}
                    >
                        <Filter className="w-4 h-4" />
                        {showOnlySuspended ? 'Showing Restricted' : 'Filter Restricted'}
                    </button>
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-400 text-[11px] font-bold uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all font-mono-numbers"
                    >
                        <TrendingUp className="w-4 h-4" />
                        Export Ledger
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Hosts List */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-500 group-focus-within:text-zinc-300 transition-colors" strokeWidth={1.5} />
                        <input
                            type="text"
                            placeholder="Find organizer by name, ID or owner profile..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 transition-all font-medium placeholder:text-zinc-700 text-white"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse border border-white/5" />
                            ))
                        ) : filteredHosts.length > 0 ? filteredHosts.map((host) => (
                            <div
                                key={host.id}
                                onClick={() => setSelectedHost(host)}
                                className={`flex items-center gap-7 p-7 rounded-xl border transition-all cursor-pointer group shadow-sm ${selectedHost?.id === host.id ? 'bg-white/[0.05] border-white/20' : 'bg-obsidian-surface border-[#ffffff08] hover:border-[#ffffff15]'}`}
                            >
                                <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center font-bold text-lg text-zinc-600 shadow-inner group-hover:text-white transition-colors">
                                    {host.name?.[0] || 'H'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-semibold text-white tracking-tight truncate uppercase tracking-tight">{host.name || 'Anonymous Organizer'}</h3>
                                        {host.isVerified && <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" strokeWidth={1.5} />}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">{host.role || 'Member'}</span>
                                        <div className="h-1 w-1 rounded-full bg-zinc-800"></div>
                                        <span className="text-[10px] text-zinc-700 font-bold tracking-widest uppercase font-mono-numbers">ID: {host.id.slice(0, 8)}</span>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end gap-2">
                                    <div className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-widest border ${host.status === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : host.status === 'suspended' ? 'bg-iris/10 border-iris/20 text-iris' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}`}>
                                        <span className={`inline-block mr-1.5 h-1 w-1 rounded-full ${host.status === 'active' ? 'bg-emerald-500' : host.status === 'suspended' ? 'bg-iris' : 'bg-amber-500'}`}></span>
                                        {host.status === 'active' ? 'Active' : host.status === 'suspended' ? 'Restricted' : 'Pending'}
                                    </div>
                                    <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest truncate max-w-[100px]">OWNER: {host.ownerUid?.slice(0, 8)}</p>
                                </div>
                            </div>
                        )) : (
                            <div className="py-24 text-center border border-[#ffffff08] rounded-xl bg-obsidian-surface/50">
                                <Users className="h-8 w-8 text-zinc-800 mx-auto mb-4" strokeWidth={1} />
                                <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">No organizers found</h4>
                                <p className="text-[10px] text-zinc-600 mt-2 font-bold uppercase tracking-widest">Adjust your search to see results.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Inspection Panel */}
                <aside className="lg:col-span-4 h-fit">
                    {selectedHost ? (
                        <div className="sticky top-28 space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="bg-obsidian-surface border border-[#ffffff08] rounded-xl p-8 space-y-8 shadow-2xl relative">
                                <button
                                    onClick={() => setSelectedHost(null)}
                                    className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                                >
                                    <X className="h-4 w-4" strokeWidth={1.5} />
                                </button>

                                <div className="flex flex-col items-center text-center pt-2 space-y-4">
                                    <div className="h-16 w-16 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center text-2xl font-bold text-white shadow-inner">
                                        {selectedHost.name?.[0] || 'H'}
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-semibold tracking-tight text-white mb-1 uppercase tracking-tight">{selectedHost.name}</h3>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Verified Platform Partner</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="p-5 rounded-xl bg-white/[0.02] border border-[#ffffff05] space-y-4">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Administrative Owner</p>
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-zinc-900 border border-white/5">
                                                <User className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="text-[8px] font-bold text-zinc-700 block uppercase tracking-tight mb-0.5">Profile Reference</span>
                                                <span className="text-[10px] font-bold text-zinc-400 break-all leading-tight tracking-tight uppercase">{selectedHost.ownerUid}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-2">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 px-1">Management Controls</p>

                                        <div className="grid grid-cols-1 gap-2">
                                            <button
                                                onClick={() => setModalConfig({
                                                    action: 'WARNING_ISSUE',
                                                    title: 'Issue Official Notice',
                                                    message: 'Send a formal compliance notice to this organizer. This action is logged.',
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
                                                    title: 'Update Visibility Score',
                                                    message: 'Change how prominently this organizer appears in feeds.',
                                                    label: 'Approve New Weight',
                                                    inputLabel: 'Profile Priority (0-10)',
                                                    inputPlaceholder: '1.0',
                                                    inputType: 'number',
                                                    type: 'info'
                                                })}
                                                className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/[0.02] hover:border-white/10 hover:bg-white/[0.02] transition-all group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <TrendingUp className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                                                    <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">Adjust Visibility</span>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:translate-x-1 transition-transform" />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2 pt-4">
                                            <button
                                                onClick={() => setModalConfig({
                                                    action: 'PAYOUT_FREEZE',
                                                    title: 'Restrict Payouts',
                                                    message: 'Immediately prevent all outgoing payments to this organizer. Requires security clearance.',
                                                    label: 'Confirm Restriction',
                                                    type: 'danger',
                                                    isTier3: true
                                                })}
                                                className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-iris/10 border border-iris/20 text-white hover:bg-iris/20 transition-all font-bold text-[11px] uppercase tracking-widest shadow-lg shadow-iris/10"
                                            >
                                                <Ban className="h-4 w-4" strokeWidth={2} />
                                                Restrict Payouts
                                            </button>

                                            <button
                                                onClick={() => setModalConfig({
                                                    action: 'PAYOUT_RELEASE',
                                                    title: 'Resume Payouts',
                                                    message: 'Restore standard payment processing for this organizer profile.',
                                                    label: 'Authorize Resume',
                                                    type: 'info',
                                                    isTier3: true
                                                })}
                                                className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 text-zinc-600 hover:text-white hover:bg-white/10 transition-all font-bold text-[10px] uppercase tracking-widest"
                                            >
                                                <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
                                                Restore Payouts
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[400px] flex flex-col items-center justify-center rounded-xl border border-[#ffffff05] bg-white/[0.01] text-center p-8 sticky top-28">
                            <ShieldCheck className="h-12 w-12 text-zinc-800 mb-6" strokeWidth={1} />
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">Select an organizer profile<br />to review registry details.</p>
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
