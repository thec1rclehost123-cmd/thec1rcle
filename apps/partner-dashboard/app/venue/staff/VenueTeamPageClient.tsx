"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Loader2, Mail, Phone, Shield, UserPlus, Users, X } from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { EditPermissionsModal } from "@/components/team/EditPermissionsModal";
import { TeamMemberCard } from "@/components/team/TeamMemberCard";
import { useToast } from "@/components/ui/Toast";
import type { VenueRole } from "@/lib/rbac/types";

type EditableVenueRole = Exclude<VenueRole, "OWNER" | "STAFF">;
type SearchMode = "email" | "phone";
type AddStep = "search" | "details" | "role";

interface StaffMember {
    id: string;
    email: string;
    name: string;
    role: string;
    phone?: string;
    status: "invited" | "pending_verification" | "active" | "suspended" | "removed";
    verified: boolean;
    userId?: string;
    createdAt: string;
    lastActive?: string | null;
    photoUrl?: string | null;
}

const ROLE_OPTIONS: Array<{ value: EditableVenueRole; label: string; description: string }> = [
    {
        value: "MANAGER",
        label: "Manager",
        description: "Handles event operations, guest flow, and day-to-day decisions.",
    },
    {
        value: "FINANCE_ADMIN",
        label: "Finance",
        description: "Reviews revenue and payout information without running the floor.",
    },
    {
        value: "SECURITY",
        label: "Security",
        description: "Focused on entry, safety, and incident awareness at the door.",
    },
];

function normalizeVenueRole(role: string): VenueRole {
    const normalized = role.toUpperCase();
    if (normalized === "MANAGER" || normalized === "FINANCE_ADMIN" || normalized === "SECURITY") {
        return normalized as VenueRole;
    }
    if (normalized === "OWNER") return "OWNER";
    return "STAFF";
}

function formatRoleLabel(role: string): string {
    const normalized = normalizeVenueRole(role);
    return ROLE_OPTIONS.find(option => option.value === normalized)?.label ?? (normalized === "OWNER" ? "Owner" : "Staff");
}

function getContactAction(member: StaffMember): (() => void) | undefined {
    if (member.email && member.email.includes("@")) {
        return () => {
            window.location.href = `mailto:${member.email}`;
        };
    }

    if (member.phone && /\d/.test(member.phone)) {
        return () => {
            window.location.href = `tel:${member.phone}`;
        };
    }

    return undefined;
}

