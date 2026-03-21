"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus, Shield, Trash2, ChevronDown, Loader2, Save,
    LayoutDashboard, BarChart3, Calendar, Banknote, ClipboardList,
    Users, FileText, Building2, Settings, X, Eye, EyeOff,
} from "lucide-react";
import Toggle from "@/components/ui/Toggle";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import Link from "next/link";
import { BentoCard } from "@/components/ui/BentoCard";
import type {
    StaffProfile, VenueTab, StaffAction, PIIPolicy, GuestlistScope,
} from "@/lib/types/staffProfile";
import { DEFAULT_PII_POLICY } from "@/lib/types/staffProfile";

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
    OWNER:         { bg: "rgba(245,158,11,0.15)", text: "var(--v-orange)" },
    MANAGER:       { bg: "rgba(59,130,246,0.15)",  text: "var(--v-info)" },
    FINANCE_ADMIN: { bg: "rgba(16,185,129,0.15)",  text: "var(--v-success)" },
    STAFF:         { bg: "rgba(113,113,122,0.2)",   text: "var(--v-text-muted)" },
    SECURITY:      { bg: "rgba(239,68,68,0.15)",    text: "var(--v-error)" },
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <p className="v-label text-[10px] font-bold tracking-wider opacity-60 uppercase">{title}</p>
            {children}
        </div>
    );
}

