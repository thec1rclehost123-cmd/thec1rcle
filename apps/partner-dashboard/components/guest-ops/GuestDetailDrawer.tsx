"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
    X, CheckCircle2, XCircle, Flag, RotateCcw, User, Phone, Ticket,
    Clock, MapPin, Loader2, AlertTriangle, MessageSquare, ChevronRight,
} from "lucide-react";
import { GuestSourceChip } from "@/components/guest-ops/chips/GuestSourceChip";
import { GuestStatusChip } from "@/components/guest-ops/chips/GuestStatusChip";
import type { GuestRecord, DenyReason, DenyBody, FlagBody } from "@/lib/types/guestOps";

const DENY_REASONS: { value: DenyReason; label: string }[] = [
    { value: "underage",               label: "Underage" },
    { value: "inappropriate_behavior", label: "Inappropriate behavior" },
    { value: "dress_code",             label: "Dress code" },
    { value: "capacity_full",          label: "Capacity full" },
    { value: "reservation_issue",      label: "Reservation issue" },
    { value: "security_concern",       label: "Security concern" },
    { value: "other_specify",          label: "Other (specify in notes)" },
];

type DrawerAction = "check-in" | "deny" | "flag" | "re-entry";

interface GuestDetailDrawerProps {
    guest: GuestRecord;
    eventId: string;
    venueId: string;
    isLocked: boolean;
    canManage: boolean;
    onClose: () => void;
    onAction: (action: string, body: object) => Promise<void> | void;
}

