"use client";

import { Suspense, useState, useEffect, useCallback, type ReactNode } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
    LayoutDashboard, DoorOpen, List, UserPlus, AlertTriangle, Shield,
    ScanLine, ClipboardList, Circle, ChevronDown, CheckCircle2, XCircle,
    Flag, Users, Wifi, Zap, Loader2,
} from "lucide-react";
import { HubTabBar } from "@/components/shared/HubTabBar";
import { useHubTab } from "@/lib/hooks/useHubTab";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { DoorHubContext } from "@/lib/context/DoorHubContext";
import { cn } from "@/lib/utils";
import type { GuestOpsOverview } from "@/lib/types/guestOps";

// Lazy-import existing PageClients — each stays in its own chunk
import OverviewClient from "../guest-ops/overview/PageClient";
import DoorScanClient from "../guest-ops/door/PageClient";
import GuestListClient from "../guest-ops/list/PageClient";
import { WalkInsClient } from "../walk-ins/PageClient";
import ExceptionsClient from "../guest-ops/exceptions/PageClient";
import RulesClient from "../guest-ops/rules/PageClient";
import ScannerClient from "../guest-ops/scanner/PageClient";
import RegistersClient from "../registers/PageClient";

const TABS = [
    { key: "overview",   label: "Overview",   icon: LayoutDashboard },
    { key: "door",       label: "Door",        icon: DoorOpen },
    { key: "list",       label: "Guest List",  icon: List },
    { key: "walkins",    label: "Walk-Ins",    icon: UserPlus },
    { key: "exceptions", label: "Exceptions",  icon: AlertTriangle },
    { key: "rules",      label: "Rules",       icon: Shield },
    { key: "scanner",    label: "Scanner",     icon: ScanLine },
    { key: "registers",  label: "Registers",   icon: ClipboardList },
];

const DOOR_STATUS_CFG: Record<string, { label: string; color: string }> = {
    open:       { label: "OPEN",   color: "text-[var(--color-success)]" },
    soft_close: { label: "SOFT",   color: "text-[var(--color-warning)]" },
    hard_close: { label: "CLOSED", color: "text-[var(--color-error)]" },
    cutoff:     { label: "CUTOFF", color: "text-[var(--color-error)]" },
};

function TabContent({ activeTab }: { activeTab: string }) {
    switch (activeTab) {
        case "overview":   return <OverviewClient />;
        case "door":       return <DoorScanClient />;
        case "list":       return <GuestListClient />;
        case "walkins":    return <WalkInsClient />;
        case "exceptions": return <ExceptionsClient />;
        case "rules":      return <RulesClient />;
        case "scanner":    return <ScannerClient />;
        case "registers":  return <RegistersClient />;
        default:           return <OverviewClient />;
    }
}

