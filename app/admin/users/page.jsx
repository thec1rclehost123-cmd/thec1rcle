"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { Search, Shield, User as UserIcon, Calendar, Activity, Lock, Unlock, AlertCircle, TrendingUp, ShieldAlert, Ban, ChevronRight } from "lucide-react";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";

export default function AdminUsers() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [modalConfig, setModalConfig] = useState(null);

    const fetchUsers = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/list?collection=users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            setUsers(json.data || []);
        } catch (err) {
            console.error("Failed to fetch users", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchUsers();
    }, [user]);

    const handleAction = async (reason, targetId, inputValue, evidence) => {
        if (!modalConfig) return;

        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/actions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: modalConfig.action,
                    targetId: selectedUser.id,
                    reason,
                    evidence,
                    params: {
                        type: 'user',
                        message: modalConfig.action === 'WARNING_ISSUE' ? inputValue : undefined,
                        weight: modalConfig.action === 'DISCOVERY_WEIGHT_ADJUST' ? Number(inputValue) : undefined
                    }
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Action failed");
            }

            const successJson = await res.json();
            if (successJson.message) alert(successJson.message);

            await fetchUsers();
            // Refresh selection
            const updated = users.find(u => u.id === selectedUser.id);
            if (updated) setSelectedUser(updated);

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
                        <Shield className="h-6 w-6 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Policy & Trust</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900">Identity Governance</h1>
                    <p className="text-base text-slate-500 mt-3 font-medium max-w-2xl leading-relaxed">
                        Observations into platform-wide identity clusters, trust scores, and activity thresholds. <span className="text-slate-900">Revoke access, issue warnings, and monitor status.</span>
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
                                placeholder="Search identity registry by UID, name or communication vector..."
                                className="w-full bg-slate-50 rounded-[1.8rem] pl-16 pr-8 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all font-semibold placeholder:text-slate-300"
                            />
                        </div>
                    </div>

                    <div className="rounded-[3rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/50">
                                        <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Identity Payload</th>
                                        <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Classification</th>
                                        <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Registry Dt</th>
                                        <th className="px-10 py-6 text-right text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">State</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        [...Array(10)].map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan={4} className="px-10 py-10"><div className="h-4 bg-slate-100 rounded-full w-full"></div></td>
                                            </tr>
                                        ))
                                    ) : users.length > 0 ? users.map((u) => (
                                        <tr
                                            key={u.id}
                                            onClick={() => setSelectedUser(u)}
                                            className={`hover:bg-slate-50 transition-all cursor-pointer group ${selectedUser?.id === u.id ? 'bg-indigo-50/50' : ''}`}
                                        >
                                            <td className="px-10 py-8">
                                                <div className="flex items-center gap-5">
                                                    <div className="h-14 w-14 rounded-full bg-white border border-slate-100 flex items-center justify-center font-black text-sm text-slate-400 shadow-inner group-hover:scale-105 transition-transform">
                                                        {u.displayName?.[0] || u.email?.[0] || '?'}
                                                    </div>
                                                    <div>
                                                        <p className="text-base font-black tracking-tight text-slate-900">{u.displayName || 'Anonymous Identity'}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{u.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-10 py-8">
                                                <div className="flex items-center gap-2">
                                                    {u.role === 'admin' && <Shield className="h-3 w-3 text-indigo-600" />}
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${u.role === 'admin' ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                        {u.role || 'standard'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-8">
                                                <p className="text-[11px] text-slate-500 font-black uppercase tracking-tighter">
                                                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'LEGACY'}
                                                </p>
                                            </td>
                                            <td className="px-10 py-8 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <span className={`h-2.5 w-2.5 rounded-full ring-4 ${u.isBanned ? 'bg-red-500 ring-red-50' : 'bg-emerald-500 ring-emerald-50'}`}></span>
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${u.isBanned ? 'text-red-600' : 'text-slate-900'}`}>
                                                        {u.isBanned ? 'BANNED' : 'ACTIVE'}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={4} className="px-10 py-24 text-center text-sm text-slate-400 font-bold uppercase tracking-widest italic bg-slate-50/30">No identities match the observation filters.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Inspect Column */}
                <aside className="lg:col-span-1">
                    {selectedUser ? (
                        <div className="sticky top-24 p-12 rounded-[3.5rem] border border-slate-200 bg-white shadow-2xl space-y-12 animate-in fade-in slide-in-from-right-8 duration-500">

                            <div className="flex flex-col items-center text-center space-y-6">
                                <div className="h-24 w-24 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-3xl text-slate-300 shadow-inner">
                                    {selectedUser.displayName?.[0] || selectedUser.email?.[0] || '?'}
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-3xl font-black tracking-tighter text-slate-900">{selectedUser.displayName || 'Identity Object'}</h3>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">UUID: {selectedUser.id}</p>
                                </div>
                            </div>

                            <div className="space-y-10">
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-100 space-y-6 shadow-inner">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Access Status</p>
                                            <div className="flex items-center gap-2">
                                                {selectedUser.isBanned ? <Lock className="h-4 w-4 text-red-600" /> : <Unlock className="h-4 w-4 text-emerald-500" />}
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${selectedUser.isBanned ? 'text-red-600' : 'text-emerald-500'}`}>
                                                    {selectedUser.isBanned ? 'Restricted' : 'Universal'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Classification</p>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">{selectedUser.role || 'USER'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6 px-2">
                                    <div className="flex items-center gap-5 text-slate-400">
                                        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                            <Calendar className="h-5 w-5 text-indigo-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registry Entry</p>
                                            <p className="text-sm font-bold text-slate-900">{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : 'LEGACY RECORD'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-5 text-slate-400">
                                        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                            <Activity className="h-5 w-5 text-indigo-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trust Score</p>
                                            <p className="text-sm font-bold text-slate-900">
                                                {selectedUser.warnings?.length ? `ISSUED WARNINGS: ${selectedUser.warnings.length}` : 'OPTIMAL - NO FLAGS'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Tier 1 Actions Enclosure */}
                                <div className="pt-10 border-t border-slate-100 space-y-6">
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 border-b border-slate-100 pb-2">Operational Controls — Tier 1</p>

                                    <div className="grid grid-cols-1 gap-3">
                                        <button
                                            onClick={() => setModalConfig({
                                                action: 'WARNING_ISSUE',
                                                title: 'Issue Formal Warning',
                                                message: 'Dispatches a non-restrictive compliance signal to this identity. Context is stored in the immutable audit trace.',
                                                label: 'Dispatch Warning',
                                                inputLabel: 'Warning Message',
                                                inputPlaceholder: 'Behavior violation regarding...',
                                                type: 'warning'
                                            })}
                                            className="flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-200 hover:border-amber-600 hover:bg-slate-50 transition-all group shadow-sm"
                                        >
                                            <div className="flex items-center gap-4">
                                                <AlertCircle className="h-5 w-5 text-amber-500" />
                                                <span className="text-xs font-black uppercase tracking-widest text-slate-900">Warn Identity</span>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-amber-600 transition-transform group-hover:translate-x-1" />
                                        </button>

                                        <button
                                            disabled={selectedUser.role !== 'host'}
                                            onClick={() => setModalConfig({
                                                action: 'DISCOVERY_WEIGHT_ADJUST',
                                                title: 'Adjust Discovery Weight',
                                                message: 'Modifies the algorithmic amplification of this host. (Range: -10 to 50)',
                                                label: 'Propagate Weight',
                                                inputLabel: 'Numerical Weight',
                                                inputPlaceholder: 'Current: ' + (selectedUser.discoveryWeight || 0),
                                                inputType: 'number',
                                                type: 'info'
                                            })}
                                            className="flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-600 hover:bg-slate-50 transition-all group shadow-sm disabled:opacity-30 disabled:grayscale"
                                        >
                                            <div className="flex items-center gap-4">
                                                <TrendingUp className="h-5 w-5 text-indigo-600" />
                                                <span className="text-xs font-black uppercase tracking-widest text-slate-900">Visibility Bias</span>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-600 transition-transform group-hover:translate-x-1" />
                                        </button>
                                    </div>
                                </div>

                                {/* Tier 3 High-Risk Authority */}
                                <div className="pt-10 border-t border-slate-100 space-y-6">
                                    <div className="flex items-center gap-3">
                                        <ShieldAlert className="h-5 w-5 text-red-600" />
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-red-600">Critical Authority — Tier 3</p>
                                    </div>

                                    {selectedUser.isBanned ? (
                                        <button
                                            onClick={() => setModalConfig({
                                                action: 'IDENTITY_REINSTATE',
                                                title: 'Reinstate Identity Authority',
                                                message: 'Restores the users ability to access the platform. Requires verification of resolved legal/safety issues.',
                                                label: 'Execute Reinstatement',
                                                type: 'info',
                                                isTier3: true
                                            })}
                                            className="w-full flex items-center justify-between p-6 rounded-3xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <Unlock className="h-6 w-6" />
                                                <div className="text-left">
                                                    <span className="block text-sm font-black uppercase tracking-widest">Restore Access</span>
                                                    <span className="block text-[9px] opacity-70 mt-1 font-bold">Unfreeze Identity Rights</span>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-5 w-5 opacity-40 group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setModalConfig({
                                                action: 'IDENTITY_SUSPEND',
                                                title: 'Suspend Identity Authority',
                                                message: 'Revoke all platform access for this identity. Malicious or legally risky users.',
                                                label: 'Authorize Suspension',
                                                type: 'danger',
                                                isTier3: true
                                            })}
                                            className="w-full flex items-center justify-between p-6 rounded-3xl bg-red-600 text-white hover:bg-red-700 transition-all shadow-xl shadow-red-200 group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <Ban className="h-6 w-6" />
                                                <div className="text-left">
                                                    <span className="block text-sm font-black uppercase tracking-widest">Dispatch Ban</span>
                                                    <span className="block text-[9px] opacity-70 mt-1 font-bold">Revoke System Authority</span>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-5 w-5 opacity-40 group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    )}
                                </div>

                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[500px] flex flex-col items-center justify-center p-16 rounded-[4rem] border-2 border-slate-200 border-dashed text-center bg-slate-50/50">
                            <UserIcon className="h-16 w-16 text-slate-200 mb-6" />
                            <p className="text-sm text-slate-400 font-black uppercase tracking-widest leading-relaxed">Select an identity<br />from the registry<br />for lifecycle inspection.</p>
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
                    isTier3={modalConfig.isTier3}
                    inputLabel={modalConfig.inputLabel}
                    inputType={modalConfig.inputType}
                    inputPlaceholder={modalConfig.inputPlaceholder}
                />
            )}
        </div>
    );
}
