"use client";

import { useEffect, useState } from "react";
import {
    TrendingUp,
    DollarSign,
    Users,
    Activity,
    ChevronRight,
    Loader2,
    BarChart3,
    Target,
    Zap,
    ShieldAlert,
    Handshake,
} from "lucide-react";

import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import Link from "next/link";
import { useParams } from "next/navigation";
import StudioShell from "@/components/studio/StudioShell";
import { EventTimeline, InsightsPanel } from "@/components/studio/EventStudio";
import { BentoCard, KPIBento } from "@/components/ui/BentoCard";
import { VenueChart } from "@/components/ui/VenueChart";
import { AppleHeroStat } from "@/components/ui/AppleHeroStat";
import { VenueStatStrip } from "@/components/ui/VenueStatStrip";

// ── Formatters ──
function fmt(n: number | undefined | null, type: "currency" | "percent" | "number" = "number"): string {
    if (n == null) return type === "currency" ? "₹--" : type === "percent" ? "--%"  : "--";
    if (type === "currency") {
        if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
        if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
        return `₹${n}`;
    }
    if (type === "percent") return `${n.toFixed(1)}%`;
    return n.toLocaleString();
}

export default function VenueAnalyticsPage() {
    const { profile } = useDashboardAuth();
    const params = useParams();
    const category = (params?.category as string) || "overview";

    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [range, setRange] = useState("30d");
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

    const categoryLabels: Record<string, string> = {
        overview:    "Dashboard",
        reach:       "Demand",
        engagement:  "Turnout",
        revenue:     "Money",
        audience:    "Crowd Profile",
        ops:         "Gate & Operations",
        attribution: "Hosts & Partners",
        timeline:    "Timing",
        strategy:    "Strategy",
    };

    const categoryDescriptions: Record<string, string> = {
        overview:    "What happened, what's happening, and the final numbers.",
        reach:       "Who wants to come? Track interest and people joining the queue.",
        engagement:  "Who actually showed up? Track when people arrive.",
        revenue:     "Where is the money? Real numbers on gross and net.",
        audience:    "Who is the crowd? Age, gender, and loyalty profile.",
        ops:         "How is the gate moving? Scans, denials, and speed.",
        attribution: "Who brought the crowd? Performance of hosts and partners.",
        timeline:    "How the night went. Minute-by-minute view of everything.",
        strategy:    "What should you do next? AI-powered recommendations.",
    };

    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!profile?.activeMembership?.partnerId) return;
            setIsLoading(true);
            try {
                const venueId = profile.activeMembership.partnerId;
                let url = `/api/venue/analytics/${category}?venueId=${venueId}&range=${range}`;
                if (selectedEventId) url += `&eventId=${selectedEventId}`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    setStats(data);
                }
            } catch (err) {
                console.error("Analytics fetch error:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAnalytics();
    }, [profile, range, category, selectedEventId]);

    if (isLoading) {
        return (
            <div
                className="py-24 flex flex-col items-center justify-center rounded-[32px]"
                style={{ background: "var(--v-card)" }}
            >
                <Loader2 className="h-10 w-10 animate-spin mb-4" style={{ color: "var(--v-orange)" }} />
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>
                    Processing Data...
                </p>
            </div>
        );
    }

    if (!stats || !stats.dataReady) {
        return (
            <div
                className="py-24 flex flex-col items-center text-center rounded-[32px]"
                style={{ background: "var(--v-card)" }}
            >
                <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mb-8"
                    style={{ background: "var(--v-elevated)" }}
                >
                    <BarChart3 className="w-10 h-10" style={{ color: "var(--v-text-muted)" }} />
                </div>
                <h3 className="text-[20px] font-bold mb-3" style={{ color: "var(--v-text-primary)" }}>
                    No Data Yet
                </h3>
                <p className="text-[14px] mb-10 max-w-sm" style={{ color: "var(--v-text-tertiary)" }}>
                    Complete your first event to see {(categoryLabels[category] || category).toLowerCase()} analytics.
                </p>
                <Link
                    href="/venue/create"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:brightness-110"
                    style={{ background: "var(--v-orange)", color: "#fff" }}
                >
                    Create Your First Event
                </Link>
            </div>
        );
    }

    return (
        <StudioShell
            role="venue"
            title={categoryLabels[category]}
            description={categoryDescriptions[category]}
            onRangeChange={(r) => setRange(r)}
            onEventChange={(eId) => setSelectedEventId(eId)}
        >
            <div className="space-y-6 pb-20">
                {category === "overview"    && <OverviewView    stats={stats} />}
                {category === "reach"       && <ReachView       stats={stats} />}
                {category === "engagement"  && <EngagementView  stats={stats} />}
                {category === "revenue"     && <RevenueView     stats={stats} />}
                {category === "audience"    && <AudienceView    stats={stats} />}
                {category === "ops"         && <OpsView         stats={stats} />}
                {category === "attribution" && <AttributionView stats={stats} />}
                {category === "timeline"    && <TimelineView    stats={stats} />}
                {category === "strategy"    && <StrategyView    stats={stats} />}
            </div>
        </StudioShell>
    );
}

