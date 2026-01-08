"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { Search, Shield, User as UserIcon, Calendar, Activity, Lock, Unlock, AlertCircle, TrendingUp, ShieldAlert, Ban, ChevronRight, CheckCircle, XCircle, Info, RefreshCw } from "lucide-react";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";

export default function AdminUsers() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [modalConfig, setModalConfig] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const token = await user.getIdToken();
            const res = await fetch('/api/list?collection=users', {
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
            const res = await fetch('/api/actions', {
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
                        ...(modalConfig.params || {})
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
            setModalConfig(null);

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
                        <UserIcon className="h-6 w-6 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Consumer Registry</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900">Platform Users</h1>
                    <p className="text-base text-slate-500 mt-3 font-medium max-w-2xl leading-relaxed">
                        Isolated consumer identities for the public website. <span className="text-slate-900">Entities (Venues, Hosts, Promoters) are managed separately to prevent context leakage.</span>
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
                                placeholder="Search consumer users by UID, name or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 rounded-[1.8rem] pl-16 pr-8 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all font-semibold placeholder:text-slate-300"
                            />
                        </div>
                    </div>

                    <div className="rounded-[3rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/50">
                                        <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Consumer Payload</th>
                                        <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Registry Dt</th>
                                        <th className="px-10 py-6 text-right text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">State</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        [...Array(10)].map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan={3} className="px-10 py-10"><div className="h-4 bg-slate-100 rounded-full w-full"></div></td>
                                            </tr>
                                        ))
                                    ) : users.filter(u =>
                                        u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        u.id?.toLowerCase().includes(searchTerm.toLowerCase())
                                    ).length > 0 ? users.filter(u =>
                                        u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        u.id?.toLowerCase().includes(searchTerm.toLowerCase())
                                    ).map((u) => (
                                        <tr
                                            key={u.id}
                                            onClick={() => setSelectedUser(u)}
                                            className={`hover:bg-slate-50 transition-all cursor-pointer group ${selectedUser?.id === u.id ? 'bg-indigo-50/50' : ''}`}
                                        >
                                            <td className="px-10 py-8">
                                                <div className="flex items-center gap-5">
                                                    <div className="h-14 w-14 rounded-full bg-white border border-slate-100 flex items-center justify-center font-black text-sm text-slate-400 shadow-inner group-hover:scale-105 transition-transform">
                                                        {u.displayName?.[0] || u.email?.[0] || 'U'}
                                                    </div>
                                                    <div>
                                                        <p className="text-base font-black tracking-tight text-slate-900">{u.displayName || 'Consumer User'}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{u.email}</p>
                                                    </div>
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
                                        <tr><td colSpan={3} className="px-10 py-24 text-center text-sm text-slate-400 font-bold uppercase tracking-widest italic bg-slate-50/30">No consumer users found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Inspect Column */}
                <aside className="lg:col-span-1">
                    {selectedUser ? (
                        <div className="sticky top-24 p-10 rounded-[3.5rem] border border-slate-200 bg-white shadow-2xl space-y-10 animate-in fade-in slide-in-from-right-8 duration-500 max-h-[calc(100vh-8rem)] overflow-y-auto">

                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="h-20 w-20 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-3xl text-slate-300 shadow-inner">
                                    {selectedUser.displayName?.[0] || selectedUser.email?.[0] || 'U'}
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black tracking-tighter text-slate-900">{selectedUser.displayName || 'Consumer Identity'}</h3>
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] break-all">{selectedUser.id}</p>
                                </div>
                            </div>

                            <div className="space-y-8">
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-100 space-y-6 shadow-inner">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Access Status</p>
                                            <div className="flex items-center gap-2">
                                                {selectedUser.isBanned ? <Lock className="h-4 w-4 text-red-600" /> : <Unlock className="h-4 w-4 text-emerald-500" />}
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${selectedUser.isBanned ? 'text-red-600' : 'text-emerald-500'}`}>
                                                    {selectedUser.isBanned ? 'Restricted' : 'Active'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Context Domain</p>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Public Website</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-100 space-y-6">
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-red-600">Identity Actions</p>

                                    {selectedUser.isBanned ? (
                                        <button
                                            onClick={() => setModalConfig({
                                                action: 'USER_UNBAN',
                                                title: 'Restore Website Access',
                                                message: 'Allows this email to log in and buy tickets again.',
                                                label: 'Unban User',
                                                type: 'info',
                                                isTier3: true
                                            })}
                                            className="w-full flex items-center justify-between p-6 rounded-3xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <Unlock className="h-6 w-6" />
                                                <div className="text-left">
                                                    <span className="block text-sm font-black uppercase tracking-widest">Unban User</span>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-5 w-5 opacity-40 group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setModalConfig({
                                                action: 'USER_BAN',
                                                title: 'Revoke Website Access',
                                                message: 'Prevents this email from using the public website. Does NOT affect potential business dashboard access.',
                                                label: 'Ban User',
                                                type: 'danger',
                                                isTier3: true
                                            })}
                                            className="w-full flex items-center justify-between p-6 rounded-3xl bg-red-600 text-white hover:bg-red-700 transition-all shadow-xl shadow-red-200 group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <Ban className="h-6 w-6" />
                                                <div className="text-left">
                                                    <span className="block text-sm font-black uppercase tracking-widest">Ban User</span>
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
                            <p className="text-sm text-slate-400 font-black uppercase tracking-widest leading-relaxed">Select a user<br />from the registry<br />for investigation.</p>
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
                />
            )}
        </div>
    );
}
