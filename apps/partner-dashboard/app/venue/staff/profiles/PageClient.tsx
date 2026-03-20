"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus, Shield, Trash2, ChevronDown, Loader2, Save,
    LayoutDashboard, BarChart3, Calendar, Banknote, ClipboardList,
    Users, FileText, Building2, Settings, X, Eye, EyeOff,
} from "lucide-react";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import Toggle from "@/components/ui/Toggle";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import Link from "next/link";
import type {
    StaffProfile, VenueTab, StaffAction, PIIPolicy, GuestlistScope,
} from "@/lib/types/staffProfile";
import { DEFAULT_PII_POLICY } from "@/lib/types/staffProfile";

// ── Tab definitions ─────────────────────────────────────────────────────────
const TAB_META: { key: VenueTab; label: string; icon: React.ElementType }[] = [
    { key: "overview",        label: "Overview",     icon: LayoutDashboard },
    { key: "analytics",       label: "Analytics",    icon: BarChart3 },
    { key: "events",          label: "Events",       icon: Calendar },
    { key: "finance",         label: "Finance",      icon: Banknote },
    { key: "calendar",        label: "Calendar",     icon: Calendar },
    { key: "walk_ins",        label: "Walk-ins",     icon: ClipboardList },
    { key: "guest_ops",       label: "Guest Ops",    icon: Users },
    { key: "partnerships",    label: "Partnerships", icon: Users },
    { key: "staff",           label: "Staff",        icon: Shield },
    { key: "registers",       label: "Registers",    icon: FileText },
    { key: "page_management", label: "Venue Page",   icon: Building2 },
    { key: "settings",        label: "Settings",     icon: Settings },
];

// ── Action groups ────────────────────────────────────────────────────────────
const ACTION_GROUPS: { group: string; actions: { key: StaffAction; label: string }[] }[] = [
    {
        group: "Events",
        actions: [
            { key: "events:create",           label: "Create events" },
            { key: "events:edit",             label: "Edit events" },
            { key: "events:cancel",           label: "Cancel events" },
            { key: "events:duplicate",        label: "Duplicate events" },
            { key: "events:approve_requests", label: "Approve host requests" },
        ],
    },
    {
        group: "Guestlist",
        actions: [
            { key: "guestlist:read",      label: "View guestlist" },
            { key: "guestlist:add_guest", label: "Add guests" },
            { key: "guestlist:check_in",  label: "Check in guests" },
            { key: "guestlist:deny",      label: "Deny guests" },
            { key: "guestlist:flag",      label: "Flag guests" },
            { key: "guestlist:export",    label: "Export guestlist" },
            { key: "guestlist:print",     label: "Print guestlist" },
        ],
    },
    {
        group: "Walk-ins",
        actions: [
            { key: "walkins:read",   label: "View walk-in logs" },
            { key: "walkins:create", label: "Add walk-in entries" },
            { key: "walkins:edit",   label: "Edit entries" },
            { key: "walkins:delete", label: "Void entries" },
            { key: "walkins:print",  label: "Print register" },
            { key: "walkins:export", label: "Export register" },
        ],
    },
    {
        group: "Calendar",
        actions: [
            { key: "calendar:read",                 label: "View calendar" },
            { key: "calendar:block_slot",           label: "Block slots" },
            { key: "calendar:unblock_slot",         label: "Unblock slots" },
            { key: "calendar:approve_host_request", label: "Approve host slot requests" },
        ],
    },
    {
        group: "Finance",
        actions: [
            { key: "finance:read_overview",        label: "View finance overview" },
            { key: "finance:read_ledger",          label: "View ledger" },
            { key: "finance:read_payouts",         label: "View venue payouts" },
            { key: "finance:initiate_payout",      label: "Initiate payouts" },
            { key: "finance:read_host_payouts",    label: "View host payouts" },
            { key: "finance:read_promoter_payouts",label: "View promoter payouts" },
        ],
    },
    {
        group: "Staff & Settings",
        actions: [
            { key: "staff:read",         label: "View staff" },
            { key: "staff:invite",       label: "Invite staff" },
            { key: "staff:edit_profiles",label: "Edit access profiles" },
            { key: "staff:revoke",       label: "Revoke staff access" },
            { key: "analytics:read",     label: "View analytics" },
            { key: "settings:read",      label: "View settings" },
            { key: "settings:edit",      label: "Edit settings" },
        ],
    },
];

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
    OWNER:         { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
    MANAGER:       { bg: "rgba(59,130,246,0.15)",  text: "#60a5fa" },
    FINANCE_ADMIN: { bg: "rgba(16,185,129,0.15)",  text: "#34d399" },
    STAFF:         { bg: "rgba(113,113,122,0.2)",   text: "#a1a1aa" },
    SECURITY:      { bg: "rgba(239,68,68,0.15)",    text: "#f87171" },
};

