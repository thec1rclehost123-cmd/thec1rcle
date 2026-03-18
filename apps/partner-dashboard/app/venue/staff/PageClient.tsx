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
    AlertCircle,
    Loader2,
    PauseCircle,
    PlayCircle,
    Clock,
    ChevronDown,
} from "lucide-react";
import type { StaffProfile } from "@/lib/types/staffProfile";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { cleanJargon } from "@/lib/utils/jargon";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { BentoCard } from "@/components/ui/BentoCard";

interface StaffMember {
    id: string;
    email: string;
    name: string;
    role: string;
    phone?: string;
    status: "invited" | "pending_verification" | "active" | "suspended" | "removed";
    verified: boolean;
    userId?: string;
    invitedBy?: { uid: string; name: string };
    createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
    STAFF: "Employee",
    FINANCE_ADMIN: "Finance",
    manager: "Manager",
    supervisor: "Supervisor",
    security: "Security",
    scanner: "Scanner",
    door_staff: "Door Staff",
    owner: "Owner",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
    STAFF: "Can manage guest list, tables, and log incidents",
    FINANCE_ADMIN: "Can view financial data, reports, and payouts",
    manager: "Full operations access including staff management",
    security: "Entry scanning and guest list access",
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
    STAFF: { bg: "var(--v-info-bg)", text: "var(--v-info)" },
    FINANCE_ADMIN: { bg: "var(--v-success-bg)", text: "var(--v-success)" },
    manager: { bg: "var(--v-orange-dim)", text: "var(--v-orange)" },
    supervisor: { bg: "var(--v-info-bg)", text: "var(--v-info)" },
    security: { bg: "var(--v-warning-bg)", text: "var(--v-warning)" },
    scanner: { bg: "var(--v-elevated)", text: "var(--v-text-muted)" },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
    active: { label: "Active", bg: "var(--v-success-bg)", text: "var(--v-success)" },
    invited: { label: "Invited", bg: "var(--v-info-bg)", text: "var(--v-info)" },
    pending_verification: { label: "Pending", bg: "var(--v-warning-bg)", text: "var(--v-warning)" },
    suspended: { label: "Suspended", bg: "var(--v-error-bg)", text: "var(--v-error)" },
    removed: { label: "Removed", bg: "var(--v-elevated)", text: "var(--v-text-muted)" },
};

