"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { Search, Filter, ShieldCheck, Clock, ExternalLink, CheckCircle2, XCircle, AlertTriangle, Building2, Calendar, Link2, Timer, Lock, UserCheck, Wallet, ShieldAlert, ChevronRight } from "lucide-react";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";

export default function AdminProposals() {
    const { user, profile } = useAuth();
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalConfig, setModalConfig] = useState(null);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const fetchProposals = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/list?collection=admin_proposed_actions&status=pending', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            const pending = (json.data || []).map(p => ({
                ...p,
                isTier3: ['IDENTITY_SUSPEND', 'IDENTITY_REINSTATE', 'FINANCIAL_REFUND', 'COMMISSION_ADJUST', 'PAYOUT_FREEZE', 'PAYOUT_RELEASE'].includes(p.action)
            }));
            setProposals(pending.sort((a, b) => b.createdAt?._seconds - a.createdAt?._seconds));
        } catch (err) {
            console.error("Failed to fetch proposals", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchProposals();
    }, [user]);

    const getRemainingCooldown = (windowStart) => {
        if (!windowStart) return 0;
        const wait = new Date(windowStart) - now;
        return wait > 0 ? Math.ceil(wait / 60000) : 0;
    };

    const handleResolve = async (reason, proposalId, status) => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/actions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: status === 'approved' ? 'ACTION_APPROVE' : 'ACTION_REJECT',
                    targetId: proposalId,
                    reason: reason || "Resolution threshold met.",
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Action failed");
            }

            await fetchProposals();
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
                        <ShieldCheck className="h-6 w-6 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Multi-Signature Governance</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900">Authority Queue</h1>
                    <p className="text-base text-slate-500 mt-3 font-medium max-w-2xl leading-relaxed">
                        Authorize high-sensitivity platform interventions. <span className="text-slate-900">Review justifications, audit evidence, and execute irrevocable platform changes.</span>
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="px-8 py-4 rounded-[1.8rem] bg-indigo-50 border border-indigo-100 flex items-center gap-3">
                        <ShieldCheck className="h-4 w-4 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Dual Approval Active</span>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-96 rounded-[3.5rem] bg-slate-50 border border-slate-200 animate-pulse" />
                    ))}
                </div>
            ) : proposals.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {proposals.map((prop) => {
                        const cooldown = getRemainingCooldown(prop.executionWindowStart);
                        const isLocked = cooldown > 0;
                        const isFinancial = ['FINANCIAL_REFUND', 'COMMISSION_ADJUST', 'PAYOUT_FREEZE', 'PAYOUT_RELEASE'].includes(prop.action);

                        return (
                            <div key={prop.id} className={`group relative flex flex-col p-10 rounded-[3.5rem] bg-white border-2 ${prop.isTier3 ? 'border-red-100 hover:border-red-200 shadow-red-50' : 'border-slate-100 hover:border-indigo-100 shadow-slate-100'} transition-all duration-500 shadow-xl`}>

                                {/* Action Type Badge */}
                                <div className="flex justify-between items-start mb-10">
                                    <div className={`px-5 py-2.5 rounded-2xl border flex items-center gap-3 ${prop.isTier3 ? 'bg-red-50 border-red-100' : 'bg-indigo-50 border-indigo-100'}`}>
                                        {prop.isTier3 ? <ShieldAlert className="h-4 w-4 text-red-600" /> : <AlertTriangle className="h-4 w-4 text-indigo-600" />}
                                        <span className={`text-[11px] font-black uppercase tracking-widest ${prop.isTier3 ? 'text-red-900' : 'text-indigo-900'}`}>{prop.action.replace('_', ' ')}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center justify-end gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">
                                            <Clock className="h-3 w-3" />
                                            {prop.createdAt ? new Date(prop.createdAt._seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending...'}
                                        </div>
                                        <span className="text-[9px] uppercase tracking-widest text-slate-300 font-bold">Origin Admin Required</span>
                                    </div>
                                </div>

                                {/* Cooldown Banner */}
                                {prop.isTier3 && (
                                    <div className={`mb-8 p-6 rounded-3xl border flex items-center justify-between ${isLocked ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isLocked ? 'bg-white text-amber-600' : 'bg-white text-emerald-600'} shadow-sm`}>
                                                <Timer className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className={`text-[11px] font-black uppercase tracking-widest ${isLocked ? 'text-amber-900' : 'text-emerald-900'}`}>
                                                    {isLocked ? 'Cooldown Matrix Active' : 'Observation Phase Complete'}
                                                </p>
                                                <p className="text-[10px] text-slate-500 font-bold">{isLocked ? `${cooldown}m until resolution available` : 'Action ready for final sign-off'}</p>
                                            </div>
                                        </div>
                                        {isLocked && <Lock className="h-4 w-4 text-amber-300" />}
                                    </div>
                                )}

                                {/* Target Info */}
                                <div className="mb-8 space-y-4">
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 border-b border-slate-100 pb-2">Intervention Target</p>
                                    <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 flex items-center gap-5 shadow-inner">
                                        <div className="h-12 w-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                            {isFinancial ? <Wallet className="h-6 w-6 text-slate-400" /> : (prop.targetType === 'venue' ? <Building2 className="h-6 w-6 text-slate-400" /> : <UserCheck className="h-6 w-6 text-slate-400" />)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-black text-slate-900 truncate">{prop.targetId}</p>
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">{prop.targetType}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Justification */}
                                <div className="flex-1 space-y-6">
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 mb-3">Governance Narrative</p>
                                        <p className="text-sm text-slate-500 font-medium leading-relaxed italic border-l-2 border-slate-200 pl-6">"{prop.reason}"</p>
                                    </div>

                                    {prop.evidence && (
                                        <a
                                            href={prop.evidence}
                                            target="_blank"
                                            className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-white border border-slate-200 text-[10px] text-indigo-600 hover:text-indigo-700 hover:border-indigo-200 transition-all font-black uppercase tracking-widest shadow-sm"
                                        >
                                            <Link2 className="h-4 w-4" /> Audit Evidence Reference
                                        </a>
                                    )}
                                </div>

                                {/* Decision Actions */}
                                <div className="mt-10 flex gap-4 pt-10 border-t border-slate-100">
                                    <button
                                        disabled={isLocked || prop.proposerId === user?.uid}
                                        onClick={() => setModalConfig({
                                            id: prop.id,
                                            type: 'approved',
                                            title: 'Final Authority Resolution',
                                            message: prop.isTier3
                                                ? 'This action will be executed immediately. Confirm all legal and financial evidence is correct.'
                                                : 'Verify and authorize this operational change.',
                                            label: 'Execute Authority',
                                            style: prop.isTier3 ? 'danger' : 'info',
                                            isTier3: prop.isTier3
                                        })}
                                        className={`flex-1 flex items-center justify-center gap-3 py-5 rounded-[1.8rem] text-[11px] font-black uppercase tracking-widest transition-all shadow-xl ${isLocked || prop.proposerId === user?.uid
                                            ? 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed'
                                            : (prop.isTier3 ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-200' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200')
                                            }`}
                                    >
                                        {isLocked ? 'Frozen' : 'Approve Intervention'}
                                        {!isLocked && <ChevronRight className="h-4 w-4" />}
                                    </button>
                                    <button
                                        onClick={() => setModalConfig({
                                            id: prop.id,
                                            type: 'rejected',
                                            title: 'Decline Intervention',
                                            message: 'Decline this proposal. You must provide a clear reason for the rejection audit.',
                                            label: 'Decline Proposal',
                                            style: 'danger'
                                        })}
                                        className="px-10 py-5 rounded-[1.8rem] bg-white border border-slate-200 text-[11px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50 hover:border-red-100 transition-all shadow-sm"
                                    >
                                        Reject
                                    </button>
                                </div>

                                {/* Footer Trace */}
                                <div className="mt-6 flex items-center justify-between font-mono text-[9px] font-bold uppercase text-slate-300 tracking-[0.2em]">
                                    <span className="flex items-center gap-1.5"><History className="h-3 w-3" /> TRACE: {prop.id.slice(0, 12)}</span>
                                    <span>AUTH: {prop.proposerId.slice(0, 8)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="py-40 flex flex-col items-center justify-center text-center space-y-6 rounded-[5rem] border-2 border-slate-200 border-dashed bg-slate-50/50">
                    <div className="h-24 w-24 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100">
                        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                    </div>
                    <div>
                        <h3 className="text-3xl font-black tracking-tighter text-slate-900">Universal Calm</h3>
                        <p className="text-base text-slate-500 mt-2 font-medium">No pending actions require secondary authorization at this time.</p>
                    </div>
                </div>
            )}

            {modalConfig && (
                <AdminConfirmModal
                    isOpen={!!modalConfig}
                    onClose={() => setModalConfig(null)}
                    onConfirm={(reason) => handleResolve(reason, modalConfig.id, modalConfig.type)}
                    title={modalConfig.title}
                    message={modalConfig.message}
                    actionLabel={modalConfig.label}
                    type={modalConfig.style}
                    isTier3={modalConfig.isTier3}
                />
            )}
        </div>
    );
}

