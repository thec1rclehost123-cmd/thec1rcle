"use client";

import { useState, useEffect } from "react";
import {
    TrendingUp, Users, Calendar, Zap, Bell, Plus,
    BarChart3, Ticket, ArrowRight, ChevronRight, Sparkles
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { KPIBento } from "@/components/ui/BentoCard";
import { AppleHeroStat } from "@/components/ui/AppleHeroStat";

// ── Formatters ──
function formatRevenue(amount: number | null | undefined): string {
    if (amount == null) return "₹—";
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
    return `₹${amount}`;
}

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

const LIFECYCLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    published: { label: "Live",      color: "var(--v-success)", bg: "var(--v-success-bg)" },
    live:      { label: "Live",      color: "var(--v-success)", bg: "var(--v-success-bg)" },
    pending:   { label: "Pending",   color: "var(--v-warning)", bg: "var(--v-warning-bg)" },
    draft:     { label: "Draft",     color: "var(--v-text-tertiary)", bg: "rgba(255,255,255,0.06)" },
    completed: { label: "Done",      color: "var(--v-text-secondary)", bg: "rgba(255,255,255,0.06)" },
    cancelled: { label: "Cancelled", color: "var(--v-error)", bg: "var(--v-error-bg)" },
    scheduled: { label: "Scheduled", color: "var(--v-info)", bg: "var(--v-info-bg)" },
};

