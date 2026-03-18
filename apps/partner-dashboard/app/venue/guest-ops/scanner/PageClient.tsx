"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { GuestOpsShell } from "@/components/guest-ops/GuestOpsShell";
import { TicketValidityChip } from "@/components/guest-ops/chips/TicketValidityChip";
import { OfflineSyncBanner } from "@/components/guest-ops/OfflineSyncBanner";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { GuestSyncEngine, type SyncState } from "@/lib/client/offlineGuestSync";
import { cn } from "@/lib/utils";
import {
    Radio, Wifi, WifiOff, BatteryMedium, Clock, CheckCircle2, XCircle,
    AlertTriangle, Activity, ScanLine, Loader2, RefreshCw,
} from "lucide-react";
import type { ScannerDevice, ScanEvent, GuestOpsOverview } from "@/lib/types/guestOps";

const RESULT_COLORS: Record<string, string> = {
    valid:          "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20",
    already_scanned:"text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20",
    invalid:        "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20",
    cancelled:      "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20",
    not_found:      "text-slate-500 bg-slate-50 dark:bg-slate-800/50",
    re_entry:       "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20",
};

export default function ScannerOversightPageClient() {
    const { profile } = useDashboardAuth();
    const searchParams = useSearchParams();
    const venueId = profile?.activeMembership?.partnerId ?? "";
    const eventId = searchParams.get("eventId") ?? "";

    // Shell state
    const [events, setEvents] = useState<any[]>([]);
    const [summary, setSummary] = useState<GuestOpsOverview | null>(null);
    const [openExceptions, setOpenExceptions] = useState(0);
    const [shellLoading, setShellLoading] = useState(true);

    // Scanner state
    const [devices, setDevices] = useState<ScannerDevice[]>([]);
    const [scanStream, setScanStream] = useState<ScanEvent[]>([]);
    const [devicesLoading, setDevicesLoading] = useState(false);
    const [streamLoading, setStreamLoading] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const [isLive, setIsLive] = useState(true);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Offline guestlist sync ─────────────────────────────────────────────────
    const [syncState, setSyncState] = useState<SyncState>({
        status: "idle",
        lastSynced: null,
        totalGuests: 0,
        queuedCount: 0,
        error: null,
    });
    const syncEngineRef = useRef<GuestSyncEngine | null>(null);

    useEffect(() => {
        if (!eventId || !venueId) return;
        const engine = GuestSyncEngine.forEvent(eventId, venueId);
        syncEngineRef.current = engine;
        const unsub = engine.on("state", setSyncState);
        engine.start();
        return () => {
            unsub();
            engine.stop();
        };
    }, [eventId, venueId]);

    const authHeaders = useCallback(() => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${(profile as any)?._token ?? ""}`,
    }), [profile]);

    const fetchShellData = useCallback(async () => {
        if (!eventId || !venueId) return;
        const [evRes, sumRes, excRes] = await Promise.all([
            fetch(`/api/venue/events?venueId=${venueId}`, { headers: authHeaders() }),
            fetch(`/api/venue/guest-ops/${eventId}/summary?venueId=${venueId}`, { headers: authHeaders() }),
            fetch(`/api/venue/guest-ops/${eventId}/exceptions?venueId=${venueId}&status=open`, { headers: authHeaders() }),
        ]);
        if (evRes.ok) { const d = await evRes.json(); setEvents(d.events ?? []); }
        if (sumRes.ok) setSummary(await sumRes.json());
        if (excRes.ok) { const d = await excRes.json(); setOpenExceptions(d.openCount ?? 0); }
    }, [eventId, venueId, authHeaders]);

    const fetchDevices = useCallback(async () => {
        if (!eventId || !venueId) return;
        setDevicesLoading(true);
        try {
            const res = await fetch(`/api/venue/guest-ops/${eventId}/scanner/devices?venueId=${venueId}`, { headers: authHeaders() });
            if (res.ok) { const d = await res.json(); setDevices(d.devices ?? []); }
        } finally {
            setDevicesLoading(false);
        }
    }, [eventId, venueId, authHeaders]);

    const fetchStream = useCallback(async () => {
        if (!eventId || !venueId) return;
        setStreamLoading(true);
        try {
            const res = await fetch(`/api/venue/guest-ops/${eventId}/scanner/stream?venueId=${venueId}&limit=50`, { headers: authHeaders() });
            if (res.ok) { const d = await res.json(); setScanStream(d.scans ?? []); }
        } finally {
            setStreamLoading(false);
            setLastRefresh(new Date());
        }
    }, [eventId, venueId, authHeaders]);

    // Initial load
    useEffect(() => {
        if (!eventId) { setShellLoading(false); return; }
        setShellLoading(true);
        Promise.all([fetchShellData(), fetchDevices(), fetchStream()])
            .finally(() => setShellLoading(false));
    }, [eventId, fetchShellData, fetchDevices, fetchStream]);

    // Live polling every 8s
    useEffect(() => {
        if (!eventId || !isLive) return;
        pollRef.current = setInterval(() => {
            fetchDevices();
            fetchStream();
        }, 8_000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [eventId, isLive, fetchDevices, fetchStream]);

    const onlineCount = devices.filter(d => d.isOnline).length;
    const totalScans = devices.reduce((a, d) => a + d.validScans, 0);

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
                <div className="space-y-5">
                    {/* Offline sync banner */}
                    <OfflineSyncBanner
                        syncState={syncState}
                        onForceSync={() => syncEngineRef.current?.forceSync()}
                    />

                    {/* Header row */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Radio size={16} className="text-[var(--v-text-muted)]" />
                            <h2 className="text-[15px] font-semibold text-[var(--v-text-primary)]">Scanner Oversight</h2>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                            {lastRefresh && (
                                <span className="text-[11px] text-[var(--v-text-muted)]">
                                    Updated {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                </span>
                            )}
                            <button
                                onClick={() => setIsLive(l => !l)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all",
                                    isLive
                                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                        : "bg-[var(--v-elevated)] text-[var(--v-text-secondary)]"
                                )}
                            >
                                <Activity size={12} className={isLive ? "animate-pulse" : ""} />
                                {isLive ? "Live" : "Paused"}
                            </button>
                            <button
                                onClick={() => { fetchDevices(); fetchStream(); }}
                                className="p-1.5 rounded-xl hover:bg-[var(--v-elevated)] text-[var(--v-text-muted)] transition-all"
                            >
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Summary KPIs */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <ScanKPI label="Devices Online" value={`${onlineCount} / ${devices.length}`} color="teal" icon={<Wifi size={14} />} />
                        <ScanKPI label="Valid Scans" value={totalScans} color="green" icon={<CheckCircle2 size={14} />} />
                        <ScanKPI label="Dupe Scans" value={summary?.kpis?.duplicateScans ?? 0} color="amber" icon={<AlertTriangle size={14} />} />
                        <ScanKPI label="Invalid Scans" value={summary?.kpis ? (summary.kpis as any).invalidScans ?? 0 : 0} color="red" icon={<XCircle size={14} />} />
                    </div>

                    {/* Device Health Grid */}
                    <div
                        className="p-4 rounded-2xl border"
                        style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Activity size={14} className="text-[var(--v-text-muted)]" />
                            <span className="text-[13px] font-semibold text-[var(--v-text-primary)]">Devices</span>
                            {devicesLoading && <Loader2 size={12} className="animate-spin text-[var(--v-text-muted)] ml-1" />}
                        </div>

                        {devices.length === 0 ? (
                            <p className="text-[13px] text-[var(--v-text-muted)] text-center py-6">
                                No scanner devices registered for this event.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {devices.map(device => (
                                    <DeviceCard key={device.deviceId} device={device} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Live Scan Stream */}
                    <div
                        className="p-4 rounded-2xl border"
                        style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <ScanLine size={14} className="text-[var(--v-text-muted)]" />
                            <span className="text-[13px] font-semibold text-[var(--v-text-primary)]">
                                Live Scan Feed
                            </span>
                            <span className="text-[11px] text-[var(--v-text-muted)]">(last 50 scans)</span>
                            {streamLoading && <Loader2 size={12} className="animate-spin text-[var(--v-text-muted)] ml-auto" />}
                        </div>

                        {scanStream.length === 0 ? (
                            <p className="text-[13px] text-[var(--v-text-muted)] text-center py-6">
                                No scans yet for this event.
                            </p>
                        ) : (
                            <div className="divide-y overflow-hidden rounded-xl border" style={{ borderColor: "var(--v-border)" }}>
                                {scanStream.map(scan => (
                                    <ScanRow key={scan.scanId} scan={scan} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </GuestOpsShell>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScanKPI({ label, value, color, icon }: {
    label: string; value: string | number; color: string; icon: React.ReactNode;
}) {
    const colorMap: Record<string, string> = {
        green: "text-green-500 bg-green-50 dark:bg-green-900/20",
        teal:  "text-teal-500 bg-teal-50 dark:bg-teal-900/20",
        amber: "text-amber-500 bg-amber-50 dark:bg-amber-900/20",
        red:   "text-red-500 bg-red-50 dark:bg-red-900/20",
    };
    return (
        <div
            className="p-4 rounded-xl border flex flex-col gap-2"
            style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}
        >
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", colorMap[color])}>
                {icon}
            </div>
            <div>
                <div className="text-[11px] text-[var(--v-text-muted)]">{label}</div>
                <div className="text-xl font-bold tabular-nums text-[var(--v-text-primary)]">{value}</div>
            </div>
        </div>
    );
}

function DeviceCard({ device }: { device: ScannerDevice }) {
    const sinceHeartbeat = device.lastHeartbeat
        ? Math.round((Date.now() - new Date(device.lastHeartbeat).getTime()) / 1000)
        : null;

    return (
        <div
            className={cn(
                "p-3 rounded-xl border transition-all",
                device.isOnline
                    ? "border-green-200 dark:border-green-800/50"
                    : "opacity-70"
            )}
            style={device.isOnline ? {} : { borderColor: "var(--v-border)" }}
        >
            <div className="flex items-start gap-2.5">
                <div className={cn(
                    "w-2 h-2 rounded-full mt-1.5 shrink-0",
                    device.isOnline ? "bg-green-400" : "bg-slate-400"
                )} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-[var(--v-text-primary)] truncate">
                            {device.deviceName}
                        </span>
                        {device.isOnline
                            ? <Wifi size={11} className="text-green-500 shrink-0" />
                            : <WifiOff size={11} className="text-slate-400 shrink-0" />}
                    </div>
                    <div className="text-[11px] text-[var(--v-text-muted)] mt-0.5">
                        {device.operatorName}
                        {device.boundGate ? ` · ${device.boundGate}` : ""}
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                        <div className="text-center">
                            <div className="text-[13px] font-bold text-green-600 dark:text-green-400 tabular-nums">{device.validScans}</div>
                            <div className="text-[9px] text-[var(--v-text-muted)] uppercase">valid</div>
                        </div>
                        <div className="text-center">
                            <div className="text-[13px] font-bold text-amber-500 tabular-nums">{device.duplicateScans}</div>
                            <div className="text-[9px] text-[var(--v-text-muted)] uppercase">dupes</div>
                        </div>
                        <div className="text-center">
                            <div className="text-[13px] font-bold text-red-500 tabular-nums">{device.invalidScans}</div>
                            <div className="text-[9px] text-[var(--v-text-muted)] uppercase">invalid</div>
                        </div>
                        {device.batteryLevel !== undefined && (
                            <div className="ml-auto flex items-center gap-1">
                                <BatteryMedium size={12} className={device.batteryLevel < 20 ? "text-red-400" : "text-[var(--v-text-muted)]"} />
                                <span className="text-[11px] text-[var(--v-text-muted)]">{device.batteryLevel}%</span>
                            </div>
                        )}
                    </div>

                    {sinceHeartbeat !== null && (
                        <div className="flex items-center gap-1 mt-1.5">
                            <Clock size={10} className="text-[var(--v-text-muted)]" />
                            <span className="text-[10px] text-[var(--v-text-muted)]">
                                {sinceHeartbeat < 60
                                    ? `${sinceHeartbeat}s ago`
                                    : `${Math.round(sinceHeartbeat / 60)}m ago`}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ScanRow({ scan }: { scan: ScanEvent }) {
    const resultColor = RESULT_COLORS[scan.result] ?? "text-slate-500 bg-slate-50 dark:bg-slate-800/50";
    return (
        <div
            className="flex items-center gap-3 px-4 py-2.5 text-[12px]"
            style={{ background: "var(--v-elevated)" }}
        >
            <TicketValidityChip result={scan.result} size="xs" />
            <span className="text-[var(--v-text-primary)] font-medium truncate flex-1 min-w-0">
                {scan.guestDisplayName}
            </span>
            {scan.ticketTierName && (
                <span className="text-[11px] text-[var(--v-text-muted)] hidden sm:block truncate max-w-[100px]">
                    {scan.ticketTierName}
                </span>
            )}
            {scan.deviceName && (
                <span className="text-[11px] text-[var(--v-text-muted)] hidden md:block truncate max-w-[100px]">
                    {scan.deviceName}
                </span>
            )}
            <span className="text-[11px] text-[var(--v-text-muted)] tabular-nums shrink-0 ml-auto">
                {new Date(scan.scannedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
        </div>
    );
}

function NoEventState() {
    return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <Radio size={40} className="text-[var(--v-text-muted)] mb-4" />
            <h3 className="text-[16px] font-semibold text-[var(--v-text-primary)] mb-2">Select an event</h3>
            <p className="text-[13px] text-[var(--v-text-muted)] max-w-xs">
                Choose an event from the selector above to monitor scanner activity.
            </p>
        </div>
    );
}
