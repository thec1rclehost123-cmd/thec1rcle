"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
    ChevronLeft,
    Save,
    Eye,
    EyeOff,
    Shield,
    Calendar,
    FileText,
    BarChart3,
    Banknote,
    Users,
    ClipboardList,
    Settings,
    Building2,
    LayoutDashboard,
} from "lucide-react";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import Toggle from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import type {
    StaffProfile,
    VenueTab,
    StaffAction,
    VenueRole,
    PIIPolicy,
    GuestlistScope,
} from "@/lib/types/staffProfile";
import { ROLE_DEFAULT_TABS, DEFAULT_PII_POLICY, OWNER_PII_POLICY } from "@/lib/types/staffProfile";
import Link from "next/link";

// ── Tab definitions ────────────────────────────────────────────────────────────
const TAB_DEFS: { key: VenueTab; label: string; icon: React.ElementType }[] = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
    { key: "events", label: "Events", icon: Calendar },
    { key: "finance", label: "Finance", icon: Banknote },
    { key: "calendar", label: "Calendar", icon: Calendar },
    { key: "walk_ins", label: "Walk-ins", icon: ClipboardList },
    { key: "guest_ops", label: "Guest Ops", icon: Users },
    { key: "partnerships", label: "Partnerships", icon: Users },
    { key: "staff", label: "Staff", icon: Shield },
    { key: "registers", label: "Registers", icon: FileText },
    { key: "page_management", label: "Venue Page", icon: Building2 },
    { key: "settings", label: "Settings", icon: Settings },
];

// ── Action groups ──────────────────────────────────────────────────────────────
const ACTION_GROUPS: { group: string; actions: { key: StaffAction; label: string }[] }[] = [
    {
        group: "Events",
        actions: [
            { key: "events:create", label: "Create events" },
            { key: "events:edit", label: "Edit events" },
            { key: "events:cancel", label: "Cancel events" },
            { key: "events:duplicate", label: "Duplicate events" },
            { key: "events:approve_requests", label: "Approve host requests" },
        ],
    },
    {
        group: "Guestlist",
        actions: [
            { key: "guestlist:read", label: "View guestlist" },
            { key: "guestlist:add_guest", label: "Add guests" },
            { key: "guestlist:check_in", label: "Check in guests" },
            { key: "guestlist:deny", label: "Deny guests" },
            { key: "guestlist:flag", label: "Flag guests" },
            { key: "guestlist:export", label: "Export guestlist" },
            { key: "guestlist:print", label: "Print guestlist" },
        ],
    },
    {
        group: "Walk-ins",
        actions: [
            { key: "walkins:read", label: "View walk-in logs" },
            { key: "walkins:create", label: "Add walk-in entries" },
            { key: "walkins:edit", label: "Edit entries" },
            { key: "walkins:delete", label: "Void entries" },
            { key: "walkins:print", label: "Print register" },
            { key: "walkins:export", label: "Export register" },
        ],
    },
    {
        group: "Calendar",
        actions: [
            { key: "calendar:read", label: "View calendar" },
            { key: "calendar:block_slot", label: "Block slots" },
            { key: "calendar:unblock_slot", label: "Unblock slots" },
            { key: "calendar:approve_host_request", label: "Approve host slot requests" },
        ],
    },
    {
        group: "Finance",
        actions: [
            { key: "finance:read_overview", label: "View finance overview" },
            { key: "finance:read_ledger", label: "View ledger" },
            { key: "finance:read_payouts", label: "View venue payouts" },
            { key: "finance:initiate_payout", label: "Initiate payouts" },
            { key: "finance:read_host_payouts", label: "View host payouts" },
            { key: "finance:read_promoter_payouts", label: "View promoter payouts" },
        ],
    },
    {
        group: "Staff & Settings",
        actions: [
            { key: "staff:read", label: "View staff" },
            { key: "staff:invite", label: "Invite staff" },
            { key: "staff:edit_profiles", label: "Edit access profiles" },
            { key: "staff:revoke", label: "Revoke staff access" },
            { key: "analytics:read", label: "View analytics" },
            { key: "settings:read", label: "View settings" },
            { key: "settings:edit", label: "Edit settings" },
        ],
    },
];