export default function VenueDashboardHome() {
    const { profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;
    const shouldReduceMotion = useReducedMotion();

    const [summary, setSummary] = useState<any>(null);
    const [tonight, setTonight] = useState<any>(null);
    const [events, setEvents] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!venueId) return;
        fetchDashboard();
        fetchAlerts();
    }, [venueId]);

    async function fetchAlerts() {
        try {
            const res = await fetch(`/api/venue/notifications?venueId=${venueId}&limit=3`);
            const data = await res.json();
            if (res.ok && data.notifications) setAlerts(data.notifications.slice(0, 3));
        } catch {}
    }

    async function fetchDashboard() {
        setLoading(true);
        try {
            const [eventsRes, summaryRes] = await Promise.all([
                fetch(`/api/venue/events?venueId=${venueId}`),
                fetch(`/api/venue/overview/summary?venueId=${venueId}`),
            ]);
            const eventsData = await eventsRes.json();
            const summaryData = await summaryRes.json();
            const allEvents = (eventsData.events || []).map((e: any) => ({
                ...e,
                _dateStr: e.startDate
                    ? (typeof e.startDate === "string" ? e.startDate.split("T")[0] : "")
                    : "",
            }));
            setEvents(allEvents);
            setSummary(summaryData);

            const todayStr = new Date().toISOString().split("T")[0];
            const tonightEvent = allEvents.find((e: any) => e._dateStr === todayStr);
            if (tonightEvent) {
                const tonightRes = await fetch(`/api/venue/overview/tonight?eventId=${tonightEvent.id}`);
                if (tonightRes.ok) setTonight(await tonightRes.json());
            }
        } catch {}
        finally { setLoading(false); }
    }

    const capacityPct = tonight && tonight.expected > 0
        ? Math.round((tonight.checkedIn / tonight.expected) * 100)
        : null;

    const nextEvent = events.find((e: any) => new Date(e.startDate || e.date || "") > new Date());

    const mp = (delay: number) =>
        shouldReduceMotion
            ? {}
            : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1], delay } };

    return (
        <VenuePageShell
            title="Dashboard"
            actions={
                <>
                    <VenueActionButton variant="secondary">
                        <Bell className="w-4 h-4" />
                        <span className="hidden sm:inline">Alerts</span>
                        {alerts.filter((a) => !a.isRead).length > 0 && (
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--v-orange)" }} />
                        )}
                    </VenueActionButton>
                    <Link href="/venue/create">
                        <VenueActionButton variant="primary">
                            <Plus className="w-4 h-4" />
                            New Event
                        </VenueActionButton>
                    </Link>
                </>
            }
        >
            {/* ── A: Tonight's Pulse ── */}
            <motion.div {...mp(0)}>
                <AppleHeroStat
                    label="Tonight's Pulse"
                    value={loading ? "..." : tonight ? formatRevenue(tonight.revenue) : "Quiet Tonight"}
                    subtitle={
                        loading ? undefined
                        : tonight ? `${tonight.checkedIn} guests · ${capacityPct}% capacity`
                        : nextEvent ? `Next event ${formatDate(nextEvent.startDate || nextEvent.date)}`
                        : "No upcoming events"
                    }
                    liveIndicator={!!tonight && !loading}
                    cta={tonight ? { label: "Entry Control", href: `/venue/events/${tonight.id}` } : undefined}
                    loading={loading}
                    noData={!tonight && !loading}
                />
            </motion.div>

            {/* ── B: KPI Strip ── */}
            <motion.div {...mp(0.06)} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPIBento
                    label="Weekend Revenue"
                    value={loading ? "—" : formatRevenue(summary?.weekendRevenue)}
                    trend={summary?.weekendRevenue ? { value: "12.4%", direction: "up" } : undefined}
                    icon={<TrendingUp className="w-5 h-5" />}
                    iconBg="var(--v-orange-dim)"
                    loading={loading}
                />
                <KPIBento
                    label="Upcoming Events"
                    value={loading ? "—" : summary?.activeEventsCount ?? "—"}
                    subtext="Next 7 days"
                    icon={<Calendar className="w-5 h-5" />}
                    iconBg="var(--v-info-bg)"
                    loading={loading}
                />
                <KPIBento
                    label="Entry Rate"
                    value={loading ? "—" : summary?.avgEntryVelocity ?? "—"}
                    subtext="Last session peak"
                    icon={<Zap className="w-5 h-5" />}
                    iconBg="var(--v-warning-bg)"
                    loading={loading}
                />
                <KPIBento
                    label="Guest Profiles"
                    value={loading ? "—" : summary?.totalGuestProfiles
                        ? `${(summary.totalGuestProfiles / 1000).toFixed(1)}K`
                        : "—"}
                    trend={summary?.newGuestsThisWeek
                        ? { value: `${summary.newGuestsThisWeek} new`, direction: "up" }
                        : undefined}
                    icon={<Users className="w-5 h-5" />}
                    iconBg="var(--v-success-bg)"
                    loading={loading}
                />
            </motion.div>

            {/* ── C: Schedule + Right sidebar ── */}
            <motion.div {...mp(0.12)} className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Upcoming schedule */}
                <div className="xl:col-span-2 rounded-[32px] p-6 sm:p-8" style={{ background: "var(--v-card)" }}>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="v-text-section" style={{ color: "var(--v-text-primary)" }}>
                            Upcoming Schedule
                        </h2>
                        <Link href="/venue/calendar" className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--v-orange)" }}>
                            View Calendar <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[...Array(4)].map((_, i) => <div key={i} className="v-skeleton rounded-2xl h-24" />)}
                        </div>
                    ) : events.length === 0 ? (
                        <div className="py-14 flex flex-col items-center text-center gap-3">
                            <Calendar className="w-8 h-8" style={{ color: "var(--v-text-muted)" }} />
                            <p className="text-[13px]" style={{ color: "var(--v-text-tertiary)" }}>
                                No upcoming events scheduled
                            </p>
                            <Link href="/venue/create">
                                <VenueActionButton variant="secondary">
                                    <Plus className="w-3.5 h-3.5" /> Create your first event
                                </VenueActionButton>
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {events.slice(0, 4).map((event: any, i: number) => (
                                <EventMiniCard key={event.id || i} event={event} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Right column */}
                <div className="space-y-4">
                    {/* Alerts */}
                    <div className="rounded-[32px] p-6" style={{ background: "var(--v-card)" }}>
                        <h3 className="text-[15px] font-semibold mb-4" style={{ color: "var(--v-text-primary)" }}>
                            Alerts
                        </h3>
                        <div className="space-y-1">
                            {alerts.length > 0 ? (
                                alerts.map((alert: any, i: number) => <AlertRow key={alert.id || i} alert={alert} />)
                            ) : (
                                <div className="py-6 text-center">
                                    <Bell className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--v-text-muted)" }} />
                                    <p className="text-[12px]" style={{ color: "var(--v-text-tertiary)" }}>No new notifications</p>
                                </div>
                            )}
                        </div>
                        {alerts.length > 0 && (
                            <button
                                className="w-full mt-4 py-2.5 rounded-xl text-[12px] font-medium"
                                style={{ background: "var(--v-elevated)", color: "var(--v-text-secondary)" }}
                            >
                                View History
                            </button>
                        )}
                    </div>

                    {/* Quick Access */}
                    <div className="grid grid-cols-2 gap-3">
                        <QuickLink icon={Users} label="Staff" href="/venue/staff" />
                        <QuickLink icon={Ticket} label="Registers" href="/venue/registers" />
                        <QuickLink icon={BarChart3} label="Analytics" href="/venue/analytics/overview" />
                        <QuickLink icon={Sparkles} label="My Page" href="/venue/page-management" />
                    </div>

                    {/* PRO upsell */}
                    <div className="relative overflow-hidden rounded-[32px] p-6" style={{ background: "var(--v-hero)" }}>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-4 h-4" style={{ color: "var(--v-orange)" }} />
                                <span className="text-[13px] font-bold" style={{ color: "var(--v-text-primary)" }}>C1RCLE PRO</span>
                            </div>
                            <p className="text-[12px] leading-relaxed mb-4" style={{ color: "var(--v-text-secondary)" }}>
                                Unlock deeper audience analytics and retention insights.
                            </p>
                            <button
                                className="px-4 py-2 rounded-xl text-[12px] font-semibold hover:brightness-110 transition-all"
                                style={{ background: "var(--v-orange)", color: "#fff" }}
                            >
                                Upgrade Now
                            </button>
                        </div>
                        <div className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full blur-3xl pointer-events-none" style={{ background: "var(--v-orange-glow)" }} />
                    </div>
                </div>
            </motion.div>

            {/* ── D: Live Ops (only when tonight exists) ── */}
            {tonight && !loading && (
                <motion.div {...mp(0.18)}>
                    <div className="rounded-[32px] p-8" style={{ background: "var(--v-card)" }}>
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="v-text-section" style={{ color: "var(--v-text-primary)" }}>
                                    Live Operations
                                </h2>
                                <p className="text-[13px] mt-0.5" style={{ color: "var(--v-text-tertiary)" }}>
                                    Real-time gate data
                                </p>
                            </div>
                            <span className="v-status-pill v-status-live flex items-center gap-1.5">
                                <span className="v-live-dot" style={{ width: 6, height: 6 }} />
                                {tonight.checkedIn} In
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="space-y-4">
                                <div>
                                    <p className="v-label mb-1">Expected</p>
                                    <p className="text-[36px] font-bold leading-none tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                                        {tonight.expected}
                                    </p>
                                    <p className="text-[12px] mt-1" style={{ color: "var(--v-text-tertiary)" }}>Total guestlist</p>
                                </div>
                                <TurnoutBar checked={tonight.checkedIn} expected={tonight.expected} />
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <p className="v-label mb-1">Live Revenue</p>
                                    <p className="text-[36px] font-bold leading-none tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                                        {formatRevenue(tonight.revenue)}
                                    </p>
                                    <p className="text-[12px] mt-1" style={{ color: "var(--v-text-tertiary)" }}>Tonight's sales</p>
                                </div>
                                <div>
                                    <p className="v-label mb-1">Tickets Sold</p>
                                    <p className="text-[22px] font-bold tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                                        {tonight.ticketsSold}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <p className="v-label mb-2">Entry Velocity</p>
                                    <MiniSparkline />
                                    <p className="text-[12px] mt-1 font-medium" style={{ color: "var(--v-success)" }}>
                                        {tonight.entryRate ?? "124"} guests/hr peak
                                    </p>
                                </div>
                                <Link
                                    href={`/venue/events/${tonight.id}`}
                                    className="group flex items-center justify-between p-4 rounded-2xl transition-all"
                                    style={{ background: "var(--v-elevated)" }}
                                >
                                    <div>
                                        <p className="v-label mb-0.5">Control Panel</p>
                                        <p className="text-[14px] font-semibold" style={{ color: "var(--v-text-primary)" }}>Guest Entry</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--v-text-tertiary)" }} />
                                </Link>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </VenuePageShell>
    );
}

// ── Sub-components ──

function EventMiniCard({ event }: { event: any }) {
    const lifecycle = event.lifecycle || event.status || "draft";
    const cfg = LIFECYCLE_CONFIG[lifecycle] || LIFECYCLE_CONFIG.draft;
    const dateStr = event.startDate || event.date || "";
    return (
        <Link
            href={`/venue/events/${event.id}`}
            className="group p-4 rounded-2xl flex flex-col gap-2 transition-all hover:brightness-110"
            style={{ background: "var(--v-elevated)" }}
        >
            <p className="text-[11px] font-medium" style={{ color: "var(--v-text-tertiary)" }}>
                {dateStr ? formatDate(dateStr) : "—"}
            </p>
            <p className="text-[14px] font-semibold line-clamp-2 leading-tight" style={{ color: "var(--v-text-primary)" }}>
                {event.title}
            </p>
            <span className="v-status-pill self-start text-[10px]" style={{ color: cfg.color, background: cfg.bg }}>
                {cfg.label}
            </span>
        </Link>
    );
}

const ALERT_HREF: Record<string, string> = {
    host_request: "/venue/connections/requests",
    promoter_request: "/venue/connections/requests",
    reservation: "/venue/reservations",
    event: "/venue/events",
    revenue: "/venue/analytics/revenue",
    payment: "/venue/payouts",
};

function AlertRow({ alert }: { alert: any }) {
    const href = ALERT_HREF[alert.type];
    const Wrapper = href ? Link : ("div" as any);
    return (
        <Wrapper href={href} className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors">
            <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: !alert.isRead ? "var(--v-orange)" : "var(--v-text-muted)" }} />
            <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate" style={{ color: "var(--v-text-primary)" }}>{alert.title}</p>
                <p className="text-[11px] truncate" style={{ color: "var(--v-text-tertiary)" }}>{alert.description}</p>
            </div>
            <span className="text-[10px] shrink-0 mt-0.5" style={{ color: "var(--v-text-muted)" }}>{alert.timestamp}</span>
        </Wrapper>
    );
}

