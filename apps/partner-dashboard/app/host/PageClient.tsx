"use client";

import {
    CalendarDays,
    Users,
    Building2,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Star,
    Banknote,
    Ticket,
    AlertTriangle,
    Radio,
    Clock,
    TrendingUp,
    ArrowRight,
    Bell,
    Plus,
    BarChart3,
    Network,
    Handshake,
    Sparkles,
    CalendarRange,
    CheckCircle2,
    X,
} from "lucide-react";
import Link from "next/link";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useHostOverviewSummary } from "@/lib/hooks/useHostQueries";
import { formatINRCompact } from "@/lib/finance/definitions";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { KPIBento } from "@/components/ui/BentoCard";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type RangeOption = "1d" | "7d" | "30d" | "90d" | "custom";

interface UpcomingEvent {
    id: string;
    title: string;
    venueName: string;
    startDate: string;
    lifecycle: string;
    coverImage?: string;
    ticketsSold?: number;
    revenue?: number;
    capacity?: number;
}

interface OverviewSummary {
    pendingEventApprovals: number;
    pendingSlotRequests: number;
    activeVenuePartnerships: number;
    activePromoterPartnerships: number;
    upcomingEvents: UpcomingEvent[];
    todayEvent: UpcomingEvent | null;
    nextEvent: UpcomingEvent | null;
    recentEarnings: number;
    totalTicketsSold: number;
    hostScore: number;
    verificationStatus: "verified" | "pending" | "unverified";
    profileCompletionPct: number;
    range: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(dateStr: string): string {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function daysUntil(dateStr: string): number {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function toDateInputValue(d: Date): string {
    return d.toISOString().split("T")[0];
}

const RANGE_LABELS: Record<RangeOption, string> = {
    "1d": "Today",
    "7d": "7 Days",
    "30d": "30 Days",
    "90d": "90 Days",
    "custom": "Custom",
};

const LIFECYCLE_CONFIG: Record<string, { label: string; color: string }> = {
    published: { label: "Live", color: "var(--v-success)" },
    live:      { label: "Live", color: "var(--v-success)" },
    pending:   { label: "Pending", color: "var(--v-warning)" },
    draft:     { label: "Draft", color: "var(--v-text-tertiary)" },
    completed: { label: "Done", color: "var(--v-text-secondary)" },
    cancelled: { label: "Cancelled", color: "var(--v-error)" },
    scheduled: { label: "Scheduled", color: "var(--v-info)" },
    approved:  { label: "Approved", color: "var(--v-info)" },
};

// ─── Date Range Selector ──────────────────────────────────────────────────────

function DateRangeSelector({
    range,
    customStart,
    customEnd,
    onRangeChange,
    onCustomApply,
}: {
    range: RangeOption;
    customStart: string;
    customEnd: string;
    onRangeChange: (r: RangeOption) => void;
    onCustomApply: (start: string, end: string) => void;
}) {
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [localStart, setLocalStart] = useState(customStart);
    const [localEnd, setLocalEnd] = useState(customEnd);
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setPopoverOpen(false);
            }
        };
        if (popoverOpen) document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [popoverOpen]);

    const handleOptionClick = (r: RangeOption) => {
        if (r === "custom") {
            setPopoverOpen(true);
        } else {
            setPopoverOpen(false);
            onRangeChange(r);
        }
    };

    const handleApply = () => {
        if (!localStart || !localEnd) return;
        setPopoverOpen(false);
        onCustomApply(localStart, localEnd);
    };

    const PRESETS: RangeOption[] = ["1d", "7d", "30d", "90d", "custom"];

