"use client";

import { useEffect, useState, Suspense, lazy } from "react";
import type { ReactNode } from "react";
import {
    TrendingUp, DollarSign, Users, Activity, Ticket,
    ListChecks, PercentCircle, CalendarCheck, RefreshCw,
    Repeat2, Banknote, Download, Info,
    Sparkles, ArrowUpRight, Target, Shield, Zap, Award,
} from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { formatINR, formatINRCompact, formatPercent, formatNumberCompact } from "@/lib/utils/format";
import StudioShell from "@/components/studio/StudioShell";
import { useQuery } from "@tanstack/react-query";
type DateRange = { from: Date; to: Date } | undefined;
function subDays(date: Date, days: number): Date {
    return new Date(date.getTime() - days * 86_400_000);
}
import { BentoCard, KPIBento } from "@/components/ui/BentoCard";
import { VenueChart, ChartSkeleton } from "@/components/ui/VenueChart";
import { VenueStatStrip } from "@/components/ui/VenueStatStrip";
import {
    normalizeAnalyticsData,
    HEATMAP_DAYS,
    HEATMAP_HOURS,
    type AnalyticsDisplayModel,
} from "@/lib/analytics/zeroState";

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ");
}

// ── Recharts lazy loaders (advanced chart types) ──────────────────────────────

