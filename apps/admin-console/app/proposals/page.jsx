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
    ArrowRight
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
            // Sort by most recent
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
                    reason: reason || "Resolution from Governance Board"
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
        <div className="space-y-12 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 border-b border-slate-200 pb-12">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <Clock className="h-6 w-6 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Governance Pipeline</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900">Pending Approvals</h1>
                    <p className="text-base text-slate-500 mt-3 font-medium max-w-2xl leading-relaxed">
                        Review high-risk administrative proposals requiring dual sign-off. <span className="text-slate-900">Enforce dual-signature protocols and verify risk thresholds.</span>
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
                <div className="lg:col-span-3 space-y-8">
                    {/* Search & Stats */}
                    <div className="flex gap-4 p-3 rounded-[2.5rem] bg-white border border-slate-200 shadow-sm items-center">
                        <div className="relative flex-1">
                            <Search className="absolute left-8 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search proposals by action, target or status..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 rounded-[1.8rem] pl-16 pr-8 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all font-semibold placeholder:text-slate-300"
                            />
                        </div>
                        <div className="px-6 flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {proposals.filter(p => p.status === 'pending').length} In Queue
                            </span>
                        </div>
                    </div>

                    {/* Proposals Table */}
                    <div className="rounded-[3rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Proposed Action</th>
                                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Proposer</th>
                                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</th>
                                    <th className="px-10 py-6"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    [1, 2, 3].map(i => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={4} className="px-10 py-10"><div className="h-4 bg-slate-100 rounded-full w-full"></div></td>
                                        </tr>
                                    ))
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-10 py-24 text-center text-[10px] font-black uppercase tracking-widest text-slate-300 italic">No proposals found matching the current observation.</td>
                                    </tr>
                                ) : filtered.map((p) => (
                                    <tr
                                        key={p.id}
                                        onClick={() => setSelectedProp(p)}
                                        className={`group cursor-pointer transition-all ${selectedProp?.id === p.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50/50'}`}
                                    >
                                        <td className="px-10 py-8">
                                            <p className="text-sm font-black text-slate-900 flex items-center gap-2">
                                                {p.action}
                                                {p.action.includes('REFUND') && <span className="px-2 py-0.5 rounded-full bg-red-100 text-[10px] text-red-600">Financial</span>}
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Target: {p.targetId}</p>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-md bg-slate-100 flex items-center justify-center text-[9px] font-black text-slate-400">
                                                    {p.proposerRole?.[0].toUpperCase()}
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{p.proposerRole}</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border ${p.status === 'pending' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                                                    p.status === 'approved' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                                                        'bg-slate-50 border-slate-100 text-slate-400'
                                                }`}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="px-10 py-8 text-right">
                                            <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-900 transition-all" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Proposal View */}
                <aside className="lg:col-span-1">
                    {selectedProp ? (
                        <div className="sticky top-24 p-12 rounded-[3.5rem] border border-slate-200 bg-white shadow-2xl space-y-12 animate-in fade-in slide-in-from-right-8">
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Proposal Details</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Tier 3</span>
                                </div>
                                <h3 className="text-3xl font-black tracking-tighter text-slate-900">{selectedProp.action}</h3>
                                <p className="text-sm font-medium text-slate-500 leading-relaxed italic">"{selectedProp.reason}"</p>
                            </div>

                            <div className="space-y-8">
                                <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-100 space-y-6 shadow-inner">
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <span>Proposer</span>
                                        <span>Role</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-900 truncate pr-4">{selectedProp.proposerId}</span>
                                        <span className="text-[10px] font-black uppercase text-indigo-600">{selectedProp.proposerRole}</span>
                                    </div>
                                </div>

                                {selectedProp.params && Object.keys(selectedProp.params).length > 0 && (
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-900 px-2">Action Payloads</p>
                                        <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-100 space-y-4 shadow-inner overflow-hidden">
                                            {Object.entries(selectedProp.params).map(([key, val]) => (
                                                <div key={key} className="flex justify-between items-center text-[10px]">
                                                    <span className="font-bold text-slate-400 uppercase tracking-widest">{key}:</span>
                                                    <span className="font-black text-slate-900 truncate max-w-[150px]">{JSON.stringify(val)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedProp.status === 'pending' && (
                                    <div className="flex flex-col gap-4">
                                        <button
                                            onClick={() => setModalConfig({ status: 'approved', label: 'Authorize Action' })}
                                            className="w-full flex items-center justify-center gap-3 p-6 rounded-3xl bg-slate-900 text-white hover:bg-emerald-600 transition-all shadow-xl shadow-slate-200"
                                        >
                                            <CheckCircle className="h-5 w-5" />
                                            <span className="text-sm font-black uppercase tracking-widest">Execute Approval</span>
                                        </button>
                                        <button
                                            onClick={() => setModalConfig({ status: 'rejected', label: 'Deny Proposal' })}
                                            className="w-full flex items-center justify-center gap-3 p-6 rounded-3xl bg-white border border-slate-200 text-slate-900 hover:bg-red-50 hover:border-red-100 hover:text-red-600 transition-all font-black uppercase tracking-widest text-sm"
                                        >
                                            <XCircle className="h-5 w-5" />
                                            Reject Proposal
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[500px] flex flex-col items-center justify-center p-16 rounded-[4rem] border-2 border-slate-200 border-dashed text-center bg-slate-50/50">
                            <Shield className="h-16 w-16 text-slate-200 mb-6" />
                            <p className="text-sm text-slate-400 font-black uppercase tracking-widest leading-relaxed">Select a proposal<br />to verify risk and<br />authorize execution.</p>
                        </div>
                    )}
                </aside>
            </div>

            {modalConfig && (
                <AdminConfirmModal
                    isOpen={!!modalConfig}
                    onClose={() => setModalConfig(null)}
                    onConfirm={(reason) => handleResolve(modalConfig.status, reason)}
                    title={modalConfig.status === 'approved' ? "Governance Approval" : "Governance Rejection"}
                    message={modalConfig.status === 'approved'
                        ? "Are you sure you want to authorize this administrative action? This will be recorded as a dual-signature execution."
                        : "Please provide a reason for rejecting this proposal. This will be visible to the original proposer."
                    }
                    actionLabel={modalConfig.label}
                    type={modalConfig.status === 'approved' ? 'info' : 'danger'}
                />
            )}
        </div>
    );
}
