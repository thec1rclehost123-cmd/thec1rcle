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
    manager: "text-[var(--c1rcle-orange)] bg-[var(--c1rcle-orange-glow)] border-[var(--c1rcle-orange)]/20",
    floor_manager: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    security: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    ops: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    finance: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    viewer: "text-[var(--text-secondary)] bg-[var(--surface-tertiary)] border-[var(--border-subtle)]"
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
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[var(--border-subtle)]">
                <div>
                    <h1 className="text-display-sm text-[var(--text-primary)]">{cleanJargon("management")}</h1>
                    <p className="text-label text-[var(--text-tertiary)] mt-1">Staff List & Permissions</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="btn btn-primary"
                >
                    <UserPlus className="w-4 h-4" />
                    Add Member
                </button>
            </div>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* Left: Staff Ledger (8 Cols) */}
                <div className="lg:col-span-8 space-y-8">
                    <div className="card overflow-hidden">
                        <div className="px-6 py-4 bg-[var(--surface-secondary)] border-b border-[var(--border-subtle)] flex items-center justify-between">
                            <h2 className="text-label text-[var(--text-tertiary)]">Staff Registry</h2>
                            <span className="text-caption text-[var(--text-placeholder)] tabular-nums">{activeStaff.length} TOTAL</span>
                        </div>

                        {loading ? (
                            <div className="p-20 text-center">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-8 h-8 border-2 border-[var(--c1rcle-orange)]/20 border-t-[var(--c1rcle-orange)] rounded-full animate-spin" />
                                    <span className="text-label text-[var(--text-placeholder)]">Loading...</span>
                                </div>
                            </div>
                        ) : activeStaff.length === 0 ? (
                            <div className="p-20 text-center">
                                <Users className="w-12 h-12 text-[var(--text-placeholder)] mx-auto mb-4" />
                                <h3 className="text-title text-[var(--text-primary)] mb-1">Registry Empty</h3>
                                <p className="text-label text-[var(--text-tertiary)]">No members found in the database.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-[var(--border-subtle)]">
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
                        <div className="card opacity-60">
                            <div className="px-6 py-3 bg-[var(--surface-secondary)] border-b border-[var(--border-subtle)]">
                                <h2 className="text-label text-[var(--text-tertiary)]">Inactive</h2>
                            </div>
                            <div className="divide-y divide-[var(--border-subtle)]">
                                {inactiveStaff.map(member => (
                                    <StaffRow key={member.id} member={member} inactive />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Inspection Panel (4 Cols) */}
                <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-28">
                    <div className="card p-6 space-y-8">
                        <div>
                            <h3 className="text-label text-[var(--text-tertiary)] mb-6">Staff Summary</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl">
                                    <p className="text-stat-sm text-[var(--text-primary)] mb-1">{activeStaff.length}</p>
                                    <p className="text-caption text-[var(--text-tertiary)]">Total Active</p>
                                </div>
                                <div className="p-4 bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl">
                                    <p className="text-stat-sm text-[var(--state-success)] mb-1">
                                        {activeStaff.filter(s => s.isVerified).length}
                                    </p>
                                    <p className="text-caption text-[var(--text-tertiary)]">Verified</p>
                                </div>
                            </div>
                        </div>

                        {selectedStaff ? (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-[var(--surface-tertiary)] border border-[var(--border-subtle)] flex items-center justify-center text-lg font-bold text-[var(--text-primary)]">
                                        {selectedStaff.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="text-title-sm text-[var(--text-primary)]">{selectedStaff.name}</h4>
                                        <p className="text-label text-[var(--c1rcle-orange)] mt-0.5">{ROLE_LABELS[selectedStaff.role] || selectedStaff.role}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-3 bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl flex items-center gap-3">
                                        <Mail className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                                        <span className="text-body-sm text-[var(--text-secondary)] truncate">{selectedStaff.email}</span>
                                    </div>
                                    {selectedStaff.phone && (
                                        <div className="p-3 bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl flex items-center gap-3">
                                            <Phone className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                                            <span className="text-body-sm text-[var(--text-secondary)]">{selectedStaff.phone}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 border-t border-[var(--border-subtle)]">
                                    <p className="text-label text-[var(--text-tertiary)] mb-4">Permissions</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(selectedStaff.permissions || {}).map(([key, val]) => (
                                            <div key={key} className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${val ? 'bg-[var(--state-success)] shadow-[0_0_5px_var(--state-success)]' : 'bg-[var(--surface-tertiary)]'}`} />
                                                <span className={`text-caption ${val ? 'text-[var(--text-secondary)]' : 'text-[var(--text-placeholder)]'}`}>
                                                    {key.split('_').join(' ')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={() => setSelectedStaff(null)}
                                    className="w-full py-2.5 text-label text-[var(--text-placeholder)] hover:text-[var(--text-primary)] transition-colors"
                                >
                                    Close Details
                                </button>
                            </div>
                        ) : (
                            <div className="py-12 text-center">
                                <Shield className="w-8 h-8 text-[var(--text-placeholder)] mx-auto mb-3" />
                                <p className="text-label text-[var(--text-placeholder)]">Select a member to view details</p>
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
            className={`px-6 py-4 flex items-center justify-between cursor-pointer transition-colors ${isSelected ? "bg-[var(--surface-secondary)]" : "hover:bg-[var(--surface-secondary)]/50"} ${inactive ? "opacity-50" : ""}`}
        >
            <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-[var(--surface-tertiary)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] font-bold text-sm">
                    {member.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h4 className="text-body-sm font-semibold text-[var(--text-primary)]">{member.name}</h4>
                        {member.isVerified ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-[var(--state-success)]" />
                        ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--state-warning)] animate-pulse" title="Pending Verification" />
                        )}
                    </div>
                    <p className="text-caption text-[var(--text-tertiary)]">{member.email}</p>
                </div>
            </div>

            <div className="flex items-center gap-6">
                <span className={`px-3 py-1 rounded-lg border text-caption font-semibold ${ROLE_COLORS[member.role] || ROLE_COLORS.viewer}`}>
                    {ROLE_LABELS[member.role] || member.role}
                </span>

                {!inactive && (
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
                            className="p-1.5 hover:bg-[var(--surface-tertiary)] rounded-lg transition-colors"
                        >
                            <MoreHorizontal className="w-4 h-4 text-[var(--text-tertiary)]" />
                        </button>

                        {showActions && (
                            <div className="absolute right-0 top-full mt-2 bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-2xl py-1 z-50 min-w-[180px] animate-in fade-in slide-in-from-top-2">
                                {!member.isVerified && onVerify && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onVerify(); setShowActions(false); }}
                                        className="w-full px-4 py-2.5 text-left text-body-sm text-[var(--state-success)] hover:bg-[var(--state-success-bg)] flex items-center gap-2"
                                    >
                                        <ShieldCheck className="w-3.5 h-3.5" /> Verify User
                                    </button>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRemove && onRemove(); setShowActions(false); }}
                                    className="w-full px-4 py-2.5 text-left text-body-sm text-[var(--state-error)] hover:bg-[var(--state-error-bg)] flex items-center gap-2"
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
            <div className="card max-w-md w-full p-8 space-y-8 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-headline-sm text-[var(--text-primary)]">Add Member</h3>
                        <p className="text-label text-[var(--text-tertiary)] mt-1">Add a new staff member</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--surface-tertiary)] rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-1.5">
                        <label className="input-label">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="input"
                            placeholder="Operator name"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="input-label">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="input"
                            placeholder="email@example.com"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="input-label">Role</label>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="input"
                            >
                                {roleOptions.map(r => (
                                    <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="input-label">Contact (PH)</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="input"
                                placeholder="+91"
                            />
                        </div>
                    </div>

                    <div className="bg-[var(--state-info-bg)] border border-[var(--state-info)]/20 rounded-xl p-4 flex gap-3">
                        <AlertCircle className="w-5 h-5 text-[var(--state-info)] shrink-0" />
                        <p className="text-body-sm text-[var(--text-tertiary)]">
                            A verification link will be sent to their email. They will be active after they verify their account.
                        </p>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-secondary flex-1"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="btn btn-primary flex-1"
                        >
                            {submitting ? "Creating..." : "Create Member"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
