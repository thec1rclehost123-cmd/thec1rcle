"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import {
    Shield,
    Search,
    UserPlus,
    ShieldCheck,
    ShieldAlert,
    Activity,
    History,
    ChevronRight,
    Lock,
    Unlock,
    MoreVertical,
    X,
    User,
    CheckCircle2
} from "lucide-react";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";
import ProvisionAdminModal from "@/components/admin/ProvisionAdminModal";

const rolesList = [
    { id: 'super', label: 'Super Admin', desc: 'Full access to all system modules and policies.' },
    { id: 'ops', label: 'Operations', desc: 'Manage venues, hosts, events, and partners.' },
    { id: 'finance', label: 'Finance', desc: 'Payouts, refunds, and financial reporting.' },
    { id: 'support', label: 'Support', desc: 'User support, disputes, and limited writes.' },
    { id: 'content', label: 'Content', desc: 'Media moderation and event reviewing.' },
];

export default function AdminsManagement() {
    const { user, profile } = useAuth();
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAdmin, setSelectedAdmin] = useState(null);
    const [modalConfig, setModalConfig] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [isProvisionOpen, setIsProvisionOpen] = useState(false);

    const fetchAdmins = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/list?collection=admins', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            setAdmins(json.data || []);
        } catch (err) {
            console.error("Failed to fetch admins", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchAdmins();
    }, [user]);

    const handleAction = async (reason, targetId, inputValue) => {
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
                    targetId: targetId || selectedAdmin.id,
                    reason,
                    params: {
                        admin_role: modalConfig.action === 'ADMIN_ROLE_UPDATE' ? inputValue : undefined,
                        type: 'admin'
                    }
                })
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Action failed");
            }

            await fetchAdmins();
            setModalConfig(null);
        } catch (err) {
            alert(err.message);
        }
    };

    const handleProvision = async ({ email, name, role }) => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/actions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'ADMIN_PROVISION',
                    targetId: email,
                    reason: `System setup by ${profile.displayName}`,
                    params: { email, name, role }
                })
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Setup failed");
            }

            await fetchAdmins();
        } catch (err) {
            alert(`Setup Error: ${err.message}`);
            throw err;
        }
    };

    const filteredAdmins = admins.filter(a =>
        a.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-12 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <ShieldCheck className="h-4 w-4 text-iris" strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-iris">Governance Node</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Staff Directory</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        Manage administrative access, define permissions, and audit authority levels.
                    </p>
                </div>
                <button
                    onClick={() => setIsProvisionOpen(true)}
                    className="flex items-center gap-2.5 px-6 py-3 rounded-lg bg-white text-black text-[11px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-lg shadow-white/5"
                >
                    <UserPlus className="h-4 w-4" />
                    New Staff Member
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main List Area */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-500 group-focus-within:text-zinc-300 transition-colors" strokeWidth={1.5} />
                        <input
                            type="text"
                            placeholder="Search staff by name, email or reference..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 focus:bg-zinc-900 transition-all font-medium placeholder:text-zinc-600 text-white"
                        />
                    </div>

                    <div className="bg-obsidian-surface rounded-xl border border-[#ffffff08] overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/[0.02] border-b border-[#ffffff08]">
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Staff Member</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Role</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Status</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#ffffff05]">
                                {loading ? (
                                    [1, 2, 3].map(i => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={4} className="px-6 py-6"><div className="h-4 bg-white/5 rounded-full w-full"></div></td>
                                        </tr>
                                    ))
                                ) : filteredAdmins.length > 0 ? filteredAdmins.map((adm) => (
                                    <tr
                                        key={adm.id}
                                        onClick={() => setSelectedAdmin(adm)}
                                        className={`group cursor-pointer transition-colors ${selectedAdmin?.id === adm.id ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'}`}
                                    >
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center font-bold text-xs text-zinc-500 shadow-inner group-hover:text-white transition-colors">
                                                    {adm.displayName?.[0] || adm.email?.[0]}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-white truncate">{adm.displayName || 'Unnamed Admin'}</p>
                                                    <p className="text-[10px] text-zinc-500 font-medium truncate uppercase tracking-tighter">{adm.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/5 border border-white/5">
                                                <Shield className="h-3 w-3 text-white opacity-50" strokeWidth={1.5} />
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-white">{adm.admin_role || 'readonly'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <div className={`h-1 w-1 rounded-full ${adm.status === 'suspended' ? 'bg-iris' : 'bg-emerald-500'} shadow-[0_0_8px_rgba(16,185,129,0.4)]`} />
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{adm.status === 'suspended' ? 'Suspended' : 'Active'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <ChevronRight className={`h-4 w-4 transition-all ${selectedAdmin?.id === adm.id ? 'text-white translate-x-1' : 'text-zinc-700 group-hover:text-white group-hover:translate-x-1'}`} strokeWidth={1.5} />
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-20 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-700 italic">No administrative identities found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Inspection Panel */}
                <aside className="lg:col-span-4 h-fit">
                    {selectedAdmin ? (
                        <div className="sticky top-28 space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="bg-obsidian-surface border border-[#ffffff08] rounded-xl p-8 space-y-8 shadow-2xl relative">
                                <button
                                    onClick={() => setSelectedAdmin(null)}
                                    className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                                >
                                    <X className="h-4 w-4" strokeWidth={1.5} />
                                </button>

                                <div className="flex flex-col items-center text-center space-y-4 pt-2">
                                    <div className="h-20 w-20 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center font-bold text-2xl text-white shadow-inner">
                                        {selectedAdmin.displayName?.[0] || selectedAdmin.email?.[0]}
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-semibold tracking-tight text-white mb-1.5">{selectedAdmin.displayName}</h3>
                                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">{selectedAdmin.admin_role || 'readonly'} Authority</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="p-5 rounded-xl bg-white/[0.02] border border-[#ffffff05] space-y-4">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Permission Scope</p>
                                            <div className="flex items-center gap-1.5 text-iris">
                                                <Lock className="h-3.5 w-3.5" strokeWidth={1.5} />
                                                <span className="text-[9px] font-bold uppercase tracking-widest">Enforced</span>
                                            </div>
                                        </div>
                                        <p className="text-[11px] font-medium text-zinc-400 italic leading-relaxed">"Authorized access to {selectedAdmin.admin_role || 'readonly'} modules and specific operational endpoints."</p>
                                    </div>

                                    <div className="space-y-4 pt-2">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 px-1">Authority Management</p>
                                        <div className="space-y-2">
                                            {rolesList.map((role) => (
                                                <button
                                                    key={role.id}
                                                    disabled={selectedAdmin.admin_role === role.id}
                                                    onClick={() => setModalConfig({
                                                        action: 'ADMIN_ROLE_UPDATE',
                                                        title: `Assign ${role.label}`,
                                                        message: `Update ${selectedAdmin.displayName}'s authority level to ${role.label}.`,
                                                        label: 'Update Permissions',
                                                        inputValue: role.id,
                                                        type: 'info'
                                                    })}
                                                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left group ${selectedAdmin.admin_role === role.id
                                                        ? 'bg-white/[0.05] border-white/10'
                                                        : 'bg-black/20 border-white/[0.02] hover:border-white/10 hover:bg-white/[0.02]'}`}
                                                >
                                                    <div className="min-w-0">
                                                        <p className={`text-[11px] font-bold uppercase tracking-widest ${selectedAdmin.admin_role === role.id ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`}>{role.label}</p>
                                                        <p className="text-[9px] text-zinc-600 font-medium mt-0.5 truncate pr-8">{role.desc}</p>
                                                    </div>
                                                    {selectedAdmin.admin_role === role.id && <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" strokeWidth={1.5} />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-[#ffffff05]">
                                        <button
                                            onClick={() => setModalConfig({
                                                action: 'USER_REVOKE_ACCESS',
                                                title: 'Revoke Permissions',
                                                message: 'Immediately terminate all administrative access for this staff member.',
                                                label: 'Confirm Revocation',
                                                type: 'danger',
                                                isTier3: true
                                            })}
                                            className="w-full flex items-center justify-between p-5 rounded-xl bg-iris/10 border border-iris/20 text-white hover:bg-iris/20 transition-all group"
                                        >
                                            <div className="flex items-center gap-4 text-left">
                                                <ShieldAlert className="h-6 w-6 text-iris" strokeWidth={1.5} />
                                                <div>
                                                    <span className="block text-sm font-bold tracking-tight">Full Revoke</span>
                                                    <span className="block text-[9px] text-iris font-bold uppercase tracking-widest mt-0.5 opacity-80">Terminate Clearance</span>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-iris group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-2 text-center">
                                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest italic opacity-50">Monitoring staff authority matrix.</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[400px] flex flex-col items-center justify-center rounded-xl border border-[#ffffff05] bg-white/[0.01] text-center p-8 sticky top-28">
                            <Shield className="h-12 w-12 text-zinc-800 mb-6" strokeWidth={1} />
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">Select a staff member<br />to modify organizational access.</p>
                        </div>
                    )}
                </aside>
            </div>

            {modalConfig && (
                <AdminConfirmModal
                    isOpen={!!modalConfig}
                    onClose={() => setModalConfig(null)}
                    onConfirm={(reason) => handleAction(reason, selectedAdmin.id, modalConfig.inputValue)}
                    title={modalConfig.title}
                    message={modalConfig.message}
                    actionLabel={modalConfig.label}
                    type={modalConfig.type}
                    isTier3={modalConfig.isTier3}
                />
            )}
            {isProvisionOpen && (
                <ProvisionAdminModal
                    isOpen={isProvisionOpen}
                    onClose={() => setIsProvisionOpen(false)}
                    onProvision={handleProvision}
                />
            )}
        </div>
    );
}