const LazyComposedRevenue = lazy(() =>
    (import("recharts") as any).then((m: any) => ({
        default: function ComposedRevChart({
            data,
            height,
        }: {
            data: { date: string; revenue: number; tickets: number }[];
            height: number;
        }) {
            const { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } = m;
            const Defs = "defs" as any;
            const LinearGradient = "linearGradient" as any;
            const Stop = "stop" as any;
            return (
                <div role="img" aria-label="Revenue & Tickets Overlay Chart">
                    <ResponsiveContainer width="100%" height={height}>
                        <ComposedChart data={data} margin={{ top: 8, right: 14, left: -20, bottom: 0 }}>
                            <Defs>
                                <LinearGradient id="comp-rev-grad" x1="0" y1="0" x2="0" y2="1">
                                    <Stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                                    <Stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                                </LinearGradient>
                            </Defs>
                            <CartesianGrid stroke="rgba(128,128,128,0.12)" vertical={false} />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10, fill: "#9B9B9F" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                yAxisId="rev"
                                tick={{ fontSize: 10, fill: "#9B9B9F" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                yAxisId="tix"
                                orientation="right"
                                tick={{ fontSize: 10, fill: "#9B9B9F" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: "var(--bg-elevated)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: 12,
                                    fontSize: 12,
                                    color: "var(--text-primary)",
                                }}
                                cursor={{ stroke: "rgba(128,128,128,0.20)" }}
                            />
                            <Area
                                yAxisId="rev"
                                type="monotone"
                                dataKey="revenue"
                                stroke="var(--chart-1)"
                                strokeWidth={2}
                                fill="url(#comp-rev-grad)"
                                isAnimationActive
                                name="Revenue (₹)"
                            />
                            <Line
                                yAxisId="tix"
                                type="monotone"
                                dataKey="tickets"
                                stroke="var(--chart-2)"
                                strokeWidth={1.5}
                                dot={false}
                                strokeDasharray="5 4"
                                isAnimationActive
                                name="Tickets"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            );
        },
    }))
);

const LazyDonut = lazy(() =>
    (import("recharts") as any).then((m: any) => ({
        default: function DonutChart({
            data,
            colors,
        }: {
            data: { name: string; value: number }[];
            colors: string[];
        }) {
            const { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } = m;
            return (
                <div role="img" aria-label="Gender Distribution Donut">
                    <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={46}
                                outerRadius={72}
                                paddingAngle={3}
                                dataKey="value"
                                strokeWidth={0}
                            >
                                {data.map((_: any, i: number) => (
                                    <Cell key={i} fill={colors[i % colors.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    background: "var(--bg-elevated)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: 12,
                                    fontSize: 12,
                                    color: "var(--text-primary)",
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            );
        },
    }))
);

const LazyScatter = lazy(() =>
    (import("recharts") as any).then((m: any) => ({
        default: function ScatterPlot({
            data,
            height,
        }: {
            data: { title: string; issued: number; revenue: number; conversion: number }[];
            height: number;
        }) {
            const { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid } = m;
            const scatterData = data.map((d: any) => ({
                x: d.issued,
                y: d.revenue,
                z: Math.max(d.conversion * 5, 20),
                name: d.title,
            }));
            return (
                <div role="img" aria-label="Events Scatter Plot">
                    <ResponsiveContainer width="100%" height={height}>
                        <ScatterChart margin={{ top: 12, right: 12, left: -20, bottom: 24 }}>
                            <CartesianGrid stroke="rgba(128,128,128,0.12)" />
                            <XAxis
                                type="number"
                                dataKey="x"
                                name="Attendance"
                                tick={{ fontSize: 10, fill: "#9B9B9F" }}
                                axisLine={false}
                                tickLine={false}
                                label={{
                                    value: "← Attendance →",
                                    position: "insideBottom",
                                    fontSize: 9,
                                    fill: "#9B9B9F",
                                    offset: -14,
                                }}
                            />
                            <YAxis
                                type="number"
                                dataKey="y"
                                name="Revenue"
                                tick={{ fontSize: 10, fill: "#9B9B9F" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <ZAxis type="number" dataKey="z" range={[40, 360]} />
                            <Tooltip
                                contentStyle={{
                                    background: "var(--bg-elevated)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: 12,
                                    fontSize: 12,
                                    color: "var(--text-primary)",
                                }}
                                cursor={{ strokeDasharray: "3 3", stroke: "rgba(128,128,128,0.25)" }}
                                formatter={(val: any, name: any) =>
                                    name === "Revenue"
                                        ? [formatINR(Number(val)), name]
                                        : [val, name]
                                }
                            />
                            <Scatter data={scatterData} fill="var(--accent)" opacity={0.82} />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            );
        },
    }))
);

const LazyRadialBar = lazy(() =>
    (import("recharts") as any).then((m: any) => ({
        default: function RadialBarWidget({
            data,
            height,
        }: {
            data: { name: string; value: number; fill: string }[];
            height: number;
        }) {
            const { RadialBarChart, RadialBar, Tooltip, ResponsiveContainer } = m;
            return (
                <div role="img" aria-label="Source Breakdown Radial">
                    <ResponsiveContainer width="100%" height={height}>
                        <RadialBarChart
                            cx="50%"
                            cy="50%"
                            innerRadius="18%"
                            outerRadius="90%"
                            barSize={10}
                            data={data}
                            startAngle={180}
                            endAngle={-180}
                        >
                            <RadialBar
                                minAngle={8}
                                clockWise
                                dataKey="value"
                                background={{ fill: "rgba(128,128,128,0.08)" }}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: "var(--bg-elevated)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: 12,
                                    fontSize: 12,
                                    color: "var(--text-primary)",
                                }}
                                formatter={(val: any) => [`${Number(val).toFixed(1)}%`, "Share"]}
                            />
                        </RadialBarChart>
                    </ResponsiveContainer>
                </div>
            );
        },
    }))
);

// ── Formatter ─────────────────────────────────────────────────────────────────

function fmt(n: number, type: "currency" | "percent" | "number" = "number"): string {
    if (type === "currency") return formatINRCompact(n);
    if (type === "percent")  return formatPercent(n);
    return formatNumberCompact(n);
}

// ── Global Category Config ───────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, { title: string; desc: string }> = {
    overview: {
        title: "Analytics Overview",
        desc: "Complete performance summary — revenue, attendance, funnel, and operations."
    },
    timeline: {
        title: "Timing Intelligence",
        desc: "Deep dive into booking windows, peak hours, and seasonal trends."
    },
    reach: {
        title: "Demand & Reach",
        desc: "Analyze purchase intent, ticket sales trends, and source performance."
    },
    engagement: {
        title: "Turnout & Engagement",
        desc: "Track fill rates, attendance consistency, and no-show analysis."
    },
    revenue: {
        title: "Money Intelligence",
        desc: "Detailed breakdown of revenue, platform fees, and finance status."
    },
    audience: {
        title: "Crowd & Audience",
        desc: "Demographics, loyalty patterns, and guest quality scores."
    },
    ops: {
        title: "Gate & Operations",
        desc: "Scanner efficiency, entry velocity, and door management metrics."
    },
    attribution: {
        title: "Partner Attribution",
        desc: "Performance tracking for hosts, promoters, and external sources."
    }
};

// ── Main client ───────────────────────────────────────────────────────────────

export default function UnifiedAnalyticsClient({
    role,
    idParam
}: {
    role: "venue" | "host" | "promoter";
    idParam: string;
}) {
    const params = useParams();
    const searchParams = useSearchParams();

    // Determine category from props, path param, or search param
    const category = (params.category || searchParams.get("tab") || "overview") as string;
    const catConfig = CATEGORY_MAP[category] || CATEGORY_MAP.overview;

    const { profile } = useDashboardAuth();
    const entityId = profile?.activeMembership?.partnerId;

    const [range, setRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 30),
        to: new Date(),
    });
    const [eventId, setEventId] = useState<string>("all");

    const { data: analyticsData, isLoading, isError } = useQuery({
        queryKey: [role, "analytics", entityId, eventId, range],
        queryFn: async () => {
            const url = `/api/${role}/analytics/overview?${idParam}=${entityId}&eventId=${eventId}`;
            const r = await fetch(url);
            if (!r.ok) return null;
            return r.json();
        },
        enabled: !!entityId,
    });

    const data = normalizeAnalyticsData(analyticsData);

    const shouldShow = (sectionCat: string | string[]) => {
        if (category === "overview") return true;
        if (Array.isArray(sectionCat)) return sectionCat.includes(category);
        return sectionCat === category;
    };

    return (
        <StudioShell
            role={role}
            title={catConfig.title}
            description={catConfig.desc}
            onRangeChange={(r) => {
                const days = parseInt(r) || 30;
                setRange({ from: subDays(new Date(), days), to: new Date() });
            }}
            onEventChange={setEventId}
        >
            <div className="space-y-4 pb-20">
                {/* Zero-data notice */}
                {!isLoading && !data.hasData && (
                    <div
                        className="flex items-center gap-3 px-5 py-3 rounded-2xl border"
                        style={{ background: "var(--bg-fill)", borderColor: "var(--border-subtle)" }}
                    >
                        <Info className="w-4 h-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                        <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                            No analytics recorded yet — all metrics will populate after your first event goes live.
                            Values below show the exact structure that real data will fill.
                        </p>
                    </div>
                )}

                {/* Error notice */}
                {isError && (
                    <div
                        className="flex items-center gap-3 px-5 py-3 rounded-2xl border"
                        style={{ background: "var(--color-error-bg)", borderColor: "var(--color-error)" }}
                    >
                        <RefreshCw className="w-4 h-4" style={{ color: "var(--color-error)" }} />
                        <p className="text-[13px]" style={{ color: "var(--color-error)" }}>
                            Could not load analytics data. Showing last-known values.
                        </p>
                    </div>
                )}

                {shouldShow(["overview", "timeline", "reach", "revenue", "ops", "engagement"]) && (
                    <KPISection data={data} loading={isLoading} category={category} />
                )}

                {shouldShow(["overview", "reach", "engagement", "audience", "ops"]) && (
                    <PerformanceRingsSection data={data} loading={isLoading} category={category} />
                )}

                {shouldShow(["overview", "revenue", "reach"]) && (
                    <RevenueSection data={data} loading={isLoading} />
                )}

                {shouldShow(["overview", "reach", "timeline"]) && (
                    <TicketsGuestlistSection data={data} loading={isLoading} />
                )}

                {shouldShow(["overview", "audience"]) && (
                    <AudienceSection data={data} loading={isLoading} />
                )}

                {shouldShow(["overview", "reach"]) && (
                    <FunnelSection data={data} loading={isLoading} />
                )}

                {shouldShow(["overview", "ops", "engagement"]) && (
                    <ScannerSection data={data} loading={isLoading} />
                )}

                {shouldShow(["overview", "timeline"]) && (
                    <EventComparisonSection data={data} loading={isLoading} />
                )}

                {shouldShow(["overview", "reach", "timeline", "attribution"]) && (
                    <SourceHeatmapSection data={data} loading={isLoading} />
                )}

                {shouldShow(["overview", "revenue"]) && (
                    <FinanceSection data={data} loading={isLoading} />
                )}

                {shouldShow(["overview", "attribution", "revenue"]) && (
                    <TableSection data={data} loading={isLoading} />
                )}

                {shouldShow("overview") && (
                    <InsightsSection data={data} loading={isLoading} />
                )}
            </div>
        </StudioShell>
    );
}

// ── Section: KPI Grid ─────────────────────────────────────────────────────────

function KPISection({ data, loading, category }: { data: AnalyticsDisplayModel; loading: boolean; category: string }) {
    const kpis = [
        {
            label: "TOTAL REVENUE",
            category: ["overview", "revenue"],
            value: fmt(data.totalRevenue, "currency"),
            trend: { value: data.revenueTrend, direction: data.revenueTrendDir },
            icon: <DollarSign className="w-4 h-4" style={{ color: "var(--accent)" }} />,
            iconBg: "var(--accent-muted)",
        },
        {
            label: "TICKETS SOLD",
            category: ["overview", "reach"],
            value: fmt(data.ticketsSold),
            trend: { value: data.ticketsTrend, direction: data.ticketsTrendDir },
            icon: <Ticket className="w-4 h-4" style={{ color: "var(--color-info)" }} />,
            iconBg: "var(--color-info-bg)",
        },
        {
            label: "GUESTLIST SIGNUPS",
            category: ["overview", "reach"],
            value: fmt(data.guestlistSignups),
            icon: <ListChecks className="w-4 h-4" style={{ color: "var(--color-success)" }} />,
            iconBg: "var(--color-success-bg)",
        },
        {
            label: "CHECK-INS",
            category: ["overview", "engagement", "ops", "timeline"],
            value: fmt(data.checkins),
            trend: { value: data.checkinsTrend, direction: data.checkinsTrendDir },
            icon: <CalendarCheck className="w-4 h-4" style={{ color: "var(--color-success)" }} />,
            iconBg: "var(--color-success-bg)",
        },
        {
            label: "CONVERSION RATE",
            category: ["overview", "reach"],
            value: fmt(data.conversionRate, "percent"),
            icon: <PercentCircle className="w-4 h-4" style={{ color: "var(--color-warning)" }} />,
            iconBg: "var(--color-warning-bg)",
        },
        {
            label: "ACTIVE EVENTS",
            category: ["overview", "timeline", "attribution"],
            value: fmt(data.activeEvents),
            icon: <Activity className="w-4 h-4" style={{ color: "var(--chart-5)" }} />,
            iconBg: "rgba(244,114,182,0.10)",
        },
        {
            label: "AVG TICKET PRICE",
            category: ["overview", "reach", "revenue"],
            value: fmt(data.avgTicketPrice, "currency"),
            icon: <TrendingUp className="w-4 h-4" style={{ color: "var(--color-info)" }} />,
            iconBg: "var(--color-info-bg)",
        },
        {
            label: "REFUNDS",
            category: ["overview", "revenue", "ops"],
            value: fmt(data.refunds),
            icon: <RefreshCw className="w-4 h-4" style={{ color: "var(--color-error)" }} />,
            iconBg: "var(--color-error-bg)",
        },
        {
            label: "PAYOUTS PROCESSED",
            category: ["overview", "revenue"],
            value: fmt(data.payoutsProcessed, "currency"),
            icon: <Banknote className="w-4 h-4" style={{ color: "var(--color-success)" }} />,
            iconBg: "var(--color-success-bg)",
        },
        {
            label: "REPEAT GUEST RATE",
            category: ["overview", "engagement", "audience"],
            value: fmt(data.repeatGuestRate, "percent"),
            icon: <Repeat2 className="w-4 h-4" style={{ color: "var(--color-warning)" }} />,
            iconBg: "var(--color-warning-bg)",
        },
    ];

    const filteredKpis = category === "overview" ? kpis : kpis.filter(k => k.category.includes(category));

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {filteredKpis.map(k => (
                <KPIBento
                    key={k.label}
                    label={k.label}
                    value={k.value}
                    trend={k.trend as any}
                    icon={k.icon}
                    iconBg={k.iconBg}
                    loading={loading}
                />
            ))}
        </div>
    );
}

// ── Section: Performance Score Rings ──────────────────────────────────────────

function PerformanceRingsSection({ data, loading, category }: { data: AnalyticsDisplayModel; loading: boolean; category: string }) {
    const scannerEfficiency =
        data.totalScans > 0 ? (data.successfulScans / data.totalScans) * 100 : 0;

    const rings = [
        {
            label: "Conversion Rate",
            category: ["overview", "reach", "revenue"],
            value: data.conversionRate,
            color: "var(--chart-1)",
            icon: <PercentCircle className="w-3.5 h-3.5" />,
            sublabel: "purchases / page views",
        },
        {
            label: "Fill Rate",
            category: ["overview", "engagement"],
            value: data.avgTurnout,
            color: "var(--chart-2)",
            icon: <Target className="w-3.5 h-3.5" />,
            sublabel: "attendance vs capacity",
        },
        {
            label: "Scanner Efficiency",
            category: ["overview", "ops"],
            value: scannerEfficiency,
            color: "var(--color-success)",
            icon: <Shield className="w-3.5 h-3.5" />,
            sublabel: "successful / total scans",
        },
        {
            label: "Repeat Rate",
            category: ["overview", "engagement", "audience"],
            value: data.repeatGuestRate,
            color: "var(--color-warning)",
            icon: <Repeat2 className="w-3.5 h-3.5" />,
            sublabel: "returning guests",
        },
    ];

    const filteredRings = category === "overview" ? rings : rings.filter(r => r.category.includes(category));
    if (filteredRings.length === 0) return null;

    return (
        <BentoCard
            loading={loading}
            header={
                <div className="flex items-center gap-2">
                    <Award className="w-4 h-4" style={{ color: "var(--accent)" }} />
                    <span className="v-label">PERFORMANCE SCORES</span>
                </div>
            }
        >
            {!loading && (
                <div className={cn(
                    "grid gap-6 py-4",
                    filteredRings.length === 4 ? "grid-cols-2 sm:grid-cols-4" :
                    filteredRings.length === 3 ? "grid-cols-1 sm:grid-cols-3" :
                    filteredRings.length === 2 ? "grid-cols-2" : "grid-cols-1"
                )}>
                    {filteredRings.map(ring => (
                        <RadialRing key={ring.label} {...ring} />
                    ))}
                </div>
            )}
        </BentoCard>
    );
}

function RadialRing({
    label,
    value,
    color,
    icon,
    sublabel,
}: {
    label: string;
    value: number;
    color: string;
    icon: ReactNode;
    sublabel: string;
}) {
    const SIZE = 96;
    const STROKE = 7;
    const R = (SIZE - STROKE) / 2;
    const C = 2 * Math.PI * R;
    const pct = Math.min(value / 100, 1);
    const offset = C - pct * C;

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative" style={{ width: SIZE, height: SIZE }}>
                <svg
                    width={SIZE}
                    height={SIZE}
                    viewBox={`0 0 ${SIZE} ${SIZE}`}
                    style={{ transform: "rotate(-90deg)" }}
                >
                    <circle
                        cx={SIZE / 2}
                        cy={SIZE / 2}
                        r={R}
                        fill="none"
                        stroke="rgba(128,128,128,0.15)"
                        strokeWidth={STROKE}
                    />
                    <circle
                        cx={SIZE / 2}
                        cy={SIZE / 2}
                        r={R}
                        fill="none"
                        stroke={color}
                        strokeWidth={STROKE}
                        strokeLinecap="round"
                        strokeDasharray={C}
                        strokeDashoffset={offset}
                        style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 6px ${color})` }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span
                        className="text-[18px] font-bold tabular-nums leading-none"
                        style={{ color: "var(--text-primary)" }}
                    >
                        {value.toFixed(0)}%
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-1.5">
                <span style={{ color }}>{icon}</span>
                <p
                    className="text-[10px] font-bold uppercase tracking-widest text-center"
                    style={{ color: "var(--text-secondary)" }}
                >
                    {label}
                </p>
            </div>
            <p className="text-[10px] text-center" style={{ color: "var(--text-tertiary)" }}>
                {sublabel}
            </p>
        </div>
    );
}

// ── Section: Revenue Chart ─────────────────────────────────────────────────────

function RevenueSection({ data, loading }: { data: AnalyticsDisplayModel; loading: boolean }) {
    const [gran, setGran] = useState<"day" | "week" | "month">("day");
    const [chartMode, setChartMode] = useState<"single" | "overlay">("single");

    const summary = [
        { label: "GROSS REVENUE", value: fmt(data.grossSales, "currency"), color: "var(--accent)" },
        { label: "NET PAYABLE",   value: fmt(data.netSales, "currency"),   color: "var(--color-success)" },
        { label: "PLATFORM FEE",  value: fmt(data.platformFees, "currency"), color: "var(--color-error)" },
        { label: "AVG TURNOUT",   value: fmt(data.avgTurnout, "percent"),  color: "var(--color-info)" },
    ];

    const mergedTimeline = data.revenueTimeline.map((r, i) => ({
        date: r.date,
        revenue: r.revenue,
        tickets: data.ticketsTimeline[i]?.tickets ?? 0,
    }));

    return (
        <BentoCard
            loading={loading}
            header={
                <div className="flex items-center justify-between w-full flex-wrap gap-2">
                    <span className="v-label">REVENUE ANALYTICS</span>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div
                            className="flex items-center gap-1 p-0.5 rounded-xl border border-[var(--border-subtle)]"
                            style={{ background: "var(--bg-fill)" }}
                        >
                            {(["single", "overlay"] as const).map(m => (
                                <button
                                    key={m}
                                    onClick={() => setChartMode(m)}
                                    className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                    style={{
                                        background: chartMode === m ? "var(--bg-elevated)" : "transparent",
                                        color: chartMode === m ? "var(--text-primary)" : "var(--text-tertiary)",
                                        boxShadow: chartMode === m ? "var(--shadow-sm)" : "none",
                                    }}
                                >
                                    {m === "single" ? "Revenue" : "Rev + Tickets"}
                                </button>
                            ))}
                        </div>
                        <div
                            className="flex items-center gap-1 p-0.5 rounded-xl border border-[var(--border-subtle)]"
                            style={{ background: "var(--bg-fill)" }}
                        >
                            {(["day", "week", "month"] as const).map(g => (
                                <button
                                    key={g}
                                    onClick={() => setGran(g)}
                                    className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                    style={{
                                        background: gran === g ? "var(--bg-elevated)" : "transparent",
                                        color: gran === g ? "var(--text-primary)" : "var(--text-tertiary)",
                                        boxShadow: gran === g ? "var(--shadow-sm)" : "none",
                                    }}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            }
        >
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[var(--border-subtle)] mb-4 rounded-xl overflow-hidden border border-[var(--border-subtle)]">
                {summary.map(s => (
                    <div key={s.label} className="px-4 py-3" style={{ borderTop: `2px solid ${s.color}` }}>
                        <p className="v-label mb-1">{s.label}</p>
                        <p
                            className="text-[20px] font-bold tabular-nums leading-none"
                            style={{ color: loading ? "var(--text-tertiary)" : s.color }}
                        >
                            {loading ? "—" : s.value}
                        </p>
                    </div>
                ))}
            </div>

            {!loading && (
                <>
                    {chartMode === "overlay" ? (
                        <>
                            <div className="flex items-center gap-4 mb-3">
                                <LegendDot color="var(--chart-1)" label="Revenue (left axis)" />
                                <LegendDot
                                    color="var(--chart-2)"
                                    label="Tickets (right axis)"
                                    dashed
                                />
                            </div>
                            <Suspense fallback={<ChartSkeleton height={260} />}>
                                <LazyComposedRevenue data={mergedTimeline} height={260} />
                            </Suspense>
                        </>
                    ) : (
                        <VenueChart
                            type="area"
                            data={data.revenueTimeline}
                            config={{
                                dataKey: "revenue",
                                xKey: "date",
                                color: "var(--chart-1)",
                                gradientId: "overview-rev",
                            }}
                            height={260}
                            title="Revenue Timeline"
                        />
                    )}
                    {!data.hasData && (
                        <p
                            className="text-center text-[11px] mt-2 font-medium uppercase tracking-widest"
                            style={{ color: "var(--text-tertiary)" }}
                        >
                            Revenue will plot here after your first ticket sale
                        </p>
                    )}
                </>
            )}
        </BentoCard>
    );
}

// ── Section: Ticket Sales + Guestlist ────────────────────────────────────────

function TicketsGuestlistSection({ data, loading }: { data: AnalyticsDisplayModel; loading: boolean }) {
    const genderTotal =
        data.genderRatio.female + data.genderRatio.male + data.genderRatio.other || 1;
    const hasGenderData = genderTotal > 1;

    const genderSplit = [
        { name: "Female", value: data.genderRatio.female, color: "var(--chart-2)" },
        { name: "Male", value: data.genderRatio.male, color: "var(--chart-1)" },
        { name: "Other", value: data.genderRatio.other, color: "var(--chart-3)" },
    ];

    const donutData = hasGenderData
        ? genderSplit.map(g => ({ name: g.name, value: g.value }))
        : [{ name: "No data", value: 1 }];

    const donutColors = hasGenderData
        ? genderSplit.map(g => g.color)
        : ["rgba(128,128,128,0.15)"];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <BentoCard
                className="lg:col-span-2"
                loading={loading}
                header={
                    <div className="flex items-center justify-between w-full">
                        <span className="v-label">TICKET SALES OVER TIME</span>
                        <div className="flex items-center gap-3">
                            <LegendDot color="var(--chart-1)" label="Paid" />
                            <LegendDot color="var(--chart-2)" label="Guestlist" />
                        </div>
                    </div>
                }
            >
                {!loading && (
                    <>
                        <VenueChart
                            type="bar"
                            data={data.ticketsTimeline}
                            config={{ dataKey: "tickets", xKey: "date", color: "var(--chart-1)" }}
                            height={220}
                            title="Ticket Sales Over Time"
                        />
                        {!data.hasData && (
                            <p
                                className="text-center text-[11px] mt-2 font-medium uppercase tracking-widest"
                                style={{ color: "var(--text-tertiary)" }}
                            >
                                No ticket sales in selected range
                            </p>
                        )}
                    </>
                )}
            </BentoCard>

            <BentoCard loading={loading} header={<span className="v-label">GUESTLIST & AUDIENCE</span>}>
                {!loading && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { label: "Signups", value: fmt(data.guestlistSignups) },
                                { label: "Check-ins", value: fmt(data.checkins) },
                                {
                                    label: "No-show",
                                    value: fmt(Math.max(0, data.guestlistSignups - data.checkins)),
                                },
                                { label: "Conversion", value: fmt(data.conversionRate, "percent") },
                            ].map(m => (
                                <div
                                    key={m.label}
                                    className="px-3 py-2.5 rounded-xl"
                                    style={{ background: "var(--bg-fill)" }}
                                >
                                    <p className="v-label mb-0.5">{m.label}</p>
                                    <p
                                        className="text-[18px] font-bold tabular-nums leading-none"
                                        style={{ color: "var(--text-primary)" }}
                                    >
                                        {m.value}
                                    </p>
                                </div>
                            ))}
                        </div>

                        <div>
                            <p className="v-label mb-2">GENDER SPLIT</p>
                            <div className="relative">
                                <Suspense fallback={<ChartSkeleton height={180} />}>
                                    <LazyDonut data={donutData} colors={donutColors} />
                                </Suspense>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="text-center">
                                        <p
                                            className="text-[11px] font-bold"
                                            style={{ color: "var(--text-tertiary)" }}
                                        >
                                            {hasGenderData ? "Total" : "No data"}
                                        </p>
                                        {hasGenderData && (
                                            <p
                                                className="text-[15px] font-bold tabular-nums"
                                                style={{ color: "var(--text-primary)" }}
                                            >
                                                {fmt(genderTotal)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {hasGenderData && (
                                <div className="flex justify-center gap-4 mt-2">
                                    {genderSplit.map(g => (
                                        <div key={g.name} className="flex items-center gap-1.5">
                                            <div
                                                className="w-2 h-2 rounded-full"
                                                style={{ background: g.color }}
                                            />
                                            <span
                                                className="text-[10px] font-semibold"
                                                style={{ color: "var(--text-tertiary)" }}
                                            >
                                                {g.name}{" "}
                                                {((g.value / genderTotal) * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </BentoCard>
        </div>
    );
}

// ── Section: Audience Intelligence ────────────────────────────────────────────

const AGE_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
];

function AudienceSection({ data, loading }: { data: AnalyticsDisplayModel; loading: boolean }) {
    const ageBandEntries = Object.entries(data.ageBands);
    const totalAge = ageBandEntries.reduce((sum, [, v]) => sum + v, 0) || 1;

    const peakInterestDay = data.hasData
        ? data.interestTimeline.reduce(
              (a, b) => (b.count > a.count ? b : a),
              data.interestTimeline[0] ?? { date: "—", count: 0 }
          ).date
        : "—";

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Age demographics */}
            <BentoCard
                loading={loading}
                header={
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" style={{ color: "var(--accent)" }} />
                        <span className="v-label">AGE DEMOGRAPHICS</span>
                    </div>
                }
            >
                {!loading && (
                    <div className="space-y-5 pt-2">
                        {ageBandEntries.map(([band, count], i) => {
                            const pct = (count / totalAge) * 100;
                            const displayPct = data.hasData ? pct : 0;
                            return (
                                <div key={band}>
                                    <div className="flex items-end justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-2.5 h-2.5 rounded-sm"
                                                style={{ background: AGE_COLORS[i % AGE_COLORS.length] }}
                                            />
                                            <span
                                                className="text-[13px] font-semibold"
                                                style={{ color: "var(--text-primary)" }}
                                            >
                                                {band}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span
                                                className="text-[12px] font-bold tabular-nums"
                                                style={{ color: "var(--text-secondary)" }}
                                            >
                                                {data.hasData ? fmt(count) : "0"} guests
                                            </span>
                                            <span
                                                className="text-[11px] ml-2 font-bold"
                                                style={{ color: AGE_COLORS[i % AGE_COLORS.length] }}
                                            >
                                                {displayPct.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                    <div
                                        className="relative h-3 w-full rounded-full overflow-hidden"
                                        style={{ background: "var(--bg-fill)" }}
                                    >
                                        <div
                                            className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                                            style={{
                                                width: `${displayPct}%`,
                                                background: `linear-gradient(90deg, ${AGE_COLORS[i % AGE_COLORS.length]}, ${AGE_COLORS[(i + 1) % AGE_COLORS.length]})`,
                                                minWidth: displayPct > 0 ? 4 : 0,
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        {!data.hasData && (
                            <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                                Age data populates after guests complete profiles
                            </p>
                        )}
                    </div>
                )}
            </BentoCard>

            {/* Interest timeline */}
            <BentoCard
                loading={loading}
                header={
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4" style={{ color: "var(--accent)" }} />
                            <span className="v-label">INTEREST TREND</span>
                        </div>
                        <span
                            className="text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-lg"
                            style={{ background: "var(--bg-fill)", color: "var(--text-tertiary)" }}
                        >
                            30 days
                        </span>
                    </div>
                }
            >
                {!loading && (
                    <>
                        <div className="flex gap-6 mb-4">
                            {[
                                {
                                    label: "TOTAL INTEREST",
                                    value: fmt(
                                        data.interestTimeline.reduce((s, d) => s + d.count, 0)
                                    ),
                                },
                                { label: "PEAK DAY", value: peakInterestDay },
                            ].map(s => (
                                <div key={s.label}>
                                    <p className="v-label mb-0.5">{s.label}</p>
                                    <p
                                        className="text-[18px] font-bold tabular-nums"
                                        style={{ color: "var(--text-primary)" }}
                                    >
                                        {s.value}
                                    </p>
                                </div>
                            ))}
                        </div>
                        <VenueChart
                            type="area"
                            data={data.interestTimeline}
                            config={{
                                dataKey: "count",
                                xKey: "date",
                                color: "var(--chart-3)",
                                gradientId: "interest-grad",
                            }}
                            height={180}
                            title="Interest Trend"
                        />
                        {!data.hasData && (
                            <p
                                className="text-center text-[11px] mt-2 font-medium uppercase tracking-widest"
                                style={{ color: "var(--text-tertiary)" }}
                            >
                                Interest signals appear when guests view or save events
                            </p>
                        )}
                    </>
                )}
            </BentoCard>
        </div>
    );
}

// ── Section: Conversion Funnel ────────────────────────────────────────────────

const FUNNEL_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--color-success)",
];

function FunnelSection({ data, loading }: { data: AnalyticsDisplayModel; loading: boolean }) {
    const maxCount = Math.max(...data.funnel.map(f => f.count), 1);

    return (
        <BentoCard loading={loading} header={<span className="v-label">CONVERSION FUNNEL</span>}>
            {!loading && (
                <div className="flex flex-col items-center gap-2 py-4 max-w-2xl mx-auto w-full">
                    {data.funnel.map((step, i) => {
                        const widthPct = 100 - i * 13;
                        const prevCount = i === 0 ? step.count : data.funnel[i - 1].count;
                        const dropPct =
                            prevCount > 0
                                ? (((prevCount - step.count) / prevCount) * 100).toFixed(0)
                                : "0";
                        const color = FUNNEL_COLORS[i % FUNNEL_COLORS.length];
                        const barPct = maxCount > 0 ? (step.count / maxCount) * 100 : 5;

                        return (
                            <div key={step.stage} className="w-full flex flex-col items-center">
                                {i > 0 && (
                                    <div className="flex items-center gap-2 my-1">
                                        <div
                                            className="h-4 w-px"
                                            style={{ background: "var(--border-subtle)" }}
                                        />
                                        <span
                                            className="text-[10px] font-bold uppercase tracking-widest"
                                            style={{ color: "var(--text-tertiary)" }}
                                        >
                                            {data.hasData ? `−${dropPct}% drop` : "0% drop"}
                                        </span>
                                    </div>
                                )}
                                <div
                                    className="flex items-center justify-between px-6 py-3.5 rounded-2xl transition-all"
                                    style={{
                                        width: `${widthPct}%`,
                                        background: `linear-gradient(90deg, ${color}1f 0%, var(--bg-fill) 55%)`,
                                        border: `1px solid ${color}28`,
                                        borderLeft: `3px solid ${color}`,
                                    }}
                                >
                                    <span
                                        className="text-[11px] font-bold uppercase tracking-widest"
                                        style={{ color }}
                                    >
                                        {step.stage}
                                    </span>
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="h-1.5 w-20 rounded-full overflow-hidden"
                                            style={{ background: "var(--border-subtle)" }}
                                        >
                                            <div
                                                className="h-full rounded-full transition-all duration-700"
                                                style={{
                                                    width: `${data.hasData ? barPct : 3}%`,
                                                    background: color,
                                                }}
                                            />
                                        </div>
                                        <span
                                            className="text-[22px] font-bold tabular-nums leading-none"
                                            style={{ color: "var(--text-primary)" }}
                                        >
                                            {step.count > 0 ? step.count.toLocaleString() : "0"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {!data.hasData && (
                        <p
                            className="text-[11px] mt-3 font-medium uppercase tracking-widest"
                            style={{ color: "var(--text-tertiary)" }}
                        >
                            Funnel will populate after discovery & booking activity begins
                        </p>
                    )}
                </div>
            )}
        </BentoCard>
    );
}

// ── Section: Entry / Scanner ──────────────────────────────────────────────────

function ScannerSection({ data, loading }: { data: AnalyticsDisplayModel; loading: boolean }) {
    const scannerEfficiency =
        data.totalScans > 0 ? (data.successfulScans / data.totalScans) * 100 : 0;

    const scanRows = [
        {
            label: "Successful Entries",
            value: data.successfulScans,
            color: "var(--color-success)",
            bg: "var(--color-success-bg)",
        },
        {
            label: "Rejected Scans",
            value: data.rejectedScans,
            color: "var(--color-error)",
            bg: "var(--color-error-bg)",
        },
        {
            label: "Duplicate Attempts",
            value: data.duplicateScans,
            color: "var(--color-warning)",
            bg: "var(--color-warning-bg)",
        },
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <BentoCard
                className="lg:col-span-2"
                loading={loading}
                header={<span className="v-label">ENTRY VELOCITY BY HOUR</span>}
            >
                {!loading && (
                    <>
                        <VenueStatStrip
                            stats={[
                                { label: "TOTAL SCANS", value: fmt(data.totalScans) },
                                {
                                    label: "PEAK HOUR",
                                    value:
                                        data.peakEntryHour != null ? `${data.peakEntryHour}:00` : "—",
                                },
                                {
                                    label: "AVG/MIN",
                                    value:
                                        data.avgEntryVelocity > 0
                                            ? `${data.avgEntryVelocity.toFixed(1)}/min`
                                            : "—",
                                },
                            ]}
                            columns={3}
                        />
                        <div className="mt-4">
                            <VenueChart
                                type="bar"
                                data={data.entryCurve}
                                config={{
                                    dataKey: "count",
                                    xKey: "hour",
                                    color: "var(--color-success)",
                                }}
                                height={200}
                                title="Entry Velocity by Hour"
                            />
                        </div>
                        {!data.hasData && (
                            <p
                                className="text-center text-[11px] mt-2 font-medium uppercase tracking-widest"
                                style={{ color: "var(--text-tertiary)" }}
                            >
                                No check-ins available — hourly entry flow will appear here
                            </p>
                        )}
                    </>
                )}
            </BentoCard>

            <BentoCard loading={loading} header={<span className="v-label">SCAN OUTCOMES</span>}>
                {!loading && (
                    <div className="space-y-3 pt-1">
                        {/* Arc gauge */}
                        <div className="flex justify-center pt-2 pb-1">
                            <SVGGauge
                                value={scannerEfficiency}
                                label="Scanner Efficiency"
                                color="var(--color-success)"
                            />
                        </div>

                        {scanRows.map(row => (
                            <div
                                key={row.label}
                                className="flex items-center justify-between px-4 py-3 rounded-2xl"
                                style={{ background: row.bg }}
                            >
                                <span
                                    className="text-[12px] font-semibold"
                                    style={{ color: row.color }}
                                >
                                    {row.label}
                                </span>
                                <span
                                    className="text-[20px] font-bold tabular-nums"
                                    style={{ color: row.color }}
                                >
                                    {fmt(row.value)}
                                </span>
                            </div>
                        ))}

                        {[
                            {
                                label: "Peak Entry Hour",
                                value:
                                    data.peakEntryHour != null ? `${data.peakEntryHour}:00` : "—",
                            },
                            {
                                label: "Avg Entry Velocity",
                                value:
                                    data.avgEntryVelocity > 0
                                        ? `${data.avgEntryVelocity.toFixed(1)}/min`
                                        : "—",
                            },
                        ].map(row => (
                            <div
                                key={row.label}
                                className="flex items-center justify-between py-2.5"
                                style={{ borderBottom: "1px solid var(--border-subtle)" }}
                            >
                                <span
                                    className="text-[12px]"
                                    style={{ color: "var(--text-secondary)" }}
                                >
                                    {row.label}
                                </span>
                                <span
                                    className="text-[13px] font-bold tabular-nums"
                                    style={{ color: "var(--text-primary)" }}
                                >
                                    {row.value}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </BentoCard>
        </div>
    );
}

// SVG arc gauge (semi-circle speedometer style)
function SVGGauge({ value, label, color }: { value: number; label: string; color: string }) {
    const R = 52;
    const totalLen = Math.PI * R;
    const pct = Math.min(value / 100, 1);
    const dashArray = `${pct * totalLen} ${totalLen}`;

    return (
        <div className="flex flex-col items-center gap-1">
            <svg width={130} height={78} viewBox="0 0 130 78">
                <path
                    d="M 13 66 A 52 52 0 0 1 117 66"
                    fill="none"
                    stroke="rgba(128,128,128,0.15)"
                    strokeWidth={9}
                    strokeLinecap="round"
                />
                <path
                    d="M 13 66 A 52 52 0 0 1 117 66"
                    fill="none"
                    stroke={color}
                    strokeWidth={9}
                    strokeLinecap="round"
                    strokeDasharray={dashArray}
                    style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 5px ${color})` }}
                />
                <text
                    x="65"
                    y="58"
                    textAnchor="middle"
                    fontSize={18}
                    fontWeight="700"
                    fill="var(--text-primary)"
                    fontFamily="inherit"
                >
                    {value.toFixed(0)}%
                </text>
                <text
                    x="13"
                    y="78"
                    textAnchor="middle"
                    fontSize={9}
                    fill="#9B9B9F"
                    fontFamily="inherit"
                >
                    0
                </text>
                <text
                    x="117"
                    y="78"
                    textAnchor="middle"
                    fontSize={9}
                    fill="#9B9B9F"
                    fontFamily="inherit"
                >
                    100
                </text>
            </svg>
            <p
                className="text-[10px] font-bold uppercase tracking-widest text-center"
                style={{ color: "var(--text-tertiary)" }}
            >
                {label}
            </p>
        </div>
    );
}