// ── View Components ──────────────────────────────────────────────────────────

function OverviewView({ stats }: { stats: any }) {
    return (
        <div className="space-y-6">
            {stats.insights?.length > 0 && <InsightsPanel insights={stats.insights} />}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPIBento
                    label="TOTAL COLLECTION"
                    value={fmt(stats.totalRevenue, "currency")}
                    trend={{ value: "+12.4%", direction: "up" }}
                    icon={<DollarSign className="w-5 h-5" />}
                    iconBg="var(--v-orange-dim)"
                />
                <KPIBento
                    label="PEOPLE IN VENUE"
                    value={fmt(stats.totalCheckIns)}
                    trend={{ value: "+8.2%", direction: "up" }}
                    icon={<Users className="w-5 h-5" />}
                    iconBg="var(--v-success-bg)"
                />
                <KPIBento
                    label="AVG TURNOUT"
                    value={fmt(stats.avgTurnout, "percent")}
                    trend={{ value: "-2.1%", direction: "down" }}
                    icon={<Activity className="w-5 h-5" />}
                    iconBg="var(--v-warning-bg)"
                />
                <KPIBento
                    label="NET EARNINGS"
                    value={fmt(stats.totalNetPayable, "currency")}
                    trend={{ value: "+15%", direction: "up" }}
                    icon={<TrendingUp className="w-5 h-5" />}
                    iconBg="var(--v-info-bg)"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <BentoCard
                    className="lg:col-span-2"
                    header={<span className="v-label">REVENUE TIMELINE</span>}
                >
                    <VenueChart
                        type="area"
                        data={stats.revenueTimeline || []}
                        config={{ dataKey: "revenue", xKey: "date", color: "var(--v-chart-1)", gradientId: "overview-rev" }}
                        height={280}
                        title="Revenue Timeline"
                    />
                </BentoCard>

                <BentoCard
                    header={<span className="v-label">TOP EVENTS</span>}
                    empty={!stats.topEvents?.length}
                    emptyTitle="No events yet"
                >
                    <div className="space-y-1 pt-2">
                        {stats.topEvents?.map((event: any, i: number) => (
                            <div
                                key={event.id}
                                className="flex items-center justify-between py-3"
                                style={{ borderBottom: i < stats.topEvents.length - 1 ? "1px solid var(--v-border)" : undefined }}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-[11px] font-black w-5 text-center tabular-nums" style={{ color: "var(--v-text-muted)" }}>
                                        {i + 1}
                                    </span>
                                    <div>
                                        <p className="text-[13px] font-semibold truncate max-w-[140px]" style={{ color: "var(--v-text-primary)" }}>
                                            {event.title}
                                        </p>
                                        <p className="text-[11px]" style={{ color: "var(--v-text-muted)" }}>
                                            {event.issued} issued
                                        </p>
                                    </div>
                                </div>
                                <span className="text-[13px] font-bold tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                                    {fmt(event.revenue, "currency")}
                                </span>
                            </div>
                        ))}
                    </div>
                </BentoCard>
            </div>
        </div>
    );
}

