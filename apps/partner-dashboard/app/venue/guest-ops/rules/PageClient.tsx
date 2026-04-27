"use client";

import { useState, useEffect, useCallback } from "react";
import { GuestOpsShell } from "@/components/guest-ops/GuestOpsShell";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useGuestOpsShellData } from "@/lib/hooks/useGuestOpsShellData";
import { cn } from "@/lib/utils";
import {
    Settings2, Save, Loader2, AlertTriangle, CheckCircle2, Lock,
    Users, Plus, Minus, ScanLine,
} from "lucide-react";
import type { GuestRules, GuestAllocation } from "@/lib/types/guestOps";

type ToggleField =
    | "entryCutoffEnabled"
    | "reEntryEnabled"
    | "compApprovalRequired"
    | "vipApprovalRequired"
    | "manualCheckInEnabled"
    | "manualOverrideRequiresReason"
    | "exportEnabled";

export default function GuestRulesPageClient() {
    const { profile, hasPermission } = useDashboardAuth();
    const role = profile?.activeMembership?.role ?? "";

    const {
        eventId, venueId, events, summary, openExceptions,
        isLoading: shellLoading, authHeaders,
    } = useGuestOpsShellData();

    // Rules state
    const [rules, setRules] = useState<GuestRules | null>(null);
    const [draftRules, setDraftRules] = useState<Partial<GuestRules>>({});
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

    // Allocations state
    const [allocations, setAllocations] = useState<GuestAllocation[]>([]);
    const [allocLoading, setAllocLoading] = useState(false);

    const canManage = hasPermission("MANAGE_GUEST_OPS");
    const isOwner = role === "OWNER";

    const fetchRulesAndAllocations = useCallback(async () => {
        if (!eventId || !venueId) return;
        const [rulesRes, allocRes] = await Promise.all([
            fetch(`/api/venue/guest-ops/${eventId}/guest-rules?venueId=${venueId}`, { headers: authHeaders() }),
            fetch(`/api/venue/guest-ops/${eventId}/host-allocations/all?venueId=${venueId}`, { headers: authHeaders() }),
        ]);
        if (rulesRes.ok) {
            const d = await rulesRes.json();
            setRules(d);
            setDraftRules(d);
        }
        if (allocRes.ok) {
            const d = await allocRes.json();
            setAllocations([...(d.hostAllocations ?? []), ...(d.promoterAllocations ?? [])]);
        }
    }, [eventId, venueId, authHeaders]);

    useEffect(() => {
        fetchRulesAndAllocations();
    }, [fetchRulesAndAllocations]);

    const updateDraft = useCallback(<K extends keyof GuestRules>(key: K, value: GuestRules[K]) => {
        setDraftRules(prev => ({ ...prev, [key]: value }));
        setIsDirty(true);
        setSaveStatus("idle");
    }, []);

    const handleSave = useCallback(async () => {
        if (!eventId || !venueId || !isDirty) return;
        setIsSaving(true);
        setSaveStatus("idle");
        try {
            const res = await fetch(`/api/venue/guest-ops/${eventId}/guest-rules?venueId=${venueId}`, {
                method: "PATCH",
                headers: authHeaders(),
                body: JSON.stringify(draftRules),
            });
            if (res.ok) {
                const d = await res.json();
                setRules(d);
                setDraftRules(d);
                setIsDirty(false);
                setSaveStatus("success");
                setTimeout(() => setSaveStatus("idle"), 3000);
            } else {
                setSaveStatus("error");
            }
        } finally {
            setIsSaving(false);
        }
    }, [eventId, venueId, isDirty, draftRules, authHeaders]);

    const isLocked = summary?.isLocked ?? rules?.isLocked ?? false;
    const canEdit = canManage && !isLocked;

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
                <div className="max-w-2xl space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Settings2 size={16} className="text-[var(--v-text-muted)]" />
                            <h2 className="text-[15px] font-semibold text-[var(--v-text-primary)]">Guest Rules</h2>
                        </div>
                        {isDirty && canEdit && (
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--v-orange)] text-white text-[13px] font-semibold hover:brightness-110 disabled:opacity-60"
                            >
                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Save Changes
                            </button>
                        )}
                        {saveStatus === "success" && (
                            <div className="ml-auto flex items-center gap-1.5 text-[12px] text-green-600 dark:text-green-400">
                                <CheckCircle2 size={13} /> Saved
                            </div>
                        )}
                        {saveStatus === "error" && (
                            <div className="ml-auto flex items-center gap-1.5 text-[12px] text-red-500">
                                <AlertTriangle size={13} /> Save failed
                            </div>
                        )}
                    </div>

                    {isLocked && (
                        <div
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] text-[var(--v-text-secondary)]"
                            style={{ background: "var(--v-elevated)" }}
                        >
                            <Lock size={14} />
                            This event is locked. Rules are read-only.
                        </div>
                    )}

                    {!rules ? (
                        <RulesSkeleton />
                    ) : (
                        <>
                            {/* Entry Policies */}
                            <RulesSection title="Entry Policies">
                                <ToggleRow
                                    label="Entry Cutoff"
                                    description="Stop admissions at a set time"
                                    checked={draftRules.entryCutoffEnabled ?? false}
                                    onChange={v => updateDraft("entryCutoffEnabled", v)}
                                    disabled={!canEdit}
                                />
                                {draftRules.entryCutoffEnabled && (
                                    <div className="pl-4">
                                        <label className="block text-[11px] text-[var(--v-text-muted)] mb-1">Cutoff Time</label>
                                        <input
                                            type="time"
                                            value={draftRules.entryCutoffTime ?? ""}
                                            onChange={e => updateDraft("entryCutoffTime", e.target.value)}
                                            disabled={!canEdit}
                                            className="px-3 py-1.5 text-[13px] rounded-lg border bg-[var(--v-elevated)] text-[var(--v-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--v-orange)] disabled:opacity-50"
                                            style={{ borderColor: "var(--v-border)" }}
                                        />
                                    </div>
                                )}
                                <ToggleRow
                                    label="Re-Entry"
                                    description="Allow guests to re-enter after checking out"
                                    checked={draftRules.reEntryEnabled ?? false}
                                    onChange={v => updateDraft("reEntryEnabled", v)}
                                    disabled={!canEdit}
                                />
                                {draftRules.reEntryEnabled && (
                                    <div className="pl-4">
                                        <label className="block text-[11px] text-[var(--v-text-muted)] mb-1">Re-Entry Window (minutes)</label>
                                        <input
                                            type="number"
                                            min={5}
                                            max={480}
                                            value={draftRules.reEntryWindowMins ?? 60}
                                            onChange={e => updateDraft("reEntryWindowMins", Number(e.target.value))}
                                            disabled={!canEdit}
                                            className="w-24 px-3 py-1.5 text-[13px] rounded-lg border bg-[var(--v-elevated)] text-[var(--v-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--v-orange)] disabled:opacity-50"
                                            style={{ borderColor: "var(--v-border)" }}
                                        />
                                    </div>
                                )}
                                {draftRules.minimumAgeRule !== undefined && (
                                    <div>
                                        <label className="block text-[11px] text-[var(--v-text-muted)] mb-1">Minimum Age</label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={21}
                                            value={draftRules.minimumAgeRule ?? 0}
                                            onChange={e => updateDraft("minimumAgeRule", Number(e.target.value))}
                                            disabled={!canEdit}
                                            className="w-24 px-3 py-1.5 text-[13px] rounded-lg border bg-[var(--v-elevated)] text-[var(--v-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--v-orange)] disabled:opacity-50"
                                            style={{ borderColor: "var(--v-border)" }}
                                        />
                                    </div>
                                )}
                            </RulesSection>

                            {/* Approval Gates */}
                            <RulesSection title="Approval Gates">
                                <ToggleRow
                                    label="Comp Approval Required"
                                    description="Comp guests need manager approval before check-in"
                                    checked={draftRules.compApprovalRequired ?? false}
                                    onChange={v => updateDraft("compApprovalRequired", v)}
                                    disabled={!canEdit}
                                />
                                <ToggleRow
                                    label="VIP Approval Required"
                                    description="VIP guests need manager approval before check-in"
                                    checked={draftRules.vipApprovalRequired ?? false}
                                    onChange={v => updateDraft("vipApprovalRequired", v)}
                                    disabled={!canEdit}
                                />
                            </RulesSection>

                            {/* Manual Operations */}
                            <RulesSection title="Manual Operations">
                                <ToggleRow
                                    label="Allow Manual Check-In"
                                    description="Staff can manually check in guests from dashboard"
                                    checked={draftRules.manualCheckInEnabled ?? true}
                                    onChange={v => updateDraft("manualCheckInEnabled", v)}
                                    disabled={!canEdit}
                                />
                                <ToggleRow
                                    label="Overrides Require Reason"
                                    description="All manual overrides must include a written reason"
                                    checked={draftRules.manualOverrideRequiresReason ?? false}
                                    onChange={v => updateDraft("manualOverrideRequiresReason", v)}
                                    disabled={!canEdit}
                                />
                                <NumberRow
                                    label="Manual Add Cap"
                                    description="Max guests staff can manually add to the list"
                                    value={draftRules.manualAddCap ?? 50}
                                    min={0}
                                    max={500}
                                    onChange={v => updateDraft("manualAddCap", v)}
                                    disabled={!canEdit}
                                />
                                <NumberRow
                                    label="Staff Add Cap"
                                    description="Subset of manual add cap for security staff"
                                    value={draftRules.staffAddCap ?? 10}
                                    min={0}
                                    max={draftRules.manualAddCap ?? 500}
                                    onChange={v => updateDraft("staffAddCap", v)}
                                    disabled={!canEdit}
                                />
                            </RulesSection>

                            {/* Export Settings — OWNER only */}
                            {isOwner && (
                                <RulesSection title="Export Settings">
                                    <ToggleRow
                                        label="Export Enabled"
                                        description="Allow owners to export guest list"
                                        checked={draftRules.exportEnabled ?? true}
                                        onChange={v => updateDraft("exportEnabled", v)}
                                        disabled={!canEdit}
                                    />
                                    {draftRules.exportEnabled && (
                                        <>
                                            <div className="flex items-center gap-3 px-4 py-3">
                                                <div className="flex-1">
                                                    <div className="text-[13px] font-medium text-[var(--v-text-primary)]">PII Level</div>
                                                    <div className="text-[11px] text-[var(--v-text-muted)]">What personal data is included in exports</div>
                                                </div>
                                                <select
                                                    value={draftRules.exportPiiLevel ?? "masked"}
                                                    onChange={e => updateDraft("exportPiiLevel", e.target.value as GuestRules["exportPiiLevel"])}
                                                    disabled={!canEdit}
                                                    className="px-3 py-1.5 text-[13px] rounded-lg border bg-[var(--v-elevated)] text-[var(--v-text-primary)] focus:outline-none disabled:opacity-50"
                                                    style={{ borderColor: "var(--v-border)" }}
                                                >
                                                    <option value="no_pii">No PII</option>
                                                    <option value="masked">Masked</option>
                                                    <option value="full">Full PII</option>
                                                </select>
                                            </div>
                                        </>
                                    )}
                                </RulesSection>
                            )}

                            {/* Allocations */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Users size={14} className="text-[var(--v-text-muted)]" />
                                    <h3 className="text-[14px] font-semibold text-[var(--v-text-primary)]">Allocations</h3>
                                    {allocLoading && <Loader2 size={12} className="animate-spin text-[var(--v-text-muted)]" />}
                                </div>

                                {allocations.length === 0 ? (
                                    <div
                                        className="px-4 py-8 rounded-2xl border text-center text-[13px] text-[var(--v-text-muted)]"
                                        style={{ borderColor: "var(--v-border)" }}
                                    >
                                        No allocations configured for this event.
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--v-border)" }}>
                                        <div
                                            className="grid text-[11px] font-semibold uppercase tracking-wide text-[var(--v-text-muted)] px-4 py-2 border-b"
                                            style={{ gridTemplateColumns: "1fr 80px 80px 80px", background: "var(--v-elevated)", borderColor: "var(--v-border)" }}
                                        >
                                            <span>Name</span>
                                            <span className="text-center">Alloc</span>
                                            <span className="text-center">Used</span>
                                            <span className="text-center">Left</span>
                                        </div>
                                        {allocations.map((alloc, i) => (
                                            <div
                                                key={i}
                                                className="grid items-center px-4 py-3 text-[13px] border-t"
                                                style={{ gridTemplateColumns: "1fr 80px 80px 80px", borderColor: "var(--v-border)", background: "var(--v-card)" }}
                                            >
                                                <div>
                                                    <div className="font-medium text-[var(--v-text-primary)]">{alloc.name}</div>
                                                    <div className="text-[11px] text-[var(--v-text-muted)]">
                                                        {alloc.hostId ? "Host" : "Promoter"}
                                                    </div>
                                                </div>
                                                <div className="text-center font-bold text-[var(--v-text-primary)] tabular-nums">{alloc.allocatedCount}</div>
                                                <div className="text-center font-bold text-green-600 dark:text-green-400 tabular-nums">{alloc.usedCount}</div>
                                                <div className={cn(
                                                    "text-center font-bold tabular-nums",
                                                    alloc.remaining === 0 ? "text-red-500" : "text-[var(--v-text-primary)]"
                                                )}>
                                                    {alloc.remaining}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Metadata */}
                            {rules.updatedAt && (
                                <p className="text-[11px] text-[var(--v-text-muted)]">
                                    Last updated {new Date(rules.updatedAt).toLocaleString("en-IN", {
                                        month: "short", day: "numeric",
                                        hour: "2-digit", minute: "2-digit",
                                    })}
                                    {rules.updatedBy ? ` by ${rules.updatedBy}` : ""}
                                </p>
                            )}
                        </>
                    )}
                </div>
            )}
        </GuestOpsShell>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RulesSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="text-[12px] font-semibold text-[var(--v-text-muted)] uppercase tracking-wide mb-2">{title}</div>
            <div className="rounded-2xl border overflow-hidden divide-y" style={{ borderColor: "var(--v-border)" }}>
                {children}
            </div>
        </div>
    );
}

