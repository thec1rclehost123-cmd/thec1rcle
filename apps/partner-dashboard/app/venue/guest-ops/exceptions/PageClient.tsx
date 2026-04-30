"use client";

import { useState, useEffect, useCallback } from "react";
import { GuestOpsShell } from "@/components/guest-ops/GuestOpsShell";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useGuestOpsShellData } from "@/lib/hooks/useGuestOpsShellData";
import { cn } from "@/lib/utils";
import {
    AlertTriangle, CheckCircle2, XCircle, Flag, Clock, Loader2,
    ScanLine, ArrowRight, X, ChevronDown,
} from "lucide-react";
import type { ExceptionRecord, ExceptionType, ExceptionStatus, ResolveExceptionBody } from "@/lib/types/guestOps";

const STATUS_TABS: { value: ExceptionStatus | "all"; label: string }[] = [
    { value: "all",       label: "All" },
    { value: "open",      label: "Open" },
    { value: "escalated", label: "Escalated" },
    { value: "resolved",  label: "Resolved" },
    { value: "dismissed", label: "Dismissed" },
];

const EXCEPTION_TYPE_LABELS: Record<ExceptionType, string> = {
    duplicate_scan:           "Duplicate Scan",
    invalid_ticket:           "Invalid Ticket",
    cancelled_ticket_scan:    "Cancelled Ticket",
    guest_not_found:          "Guest Not Found",
    name_mismatch:            "Name Mismatch",
    phone_mismatch:           "Phone Mismatch",
    host_over_allocation:     "Host Over-Allocation",
    promoter_over_allocation: "Promoter Over-Allocation",
    manual_add_cap_exceeded:  "Manual Add Cap Exceeded",
    capacity_hard_limit:      "Capacity Hard Limit",
    re_entry_blocked:         "Re-Entry Blocked",
};

const EXCEPTION_SEVERITY: Record<ExceptionType, "high" | "medium" | "low"> = {
    duplicate_scan:           "medium",
    invalid_ticket:           "high",
    cancelled_ticket_scan:    "high",
    guest_not_found:          "medium",
    name_mismatch:            "low",
    phone_mismatch:           "low",
    host_over_allocation:     "medium",
    promoter_over_allocation: "medium",
    manual_add_cap_exceeded:  "high",
    capacity_hard_limit:      "high",
    re_entry_blocked:         "medium",
};

const RESOLVE_ACTIONS: { value: ResolveExceptionBody["action"]; label: string; color: string }[] = [
    { value: "allowed_entry", label: "Allow Entry",   color: "green" },
    { value: "denied",        label: "Deny Entry",    color: "red" },
    { value: "dismissed",     label: "Dismiss",       color: "slate" },
    { value: "escalated",     label: "Escalate",      color: "amber" },
];