const ROLES: VenueRole[] = ["OWNER", "MANAGER", "FINANCE_ADMIN", "STAFF", "SECURITY"];

// ── Main component ─────────────────────────────────────────────────────────────
export function StaffProfileEditorClient({ profileId }: { profileId: string }) {
    const isNew = profileId === "new";
    const router = useRouter();
    const { profile: dashProfile } = useDashboardAuth();
    const venueId = dashProfile?.activeMembership?.partnerId;
    const qc = useQueryClient();

    // Form state
    const [profileName, setProfileName] = useState("");
    const [baseRole, setBaseRole] = useState<VenueRole>("STAFF");
    const [tabs, setTabs] = useState<Partial<Record<VenueTab, boolean>>>({});
    const [actions, setActions] = useState<Partial<Record<StaffAction, boolean>>>({});
    const [pii, setPii] = useState<PIIPolicy>(DEFAULT_PII_POLICY);
    const [guestlistScope, setGuestlistScope] = useState<GuestlistScope>("read_only");

    // Load existing profile
    const { data, isLoading } = useQuery({
        queryKey: ["staff-profile", venueId, profileId],
        queryFn: async () => {
            const res = await fetch(
                `/api/venue/staff-profiles/${profileId}?venueId=${venueId}`
            );
            if (!res.ok) throw new Error("Not found");
            const { profile } = await res.json();
            return profile as StaffProfile;
        },
        enabled: !!venueId && !isNew,
        staleTime: 30_000,
    });

    useEffect(() => {
        if (data) {
            setProfileName(data.profileName);
            setBaseRole(data.baseRole);
            setTabs(data.tabVisibility);
            setActions(data.actionPermissions);
            setPii(data.piiPolicy);
            setGuestlistScope(data.guestlistScope);
        }
    }, [data]);

    // When base role changes in new mode, seed defaults
    const handleBaseRoleChange = (role: VenueRole) => {
        setBaseRole(role);
        if (isNew) {
            setTabs(ROLE_DEFAULT_TABS[role] ?? {});
            setPii(role === "OWNER" ? OWNER_PII_POLICY : DEFAULT_PII_POLICY);
        }
    };

    const saveMut = useMutation({
        mutationFn: async () => {
            const url = isNew
                ? `/api/venue/staff-profiles?venueId=${venueId}`
                : `/api/venue/staff-profiles/${profileId}?venueId=${venueId}`;
            const method = isNew ? "POST" : "PATCH";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    profileName,
                    baseRole,
                    tabVisibility: tabs,
                    actionPermissions: actions,
                    piiPolicy: pii,
                    guestlistScope,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? "Save failed");
            }
            return res.json();
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["staff-profiles", venueId] });
            router.push("/venue/staff/profiles");
        },
    });

    if (!isNew && isLoading) {
        return (
            <VenuePageShell title="Edit Profile">
                <Skeleton className="h-[600px] rounded-xl" />
            </VenuePageShell>
        );
    }

    return (
        <VenuePageShell
            title={isNew ? "New Access Profile" : "Edit Access Profile"}
            subtitle="Define tab visibility, action permissions, and PII policy"
            actions={
                <div className="flex items-center gap-2">
                    <Link href="/venue/staff/profiles">
                        <Button variant="ghost" size="sm">
                            <ChevronLeft className="h-4 w-4 mr-1" /> Back
                        </Button>
                    </Link>
                    <VenueActionButton
                        icon={Save}
                        onClick={() => saveMut.mutate()}
                        disabled={saveMut.isPending || !profileName.trim()}
                    >
                        {saveMut.isPending ? "Saving…" : "Save Profile"}
                    </VenueActionButton>
                </div>
            }
        >
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
                {/* Left: Identity */}
                <div className="space-y-6">
                    <Section title="Identity">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1.5">Profile Name</label>
                                <Input
                                    value={profileName}
                                    onChange={(e) => setProfileName(e.target.value)}
                                    placeholder="e.g. Door Staff, Finance Viewer"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1.5">Base Role</label>
                                <Select
                                    value={baseRole}
                                    onChange={(e) => handleBaseRoleChange(e.target.value as VenueRole)}
                                >
                                    {ROLES.map((r) => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </Select>
                                <p className="mt-1 text-xs text-zinc-600">
                                    Base role defines the permission floor. Custom tabs/actions override on top.
                                </p>
                            </div>
                        </div>
                    </Section>

                    {/* Tab visibility */}
                    <Section title="Tab Visibility">
                        <div className="space-y-3">
                            {TAB_DEFS.map(({ key, label, icon: Icon }) => (
                                <div key={key} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <Icon className="h-4 w-4 text-zinc-500" />
                                        <span className="text-sm text-zinc-300">{label}</span>
                                    </div>
                                    <Toggle
                                        checked={tabs[key] ?? false}
                                        onChange={(v) => setTabs((prev) => ({ ...prev, [key]: v }))}
                                    />
                                </div>
                            ))}
                        </div>
                    </Section>

                    {/* Guestlist scope */}
                    <Section title="Guestlist Access">
                        <div>
                            <label className="block text-xs text-zinc-400 mb-1.5">Guestlist Scope</label>
                            <Select
                                value={guestlistScope}
                                onChange={(e) => setGuestlistScope(e.target.value as GuestlistScope)}
                            >
                                <option value="none">Hidden — cannot access guestlist</option>
                                <option value="read_only">Read Only — can view but not edit</option>
                                <option value="editable">Editable — can add, check-in, deny</option>
                            </Select>
                        </div>
                    </Section>
                </div>

                {/* Right: Actions + PII */}
                <div className="space-y-6">
                    {/* PII Policy */}
                    <Section title="Data Visibility (PII)">
                        <div className="space-y-3">
                            {[
                                { key: "showPhone" as keyof PIIPolicy, label: "Show full phone number" },
                                { key: "showEmail" as keyof PIIPolicy, label: "Show full email" },
                                { key: "showLastName" as keyof PIIPolicy, label: "Show guest last name" },
                                { key: "showOrderAmount" as keyof PIIPolicy, label: "Show order amounts" },
                                { key: "showPayoutAmounts" as keyof PIIPolicy, label: "Show payout amounts" },
                            ].map(({ key, label }) => (
                                <div key={key} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        {pii[key] ? (
                                            <Eye className="h-4 w-4 text-zinc-500" />
                                        ) : (
                                            <EyeOff className="h-4 w-4 text-zinc-600" />
                                        )}
                                        <span className="text-sm text-zinc-300">{label}</span>
                                    </div>
                                    <Toggle
                                        checked={!!pii[key]}
                                        onChange={(v) => setPii((prev) => ({ ...prev, [key]: v }))}
                                    />
                                </div>
                            ))}
                        </div>
                    </Section>

                    {/* Action permissions */}
                    {ACTION_GROUPS.map((grp) => (
                        <Section key={grp.group} title={grp.group}>
                            <div className="space-y-3">
                                {grp.actions.map(({ key, label }) => (
                                    <div key={key} className="flex items-center justify-between">
                                        <span className="text-sm text-zinc-300">{label}</span>
                                        <Toggle
                                            checked={actions[key] ?? false}
                                            onChange={(v) =>
                                                setActions((prev) => ({ ...prev, [key]: v }))
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                        </Section>
                    ))}
                </div>
            </div>

            {saveMut.isError && (
                <p className="mt-4 text-sm text-red-400">{(saveMut.error as Error).message}</p>
            )}
        </VenuePageShell>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">
                {title}
            </h3>
            {children}
        </div>
    );
}
