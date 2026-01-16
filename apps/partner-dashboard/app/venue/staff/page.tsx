"use client";

import { useState, useEffect } from "react";
import {
    Users,
    UserPlus,
    Shield,
    ShieldCheck,
    Trash2,
    Edit3,
    Check,
    X,
    MoreHorizontal,
    Mail,
    Phone,
    Eye,
    EyeOff,
    AlertCircle
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { cleanJargon } from "@/lib/utils/jargon";

interface StaffMember {
    id: string;
    email: string;
    name: string;
    role: string;
    phone?: string;
    isVerified: boolean;
    isActive: boolean;
    permissions: Record<string, boolean>;
    createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
    manager: "Manager",
    floor_manager: "Floor Manager",
    security: "Security",
    ops: "Operations",
    finance: "Finance",
    viewer: "Viewer"
};

const ROLE_COLORS: Record<string, string> = {
    manager: "text-iris bg-iris/10 border-iris/20",
    floor_manager: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    security: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    ops: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    finance: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    viewer: "text-[var(--text-primary)] bg-black/5 border-black/10"
};

export default function VenueStaffPage() {
    const { profile } = useDashboardAuth();
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [roleOptions, setRoleOptions] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

    const venueId = profile?.activeMembership?.partnerId;

    useEffect(() => {
        if (venueId) {
            fetchStaff();
        }
    }, [venueId]);

    const fetchStaff = async () => {
        try {
            const res = await fetch(`/api/venue/staff?venueId=${venueId}&isActive=all`);
            const data = await res.json();
            setStaff(data.staff || []);
            setRoleOptions(data.roleOptions || []);
        } catch (err) {
            console.error("Failed to fetch staff:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddStaff = async (formData: { email: string; name: string; role: string; phone?: string }) => {
        try {
            const res = await fetch("/api/venue/staff", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    venueId,
                    ...formData,
                    addedBy: {
                        uid: profile?.uid,
                        name: profile?.displayName,
                        email: profile?.email
                    }
                })
            });

            if (!res.ok) {
                const data = await res.json();
                alert(data.error || "Failed to add staff member");
                return;
            }

            setShowAddModal(false);
            fetchStaff();
        } catch (err) {
            console.error("Failed to add staff:", err);
        }
    };

    const handleAction = async (staffId: string, action: string) => {
        try {
            const res = await fetch("/api/venue/staff", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    staffId,
                    action,
                    updatedBy: {
                        uid: profile?.uid,
                        name: profile?.displayName
                    }
                })
            });

            if (res.ok) {
                fetchStaff();
            }
        } catch (err) {
            console.error(`Failed to ${action} staff:`, err);
        }
    };

    const activeStaff = staff.filter(s => s.isActive);
    const inactiveStaff = staff.filter(s => !s.isActive);

    return (
        <div className="space-y-10 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight uppercase">{cleanJargon("management")}</h1>
                    <p className="text-[var(--text-tertiary)] text-sm mt-1 uppercase tracking-widest font-bold">Staff List & Permissions</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-black uppercase tracking-widest rounded-lg hover:opacity-90 transition-all shadow-xl"
                >
                    <UserPlus className="w-4 h-4" />
                    Add Member
                </button>
            </div>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* Left: Staff Ledger (8 Cols) */}
                <div className="lg:col-span-8 space-y-8">
                    <div className="glass-panel overflow-hidden">
                        <div className="px-6 py-4 bg-black/[0.02] border-b border-black/5 flex items-center justify-between">
                            <h2 className="text-[11px] font-black text-[var(--text-tertiary)] uppercase tracking-[0.2em]">Staff Registry</h2>
                            <span className="text-[10px] font-bold text-[var(--text-placeholder)] tabular-nums">{activeStaff.length} TOTAL</span>
                        </div>

                        {loading ? (
                            <div className="p-20 text-center">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-8 h-8 border-2 border-iris/20 border-t-iris rounded-full animate-spin" />
                                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Loading...</span>
                                </div>
                            </div>
                        ) : activeStaff.length === 0 ? (
                            <div className="p-20 text-center">
                                <Users className="w-12 h-12 text-black/10 mx-auto mb-4" />
                                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">Registry Empty</h3>
                                <p className="text-[var(--text-tertiary)] text-[11px] uppercase tracking-wider">No members found in the database.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-[#ffffff03]">
                                {activeStaff.map(member => (
                                    <StaffRow
                                        key={member.id}
                                        member={member}
                                        isSelected={selectedStaff?.id === member.id}
                                        onSelect={() => setSelectedStaff(member)}
                                        onVerify={() => handleAction(member.id, "verify")}
                                        onRemove={() => handleAction(member.id, "remove")}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Inactive Section */}
                    {inactiveStaff.length > 0 && (
                        <div className="glass-panel opacity-60">
                            <div className="px-6 py-3 bg-black/[0.01] border-b border-black/5">
                                <h2 className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.2em]">Inactive</h2>
                            </div>
                            <div className="divide-y divide-black/[0.03]">
                                {inactiveStaff.map(member => (
                                    <StaffRow key={member.id} member={member} inactive />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Inspection Panel (4 Cols) */}
                <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-28">
                    <div className="glass-panel p-6 space-y-8">
                        <div>
                            <h3 className="text-[10px] font-black text-[var(--text-tertiary)] uppercase tracking-[0.2em] mb-6">Staff Summary</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-black/[0.02] border border-black/5 rounded-lg">
                                    <p className="text-[20px] font-bold text-[var(--text-primary)] tabular-nums leading-none mb-1">{activeStaff.length}</p>
                                    <p className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest leading-none">Total Active</p>
                                </div>
                                <div className="p-4 bg-black/[0.02] border border-black/5 rounded-lg">
                                    <p className="text-[20px] font-bold text-emerald-500 tabular-nums leading-none mb-1">
                                        {activeStaff.filter(s => s.isVerified).length}
                                    </p>
                                    <p className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest leading-none">Verified</p>
                                </div>
                            </div>
                        </div>

                        {selectedStaff ? (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-black/5 border border-black/10 flex items-center justify-center text-lg font-bold text-[var(--text-primary)]">
                                        {selectedStaff.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-[var(--text-primary)]">{selectedStaff.name}</h4>
                                        <p className="text-[10px] font-bold text-iris uppercase tracking-widest mt-0.5">{ROLE_LABELS[selectedStaff.role] || selectedStaff.role}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-3 bg-black/[0.02] border border-black/5 rounded-lg flex items-center gap-3">
                                        <Mail className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                                        <span className="text-[11px] font-medium text-[var(--text-secondary)] truncate">{selectedStaff.email}</span>
                                    </div>
                                    {selectedStaff.phone && (
                                        <div className="p-3 bg-black/[0.02] border border-black/5 rounded-lg flex items-center gap-3">
                                            <Phone className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                                            <span className="text-[11px] font-medium text-[var(--text-secondary)]">{selectedStaff.phone}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 border-t border-black/5">
                                    <p className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.2em] mb-4">Permissions</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(selectedStaff.permissions || {}).map(([key, val]) => (
                                            <div key={key} className="flex items-center gap-2">
                                                <div className={`w-1 h-1 rounded-full ${val ? 'bg-emerald-500 shadow-[0_0_5px_#10B981]' : 'bg-black/10'}`} />
                                                <span className={`text-[9px] font-bold uppercase tracking-wider ${val ? 'text-[var(--text-secondary)]' : 'text-[var(--text-placeholder)]'}`}>
                                                    {key.split('_').join(' ')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={() => setSelectedStaff(null)}
                                    className="w-full py-2.5 text-[10px] font-bold text-[var(--text-placeholder)] hover:text-black uppercase tracking-[0.2em] transition-colors"
                                >
                                    Close Details
                                </button>
                            </div>
                        ) : (
                            <div className="py-12 text-center">
                                <Shield className="w-8 h-8 text-black/10 mx-auto mb-3" />
                                <p className="text-[var(--text-placeholder)] text-[10px] font-bold uppercase tracking-[0.2em]">Select a member to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Staff Modal */}
            {showAddModal && (
                <AddStaffModal
                    roleOptions={roleOptions}
                    onClose={() => setShowAddModal(false)}
                    onSubmit={handleAddStaff}
                />
            )}
        </div>
    );
}

function StaffRow({
    member,
    isSelected = false,
    onSelect,
    onVerify,
    onRemove,
    inactive = false
}: {
    member: StaffMember;
    isSelected?: boolean;
    onSelect?: () => void;
    onVerify?: () => void;
    onRemove?: () => void;
    inactive?: boolean;
}) {
    const [showActions, setShowActions] = useState(false);

    return (
        <div
            onClick={onSelect}
            className={`px-6 py-4 flex items-center justify-between cursor-pointer transition-colors ${isSelected ? "bg-black/[0.05]" : "hover:bg-black/[0.02]"} ${inactive ? "opacity-50" : ""}`}
        >
            <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-black/5 border border-black/10 flex items-center justify-center text-[var(--text-primary)] font-bold text-sm">
                    {member.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h4 className="text-[13px] font-bold text-[var(--text-primary)]">{member.name}</h4>
                        {member.isVerified ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Pending Verification" />
                        )}
                    </div>
                    <p className="text-[10px] font-medium text-[var(--text-tertiary)]">{member.email}</p>
                </div>
            </div>

            <div className="flex items-center gap-6">
                <span className={`px-3 py-1 rounded border text-[9px] font-black uppercase tracking-widest ${ROLE_COLORS[member.role] || ROLE_COLORS.viewer}`}>
                    {ROLE_LABELS[member.role] || member.role}
                </span>

                {!inactive && (
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
                            className="p-1.5 hover:bg-black/10 rounded-lg transition-colors"
                        >
                            <MoreHorizontal className="w-4 h-4 text-[var(--text-tertiary)]" />
                        </button>

                        {showActions && (
                            <div className="absolute right-0 top-full mt-2 bg-white border border-black/10 rounded-xl shadow-2xl py-1 z-50 min-w-[180px] animate-in fade-in slide-in-from-top-2">
                                {!member.isVerified && onVerify && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onVerify(); setShowActions(false); }}
                                        className="w-full px-4 py-2.5 text-left text-[11px] font-bold text-emerald-500 hover:bg-emerald-500/5 flex items-center gap-2 uppercase tracking-wider"
                                    >
                                        <ShieldCheck className="w-3.5 h-3.5" /> Verify User
                                    </button>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRemove && onRemove(); setShowActions(false); }}
                                    className="w-full px-4 py-2.5 text-left text-[11px] font-bold text-rose-500 hover:bg-rose-500/5 flex items-center gap-2 uppercase tracking-wider"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Remove User
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function AddStaffModal({
    roleOptions,
    onClose,
    onSubmit
}: {
    roleOptions: string[];
    onClose: () => void;
    onSubmit: (data: { email: string; name: string; role: string; phone?: string }) => void;
}) {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [role, setRole] = useState(roleOptions[0] || "viewer");
    const [phone, setPhone] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        await onSubmit({ email, name, role, phone });
        setSubmitting(false);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="glass-panel max-w-md w-full p-8 space-y-8 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)] uppercase tracking-tight">Add Member</h3>
                        <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest mt-1">Add a new staff member</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-lg text-[var(--text-tertiary)] hover:text-black transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-[var(--text-placeholder)] uppercase tracking-[0.2em] ml-1">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder:text-black/20 focus:outline-none focus:border-black/20 transition-all shadow-inner"
                            placeholder="OPERATOR NAME"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-[var(--text-placeholder)] uppercase tracking-[0.2em] ml-1">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder:text-black/20 focus:outline-none focus:border-black/20 transition-all shadow-inner"
                            placeholder="EMAIL ADDRESS"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[var(--text-placeholder)] uppercase tracking-[0.2em] ml-1">Role</label>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-black/20 transition-all shadow-inner appearance-none"
                            >
                                {roleOptions.map(r => (
                                    <option key={r} value={r} className="bg-white">{ROLE_LABELS[r] || r}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[var(--text-placeholder)] uppercase tracking-[0.2em] ml-1">Contact (PH)</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder:text-black/20 focus:outline-none focus:border-black/20 transition-all shadow-inner"
                                placeholder="+91"
                            />
                        </div>
                    </div>

                    <div className="bg-iris/5 border border-iris/10 rounded-xl p-4 flex gap-3">
                        <AlertCircle className="w-5 h-5 text-iris shrink-0" />
                        <p className="text-[10px] text-[var(--text-tertiary)] leading-relaxed font-medium">
                            A verification link will be sent to their email. They will be active after they verify their account.
                        </p>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 text-[var(--text-tertiary)] font-bold uppercase tracking-widest text-[11px] rounded-xl hover:text-black transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 py-3 bg-black text-white font-black uppercase tracking-widest text-[11px] rounded-xl hover:opacity-90 transition-all disabled:opacity-50 shadow-xl"
                        >
                            {submitting ? "CREATING..." : "CREATE MEMBER"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
