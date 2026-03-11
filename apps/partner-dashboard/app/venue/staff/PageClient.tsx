"use client";

import { useState, useEffect } from "react";
import {
    Users,
    UserPlus,
    Shield,
    ShieldCheck,
    Trash2,
    X,
    MoreHorizontal,
    Mail,
    Phone,
    AlertCircle,
    Loader2,
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { cleanJargon } from "@/lib/utils/jargon";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { BentoCard, KPIBento } from "@/components/ui/BentoCard";

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
    manager:       "Manager",
    floor_manager: "Floor Manager",
    security:      "Security",
    ops:           "Operations",
    finance:       "Finance",
    viewer:        "Viewer",
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
    manager:       { bg: "var(--v-orange-dim)",  text: "var(--v-orange)"   },
    floor_manager: { bg: "var(--v-info-bg)",      text: "var(--v-info)"    },
    security:      { bg: "var(--v-warning-bg)",   text: "var(--v-warning)" },
    ops:           { bg: "var(--v-success-bg)",   text: "var(--v-success)" },
    finance:       { bg: "var(--v-error-bg)",     text: "var(--v-error)"   },
    viewer:        { bg: "var(--v-elevated)",     text: "var(--v-text-muted)" },
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
        if (venueId) fetchStaff();
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
                    addedBy: { uid: profile?.uid, name: profile?.displayName, email: profile?.email },
                }),
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
                    updatedBy: { uid: profile?.uid, name: profile?.displayName },
                }),
            });
            if (res.ok) fetchStaff();
        } catch (err) {
            console.error(`Failed to ${action} staff:`, err);
        }
    };

    const activeStaff   = staff.filter(s => s.isActive);
    const inactiveStaff = staff.filter(s => !s.isActive);
    const verifiedCount = activeStaff.filter(s => s.isVerified).length;

    return (
        <VenuePageShell
            title={cleanJargon("management")}
            subtitle="Staff registry and access control"
            actions={
                <VenueActionButton variant="primary" onClick={() => setShowAddModal(true)}>
                    <UserPlus className="w-4 h-4" /> Add Member
                </VenueActionButton>
            }
        >
            {/* KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <KPIBento
                    label="TOTAL ACTIVE"
                    value={loading ? "—" : activeStaff.length}
                    icon={<Users className="w-5 h-5" />}
                    iconBg="var(--v-success-bg)"
                />
                <KPIBento
                    label="VERIFIED"
                    value={loading ? "—" : verifiedCount}
                    icon={<ShieldCheck className="w-5 h-5" />}
                    iconBg="var(--v-info-bg)"
                />
                <KPIBento
                    label="PENDING"
                    value={loading ? "—" : activeStaff.length - verifiedCount}
                    icon={<Shield className="w-5 h-5" />}
                    iconBg="var(--v-warning-bg)"
                />
                <KPIBento
                    label="ROLES"
                    value={loading ? "—" : new Set(activeStaff.map(s => s.role)).size}
                    icon={<Users className="w-5 h-5" />}
                    iconBg="var(--v-elevated)"
                />
            </div>

            {/* Main layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* Staff ledger */}
                <div className="lg:col-span-8 space-y-4">
                    <BentoCard
                        loading={loading}
                        empty={!loading && activeStaff.length === 0}
                        emptyIcon={<Users className="w-8 h-8" />}
                        emptyTitle="Registry empty. Add your first staff member."
                        emptyAction={
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="text-[12px] font-semibold px-4 py-2 rounded-xl mt-2"
                                style={{ background: "var(--v-orange)", color: "#fff" }}
                            >
                                Add Member
                            </button>
                        }
                        header={
                            <>
                                <span className="v-label">STAFF REGISTRY</span>
                                <span className="text-[11px] font-bold tabular-nums" style={{ color: "var(--v-text-muted)" }}>
                                    {activeStaff.length} ACTIVE
                                </span>
                            </>
                        }
                        padding="sm"
                    >
                        <div className="divide-y" style={{ borderColor: "var(--v-border)" }}>
                            {activeStaff.map(member => (
                                <StaffRow
                                    key={member.id}
                                    member={member}
                                    isSelected={selectedStaff?.id === member.id}
                                    onSelect={() => setSelectedStaff(prev => prev?.id === member.id ? null : member)}
                                    onVerify={() => handleAction(member.id, "verify")}
                                    onRemove={() => handleAction(member.id, "remove")}
                                />
                            ))}
                        </div>
                    </BentoCard>

                    {inactiveStaff.length > 0 && (
                        <BentoCard
                            header={<span className="v-label">INACTIVE</span>}
                            padding="sm"
                            style={{ opacity: 0.6 }}
                        >
                            <div className="divide-y" style={{ borderColor: "var(--v-border)" }}>
                                {inactiveStaff.map(member => (
                                    <StaffRow key={member.id} member={member} inactive />
                                ))}
                            </div>
                        </BentoCard>
                    )}
                </div>

                {/* Detail panel */}
                <div className="lg:col-span-4 lg:sticky lg:top-28">
                    <BentoCard>
                        {selectedStaff ? (
                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div
                                        className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold"
                                        style={{ background: "var(--v-elevated)", color: "var(--v-text-primary)" }}
                                    >
                                        {selectedStaff.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="text-[16px] font-semibold" style={{ color: "var(--v-text-primary)" }}>
                                            {selectedStaff.name}
                                        </h4>
                                        <span
                                            className="text-[11px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                                            style={{
                                                background: (ROLE_COLORS[selectedStaff.role] || ROLE_COLORS.viewer).bg,
                                                color: (ROLE_COLORS[selectedStaff.role] || ROLE_COLORS.viewer).text,
                                            }}
                                        >
                                            {ROLE_LABELS[selectedStaff.role] || selectedStaff.role}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "var(--v-elevated)" }}>
                                        <Mail className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--v-text-muted)" }} />
                                        <span className="text-[12px] truncate" style={{ color: "var(--v-text-secondary)" }}>{selectedStaff.email}</span>
                                    </div>
                                    {selectedStaff.phone && (
                                        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "var(--v-elevated)" }}>
                                            <Phone className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--v-text-muted)" }} />
                                            <span className="text-[12px]" style={{ color: "var(--v-text-secondary)" }}>{selectedStaff.phone}</span>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <p className="v-label mb-3">PERMISSIONS</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(selectedStaff.permissions || {}).map(([key, val]) => (
                                            <div key={key} className="flex items-center gap-2">
                                                <div
                                                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                    style={{ background: val ? "var(--v-success)" : "var(--v-elevated)" }}
                                                />
                                                <span
                                                    className="text-[11px]"
                                                    style={{ color: val ? "var(--v-text-secondary)" : "var(--v-text-muted)" }}
                                                >
                                                    {key.split("_").join(" ")}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={() => setSelectedStaff(null)}
                                    className="w-full py-2 text-[12px] font-medium rounded-xl transition-colors"
                                    style={{ color: "var(--v-text-muted)", background: "var(--v-elevated)" }}
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <div className="py-16 flex flex-col items-center text-center gap-3">
                                <Shield className="w-8 h-8" style={{ color: "var(--v-text-muted)" }} />
                                <p className="text-[12px]" style={{ color: "var(--v-text-muted)" }}>
                                    Select a member to view details
                                </p>
                            </div>
                        )}
                    </BentoCard>
                </div>
            </div>

            {showAddModal && (
                <AddStaffModal
                    roleOptions={roleOptions}
                    onClose={() => setShowAddModal(false)}
                    onSubmit={handleAddStaff}
                />
            )}
        </VenuePageShell>
    );
}