function ToggleRow({ label, description, checked, onChange, disabled }: {
    label: string; description: string; checked: boolean;
    onChange: (v: boolean) => void; disabled: boolean;
}) {
    return (
        <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ background: "var(--v-card)" }}
        >
            <div className="flex-1">
                <div className="text-[13px] font-medium text-[var(--v-text-primary)]">{label}</div>
                <div className="text-[11px] text-[var(--v-text-muted)]">{description}</div>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => !disabled && onChange(!checked)}
                disabled={disabled}
                className={cn(
                    "relative w-10 h-5.5 rounded-full transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed",
                    checked ? "bg-[var(--v-orange)]" : "bg-[var(--v-elevated)]"
                )}
                style={{ height: "22px", width: "40px" }}
            >
                <span
                    className={cn(
                        "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                        checked ? "translate-x-5" : "translate-x-0.5"
                    )}
                />
            </button>
        </div>
    );
}

function NumberRow({ label, description, value, min, max, onChange, disabled }: {
    label: string; description: string; value: number; min: number; max: number;
    onChange: (v: number) => void; disabled: boolean;
}) {
    return (
        <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ background: "var(--v-card)" }}
        >
            <div className="flex-1">
                <div className="text-[13px] font-medium text-[var(--v-text-primary)]">{label}</div>
                <div className="text-[11px] text-[var(--v-text-muted)]">{description}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <button
                    onClick={() => !disabled && onChange(Math.max(min, value - 1))}
                    disabled={disabled || value <= min}
                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--v-elevated)] hover:bg-[var(--v-card-hover)] disabled:opacity-40 transition-all border"
                    style={{ borderColor: "var(--v-border)" }}
                >
                    <Minus size={12} />
                </button>
                <span className="text-[14px] font-bold text-[var(--v-text-primary)] tabular-nums w-10 text-center">
                    {value}
                </span>
                <button
                    onClick={() => !disabled && onChange(Math.min(max, value + 1))}
                    disabled={disabled || value >= max}
                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--v-elevated)] hover:bg-[var(--v-card-hover)] disabled:opacity-40 transition-all border"
                    style={{ borderColor: "var(--v-border)" }}
                >
                    <Plus size={12} />
                </button>
            </div>
        </div>
    );
}

function RulesSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--v-border)" }}>
                    {Array.from({ length: 3 }).map((_, j) => (
                        <div key={j} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0" style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}>
                            <div className="space-y-1.5">
                                <div className="h-3.5 w-32 bg-[var(--v-elevated)] rounded" />
                                <div className="h-2.5 w-48 bg-[var(--v-elevated)] rounded" />
                            </div>
                            <div className="w-10 h-5.5 bg-[var(--v-elevated)] rounded-full" style={{ height: "22px" }} />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

function NoEventState() {
    return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <Settings2 size={40} className="text-[var(--v-text-muted)] mb-4" />
            <h3 className="text-[16px] font-semibold text-[var(--v-text-primary)] mb-2">Select an event</h3>
            <p className="text-[13px] text-[var(--v-text-muted)] max-w-xs">
                Choose an event from the selector above to manage guest rules.
            </p>
        </div>
    );
}