const ROLE_LABELS: Record<string, string> = {
    STAFF: "Employee", FINANCE_ADMIN: "Finance",
    manager: "Manager", security: "Security",
    SECURITY: "Security", MANAGER: "Manager",
};

interface StaffMember {
    id: string; name: string; email: string;
    role: string; status: string; userId?: string;
}

function initials(name: string) {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <p className="v-label text-[9px]">{title}</p>
            {children}
        </div>
    );
}

// ── Main component ───────────────────────────────────────────────────────────
export function StaffProfilesClient() {
    const { profile: dashProfile, user } = useDashboardAuth();
    const venueId = dashProfile?.activeMembership?.partnerId;

    const [profiles, setProfiles] = useState<StaffProfile[]>([]);
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [assignmentMap, setAssignmentMap] = useState<Record<string, string | null>>({});
    const [loading, setLoading] = useState(true);

    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
    const [assigning, setAssigning] = useState(false);
    const [assignTarget, setAssignTarget] = useState<string>("");
    const [deleting, setDeleting] = useState(false);

    // Inline edit state
    const [editTabs, setEditTabs] = useState<Partial<Record<VenueTab, boolean>>>({});
    const [editActions, setEditActions] = useState<Partial<Record<StaffAction, boolean>>>({});
    const [editPii, setEditPii] = useState<PIIPolicy>(DEFAULT_PII_POLICY);
    const [editScope, setEditScope] = useState<GuestlistScope>("read_only");
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    const authHeaders = async (): Promise<HeadersInit> => {
        const token = user ? await user.getIdToken() : null;
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    // ── Load all data ────────────────────────────────────────────────────────
    const loadAll = async () => {
        if (!venueId) return;
        setLoading(true);
        try {
            const h = await authHeaders();
            const [pRes, sRes, aRes] = await Promise.all([
                fetch(`/api/venue/staff-profiles?venueId=${venueId}`, { headers: h }),
                fetch(`/api/venue/staff?venueId=${venueId}&isActive=all`, { headers: h }),
                fetch(`/api/venue/staff-profiles/assignments?venueId=${venueId}`, { headers: h }),
            ]);
            if (pRes.ok) setProfiles((await pRes.json()).profiles ?? []);
            if (sRes.ok) setStaff((await sRes.json()).staff ?? []);
            if (aRes.ok) {
                const { assignments } = await aRes.json();
                const map: Record<string, string | null> = {};
                (assignments as { uid: string; staffProfileId: string | null }[])
                    .forEach(a => { map[a.uid] = a.staffProfileId; });
                setAssignmentMap(map);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadAll(); }, [venueId]);

    // Seed edit state when profile selection changes
    const selectedProfile = profiles.find(p => p.id === selectedProfileId) ?? null;

    useEffect(() => {
        if (selectedProfile) {
            setEditTabs({ ...selectedProfile.tabVisibility });
            setEditActions({ ...selectedProfile.actionPermissions });
            setEditPii({ ...selectedProfile.piiPolicy });
            setEditScope(selectedProfile.guestlistScope);
            setSaveError(null);
            setSaved(false);
        }
    }, [selectedProfileId]);

    // ── Derived ──────────────────────────────────────────────────────────────
    const acceptedStaff = useMemo(
        () => staff.filter(s => s.userId && s.status !== "removed" && s.status !== "suspended"),
        [staff]
    );

    const profileStaff = useMemo(
        () => acceptedStaff.filter(s => s.userId && assignmentMap[s.userId] === selectedProfileId),
        [acceptedStaff, assignmentMap, selectedProfileId]
    );

    const unassignedStaff = useMemo(
        () => acceptedStaff.filter(s => s.userId && !assignmentMap[s.userId]),
        [acceptedStaff, assignmentMap]
    );

    const profileStaffCount = useMemo(() => {
        const counts: Record<string, number> = {};
        profiles.forEach(p => { counts[p.id] = 0; });
        acceptedStaff.forEach(s => {
            if (s.userId && assignmentMap[s.userId]) {
                const pid = assignmentMap[s.userId]!;
                counts[pid] = (counts[pid] ?? 0) + 1;
            }
        });
        return counts;
    }, [profiles, acceptedStaff, assignmentMap]);

    // ── Actions ──────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!selectedProfileId) return;
        setSaving(true);
        setSaveError(null);
        setSaved(false);
        try {
            const h = { ...(await authHeaders()), "Content-Type": "application/json" };
            const res = await fetch(
                `/api/venue/staff-profiles/${selectedProfileId}?venueId=${venueId}`,
                {
                    method: "PATCH",
                    headers: h,
                    body: JSON.stringify({
                        tabVisibility: editTabs,
                        actionPermissions: editActions,
                        piiPolicy: editPii,
                        guestlistScope: editScope,
                    }),
                }
            );
            if (!res.ok) {
                const err = await res.json();
                setSaveError(err.error ?? "Save failed");
            } else {
                const { profile: updated } = await res.json();
                setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p));
                setSaved(true);
                setTimeout(() => setSaved(false), 2500);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleAssign = async () => {
        if (!assignTarget || !selectedProfileId) return;
        setAssigning(true);
        try {
            const h = { ...(await authHeaders()), "Content-Type": "application/json" };
            const res = await fetch(`/api/venue/staff-profiles/assign?venueId=${venueId}`, {
                method: "POST", headers: h,
                body: JSON.stringify({ staffUserId: assignTarget, profileId: selectedProfileId }),
            });
            if (res.ok) {
                setAssignmentMap(prev => ({ ...prev, [assignTarget]: selectedProfileId }));
                setAssignTarget("");
            }
        } finally {
            setAssigning(false);
        }
    };

    const handleRemove = async (uid: string) => {
        setAssigning(true);
        try {
            const h = { ...(await authHeaders()), "Content-Type": "application/json" };
            const res = await fetch(`/api/venue/staff-profiles/assign?venueId=${venueId}`, {
                method: "DELETE", headers: h,
                body: JSON.stringify({ staffUserId: uid }),
            });
            if (res.ok) setAssignmentMap(prev => ({ ...prev, [uid]: null }));
        } finally {
            setAssigning(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedProfileId) return;
        const count = profileStaffCount[selectedProfileId] ?? 0;
        const msg = count > 0
            ? `This profile has ${count} staff assigned. Deleting will remove their custom access. Continue?`
            : "Delete this access profile?";
        if (!confirm(msg)) return;
        setDeleting(true);
        try {
            const h = await authHeaders();
            const res = await fetch(
                `/api/venue/staff-profiles/${selectedProfileId}?venueId=${venueId}`,
                { method: "DELETE", headers: h }
            );
            if (res.ok) {
                setProfiles(prev => prev.filter(p => p.id !== selectedProfileId));
                setSelectedProfileId(null);
                setAssignmentMap(prev => {
                    const next = { ...prev };
                    Object.keys(next).forEach(uid => {
                        if (next[uid] === selectedProfileId) next[uid] = null;
                    });
                    return next;
                });
            }
        } finally {
            setDeleting(false);
        }
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <VenuePageShell
            title="Access Profiles"
            subtitle="Control exactly what each staff member can see and do"
            actions={
                <Link href="/venue/staff/profiles/new">
                    <VenueActionButton icon={Plus}>New Profile</VenueActionButton>
                </Link>
            }
        >
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-tertiary)" }} />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

                    {/* ── Left: Profile list ─────────────────────────────── */}
                    <div className="lg:col-span-4 space-y-2">
                        {profiles.length === 0 ? (
                            <div
                                className="rounded-2xl border p-8 flex flex-col items-center gap-3 text-center"
                                style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}
                            >
                                <Shield className="w-8 h-8" style={{ color: "var(--text-tertiary)" }} />
                                <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>No profiles yet</p>
                                <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                                    Create a profile to define tab visibility, action permissions, and PII rules.
                                </p>
                                <Link href="/venue/staff/profiles/new">
                                    <button className="mt-1 px-4 py-2 rounded-xl text-[12px] font-bold"
                                        style={{ background: "var(--accent)", color: "#fff" }}>
                                        Create First Profile
                                    </button>
                                </Link>
                            </div>
                        ) : (
                            <AnimatePresence initial={false}>
                                {profiles.map(p => {
                                    const rc = ROLE_COLORS[p.baseRole] ?? ROLE_COLORS.STAFF;
                                    const count = profileStaffCount[p.id] ?? 0;
                                    const isSelected = selectedProfileId === p.id;
                                    const avatarStaff = acceptedStaff
                                        .filter(s => s.userId && assignmentMap[s.userId] === p.id)
                                        .slice(0, 3);

                                    return (
                                        <motion.div
                                            key={p.id}
                                            layout
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.97 }}
                                            onClick={() => setSelectedProfileId(prev => prev === p.id ? null : p.id)}
                                            className="rounded-2xl border px-4 py-3.5 cursor-pointer transition-all"
                                            style={{
                                                borderColor: isSelected ? "var(--accent)" : "var(--border-subtle)",
                                                background: isSelected ? "rgba(249,115,22,0.06)" : "var(--bg-elevated)",
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                                    style={{ background: rc.bg }}>
                                                    <Shield className="w-4 h-4" style={{ color: rc.text }} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[13px] font-semibold truncate"
                                                            style={{ color: "var(--text-primary)" }}>
                                                            {p.profileName}
                                                        </span>
                                                        {!p.isActive && (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                                                style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}>
                                                                INACTIVE
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                                            style={{ background: rc.bg, color: rc.text }}>
                                                            {p.baseRole}
                                                        </span>
                                                        <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                                                            {count} staff
                                                        </span>
                                                    </div>
                                                </div>
                                                {avatarStaff.length > 0 && (
                                                    <div className="flex -space-x-2 shrink-0">
                                                        {avatarStaff.map(s => (
                                                            <div key={s.id}
                                                                className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black border-2"
                                                                style={{
                                                                    background: "var(--bg-fill)",
                                                                    color: "var(--text-primary)",
                                                                    borderColor: isSelected ? "rgba(249,115,22,0.06)" : "var(--bg-elevated)",
                                                                }}
                                                                title={s.name}>
                                                                {initials(s.name)}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        )}

                        {/* Unassigned bucket */}
                        {unassignedStaff.length > 0 && (
                            <div className="rounded-2xl border px-4 py-3 mt-2"
                                style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)", opacity: 0.75 }}>
                                <p className="v-label text-[9px] mb-2">UNASSIGNED ({unassignedStaff.length})</p>
                                <div className="space-y-1.5">
                                    {unassignedStaff.map(s => (
                                        <div key={s.id} className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[8px] font-black shrink-0"
                                                style={{ background: "var(--bg-fill)", color: "var(--text-tertiary)" }}>
                                                {initials(s.name)}
                                            </div>
                                            <span className="text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>
                                                {s.name}
                                            </span>
                                            <span className="text-[9px] font-bold ml-auto shrink-0"
                                                style={{ color: "var(--text-tertiary)" }}>
                                                {ROLE_LABELS[s.role] ?? s.role}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Right: Inline editor panel ─────────────────────── */}
                    <div className="lg:col-span-8 lg:sticky lg:top-28">
                        {selectedProfile ? (
                            <div className="rounded-2xl border space-y-0 overflow-hidden"
                                style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>

                                {/* Header */}
                                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b"
                                    style={{ borderColor: "var(--border-subtle)" }}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                            style={{ background: (ROLE_COLORS[selectedProfile.baseRole] ?? ROLE_COLORS.STAFF).bg }}>
                                            <Shield className="w-4 h-4" style={{ color: (ROLE_COLORS[selectedProfile.baseRole] ?? ROLE_COLORS.STAFF).text }} />
                                        </div>
                                        <div>
                                            <h3 className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>
                                                {selectedProfile.profileName}
                                            </h3>
                                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                                                style={{
                                                    background: (ROLE_COLORS[selectedProfile.baseRole] ?? ROLE_COLORS.STAFF).bg,
                                                    color: (ROLE_COLORS[selectedProfile.baseRole] ?? ROLE_COLORS.STAFF).text,
                                                }}>
                                                {selectedProfile.baseRole}
                                            </span>
                                        </div>
                                    </div>
                                    <button onClick={handleDelete} disabled={deleting}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold hover:brightness-125 disabled:opacity-40"
                                        style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}>
                                        {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                        Delete
                                    </button>
                                </div>

                                {/* Scrollable body */}
                                <div className="overflow-y-auto max-h-[calc(100vh-260px)]">
                                    <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x"
                                        style={{ borderColor: "var(--border-subtle)" }}>

                                        {/* Left column: tabs + staff */}
                                        <div className="p-5 space-y-6">

                                            {/* Tab Visibility */}
                                            <Section title="TAB VISIBILITY">
                                                <div className="space-y-0.5">
                                                    {TAB_META.map(({ key, label, icon: Icon }) => (
                                                        <div key={key}
                                                            className="flex items-center justify-between py-2 px-2 rounded-xl hover:brightness-110 transition-all"
                                                            style={{ background: "transparent" }}>
                                                            <div className="flex items-center gap-2.5">
                                                                <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                                                                <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                                                                    {label}
                                                                </span>
                                                            </div>
                                                            <Toggle
                                                                checked={editTabs[key] ?? false}
                                                                onChange={v => setEditTabs(prev => ({ ...prev, [key]: v }))}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </Section>

                                            {/* Guestlist scope */}
                                            <Section title="GUESTLIST ACCESS">
                                                <select
                                                    value={editScope}
                                                    onChange={e => setEditScope(e.target.value as GuestlistScope)}
                                                    className="w-full text-[12px] rounded-xl px-3 py-2"
                                                    style={{
                                                        background: "var(--bg-fill)",
                                                        color: "var(--text-primary)",
                                                        border: "1px solid var(--border-subtle)",
                                                        outline: "none",
                                                    }}
                                                >
                                                    <option value="none">Hidden — cannot access guestlist</option>
                                                    <option value="read_only">Read Only — can view but not edit</option>
                                                    <option value="editable">Editable — can add, check-in, deny</option>
                                                </select>
                                            </Section>

                                            {/* Assigned staff */}
                                            <Section title={`ASSIGNED STAFF (${profileStaff.length})`}>
                                                {profileStaff.length === 0 ? (
                                                    <p className="text-[11px] px-1" style={{ color: "var(--text-tertiary)" }}>
                                                        No staff assigned. Add below.
                                                    </p>
                                                ) : (
                                                    <div className="space-y-1.5">
                                                        <AnimatePresence initial={false}>
                                                            {profileStaff.map(s => (
                                                                <motion.div key={s.id} layout
                                                                    initial={{ opacity: 0, x: -6 }}
                                                                    animate={{ opacity: 1, x: 0 }}
                                                                    exit={{ opacity: 0, x: 6 }}
                                                                    className="flex items-center gap-3 px-3 py-2 rounded-xl"
                                                                    style={{ background: "var(--bg-fill)" }}>
                                                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black shrink-0"
                                                                        style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}>
                                                                        {initials(s.name)}
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-[12px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                                                                            {s.name}
                                                                        </p>
                                                                        <p className="text-[10px] truncate" style={{ color: "var(--text-tertiary)" }}>
                                                                            {s.email}
                                                                        </p>
                                                                    </div>
                                                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
                                                                        style={{ background: "rgba(113,113,122,0.2)", color: "#a1a1aa" }}>
                                                                        {ROLE_LABELS[s.role] ?? s.role}
                                                                    </span>
                                                                    <button onClick={() => s.userId && handleRemove(s.userId)}
                                                                        disabled={assigning}
                                                                        className="p-1 rounded-lg hover:brightness-125 disabled:opacity-40 shrink-0"
                                                                        style={{ color: "#f87171" }}>
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </motion.div>
                                                            ))}
                                                        </AnimatePresence>
                                                    </div>
                                                )}

                                                {unassignedStaff.length > 0 && (
                                                    <div className="flex gap-2 mt-2">
                                                        <div className="relative flex-1">
                                                            <select value={assignTarget}
                                                                onChange={e => setAssignTarget(e.target.value)}
                                                                className="w-full appearance-none text-[12px] font-medium rounded-xl px-3 py-2 pr-7"
                                                                style={{
                                                                    background: "var(--bg-fill)",
                                                                    color: assignTarget ? "var(--text-primary)" : "var(--text-tertiary)",
                                                                    border: "1px solid var(--border-subtle)",
                                                                    outline: "none",
                                                                }}>
                                                                <option value="">Add staff member…</option>
                                                                {unassignedStaff.map(s => (
                                                                    <option key={s.id} value={s.userId ?? ""}>
                                                                        {s.name} ({ROLE_LABELS[s.role] ?? s.role})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                                                                style={{ color: "var(--text-tertiary)" }} />
                                                        </div>
                                                        <button onClick={handleAssign} disabled={!assignTarget || assigning}
                                                            className="px-4 py-2 rounded-xl text-[12px] font-bold hover:brightness-110 disabled:opacity-40 flex items-center gap-1.5"
                                                            style={{ background: "var(--accent)", color: "#fff" }}>
                                                            {assigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                                            Assign
                                                        </button>
                                                    </div>
                                                )}
                                            </Section>
                                        </div>

                                        {/* Right column: PII + actions */}
                                        <div className="p-5 space-y-6">

                                            {/* PII */}
                                            <Section title="DATA VISIBILITY (PII)">
                                                <div className="space-y-0.5">
                                                    {([
                                                        { key: "showPhone" as const,        label: "Show full phone number" },
                                                        { key: "showEmail" as const,        label: "Show full email" },
                                                        { key: "showLastName" as const,     label: "Show guest last name" },
                                                        { key: "showOrderAmount" as const,  label: "Show order amounts" },
                                                        { key: "showPayoutAmounts" as const,label: "Show payout amounts" },
                                                    ]).map(({ key, label }) => (
                                                        <div key={key}
                                                            className="flex items-center justify-between py-2 px-2 rounded-xl">
                                                            <div className="flex items-center gap-2.5">
                                                                {editPii[key]
                                                                    ? <Eye className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                                                                    : <EyeOff className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                                                                }
                                                                <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                                                                    {label}
                                                                </span>
                                                            </div>
                                                            <Toggle
                                                                checked={!!editPii[key]}
                                                                onChange={v => setEditPii(prev => ({ ...prev, [key]: v }))}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </Section>

                                            {/* Action groups */}
                                            {ACTION_GROUPS.map(grp => (
                                                <Section key={grp.group} title={grp.group.toUpperCase()}>
                                                    <div className="space-y-0.5">
                                                        {grp.actions.map(({ key, label }) => (
                                                            <div key={key}
                                                                className="flex items-center justify-between py-2 px-2 rounded-xl">
                                                                <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                                                                    {label}
                                                                </span>
                                                                <Toggle
                                                                    checked={editActions[key] ?? false}
                                                                    onChange={v => setEditActions(prev => ({ ...prev, [key]: v }))}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </Section>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Save bar */}
                                <div className="flex items-center justify-between gap-3 px-5 py-3 border-t"
                                    style={{ borderColor: "var(--border-subtle)" }}>
                                    {saveError ? (
                                        <p className="text-[11px]" style={{ color: "#f87171" }}>{saveError}</p>
                                    ) : saved ? (
                                        <p className="text-[11px]" style={{ color: "#34d399" }}>Saved — changes apply on staff's next page load</p>
                                    ) : (
                                        <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                                            Toggle permissions then save
                                        </p>
                                    )}
                                    <button onClick={handleSave} disabled={saving}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold hover:brightness-110 disabled:opacity-50"
                                        style={{ background: "var(--accent)", color: "#fff" }}>
                                        {saving
                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            : <Save className="w-3.5 h-3.5" />
                                        }
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-2xl border flex flex-col items-center justify-center py-16 gap-3 text-center"
                                style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
                                <Shield className="w-8 h-8" style={{ color: "var(--text-tertiary)" }} />
                                <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                                    Select a profile on the left to edit its permissions
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="mt-6 rounded-xl border p-4"
                style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)", opacity: 0.7 }}>
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                    Each staff member has a <strong style={{ color: "var(--text-secondary)" }}>base role</strong> that sets default access.
                    An <strong style={{ color: "var(--text-secondary)" }}>access profile</strong> overlays custom tab visibility, action gates, and PII rules.
                    Changes take effect on the staff member's <strong style={{ color: "var(--text-secondary)" }}>next page load</strong>.
                </p>
            </div>
        </VenuePageShell>
    );
}