function RevenueView({ stats }: { stats: any }) {
    return (
        <div className="space-y-6">
            <AppleHeroStat
                label="MONEY COLLECTED"
                value={fmt(stats.totalRevenue, "currency")}
                subtitle={`Net cleared: ${fmt(stats.totalNetPayable, "currency")}`}
            />

            <VenueStatStrip
                stats={[
                    { label: "GROSS REVENUE",  value: fmt(stats.totalRevenue, "currency") },
                    { label: "PLATFORM FEE",   value: fmt((stats.totalRevenue || 0) - (stats.totalNetPayable || 0), "currency") },
                    { label: "NET PAYABLE",    value: fmt(stats.totalNetPayable, "currency") },
                ]}
                columns={3}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BentoCard header={<span className="v-label">REVENUE BY EVENT</span>}>
                    <VenueChart
                        type="bar"
                        data={stats.revenueByEvent || []}
                        config={{ dataKey: "revenue", xKey: "title", color: "var(--v-chart-1)" }}
                        height={260}
                        title="Revenue by Event"
                    />
                </BentoCard>

                <BentoCard
                    header={<span className="v-label">RECENT PAYOUTS</span>}
                    empty={!stats.recentPayouts?.length}
                    emptyTitle="No payouts yet"
                >
                    <div className="space-y-3 pt-2">
                        {(stats.recentPayouts || []).map((p: any, i: number) => (
                            <div
                                key={p.id || i}
                                className="flex items-center justify-between px-4 py-3 rounded-2xl"
                                style={{ background: "var(--v-elevated)" }}
                            >
                                <div>
                                    <p className="text-[13px] font-semibold" style={{ color: "var(--v-text-primary)" }}>
                                        Payout #{p.id || `PY-${100 + i}`}
                                    </p>
                                    <p className="text-[11px] uppercase tracking-widest mt-0.5" style={{ color: "var(--v-text-muted)" }}>
                                        {p.date || "—"}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[13px] font-bold tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                                        {fmt(p.amount, "currency")}
                                    </p>
                                    <span
                                        className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                                        style={{ background: "var(--v-success-bg)", color: "var(--v-success)" }}
                                    >
                                        {p.status || "Settled"}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </BentoCard>
            </div>
        </div>
    );
}

function OpsView({ stats }: { stats: any }) {
    return (
        <div className="space-y-6">
            {stats.insights?.length > 0 && <InsightsPanel insights={stats.insights} />}

            <VenueStatStrip
                stats={[
                    {
                        label: "PEAK ENTRY WINDOW",
                        value: stats.peakEntryHour != null ? `${stats.peakEntryHour}:00` : "--",
                        liveIndicator: true,
                    },
                    {
                        label: "AVG ENTRY VELOCITY",
                        value: stats.avgEntryVelocity != null ? `${stats.avgEntryVelocity.toFixed(1)}/min` : "--",
                    },
                    {
                        label: "SCAN DENIALS",
                        value: stats.deniedStats?.total ?? "--",
                        trend: stats.deniedStats?.total > 10
                            ? { value: "High", direction: "down" as const }
                            : { value: "Low",  direction: "up"   as const },
                    },
                ]}
                columns={3}
            />

            <BentoCard header={<span className="v-label">ENTRY VELOCITY CURVE</span>}>
                <VenueChart
                    type="line"
                    data={(stats.entryCurve || []).map((c: any) => ({ ...c, label: `${c.hour}h` }))}
                    config={{ dataKey: "count", xKey: "label", color: "var(--v-success)" }}
                    height={280}
                    title="Entry Velocity Curve"
                />
            </BentoCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BentoCard
                    header={<span className="v-label">SCAN OUTCOMES</span>}
                    empty={!stats.deniedStats}
                    emptyTitle="No scan data"
                >
                    <div className="space-y-3 pt-2">
                        {[
                            { label: "Successful Entries", value: stats.totalCheckIns ?? "--", color: "var(--v-success)",  bg: "var(--v-success-bg)" },
                            { label: "Denied Entry",       value: stats.deniedStats?.total ?? "--", color: "var(--v-error)", bg: "var(--v-error-bg)" },
                            { label: "Re-entries",         value: stats.reentries ?? "--",     color: "var(--v-info)",    bg: "var(--v-info-bg)"  },
                        ].map((row) => (
                            <div
                                key={row.label}
                                className="flex items-center justify-between px-4 py-3 rounded-2xl"
                                style={{ background: row.bg }}
                            >
                                <span className="text-[12px] font-semibold" style={{ color: row.color }}>{row.label}</span>
                                <span className="text-[18px] font-bold tabular-nums" style={{ color: row.color }}>{row.value}</span>
                            </div>
                        ))}
                    </div>
                </BentoCard>

                <BentoCard header={<span className="v-label">PEAK HOUR DETAIL</span>}>
                    <div className="space-y-0 pt-2">
                        {[
                            { label: "Peak Entry Hour",      value: stats.peakEntryHour != null ? `${stats.peakEntryHour}:00` : "--" },
                            { label: "Entries in Peak Hour", value: fmt(stats.peakHourCount) },
                            { label: "Avg Wait Estimate",    value: stats.avgEntryTime ?? "--" },
                            { label: "Queue Clearance",      value: stats.queueClearance ?? "--" },
                        ].map((row) => (
                            <div
                                key={row.label}
                                className="flex items-center justify-between py-3"
                                style={{ borderBottom: "1px solid var(--v-border)" }}
                            >
                                <span className="text-[12px] font-medium" style={{ color: "var(--v-text-secondary)" }}>{row.label}</span>
                                <span className="text-[14px] font-bold tabular-nums" style={{ color: "var(--v-text-primary)" }}>{row.value}</span>
                            </div>
                        ))}
                    </div>
                </BentoCard>
            </div>
        </div>
    );
}

function AudienceView({ stats }: { stats: any }) {
    const total = stats.totalCheckedIn || stats.totalCheckIns || 1;
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPIBento
                    label="WOMEN RATIO"
                    value={fmt(stats.genderRatio?.female, "percent")}
                    trend={{ value: "+5%", direction: "up" }}
                    icon={<Users className="w-5 h-5" />}
                    iconBg="var(--v-info-bg)"
                />
                <KPIBento
                    label="REPEAT GUESTS"
                    value={fmt(stats.metrics?.repeatRate, "percent")}
                    trend={{ value: "+2%", direction: "up" }}
                    icon={<Activity className="w-5 h-5" />}
                    iconBg="var(--v-success-bg)"
                />
                <KPIBento
                    label="WOMEN'S LOYALTY"
                    value={fmt(stats.metrics?.femaleRetention, "percent")}
                    trend={{ value: "Stable", direction: "neutral" }}
                    icon={<TrendingUp className="w-5 h-5" />}
                    iconBg="var(--v-warning-bg)"
                />
                <KPIBento
                    label="FIRST-TIMERS"
                    value={fmt(stats.metrics?.firstTimeRate, "percent")}
                    trend={{ value: "-3%", direction: "down" }}
                    icon={<Zap className="w-5 h-5" />}
                    iconBg="var(--v-orange-dim)"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BentoCard header={<span className="v-label">AGE BREAKDOWN</span>}>
                    <div className="space-y-5 pt-2">
                        {Object.entries(stats.ageBands || {}).map(([band, count]: any) => {
                            const pct = ((count / total) * 100).toFixed(1);
                            return (
                                <div key={band}>
                                    <div className="flex justify-between mb-2">
                                        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>{band}</span>
                                        <span className="text-[11px] font-bold" style={{ color: "var(--v-text-secondary)" }}>{count} · {pct}%</span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--v-elevated)" }}>
                                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--v-chart-2)" }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </BentoCard>

                <BentoCard header={<span className="v-label">GENDER SPLIT</span>}>
                    <div className="flex items-center justify-around h-48 pt-4">
                        {Object.entries(stats.genderRatio || {}).map(([gender, pct]: any) => {
                            if (!pct) return null;
                            const colors: Record<string, string> = {
                                female: "var(--v-chart-2)",
                                male:   "var(--v-chart-1)",
                                other:  "var(--v-chart-3)",
                            };
                            return (
                                <div key={gender} className="text-center">
                                    <div
                                        className="text-[56px] font-bold leading-none tracking-tight tabular-nums mb-2"
                                        style={{ color: colors[gender] || "var(--v-text-primary)" }}
                                    >
                                        {typeof pct === "number" ? `${pct.toFixed(0)}%` : pct}
                                    </div>
                                    <p className="v-label">{gender}</p>
                                </div>
                            );
                        })}
                    </div>
                </BentoCard>
            </div>

            {stats.loyaltyTiers && (
                <BentoCard header={<span className="v-label">LOYALTY TIERS</span>}>
                    <div className="space-y-4 pt-2">
                        {(stats.loyaltyTiers as Array<{ label: string; count: number; pct: number }>).map((tier) => (
                            <div key={tier.label}>
                                <div className="flex justify-between mb-1.5">
                                    <span className="text-[12px] font-semibold" style={{ color: "var(--v-text-secondary)" }}>{tier.label}</span>
                                    <span className="text-[12px] font-bold tabular-nums" style={{ color: "var(--v-text-primary)" }}>{tier.count}</span>
                                </div>
                                <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "var(--v-elevated)" }}>
                                    <div
                                        className="h-full rounded-full"
                                        style={{ width: `${tier.pct || 0}%`, background: "var(--v-orange)" }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </BentoCard>
            )}
        </div>
    );
}

function ReachView({ stats }: { stats: any }) {
    const FUNNEL_COLORS = [
        "var(--v-chart-1)",
        "var(--v-chart-2)",
        "var(--v-chart-3)",
        "var(--v-chart-4)",
        "var(--v-chart-5)",
    ];
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPIBento
                    label="PURCHASE INTENT"
                    value={fmt(stats.funnel?.[0]?.count)}
                    trend={{ value: "+15%", direction: "up" }}
                    icon={<Target className="w-5 h-5" />}
                    iconBg="var(--v-orange-dim)"
                />
                <KPIBento
                    label="QUEUE CHECKOUT"
                    value={fmt(stats.funnel?.[1]?.count)}
                    trend={{ value: "+8%", direction: "up" }}
                    icon={<Activity className="w-5 h-5" />}
                    iconBg="var(--v-success-bg)"
                />
                <KPIBento
                    label="DEMAND PRESSURE"
                    value={`${(((stats.funnel?.[0]?.count || 0) / (stats.totalCapacity || 1000))).toFixed(1)}x`}
                    trend={{ value: "High", direction: "up" }}
                    icon={<Zap className="w-5 h-5" />}
                    iconBg="var(--v-warning-bg)"
                />
                <KPIBento
                    label="% BOOKED"
                    value={fmt(stats.conversionRate, "percent")}
                    trend={{ value: "+2%", direction: "up" }}
                    icon={<TrendingUp className="w-5 h-5" />}
                    iconBg="var(--v-info-bg)"
                />
            </div>

            <BentoCard header={<span className="v-label">CONVERSION FUNNEL</span>}>
                <div className="flex flex-col items-center gap-2 py-4 max-w-lg mx-auto">
                    {stats.funnel?.map((step: any, i: number) => (
                        <div key={step.stage} className="w-full flex justify-center">
                            <div
                                className="flex items-center justify-between px-6 py-4 rounded-2xl"
                                style={{
                                    width: `${100 - i * 16}%`,
                                    background: "var(--v-elevated)",
                                    borderLeft: `3px solid ${FUNNEL_COLORS[i % FUNNEL_COLORS.length]}`,
                                }}
                            >
                                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>
                                    {step.stage}
                                </span>
                                <span className="text-[20px] font-bold tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                                    {step.count?.toLocaleString() || "--"}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </BentoCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BentoCard header={<span className="v-label">TRAFFIC SOURCES</span>}>
                    <div className="space-y-4 pt-2">
                        {(stats.sources || []).map((s: any) => (
                            <div key={s.name}>
                                <div className="flex justify-between mb-1.5">
                                    <span className="text-[12px] font-semibold" style={{ color: "var(--v-text-secondary)" }}>{s.name}</span>
                                    <span className="text-[12px] font-bold tabular-nums" style={{ color: "var(--v-text-primary)" }}>{(s.pct ?? 0).toFixed(1)}%</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--v-elevated)" }}>
                                    <div className="h-full rounded-full" style={{ width: `${s.pct || 0}%`, background: "var(--v-chart-1)" }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </BentoCard>

                <BentoCard header={<span className="v-label">INTEREST OVER TIME</span>}>
                    <VenueChart
                        type="area"
                        data={stats.interestTimeline || []}
                        config={{ dataKey: "count", xKey: "date", color: "var(--v-chart-2)", gradientId: "reach-interest" }}
                        height={200}
                        title="Interest Over Time"
                    />
                </BentoCard>
            </div>
        </div>
    );
}

function EngagementView({ stats }: { stats: any }) {
    return (
        <div className="space-y-6">
            <AppleHeroStat
                label="TURNOUT RATE"
                value={fmt(stats.turnoutRate ?? stats.avgTurnout, "percent")}
                trend={{ value: "vs last period", direction: "neutral" }}
                subtitle={`${fmt(stats.totalCheckIns)} guests arrived · ${fmt(stats.totalTicketsSold)} issued`}
            />

            <BentoCard header={<span className="v-label">ARRIVAL TIMING</span>}>
                <VenueChart
                    type="area"
                    data={stats.arrivalTimeline || []}
                    config={{ dataKey: "count", xKey: "time", color: "var(--v-chart-1)", gradientId: "engagement-arrival" }}
                    height={280}
                    title="Arrival Timing Distribution"
                />
            </BentoCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <KPIBento
                    label="NO-SHOW RATE"
                    value={fmt(stats.noShowRate, "percent")}
                    trend={{ value: "-2%", direction: "down" }}
                    subtext="Issued entitlements that never checked in"
                    icon={<Activity className="w-5 h-5" />}
                    iconBg="var(--v-error-bg)"
                />
                <KPIBento
                    label="SCAN EFFICIENCY"
                    value={fmt(stats.scanEfficiency ?? 98, "percent")}
                    trend={{ value: "Stable", direction: "neutral" }}
                    subtext="Successful scans vs total attempts"
                    icon={<ShieldAlert className="w-5 h-5" />}
                    iconBg="var(--v-success-bg)"
                />
            </div>
        </div>
    );
}

function AttributionView({ stats }: { stats: any }) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPIBento
                    label="HOST IMPACT"
                    value="64%"
                    trend={{ value: "+4%", direction: "up" }}
                    icon={<Handshake className="w-5 h-5" />}
                    iconBg="var(--v-info-bg)"
                />
                <KPIBento
                    label="PROMOTER ROI"
                    value="₹14.2"
                    trend={{ value: "Optimal", direction: "neutral" }}
                    icon={<Target className="w-5 h-5" />}
                    iconBg="var(--v-success-bg)"
                />
                <KPIBento
                    label="VERIFIED ENTRY RATE"
                    value="82%"
                    trend={{ value: "+2%", direction: "up" }}
                    icon={<Activity className="w-5 h-5" />}
                    iconBg="var(--v-warning-bg)"
                />
                <KPIBento
                    label="TOP HOST REVENUE"
                    value="₹4.2L"
                    trend={{ value: "+12%", direction: "up" }}
                    icon={<DollarSign className="w-5 h-5" />}
                    iconBg="var(--v-orange-dim)"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BentoCard
                    header={<span className="v-label">HOST LEADERBOARD</span>}
                    empty={!stats.topHosts?.length}
                    emptyTitle="No host data yet"
                >
                    <div className="space-y-1 pt-2">
                        {stats.topHosts?.map((host: any, i: number) => (
                            <div
                                key={host.name}
                                className="flex items-center justify-between px-3 py-3 rounded-xl"
                                style={{ background: i === 0 ? "var(--v-orange-dim)" : "transparent" }}
                            >
                                <div className="flex items-center gap-3">
                                    <span
                                        className="text-[12px] font-black w-5 tabular-nums"
                                        style={{ color: i === 0 ? "var(--v-orange)" : "var(--v-text-muted)" }}
                                    >
                                        {i + 1}
                                    </span>
                                    <div>
                                        <p className="text-[13px] font-semibold" style={{ color: "var(--v-text-primary)" }}>{host.name}</p>
                                        <p className="text-[11px] uppercase tracking-widest" style={{ color: "var(--v-text-muted)" }}>{host.events} events</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[13px] font-bold tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                                        {fmt(host.revenue, "currency")}
                                    </p>
                                    <p className="text-[11px]" style={{ color: "var(--v-success)" }}>{host.tickets} sold</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </BentoCard>

                <BentoCard
                    header={<span className="v-label">PROMOTER ROI INDEX</span>}
                    empty={!stats.topPromoters?.length}
                    emptyTitle="No promoter data yet"
                >
                    <div className="space-y-1 pt-2">
                        {stats.topPromoters?.map((promoter: any, i: number) => (
                            <div
                                key={promoter.name}
                                className="flex items-center justify-between px-3 py-3 rounded-xl"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-[12px] font-black w-5 tabular-nums" style={{ color: "var(--v-text-muted)" }}>
                                        {i + 1}
                                    </span>
                                    <div>
                                        <p className="text-[13px] font-semibold" style={{ color: "var(--v-text-primary)" }}>{promoter.name}</p>
                                        <p className="text-[11px]" style={{ color: "var(--v-chart-2)" }}>{promoter.tickets} tickets</p>
                                    </div>
                                </div>
                                <p className="text-[13px] font-bold tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                                    {fmt(promoter.revenue, "currency")}
                                </p>
                            </div>
                        ))}
                    </div>
                </BentoCard>
            </div>
        </div>
    );
}

function TimelineView({ stats }: { stats: any }) {
    return (
        <div className="space-y-6">
            <EventTimeline
                data={stats.timeline}
                events={[
                    { percent: 30, type: "surge",    label: "Surge Triggered", time: "22:45" },
                    { percent: 65, type: "incident", label: "Gate Backup",     time: "00:15" },
                ]}
            />

            <BentoCard header={<span className="v-label">NIGHT TIMELINE</span>}>
                <VenueChart
                    type="area"
                    data={stats.minuteByMinute || stats.timeline || []}
                    config={{ dataKey: "count", xKey: "time", color: "var(--v-chart-3)", gradientId: "timeline-night" }}
                    height={280}
                    title="Night Timeline — Entry Flow"
                />
            </BentoCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BentoCard header={<span className="v-label">TIMELINE NARRATIVE</span>}>
                    <p className="text-[14px] leading-relaxed pt-2" style={{ color: "var(--v-text-secondary)" }}>
                        {stats.narrative ||
                            "The event maintained high demand pressure for 4 hours starting at 9 PM. Most conversions happened within 15 minutes of queue joins, indicating healthy inventory availability."}
                    </p>
                </BentoCard>

                <BentoCard header={<span className="v-label">PEAK INTERVALS</span>}>
                    <div className="space-y-0 pt-2">
                        {[
                            { label: "Peak Entry",   value: stats.summary?.peakEntriesAt },
                            { label: "Peak Demand",  value: stats.summary?.peakDemandAt },
                            { label: "Quietest Hour",value: stats.summary?.quietestHour },
                            { label: "Last Entry",   value: stats.summary?.lastEntryAt },
                        ].map((row) => (
                            <div
                                key={row.label}
                                className="flex items-center justify-between py-3"
                                style={{ borderBottom: "1px solid var(--v-border)" }}
                            >
                                <span className="text-[12px] font-medium" style={{ color: "var(--v-text-secondary)" }}>{row.label}</span>
                                <span className="text-[14px] font-bold tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                                    {row.value || "--"}
                                </span>
                            </div>
                        ))}
                    </div>
                </BentoCard>
            </div>
        </div>
    );
}

function StrategyView({ stats }: { stats: any }) {
    return (
        <div className="space-y-6">
            {stats.insights?.length > 0 && <InsightsPanel insights={stats.insights} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {stats.recommendations?.map((rec: any, i: number) => (
                    <BentoCard key={i} variant={rec.impact === "High" ? "accent" : "default"}>
                        <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
                            style={{ background: rec.impact === "High" ? "var(--v-warning-bg)" : "var(--v-elevated)" }}
                        >
                            {rec.impact === "High"
                                ? <Zap    className="w-5 h-5" style={{ color: "var(--v-warning)" }} />
                                : <Target className="w-5 h-5" style={{ color: "var(--v-success)" }} />
                            }
                        </div>
                        <span
                            className="inline-block text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full mb-3"
                            style={{
                                background: rec.impact === "High" ? "var(--v-warning-bg)" : "var(--v-success-bg)",
                                color:      rec.impact === "High" ? "var(--v-warning)"    : "var(--v-success)",
                            }}
                        >
                            {rec.impact} Impact
                        </span>
                        <h3 className="text-[16px] font-bold mb-2" style={{ color: "var(--v-text-primary)" }}>
                            {rec.title}
                        </h3>
                        <p className="text-[13px] leading-relaxed" style={{ color: "var(--v-text-secondary)" }}>
                            {rec.desc}
                        </p>
                        <button
                            className="mt-6 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest"
                            style={{ color: "var(--v-orange)" }}
                        >
                            Apply Strategy
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </BentoCard>
                ))}
            </div>
        </div>
    );
}