function RoleStep({
    onAdd,
    onClose,
    loading,
}: {
    onAdd: (role: EditableVenueRole) => Promise<void>;
    onClose: () => void;
    loading: boolean;
}) {
    const [selectedRole, setSelectedRole] = useState<EditableVenueRole | null>(null);

    return (
        <div className="rounded-[40px] border border-[var(--v-border)] bg-[var(--v-card)] p-8 shadow-[0_0_80px_rgba(0,0,0,0.45)]">
            <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-[30px] font-black tracking-tight text-[var(--v-text-primary)]">
                        Choose Their Access
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--v-text-secondary)]">
                        Pick the role that best matches how they support your venue.
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="rounded-full border border-[var(--v-border)] bg-[var(--v-elevated)] p-3 text-[var(--v-text-secondary)] transition-all hover:text-[var(--v-text-primary)]"
                >
                    <X size={18} />
                </button>
            </div>

            <div className="space-y-3">
                {ROLE_OPTIONS.map(option => {
                    const active = selectedRole === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setSelectedRole(option.value)}
                            className={`w-full rounded-[26px] border p-5 text-left transition-all ${
                                active
                                    ? "border-[var(--c1rcle-orange)] bg-[var(--c1rcle-orange)]/10"
                                    : "border-[var(--v-border)] bg-[var(--v-elevated)] hover:border-[var(--c1rcle-orange)]/30"
                            }`}
                        >
                            <div className="flex items-start gap-4">
                                <div
                                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                                        active
                                            ? "bg-[var(--c1rcle-orange)] text-white"
                                            : "bg-black/20 text-[var(--v-text-secondary)]"
                                    }`}
                                >
                                    <Shield size={20} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-lg font-bold text-[var(--v-text-primary)]">{option.label}</p>
                                    <p className="mt-1 text-sm leading-relaxed text-[var(--v-text-secondary)]">
                                        {option.description}
                                    </p>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            <button
                type="button"
                onClick={() => selectedRole && onAdd(selectedRole)}
                disabled={!selectedRole || loading}
                className="mt-8 flex h-14 w-full items-center justify-center gap-3 rounded-full bg-white text-sm font-black uppercase tracking-[0.18em] text-black transition-all disabled:cursor-not-allowed disabled:opacity-40"
            >
                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                {loading ? "Adding..." : "Add Team Member"}
            </button>
        </div>
    );
}

function AddMemberModal({
    onAdd,
    onClose,
}: {
    onAdd: (data: { email: string; name: string; role: EditableVenueRole }) => Promise<void>;
    onClose: () => void;
}) {
    const [step, setStep] = useState<AddStep>("search");
    const [searchMode, setSearchMode] = useState<SearchMode>("email");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [loading, setLoading] = useState(false);

    const contactValue = searchMode === "email" ? email : phone;

    const handleSearchContinue = () => {
        if (!contactValue.trim()) return;
        setStep("details");
    };

    const handleDetailsContinue = () => {
        if (!firstName.trim() || !lastName.trim()) return;
        setStep("role");
    };

    const handleFinalize = async (role: EditableVenueRole) => {
        setLoading(true);
        try {
            const name = [firstName, lastName].filter(Boolean).join(" ").trim() || email || phone;
            await onAdd({ email: email || phone, name, role });
            onClose();
        } catch {
            // onAdd reports errors to the page via toast; keep the modal open
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                onClick={onClose}
            />

            <div className="relative w-full max-w-[640px]">
                <AnimatePresence mode="wait">
                    {step === "search" ? (
                        <motion.div
                            key="search"
                            initial={{ opacity: 0, y: 18, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -12, scale: 1.02 }}
                            className="rounded-[40px] border border-[var(--v-border)] bg-[var(--v-card)] p-8 shadow-[0_0_80px_rgba(0,0,0,0.45)]"
                        >
                            <div className="mb-8 flex justify-end">
                                <button
                                    onClick={onClose}
                                    className="rounded-full border border-[var(--v-border)] bg-[var(--v-elevated)] p-3 text-[var(--v-text-secondary)] transition-all hover:text-[var(--v-text-primary)]"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="mb-8 text-center">
                                <h2 className="text-[30px] font-black tracking-tight text-[var(--v-text-primary)]">
                                    Add a Team Member
                                </h2>
                                <p className="mt-2 text-sm text-[var(--v-text-secondary)]">
                                    Start with their best email or phone number.
                                </p>
                            </div>

                            <div className="mb-6 flex justify-center gap-3">
                                {(["email"] as SearchMode[]).map(mode => {
                                    const active = searchMode === mode;
                                    return (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setSearchMode(mode)}
                                            className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-xs font-black uppercase tracking-[0.18em] transition-all ${
                                                active
                                                    ? "bg-white text-black"
                                                    : "border border-[var(--v-border)] bg-[var(--v-elevated)] text-[var(--v-text-secondary)]"
                                            }`}
                                        >
                                            {mode === "email" ? <Mail size={14} /> : <Phone size={14} />}
                                            {mode}
                                        </button>
                                    );
                                })}
                            </div>

                            <input
                                autoFocus
                                value={contactValue}
                                onChange={event =>
                                    searchMode === "email"
                                        ? setEmail(event.target.value)
                                        : setPhone(event.target.value)
                                }
                                placeholder={searchMode === "email" ? "name@email.com" : "(555) 555-5555"}
                                className="h-16 w-full rounded-[24px] border border-[var(--v-border)] bg-[var(--v-elevated)] px-6 text-center text-lg font-semibold text-[var(--v-text-primary)] outline-none transition-all placeholder:text-[var(--v-text-tertiary)] focus:border-[var(--c1rcle-orange)]/40"
                                onKeyDown={event => event.key === "Enter" && handleSearchContinue()}
                            />

                            <button
                                type="button"
                                onClick={handleSearchContinue}
                                className="mt-6 h-14 w-full rounded-full border border-[var(--v-border)] bg-[var(--v-elevated)] text-sm font-black uppercase tracking-[0.18em] text-[var(--v-text-primary)] transition-all hover:border-[var(--c1rcle-orange)]/30"
                            >
                                Continue
                            </button>
                        </motion.div>
                    ) : null}

                    {step === "details" ? (
                        <motion.div
                            key="details"
                            initial={{ opacity: 0, y: 18, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -12, scale: 1.02 }}
                            className="rounded-[40px] border border-[var(--v-border)] bg-[var(--v-card)] p-8 shadow-[0_0_80px_rgba(0,0,0,0.45)]"
                        >
                            <div className="mb-8 flex items-center justify-between">
                                <button
                                    onClick={() => setStep("search")}
                                    className="text-xs font-black uppercase tracking-[0.18em] text-[var(--v-text-secondary)] transition-colors hover:text-[var(--v-text-primary)]"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={onClose}
                                    className="rounded-full border border-[var(--v-border)] bg-[var(--v-elevated)] p-3 text-[var(--v-text-secondary)] transition-all hover:text-[var(--v-text-primary)]"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="mb-8 text-center">
                                <h2 className="text-[30px] font-black tracking-tight text-[var(--v-text-primary)]">
                                    Add the Basics
                                </h2>
                                <p className="mt-2 text-sm text-[var(--v-text-secondary)]">
                                    This helps your team recognize the invite and get started faster.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <input
                                    value={firstName}
                                    onChange={event => setFirstName(event.target.value)}
                                    placeholder="First name"
                                    className="h-14 rounded-[24px] border border-[var(--v-border)] bg-[var(--v-elevated)] px-5 text-sm font-semibold text-[var(--v-text-primary)] outline-none placeholder:text-[var(--v-text-tertiary)] focus:border-[var(--c1rcle-orange)]/40"
                                />
                                <input
                                    value={lastName}
                                    onChange={event => setLastName(event.target.value)}
                                    placeholder="Last name"
                                    className="h-14 rounded-[24px] border border-[var(--v-border)] bg-[var(--v-elevated)] px-5 text-sm font-semibold text-[var(--v-text-primary)] outline-none placeholder:text-[var(--v-text-tertiary)] focus:border-[var(--c1rcle-orange)]/40"
                                />
                            </div>

                            <div className="mt-4 rounded-[24px] border border-[var(--v-border)] bg-[var(--v-elevated)] px-5 py-4 text-sm text-[var(--v-text-secondary)]">
                                {contactValue}
                            </div>

                            <button
                                type="button"
                                onClick={handleDetailsContinue}
                                className="mt-6 h-14 w-full rounded-full bg-white text-sm font-black uppercase tracking-[0.18em] text-black transition-all"
                            >
                                Continue to Role
                            </button>
                        </motion.div>
                    ) : null}

                    {step === "role" ? (
                        <motion.div
                            key="role"
                            initial={{ opacity: 0, y: 18, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -12, scale: 1.02 }}
                        >
                            <RoleStep onAdd={handleFinalize} onClose={onClose} loading={loading} />
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default function VenueTeamPageClient() {
    const { profile, user } = useDashboardAuth();
    const { error: toastError, success: toastSuccess } = useToast();
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editTarget, setEditTarget] = useState<StaffMember | null>(null);

    const venueId = profile?.activeMembership?.partnerId;
    const myRole = profile?.activeMembership?.role;
    const canManageTeam = myRole === "OWNER";

    const getHeaders = useCallback(async (): Promise<HeadersInit> => {
        const token = user ? await user.getIdToken() : null;
        return {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    }, [user]);

    const fetchStaff = useCallback(async () => {
        if (!venueId) return;
        setLoading(true);
        setError(null);

        try {
            const headers = await getHeaders();
            const response = await fetch(`/api/venue/staff?venueId=${venueId}&isActive=all`, { headers });
            if (!response.ok) throw new Error("Failed to load team members");
            const data = await response.json();
            setStaff(data.staff ?? []);
        } catch (err: any) {
            setError(err.message ?? "Failed to load team members");
        } finally {
            setLoading(false);
        }
    }, [getHeaders, venueId]);

    useEffect(() => {
        fetchStaff();
    }, [fetchStaff]);

    const activeMembers = useMemo(
        () => staff.filter(member => member.status !== "removed"),
        [staff]
    );

    const handleAdd = async (data: { email: string; name: string; role: EditableVenueRole }) => {
        try {
            const headers = await getHeaders();
            const response = await fetch("/api/venue/staff", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    venueId,
                    email: data.email,
                    name: data.name,
                    role: data.role,
                    addedBy: { uid: profile?.uid, name: profile?.displayName },
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => null);
                throw new Error(payload?.error ?? "Failed to add team member");
            }

            await fetchStaff();
            setShowAddModal(false);
            toastSuccess("Member invited", "Your venue team has been updated.");
        } catch (err: any) {
            const message = err.message ?? "Failed to add team member";
            toastError("Invite failed", message);
            throw err;
        }
    };

    const handleAction = async (staffId: string, action: "suspend" | "reactivate" | "remove") => {
        try {
            const headers = await getHeaders();
            const response = await fetch("/api/venue/staff", {
                method: "PATCH",
                headers,
                body: JSON.stringify({
                    staffId,
                    action,
                    updatedBy: { uid: profile?.uid, name: profile?.displayName },
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => null);
                throw new Error(payload?.error ?? `Failed to ${action} team member`);
            }

            await fetchStaff();
            toastSuccess(
                action === "remove" ? "Member removed" : "Team updated",
                action === "remove" ? "The team list is now up to date." : "The staff member status has been updated."
            );
        } catch (err: any) {
            toastError("Update failed", err.message ?? `Failed to ${action} team member`);
        }
    };

    const handleSavePermissions = async (role: EditableVenueRole) => {
        if (!editTarget) return;
        try {
            const headers = await getHeaders();
            const response = await fetch("/api/venue/staff", {
                method: "PATCH",
                headers,
                body: JSON.stringify({
                    staffId: editTarget.id,
                    action: "update_role",
                    role,
                    updatedBy: { uid: profile?.uid, name: profile?.displayName },
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => null);
                throw new Error(payload?.error ?? "Failed to update permissions");
            }

            setStaff(previous =>
                previous.map(member =>
                    member.id === editTarget.id ? { ...member, role } : member
                )
            );
            toastSuccess("Permissions updated", "Access changes have been saved.");
            setEditTarget(null);
        } catch (err: any) {
            toastError("Save failed", err.message ?? "Failed to update permissions");
            throw err;
        }
    };

    return (
        <div className="mx-auto max-w-[1240px] px-4 pb-12">
            <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-10 rounded-[40px] border border-[var(--v-border)] bg-[var(--v-card)] p-8 shadow-[0_0_80px_rgba(0,0,0,0.35)]"
            >
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--c1rcle-orange)]">
                            Venue Team
                        </p>
                        <h1 className="mt-3 text-[42px] font-black tracking-[-0.04em] text-[var(--v-text-primary)] md:text-[56px]">
                            Give the right access to the right people
                        </h1>
                        <p className="mt-3 text-base leading-relaxed text-[var(--v-text-secondary)]">
                            Keep venue roles simple so managers, finance, and security teams only see what they need.
                        </p>
                    </div>

                    {canManageTeam ? (
                        <button
                            type="button"
                            onClick={() => setShowAddModal(true)}
                            className="inline-flex h-14 items-center justify-center gap-3 self-start rounded-full bg-white px-8 text-sm font-black uppercase tracking-[0.18em] text-black transition-all hover:scale-[1.01] active:scale-[0.98]"
                        >
                            <UserPlus size={18} />
                            Add Team Member
                        </button>
                    ) : null}
                </div>
            </motion.div>

            {error ? (
                <div className="mb-8 flex items-center gap-3 rounded-[28px] border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-300">
                    <AlertCircle size={18} />
                    {error}
                </div>
            ) : null}

            {loading ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {[0, 1, 2].map(index => (
                        <div
                            key={index}
                            className="h-[360px] animate-pulse rounded-[30px] border border-[var(--v-border)] bg-[var(--v-card)]"
                        />
                    ))}
                </div>
            ) : activeMembers.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {activeMembers.map((member, index) => {
                        const normalizedRole = normalizeVenueRole(member.role);
                        return (
                            <TeamMemberCard
                                key={member.id}
                                member={{
                                    id: member.id,
                                    name: member.name,
                                    email: member.email || member.phone || "No contact info",
                                    role: normalizedRole,
                                    status: member.status === "removed" ? "removed" : member.status,
                                    lastActive: member.lastActive ?? null,
                                    photoUrl: member.photoUrl ?? undefined,
                                    isOwner: normalizedRole === "OWNER",
                                    verified: member.verified,
                                }}
                                roleLabel={formatRoleLabel(member.role)}
                                index={index}
                                onEditPermissions={
                                    canManageTeam && normalizedRole !== "OWNER"
                                        ? () => setEditTarget(member)
                                        : undefined
                                }
                                onContact={getContactAction(member)}
                                onRemove={
                                    canManageTeam && normalizedRole !== "OWNER"
                                        ? () => handleAction(member.id, "remove")
                                        : undefined
                                }
                            />
                        );
                    })}
                </div>
            ) : (
                <div className="rounded-[40px] border border-[var(--v-border)] bg-[var(--v-card)] px-6 py-16 text-center shadow-[0_0_80px_rgba(0,0,0,0.25)]">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] border border-[var(--v-border)] bg-[var(--v-elevated)]">
                        <Users size={34} className="text-[var(--v-text-tertiary)]" />
                    </div>
                    <h2 className="mt-6 text-2xl font-black tracking-tight text-[var(--v-text-primary)]">
                        No team members yet
                    </h2>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--v-text-secondary)]">
                        Add the people who help run your venue and give them a clear role from the start.
                    </p>
                </div>
            )}

            <AnimatePresence>
                {showAddModal ? (
                    <AddMemberModal onAdd={handleAdd} onClose={() => setShowAddModal(false)} />
                ) : null}
            </AnimatePresence>

            <AnimatePresence>
                {editTarget ? (
                    <EditPermissionsModal
                        partnerType="venue"
                        memberId={editTarget.id}
                        memberName={editTarget.name}
                        currentRole={normalizeVenueRole(editTarget.role)}
                        onSave={handleSavePermissions}
                        onClose={() => setEditTarget(null)}
                    />
                ) : null}
            </AnimatePresence>
        </div>
    );
}
