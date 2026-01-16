"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { Search, Shield, User as UserIcon, Calendar, Activity, Lock, Unlock, AlertCircle, TrendingUp, ShieldAlert, Ban, ChevronRight, CheckCircle, XCircle, Info, RefreshCw, X, ShieldCheck } from "lucide-react";
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
            alert(`Error: ${err.message}`);
            throw err;
        }
    };

    const [showOnlyBanned, setShowOnlyBanned] = useState(false);

    const exportToCSV = () => {
        const headers = ["ID", "Name", "Email", "Joined Date", "Status"];
        const rows = filtered.map(u => [
            u.id,
            u.displayName || 'Anonymous',
            u.email,
            u.createdAt ? new Date(u.createdAt).toISOString() : 'N/A',
            u.isBanned ? 'Restricted' : 'Active'
        ]);

        const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `member_directory_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    const filtered = users.filter(u => {
        const matchesSearch = u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.id?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = showOnlyBanned ? u.isBanned : true;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-12 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <UserIcon className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Community Management</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Member Profiles</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        Manage all platform users, monitor account status, and handle administrative actions.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowOnlyBanned(!showOnlyBanned)}
                        className={`flex items-center gap-2.5 px-6 py-3 rounded-xl border text-[11px] font-bold uppercase tracking-widest transition-all ${showOnlyBanned ? 'bg-iris text-white border-iris shadow-lg shadow-iris/20' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'}`}
                    >
                        <Filter className="w-4 h-4" />
                        {showOnlyBanned ? 'Showing Restricted' : 'Filter Restricted'}
                    </button>
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-400 text-[11px] font-bold uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all font-mono-numbers"
                    >
                        <TrendingUp className="w-4 h-4" />
                        Export Directory
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
                            placeholder="Find member by name, email or ID..."
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
                                        <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Member Status</th>
                                        <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Date Joined</th>
                                        <th className="px-8 py-4 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Health</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#ffffff05]">
                                    {loading ? (
                                        [...Array(8)].map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan={3} className="px-8 py-8 h-20 bg-white/[0.01]" />
                                            </tr>
                                        ))
                                    ) : filtered.length > 0 ? filtered.map((u) => (
                                        <tr
                                            key={u.id}
                                            onClick={() => setSelectedUser(u)}
                                            className={`hover:bg-white/[0.01] transition-colors cursor-pointer group ${selectedUser?.id === u.id ? 'bg-white/[0.05]' : ''}`}
                                        >
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center font-bold text-xs text-zinc-600 group-hover:text-white transition-colors">
                                                        {u.displayName?.[0] || u.email?.[0] || 'U'}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-white truncate uppercase tracking-tight">{u.displayName || 'Anonymous Member'}</p>
                                                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest truncate mt-0.5">{u.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest font-mono-numbers">
                                                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                                </p>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex items-center justify-end gap-2.5">
                                                    <div className={`h-1.5 w-1.5 rounded-full ${u.isBanned ? 'bg-iris shadow-[0_0_8px_rgba(244,74,34,0.4)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'}`}></div>
                                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${u.isBanned ? 'text-iris' : 'text-zinc-600'}`}>
                                                        {u.isBanned ? 'Disabled' : 'Good Standing'}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={3} className="px-8 py-24 text-center">
                                            <div className="h-16 w-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/5 shadow-inner">
                                                <UserIcon className="h-8 w-8 text-zinc-800" strokeWidth={1} />
                                            </div>
                                            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">No results found</h4>
                                            <p className="text-[10px] text-zinc-600 mt-2 font-bold uppercase tracking-[0.2em]">Try adjusting your search terms.</p>
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Inspection Panel */}
                <aside className="lg:col-span-4 h-fit">
                    {selectedUser ? (
                        <div className="sticky top-28 space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="bg-obsidian-surface border border-[#ffffff08] rounded-xl p-8 space-y-8 shadow-2xl relative">
                                <button
                                    onClick={() => setSelectedUser(null)}
                                    className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                                >
                                    <X className="h-4 w-4" strokeWidth={1.5} />
                                </button>

                                <div className="flex flex-col items-center text-center space-y-4 pt-2">
                                    <div className="h-20 w-20 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center font-bold text-2xl text-white shadow-inner">
                                        {selectedUser.displayName?.[0] || selectedUser.email?.[0] || 'U'}
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-semibold tracking-tight text-white mb-1.5 uppercase">{selectedUser.displayName || 'User Profile'}</h3>
                                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">ID: {selectedUser.id}</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="p-5 rounded-xl bg-white/[0.02] border border-[#ffffff05] space-y-4">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Access Status</p>
                                            <div className="flex items-center gap-1.5">
                                                {selectedUser.isBanned ? <Lock className="h-3.5 w-3.5 text-iris" strokeWidth={1.5} /> : <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" strokeWidth={1.5} />}
                                                <span className={`text-[9px] font-bold uppercase tracking-widest ${selectedUser.isBanned ? 'text-iris' : 'text-emerald-500'}`}>
                                                    {selectedUser.isBanned ? 'Restricted' : 'Verified'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Platform Permissions</p>
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Standard Member</span>
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-[#ffffff05] space-y-4">
                                        <div className="flex items-center gap-2 px-1">
                                            <ShieldAlert className="h-4 w-4 text-iris" strokeWidth={1.5} />
                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-iris">Admin Controls</p>
                                        </div>

                                        {selectedUser.isBanned ? (
                                            <button
                                                onClick={() => setModalConfig({
                                                    action: 'USER_UNBAN',
                                                    title: 'Restore Account Access',
                                                    message: 'Allow this user to log in and use the platform again.',
                                                    label: 'Approve Restoration',
                                                    type: 'info',
                                                    isTier3: true
                                                })}
                                                className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 transition-all font-bold text-[11px] uppercase tracking-widest"
                                            >
                                                <Unlock className="h-4 w-4" strokeWidth={2} />
                                                Restore Account
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setModalConfig({
                                                    action: 'USER_BAN',
                                                    title: 'Restrict Account Access',
                                                    message: 'Prevent this user from accessing the platform. This action will be logged.',
                                                    label: 'Confirm Restriction',
                                                    type: 'danger',
                                                    isTier3: true
                                                })}
                                                className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-iris/10 border border-iris/20 text-white hover:bg-iris/20 transition-all font-bold text-[11px] uppercase tracking-widest shadow-lg shadow-iris/10"
                                            >
                                                <Ban className="h-4 w-4" strokeWidth={2} />
                                                Restrict Account
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[400px] flex flex-col items-center justify-center rounded-xl border border-[#ffffff05] bg-white/[0.01] text-center p-8 sticky top-28">
                            <UserIcon className="h-12 w-12 text-zinc-800 mb-6" strokeWidth={1} />
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">Select a member profile<br />to review account details.</p>
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