// ── Section: Event Performance Comparison ─────────────────────────────────────

type EventSortKey = "revenue" | "checkins" | "conversion" | "issued" | "bubble";

function EventComparisonSection({ data, loading }: { data: AnalyticsDisplayModel; loading: boolean }) {
    const [sortKey, setSortKey] = useState<EventSortKey>("revenue");

    const sortTabs: { key: EventSortKey; label: string }[] = [
        { key: "revenue", label: "Revenue" },
        { key: "issued", label: "Attendance" },
        { key: "conversion", label: "Conversion" },
        { key: "checkins", label: "Check-ins" },
        { key: "bubble", label: "Bubble" },
    ];

    const sorted = [...data.topEvents].sort((a, b) => {
        if (sortKey === "bubble") return 0;
        return (
            (b[sortKey as Exclude<EventSortKey, "bubble">] ?? 0) -
            (a[sortKey as Exclude<EventSortKey, "bubble">] ?? 0)
        );
    });

    const rows =
        sorted.length > 0
            ? sorted
            : Array.from({ length: 5 }, (_, i) => ({
                  id: `placeholder-${i}`,
                  title: "No event data yet",
                  revenue: 0,
                  issued: 0,
                  checkins: 0,
                  conversion: 0,
              }));

    // Scatter seed data for zero-state (shows shape of chart)
    const scatterData =
        data.topEvents.length > 0
            ? data.topEvents
            : Array.from({ length: 6 }, (_, i) => ({
                  id: `zero-${i}`,
                  title: "—",
                  issued: i * 40,
                  revenue: i * 1200,
                  conversion: 5 + i * 3,
              }));

    return (
        <BentoCard
            loading={loading}
            header={
                <div className="flex items-center justify-between w-full">
                    <span className="v-label">EVENT PERFORMANCE COMPARISON</span>
                    <div
                        className="flex items-center gap-1 p-0.5 rounded-xl border border-[var(--border-subtle)]"
                        style={{ background: "var(--bg-fill)" }}
                    >
                        {sortTabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setSortKey(tab.key)}
                                className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                style={{
                                    background:
                                        sortKey === tab.key ? "var(--bg-elevated)" : "transparent",
                                    color:
                                        sortKey === tab.key
                                            ? "var(--text-primary)"
                                            : "var(--text-tertiary)",
                                    boxShadow:
                                        sortKey === tab.key ? "var(--shadow-sm)" : "none",
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            }
        >
            {!loading && (
                <>
                    {sortKey === "bubble" ? (
                        <div>
                            <p className="text-[11px] mb-3" style={{ color: "var(--text-tertiary)" }}>
                                Each bubble = one event · X: attendance · Y: revenue · Size: conversion rate
                            </p>
                            <Suspense fallback={<ChartSkeleton height={280} />}>
                                <LazyScatter data={scatterData} height={280} />
                            </Suspense>
                            {!data.hasData && (
                                <p
                                    className="text-center text-[11px] mt-2 font-medium uppercase tracking-widest"
                                    style={{ color: "var(--text-tertiary)" }}
                                >
                                    Bubble plot will populate with real event data
                                </p>
                            )}
                        </div>
                    ) : (
                        <>
                            <div
                                className="grid grid-cols-5 text-[10px] font-black uppercase tracking-widest px-4 py-2 mb-1 rounded-xl"
                                style={{ background: "var(--bg-fill)", color: "var(--text-tertiary)" }}
                            >
                                <span className="col-span-2">Event</span>
                                <span className="text-right">Revenue</span>
                                <span className="text-right">Issued</span>
                                <span className="text-right">Conversion</span>
                            </div>

                            <div className="space-y-0.5">
                                {rows.map((event, i) => {
                                    const maxVal =
                                        (rows[0] as any)[sortKey as Exclude<EventSortKey, "bubble">] ?? 0;
                                    const eventVal =
                                        (event as any)[sortKey as Exclude<EventSortKey, "bubble">] ?? 0;
                                    const barPct = maxVal > 0 ? (eventVal / maxVal) * 100 : 0;

                                    return (
                                        <div
                                            key={event.id}
                                            className="grid grid-cols-5 items-center px-4 py-3 rounded-xl transition-colors relative overflow-hidden"
                                            style={{
                                                background:
                                                    i === 0 && sorted.length > 0
                                                        ? "var(--bg-fill)"
                                                        : "transparent",
                                                borderBottom:
                                                    i < rows.length - 1
                                                        ? "1px solid var(--border-subtle)"
                                                        : "none",
                                            }}
                                        >
                                            {data.hasData && (
                                                <div
                                                    className="absolute left-0 top-0 h-full rounded-xl transition-all duration-500"
                                                    style={{
                                                        width: `${barPct}%`,
                                                        background: `${FUNNEL_COLORS[i % FUNNEL_COLORS.length]}14`,
                                                        pointerEvents: "none",
                                                    }}
                                                />
                                            )}
                                            <div className="col-span-2 flex items-center gap-3 relative z-10">
                                                <span
                                                    className="text-[11px] font-black w-5 tabular-nums"
                                                    style={{
                                                        color:
                                                            i === 0 && sorted.length > 0
                                                                ? FUNNEL_COLORS[0]
                                                                : "var(--text-tertiary)",
                                                    }}
                                                >
                                                    {i + 1}
                                                </span>
                                                <span
                                                    className="text-[13px] font-semibold truncate"
                                                    style={{
                                                        color:
                                                            sorted.length > 0
                                                                ? "var(--text-primary)"
                                                                : "var(--text-tertiary)",
                                                    }}
                                                >
                                                    {event.title}
                                                </span>
                                            </div>
                                            <span
                                                className="text-[13px] font-bold tabular-nums text-right relative z-10"
                                                style={{ color: "var(--text-primary)" }}
                                            >
                                                {fmt(event.revenue, "currency")}
                                            </span>
                                            <span
                                                className="text-[13px] font-medium tabular-nums text-right relative z-10"
                                                style={{ color: "var(--text-secondary)" }}
                                            >
                                                {fmt(event.issued)}
                                            </span>
                                            <span
                                                className="text-[13px] font-medium tabular-nums text-right relative z-10"
                                                style={{ color: "var(--text-secondary)" }}
                                            >
                                                {fmt(event.conversion, "percent")}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            {!data.hasData && (
                                <p
                                    className="text-center text-[11px] mt-3 font-medium uppercase tracking-widest"
                                    style={{ color: "var(--text-tertiary)" }}
                                >
                                    Event rankings will appear after your first event completes
                                </p>
                            )}
                        </>
                    )}
                </>
            )}
        </BentoCard>
    );
}

// ── Section: Source Split + Heatmap ──────────────────────────────────────────

function SourceHeatmapSection({ data, loading }: { data: AnalyticsDisplayModel; loading: boolean }) {
    const [sourceView, setSourceView] = useState<"bars" | "radial">("bars");

    const radialData = data.sources.map((s, i) => ({
        name: s.name,
        value: data.hasData ? s.pct : 100 / data.sources.length,
        fill: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
    }));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <BentoCard
                loading={loading}
                header={
                    <div className="flex items-center justify-between w-full">
                        <span className="v-label">AUDIENCE SOURCE SPLIT</span>
                        <div
                            className="flex items-center gap-1 p-0.5 rounded-xl border border-[var(--border-subtle)]"
                            style={{ background: "var(--bg-fill)" }}
                        >
                            {(["bars", "radial"] as const).map(v => (
                                <button
                                    key={v}
                                    onClick={() => setSourceView(v)}
                                    className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                    style={{
                                        background:
                                            sourceView === v ? "var(--bg-elevated)" : "transparent",
                                        color:
                                            sourceView === v
                                                ? "var(--text-primary)"
                                                : "var(--text-tertiary)",
                                        boxShadow:
                                            sourceView === v ? "var(--shadow-sm)" : "none",
                                    }}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>
                }
            >
                {!loading && (
                    <>
                        {sourceView === "radial" ? (
                            <div>
                                <Suspense fallback={<ChartSkeleton height={260} />}>
                                    <LazyRadialBar data={radialData} height={260} />
                                </Suspense>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                                    {radialData.map(s => (
                                        <div key={s.name} className="flex items-center gap-2">
                                            <div
                                                className="w-2 h-2 rounded-sm shrink-0"
                                                style={{ background: s.fill }}
                                            />
                                            <span
                                                className="text-[10px] font-semibold truncate"
                                                style={{ color: "var(--text-tertiary)" }}
                                            >
                                                {s.name}
                                                {data.hasData ? ` · ${s.value.toFixed(0)}%` : ""}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 pt-1">
                                {data.sources.map((s, i) => (
                                    <div key={s.name}>
                                        <div className="flex justify-between mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-2 h-2 rounded-sm"
                                                    style={{
                                                        background:
                                                            FUNNEL_COLORS[i % FUNNEL_COLORS.length],
                                                    }}
                                                />
                                                <span
                                                    className="text-[12px] font-semibold"
                                                    style={{ color: "var(--text-secondary)" }}
                                                >
                                                    {s.name}
                                                </span>
                                            </div>
                                            <span
                                                className="text-[12px] font-bold tabular-nums"
                                                style={{ color: "var(--text-primary)" }}
                                            >
                                                {data.hasData ? `${s.pct.toFixed(1)}%` : "0%"}
                                            </span>
                                        </div>
                                        <div
                                            className="h-2 w-full rounded-full overflow-hidden"
                                            style={{ background: "var(--bg-fill)" }}
                                        >
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${data.hasData ? s.pct : 0}%`,
                                                    background:
                                                        FUNNEL_COLORS[i % FUNNEL_COLORS.length],
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                {!data.hasData && (
                                    <p
                                        className="text-[11px] mt-1"
                                        style={{ color: "var(--text-tertiary)" }}
                                    >
                                        Traffic source breakdown will appear after discovery activity
                                        begins
                                    </p>
                                )}
                            </div>
                        )}
                    </>
                )}
            </BentoCard>

            <BentoCard
                loading={loading}
                header={<span className="v-label">DEMAND HEATMAP — DAY × HOUR</span>}
            >
                {!loading && <HeatmapGrid data={data} />}
            </BentoCard>
        </div>
    );
}

function HeatmapGrid({ data }: { data: AnalyticsDisplayModel }) {
    const maxVal = Math.max(...data.heatmap.map(h => h.value), 1);

    return (
        <div className="overflow-x-auto">
            <div style={{ minWidth: 340 }}>
                <div className="flex gap-0.5 mb-0.5 pl-8">
                    {HEATMAP_HOURS.map(h => (
                        <div
                            key={h}
                            className="flex-1 text-center text-[9px] font-bold uppercase tracking-widest"
                            style={{ color: "var(--text-tertiary)" }}
                        >
                            {h.slice(0, 2)}
                        </div>
                    ))}
                </div>

                {HEATMAP_DAYS.map(day => (
                    <div key={day} className="flex items-center gap-0.5 mb-0.5">
                        <span
                            className="w-8 text-[9px] font-bold uppercase tracking-widest shrink-0"
                            style={{ color: "var(--text-tertiary)" }}
                        >
                            {day}
                        </span>
                        {HEATMAP_HOURS.map(hour => {
                            const cell = data.heatmap.find(
                                h => h.day === day && h.hour === hour
                            );
                            const intensity =
                                cell && maxVal > 1 ? cell.value / maxVal : 0;
                            return (
                                <div
                                    key={hour}
                                    className="flex-1 rounded-sm transition-all"
                                    style={{
                                        height: 28,
                                        background:
                                            intensity > 0
                                                ? `rgba(244,74,34,${0.1 + intensity * 0.8})`
                                                : "var(--bg-fill)",
                                        border: "1px solid var(--border-subtle)",
                                    }}
                                    title={`${day} ${hour}: ${cell?.value ?? 0}`}
                                />
                            );
                        })}
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                    Low
                </span>
                <div className="flex gap-0.5">
                    {[0.1, 0.3, 0.5, 0.7, 0.9].map(i => (
                        <div
                            key={i}
                            className="h-3 w-5 rounded-sm"
                            style={{ background: `rgba(244,74,34,${i})` }}
                        />
                    ))}
                </div>
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                    High
                </span>
                {!data.hasData && (
                    <span className="ml-2 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                        · Demand patterns will populate after activity
                    </span>
                )}
            </div>
        </div>
    );
}

// ── Section: Finance / Payouts ────────────────────────────────────────────────

function FinanceSection({ data, loading }: { data: AnalyticsDisplayModel; loading: boolean }) {
    const financeRows = [
        { label: "Gross Sales", value: data.grossSales, isDeduction: false, isTotal: false, color: "var(--chart-1)" },
        { label: "Refunds", value: data.refundAmount, isDeduction: true, isTotal: false, color: "var(--color-error)" },
        { label: "Platform Fee", value: data.platformFees, isDeduction: true, isTotal: false, color: "var(--color-error)" },
        { label: "Net Payable", value: data.netSales, isDeduction: false, isTotal: true, color: "var(--accent)" },
        { label: "Pending Payout", value: data.pendingPayout, isDeduction: false, isTotal: false, color: "var(--color-warning)" },
        { label: "Completed Payout", value: data.completedPayout, isDeduction: false, isTotal: false, color: "var(--color-success)" },
    ];

    const maxBarVal = data.grossSales || 1;
    const payoutTotal = data.completedPayout + data.pendingPayout;
    const paidPct =
        payoutTotal > 0 ? (data.completedPayout / payoutTotal) * 100 : 0;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <BentoCard loading={loading} header={<span className="v-label">REVENUE BREAKDOWN</span>}>
                {!loading && (
                    <div className="space-y-1 pt-1">
                        {financeRows.map((row, i) => {
                            const barPct = Math.min((row.value / maxBarVal) * 100, 100);
                            const displayVal = row.isDeduction
                                ? `−${fmt(row.value, "currency")}`
                                : fmt(row.value, "currency");

                            return (
                                <div
                                    key={row.label}
                                    className="rounded-xl px-4 py-3"
                                    style={{
                                        background: row.isTotal ? "var(--bg-fill)" : "transparent",
                                        borderTop:
                                            i > 0 && !row.isTotal
                                                ? "1px solid var(--border-subtle)"
                                                : "none",
                                        marginTop: row.isTotal ? 8 : 0,
                                    }}
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span
                                            className="text-[12px] font-medium"
                                            style={{
                                                color: row.isTotal
                                                    ? "var(--text-primary)"
                                                    : "var(--text-secondary)",
                                            }}
                                        >
                                            {row.label}
                                        </span>
                                        <span
                                            className="text-[13px] font-bold tabular-nums"
                                            style={{ color: row.color }}
                                        >
                                            {displayVal}
                                        </span>
                                    </div>
                                    <div
                                        className="h-1.5 w-full rounded-full overflow-hidden"
                                        style={{ background: "var(--border-subtle)" }}
                                    >
                                        <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={{
                                                width: `${data.hasData ? barPct : 2}%`,
                                                background: row.color,
                                                opacity: row.isDeduction ? 0.7 : 1,
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}

                        {/* Payout progress */}
                        <div
                            className="mt-3 p-4 rounded-2xl"
                            style={{ background: "var(--bg-fill)" }}
                        >
                            <p className="v-label mb-3">PAYOUT STATUS</p>
                            <div
                                className="h-3 w-full rounded-full overflow-hidden"
                                style={{ background: "var(--border-subtle)" }}
                            >
                                <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{
                                        width: `${data.hasData ? paidPct : 0}%`,
                                        background: "linear-gradient(90deg, var(--color-info), var(--color-success))",
                                    }}
                                />
                            </div>
                            <div className="flex justify-between mt-2">
                                <div className="flex items-center gap-1.5">
                                    <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ background: "var(--color-success)" }}
                                    />
                                    <span
                                        className="text-[10px] font-semibold"
                                        style={{ color: "var(--text-tertiary)" }}
                                    >
                                        Paid {fmt(data.completedPayout, "currency")}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ background: "var(--color-warning)" }}
                                    />
                                    <span
                                        className="text-[10px] font-semibold"
                                        style={{ color: "var(--text-tertiary)" }}
                                    >
                                        Pending {fmt(data.pendingPayout, "currency")}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {!data.hasData && (
                            <p className="text-[11px] mt-2" style={{ color: "var(--text-tertiary)" }}>
                                No payout data available yet
                            </p>
                        )}
                    </div>
                )}
            </BentoCard>

            <BentoCard
                loading={loading}
                header={<span className="v-label">RECENT PAYOUTS</span>}
                empty={!loading && data.recentPayouts.length === 0}
                emptyTitle="No payouts processed yet"
            >
                {!loading && data.recentPayouts.length > 0 && (
                    <div className="space-y-2 pt-1">
                        {data.recentPayouts.map((p, i) => (
                            <div
                                key={p.id || i}
                                className="flex items-center justify-between px-4 py-3 rounded-2xl"
                                style={{ background: "var(--bg-fill)" }}
                            >
                                <div>
                                    <p
                                        className="text-[13px] font-semibold"
                                        style={{ color: "var(--text-primary)" }}
                                    >
                                        Payout #{p.id}
                                    </p>
                                    <p
                                        className="text-[11px] uppercase tracking-widest mt-0.5"
                                        style={{ color: "var(--text-tertiary)" }}
                                    >
                                        {p.date}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p
                                        className="text-[13px] font-bold tabular-nums"
                                        style={{ color: "var(--text-primary)" }}
                                    >
                                        {fmt(p.amount, "currency")}
                                    </p>
                                    <span
                                        className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                                        style={{
                                            background: "var(--color-success-bg)",
                                            color: "var(--color-success)",
                                        }}
                                    >
                                        {p.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </BentoCard>
        </div>
    );
}

// ── Section: Analytics Table ──────────────────────────────────────────────────

const TABLE_COLS = [
    "Date",
    "Event",
    "Revenue",
    "Tickets",
    "Guestlist",
    "Entries",
    "Conv %",
    "Refunds",
    "Payout",
    "Status",
];

function TableSection({ data, loading }: { data: AnalyticsDisplayModel; loading: boolean }) {
    return (
        <BentoCard
            loading={loading}
            header={
                <div className="flex items-center justify-between w-full">
                    <span className="v-label">EVENT-LEVEL ANALYTICS TABLE</span>
                    <button
                        className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all"
                        style={{ background: "var(--bg-fill)", color: "var(--text-secondary)" }}
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                    </button>
                </div>
            }
        >
            {!loading && (
                <div className="overflow-x-auto -mx-2">
                    <table className="w-full text-left" style={{ minWidth: 900 }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                {TABLE_COLS.map(col => (
                                    <th
                                        key={col}
                                        className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
                                        style={{ color: "var(--text-tertiary)" }}
                                    >
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.tableRows.map((row, i) => (
                                <tr
                                    key={i}
                                    className="transition-colors"
                                    style={{
                                        borderBottom: "1px solid var(--border-subtle)",
                                        opacity: !data.hasData ? 0.45 : 1,
                                    }}
                                >
                                    <td
                                        className="px-3 py-3 text-[12px] tabular-nums whitespace-nowrap"
                                        style={{ color: "var(--text-secondary)" }}
                                    >
                                        {row.date}
                                    </td>
                                    <td
                                        className="px-3 py-3 text-[12px] font-medium max-w-[160px] truncate"
                                        style={{ color: "var(--text-primary)" }}
                                    >
                                        {row.event}
                                    </td>
                                    <td
                                        className="px-3 py-3 text-[12px] font-semibold tabular-nums"
                                        style={{ color: "var(--text-primary)" }}
                                    >
                                        {fmt(row.revenue, "currency")}
                                    </td>
                                    <td
                                        className="px-3 py-3 text-[12px] tabular-nums"
                                        style={{ color: "var(--text-secondary)" }}
                                    >
                                        {fmt(row.tickets)}
                                    </td>
                                    <td
                                        className="px-3 py-3 text-[12px] tabular-nums"
                                        style={{ color: "var(--text-secondary)" }}
                                    >
                                        {fmt(row.guestlist)}
                                    </td>
                                    <td
                                        className="px-3 py-3 text-[12px] tabular-nums"
                                        style={{ color: "var(--text-secondary)" }}
                                    >
                                        {fmt(row.entries)}
                                    </td>
                                    <td
                                        className="px-3 py-3 text-[12px] tabular-nums"
                                        style={{ color: "var(--text-secondary)" }}
                                    >
                                        {fmt(row.conversion, "percent")}
                                    </td>
                                    <td
                                        className="px-3 py-3 text-[12px] tabular-nums"
                                        style={{ color: "var(--text-secondary)" }}
                                    >
                                        {fmt(row.refunds)}
                                    </td>
                                    <td
                                        className="px-3 py-3 text-[12px] font-semibold tabular-nums"
                                        style={{ color: "var(--text-primary)" }}
                                    >
                                        {fmt(row.payout, "currency")}
                                    </td>
                                    <td className="px-3 py-3">
                                        <span
                                            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                                            style={{
                                                background:
                                                    row.status === "completed" ? "var(--color-success-bg)"
                                                    : row.status === "pending"   ? "var(--color-warning-bg)"
                                                    : row.status === "cancelled" ? "var(--color-error-bg)"
                                                    : "var(--bg-fill)",
                                                color:
                                                    row.status === "completed" ? "var(--color-success)"
                                                    : row.status === "pending"   ? "var(--color-warning)"
                                                    : row.status === "cancelled" ? "var(--color-error)"
                                                    : "var(--text-tertiary)",
                                            }}
                                        >
                                            {row.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div
                        className="flex items-center justify-between px-3 py-3 mt-1 rounded-xl"
                        style={{ background: "var(--bg-fill)" }}
                    >
                        <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                            {data.hasData
                                ? `Showing ${data.tableRows.length} events`
                                : "No events to display"}
                        </span>
                        <div className="flex items-center gap-1">
                            {[1, 2, 3].map(p => (
                                <button
                                    key={p}
                                    className="w-7 h-7 rounded-lg text-[11px] font-bold transition-all"
                                    style={{
                                        background:
                                            p === 1 ? "var(--bg-elevated)" : "transparent",
                                        color:
                                            p === 1
                                                ? "var(--text-primary)"
                                                : "var(--text-tertiary)",
                                    }}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </BentoCard>
    );
}

// ── Section: Insight Cards ────────────────────────────────────────────────────

const INSIGHT_ACCENTS = [
    { color: "var(--chart-1)", bg: "rgba(244,74,34,0.12)" },
    { color: "var(--chart-2)", bg: "rgba(129,140,248,0.12)" },
    { color: "var(--chart-3)", bg: "rgba(52,211,153,0.12)" },
    { color: "var(--chart-4)", bg: "rgba(251,191,36,0.12)" },
];

function InsightsSection({ data, loading }: { data: AnalyticsDisplayModel; loading: boolean }) {
    return (
        <BentoCard
            loading={loading}
            header={
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" style={{ color: "var(--accent)" }} />
                    <span className="v-label">SMART INSIGHTS</span>
                </div>
            }
        >
            {!loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    {data.insights.map((insight, i) => {
                        const accent = INSIGHT_ACCENTS[i % INSIGHT_ACCENTS.length];
                        return (
                        <div
                            key={i}
                            className="rounded-2xl p-5 flex flex-col gap-3"
                            style={{
                                background: insight.placeholder ? "var(--bg-fill)" : "var(--bg-elevated)",
                                border: `1px solid ${insight.placeholder ? "var(--border-subtle)" : accent.color + "40"}`,
                                opacity: insight.placeholder ? 0.75 : 1,
                            }}
                        >
                            <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center"
                                style={{
                                    background: insight.placeholder ? "var(--bg-elevated)" : accent.bg,
                                }}
                            >
                                <Sparkles
                                    className="w-4 h-4"
                                    style={{
                                        color: insight.placeholder ? "var(--text-tertiary)" : accent.color,
                                    }}
                                />
                            </div>
                            <p
                                className="text-[13px] font-semibold leading-snug"
                                style={{
                                    color: insight.placeholder
                                        ? "var(--text-tertiary)"
                                        : "var(--text-primary)",
                                }}
                            >
                                {insight.title}
                            </p>
                            {insight.body && (
                                <p
                                    className="text-[12px] leading-relaxed"
                                    style={{ color: "var(--text-tertiary)" }}
                                >
                                    {insight.body}
                                </p>
                            )}
                            {!insight.placeholder && (
                                <button
                                    className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest mt-auto"
                                    style={{ color: accent.color }}
                                >
                                    View Detail
                                    <ArrowUpRight className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                        );
                    })}
                </div>
            )}
        </BentoCard>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function LegendDot({
    color,
    label,
    dashed,
}: {
    color: string;
    label: string;
    dashed?: boolean;
}) {
    return (
        <div className="flex items-center gap-1.5">
            {dashed ? (
                <div
                    className="w-5 h-px"
                    style={{
                        background: `repeating-linear-gradient(90deg, ${color} 0, ${color} 4px, transparent 4px, transparent 8px)`,
                        borderTop: `1.5px dashed ${color}`,
                    }}
                />
            ) : (
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            )}
            <span
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: "var(--text-tertiary)" }}
            >
                {label}
            </span>
        </div>
    );
}
