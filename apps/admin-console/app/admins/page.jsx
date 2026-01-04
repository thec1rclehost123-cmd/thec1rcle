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
    MoreVertical
} from "lucide-react";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";
import ProvisionAdminModal from "@/components/admin/ProvisionAdminModal";

const rolesList = [
    { id: 'super', label: 'Super Admin', desc: 'Full access to all system modules and policies.' },
    { id: 'ops', label: 'Ops Admin', desc: 'Manage venues, hosts, events, and operations.' },
    { id: 'finance', label: 'Finance Admin', desc: 'Payouts, refunds, and financial reporting.' },
    { id: 'support', label: 'Support Admin', desc: 'User support, disputes, and limited writes.' },
    { id: 'content', label: 'Content Admin', desc: 'Media moderation and event reviewing.' },
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
                    reason: `System provision by ${profile.displayName}`,
                    params: { email, name, role }
                })
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Provision failed");
            }

            await fetchAdmins();
        } catch (err) {
            alert(`Provisioning Error: ${err.message}`);
            throw err;
        }
    };

    const filteredAdmins = admins.filter(a =>
        a.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-12 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 border-b border-slate-200 pb-12">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <ShieldCheck className="h-6 w-6 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Internal Governance</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900">Admin Hierarchy</h1>
                    <p className="text-base text-slate-500 mt-3 font-medium max-w-2xl leading-relaxed">
                        Manage administrative access, define role-based permissions, and audit staff authority levels. <span className="text-slate-900">Ensure least privilege across the organization.</span>
                    </p>
                </div>
                <button
                    onClick={() => setIsProvisionOpen(true)}
                    className="flex items-center gap-3 px-8 py-4 rounded-[1.8rem] bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                >
                    <UserPlus className="h-4 w-4" />
                    Provision Admin
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
                {/* Main List */}
                <div className="lg:col-span-3 space-y-8">
                    <div className="flex gap-4 p-3 rounded-[2.5rem] bg-white border border-slate-200 shadow-sm">
                        <div className="relative flex-1">
                            <Search className="absolute left-8 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search admin registry by name, email or UID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 rounded-[1.8rem] pl-16 pr-8 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all font-semibold placeholder:text-slate-300"
                            />
                        </div>
                    </div>

                    <div className="rounded-[3rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Staff Member</th>
                                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Assigned Role</th>
                                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Activity Status</th>
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
                                ) : filteredAdmins.length > 0 ? filteredAdmins.map((adm) => (
                                    <tr
                                        key={adm.id}
                                        onClick={() => setSelectedAdmin(adm)}
                                        className={`group cursor-pointer transition-all ${selectedAdmin?.id === adm.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50/50'}`}
                                    >
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-5">
                                                <div className="h-12 w-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center font-black text-xs text-slate-400 shadow-inner">
                                                    {adm.displayName?.[0] || adm.email?.[0]}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-900">{adm.displayName || 'Unnamed Admin'}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{adm.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200">
                                                <Shield className="h-3 w-3 text-slate-900" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">{adm.admin_role || 'readonly'}</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-2">
                                                <div className={`h-1.5 w-1.5 rounded-full ${adm.status === 'suspended' ? 'bg-red-500' : 'bg-emerald-500'} shadow-[0_0_8px_rgba(16,185,129,0.4)]`} />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{adm.status === 'suspended' ? 'Suspended' : 'Active Node'}</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8 text-right">
                                            <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-900 transition-all opacity-0 group-hover:opacity-100" />
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={4} className="px-10 py-24 text-center text-[10px] font-black uppercase tracking-widest text-slate-300 italic">No administrative identities match the search criteria.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Inspect Side */}
                <aside className="lg:col-span-1">
                    {selectedAdmin ? (
                        <div className="sticky top-24 p-12 rounded-[3.5rem] border border-slate-200 bg-white shadow-2xl space-y-12 animate-in fade-in slide-in-from-right-8">
                            <div className="flex flex-col items-center text-center space-y-6">
                                <div className="h-24 w-24 rounded-[2rem] bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-3xl text-slate-300 shadow-inner">
                                    {selectedAdmin.displayName?.[0] || selectedAdmin.email?.[0]}
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-3xl font-black tracking-tighter text-slate-900">{selectedAdmin.displayName}</h3>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{selectedAdmin.admin_role || 'readonly'} Authority</p>
                                </div>
                            </div>

                            <div className="space-y-10">
                                <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-100 space-y-6 shadow-inner">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Permissions Cage</p>
                                        <div className="flex items-center gap-2">
                                            <Lock className="h-3.5 w-3.5 text-indigo-600" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Strict RBAC</span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-600 leading-relaxed italic">"Access restricted to {selectedAdmin.admin_role || 'readonly'} modules and authorized endpoints."</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 mb-4 px-2">Update Access Matrix</p>
                                    <div className="grid grid-cols-1 gap-2">
                                        {rolesList.map((role) => (
                                            <button
                                                key={role.id}
                                                disabled={selectedAdmin.admin_role === role.id}
                                                onClick={() => setModalConfig({
                                                    action: 'ADMIN_ROLE_UPDATE',
                                                    title: `Assign ${role.label}`,
                                                    message: `Updating authority level to ${role.label}. ${role.desc}`,
                                                    label: 'Update Permissions',
                                                    inputValue: role.id,
                                                    type: 'info'
                                                })}
                                                className={`flex items-center justify-between p-5 rounded-2xl border transition-all text-left group ${selectedAdmin.admin_role === role.id
                                                    ? 'bg-indigo-50 border-indigo-200'
                                                    : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}
                                            >
                                                <div>
                                                    <p className={`text-[11px] font-black uppercase tracking-widest ${selectedAdmin.admin_role === role.id ? 'text-indigo-900' : 'text-slate-900'}`}>{role.label}</p>
                                                    <p className="text-[9px] text-slate-400 font-medium mt-1 pr-6">{role.desc}</p>
                                                </div>
                                                {selectedAdmin.admin_role === role.id && <ShieldCheck className="h-4 w-4 text-indigo-600 flex-shrink-0" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-10 border-t border-slate-100">
                                    <button
                                        onClick={() => setModalConfig({
                                            action: 'USER_REVOKE_ACCESS',
                                            title: 'Revoke Security Clearance',
                                            message: 'Instantly revokes all administrative access for this account. The user will be demoted to standard status immediately.',
                                            label: 'Revoke Access',
                                            type: 'danger',
                                            isTier3: true
                                        })}
                                        className="w-full flex items-center justify-between p-6 rounded-3xl bg-red-600 text-white hover:bg-red-700 transition-all shadow-xl shadow-red-100 group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <ShieldAlert className="h-6 w-6" />
                                            <div className="text-left">
                                                <span className="block text-sm font-black uppercase tracking-widest text-white">Full Revoke</span>
                                                <span className="block text-[9px] opacity-70 mt-1 font-bold">Terminate Authority</span>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-5 w-5 opacity-40 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[500px] flex flex-col items-center justify-center p-16 rounded-[4rem] border-2 border-slate-200 border-dashed text-center bg-slate-50/50">
                            <Shield className="h-16 w-16 text-slate-200 mb-6" />
                            <p className="text-sm text-slate-400 font-black uppercase tracking-widest leading-relaxed">Select a staff member<br />to modify organizational<br />clearance.</p>
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