function StaffRow({
    member,
    isSelected = false,
    onSelect,
    onVerify,
    onRemove,
    inactive = false,
}: {
    member: StaffMember;
    isSelected?: boolean;
    onSelect?: () => void;
    onVerify?: () => void;
    onRemove?: () => void;
    inactive?: boolean;
}) {
    const [showActions, setShowActions] = useState(false);
    const roleStyle = ROLE_COLORS[member.role] || ROLE_COLORS.viewer;

    return (
        <div
            onClick={onSelect}
            className="px-5 py-4 flex items-center justify-between transition-colors"
            style={{
                cursor: inactive ? "default" : "pointer",
                background: isSelected ? "var(--v-elevated)" : "transparent",
                opacity: inactive ? 0.5 : 1,
            }}
        >
            <div className="flex items-center gap-3">
                <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center text-[12px] font-bold flex-shrink-0"
                    style={{ background: "var(--v-elevated)", color: "var(--v-text-primary)" }}
                >
                    {member.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h4 className="text-[13px] font-semibold" style={{ color: "var(--v-text-primary)" }}>
                            {member.name}
                        </h4>
                        {member.isVerified
                            ? <ShieldCheck className="w-3 h-3" style={{ color: "var(--v-success)" }} />
                            : <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--v-warning)" }} />
                        }
                    </div>
                    <p className="text-[11px]" style={{ color: "var(--v-text-muted)" }}>{member.email}</p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <span
                    className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                    style={{ background: roleStyle.bg, color: roleStyle.text }}
                >
                    {ROLE_LABELS[member.role] || member.role}
                </span>

                {!inactive && (
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: "var(--v-text-muted)" }}
                            aria-label="Staff actions"
                        >
                            <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {showActions && (
                            <div
                                className="absolute right-0 top-full mt-2 rounded-2xl shadow-2xl py-1.5 z-50 min-w-[180px] animate-in fade-in slide-in-from-top-2"
                                style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)" }}
                            >
                                {!member.isVerified && onVerify && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onVerify(); setShowActions(false); }}
                                        className="w-full px-4 py-2.5 text-left text-[12px] flex items-center gap-2 transition-colors hover:brightness-125"
                                        style={{ color: "var(--v-success)" }}
                                    >
                                        <ShieldCheck className="w-3.5 h-3.5" /> Verify User
                                    </button>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRemove?.(); setShowActions(false); }}
                                    className="w-full px-4 py-2.5 text-left text-[12px] flex items-center gap-2 transition-colors hover:brightness-125"
                                    style={{ color: "var(--v-error)" }}
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
    onSubmit,
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

    const inputStyle = {
        background: "var(--v-elevated)",
        color: "var(--v-text-primary)",
        border: "1px solid var(--v-border)",
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        outline: "none",
        width: "100%",
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        await onSubmit({ email, name, role, phone });
        setSubmitting(false);
    };

    return (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-[100] p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
            <div
                className="max-w-md w-full p-8 space-y-6 animate-in zoom-in-95 duration-200 rounded-[32px]"
                style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-[18px] font-bold" style={{ color: "var(--v-text-primary)" }}>Add Member</h3>
                        <p className="text-[12px] mt-0.5" style={{ color: "var(--v-text-tertiary)" }}>Add a new staff member to your venue</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl transition-colors hover:brightness-125" style={{ color: "var(--v-text-muted)", background: "var(--v-elevated)" }}>
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="v-label mb-1.5 block">NAME</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required style={inputStyle} placeholder="Operator name" />
                    </div>
                    <div>
                        <label className="v-label mb-1.5 block">EMAIL ADDRESS</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} placeholder="email@example.com" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="v-label mb-1.5 block">ROLE</label>
                            <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                                {roleOptions.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="v-label mb-1.5 block">PHONE (PH)</label>
                            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="+91" />
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 rounded-2xl" style={{ background: "var(--v-info-bg)", border: "1px solid rgba(129,140,248,0.2)" }}>
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--v-info)" }} />
                        <p className="text-[12px]" style={{ color: "var(--v-text-secondary)" }}>
                            A verification link will be sent to their email. They will be active after they verify their account.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-colors" style={{ background: "var(--v-elevated)", color: "var(--v-text-secondary)" }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:brightness-110 flex items-center justify-center gap-2" style={{ background: "var(--v-orange)", color: "#fff" }}>
                            {submitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating...</> : "Create Member"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
