"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState, useMemo } from "react";
import { User as UserIcon, TrendingUp, Filter, Lock, ShieldCheck, Ban, Unlock, ShieldAlert, X, RefreshCw } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { ActionDrawer } from "@/components/ui/ActionDrawer";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";

export default function AdminUsers() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [modalConfig, setModalConfig] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [reprovisionType, setReprovisionType] = useState("host");

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

            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error || "Action failed");
            }
            if (json.message) alert(json.message);

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

    const filtered = useMemo(() => {
        return users.filter(u => {
            const matchesFilter = showOnlyBanned ? u.isBanned : true;
            return matchesFilter;
        });
    }, [users, showOnlyBanned]);

    const columns = [
        { 
            key: 'displayName', 
            label: 'Member', 
            sortable: true,
            render: (val, row) => (
                <div className="flex items-center gap-4">
                    <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center font-bold text-xs text-zinc-600 group-hover:text-white transition-colors">
                        {val?.[0] || row.email?.[0] || 'U'}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate uppercase tracking-tight">{val || 'Anonymous'}</p>
                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest truncate mt-0.5">{row.email}</p>
                    </div>
                </div>
            )
        },
        { 
            key: 'createdAt', 
            label: 'Joined Date', 
            sortable: true,
            render: (val) => (
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest font-mono-numbers">
                    {val ? new Date(val).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </p>
            )
        },
        { 
            key: 'isBanned', 
            label: 'Health / Status', 
            sortable: true,
            render: (val) => (
                <div className="flex items-center gap-2.5">
                    <div className={`h-1.5 w-1.5 rounded-full ${val ? 'bg-iris shadow-[0_0_8px_rgba(244,74,34,0.4)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'}`}></div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${val ? 'text-iris' : 'text-zinc-600'}`}>
                        {val ? 'Disabled' : 'Good Standing'}
                    </span>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-12 pb-24">
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <UserIcon className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Community Management</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Member Profiles</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        Manage all platform users and handle administrative actions.
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
            </header>

            <DataTable 
                columns={columns}
                data={filtered}
                searchPlaceholder="Filter members by name, email or ID..."
                onRowClick={(user) => {
                    setSelectedUser(user);
                    setIsDrawerOpen(true);
                }}
            />

            <ActionDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                title={selectedUser?.displayName || 'User Profile'}
                subtitle={`Identity ID: ${selectedUser?.id}`}
                footer={
                    selectedUser?.isBanned ? (
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
                    )
                }
            >
                <div className="space-y-6">
                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-6">
                        <div className="flex items-center justify-between py-2 border-b border-white/[0.02]">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Access Status</p>
                            <div className="flex items-center gap-1.5">
                                {selectedUser?.isBanned ? <Lock className="h-3.5 w-3.5 text-iris" strokeWidth={1.5} /> : <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" strokeWidth={1.5} />}
                                <span className={`text-[9px] font-bold uppercase tracking-widest ${selectedUser?.isBanned ? 'text-iris' : 'text-emerald-500'}`}>
                                    {selectedUser?.isBanned ? 'Restricted' : 'Verified'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-white/[0.02]">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Platform Permissions</p>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Standard Member</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Account Created</p>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                                {selectedUser?.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : '—'}
                            </span>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                            <ShieldAlert className="h-4 w-4 text-iris" strokeWidth={1.5} />
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-iris">Governance Ledger</p>
                        </div>
                        <div className="p-5 rounded-2xl bg-iris/5 border border-iris/10 text-[11px] font-medium text-iris/80 leading-relaxed italic">
                            All administrative actions taken against this identity are recorded in the global audit ledger with a high-priority priority.
                        </div>
                    </div>

                    {selectedUser?.isApproved && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 px-1">
                                <RefreshCw className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">Re-provision Partner Type</p>
                            </div>
                            <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 space-y-4">
                                <p className="text-[11px] text-zinc-400 leading-relaxed">
                                    Use this if the account was approved with the wrong workspace type. This will update Firebase claims, deactivate the old membership, and create the correct one.
                                </p>
                                <div className="space-y-2">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Correct Type</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['host', 'venue', 'promoter'].map(t => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setReprovisionType(t)}
                                                className={`h-9 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${
                                                    reprovisionType === t
                                                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                                                        : 'bg-white/5 border-white/5 text-zinc-500 hover:text-zinc-300'
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setModalConfig({
                                        action: 'PARTNER_REPROVISION',
                                        title: 'RE-PROVISION PARTNER',
                                        message: `Change ${selectedUser?.displayName || selectedUser?.email} from their current type to "${reprovisionType}". This will reset Firebase claims and memberships.`,
                                        label: 'CONFIRM REPROVISION',
                                        type: 'warning',
                                        params: {
                                            partnerType: reprovisionType,
                                            partnerName: selectedUser?.displayName || selectedUser?.email || 'Unknown',
                                        }
                                    })}
                                    className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all font-bold text-[10px] uppercase tracking-widest"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    Re-provision as {reprovisionType}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </ActionDrawer>

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