export default function ProfilesView() {
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

    if (loading) return (
        <div className="flex items-center justify-center py-20 bg-[var(--v-card)] rounded-2xl border border-border-subtle">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--v-orange)]" />
        </div>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Profile Selection List */}
            <div className="lg:col-span-4 space-y-3">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-[var(--v-text-muted)]">Active Profiles</h3>
                    <Link href="/venue/staff/profiles/new">
                        <button className="p-1.5 rounded-lg bg-surface-tertiary hover:bg-[var(--v-orange-dim)] text-[var(--v-orange)] transition-colors">
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </Link>
                </div>

                <div className="space-y-2">
                    {profiles.map(p => {
                        const rc = ROLE_COLORS[p.baseRole] ?? ROLE_COLORS.STAFF;
                        const isSelected = selectedProfileId === p.id;
                        const count = profileStaffCount[p.id] ?? 0;

                        return (
                            <motion.div
                                key={p.id}
                                layout
                                onClick={() => setSelectedProfileId(prev => prev === p.id ? null : p.id)}
                                className={`group p-4 rounded-2xl border transition-all cursor-pointer ${
                                    isSelected 
                                        ? "border-[var(--v-orange)] bg-[var(--v-orange-dim)]" 
                                        : "border-border-subtle bg-[var(--v-card)] hover:border-border-default hover:bg-surface-tertiary"
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                                        isSelected ? "border-[var(--v-orange)]/20" : "border-border-subtle"
                                    }`} style={{ background: rc.bg }}>
                                        <Shield className="w-5 h-5" style={{ color: rc.text }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[14px] font-bold text-[var(--v-text-primary)] truncate">{p.profileName}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md" style={{ background: rc.bg, color: rc.text }}>
                                                {p.baseRole}
                                            </span>
                                            <span className="text-[11px] text-[var(--v-text-muted)]">{count} Members</span>
                                        </div>
                                    </div>
                                    <ChevronDown className={`w-4 h-4 text-[var(--v-text-muted)] transition-transform ${isSelected ? "rotate-180" : ""}`} />
                                </div>
                            </motion.div>
                        );
                    })}

                    {profiles.length === 0 && (
                        <div className="p-8 text-center bg-[var(--v-card)] rounded-2xl border border-dashed border-border-default">
                            <p className="text-[12px] text-[var(--v-text-muted)]">No custom profiles yet.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Profile Editor */}
            <div className="lg:col-span-8">
                <AnimatePresence mode="wait">
                    {selectedProfile ? (
                        <motion.div
                            key={selectedProfile.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="bg-[var(--v-card)] rounded-[2rem] border border-border-subtle overflow-hidden"
                            style={{ boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}
                        >
                            {/* Editor Header */}
                            <div className="px-8 py-6 border-b border-border-subtle bg-surface-tertiary/30 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-[1.25rem] flex items-center justify-center border border-border-default bg-surface-tertiary">
                                        <Shield className="w-6 h-6 text-[var(--v-orange)]" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-[var(--v-text-primary)]">{selectedProfile.profileName}</h2>
                                        <p className="text-[11px] text-[var(--v-text-muted)] uppercase tracking-[0.2em] font-black">Configuration Suite</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleDelete}
                                    className="p-3 rounded-2xl bg-red-400/5 text-red-400 hover:bg-red-400/10 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="p-8 space-y-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                {/* Grid container for sections */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    {/* Sidebar Access */}
                                    <Section title="Sidebar Visibility">
                                        <div className="grid grid-cols-2 gap-2">
                                            {TAB_META.map(({ key, label, icon: Icon }) => (
                                                <div 
                                                    key={key}
                                                    onClick={() => setEditTabs(prev => ({ ...prev, [key]: !prev[key] }))}
                                                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                                                        editTabs[key] 
                                                            ? "bg-[var(--v-orange-dim)] border-[var(--v-orange)]/30" 
                                                            : "bg-surface-tertiary border-border-subtle opacity-50 grayscale"
                                                    }`}
                                                >
                                                    <Icon className={`w-4 h-4 ${editTabs[key] ? "text-[var(--v-orange)]" : "text-[var(--v-text-muted)]"}`} />
                                                    <span className="text-[11px] font-bold">{label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </Section>

                                    <div className="space-y-10">
                                        {/* PII Policy */}
                                        <Section title="Data Masking (PII)">
                                            <div className="space-y-2 bg-surface-tertiary p-4 rounded-2xl border border-border-subtle">
                                                {([
                                                    { key: "showPhone" as const,        label: "Phone Numbers" },
                                                    { key: "showEmail" as const,        label: "Email Addresses" },
                                                    { key: "showLastName" as const,     label: "Guest Last Names" },
                                                    { key: "showOrderAmount" as const,  label: "Order Financials" },
                                                    { key: "showPayoutAmounts" as const,label: "Settlement Values" },
                                                ]).map(({ key, label }) => (
                                                    <div key={key} className="flex items-center justify-between group">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-1.5 rounded-lg transition-colors ${editPii[key] ? "bg-[var(--v-orange-dim)] text-[var(--v-orange)]" : "bg-surface-tertiary text-[var(--v-text-muted)]"}`}>
                                                                {editPii[key] ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                                            </div>
                                                            <span className="text-[12px] font-medium text-[var(--v-text-secondary)]">{label}</span>
                                                        </div>
                                                        <Toggle size="sm" checked={!!editPii[key]} onChange={v => setEditPii(prev => ({ ...prev, [key]: v }))} />
                                                    </div>
                                                ))}
                                            </div>
                                        </Section>

                                        {/* Guestlist Scope */}
                                        <Section title="Guestlist Authority">
                                             <div className="flex flex-col gap-2">
                                                {(['none', 'read_only', 'editable'] as GuestlistScope[]).map((scope) => (
                                                    <div 
                                                        key={scope}
                                                        onClick={() => setEditScope(scope)}
                                                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                                            editScope === scope 
                                                                ? "bg-surface-tertiary border-[var(--v-orange)] shadow-[0_0_20px_rgba(249,115,22,0.1)]" 
                                                                : "bg-surface-tertiary border-white/[0.02] hover:border-border-default opacity-60"
                                                        }`}
                                                    >
                                                        <p className="text-[12px] font-bold uppercase tracking-widest">{scope.replace('_', ' ')}</p>
                                                        <p className="text-[10px] text-[var(--v-text-muted)] mt-0.5">
                                                            {scope === 'none' && 'Access completely disabled'}
                                                            {scope === 'read_only' && 'Visualization only, no mutations'}
                                                            {scope === 'editable' && 'Full check-in and entry control'}
                                                        </p>
                                                    </div>
                                                ))}
                                             </div>
                                        </Section>
                                    </div>
                                </div>

                                {/* Granular Actions */}
                                <Section title="Fine-Grained Actions">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                        {ACTION_GROUPS.map(grp => (
                                            <div key={grp.group} className="space-y-3">
                                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--v-orange)]">{grp.group}</p>
                                                <div className="space-y-1">
                                                    {grp.actions.map(({ key, label }) => (
                                                        <div key={key} className="flex items-center justify-between py-2 border-b border-white/[0.02] last:border-0">
                                                            <span className="text-[12px] text-[var(--v-text-secondary)]">{label}</span>
                                                            <Toggle size="sm" checked={editActions[key] ?? false} onChange={v => setEditActions(prev => ({ ...prev, [key]: v }))} />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Section>

                                {/* Staff Assignments in Profile */}
                                <Section title={`Assigned Members (${profileStaff.length})`}>
                                    <div className="flex flex-wrap gap-2">
                                        {profileStaff.map(s => (
                                            <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 bg-surface-tertiary border border-border-subtle rounded-full group">
                                                <div className="w-5 h-5 rounded-full bg-[var(--v-orange)] flex items-center justify-center text-[7px] font-black text-white shrink-0">
                                                    {initials(s.name)}
                                                </div>
                                                <span className="text-[11px] font-medium">{s.name}</span>
                                                <button onClick={() => s.userId && handleRemove(s.userId)} className="p-1 rounded-full hover:bg-red-400/10 text-[var(--v-text-muted)] hover:text-red-400 transition-colors">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                        {unassignedStaff.length > 0 && (
                                             <div className="flex items-center gap-2 ml-auto">
                                                <select 
                                                    value={assignTarget}
                                                    onChange={e => setAssignTarget(e.target.value)}
                                                    className="bg-surface-tertiary border border-border-default rounded-full px-4 py-1.5 text-[11px] outline-none hover:border-[var(--v-orange)] transition-colors appearance-none pr-8 cursor-pointer"
                                                >
                                                    <option value="">Quick Assign...</option>
                                                    {unassignedStaff.map(s => <option key={s.id} value={s.userId}>{s.name}</option>)}
                                                </select>
                                                <button onClick={handleAssign} disabled={!assignTarget || assigning} className="p-1.5 rounded-full bg-[var(--v-orange)] text-white hover:scale-110 active:scale-90 transition-transform disabled:opacity-50">
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                             </div>
                                        )}
                                    </div>
                                </Section>
                            </div>

                            {/* Sticky Save Bar */}
                            <div className="px-8 py-6 bg-surface-tertiary/50 border-t border-border-subtle flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {saved ? (
                                        <div className="flex items-center gap-2 text-[var(--v-success)]">
                                            <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                                            <span className="text-[11px] font-black uppercase tracking-widest">Configuration Synced</span>
                                        </div>
                                    ) : saveError ? (
                                        <span className="text-[11px] text-red-400 font-bold">{saveError}</span>
                                    ) : (
                                        <span className="text-[10px] text-[var(--v-text-muted)] font-bold uppercase tracking-widest">Unsaved Changes Detected</span>
                                    )}
                                </div>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-8 py-3 rounded-2xl bg-[var(--v-orange)] text-white text-xs font-black uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(249,115,22,0.3)] hover:translate-y-[-2px] active:translate-y-[0] transition-all flex items-center gap-3 disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Sync Configuration
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="h-[70vh] flex flex-col items-center justify-center text-center p-12 bg-surface-tertiary/10 rounded-[2rem] border border-dashed border-white/[0.05]">
                            <div className="w-20 h-20 rounded-[2rem] bg-surface-tertiary flex items-center justify-center mb-6">
                                <Shield className="w-10 h-10 text-[var(--v-text-muted)]" />
                            </div>
                            <h3 className="text-lg font-bold text-[var(--v-text-primary)]">Select an Access Profile</h3>
                            <p className="text-[13px] text-[var(--v-text-muted)] max-w-xs mt-2">
                                Pick a profile from the registry to view and modify its granular permissions and member assignments.
                            </p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
