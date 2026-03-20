"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { GuestOpsShell } from "@/components/guest-ops/GuestOpsShell";
import { useGuestOpsShellData } from "@/lib/hooks/useGuestOpsShellData";
import { cn } from "@/lib/utils";
import {
    Users, CheckCircle2, XCircle, Flag, AlertTriangle, ScanLine,
    Wifi, Crown, Gift, Armchair, TicketIcon, List, Loader2,
    TrendingUp, Activity,
} from "lucide-react";
import type { GuestOpsOverview, ScannerDevice } from "@/lib/types/guestOps";

export default function GuestOpsOverviewPageClient() {
    const {
        eventId, venueId, events, summary: shellSummary,
        openExceptions, isLoading: shellLoading, authHeaders,
    } = useGuestOpsShellData();

    // Overview keeps its own live summary for the KPI grid + 15s polling
    const [summary, setSummary] = useState<GuestOpsOverview | null>(null);
    const [devices, setDevices] = useState<ScannerDevice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchSummary = useCallback(async (eid: string) => {
        if (!eid || !venueId) return;
        try {
            const [sumRes, devRes] = await Promise.all([
                fetch(`/api/venue/guest-ops/${eid}/summary?venueId=${venueId}`, { headers: authHeaders() }),
                fetch(`/api/venue/guest-ops/${eid}/scanner/devices?venueId=${venueId}`, { headers: authHeaders() }),
            ]);
            if (sumRes.ok) setSummary(await sumRes.json());
            if (devRes.ok) { const d = await devRes.json(); setDevices(d.devices ?? []); }
        } catch (_) {
            setError("Failed to load operations data");
        }
    }, [venueId, authHeaders]);

    useEffect(() => {
        if (!eventId) { setIsLoading(false); return; }
        setIsLoading(true);
        fetchSummary(eventId).finally(() => setIsLoading(false));
    }, [eventId, fetchSummary]);

    // Poll every 15s for real-time KPI updates
    useEffect(() => {
        if (!eventId) return;
        pollRef.current = setInterval(() => fetchSummary(eventId), 15_000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [eventId, fetchSummary]);

    const liveSummary = summary ?? shellSummary;
    const kpis = liveSummary?.kpis;

    return (
        <GuestOpsShell
            events={events}
            summary={liveSummary}
            openExceptions={openExceptions}
            isLoading={shellLoading && !liveSummary}
        >
            {!eventId ? (
                <EmptyState />
            ) : error ? (
                <ErrorState message={error} onRetry={() => { setError(null); fetchSummary(eventId); }} />
            ) : (
                <div className="space-y-6">
                    {/* KPI Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3">
                        {kpis ? (
                            <>
                                <KPICard icon={Users}        label="Total Expected"    value={kpis.totalExpected}   color="blue"   />
                                <KPICard icon={TicketIcon}   label="Ticketed"          value={kpis.ticketedGuests}  color="blue"   />
                                <KPICard icon={List}         label="Guest List"        value={kpis.guestListGuests} color="slate"  />
                                <KPICard icon={Crown}        label="VIP"               value={kpis.vipGuests}       color="purple" />
                                <KPICard icon={Gift}         label="Comp"              value={kpis.compGuests}      color="amber"  />
                                <KPICard icon={Armchair}     label="Table Guests"      value={kpis.tableGuests}     color="orange" />
                                <KPICard icon={CheckCircle2} label="Checked In"        value={kpis.checkedIn}       color="green"  emphasis />
                                <KPICard icon={Users}        label="Not Arrived"       value={kpis.notArrived}      color="slate"  />
                                <KPICard icon={XCircle}      label="Denied"            value={kpis.denied}          color="red"    />
                                <KPICard icon={Flag}         label="Flagged"           value={kpis.flagged}         color="amber"  />
                                <KPICard icon={AlertTriangle}label="Dupe Scans"        value={kpis.duplicateScans}  color="amber"  />
                                <KPICard icon={Wifi}         label="Devices Online"    value={kpis.onlineDevices}   color="teal"   />
                            </>
                        ) : isLoading ? (
                            Array.from({ length: 8 }).map((_, i) => <SkeletonKPI key={i} />)
                        ) : null}
                    </div>

                    {/* Check-In Progress Bar */}
                    {kpis && kpis.totalExpected > 0 && (
                        <div
                            className="p-4 rounded-xl border"
                            style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <TrendingUp size={14} className="text-[var(--text-tertiary)]" />
                                    <span className="text-[13px] font-medium text-[var(--text-primary)]">Entry Progress</span>
                                </div>
                                <span className="text-[13px] text-[var(--text-tertiary)] tabular-nums">
                                    {kpis.checkedIn} / {kpis.totalExpected}
                                    {" "}({Math.round((kpis.checkedIn / kpis.totalExpected) * 100)}%)
                                </span>
                            </div>
                            <div className="h-2 rounded-full bg-[var(--bg-fill)] overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-[var(--color-success)] transition-all duration-700"
                                    style={{ width: `${Math.min(100, Math.round((kpis.checkedIn / kpis.totalExpected) * 100))}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Scanner Device Health Row */}
                    {devices.length > 0 && (
                        <div
                            className="p-4 rounded-xl border"
                            style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
                        >
                            <div className="flex items-center gap-2 mb-3">
                                <Activity size={14} className="text-[var(--text-tertiary)]" />
                                <span className="text-[13px] font-semibold text-[var(--text-primary)]">Scanner Devices</span>
                                <span className="ml-auto text-[12px] text-[var(--text-tertiary)]">
                                    {devices.filter(d => d.isOnline).length} / {devices.length} online
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {devices.map(device => (
                                    <DeviceCard key={device.deviceId} device={device} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </GuestOpsShell>
    );
}

// ── Sub-components ───────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { icon: string; bg: string }> = {
    blue:   { icon: "text-[var(--color-info)]",    bg: "bg-[var(--color-info-bg)]" },
    green:  { icon: "text-[var(--color-success)]", bg: "bg-[var(--color-success-bg)]" },
    red:    { icon: "text-[var(--color-error)]",   bg: "bg-[var(--color-error-bg)]" },
    amber:  { icon: "text-[var(--color-warning)]", bg: "bg-[var(--color-warning-bg)]" },
    purple: { icon: "text-[#AF52DE]",              bg: "bg-[rgba(175,82,222,0.10)]" },
    orange: { icon: "text-[var(--accent)]",        bg: "bg-[var(--accent-muted)]" },
    teal:   { icon: "text-[var(--color-info)]",    bg: "bg-[var(--color-info-bg)]" },
    slate:  { icon: "text-[var(--text-tertiary)]", bg: "bg-[var(--bg-fill)]" },
};

function KPICard({ icon: Icon, label, value, color, emphasis }: {
    icon: React.ElementType; label: string; value: number; color: string; emphasis?: boolean;
}) {
    const { icon: iconColor, bg } = COLOR_MAP[color] ?? COLOR_MAP.slate;
    return (
        <div
            className={cn(
                "p-4 rounded-[var(--r-lg)] border flex flex-col gap-2 transition-all bg-[var(--bg-elevated)]",
                emphasis
                    ? "border-[var(--color-success)]/30"
                    : "border-[var(--border-subtle)]"
            )}
        >
            <div className={cn("w-8 h-8 rounded-[var(--r-sm)] flex items-center justify-center", bg)}>
                <Icon size={16} className={iconColor} />
            </div>
            <div>
                <div className="dash-label-sm text-[var(--text-tertiary)] mb-0.5">{label}</div>
                <div className={cn("dash-metric-sm tabular-nums", emphasis ? "text-[var(--color-success)]" : "text-[var(--text-primary)]")}>
                    {value.toLocaleString()}
                </div>
            </div>
        </div>
    );
}

function DeviceCard({ device }: { device: ScannerDevice }) {
    return (
        <div
            className="flex items-center gap-3 p-3 rounded-lg border"
            style={{ background: "var(--bg-fill)", borderColor: "var(--border-subtle)" }}
        >
            <div className={cn(
                "w-2 h-2 rounded-full shrink-0",
                device.isOnline ? "bg-[var(--color-success)]" : "bg-[var(--color-error)]"
            )} />
            <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">{device.deviceName}</div>
                <div className="text-[11px] text-[var(--text-tertiary)] truncate">
                    {device.operatorName} {device.boundGate ? `· ${device.boundGate}` : ""}
                </div>
            </div>
            <div className="text-right shrink-0">
                <div className="text-[12px] font-bold text-[var(--color-success)] tabular-nums">{device.validScans}</div>
                <div className="text-[10px] text-[var(--text-tertiary)]">scans</div>
            </div>
        </div>
    );
}

function SkeletonKPI() {
    return (
        <div className="p-4 rounded-xl border animate-pulse" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}>
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-fill)] mb-3" />
            <div className="h-3 w-16 bg-[var(--bg-fill)] rounded mb-2" />
            <div className="h-7 w-12 bg-[var(--bg-fill)] rounded" />
        </div>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <ScanLine size={40} className="text-[var(--text-tertiary)] mb-4" />
            <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">Select an event to begin</h3>
            <p className="text-[13px] text-[var(--text-tertiary)] max-w-xs">
                Choose an event from the selector above to view live guest operations and entry status.
            </p>
        </div>
    );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertTriangle size={32} className="text-red-400 mb-3" />
            <p className="text-[14px] font-medium text-[var(--text-primary)] mb-2">Failed to load operations data</p>
            <p className="text-[12px] text-[var(--text-tertiary)] mb-4">{message}</p>
            <button
                onClick={onRetry}
                className="px-4 py-2 rounded-lg bg-[var(--bg-fill)] text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-fill)]"
            >
                Retry
            </button>
        </div>
    );
}