export default function VenueStaffPage() {
    const { profile, user } = useDashboardAuth();
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [profiles, setProfiles] = useState<StaffProfile[]>([]);
    const [assignedProfileId, setAssignedProfileId] = useState<string | null>(null);
    const [selectedProfileId, setSelectedProfileId] = useState<string>("");
    const [profileLoading, setProfileLoading] = useState(false);
    const [assigning, setAssigning] = useState(false);

    const venueId = profile?.activeMembership?.partnerId;

    useEffect(() => {
        if (venueId) {
            fetchStaff();
            fetchProfiles();
        }
    }, [venueId]);

    useEffect(() => {
        if (selectedStaff?.userId && venueId) {
            fetchAssignment(selectedStaff.userId);
        } else {
            setAssignedProfileId(null);
            setSelectedProfileId("");
        }
    }, [selectedStaff?.id]);

    const fetchStaff = async () => {
        try {
            const token = user ? await user.getIdToken() : null;
            const headers: HeadersInit = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;
            const res = await fetch(`/api/venue/staff?venueId=${venueId}&isActive=all`, { headers });
            if (!res.ok) { setLoading(false); return; }
            const data = await res.json();
            setStaff(data.staff || []);
        } catch (err) {
            console.error("Failed to fetch staff:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchProfiles = async () => {
        try {
            const token = user ? await user.getIdToken() : null;
            const headers: HeadersInit = {};
            if (token) headers["Authorization"] = `Bearer ${token}`;
            const res = await fetch(`/api/venue/staff-profiles?venueId=${venueId}`, { headers });
            if (!res.ok) return;
            const data = await res.json();
            setProfiles(data.profiles || []);
        } catch {}
    };

    const fetchAssignment = async (staffUserId: string) => {
        setProfileLoading(true);
        try {
            const token = user ? await user.getIdToken() : null;
            const headers: HeadersInit = {};
            if (token) headers["Authorization"] = `Bearer ${token}`;
            const res = await fetch(`/api/venue/staff-profiles/assign?venueId=${venueId}&staffUserId=${staffUserId}`, { headers });
            if (!res.ok) return;
            const data = await res.json();
            setAssignedProfileId(data.staffProfileId ?? null);
            setSelectedProfileId(data.staffProfileId ?? "");
        } catch {} finally {
            setProfileLoading(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedStaff?.userId || !selectedProfileId) return;
        setAssigning(true);
        try {
            const token = user ? await user.getIdToken() : null;
            const headers: HeadersInit = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;
            const res = await fetch(`/api/venue/staff-profiles/assign?venueId=${venueId}`, {
                method: "POST",
                headers,
                body: JSON.stringify({ staffUserId: selectedStaff.userId, profileId: selectedProfileId }),
            });
            if (res.ok) setAssignedProfileId(selectedProfileId);
        } catch {} finally {
            setAssigning(false);
        }
    };

    const handleRevokeProfile = async () => {
        if (!selectedStaff?.userId) return;
        setAssigning(true);
        try {
            const token = user ? await user.getIdToken() : null;
            const headers: HeadersInit = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;
            const res = await fetch(`/api/venue/staff-profiles/assign?venueId=${venueId}`, {
                method: "DELETE",
                headers,
                body: JSON.stringify({ staffUserId: selectedStaff.userId }),
            });
            if (res.ok) { setAssignedProfileId(null); setSelectedProfileId(""); }
        } catch {} finally {
            setAssigning(false);
        }
    };

    const handleAddStaff = async (formData: { email: string; name: string; role: string }) => {
        try {
            const token = user ? await user.getIdToken() : null;
            const res = await fetch("/api/venue/staff", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({
                    venueId,
                    ...formData,
                    addedBy: { uid: profile?.uid, name: profile?.displayName },
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
        setActionLoading(staffId + action);
        try {
            const token = user ? await user.getIdToken() : null;
            const res = await fetch("/api/venue/staff", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({
                    staffId,
                    action,
                    updatedBy: { uid: profile?.uid, name: profile?.displayName },
                }),
            });
            if (res.ok) {
                fetchStaff();
                if (selectedStaff?.id === staffId) setSelectedStaff(null);
            }
        } catch (err) {
            console.error(`Failed to ${action} staff:`, err);
        } finally {
            setActionLoading(null);
        }
    };

    const activeStaff = staff.filter(s => s.status === "active" || s.status === "pending_verification" || s.status === "invited");
    const inactiveStaff = staff.filter(s => s.status === "suspended" || s.status === "removed");
    // Verified = accepted invite & set password (pending_verification or fully active)
    const verifiedCount = staff.filter(s => s.status === "pending_verification" || s.status === "active").length;
    // Pending = invite sent but not yet accepted
    const pendingCount = staff.filter(s => s.status === "invited").length;
    const uniqueRoles = new Set(staff.filter(s => s.status !== "removed").map(s => s.role)).size;

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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "ACTIVE", value: loading ? "—" : staff.filter(s => s.status === "active").length, icon: Users, bg: "var(--v-success-bg)", text: "var(--v-success)" },
                    { label: "VERIFIED", value: loading ? "—" : verifiedCount, icon: ShieldCheck, bg: "var(--v-info-bg)", text: "var(--v-info)" },
                    { label: "PENDING", value: loading ? "—" : pendingCount, icon: Clock, bg: "var(--v-warning-bg)", text: "var(--v-warning)" },
                    { label: "ROLES", value: loading ? "—" : uniqueRoles, icon: Shield, bg: "var(--v-elevated)", text: "var(--v-text-muted)" },
                ].map((stat, i) => (
                    <div key={i} className="rounded-2xl p-3 flex items-center gap-3 border border-white/[0.04]" style={{ background: "var(--v-card)" }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: stat.bg }}>
                            <stat.icon className="w-3.5 h-3.5" style={{ color: stat.text }} />
                        </div>
                        <div>
                            <p className="v-label text-[9px] mb-0">{stat.label}</p>
                            <p className="text-[18px] font-black leading-tight tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                                {stat.value}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">

                {/* Staff ledger */}
                <div className="lg:col-span-8 space-y-3">
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
                                    {staff.filter(s => s.status === "active").length} ACTIVE
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
                                    actionLoading={actionLoading}
                                    onSelect={() => setSelectedStaff(prev => prev?.id === member.id ? null : member)}
                                    onVerify={() => handleAction(member.id, "verify")}
                                    onSuspend={() => handleAction(member.id, "suspend")}
                                    onRemove={() => handleAction(member.id, "remove")}
                                />
                            ))}
                        </div>
                    </BentoCard>

                    {inactiveStaff.length > 0 && (
                        <BentoCard
                            header={<span className="v-label">INACTIVE / SUSPENDED</span>}
                            padding="sm"
                            style={{ opacity: 0.7 }}
                        >
                            <div className="divide-y" style={{ borderColor: "var(--v-border)" }}>
                                {inactiveStaff.map(member => (
                                    <StaffRow
                                        key={member.id}
                                        member={member}
                                        actionLoading={actionLoading}
                                        onReactivate={member.status === "suspended" ? () => handleAction(member.id, "reactivate") : undefined}
                                    />
                                ))}
                            </div>
                        </BentoCard>
                    )}
                </div>

                {/* Detail panel */}
                <div className="lg:col-span-4 lg:sticky lg:top-28">
                    <BentoCard>
                        {selectedStaff ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-black"
                                        style={{ background: "var(--v-elevated)", color: "var(--v-text-primary)" }}
                                    >
                                        {selectedStaff.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="text-[13px] font-bold" style={{ color: "var(--v-text-primary)" }}>
                                            {selectedStaff.name}
                                        </h4>
                                        <span
                                            className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                                            style={{
                                                background: (ROLE_COLORS[selectedStaff.role] || ROLE_COLORS.scanner).bg,
                                                color: (ROLE_COLORS[selectedStaff.role] || ROLE_COLORS.scanner).text,
                                            }}
                                        >
                                            {ROLE_LABELS[selectedStaff.role] || selectedStaff.role}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-white/[0.03]" style={{ background: "var(--v-elevated)" }}>
                                        <Mail className="w-3 h-3 flex-shrink-0" style={{ color: "var(--v-text-muted)" }} />
                                        <span className="text-[11px] truncate" style={{ color: "var(--v-text-secondary)" }}>{selectedStaff.email}</span>
                                    </div>
                                </div>

                                <div>
                                    <p className="v-label text-[9px] mb-1.5">STATUS</p>
                                    <span
                                        className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                                        style={{
                                            background: (STATUS_CONFIG[selectedStaff.status] || STATUS_CONFIG.invited).bg,
                                            color: (STATUS_CONFIG[selectedStaff.status] || STATUS_CONFIG.invited).text,
                                        }}
                                    >
                                        {STATUS_CONFIG[selectedStaff.status]?.label || selectedStaff.status}
                                    </span>
                                </div>

                                {ROLE_DESCRIPTIONS[selectedStaff.role] && (
                                    <div className="p-3 rounded-xl" style={{ background: "var(--v-elevated)" }}>
                                        <p className="text-[10px]" style={{ color: "var(--v-text-secondary)" }}>
                                            {ROLE_DESCRIPTIONS[selectedStaff.role]}
                                        </p>
                                    </div>
                                )}

                                {/* Access Profile Assignment — only for staff who have accepted invite */}
                                {selectedStaff.userId && (
                                    <div className="space-y-2">
                                        <p className="v-label text-[9px]">ACCESS PROFILE</p>
                                        {profileLoading ? (
                                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "var(--v-elevated)" }}>
                                                <Loader2 className="w-3 h-3 animate-spin" style={{ color: "var(--v-text-muted)" }} />
                                                <span className="text-[11px]" style={{ color: "var(--v-text-muted)" }}>Loading…</span>
                                            </div>
                                        ) : (
                                            <>
                                                {assignedProfileId && (
                                                    <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: "var(--v-elevated)" }}>
                                                        <span className="text-[11px] font-semibold" style={{ color: "var(--v-text-primary)" }}>
                                                            {profiles.find(p => p.id === assignedProfileId)?.profileName ?? "Unknown profile"}
                                                        </span>
                                                        <button
                                                            onClick={handleRevokeProfile}
                                                            disabled={assigning}
                                                            className="text-[10px] font-bold hover:brightness-125 disabled:opacity-50"
                                                            style={{ color: "var(--v-error)" }}
                                                        >
                                                            {assigning ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Remove"}
                                                        </button>
                                                    </div>
                                                )}

                                                {profiles.length === 0 ? (
                                                    <p className="text-[10px] px-1" style={{ color: "var(--v-text-muted)" }}>
                                                        No profiles yet. Create one in <strong>Staff → Access Profiles</strong>.
                                                    </p>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <div className="relative flex-1">
                                                            <select
                                                                value={selectedProfileId}
                                                                onChange={e => setSelectedProfileId(e.target.value)}
                                                                className="w-full appearance-none pr-7 text-[12px] font-medium rounded-xl px-3 py-2"
                                                                style={{
                                                                    background: "var(--v-elevated)",
                                                                    color: selectedProfileId ? "var(--v-text-primary)" : "var(--v-text-muted)",
                                                                    border: "1px solid var(--v-border)",
                                                                    outline: "none",
                                                                }}
                                                            >
                                                                <option value="">
                                                                    {assignedProfileId ? "Change profile…" : "Select profile…"}
                                                                </option>
                                                                {profiles.map(p => (
                                                                    <option key={p.id} value={p.id}>{p.profileName}</option>
                                                                ))}
                                                            </select>
                                                            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--v-text-muted)" }} />
                                                        </div>
                                                        <button
                                                            onClick={handleAssign}
                                                            disabled={!selectedProfileId || selectedProfileId === assignedProfileId || assigning}
                                                            className="px-3 py-2 rounded-xl text-[12px] font-bold hover:brightness-110 disabled:opacity-40 transition-all flex items-center gap-1"
                                                            style={{ background: "var(--v-orange)", color: "#fff" }}
                                                        >
                                                            {assigning ? <Loader2 className="w-3 h-3 animate-spin" /> : "Assign"}
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}

                                <button
                                    onClick={() => setSelectedStaff(null)}
                                    className="w-full py-2 text-[11px] font-bold uppercase tracking-widest rounded-xl transition-colors"
                                    style={{ color: "var(--v-text-muted)", background: "var(--v-elevated)" }}
                                >
                                    Close Panel
                                </button>
                            </div>
                        ) : (
                            <div className="py-10 flex flex-col items-center text-center gap-2">
                                <Shield className="w-6 h-6" style={{ color: "var(--v-text-muted)" }} />
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
    actionLoading,
    onSelect,
    onVerify,
    onSuspend,
    onRemove,
    onReactivate,
}: {
    member: StaffMember;
    isSelected?: boolean;
    actionLoading?: string | null;
    onSelect?: () => void;
    onVerify?: () => void;
    onSuspend?: () => void;
    onRemove?: () => void;
    onReactivate?: () => void;
}) {
    const [showActions, setShowActions] = useState(false);
    const roleStyle = ROLE_COLORS[member.role] || ROLE_COLORS.scanner;
    const statusCfg = STATUS_CONFIG[member.status] || STATUS_CONFIG.invited;
    const isInactive = member.status === "suspended" || member.status === "removed";

    return (
        <div
            onClick={onSelect}
            className="px-4 py-2.5 flex items-center justify-between transition-colors"
            style={{
                cursor: isInactive ? "default" : "pointer",
                background: isSelected ? "var(--v-elevated)" : "transparent",
                opacity: isInactive ? 0.55 : 1,
            }}
        >
            <div className="flex items-center gap-3">
                <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                    style={{ background: "var(--v-elevated)", color: "var(--v-text-primary)" }}
                >
                    {member.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h4 className="text-[12px] font-semibold" style={{ color: "var(--v-text-primary)" }}>
                            {member.name}
                        </h4>
                        {member.status === "active" && member.verified
                            ? <ShieldCheck className="w-3 h-3" style={{ color: "var(--v-success)" }} />
                            : member.status === "pending_verification"
                            ? <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--v-warning)" }} />
                            : null
                        }
                    </div>
                    <p className="text-[10px]" style={{ color: "var(--v-text-muted)" }}>{member.email}</p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {/* Status badge */}
                <span
                    className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full hidden md:inline-flex"
                    style={{ background: statusCfg.bg, color: statusCfg.text }}
                >
                    {statusCfg.label}
                </span>

                {/* Role badge */}
                <span
                    className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full hidden sm:inline-flex"
                    style={{ background: roleStyle.bg, color: roleStyle.text }}
                >
                    {ROLE_LABELS[member.role] || member.role}
                </span>

                {/* Action menu for active/pending */}
                {!isInactive && onSelect && (
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
                                className="absolute right-0 top-full mt-1 rounded-xl shadow-2xl py-1 z-50 min-w-[160px] animate-in fade-in slide-in-from-top-2"
                                style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)" }}
                            >
                                {member.status === "pending_verification" && onVerify && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onVerify(); setShowActions(false); }}
                                        className="w-full px-3 py-2 text-left text-[12px] flex items-center gap-2 hover:brightness-125"
                                        style={{ color: "var(--v-success)" }}
                                    >
                                        <ShieldCheck className="w-3.5 h-3.5" /> Verify User
                                    </button>
                                )}
                                {member.status === "active" && onSuspend && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onSuspend(); setShowActions(false); }}
                                        className="w-full px-3 py-2 text-left text-[12px] flex items-center gap-2 hover:brightness-125"
                                        style={{ color: "var(--v-warning)" }}
                                    >
                                        <PauseCircle className="w-3.5 h-3.5" /> Suspend
                                    </button>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRemove?.(); setShowActions(false); }}
                                    className="w-full px-3 py-2 text-left text-[12px] flex items-center gap-2 hover:brightness-125"
                                    style={{ color: "var(--v-error)" }}
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Remove User
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Reactivate for suspended */}
                {member.status === "suspended" && onReactivate && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onReactivate(); }}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: "var(--v-success)" }}
                        title="Reactivate"
                    >
                        <PlayCircle className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
}

