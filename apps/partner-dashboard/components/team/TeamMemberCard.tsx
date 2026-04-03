"use client";

import { motion } from "framer-motion";
import { Clock3, Crown, Mail, ShieldCheck, Trash2, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: string;
    photoUrl?: string;
    status: "invited" | "pending_verification" | "active" | "suspended" | "removed";
    lastActive?: string | null;
    isOwner?: boolean;
    verified?: boolean;
}

interface TeamMemberCardProps {
    member: TeamMember;
    roleLabel: string;
    isCurrentUser?: boolean;
    index?: number;
    onEditPermissions?: () => void;
    onContact?: () => void;
    onRemove?: () => void;
    onVerify?: () => void;
    onSuspend?: () => void;
    onReactivate?: () => void;
    actionLoading?: string | null;
}

function getLastLoginText(lastActive?: string | null, status?: string): string {
    if (status === "invited") return "INVITE PENDING";
    if (status === "pending_verification") return "AWAITING VERIFICATION";
    if (!lastActive) return "NEVER LOGGED IN";

    const diff = Date.now() - new Date(lastActive).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor(diff / (1000 * 60));

    if (mins < 5) return "JUST NOW";
    if (hours < 1) return `${mins}M AGO`;
    if (hours < 24) return `${hours}H AGO`;
    if (days === 1) return "YESTERDAY";
    if (days < 7) return `${days} DAYS AGO`;
    if (days < 30) return `${Math.floor(days / 7)} WEEKS AGO`;
    if (days < 365) return `${Math.floor(days / 30)} MONTHS AGO`;
    return "OVER A YEAR AGO";
}

function getInitials(name: string): string {
    return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

export function TeamMemberCard({
    member,
    roleLabel,
    isCurrentUser = false,
    index = 0,
    onEditPermissions,
    onContact,
    onRemove,
    actionLoading,
}: TeamMemberCardProps) {
    const isOwner = member.isOwner || member.role === "owner" || member.role === "OWNER";
    const isPending = member.status === "invited" || member.status === "pending_verification";
    const canManage = !isOwner && !isCurrentUser;
    const lastLoginText = getLastLoginText(member.lastActive, member.status);
    const statusText = member.status === "suspended"
        ? "Suspended"
        : isPending
            ? "Pending"
            : member.verified
                ? "Verified"
                : "Active";

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.06, ease: [0.4, 0, 0.2, 1] }}
            className="group"
        >
            <div className={cn("overflow-hidden rounded-[34px] shadow-[0_28px_68px_rgba(0,0,0,0.28)]", member.status === "suspended" && "opacity-65")}>
                <div
                    className={cn(
                        "rounded-[34px] border border-white/8 bg-[#1f1f1d] px-5 pb-5 pt-4 text-white",
                        isOwner && "border-amber-400/30"
                    )}
                >
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/45">
                                Team Member
                            </p>
                        </div>
                        <div className="flex min-w-[124px] flex-col items-end gap-1 text-right">
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
                                {roleLabel}
                            </p>
                            <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                                <Clock3 size={11} />
                                <span>{lastLoginText}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                            {member.photoUrl ? (
                                <img
                                    src={member.photoUrl}
                                    alt={member.name}
                                    className="h-[66px] w-[66px] rounded-full border border-white/10 object-cover"
                                />
                            ) : (
                                <div className="flex h-[66px] w-[66px] items-center justify-center rounded-full border border-white/10 bg-[#31312d] text-white/70">
                                    {member.name.trim() ? (
                                        <span className="text-lg font-black tracking-[-0.04em] text-white">
                                            {getInitials(member.name)}
                                        </span>
                                    ) : (
                                        <User size={24} />
                                    )}
                                </div>
                            )}
                            {isOwner ? (
                                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-black ring-2 ring-[#1f1f1d]">
                                    <Crown size={12} />
                                </div>
                            ) : member.verified ? (
                                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-[#1f1f1d]">
                                    <ShieldCheck size={12} />
                                </div>
                            ) : null}
                        </div>

                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[22px] font-semibold tracking-[-0.04em] text-white">
                                {member.name}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/56">
                                <span className="truncate">{member.email}</span>
                                <span className="h-1 w-1 rounded-full bg-[#7be43b]" />
                                <span className="text-white/78">{statusText}</span>
                                {isCurrentUser ? <span className="text-white/56">(You)</span> : null}
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                        <button
                            onClick={onContact}
                            disabled={!onContact}
                            className="inline-flex h-12 items-center justify-center gap-2 rounded-[16px] bg-white/8 px-4 text-[11px] font-black uppercase tracking-[0.16em] text-white/82 transition-all hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                            <Mail size={14} />
                            Contact
                        </button>

                        <button
                            onClick={onRemove}
                            disabled={!canManage || !onRemove || actionLoading === member.id + "remove"}
                            className="inline-flex h-12 items-center justify-center gap-2 rounded-[16px] bg-white/8 px-4 text-[11px] font-black uppercase tracking-[0.16em] text-white/82 transition-all hover:bg-red-500/14 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                            <Trash2 size={14} />
                            Remove
                        </button>
                    </div>
                </div>

                {canManage && onEditPermissions ? (
                    <button
                        onClick={onEditPermissions}
                        className="flex h-16 w-full items-center justify-center border-x border-b border-[#66c433] bg-[#87e133] px-4 text-[12px] font-black uppercase tracking-[0.16em] text-[#162400] transition-all hover:bg-[#94ea45]"
                    >
                        Edit Permissions
                    </button>
                ) : (
                    <div className="flex h-16 w-full items-center justify-center border-x border-b border-[#66c433] bg-[#87e133] px-4 text-[12px] font-black uppercase tracking-[0.16em] text-[#162400]">
                        {isOwner ? "Owner Access" : roleLabel}
                    </div>
                )}
            </div>
        </motion.div>
    );
}
