"use client";

import { ReactNode, useState, useEffect, useRef } from "react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import {
    Search, Calendar, ChevronDown, Activity, TrendingUp,
    Zap, DollarSign, Users, ShieldAlert, Play, Clock,
    BarChart3, CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

interface StudioShellProps {
    children: ReactNode;
    title: string;
    description: string;
    role: "venue" | "host" | "promoter";
    onRangeChange?: (range: string) => void;
    onEventChange?: (eventId: string | null) => void;
}

export default function StudioShell({
    children,
    title,
    description,
    role,
    onRangeChange,
    onEventChange,
}: StudioShellProps) {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const urlEventId = searchParams.get("eventId");

    const { user, profile } = useDashboardAuth();
    const [range, setRange] = useState("30d");
    const [selectedEventId, setSelectedEventId] = useState<string | null>(urlEventId);
    const [isEventSelectorOpen, setIsEventSelectorOpen] = useState(false);
    const [venueEvents, setVenueEvents] = useState<{ id: string; title: string }[]>([]);
    const [eventSearch, setEventSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const venueId = profile?.activeMembership?.partnerId;
        if (!venueId || !user) return;
        user.getIdToken().then(token =>
            fetch(`/api/venue/events?venueId=${venueId}&limit=50`, {
                headers: { Authorization: `Bearer ${token}` },
            })
        )
            .then(r => (r.ok ? r.json() : { events: [] }))
            .then(({ events }: { events: any[] }) => {
                setVenueEvents(
                    events
                        .filter((e: any) => e.lifecycle !== "draft" && e.status !== "draft")
                        .map((e: any) => ({ id: e.id, title: e.title || e.name || e.id }))
                );
            })
            .catch(() => {});
    }, [profile, user]);

    // Deep-sync selectedEventId with URL on mount/change
    useEffect(() => {
        if (urlEventId && urlEventId !== selectedEventId) {
            setSelectedEventId(urlEventId);
            onEventChange?.(urlEventId);
        }
    }, [urlEventId]);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsEventSelectorOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const ALL_EVENTS = { id: null, title: "Global (All Events)" };
    const events = [ALL_EVENTS, ...venueEvents];
    const filteredEvents = eventSearch.trim()
        ? events.filter(e => e.title.toLowerCase().includes(eventSearch.toLowerCase()))
        : events;
    const currentEvent = events.find(e => e.id === selectedEventId) || events[0];

    const handleRangeChange = (newRange: string) => {
        setRange(newRange);
        onRangeChange?.(newRange);
    };

    const handleEventSelect = (eventId: string | null) => {
        setSelectedEventId(eventId);
        setIsEventSelectorOpen(false);
        setEventSearch("");
        onEventChange?.(eventId);
    };

    const tabs = [
        { label: "Summary",    href: `/${role}/analytics/overview`,     icon: BarChart3 },
        { label: "Timing",     href: `/${role}/analytics/timeline`,     icon: Clock },
        { label: "Demand",     href: `/${role}/analytics/reach`,        icon: TrendingUp },
        { label: "Turnout",    href: `/${role}/analytics/engagement`,   icon: Zap },
        { label: "Money",      href: `/${role}/analytics/revenue`,      icon: DollarSign },
        { label: "Crowd",      href: `/${role}/analytics/audience`,     icon: Users },
        { label: "Gate & Ops", href: `/${role}/analytics/ops`,          icon: ShieldAlert },
        { label: "Partners",   href: `/${role}/analytics/attribution`,  icon: Users },
    ];

    const RANGES = [
        { id: "tonight", label: "Tonight" },
        { id: "weekend", label: "This Weekend" },
        { id: "30d",     label: "Last 30 Nights" },
        { id: "all",     label: "All Time" },
    ];

    return (
        <div style={{ minHeight: "100vh", background: "var(--v-canvas, #111113)" }}>

            {/* ── Sticky header ──────────────────────────────────────────── */}
            <div
                className="sticky top-0 z-30"
                style={{
                    background: "rgba(10,10,11,0.92)",
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    boxShadow: "0 1px 0 rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.4)",
                }}
            >
                {/* Top bar */}
                <div className="px-6 py-3 flex items-center justify-between gap-4">

                    {/* Left: wordmark + status + event picker */}
                    <div className="flex items-center gap-3">

                        {/* Wordmark */}
                        <div className="flex items-center gap-2.5 shrink-0">
                            <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                style={{
                                    background: "linear-gradient(135deg, var(--v-orange) 0%, #cc3311 100%)",
                                    boxShadow: "0 0 16px rgba(244,74,34,0.45), inset 0 1px 0 rgba(255,255,255,0.15)",
                                }}
                            >
                                <Activity className="w-4 h-4 text-white" />
                            </div>
                            <span
                                className="text-[14px] font-black tracking-[0.12em] uppercase"
                                style={{ color: "var(--v-text-primary)", letterSpacing: "0.12em" }}
                            >
                                Stats
                            </span>
                        </div>

                        {/* Separator */}
                        <div className="w-px h-5 shrink-0 opacity-20" style={{ background: "linear-gradient(180deg, transparent, #FFF, transparent)" }} />

                        {/* Running Well pill */}
                        <div
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0"
                            style={{
                                background: "rgba(52,211,153,0.08)",
                                border: "1px solid rgba(52,211,153,0.18)",
                            }}
                        >
                            <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{
                                    background: "#34D399",
                                    boxShadow: "0 0 6px rgba(52,211,153,0.7)",
                                    animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
                                }}
                            />
                            <span
                                className="text-[9px] font-black uppercase tracking-[0.14em]"
                                style={{ color: "#34D399" }}
                            >
                                Running Well
                            </span>
                        </div>

                        {/* Separator */}
                        <div className="w-px h-5 shrink-0 opacity-20" style={{ background: "linear-gradient(180deg, transparent, #FFF, transparent)" }} />

                        {/* Event selector */}
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setIsEventSelectorOpen(v => !v)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all"
                                style={{
                                    background: isEventSelectorOpen
                                        ? "rgba(244,74,34,0.08)"
                                        : "rgba(255,255,255,0.04)",
                                    border: `1px solid ${isEventSelectorOpen ? "rgba(244,74,34,0.35)" : "rgba(255,255,255,0.08)"}`,
                                    color: "var(--v-text-primary)",
                                }}
                            >
                                <div
                                    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                                    style={{ background: "rgba(244,74,34,0.15)" }}
                                >
                                    <Play
                                        className="w-2.5 h-2.5"
                                        style={{ color: "var(--v-orange)" }}
                                        fill="currentColor"
                                    />
                                </div>
                                <span className="text-[12px] font-semibold max-w-[160px] truncate">
                                    {currentEvent.title}
                                </span>
                                <ChevronDown
                                    className="w-3 h-3 shrink-0 transition-transform"
                                    style={{
                                        color: "rgba(255,255,255,0.3)",
                                        transform: isEventSelectorOpen ? "rotate(180deg)" : "rotate(0deg)",
                                    }}
                                />
                            </button>

                            {isEventSelectorOpen && (
                                <div
                                    className="absolute top-full left-0 mt-2 w-72 rounded-2xl p-2 z-50"
                                    style={{
                                        background: "#18181b",
                                        border: "1px solid rgba(255,255,255,0.08)",
                                        boxShadow: "0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.02)",
                                    }}
                                >
                                    <div className="p-2 pb-1">
                                        <div className="relative mb-2">
                                            <Search
                                                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                                                style={{ color: "rgba(255,255,255,0.25)" }}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Search events..."
                                                value={eventSearch}
                                                onChange={e => setEventSearch(e.target.value)}
                                                autoFocus
                                                className="w-full pl-9 pr-3 py-2 rounded-xl text-[12px] font-medium focus:outline-none"
                                                style={{
                                                    background: "rgba(255,255,255,0.04)",
                                                    border: "1px solid rgba(255,255,255,0.08)",
                                                    color: "var(--v-text-primary)",
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-0.5 max-h-60 overflow-y-auto">
                                            {filteredEvents.map(event => {
                                                const isSelected = selectedEventId === event.id;
                                                return (
                                                    <button
                                                        key={event.id || "global"}
                                                        onClick={() => handleEventSelect(event.id)}
                                                        className="w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-between transition-all"
                                                        style={{
                                                            background: isSelected
                                                                ? "rgba(244,74,34,0.12)"
                                                                : "transparent",
                                                            color: isSelected
                                                                ? "var(--v-orange)"
                                                                : "rgba(255,255,255,0.55)",
                                                        }}
                                                    >
                                                        {event.title}
                                                        {isSelected && (
                                                            <CheckCircle2
                                                                className="w-3.5 h-3.5 shrink-0"
                                                                style={{ color: "var(--v-orange)" }}
                                                            />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: range picker + calendar */}
                    <div className="flex items-center gap-2.5 shrink-0">
                        <div
                            className="flex items-center gap-0.5 p-[3px] rounded-xl"
                            style={{
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.07)",
                            }}
                        >
                            {RANGES.map(r => (
                                <button
                                    key={r.id}
                                    onClick={() => handleRangeChange(r.id)}
                                    className="px-3 py-1.5 rounded-[10px] text-[9px] font-black uppercase tracking-widest transition-all"
                                    style={
                                        range === r.id
                                            ? {
                                                background: "var(--v-orange)",
                                                color: "#fff",
                                                boxShadow: "0 2px 12px rgba(244,74,34,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                                            }
                                            : {
                                                background: "transparent",
                                                color: "rgba(255,255,255,0.35)",
                                            }
                                    }
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>

                        <button
                            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                            style={{
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.07)",
                                color: "rgba(255,255,255,0.4)",
                            }}
                        >
                            <Calendar className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Tab bar */}
                <div
                    className="px-6 flex items-end gap-1.5 overflow-x-auto scrollbar-hide relative min-h-[58px]"
                    style={{ 
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        background: "linear-gradient(180deg, rgba(255,255,255,0.012) 0%, transparent 100%)",
                    }}
                >
                    {tabs.map(tab => {
                        const active = pathname === tab.href;
                        const Icon = tab.icon;
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className="relative flex items-center gap-2.5 px-6 py-4.5 text-[10px] uppercase transition-all shrink-0 group rounded-t-xl"
                                style={{
                                    color: active ? "#FFF" : "rgba(255,255,255,0.35)",
                                    background: active ? "rgba(244,74,34,0.03)" : "transparent",
                                    letterSpacing: "0.14em"
                                }}
                            >
                                <Icon
                                    className="w-3.5 h-3.5 transition-all duration-300 transform"
                                    style={{
                                        color: active ? "var(--v-orange)" : "rgba(255,255,255,0.25)",
                                        filter: active ? "drop-shadow(0 0 8px rgba(244,74,34,0.45))" : "none",
                                        transform: active ? "scale(1.15)" : "scale(1)",
                                    }}
                                />
                                <span 
                                    className="relative z-10 transition-all duration-300"
                                    style={{
                                        fontWeight: active ? 900 : 700,
                                        opacity: active ? 1 : 0.8
                                    }}
                                >
                                    {tab.label}
                                </span>
                                
                                {/* Active indicator line - premium double line glow */}
                                {active && (
                                    <>
                                        <div
                                            className="absolute bottom-0 left-0 right-0 h-[2.5px] z-20"
                                            style={{
                                                background: "var(--v-orange)",
                                                boxShadow: "0 -4px 12px rgba(244,74,34,0.5), 0 0 24px rgba(244,74,34,0.25)",
                                            }}
                                        />
                                        <div 
                                            className="absolute inset-0 bg-gradient-to-t from-[rgba(244,74,34,0.05)] to-transparent opacity-100 transition-opacity duration-300"
                                        />
                                    </>
                                )}

                                {/* Hover state */}
                                {!active && (
                                    <div 
                                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-200"
                                        style={{ background: "rgba(255,255,255,0.02)" }}
                                    />
                                )}
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* ── Page header ────────────────────────────────────────────── */}
            <div
                className="px-8 pt-7 pb-5"
                style={{ 
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    background: "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.01) 100%)"
                }}
            >
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div>
                        {/* Breadcrumb — shown only when a specific event is selected */}
                        {selectedEventId && currentEvent.id && (
                            <Link
                                href={`/${role}/events`}
                                className="inline-flex items-center gap-1.5 mb-3 text-[11px] font-semibold hover:underline"
                                style={{ color: "var(--v-text-tertiary)" }}
                            >
                                ← Back to Events
                            </Link>
                        )}

                        <div className="flex items-center gap-3 mb-1.5">
                            <div
                                className="w-[3px] h-7 rounded-full"
                                style={{
                                    background: "linear-gradient(180deg, var(--v-orange), rgba(244,74,34,0.2))",
                                    boxShadow: "0 0 10px rgba(244,74,34,0.5)",
                                }}
                            />
                            <h1
                                className="text-[26px] font-black tracking-tight leading-none"
                                style={{ color: "var(--v-text-primary)" }}
                            >
                                {title}
                                {/* Event name — inline muted chip when a specific event is active */}
                                {selectedEventId && currentEvent.id && (
                                    <span
                                        className="ml-3 text-[15px] font-semibold tracking-normal align-middle"
                                        style={{ color: "rgba(255,255,255,0.35)" }}
                                    >
                                        · {currentEvent.title}
                                    </span>
                                )}
                            </h1>
                        </div>
                        <p
                            className="text-[12px] font-medium ml-[15px]"
                            style={{ color: "rgba(255,255,255,0.28)" }}
                        >
                            {description}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Main content ───────────────────────────────────────────── */}
            <main className="px-6 pt-6">
                <div className="max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
