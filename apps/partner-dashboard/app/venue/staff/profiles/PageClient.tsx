"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Shield, Users, Eye, EyeOff, Pencil, Trash2, ChevronRight } from "lucide-react";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import Link from "next/link";
import type { StaffProfile } from "@/lib/types/staffProfile";

const ROLE_COLORS: Record<string, string> = {
    OWNER: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    MANAGER: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    FINANCE_ADMIN: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    STAFF: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
    SECURITY: "bg-red-500/15 text-red-400 border-red-500/20",
};

function TabCount({ profile }: { profile: StaffProfile }) {
    const visible = Object.values(profile.tabVisibility).filter(Boolean).length;
    return (
        <span className="text-xs text-zinc-500">{visible} tab{visible !== 1 ? "s" : ""} visible</span>
    );
}

function ProfileCard({ profile, onDelete }: { profile: StaffProfile; onDelete: (id: string) => void }) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="group relative flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-5 py-4 hover:bg-white/[0.06] transition-colors"
        >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06]">
                <Shield className="h-5 w-5 text-zinc-400" />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{profile.profileName}</span>
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[profile.baseRole]}`}>
                        {profile.baseRole}
                    </span>
                    {!profile.isActive && (
                        <span className="inline-flex items-center rounded-md border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
                            Inactive
                        </span>
                    )}
                </div>
                <div className="mt-1 flex items-center gap-3">
                    <TabCount profile={profile} />
                    <span className="text-zinc-700">·</span>
                    <span className="text-xs text-zinc-500">
                        {profile.piiPolicy.showPhone ? "Full PII" : "PII masked"}
                    </span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-xs text-zinc-500">
                        Guestlist: {profile.guestlistScope.replace("_", " ")}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href={`/venue/staff/profiles/${profile.id}`}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                </Link>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                    onClick={() => onDelete(profile.id)}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>

            <Link href={`/venue/staff/profiles/${profile.id}`} className="absolute inset-0 rounded-xl" />
        </motion.div>
    );
}

export function StaffProfilesClient() {
    const { profile: dashProfile } = useDashboardAuth();
    const venueId = dashProfile?.activeMembership?.partnerId;
    const qc = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ["staff-profiles", venueId],
        queryFn: async () => {
            const res = await fetch(`/api/venue/staff-profiles?venueId=${venueId}`);
            if (!res.ok) throw new Error("Failed to load");
            const json = await res.json();
            return json.profiles as StaffProfile[];
        },
        enabled: !!venueId,
        staleTime: 30_000,
    });

    const deleteMut = useMutation({
        mutationFn: async (profileId: string) => {
            const res = await fetch(
                `/api/venue/staff-profiles/${profileId}?venueId=${venueId}`,
                { method: "DELETE" }
            );
            if (!res.ok) throw new Error("Delete failed");
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-profiles", venueId] }),
    });

    const handleDelete = (id: string) => {
        if (confirm("Delete this access profile? Employees using it will fall back to their base role.")) {
            deleteMut.mutate(id);
        }
    };

    return (
        <VenuePageShell
            title="Access Profiles"
            subtitle="Control exactly what each employee account can see and do"
            actions={
                <Link href="/venue/staff/profiles/new">
                    <VenueActionButton icon={Plus}>New Profile</VenueActionButton>
                </Link>
            }
        >
            <div className="space-y-3">
                {isLoading && (
                    <>
                        <Skeleton className="h-[72px] rounded-xl" />
                        <Skeleton className="h-[72px] rounded-xl" />
                        <Skeleton className="h-[72px] rounded-xl" />
                    </>
                )}

                {!isLoading && (!data || data.length === 0) && (
                    <EmptyState
                        icon={Shield}
                        title="No access profiles yet"
                        description="Create a profile to define custom tab visibility, action permissions, and PII rules for a group of employees."
                        action={
                            <Link href="/venue/staff/profiles/new">
                                <VenueActionButton icon={Plus}>Create First Profile</VenueActionButton>
                            </Link>
                        }
                    />
                )}

                <AnimatePresence initial={false}>
                    {data?.map((p) => (
                        <ProfileCard key={p.id} profile={p} onDelete={handleDelete} />
                    ))}
                </AnimatePresence>
            </div>

            <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h3 className="text-sm font-medium text-zinc-300 mb-1">How profiles work</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                    Each employee account has a <strong className="text-zinc-400">base role</strong> (OWNER, MANAGER, STAFF etc.) that defines default permissions.
                    An <strong className="text-zinc-400">access profile</strong> overlays custom tab visibility, action gates, and PII masking rules on top.
                    If no profile is assigned, the base role defaults apply.
                    Profile changes take effect on next page load for the affected employee.
                </p>
            </div>
        </VenuePageShell>
    );
}
