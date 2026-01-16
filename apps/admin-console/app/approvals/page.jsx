"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import {
    Search,
    Filter,
    Building2,
    Users,
    Zap,
    Clock,
    CheckCircle,
    XCircle,
    RotateCcw,
    ChevronRight,
    MapPin,
    Mail,
    Phone,
    ShieldCheck,
    Briefcase,
    AlertCircle,
    Instagram,
    Activity,
    X
} from "lucide-react";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";

export default function AdminApprovals() {
    const { user } = useAuth();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedReq, setSelectedReq] = useState(null);
    const [modalConfig, setModalConfig] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filter, setFilter] = useState("all");

    const fetchRequests = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/list?collection=onboarding_requests', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            const sorted = (json.data || []).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
            setRequests(sorted);
        } catch (err) {
            console.error("Failed to fetch requests", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchRequests();
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
                    targetId: selectedReq.id,
                    reason,
                    evidence,
                    params: {
                        type: 'onboarding_request'
                    }
                })
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Action failed");

            await fetchRequests();
            setSelectedReq(null);
            setModalConfig(null);
        } catch (err) {
            alert(`Authority Error: ${err.message}`);
            throw err;
        }
    };

    const filtered = requests.filter(r => {
        const matchesSearch = (
            r.data?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.data?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.id.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const matchesFilter = filter === "all" || r.type === filter;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-12 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Pending Queue</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Partner Applications</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        Review and verify new partner requests for the C1rcle community.
                    </p>
                </div>
            </div>

            {/* Filter Hub */}
            <div className="flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[300px] group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-500 group-focus-within:text-zinc-300 transition-colors" strokeWidth={1.5} />
                    <input
                        type="text"
                        placeholder="Search queue by name, email or reference tag..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 focus:bg-zinc-900 transition-all font-medium placeholder:text-zinc-600 text-white"
                    />
                </div>
                <div className="flex gap-1.5 p-1 bg-black/40 rounded-lg border border-[#ffffff05]">
                    <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="All" />
                    <FilterButton active={filter === 'venue'} onClick={() => setFilter('venue')} label="Venues" icon={Building2} />
                    <FilterButton active={filter === 'host'} onClick={() => setFilter('host')} label="Hosts" icon={Users} />
                    <FilterButton active={filter === 'promoter'} onClick={() => setFilter('promoter')} label="Promoters" icon={Zap} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-6">
                    <div className="rounded-xl border border-[#ffffff08] bg-obsidian-surface overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/[0.02] border-b border-[#ffffff08]">
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Partner Details</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Type</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Date</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Status</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#ffffff05]">
                                {loading ? (
                                    [1, 2, 3, 4, 5].map(i => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="px-6 py-6"><div className="h-4 bg-white/5 rounded-full w-full"></div></td>
                                        </tr>
                                    ))
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-600 italic">Queue clear. No pending requests detected.</td>
                                    </tr>
                                ) : filtered.map((r) => (
                                    <tr
                                        key={r.id}
                                        onClick={() => setSelectedReq(r)}
                                        className={`group cursor-pointer transition-colors ${selectedReq?.id === r.id ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'}`}
                                    >
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-xs ${r.type === 'venue' ? 'bg-zinc-900 border border-white/5' : r.type === 'host' ? 'bg-white/5 border border-white/10' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'}`}>
                                                    {r.data?.name?.[0] || 'E'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-white truncate">{r.data?.name}</p>
                                                    <p className="text-[10px] text-zinc-500 font-medium truncate">{r.data?.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{r.type}</span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <p className="text-[10px] font-mono-numbers text-zinc-500">{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : 'LEGACY'}</p>
                                        </td>
                                        <td className="px-6 py-5">
                                            <StatusBadge status={r.status} />
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:text-white transition-colors" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <aside className="lg:col-span-4 h-fit">
                    {selectedReq ? (
                        <div className="sticky top-28 space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="bg-obsidian-surface border border-[#ffffff08] rounded-xl p-6 space-y-8 shadow-2xl relative">
                                <button
                                    onClick={() => setSelectedReq(null)}
                                    className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                                >
                                    <X className="h-4 w-4" strokeWidth={1.5} />
                                </button>

                                <div className="space-y-6 pt-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Application Details</span>
                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${selectedReq.type === 'venue' ? 'bg-zinc-900 border-white/5 text-zinc-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
                                            {selectedReq.type === 'venue' ? `${selectedReq.data?.plan || 'STND'} Tier` : selectedReq.type}
                                        </span>
                                    </div>
                                    <h3 className="text-2xl font-semibold tracking-tight text-white">{selectedReq.data?.name}</h3>
                                    <div className="space-y-2 pt-2">
                                        <DetailItem icon={MapPin} label="Location" value={`${selectedReq.data?.area}, ${selectedReq.data?.city}`} />
                                        <DetailItem icon={Briefcase} label="Contact Person" value={selectedReq.data?.contactPerson} />
                                        <DetailItem icon={Phone} label="Phone Number" value={selectedReq.data?.phone} />
                                        {selectedReq.data?.instagram && <DetailItem icon={Instagram} label="Instagram" value={selectedReq.data?.instagram} />}
                                        {selectedReq.data?.bio && <DetailItem icon={Activity} label="About" value={selectedReq.data?.bio} />}
                                        {selectedReq.data?.capacity && <DetailItem icon={Users} label="Capacity" value={selectedReq.data?.capacity} />}
                                        {selectedReq.data?.role && <DetailItem icon={Zap} label="Role" value={selectedReq.data?.role} />}
                                    </div>
                                </div>

                                {selectedReq.status === 'pending' || selectedReq.status === 'changes_requested' ? (
                                    <div className="space-y-6 pt-6 border-t border-[#ffffff05]">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 px-1">Actions</p>

                                        <div className="space-y-3">
                                            {/* Setup Controls (Before Approval) */}
                                            {selectedReq.status === 'pending' && (
                                                <div className="space-y-4 p-4 rounded-lg bg-white/[0.02] border border-[#ffffff05]">
                                                    <h4 className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Account Setup</h4>

                                                    {selectedReq.type === 'venue' && (
                                                        <div>
                                                            <label className="text-[9px] font-bold text-zinc-600 mb-1.5 block uppercase">Membership Plan</label>
                                                            <select
                                                                value={selectedReq.data?.plan}
                                                                onChange={(e) => {
                                                                    const newReqs = requests.map(r =>
                                                                        r.id === selectedReq.id ? { ...r, data: { ...r.data, plan: e.target.value } } : r
                                                                    );
                                                                    setRequests(newReqs);
                                                                    setSelectedReq({ ...selectedReq, data: { ...selectedReq.data, plan: e.target.value } });
                                                                }}
                                                                className="w-full bg-black/40 border border-[#ffffff08] rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-white/10"
                                                            >
                                                                <option value="basic">Basic Plan</option>
                                                                <option value="silver">Silver Plan</option>
                                                                <option value="gold">Gold Plan</option>
                                                                <option value="diamond">Diamond Plan</option>
                                                            </select>
                                                        </div>
                                                    )}

                                                    {selectedReq.type === 'host' && (
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-[9px] font-bold text-zinc-600 uppercase">Identity Badge</label>
                                                            <button
                                                                onClick={() => {
                                                                    const newReqs = requests.map(r =>
                                                                        r.id === selectedReq.id ? { ...r, data: { ...r.data, isVerified: !r.data?.isVerified } } : r
                                                                    );
                                                                    setRequests(newReqs);
                                                                    setSelectedReq({ ...selectedReq, data: { ...selectedReq.data, isVerified: !selectedReq.data?.isVerified } });
                                                                }}
                                                                className={`px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border transition-all ${selectedReq.data?.isVerified !== false
                                                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                                    : 'bg-zinc-900 text-zinc-600 border-white/5'
                                                                    }`}
                                                            >
                                                                {selectedReq.data?.isVerified !== false ? 'Verified' : 'Unverified'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <button
                                                onClick={() => setModalConfig({
                                                    action: 'ONBOARDING_APPROVE',
                                                    title: 'APPROVE APPLICATION',
                                                    message: `Create account and give access for ${selectedReq.data?.email}. Plan: ${selectedReq.data?.plan || 'Standard'}.`,
                                                    label: 'CONFIRM APPROVAL',
                                                    type: 'info'
                                                })}
                                                className="w-full bg-emerald-600 text-white h-11 rounded-lg font-bold uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                                            >
                                                Approve Partner
                                            </button>

                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={() => setModalConfig({
                                                        action: 'ONBOARDING_REQUEST_CHANGES',
                                                        title: 'REQUEST CHANGES',
                                                        message: 'Ask the applicant to update their information before approval.',
                                                        label: 'SEND REQUEST',
                                                        type: 'warning',
                                                        inputLabel: 'Message to Partner',
                                                        inputPlaceholder: 'List what needs to be changed...'
                                                    })}
                                                    className="bg-white/5 border border-white/5 text-zinc-300 h-10 rounded-lg font-bold uppercase tracking-widest text-[9px] hover:bg-white/10 transition-all"
                                                >
                                                    Ask for Changes
                                                </button>
                                                <button
                                                    onClick={() => setModalConfig({
                                                        action: 'ONBOARDING_REJECT',
                                                        title: 'REJECT APPLICATION',
                                                        message: 'Permanently decline this application. This action cannot be undone.',
                                                        label: 'CONFIRM REJECT',
                                                        type: 'danger',
                                                        inputLabel: 'Reason for Rejection',
                                                        inputPlaceholder: 'Enter reason...'
                                                    })}
                                                    className="bg-iris/10 border border-iris/20 text-iris h-10 rounded-lg font-bold uppercase tracking-widest text-[9px] hover:bg-iris/20 transition-all"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="pt-6 border-t border-[#ffffff05]">
                                        <div className="p-6 rounded-lg bg-white/[0.01] border border-[#ffffff05] text-center">
                                            <ShieldCheck className="h-6 w-6 text-zinc-800 mx-auto mb-3" strokeWidth={1} />
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Application Processed</p>
                                            <p className="text-[11px] font-semibold text-zinc-400 mt-1">Reviewed by Admin</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-[400px] flex flex-col items-center justify-center rounded-xl border border-[#ffffff05] bg-white/[0.01] text-center p-8 sticky top-28">
                            <Clock className="h-12 w-12 text-zinc-800 mb-6" strokeWidth={1} />
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">System monitoring pipeline<br />for ingestion spikes.</p>
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
                    inputPlaceholder={modalConfig.inputPlaceholder}
                />
            )}
        </div>
    );
}

function FilterButton({ active, onClick, label, icon: Icon }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${active ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-400'
                }`}
        >
            {Icon && <Icon className="h-3 w-3" strokeWidth={2} />}
            {label}
        </button>
    );
}

function StatusBadge({ status }) {
    const configs = {
        pending: 'bg-amber-500/10 border-amber-500/20 text-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.2)]',
        approved: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.2)]',
        rejected: 'bg-iris/10 border-iris/20 text-iris shadow-[0_0_8px_rgba(244,74,34,0.2)]',
        changes_requested: 'bg-white/5 border-white/10 text-zinc-400',
    };
    const labels = {
        pending: 'Pending',
        approved: 'Verified',
        rejected: 'Declined',
        changes_requested: 'Needs Update',
    };
    return (
        <span className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border ${configs[status] || 'bg-zinc-900 border-white/5 text-zinc-600'}`}>
            {labels[status] || status.replace(/_/g, ' ')}
        </span>
    );
}

function DetailItem({ icon: Icon, label, value }) {
    return (
        <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-white/[0.02] transition-all group">
            <div className="h-9 w-9 min-w-[2.25rem] rounded-md bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-600 group-hover:text-zinc-400 transition-colors">
                <Icon className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-0.5">{label}</p>
                <p className="text-[11px] font-semibold text-zinc-300 truncate">{value || 'NOT_FOUND'}</p>
            </div>
        </div>
    );
}