export default function ExceptionsPageClient() {
    const { hasPermission } = useDashboardAuth();

    const {
        eventId, venueId, events, summary, openExceptions,
        isLoading: shellLoading, authHeaders,
    } = useGuestOpsShellData();

    // Exception state
    const [exceptions, setExceptions] = useState<ExceptionRecord[]>([]);
    const [statusFilter, setStatusFilter] = useState<ExceptionStatus | "all">("open");
    const [isLoading, setIsLoading] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const [resolveForm, setResolveForm] = useState<{ action: ResolveExceptionBody["action"]; reason: string; notes: string }>({
        action: "dismissed", reason: "", notes: "",
    });
    const [resolveError, setResolveError] = useState<string | null>(null);

    const canManage = hasPermission("MANAGE_GUEST_OPS");

    const fetchExceptions = useCallback(async () => {
        if (!eventId || !venueId) return;
        setIsLoading(true);
        try {
            const params = new URLSearchParams({ venueId });
            if (statusFilter !== "all") params.set("status", statusFilter);
            const res = await fetch(`/api/partners/venues/guest-ops/${eventId}/exceptions?${params}`, { headers: authHeaders() });
            if (res.ok) {
                const d = await res.json();
                setExceptions(d.exceptions ?? []);
            }
        } finally {
            setIsLoading(false);
        }
    }, [eventId, venueId, statusFilter, authHeaders]);

    useEffect(() => {
        fetchExceptions();
    }, [fetchExceptions]);

    const handleResolve = useCallback(async (exceptionId: string) => {
        if (!resolveForm.reason.trim()) { setResolveError("Resolution reason is required"); return; }
        setResolvingId(exceptionId);
        setResolveError(null);
        try {
            const body: ResolveExceptionBody = {
                action: resolveForm.action,
                reason: resolveForm.reason.trim(),
                notes: resolveForm.notes.trim() || undefined,
            };
            const res = await fetch(
                `/api/partners/venues/guest-ops/${eventId}/exceptions/${exceptionId}/resolve?venueId=${venueId}`,
                { method: "POST", headers: authHeaders(), body: JSON.stringify(body) }
            );
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                setResolveError(d.error ?? "Failed to resolve");
                return;
            }
            setExpandedId(null);
            setResolveForm({ action: "dismissed", reason: "", notes: "" });
            await fetchExceptions();
        } finally {
            setResolvingId(null);
        }
    }, [resolveForm, eventId, venueId, authHeaders, fetchExceptions]);

    const isLocked = summary?.isLocked ?? false;

    return (
        <GuestOpsShell
            events={events}
            summary={summary}
            openExceptions={openExceptions}
            isLoading={shellLoading && !summary}
        >
            {!eventId ? (
                <NoEventState />
            ) : (
                <div className="space-y-4">
                    {/* Header + filter tabs */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={16} className="text-amber-500" />
                            <h2 className="text-[15px] font-semibold text-[var(--v-text-primary)]">Exceptions</h2>
                            {openExceptions > 0 && (
                                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5">
                                    {openExceptions > 99 ? "99+" : openExceptions}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-1 ml-auto overflow-x-auto scrollbar-hide">
                            {STATUS_TABS.map(tab => (
                                <button
                                    key={tab.value}
                                    onClick={() => setStatusFilter(tab.value)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-xl text-[12px] font-medium whitespace-nowrap transition-all",
                                        statusFilter === tab.value
                                            ? "bg-[var(--v-orange)] text-white"
                                            : "bg-[var(--v-elevated)] text-[var(--v-text-secondary)] hover:bg-[var(--v-card-hover)]"
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Exception list */}
                    {isLoading ? (
                        <ExceptionSkeleton />
                    ) : exceptions.length === 0 ? (
                        <EmptyExceptions status={statusFilter} />
                    ) : (
                        <div className="space-y-2">
                            {exceptions.map(exc => (
                                <ExceptionCard
                                    key={exc.exceptionId}
                                    exception={exc}
                                    isExpanded={expandedId === exc.exceptionId}
                                    isLocked={isLocked}
                                    canManage={canManage}
                                    isResolving={resolvingId === exc.exceptionId}
                                    resolveForm={resolveForm}
                                    resolveError={resolveError}
                                    onToggle={() => {
                                        setExpandedId(prev => prev === exc.exceptionId ? null : exc.exceptionId);
                                        setResolveError(null);
                                    }}
                                    onResolveFormChange={setResolveForm}
                                    onResolve={() => handleResolve(exc.exceptionId)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </GuestOpsShell>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ExceptionCard({
    exception, isExpanded, isLocked, canManage, isResolving,
    resolveForm, resolveError, onToggle, onResolveFormChange, onResolve,
}: {
    exception: ExceptionRecord;
    isExpanded: boolean;
    isLocked: boolean;
    canManage: boolean;
    isResolving: boolean;
    resolveForm: { action: ResolveExceptionBody["action"]; reason: string; notes: string };
    resolveError: string | null;
    onToggle: () => void;
    onResolveFormChange: (f: typeof resolveForm) => void;
    onResolve: () => void;
}) {
    const severity = EXCEPTION_SEVERITY[exception.type] ?? "medium";
    const isOpen = exception.status === "open" || exception.status === "escalated";

    const severityConfig = {
        high:   { border: "border-red-200 dark:border-red-800/50",   badge: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" },
        medium: { border: "border-amber-200 dark:border-amber-800/50", badge: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" },
        low:    { border: "border-blue-200 dark:border-blue-800/50",  badge: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" },
    };
    const cfg = severityConfig[severity];

    return (
        <div
            className={cn("rounded-2xl border overflow-hidden transition-all", isOpen ? cfg.border : "")}
            style={!isOpen ? { borderColor: "var(--v-border)" } : {}}
        >
            {/* Summary row */}
            <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--v-card-hover)] transition-colors"
                style={{ background: "var(--v-card)" }}
                onClick={onToggle}
            >
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide", cfg.badge)}>
                    {severity}
                </span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-[var(--v-text-primary)]">
                            {EXCEPTION_TYPE_LABELS[exception.type] ?? exception.type}
                        </span>
                        {exception.guestDisplayName && (
                            <span className="text-[12px] text-[var(--v-text-muted)]">
                                · {exception.guestDisplayName}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] text-[var(--v-text-muted)]">
                            {exception.triggeredByName}
                        </span>
                        <span className="text-[11px] text-[var(--v-text-muted)]">
                            {new Date(exception.triggeredAt).toLocaleString("en-IN", {
                                month: "short", day: "numeric",
                                hour: "2-digit", minute: "2-digit",
                            })}
                        </span>
                    </div>
                </div>
                <StatusBadge status={exception.status} />
                <ChevronDown
                    size={14}
                    className={cn("text-[var(--v-text-muted)] shrink-0 transition-transform", isExpanded && "rotate-180")}
                />
            </button>

            {/* Expanded */}
            {isExpanded && (
                <div
                    className="px-4 pb-4 space-y-3"
                    style={{ background: "var(--v-elevated)", borderTop: "1px solid var(--v-border)" }}
                >
                    {/* Context */}
                    {exception.context && Object.keys(exception.context).length > 0 && (
                        <div className="pt-3">
                            <div className="text-[11px] font-semibold text-[var(--v-text-muted)] uppercase tracking-wide mb-2">Context</div>
                            <div className="text-[12px] text-[var(--v-text-secondary)] space-y-0.5">
                                {Object.entries(exception.context).map(([k, v]) => (
                                    <div key={k} className="flex gap-2">
                                        <span className="text-[var(--v-text-muted)] w-28 shrink-0">{k}</span>
                                        <span className="font-mono">{String(v)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Resolution info (if already resolved) */}
                    {exception.resolution && (
                        <div className="pt-2">
                            <div className="text-[11px] font-semibold text-[var(--v-text-muted)] uppercase tracking-wide mb-2">Resolution</div>
                            <div className="text-[12px] text-[var(--v-text-secondary)] space-y-0.5">
                                <div><span className="text-[var(--v-text-muted)]">Action: </span>{exception.resolution.action}</div>
                                <div><span className="text-[var(--v-text-muted)]">By: </span>{exception.resolution.resolvedByName}</div>
                                <div><span className="text-[var(--v-text-muted)]">Reason: </span>{exception.resolution.reason}</div>
                                {exception.resolution.notes && (
                                    <div><span className="text-[var(--v-text-muted)]">Notes: </span>{exception.resolution.notes}</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Resolve form — only for open/escalated */}
                    {isOpen && !isLocked && canManage && (
                        <div className="pt-2 space-y-3">
                            <div className="text-[11px] font-semibold text-[var(--v-text-muted)] uppercase tracking-wide">Resolve</div>

                            {/* Action buttons */}
                            <div className="grid grid-cols-2 gap-1.5">
                                {RESOLVE_ACTIONS.map(action => (
                                    <button
                                        key={action.value}
                                        onClick={() => onResolveFormChange({ ...resolveForm, action: action.value })}
                                        className={cn(
                                            "py-2 rounded-xl text-[12px] font-medium transition-all border",
                                            resolveForm.action === action.value
                                                ? action.color === "green" ? "bg-green-500 text-white border-green-500" :
                                                  action.color === "red"   ? "bg-red-500 text-white border-red-500" :
                                                  action.color === "amber" ? "bg-amber-500 text-white border-amber-500" :
                                                  "bg-slate-500 text-white border-slate-500"
                                                : "bg-[var(--v-card)] text-[var(--v-text-secondary)] hover:bg-[var(--v-card-hover)]"
                                        )}
                                        style={resolveForm.action !== action.value ? { borderColor: "var(--v-border)" } : {}}
                                    >
                                        {action.label}
                                    </button>
                                ))}
                            </div>

                            {/* Reason */}
                            <input
                                type="text"
                                value={resolveForm.reason}
                                onChange={e => onResolveFormChange({ ...resolveForm, reason: e.target.value })}
                                placeholder="Resolution reason (required)..."
                                className="w-full px-3 py-2 text-[13px] rounded-xl border bg-[var(--v-card)] text-[var(--v-text-primary)] placeholder:text-[var(--v-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--v-orange)]"
                                style={{ borderColor: "var(--v-border)" }}
                            />

                            {/* Notes */}
                            <textarea
                                value={resolveForm.notes}
                                onChange={e => onResolveFormChange({ ...resolveForm, notes: e.target.value })}
                                rows={2}
                                placeholder="Additional notes (optional)..."
                                className="w-full px-3 py-2 text-[13px] rounded-xl border bg-[var(--v-card)] text-[var(--v-text-primary)] placeholder:text-[var(--v-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--v-orange)] resize-none"
                                style={{ borderColor: "var(--v-border)" }}
                            />

                            {resolveError && (
                                <div className="flex items-center gap-1.5 text-[12px] text-red-500">
                                    <AlertTriangle size={12} /> {resolveError}
                                </div>
                            )}

                            <button
                                onClick={onResolve}
                                disabled={isResolving}
                                className="w-full py-2.5 rounded-xl bg-[var(--v-orange)] text-white text-[13px] font-semibold flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50"
                            >
                                {isResolving
                                    ? <Loader2 size={14} className="animate-spin" />
                                    : <ArrowRight size={14} />}
                                Submit Resolution
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: ExceptionStatus }) {
    const cfg: Record<ExceptionStatus, { label: string; className: string }> = {
        open:      { label: "Open",      className: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
        escalated: { label: "Escalated", className: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
        resolved:  { label: "Resolved",  className: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
        dismissed: { label: "Dismissed", className: "bg-slate-100 dark:bg-slate-800/50 text-slate-500" },
    };
    const c = cfg[status] ?? cfg.dismissed;
    return (
        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0", c.className)}>
            {c.label}
        </span>
    );
}

function ExceptionSkeleton() {
    return (
        <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-2xl border animate-pulse" style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }} />
            ))}
        </div>
    );
}

function EmptyExceptions({ status }: { status: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckCircle2 size={36} className="text-green-500 mb-3" />
            <p className="text-[14px] font-medium text-[var(--v-text-primary)] mb-1">
                No {status === "all" ? "" : status} exceptions
            </p>
            <p className="text-[12px] text-[var(--v-text-muted)]">
                {status === "open" ? "All clear — no open exceptions." : "Nothing to show for this filter."}
            </p>
        </div>
    );
}

function NoEventState() {
    return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <AlertTriangle size={40} className="text-amber-500 mb-4" />
            <h3 className="text-[16px] font-semibold text-[var(--v-text-primary)] mb-2">Select an event</h3>
            <p className="text-[13px] text-[var(--v-text-muted)] max-w-xs">
                Choose an event from the selector above to view exceptions.
            </p>
        </div>
    );
}