export default function DoorPageClient() {
    const { profile } = useDashboardAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { activeTab, setTab } = useHubTab("overview");

    const venueId = profile?.activeMembership?.partnerId ?? "";
    const eventId = searchParams.get("eventId") ?? "";

    const [events, setEvents] = useState<any[]>([]);
    const [summary, setSummary] = useState<GuestOpsOverview | null>(null);
    const [openExceptions, setOpenExceptions] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [eventsOpen, setEventsOpen] = useState(false);

    const [compactMode, setCompactMode] = useState(() => {
        if (typeof window !== "undefined") return localStorage.getItem("guestops_compact") === "1";
        return false;
    });

    const authHeaders = useCallback(() => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${(profile as any)?._token ?? ""}`,
    }), [profile]);

    const handleEventChange = useCallback((id: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("eventId", id);
        router.replace(`${pathname}?${params.toString()}`);
        setEventsOpen(false);
    }, [pathname, router, searchParams]);

    const toggleCompact = useCallback(() => {
        setCompactMode(prev => {
            const next = !prev;
            localStorage.setItem("guestops_compact", next ? "1" : "0");
            return next;
        });
    }, []);

    // Fetch events list once (only needs venueId)
    useEffect(() => {
        if (!venueId) return;
        fetch(`/api/venue/events?venueId=${venueId}`, { headers: authHeaders() })
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) setEvents(d.events ?? []); });
    }, [venueId, authHeaders]);

    // Fetch summary + open exceptions when eventId changes
    useEffect(() => {
        if (!eventId || !venueId) { setSummary(null); return; }
        setIsLoading(true);
        Promise.all([
            fetch(`/api/venue/guest-ops/${eventId}/summary?venueId=${venueId}`, { headers: authHeaders() }),
            fetch(`/api/venue/guest-ops/${eventId}/exceptions?venueId=${venueId}&status=open`, { headers: authHeaders() }),
        ]).then(async ([sumRes, excRes]) => {
            if (sumRes.ok) setSummary(await sumRes.json());
            if (excRes.ok) { const d = await excRes.json(); setOpenExceptions(d.openCount ?? 0); }
        }).finally(() => setIsLoading(false));
    }, [eventId, venueId, authHeaders]);

    const kpis = summary?.kpis;
    const doorCfg = DOOR_STATUS_CFG[summary?.doorStatus ?? "open"] ?? DOOR_STATUS_CFG.open;
    const selectedEvent = events.find(e => e.id === eventId);

    return (
        <DoorHubContext.Provider value={{
            eventId,
            venueId,
            events,
            summary,
            openExceptions,
            isLoading,
            setEventId: handleEventChange,
        }}>
            <div className="space-y-4">
                {/* Hub header */}
                <div>
                    <h1 className="dash-title-page text-[var(--text-primary)]">
                        Entry Operations
                    </h1>
                    <p className="mt-0.5 dash-body-sm text-[var(--text-tertiary)]">
                        On-ground operations — guests, walk-ins, scanning, and registers.
                    </p>
                </div>

                {/* Tab bar */}
                <HubTabBar tabs={TABS} activeTab={activeTab} onTabChange={setTab} />

                {/* Event context bar */}
                <div className="rounded-[var(--r-lg)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)] overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
                        {/* Event selector */}
                        <div className="relative">
                            <button
                                onClick={() => setEventsOpen(o => !o)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--r-sm)] dash-body-sm font-medium transition-colors bg-[var(--bg-fill)] text-[var(--text-primary)] hover:bg-[var(--bg-fill-secondary)]"
                            >
                                <Circle
                                    size={8}
                                    className={selectedEvent?.status === "live" ? "text-[var(--color-success)] fill-[var(--color-success)]" : "text-[var(--text-tertiary)] fill-[var(--text-tertiary)]"}
                                />
                                <span className="truncate max-w-[220px]">
                                    {selectedEvent?.title ?? (events.length === 0 ? "No event selected" : "Select event")}
                                </span>
                                <ChevronDown size={13} className="text-[var(--text-tertiary)] shrink-0" />
                            </button>

                            {eventsOpen && events.length > 0 && (
                                <div className="absolute top-full left-0 mt-1 z-50 min-w-[260px] rounded-[var(--r-lg)] border border-[var(--border-subtle)] shadow-[var(--shadow-xl)] bg-[var(--bg-elevated)] overflow-hidden">
                                    {events.map(event => (
                                        <button
                                            key={event.id}
                                            onClick={() => handleEventChange(event.id)}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-4 py-3 text-left dash-body-sm hover:bg-[var(--bg-fill)] transition-colors",
                                                event.id === eventId && "bg-[var(--bg-fill)]"
                                            )}
                                        >
                                            <Circle
                                                size={8}
                                                className={event.status === "live" ? "text-[var(--color-success)] fill-[var(--color-success)]" : "text-[var(--text-tertiary)] fill-[var(--text-tertiary)]"}
                                            />
                                            <div>
                                                <div className="font-medium text-[var(--text-primary)]">{event.title}</div>
                                                {event.startDate && (
                                                    <div className="dash-caption text-[var(--text-tertiary)]">
                                                        {new Date(event.startDate).toLocaleDateString("en-IN", {
                                                            weekday: "short", month: "short", day: "numeric",
                                                            hour: "2-digit", minute: "2-digit",
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* KPI strip */}
                        {kpis && !isLoading ? (
                            compactMode ? (
                                <div className="flex items-center gap-3 flex-1">
                                    <KPIBadge
                                        icon={<CheckCircle2 size={13} className="text-[var(--color-success)]" />}
                                        label="In"
                                        value={kpis.checkedIn}
                                        total={kpis.totalExpected}
                                        emphasis
                                    />
                                    <DoorStatusBadge status={summary?.doorStatus ?? "open"} />
                                </div>
                            ) : (
                                <div className="flex items-center gap-2.5 flex-wrap flex-1">
                                    <KPIBadge icon={<Users size={12} className="text-[var(--text-tertiary)]" />}              label="Expected"  value={kpis.totalExpected} />
                                    <KPIBadge icon={<CheckCircle2 size={12} className="text-[var(--color-success)]" />}       label="In"        value={kpis.checkedIn} emphasis />
                                    <KPIBadge icon={<XCircle size={12} className="text-[var(--color-error)]" />}              label="Denied"    value={kpis.denied} />
                                    <KPIBadge icon={<Flag size={12} className="text-[var(--color-warning)]" />}               label="Flagged"   value={kpis.flagged} />
                                    <KPIBadge icon={<ScanLine size={12} className="text-[var(--color-info)]" />}              label="Dupes"     value={kpis.duplicateScans} />
                                    <KPIBadge icon={<Wifi size={12} className="text-[var(--color-success)]" />}               label="Devices"   value={kpis.onlineDevices} />
                                    <DoorStatusBadge status={summary?.doorStatus ?? "open"} />
                                </div>
                            )
                        ) : isLoading ? (
                            <div className="flex items-center gap-2 flex-1">
                                <Loader2 size={13} className="animate-spin text-[var(--text-tertiary)]" />
                                <span className="dash-caption text-[var(--text-tertiary)]">Loading…</span>
                            </div>
                        ) : null}

                        {/* Event Night Mode toggle */}
                        <button
                            onClick={toggleCompact}
                            className={cn(
                                "ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-sm)] dash-body-sm font-medium transition-all shrink-0",
                                compactMode
                                    ? "bg-[var(--accent)] text-white"
                                    : "bg-[var(--bg-fill)] text-[var(--text-secondary)] hover:bg-[var(--bg-fill-secondary)]"
                            )}
                        >
                            <Zap size={12} />
                            {compactMode ? "Event Mode ON" : "Event Night Mode"}
                        </button>
                    </div>

                    {/* Open exceptions banner */}
                    {openExceptions > 0 && (
                        <div className="flex items-center gap-2 px-4 py-1.5 dash-body-sm font-medium border-t border-[var(--color-warning)]/30 bg-[var(--color-warning-bg)] text-[var(--color-warning)]">
                            <AlertTriangle size={13} />
                            <span>
                                {openExceptions} open exception{openExceptions !== 1 ? "s" : ""} require{openExceptions === 1 ? "s" : ""} review
                            </span>
                            <button
                                onClick={() => setTab("exceptions")}
                                className="ml-auto underline underline-offset-2 hover:opacity-80"
                            >
                                View
                            </button>
                        </div>
                    )}

                    {/* Locked banner */}
                    {summary?.isLocked && (
                        <div className="flex items-center gap-2 px-4 py-2 dash-body-sm font-medium border-t border-[var(--border-subtle)] bg-[var(--bg-fill)] text-[var(--text-secondary)]">
                            <XCircle size={13} />
                            This event is closed — all operations are locked. Data is read-only.
                        </div>
                    )}
                </div>

                {/* Tab content */}
                <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
                    <TabContent activeTab={activeTab} />
                </Suspense>
            </div>
        </DoorHubContext.Provider>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KPIBadge({ icon, label, value, total, emphasis }: {
    icon: ReactNode; label: string; value: number; total?: number; emphasis?: boolean;
}) {
    return (
        <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-[var(--r-sm)]",
            emphasis ? "bg-[var(--color-success-bg)]" : "bg-[var(--bg-fill)]"
        )}>
            {icon}
            <span className="dash-caption text-[var(--text-tertiary)]">{label}</span>
            <span className={cn(
                "dash-caption font-bold tabular-nums",
                emphasis ? "text-[var(--color-success)]" : "text-[var(--text-primary)]"
            )}>
                {value.toLocaleString()}
            </span>
            {total !== undefined && (
                <span className="dash-caption text-[var(--text-tertiary)]">/ {total.toLocaleString()}</span>
            )}
        </div>
    );
}

function DoorStatusBadge({ status }: { status: string }) {
    const cfg = DOOR_STATUS_CFG[status] ?? { label: status.toUpperCase(), color: "text-[var(--text-tertiary)]" };
    return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-[var(--r-sm)] bg-[var(--bg-fill)]">
            <Circle size={7} className={cn("fill-current", cfg.color)} />
            <span className="dash-caption text-[var(--text-tertiary)]">Door</span>
            <span className={cn("dash-caption font-bold", cfg.color)}>{cfg.label}</span>
        </div>
    );
}