export function GuestDetailDrawer({
    guest,
    eventId,
    venueId,
    isLocked,
    canManage,
    onClose,
    onAction,
}: GuestDetailDrawerProps) {
    const [activeAction, setActiveAction] = useState<DrawerAction | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Deny form state
    const [denyReason, setDenyReason] = useState<DenyReason>("other_specify");
    const [denyNotes, setDenyNotes] = useState("");

    // Flag form state
    const [flagReason, setFlagReason] = useState("");
    const [flagSeverity, setFlagSeverity] = useState<"low" | "medium" | "high">("medium");
    const [flagNotes, setFlagNotes] = useState("");

    const handleSubmitAction = useCallback(async () => {
        if (!activeAction) return;
        setIsSubmitting(true);
        setError(null);
        try {
            let body: object = {};
            if (activeAction === "check-in") {
                body = { reason: "Manual check-in via guest detail" };
            } else if (activeAction === "deny") {
                if (!denyReason) { setError("Select a deny reason"); setIsSubmitting(false); return; }
                body = { reason: denyReason, notes: denyNotes } satisfies DenyBody;
            } else if (activeAction === "flag") {
                if (!flagReason.trim()) { setError("Enter a flag reason"); setIsSubmitting(false); return; }
                body = { reason: flagReason.trim(), severity: flagSeverity, notes: flagNotes } satisfies FlagBody;
            } else if (activeAction === "re-entry") {
                body = {};
            }
            await onAction(activeAction, body);
            setActiveAction(null);
        } catch {
            setError("Action failed. Try again.");
        } finally {
            setIsSubmitting(false);
        }
    }, [activeAction, denyReason, denyNotes, flagReason, flagSeverity, flagNotes, onAction]);

    const canCheckIn = !isLocked && !guest.checkedIn && guest.status === "expected" && canManage;
    const canUndoCheckIn = !isLocked && guest.checkedIn && canManage;
    const canDeny = !isLocked && !guest.checkedIn && canManage;
    const canFlag = !isLocked && canManage;
    const canReEntry = !isLocked && guest.checkedIn && canManage;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Drawer */}
            <div
                className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md flex flex-col shadow-2xl border-l overflow-hidden"
                style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
            >
                {/* Header */}
                <div
                    className="flex items-center gap-3 px-5 py-4 border-b shrink-0"
                    style={{ borderColor: "var(--border-subtle)" }}
                >
                    <div className="flex-1 min-w-0">
                        <h2 className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
                            {guest.displayName}
                        </h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <GuestStatusChip status={guest.status} size="xs" />
                            <GuestSourceChip source={guest.source} size="xs" />
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-[var(--bg-fill)] text-[var(--text-tertiary)]"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto">
                    {/* Action panel */}
                    {!isLocked && canManage && !activeAction && (
                        <div
                            className="px-5 py-3 border-b grid grid-cols-2 gap-2"
                            style={{ borderColor: "var(--border-subtle)" }}
                        >
                            {canCheckIn && (
                                <ActionButton
                                    icon={<CheckCircle2 size={14} />}
                                    label="Check In"
                                    color="green"
                                    onClick={() => setActiveAction("check-in")}
                                />
                            )}
                            {canUndoCheckIn && (
                                <ActionButton
                                    icon={<RotateCcw size={14} />}
                                    label="Undo Check-In"
                                    color="slate"
                                    onClick={() => setActiveAction("re-entry")}
                                />
                            )}
                            {canDeny && (
                                <ActionButton
                                    icon={<XCircle size={14} />}
                                    label="Deny Entry"
                                    color="red"
                                    onClick={() => setActiveAction("deny")}
                                />
                            )}
                            {canFlag && (
                                <ActionButton
                                    icon={<Flag size={14} />}
                                    label="Flag Guest"
                                    color="amber"
                                    onClick={() => setActiveAction("flag")}
                                />
                            )}
                            {canReEntry && (
                                <ActionButton
                                    icon={<ChevronRight size={14} />}
                                    label="Re-Entry"
                                    color="blue"
                                    onClick={() => setActiveAction("re-entry")}
                                />
                            )}
                        </div>
                    )}

                    {/* Active action form */}
                    {activeAction && (
                        <div
                            className="px-5 py-4 border-b space-y-3"
                            style={{ background: "var(--bg-fill)", borderColor: "var(--border-subtle)" }}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[13px] font-semibold text-[var(--text-primary)] capitalize">
                                    {activeAction === "check-in" ? "Confirm Check-In" :
                                     activeAction === "deny" ? "Deny Entry" :
                                     activeAction === "flag" ? "Flag Guest" : "Re-Entry"}
                                </span>
                                <button
                                    onClick={() => { setActiveAction(null); setError(null); }}
                                    className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                                >
                                    Cancel
                                </button>
                            </div>

                            {activeAction === "deny" && (
                                <>
                                    <div>
                                        <label className="block text-[11px] font-medium text-[var(--text-tertiary)] mb-1.5">Reason *</label>
                                        <select
                                            value={denyReason}
                                            onChange={e => setDenyReason(e.target.value as DenyReason)}
                                            className="w-full px-3 py-2 text-[13px] rounded-lg border bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                                            style={{ borderColor: "var(--border-subtle)" }}
                                        >
                                            {DENY_REASONS.map(r => (
                                                <option key={r.value} value={r.value}>{r.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-[var(--text-tertiary)] mb-1.5">Notes (optional)</label>
                                        <textarea
                                            value={denyNotes}
                                            onChange={e => setDenyNotes(e.target.value)}
                                            rows={2}
                                            placeholder="Additional context..."
                                            className="w-full px-3 py-2 text-[13px] rounded-lg border bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
                                            style={{ borderColor: "var(--border-subtle)" }}
                                        />
                                    </div>
                                </>
                            )}

                            {activeAction === "flag" && (
                                <>
                                    <div>
                                        <label className="block text-[11px] font-medium text-[var(--text-tertiary)] mb-1.5">Severity</label>
                                        <div className="flex gap-2">
                                            {(["low", "medium", "high"] as const).map(s => (
                                                <button
                                                    key={s}
                                                    onClick={() => setFlagSeverity(s)}
                                                    className={cn(
                                                        "flex-1 py-1.5 rounded-lg text-[12px] font-medium transition-all capitalize",
                                                        flagSeverity === s
                                                            ? s === "high" ? "bg-red-500 text-white"
                                                              : s === "medium" ? "bg-amber-500 text-white"
                                                              : "bg-blue-500 text-white"
                                                            : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-fill)]"
                                                    )}
                                                    style={{ border: "1px solid var(--border-subtle)" }}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-[var(--text-tertiary)] mb-1.5">Reason *</label>
                                        <input
                                            type="text"
                                            value={flagReason}
                                            onChange={e => setFlagReason(e.target.value)}
                                            placeholder="Brief reason for flag..."
                                            className="w-full px-3 py-2 text-[13px] rounded-lg border bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                                            style={{ borderColor: "var(--border-subtle)" }}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-[var(--text-tertiary)] mb-1.5">Notes (optional)</label>
                                        <textarea
                                            value={flagNotes}
                                            onChange={e => setFlagNotes(e.target.value)}
                                            rows={2}
                                            placeholder="Additional context..."
                                            className="w-full px-3 py-2 text-[13px] rounded-lg border bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
                                            style={{ borderColor: "var(--border-subtle)" }}
                                        />
                                    </div>
                                </>
                            )}

                            {activeAction === "check-in" && (
                                <p className="text-[13px] text-[var(--text-secondary)]">
                                    Manually check in <strong>{guest.displayName}</strong>. This will be logged as a manual dashboard override.
                                </p>
                            )}

                            {activeAction === "re-entry" && (
                                <p className="text-[13px] text-[var(--text-secondary)]">
                                    Allow re-entry for <strong>{guest.displayName}</strong>. This will be logged and may require re-entry to be enabled in event rules.
                                </p>
                            )}

                            {error && (
                                <div className="flex items-center gap-1.5 text-[12px] text-red-500">
                                    <AlertTriangle size={12} /> {error}
                                </div>
                            )}

                            <button
                                onClick={handleSubmitAction}
                                disabled={isSubmitting}
                                className={cn(
                                    "w-full py-2.5 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 transition-all",
                                    activeAction === "check-in" ? "bg-green-500 hover:bg-green-600 text-white" :
                                    activeAction === "deny" ? "bg-red-500 hover:bg-red-600 text-white" :
                                    activeAction === "flag" ? "bg-amber-500 hover:bg-amber-600 text-white" :
                                    "bg-[var(--accent)] hover:brightness-110 text-white"
                                )}
                            >
                                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
                                Confirm
                            </button>
                        </div>
                    )}

                    {/* Details */}
                    <div className="px-5 py-4 space-y-5">
                        {/* Identity */}
                        <Section title="Identity">
                            <DetailRow icon={<User size={13} />} label="Name" value={guest.displayName} />
                            {guest.maskedPhone && (
                                <DetailRow icon={<Phone size={13} />} label="Phone" value={guest.maskedPhone} mono />
                            )}
                            <DetailRow icon={<User size={13} />} label="Guest Type" value={
                                <GuestSourceChip source={guest.guestType as any} size="xs" />
                            } />
                            <DetailRow icon={<User size={13} />} label="Source" value={
                                <GuestSourceChip source={guest.source} size="xs" />
                            } />
                        </Section>

                        {/* Ticket Info */}
                        {(guest.ticketId || guest.ticketTierName || guest.orderId) && (
                            <Section title="Ticket">
                                {guest.ticketTierName && (
                                    <DetailRow icon={<Ticket size={13} />} label="Tier" value={guest.ticketTierName} />
                                )}
                                {guest.ticketId && (
                                    <DetailRow icon={<Ticket size={13} />} label="Ticket ID" value={guest.ticketId} mono />
                                )}
                                {guest.orderId && (
                                    <DetailRow icon={<Ticket size={13} />} label="Order ID" value={guest.orderId} mono />
                                )}
                            </Section>
                        )}

                        {/* Attribution */}
                        {(guest.hostName || guest.promoterName || guest.tableName) && (
                            <Section title="Attribution">
                                {guest.hostName && (
                                    <DetailRow icon={<User size={13} />} label="Host" value={guest.hostName} />
                                )}
                                {guest.promoterName && (
                                    <DetailRow icon={<User size={13} />} label="Promoter" value={guest.promoterName} />
                                )}
                                {guest.tableName && (
                                    <DetailRow icon={<MapPin size={13} />} label="Table" value={guest.tableName} />
                                )}
                            </Section>
                        )}

                        {/* Check-In Info */}
                        {guest.checkedIn && (
                            <Section title="Check-In">
                                {guest.checkedInAt && (
                                    <DetailRow icon={<Clock size={13} />} label="Time" value={
                                        new Date(guest.checkedInAt).toLocaleString("en-IN", {
                                            weekday: "short", month: "short", day: "numeric",
                                            hour: "2-digit", minute: "2-digit",
                                        })
                                    } />
                                )}
                                {guest.checkInSource && (
                                    <DetailRow icon={<CheckCircle2 size={13} />} label="Source" value={guest.checkInSource.replace(/_/g, " ")} />
                                )}
                                {guest.checkInDeviceName && (
                                    <DetailRow icon={<CheckCircle2 size={13} />} label="Device" value={guest.checkInDeviceName} />
                                )}
                                {guest.checkInOperator && (
                                    <DetailRow icon={<User size={13} />} label="Operator" value={guest.checkInOperator} />
                                )}
                            </Section>
                        )}

                        {/* Notes */}
                        {guest.notes && (
                            <Section title="Notes">
                                <div className="flex items-start gap-2 text-[13px] text-[var(--text-secondary)]">
                                    <MessageSquare size={13} className="text-[var(--text-tertiary)] mt-0.5 shrink-0" />
                                    <span className="leading-relaxed">{guest.notes}</span>
                                </div>
                            </Section>
                        )}

                        {/* Metadata */}
                        <Section title="Metadata">
                            <DetailRow icon={<User size={13} />} label="Added By" value={guest.addedByName || "System"} />
                            <DetailRow icon={<Clock size={13} />} label="Added At" value={
                                new Date(guest.addedAt).toLocaleString("en-IN", {
                                    weekday: "short", month: "short", day: "numeric",
                                    hour: "2-digit", minute: "2-digit",
                                })
                            } />
                        </Section>
                    </div>
                </div>
            </div>
        </>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-2">{title}</div>
            <div
                className="rounded-xl border divide-y overflow-hidden"
                style={{ borderColor: "var(--border-subtle)" }}
            >
                {children}
            </div>
        </div>
    );
}

function DetailRow({ icon, label, value, mono }: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    mono?: boolean;
}) {
    return (
        <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: "var(--bg-fill)" }}>
            <span className="text-[var(--text-tertiary)] shrink-0">{icon}</span>
            <span className="text-[12px] text-[var(--text-tertiary)] w-24 shrink-0">{label}</span>
            <span className={cn(
                "text-[13px] text-[var(--text-primary)] truncate",
                mono && "font-mono text-[12px]"
            )}>
                {value}
            </span>
        </div>
    );
}

function ActionButton({ icon, label, color, onClick }: {
    icon: React.ReactNode;
    label: string;
    color: "green" | "red" | "amber" | "blue" | "slate";
    onClick: () => void;
}) {
    const colorMap = {
        green: "text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 dark:text-green-400",
        red:   "text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400",
        amber: "text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 dark:text-amber-400",
        blue:  "text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-400",
        slate: "text-slate-600 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800/80 dark:text-slate-400",
    };
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all",
                colorMap[color]
            )}
        >
            {icon}
            {label}
        </button>
    );
}
