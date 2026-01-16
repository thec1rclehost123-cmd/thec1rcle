"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import {
    Clock,
    CheckCircle,
    XCircle,
    ExternalLink,
    Search,
    Filter,
    AlertTriangle,
    Shield,
    ChevronRight,
    ArrowRight,
    User,
    Terminal,
    X
} from "lucide-react";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";

export default function AdminProposals() {
    const { user, profile } = useAuth();
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProp, setSelectedProp] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [modalConfig, setModalConfig] = useState(null);

    const fetchProposals = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/list?collection=admin_proposed_actions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            const sorted = (json.data || []).sort((a, b) => b.createdAt?._seconds - a.createdAt?._seconds);
            setProposals(sorted);
        } catch (err) {
            console.error("Failed to fetch proposals", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchProposals();
    }, [user]);

    const handleResolve = async (status, reason = "") => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/actions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: status === 'approved' ? 'ACTION_APPROVE' : 'ACTION_REJECT',
                    targetId: selectedProp.id,
                    reason: reason || "Action resolved by administrator."
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Resolution failed");
            }

            await fetchProposals();
            setSelectedProp(null);
            setModalConfig(null);
        } catch (err) {
            alert(err.message);
        }
    };

    const filtered = proposals.filter(p =>
        p.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.targetId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.status.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-12 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Security Approvals</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Request Queue</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        Review sensitive actions that require approval from multiple administrators.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-6">
                    {/* Search & Stats */}
                    <div className="flex gap-4 items-center px-1">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-600 group-focus-within:text-zinc-300 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search by action or request ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 transition-all font-medium placeholder:text-zinc-700 text-white"
                            />
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.02] border border-white/5">
                            <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                                {proposals.filter(p => p.status === 'pending').length} Pending
                            </span>
                        </div>
                    </div>

                    {/* Proposals Table */}
                    <div className="rounded-xl border border-[#ffffff08] bg-obsidian-surface shadow-sm overflow-hidden overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/[0.02] border-b border-[#ffffff08]">
                                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Requested Action</th>
                                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Proposer</th>
                                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Status</th>
                                    <th className="px-8 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#ffffff05]">
                                {loading ? (
                                    [...Array(3)].map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={4} className="px-8 py-8 h-20 bg-white/[0.01]" />
                                        </tr>
                                    ))
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-8 py-24 text-center">
                                            <div className="h-16 w-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/5 shadow-inner">
                                                <Shield className="h-8 w-8 text-zinc-800" strokeWidth={1} />
                                            </div>
                                            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">Queue Empty</h3>
                                            <p className="text-[10px] text-zinc-600 mt-2 font-bold uppercase tracking-widest leading-relaxed">No requests require dual approval at this time.</p>
                                        </td>
                                    </tr>
                                ) : filtered.map((p) => (
                                    <tr
                                        key={p.id}
                                        onClick={() => setSelectedProp(p)}
                                        className={`group cursor-pointer transition-all ${selectedProp?.id === p.id ? 'bg-white/[0.05]' : 'hover:bg-white/[0.02]'}`}
                                    >
                                        <td className="px-8 py-7">
                                            <p className="text-sm font-semibold text-white flex items-center gap-2 uppercase tracking-tight">
                                                {p.action?.replace(/_/g, ' ')}
                                                {p.action?.includes('REFUND') && <span className="px-2 py-0.5 rounded bg-iris/10 text-[8px] font-bold uppercase tracking-widest text-iris border border-iris/20">Finance</span>}
                                            </p>
                                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">Ref: {p.targetId?.slice(0, 12)}</p>
                                        </td>
                                        <td className="px-8 py-7">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center text-[10px] font-bold text-zinc-700">
                                                    {p.proposerRole?.[0].toUpperCase()}
                                                </div>
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{p.proposerRole}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-7">
                                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded border ${p.status === 'pending' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                                                    p.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                                                        'bg-zinc-800 border-white/5 text-zinc-500'
                                                }`}>
                                                <div className={`h-1 w-1 rounded-full ${p.status === 'pending' ? 'bg-amber-500' :
                                                        p.status === 'approved' ? 'bg-emerald-500' :
                                                            'bg-zinc-500'
                                                    }`} />
                                                <span className="text-[9px] font-bold uppercase tracking-widest">{p.status}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-7 text-right">
                                            <ChevronRight className={`h-4 w-4 transition-all ${selectedProp?.id === p.id ? 'text-white translate-x-1' : 'text-zinc-700 group-hover:text-white group-hover:translate-x-1'}`} strokeWidth={1.5} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Proposal View */}
                <aside className="lg:col-span-4 h-fit">
                    {selectedProp ? (
                        <div className="sticky top-28 space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="bg-obsidian-surface border border-[#ffffff08] rounded-xl p-8 space-y-8 shadow-2xl relative">
                                <button
                                    onClick={() => setSelectedProp(null)}
                                    className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                                >
                                    <X className="h-4 w-4" strokeWidth={1.5} />
                                </button>

                                <div className="space-y-6 pt-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Request Details</span>
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-iris/10 border border-iris/20">
                                            <Shield className="h-3 w-3 text-iris" strokeWidth={2} />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-iris">Security Check</span>
                                        </div>
                                    </div>
                                    <h3 className="text-2xl font-semibold tracking-tight text-white uppercase">{selectedProp.action?.replace(/_/g, ' ')}</h3>
                                    <p className="text-sm font-medium text-zinc-500 leading-relaxed italic">"{selectedProp.reason || 'No reason provided.'}"</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="p-5 rounded-xl bg-white/[0.02] border border-[#ffffff05] space-y-4 shadow-inner">
                                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                                            <span>Requested By</span>
                                            <span>Admin Role</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-white truncate pr-4">{selectedProp.proposerId?.slice(0, 16)}</span>
                                            <span className="text-[10px] font-bold uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{selectedProp.proposerRole}</span>
                                        </div>
                                    </div>

                                    {selectedProp.params && Object.keys(selectedProp.params).length > 0 && (
                                        <div className="space-y-3">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 px-1">Action Data</p>
                                            <div className="p-5 rounded-xl bg-zinc-900/50 border border-white/5 space-y-3 shadow-inner overflow-hidden">
                                                {Object.entries(selectedProp.params).map(([key, val]) => (
                                                    <div key={key} className="flex justify-between items-start gap-4 text-[10px]">
                                                        <span className="font-bold text-zinc-600 uppercase tracking-widest">{key}:</span>
                                                        <span className="font-bold text-zinc-400 text-right break-all">{typeof val === 'object' ? 'Structured Data' : String(val)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedProp.status === 'pending' && (
                                        <div className="flex flex-col gap-3 pt-2">
                                            <button
                                                onClick={() => setModalConfig({ status: 'approved', label: 'Approve Request' })}
                                                className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-white text-black hover:bg-zinc-200 transition-all shadow-lg shadow-white/5"
                                            >
                                                <CheckCircle className="h-4 w-4" />
                                                <span className="text-[11px] font-bold uppercase tracking-widest">Approve Request</span>
                                            </button>
                                            <button
                                                onClick={() => setModalConfig({ status: 'rejected', label: 'Reject Request' })}
                                                className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:bg-iris/10 hover:border-iris/20 hover:text-iris transition-all font-bold uppercase tracking-widest text-[11px]"
                                            >
                                                <XCircle className="h-4 w-4" />
                                                Reject Request
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[400px] flex flex-col items-center justify-center p-8 rounded-xl border border-[#ffffff05] bg-white/[0.01] text-center sticky top-28">
                            <Shield className="h-12 w-12 text-zinc-800 mb-6" strokeWidth={1} />
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">Select a request<br />to review and authorize.</p>
                        </div>
                    )}
                </aside>
            </div>

            {modalConfig && (
                <AdminConfirmModal
                    isOpen={!!modalConfig}
                    onClose={() => setModalConfig(null)}
                    onConfirm={(reason) => handleResolve(modalConfig.status, reason)}
                    title={modalConfig.status === 'approved' ? "Confirm Approval" : "Confirm Rejection"}
                    message={modalConfig.status === 'approved'
                        ? "Are you sure you want to approve this action? This will be recorded as a verified administrative update."
                        : "Please provide a reason for rejecting this request. The proposer will be notified."
                    }
                    actionLabel={modalConfig.label}
                    type={modalConfig.status === 'approved' ? 'info' : 'danger'}
                />
            )}
        </div>
    );
}