    return (
        <div className="relative" ref={popoverRef}>
            <div className="overflow-x-auto scrollbar-hide">
            <div
                className="flex items-center gap-0.5 p-1 rounded-2xl w-fit"
                style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)" }}
            >
                {PRESETS.map((r) => {
                    const isActive = range === r;
                    return (
                        <button
                            key={r}
                            onClick={() => handleOptionClick(r)}
                            className={cn(
                                "px-3.5 py-1.5 rounded-xl text-[12px] font-bold uppercase tracking-wider transition-all duration-150 focus:outline-none",
                                isActive ? "shadow-sm" : "hover:brightness-110"
                            )}
                            style={
                                isActive
                                    ? { background: "var(--v-orange)", color: "#fff" }
                                    : { background: "transparent", color: "var(--v-text-tertiary)" }
                            }
                        >
                            {r === "custom" && range === "custom"
                                ? `${customStart.slice(5)} – ${customEnd.slice(5)}`
                                : RANGE_LABELS[r]}
                        </button>
                    );
                })}
            </div>
            </div>

            {/* Custom date popover */}
            <AnimatePresence>
                {popoverOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 top-full mt-2 z-50 rounded-[20px] p-5 shadow-2xl w-[280px] max-w-[calc(100vw-2rem)]"
                        style={{
                            background: "var(--v-card)",
                            border: "1px solid var(--v-border)",
                        }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[12px] font-black uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>
                                Custom Range
                            </span>
                            <button onClick={() => setPopoverOpen(false)}>
                                <X className="w-4 h-4" style={{ color: "var(--v-text-tertiary)" }} />
                            </button>
                        </div>
                        <div className="flex flex-col gap-3">
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--v-text-tertiary)" }}>
                                    From
                                </label>
                                <input
                                    type="date"
                                    value={localStart}
                                    onChange={(e) => setLocalStart(e.target.value)}
                                    max={localEnd || undefined}
                                    className="w-full rounded-xl px-3 py-2 text-[13px] font-semibold focus:outline-none"
                                    style={{
                                        background: "var(--v-elevated)",
                                        border: "1px solid var(--v-border)",
                                        color: "var(--v-text-primary)",
                                        colorScheme: "dark",
                                    }}
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--v-text-tertiary)" }}>
                                    To
                                </label>
                                <input
                                    type="date"
                                    value={localEnd}
                                    onChange={(e) => setLocalEnd(e.target.value)}
                                    min={localStart || undefined}
                                    className="w-full rounded-xl px-3 py-2 text-[13px] font-semibold focus:outline-none"
                                    style={{
                                        background: "var(--v-elevated)",
                                        border: "1px solid var(--v-border)",
                                        color: "var(--v-text-primary)",
                                        colorScheme: "dark",
                                    }}
                                />
                            </div>
                            <button
                                onClick={handleApply}
                                disabled={!localStart || !localEnd}
                                className="mt-1 w-full rounded-xl py-2 text-[13px] font-black uppercase tracking-widest transition-all disabled:opacity-40"
                                style={{ background: "var(--v-orange)", color: "#fff" }}
                            >
                                Apply
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Live Event Section ───────────────────────────────────────────────────────

function LiveEventSection({ todayEvent }: { todayEvent: UpcomingEvent | null }) {
    const [expanded, setExpanded] = useState(!!todayEvent);

    // Auto-collapse when there's no event today
    useEffect(() => {
        setExpanded(!!todayEvent);
    }, [todayEvent]);

    if (!todayEvent) {
        return (
            <div
                className="rounded-[28px] flex items-center justify-between px-7 py-4"
                style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--v-border)",
                }}
            >
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[var(--v-text-muted)] opacity-40" />
                    <span className="text-[13px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>
                        No event tonight
                    </span>
                </div>
                <span className="text-[12px] font-semibold" style={{ color: "var(--v-text-muted)" }}>
                    Nothing scheduled for today
                </span>
            </div>
        );
    }

    return (
        <div
            className="rounded-[28px] overflow-hidden"
            style={{
                background: "rgba(52, 211, 153, 0.04)",
                border: "1px solid rgba(52,211,153,0.18)",
            }}
        >
            {/* Header — always visible */}
            <button
                className="w-full flex items-center justify-between px-4 sm:px-7 py-4 transition-colors hover:bg-white/[0.02] gap-3"
                onClick={() => setExpanded((v) => !v)}
            >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--v-success)] opacity-60" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--v-success)]" />
                    </span>
                    <span className="text-[11px] sm:text-[13px] font-black uppercase tracking-widest flex-shrink-0" style={{ color: "var(--v-success)" }}>
                        Live
                    </span>
                    <span className="text-[13px] font-bold truncate" style={{ color: "var(--v-text-primary)" }}>
                        {todayEvent.title}
                    </span>
                    <span className="text-[11px] font-semibold hidden sm:inline flex-shrink-0" style={{ color: "var(--v-text-tertiary)" }}>
                        · {formatTime(todayEvent.startDate)} · {todayEvent.venueName || "—"}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href={`/host/analytics/overview?eventId=${todayEvent.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[12px] font-black uppercase tracking-widest px-3 py-1 rounded-lg transition-all hover:opacity-80"
                        style={{ background: "rgba(52,211,153,0.12)", color: "var(--v-success)" }}
                    >
                        View Analytics
                    </Link>
                    {expanded ? (
                        <ChevronUp className="w-4 h-4" style={{ color: "var(--v-text-tertiary)" }} />
                    ) : (
                        <ChevronDown className="w-4 h-4" style={{ color: "var(--v-text-tertiary)" }} />
                    )}
                </div>
            </button>

            {/* Expanded content */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 sm:px-7 pb-5 grid grid-cols-3 gap-3 sm:gap-4 border-t" style={{ borderColor: "rgba(52,211,153,0.12)" }}>
                            <LiveStatCell
                                label="Tickets Sold"
                                value={todayEvent.ticketsSold?.toString() ?? "—"}
                                subtext={todayEvent.capacity ? `of ${todayEvent.capacity}` : undefined}
                            />
                            <LiveStatCell
                                label="Revenue"
                                value={todayEvent.revenue ? formatINRCompact(todayEvent.revenue) : "—"}
                            />
                            <LiveStatCell
                                label="Fill Rate"
                                value={
                                    todayEvent.capacity && todayEvent.ticketsSold
                                        ? `${Math.round((todayEvent.ticketsSold / todayEvent.capacity) * 100)}%`
                                        : "—"
                                }
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function LiveStatCell({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
    return (
        <div className="pt-4">
            <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--v-text-muted)" }}>
                {label}
            </div>
            <div className="text-[22px] font-black tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                {value}
            </div>
            {subtext && (
                <div className="text-[11px] font-semibold mt-0.5" style={{ color: "var(--v-text-muted)" }}>
                    {subtext}
                </div>
            )}
        </div>
    );
}

// ─── Next Event KPI Card ──────────────────────────────────────────────────────

function NextEventCard({ nextEvent, loading }: { nextEvent: UpcomingEvent | null; loading: boolean }) {
    if (loading) return <div className="v-skeleton rounded-[28px] h-full min-h-[140px]" />;

    if (!nextEvent) {
        return (
            <div
                className="rounded-[28px] p-7 flex flex-col justify-between min-h-[140px]"
                style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}
            >
                <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>
                    Next Event
                </div>
                <div className="text-[15px] font-bold" style={{ color: "var(--v-text-muted)" }}>
                    No upcoming events
                </div>
            </div>
        );
    }

    const days = daysUntil(nextEvent.startDate);
    const fillPct =
        nextEvent.capacity && nextEvent.ticketsSold
            ? Math.min(100, Math.round((nextEvent.ticketsSold / nextEvent.capacity) * 100))
            : null;

    return (
        <div
            className="rounded-[28px] p-7 flex flex-col justify-between min-h-[140px]"
            style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>
                    Next Event
                </div>
                <span
                    className="text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg shrink-0"
                    style={{
                        background: days <= 1 ? "rgba(52,211,153,0.12)" : "rgba(129,140,248,0.1)",
                        color: days <= 1 ? "var(--v-success)" : "var(--v-info)",
                    }}
                >
                    {days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
                </span>
            </div>
            <div>
                <div className="text-[16px] font-black tracking-tight line-clamp-1 mb-1" style={{ color: "var(--v-text-primary)" }}>
                    {nextEvent.title}
                </div>
                <div className="text-[12px] font-semibold mb-3" style={{ color: "var(--v-text-tertiary)" }}>
                    {formatDate(nextEvent.startDate)} · {nextEvent.venueName || "—"}
                </div>
                {fillPct !== null && (
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-muted)" }}>
                                Fill Rate
                            </span>
                            <span className="text-[11px] font-black tabular-nums" style={{ color: "var(--v-text-secondary)" }}>
                                {fillPct}%
                            </span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--v-elevated)" }}>
                            <div
                                className="h-full rounded-full transition-all"
                                style={{
                                    width: `${fillPct}%`,
                                    background: fillPct >= 80 ? "var(--v-success)" : fillPct >= 50 ? "var(--v-orange)" : "var(--v-info)",
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventMiniCard({ event }: { event: UpcomingEvent }) {
    const lifecycle = event.lifecycle || "draft";
    const cfg = LIFECYCLE_CONFIG[lifecycle] || LIFECYCLE_CONFIG.draft;
    return (
        <Link
            href={`/host/analytics/overview?eventId=${event.id}`}
            className="group p-6 rounded-[24px] flex items-center gap-5 transition-all hover:bg-[var(--v-elevated)] bg-[var(--v-canvas)] border border-[var(--v-border)]"
        >
            <div className="w-14 h-14 rounded-[16px] bg-[var(--v-card)] border border-[var(--v-border)] flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                {event.coverImage ? (
                    <img src={event.coverImage} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                    <CalendarDays className="w-5 h-5" style={{ color: "var(--v-text-muted)" }} />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold uppercase tracking-tight" style={{ color: "var(--v-text-tertiary)" }}>
                    {formatDate(event.startDate)} · {event.venueName ?? "—"}
                </p>
                <p className="text-[15px] font-black line-clamp-1 leading-tight uppercase mt-0.5 tracking-tight" style={{ color: "var(--v-text-primary)" }}>
                    {event.title ?? "Untitled Event"}
                </p>
                <div className="mt-2 flex items-center gap-3">
                    <span
                        className="text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border"
                        style={{ color: cfg.color, borderColor: `${cfg.color}30`, background: `${cfg.color}10` }}
                    >
                        {cfg.label}
                    </span>
                    {event.ticketsSold !== undefined && event.ticketsSold > 0 && (
                        <span className="text-[11px] font-semibold" style={{ color: "var(--v-text-muted)" }}>
                            {event.ticketsSold} sold
                        </span>
                    )}
                </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
                <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" style={{ color: "var(--v-text-tertiary)" }} />
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--v-info)" }}>
                    Analytics
                </span>
            </div>
        </Link>
    );
}

function QuickLink({ icon: Icon, label, href }: { icon: any; label: string; href: string }) {
    return (
        <Link
            href={href}
            className="group flex flex-col items-center justify-center p-7 rounded-[28px] transition-all hover:bg-[var(--v-elevated)] bg-[var(--v-card)] border border-[var(--v-border)] gap-3"
        >
            <div className="w-11 h-11 rounded-2xl bg-surface-tertiary flex items-center justify-center group-hover:scale-110 transition-transform">
                <Icon className="w-5 h-5 text-[var(--v-text-tertiary)] group-hover:text-[var(--v-orange)] transition-colors" />
            </div>
            <span className="text-[12px] font-black text-center uppercase tracking-widest text-[var(--v-text-tertiary)] group-hover:text-text-primary transition-colors">
                {label}
            </span>
        </Link>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function HostOverviewPage() {
    const { profile } = useDashboardAuth() as any;
    const hostId = profile?.activeMembership?.partnerId;
    const displayName = profile?.displayName || "Host";
    const shouldReduceMotion = useReducedMotion();

    // Date filter state
    const [range, setRange] = useState<RangeOption>("7d");
    const [customStart, setCustomStart] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return toDateInputValue(d);
    });
    const [customEnd, setCustomEnd] = useState<string>(toDateInputValue(new Date()));

    const { data: rawData, isLoading: loading, isError } = useHostOverviewSummary(
        hostId,
        range,
        range === "custom" ? customStart : undefined,
        range === "custom" ? customEnd : undefined
    );
    const summary: OverviewSummary | null = rawData ? (rawData.summary || rawData) : null;

    const handleCustomApply = (start: string, end: string) => {
        setCustomStart(start);
        setCustomEnd(end);
        setRange("custom");
    };

    const mp = (delay: number) =>
        shouldReduceMotion
            ? {}
            : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.32, ease: [0.25, 0.1, 0.25, 1], delay } };

    const pendingTotal = (summary?.pendingEventApprovals ?? 0) + (summary?.pendingSlotRequests ?? 0);

    const rangeLabel = range === "custom"
        ? `${customStart.slice(5)} – ${customEnd.slice(5)}`
        : RANGE_LABELS[range];

    if (isError) {
        return (
            <VenuePageShell title="Overview">
                <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
                    <AlertTriangle className="w-10 h-10 text-red-400" />
                    <p className="text-[16px] font-semibold" style={{ color: "var(--v-text-primary)" }}>Failed to load host overview</p>
                    <p className="text-[13px]" style={{ color: "var(--v-text-tertiary)" }}>Please refresh the page to try again.</p>
                </div>
            </VenuePageShell>
        );
    }

    return (
        <VenuePageShell
            title="Overview"
            subtitle={`Good ${getGreeting()}, ${displayName.split(" ")[0]}`}
            actions={
                <div className="flex items-center gap-3 flex-wrap">
                    <DateRangeSelector
                        range={range}
                        customStart={customStart}
                        customEnd={customEnd}
                        onRangeChange={setRange}
                        onCustomApply={handleCustomApply}
                    />
                    <Link href="/host/calendar">
                        <VenueActionButton variant="primary">
                            <Plus className="w-5 h-5 mr-2" />
                            Secure Slot
                        </VenueActionButton>
                    </Link>
                </div>
            }
        >
            <div className="flex flex-col gap-5">

                {/* Live Event Banner */}
                <motion.div {...mp(0)}>
                    <LiveEventSection todayEvent={summary?.todayEvent ?? null} />
                </motion.div>

                {/* Daily KPI Strip */}
                <motion.div {...mp(0.06)} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Next Event */}
                    <NextEventCard nextEvent={summary?.nextEvent ?? null} loading={loading} />

                    {/* Revenue */}
                    <div
                        className="rounded-[28px] p-7 flex flex-col justify-between min-h-[140px]"
                        style={{ background: "var(--v-card)", border: "1px solid var(--v-border)", borderLeftWidth: 3, borderLeftColor: "var(--v-orange)" }}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>
                                Revenue
                            </span>
                            <Banknote className="w-4 h-4" style={{ color: "var(--v-orange)" }} />
                        </div>
                        <div>
                            <div className="text-[28px] font-black tabular-nums tracking-tighter" style={{ color: "var(--v-text-primary)" }}>
                                {loading ? "—" : formatINRCompact(summary?.recentEarnings ?? 0)}
                            </div>
                            <div className="text-[11px] font-semibold mt-1 uppercase tracking-wider" style={{ color: "var(--v-text-muted)" }}>
                                {rangeLabel}
                            </div>
                        </div>
                    </div>

                    {/* Tickets Sold */}
                    <div
                        className="rounded-[28px] p-7 flex flex-col justify-between min-h-[140px]"
                        style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>
                                Tickets
                            </span>
                            <Ticket className="w-4 h-4" style={{ color: "var(--v-info)" }} />
                        </div>
                        <div>
                            <div className="text-[28px] font-black tabular-nums tracking-tighter" style={{ color: "var(--v-text-primary)" }}>
                                {loading ? "—" : (summary?.totalTicketsSold ?? 0).toLocaleString("en-IN")}
                            </div>
                            <div className="text-[11px] font-semibold mt-1 uppercase tracking-wider" style={{ color: "var(--v-text-muted)" }}>
                                {rangeLabel}
                            </div>
                        </div>
                    </div>

                    {/* Pending Actions */}
                    <div
                        className="rounded-[28px] p-7 flex flex-col justify-between min-h-[140px]"
                        style={{
                            background: pendingTotal > 0 ? "rgba(251,191,36,0.04)" : "var(--v-card)",
                            border: `1px solid ${pendingTotal > 0 ? "rgba(251,191,36,0.2)" : "var(--v-border)"}`,
                        }}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>
                                Pending
                            </span>
                            {pendingTotal > 0 && (
                                <span className="w-2 h-2 rounded-full bg-[var(--v-warning)] animate-pulse" />
                            )}
                        </div>
                        <div>
                            <div
                                className="text-[28px] font-black tabular-nums tracking-tighter"
                                style={{ color: pendingTotal > 0 ? "var(--v-warning)" : "var(--v-text-primary)" }}
                            >
                                {loading ? "—" : pendingTotal}
                            </div>
                            <div className="text-[11px] font-semibold mt-1 uppercase tracking-wider" style={{ color: "var(--v-text-muted)" }}>
                                {pendingTotal === 1 ? "Action required" : pendingTotal > 1 ? "Actions required" : "All clear"}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Identity + Stats row */}
                <motion.div {...mp(0.1)} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Identity Card */}
                    <div
                        className="lg:col-span-2 rounded-[32px] p-8 sm:p-10 flex flex-col justify-between min-h-[180px] relative overflow-hidden"
                        style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}
                    >
                        <div className="relative z-10 flex items-center gap-6">
                            <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-[var(--v-orange)] to-red-600 flex items-center justify-center text-white text-2xl font-black shadow-xl shrink-0 border-2 border-white/10">
                                {profile?.photoURL ? (
                                    <img src={profile.photoURL} alt="" className="w-full h-full rounded-[18px] object-cover" />
                                ) : (
                                    displayName[0] ?? "H"
                                )}
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-[28px] font-black tracking-tighter text-text-primary leading-none">
                                    {displayName}
                                </h2>
                                <p className="text-[13px] font-bold mt-1.5" style={{ color: "var(--v-text-tertiary)" }}>
                                    {summary?.verificationStatus === "verified"
                                        ? "Verified C1RCLE Production Partner"
                                        : "Verification Processing"}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between relative z-10 mt-7">
                            <Link href="/host/profile">
                                <VenueActionButton variant="secondary" className="h-10 px-5 text-[12px]">
                                    Audit Identity
                                </VenueActionButton>
                            </Link>
                            {summary?.hostScore !== undefined && summary.hostScore > 0 && (
                                <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl" style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)" }}>
                                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                    <span className="text-[15px] font-black tabular-nums">{summary.hostScore.toFixed(1)}</span>
                                    <span className="text-[11px] font-black uppercase" style={{ color: "var(--v-text-muted)" }}>Rating</span>
                                </div>
                            )}
                        </div>
                        <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-[var(--v-orange)]/5 rounded-full blur-[80px] pointer-events-none" />
                    </div>

                    {/* Partner stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                        <KPIBento
                            label="VENUES"
                            value={loading ? "—" : summary?.activeVenuePartnerships || 0}
                            subtext="Active partners"
                            icon={<Building2 className="w-5 h-5" />}
                            className="!p-7 !rounded-[28px]"
                            loading={loading}
                        />
                        <KPIBento
                            label="PROMOTERS"
                            value={loading ? "—" : summary?.activePromoterPartnerships || 0}
                            subtext="Distribution"
                            icon={<Users className="w-5 h-5" />}
                            className="!p-7 !rounded-[28px]"
                            loading={loading}
                        />
                    </div>
                </motion.div>

                {/* Production Schedule + Sidebar */}
                <motion.div {...mp(0.14)} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Upcoming schedule */}
                    <div
                        className="xl:col-span-2 rounded-[32px] p-8 sm:p-10"
                        style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}
                    >
                        <div className="flex items-center justify-between mb-7">
                            <div>
                                <h2 className="text-[20px] font-black text-text-primary tracking-tight">
                                    Production Schedule
                                </h2>
                                <p className="text-[12px] font-semibold mt-0.5 uppercase tracking-widest" style={{ color: "var(--v-text-muted)" }}>
                                    Click any event to view analytics
                                </p>
                            </div>
                            <Link href="/host/events">
                                <VenueActionButton variant="secondary" className="h-9 px-4 text-[12px]">
                                    All Events <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
                                </VenueActionButton>
                            </Link>
                        </div>

                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[...Array(4)].map((_, i) => <div key={i} className="v-skeleton rounded-[24px] h-28" />)}
                            </div>
                        ) : !summary?.upcomingEvents?.length ? (
                            <div className="py-16 flex flex-col items-center text-center gap-5">
                                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "var(--v-elevated)" }}>
                                    <CalendarDays className="w-8 h-8" style={{ color: "var(--v-text-muted)" }} />
                                </div>
                                <div>
                                    <h3 className="text-[18px] font-black text-text-primary">No events in this period</h3>
                                    <p className="text-[13px] mt-1.5" style={{ color: "var(--v-text-tertiary)" }}>
                                        Try a wider date range or secure a new slot.
                                    </p>
                                </div>
                                <Link href="/host/calendar">
                                    <VenueActionButton variant="primary" className="h-11 px-7">
                                        Secure Production Slot
                                    </VenueActionButton>
                                </Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {summary.upcomingEvents.slice(0, 8).map((event) => (
                                    <EventMiniCard key={event.id} event={event} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-5">
                        {/* Network Audit */}
                        <div
                            className="rounded-[32px] p-8"
                            style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}
                        >
                            <h3 className="text-[16px] font-black text-text-primary mb-6">Network Audit</h3>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(244,74,34,0.1)", border: "1px solid rgba(244,74,34,0.2)" }}>
                                            <Handshake className="w-5 h-5 text-orange-400" />
                                        </div>
                                        <span className="text-[14px] font-bold" style={{ color: "var(--v-text-secondary)" }}>Pending Access</span>
                                    </div>
                                    <span className="text-[18px] font-black tabular-nums text-text-primary">{summary?.pendingEventApprovals || 0}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)" }}>
                                            <Building2 className="w-5 h-5 text-sky-400" />
                                        </div>
                                        <span className="text-[14px] font-bold" style={{ color: "var(--v-text-secondary)" }}>Infrastructure</span>
                                    </div>
                                    <span className="text-[18px] font-black tabular-nums text-text-primary">{summary?.activeVenuePartnerships || 0}</span>
                                </div>
                            </div>
                            <Link href="/host/network" className="block mt-7">
                                <VenueActionButton variant="secondary" className="w-full h-11">
                                    Audit Partnerships
                                </VenueActionButton>
                            </Link>
                        </div>

                        {/* Quick Access */}
                        <div className="grid grid-cols-2 gap-4">
                            <QuickLink icon={BarChart3} label="Analytics" href="/host/analytics/overview" />
                            <QuickLink icon={Network} label="Network" href="/host/network" />
                        </div>

                        {/* Elite Access upsell */}
                        <div
                            className="relative overflow-hidden rounded-[32px] p-8"
                            style={{ background: "linear-gradient(135deg, #1A1A24, #0A0A10)", border: "1px solid var(--v-border)" }}
                        >
                            <div className="relative z-10">
                                <div className="flex items-center gap-2.5 mb-4">
                                    <Sparkles className="w-5 h-5" style={{ color: "var(--v-orange)" }} />
                                    <span className="text-[13px] font-black uppercase tracking-[0.2em] text-text-primary">Elite Access</span>
                                </div>
                                <p className="text-[13px] leading-relaxed mb-6" style={{ color: "var(--v-text-tertiary)" }}>
                                    Unlock priority slot acquisition and verification badges across the network.
                                </p>
                                <VenueActionButton variant="primary" className="w-full h-11 uppercase text-[11px] tracking-widest font-black">
                                    Upgrade Profile
                                </VenueActionButton>
                            </div>
                            <div className="absolute -right-16 -bottom-16 w-40 h-40 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: "var(--v-orange)" }} />
                        </div>
                    </div>
                </motion.div>
            </div>
        </VenuePageShell>
    );
}

function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return "morning";
    if (h < 17) return "afternoon";
    return "evening";
}