function QuickLink({ icon: Icon, label, href }: { icon: any; label: string; href: string }) {
    return (
        <Link
            href={href}
            className="group flex flex-col items-center justify-center p-4 rounded-2xl transition-all hover:brightness-110 gap-2"
            style={{ background: "var(--v-elevated)" }}
        >
            <Icon className="w-5 h-5" style={{ color: "var(--v-text-tertiary)" }} />
            <span className="text-[12px] font-medium" style={{ color: "var(--v-text-tertiary)" }}>{label}</span>
        </Link>
    );
}

function TurnoutBar({ checked, expected }: { checked: number; expected: number }) {
    const pct = expected > 0 ? Math.min((checked / expected) * 100, 100) : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium" style={{ color: "var(--v-text-secondary)" }}>Turnout Rate</span>
                <span className="text-[12px] font-bold tabular-nums" style={{ color: "var(--v-text-primary)" }}>{checked} / {expected}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--v-elevated)" }}>
                <motion.div
                    className="h-full rounded-full"
                    style={{ background: "var(--v-success)" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                />
            </div>
        </div>
    );
}

function MiniSparkline() {
    const bars = [30, 45, 60, 80, 100, 70, 40];
    return (
        <div className="flex items-end gap-1 h-10">
            {bars.map((h, i) => (
                <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ delay: 0.3 + i * 0.05, duration: 0.4 }}
                    className="flex-1 rounded-t"
                    style={{ background: "rgba(52,211,153,0.25)" }}
                />
            ))}
        </div>
    );
}
