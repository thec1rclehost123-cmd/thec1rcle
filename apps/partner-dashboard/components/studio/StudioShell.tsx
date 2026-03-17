"use client";

import { ReactNode, useState, useEffect, useRef } from "react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import {
    Search, Calendar, ChevronDown, Activity, TrendingUp,
    Zap, DollarSign, Users, ShieldAlert, Play, Clock,
    BarChart3, CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
    const { user, profile } = useDashboardAuth();
    const [range, setRange] = useState("30d");
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
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
        <div style={{ minHeight: "100vh", background: "var(--v-bg, #0e0e10)" }}>

            {/* ── Sticky header ──────────────────────────────────────────── */}
            <div
                className="sticky top-0 z-30"
                style={{
                    background: "rgba(14,14,16,0.85)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    borderBottom: "1px solid var(--v-border)",
                }}
            >
                {/* Top bar */}
                <div className="px-8 py-3.5 flex items-center justify-between gap-4">

                    {/* Left: wordmark + status + event picker */}
                    <div className="flex items-center gap-4">

                        {/* Wordmark */}
                        <div className="flex items-center gap-2 shrink-0">
                            <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ background: "var(--v-orange)", boxShadow: "0 0 12px rgba(244,74,34,0.4)" }}
                            >
                                <Activity className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span
                                className="text-[15px] font-black tracking-tight"
                                style={{ color: "var(--v-text-primary)" }}
                            >
                                STATS
                            </span>
                        </div>

                        {/* Separator */}
                        <div className="w-px h-5" style={{ background: "var(--v-border)" }} />

                        {/* Running Well pill */}
                        <div
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                            style={{
                                background: "rgba(52,211,153,0.10)",
                                border: "1px solid rgba(52,211,153,0.22)",
                            }}
                        >
                            <span
                                className="w-1.5 h-1.5 rounded-full animate-pulse"
                                style={{ background: "var(--v-success)" }}
                            />
                            <span
                                className="text-[10px] font-black uppercase tracking-widest"
                                style={{ color: "var(--v-success)" }}
                            >
                                Running Well
                            </span>
                        </div>

                        {/* Separator */}
                        <div className="w-px h-5" style={{ background: "var(--v-border)" }} />

                        {/* Event selector */}
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setIsEventSelectorOpen(v => !v)}
                                className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl transition-all"
                                style={{
                                    background: isEventSelectorOpen
                                        ? "var(--v-card)"
                                        : "var(--v-elevated)",
                                    border: `1px solid ${isEventSelectorOpen ? "var(--v-orange)" : "var(--v-border)"}`,
                                    color: "var(--v-text-primary)",
                                }}
                            >
                                <div
                                    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                                    style={{ background: "var(--v-orange-dim)" }}
                                >
                                    <Play
                                        className="w-2.5 h-2.5"
                                        style={{ color: "var(--v-orange)" }}
                                        fill="currentColor"
                                    />
                                </div>
                                <span className="text-[13px] font-semibold max-w-[180px] truncate">
                                    {currentEvent.title}
                                </span>
                                <ChevronDown
                                    className="w-3.5 h-3.5 shrink-0 transition-transform"
                                    style={{
                                        color: "var(--v-text-muted)",
                                        transform: isEventSelectorOpen ? "rotate(180deg)" : "rotate(0deg)",
                                    }}
                                />
                            </button>

                            {isEventSelectorOpen && (
                                <div
                                    className="absolute top-full left-0 mt-2 w-72 rounded-2xl p-2 z-50"
                                    style={{
                                        background: "var(--v-card)",
                                        border: "1px solid var(--v-border)",
                                        boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
                                    }}
                                >
                                    <div className="p-2 pb-1">
                                        <div className="relative mb-2">
                                            <Search
                                                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                                                style={{ color: "var(--v-text-muted)" }}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Search events..."
                                                value={eventSearch}
                                                onChange={e => setEventSearch(e.target.value)}
                                                autoFocus
                                                className="w-full pl-9 pr-3 py-2 rounded-xl text-[12px] font-medium focus:outline-none"
                                                style={{
                                                    background: "var(--v-elevated)",
                                                    border: "1px solid var(--v-border)",
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
                                                                ? "var(--v-orange-dim)"
                                                                : "transparent",
                                                            color: isSelected
                                                                ? "var(--v-orange)"
                                                                : "var(--v-text-secondary)",
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
                    <div className="flex items-center gap-3 shrink-0">
                        <div
                            className="flex items-center gap-0.5 p-1 rounded-xl"
                            style={{
                                background: "var(--v-elevated)",
                                border: "1px solid var(--v-border)",
                            }}
                        >
                            {RANGES.map(r => (
                                <button
                                    key={r.id}
                                    onClick={() => handleRangeChange(r.id)}
                                    className="px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                    style={
                                        range === r.id
                                            ? {
                                                background: "var(--v-orange)",
                                                color: "#fff",
                                                boxShadow: "0 2px 8px rgba(244,74,34,0.35)",
                                            }
                                            : {
                                                background: "transparent",
                                                color: "var(--v-text-muted)",
                                            }
                                    }
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>

                        <button
                            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                            style={{
                                background: "var(--v-elevated)",
                                border: "1px solid var(--v-border)",
                                color: "var(--v-text-secondary)",
                            }}
                        >
                            <Calendar className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Tab bar */}
                <div
                    className="px-8 flex items-center gap-0"
                    style={{ borderTop: "1px solid var(--v-border)" }}
                >
                    {tabs.map(tab => {
                        const active = pathname === tab.href;
                        const Icon = tab.icon;
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className="relative flex items-center gap-2 px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-all group"
                                style={{
                                    color: active ? "var(--v-orange)" : "var(--v-text-muted)",
                                }}
                            >
                                <Icon
                                    className="w-3 h-3"
                                    style={{ opacity: active ? 1 : 0.5 }}
                                />
                                {tab.label}
                                {active && (
                                    <span
                                        className="absolute bottom-0 left-0 w-full h-[2px] rounded-t-full"
                                        style={{ background: "var(--v-orange)", boxShadow: "0 0 8px rgba(244,74,34,0.5)" }}
                                    />
                                )}
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* ── Page header ────────────────────────────────────────────── */}
            <div
                className="px-8 pt-8 pb-6"
                style={{ borderBottom: "1px solid var(--v-border)" }}
            >
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div
                                className="w-1 h-6 rounded-full"
                                style={{ background: "var(--v-orange)", boxShadow: "0 0 8px rgba(244,74,34,0.4)" }}
                            />
                            <h1
                                className="text-[28px] font-black tracking-tight leading-none"
                                style={{ color: "var(--v-text-primary)" }}
                            >
                                {title}
                            </h1>
                        </div>
                        <p
                            className="text-[13px] font-medium ml-4"
                            style={{ color: "var(--v-text-muted)" }}
                        >
                            {description}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Main content ───────────────────────────────────────────── */}
            <main className="px-8 pt-6">
                <div className="max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