function AddStaffModal({
    onClose,
    onSubmit,
}: {
    onClose: () => void;
    onSubmit: (data: { email: string; name: string; role: string }) => void;
}) {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [role, setRole] = useState("STAFF");
    const [submitting, setSubmitting] = useState(false);

    const inputStyle: React.CSSProperties = {
        background: "var(--v-elevated)",
        color: "var(--v-text-primary)",
        border: "1px solid var(--v-border)",
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        outline: "none",
        width: "100%",
    };

    const INVITE_ROLES = [
        { value: "STAFF", label: "Employee", desc: "Can manage guest list, tables, and log incidents" },
        { value: "FINANCE_ADMIN", label: "Finance", desc: "Can view financial data, reports, and payouts" },
        { value: "manager", label: "Manager", desc: "Full operations access" },
        { value: "security", label: "Security", desc: "Entry scanning and guest list access" },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        await onSubmit({ email, name, role });
        setSubmitting(false);
    };

    const selectedRole = INVITE_ROLES.find(r => r.value === role);

    return (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-[100] p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
            <div
                className="max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-200 rounded-[28px]"
                style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-[16px] font-bold" style={{ color: "var(--v-text-primary)" }}>Add Staff Member</h3>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--v-text-tertiary)" }}>An invite link will be sent to their email</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:brightness-125" style={{ color: "var(--v-text-muted)", background: "var(--v-elevated)" }}>
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="v-label mb-1 block">FULL NAME</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required style={inputStyle} placeholder="Staff member name" />
                    </div>
                    <div>
                        <label className="v-label mb-1 block">EMAIL ADDRESS</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} placeholder="email@example.com" />
                    </div>
                    <div>
                        <label className="v-label mb-1 block">ROLE</label>
                        <select
                            value={role}
                            onChange={e => setRole(e.target.value)}
                            style={{ ...inputStyle, paddingRight: 40, cursor: "pointer" }}
                        >
                            {INVITE_ROLES.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                        {selectedRole && (
                            <p className="text-[10px] mt-1.5 px-1" style={{ color: "var(--v-text-muted)" }}>{selectedRole.desc}</p>
                        )}
                    </div>

                    <div className="flex items-start gap-2.5 p-3 rounded-xl" style={{ background: "var(--v-info-bg)", border: "1px solid rgba(129,140,248,0.2)" }}>
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--v-info)" }} />
                        <p className="text-[11px] leading-relaxed" style={{ color: "var(--v-text-secondary)" }}>
                            An invite link will be emailed to them. They'll set their own password and activate their account.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-[13px] font-semibold" style={{ background: "var(--v-elevated)", color: "var(--v-text-secondary)" }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={submitting} className="flex-1 py-2 rounded-xl text-[13px] font-semibold hover:brightness-110 flex items-center justify-center gap-2" style={{ background: "var(--v-orange)", color: "#fff" }}>
                            {submitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</> : "Send Invite"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
