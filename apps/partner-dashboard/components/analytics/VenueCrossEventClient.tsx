"use client";

/**
 * Venue Cross-Event Analytics Client
 *
 * Comprehensive venue-level analytics across ALL events hosted at this venue.
 * Uses all 6 available analytics endpoints:
 *   overview   → KPI summary + normalised sections
 *   time-series → revenue / tickets trend chart
 *   audience    → demographics breakdown
 *   partners    → per-host & per-promoter attribution
 *   ops         → capacity, fill rate, scan velocity, day-of-week
 *   strategy    → growth recommendations
 *
 * Click-to-refresh only — staleTime: Infinity on all queries.
 */

import { useState, lazy, Suspense, useEffect } from "react";
import {
    LayoutDashboard, TrendingUp, Users, Handshake,
    Settings2, Lightbulb, RefreshCw, Info,
    BarChart3, Ticket, DollarSign, CheckCircle2,
    Clock, Star, Target, Zap, ArrowUpRight, ArrowDownRight,
    Minus, Building2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { HubTabBar, type HubTab } from "@/components/shared/HubTabBar";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import { formatINR, formatINRCompact } from "@/lib/finance/definitions";
import { normalizeAnalyticsV2 } from "@/lib/analytics/zeroState";
import { SummarySection, FunnelSection } from "./sections";
import { cn } from "@/lib/utils";

// ── Lazy Recharts ─────────────────────────────────────────────────────────────

const LazyArea = lazy(() =>
    (import("recharts") as any).then((m: any) => ({
        default: function AreaChart({ data, xKey, yKey, color, height = 240 }: any) {
            const { AreaChart: AC, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } = m;
            return (
                <ResponsiveContainer width="100%" height={height}>
                    <AC data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <defs>
                            <linearGradient id={`grad-${yKey}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="100%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(128,128,128,0.06)" vertical={false} />
                        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#71717A", fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#71717A", fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 13, fontWeight: 600, color: "#fff", padding: "10px 16px" }} />
                        <Area type="monotone" dataKey={yKey} stroke={color} strokeWidth={2.5} fill={`url(#grad-${yKey})`} />
                    </AC>
                </ResponsiveContainer>
            );
        },
    }))
);

const LazyBar = lazy(() =>
    (import("recharts") as any).then((m: any) => ({
        default: function BarChart({ data, xKey, yKey, color, height = 200 }: any) {
            const { BarChart: BC, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } = m;
            return (
                <ResponsiveContainer width="100%" height={height}>
                    <BC data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid stroke="rgba(128,128,128,0.06)" vertical={false} />
                        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#71717A", fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#71717A", fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 13, fontWeight: 600, color: "#fff", padding: "10px 16px" }} />
                        <Bar dataKey={yKey} fill={color} radius={[6, 6, 0, 0]} maxBarSize={40} />
                    </BC>
                </ResponsiveContainer>
            );
        },
    }))
);

const LazyDonut = lazy(() =>
    (import("recharts") as any).then((m: any) => ({
        default: function DonutChart({ data, colors, size = 200 }: any) {
            const { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } = m;
            return (
                <ResponsiveContainer width="100%" height={size}>
                    <PieChart>
                        <Pie data={data} cx="50%" cy="50%" innerRadius={size * 0.28} outerRadius={size * 0.42}
                             paddingAngle={4} dataKey="value" stroke="none" cornerRadius={4}>
                            {data.map((_: any, i: number) => (
                                <Cell key={i} fill={colors[i % colors.length]} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 13, fontWeight: 600, color: "#fff" }} />
                    </PieChart>
                </ResponsiveContainer>
            );
        },
    }))
);

function ChartSkeleton({ height = 240 }: { height?: number }) {
    return <div className="animate-pulse rounded-2xl" style={{ height, background: "var(--v-elevated)" }} />;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS: HubTab[] = [
    { key: "overview",    label: "Overview",    icon: LayoutDashboard },
    { key: "revenue",     label: "Revenue",     icon: TrendingUp },
    { key: "audience",    label: "Audience",    icon: Users },
    { key: "hosts",       label: "Hosts",       icon: Handshake },
    { key: "operations",  label: "Operations",  icon: Settings2 },
    { key: "strategy",    label: "Strategy",    icon: Lightbulb },
];

type RangeId = "7d" | "30d" | "all";
const RANGES: { id: RangeId; label: string; tsRange: string }[] = [
    { id: "7d",  label: "7 Days",   tsRange: "1w" },
    { id: "30d", label: "30 Days",  tsRange: "1m" },
    { id: "all", label: "All Time", tsRange: "all" },
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function VenueCrossEventClient() {
    const { profile, getIdToken } = useDashboardAuth() as any;
    const venueId = profile?.activeMembership?.partnerId;

    const [activeTab, setActiveTab] = useState("overview");
    const [range, setRange] = useState<RangeId>("30d");

    // Refresh timestamps per tab
    const [overviewRefreshedAt,   setOverviewRefreshedAt]   = useState<Date | null>(null);
    const [revenueRefreshedAt,    setRevenueRefreshedAt]    = useState<Date | null>(null);
    const [audienceRefreshedAt,   setAudienceRefreshedAt]   = useState<Date | null>(null);
    const [hostsRefreshedAt,      setHostsRefreshedAt]      = useState<Date | null>(null);
    const [opsRefreshedAt,        setOpsRefreshedAt]        = useState<Date | null>(null);
    const [strategyRefreshedAt,   setStrategyRefreshedAt]   = useState<Date | null>(null);

    // ── Auth fetch helper ────────────────────────────────────────────────────

    const authedFetch = async (url: string) => {
        const token = typeof getIdToken === "function" ? await getIdToken() : "";
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`${res.status} ${url}`);
        return res.json();
    };

    // ── Queries ──────────────────────────────────────────────────────────────

    const overviewQuery = useQuery({
        queryKey: ["venue-cross-overview", venueId, range],
        queryFn: () => authedFetch(`/api/partners/venues/analytics/overview?venueId=${venueId}&range=${range}`),
        enabled: Boolean(venueId && activeTab === "overview"),
        staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false,
    });

    const tsRevenueQuery = useQuery({
        queryKey: ["venue-ts-revenue", venueId, RANGES.find(r => r.id === range)?.tsRange],
        queryFn: () => authedFetch(`/api/partners/venues/analytics/time-series?venueId=${venueId}&range=${RANGES.find(r => r.id === range)?.tsRange}&metric=revenue`),
        enabled: Boolean(venueId && activeTab === "revenue"),
        staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false,
    });

    const tsTicketsQuery = useQuery({
        queryKey: ["venue-ts-tickets", venueId, RANGES.find(r => r.id === range)?.tsRange],
        queryFn: () => authedFetch(`/api/partners/venues/analytics/time-series?venueId=${venueId}&range=${RANGES.find(r => r.id === range)?.tsRange}&metric=tickets`),
        enabled: Boolean(venueId && activeTab === "revenue"),
        staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false,
    });

    const audienceQuery = useQuery({
        queryKey: ["venue-audience", venueId, range],
        queryFn: () => authedFetch(`/api/partners/venues/analytics/audience?venueId=${venueId}&range=${range}`),
        enabled: Boolean(venueId && activeTab === "audience"),
        staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false,
    });

    const hostsQuery = useQuery({
        queryKey: ["venue-partners", venueId, range],
        queryFn: () => authedFetch(`/api/partners/venues/analytics/partners?venueId=${venueId}&range=${range}`),
        enabled: Boolean(venueId && activeTab === "hosts"),
        staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false,
    });

    const opsQuery = useQuery({
        queryKey: ["venue-ops", venueId, range],
        queryFn: () => authedFetch(`/api/partners/venues/analytics/ops?venueId=${venueId}&range=${range}`),
        enabled: Boolean(venueId && activeTab === "operations"),
        staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false,
    });

    const strategyQuery = useQuery({
        queryKey: ["venue-strategy", venueId],
        queryFn: () => authedFetch(`/api/partners/venues/analytics/strategy?venueId=${venueId}`),
        enabled: Boolean(venueId && activeTab === "strategy"),
        staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false,
    });

    // Auto-stamp on first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (overviewQuery.data  && !overviewRefreshedAt)  setOverviewRefreshedAt(new Date());  }, [overviewQuery.data]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (tsRevenueQuery.data && !revenueRefreshedAt)   setRevenueRefreshedAt(new Date());   }, [tsRevenueQuery.data]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (audienceQuery.data  && !audienceRefreshedAt)  setAudienceRefreshedAt(new Date());  }, [audienceQuery.data]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (hostsQuery.data     && !hostsRefreshedAt)     setHostsRefreshedAt(new Date());     }, [hostsQuery.data]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (opsQuery.data       && !opsRefreshedAt)       setOpsRefreshedAt(new Date());       }, [opsQuery.data]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (strategyQuery.data  && !strategyRefreshedAt)  setStrategyRefreshedAt(new Date());  }, [strategyQuery.data]);

    // ── Derived data ─────────────────────────────────────────────────────────

    const rawOverview  = (overviewQuery.data as any)?.analytics ?? overviewQuery.data ?? {};
    const normOverview = normalizeAnalyticsV2(rawOverview);

    const revSeries   = (tsRevenueQuery.data as any)?.series ?? [];
    const tickSeries  = (tsTicketsQuery.data as any)?.series ?? [];
    const revTotal    = (tsRevenueQuery.data as any)?.total ?? 0;
    const tickTotal   = (tsTicketsQuery.data as any)?.total ?? 0;

    const audience    = (audienceQuery.data as any)?.analytics ?? audienceQuery.data ?? {};
    const partners    = (hostsQuery.data as any)?.analytics ?? hostsQuery.data ?? {};
    const ops         = (opsQuery.data as any)?.analytics ?? opsQuery.data ?? {};
    const strategy    = (strategyQuery.data as any)?.analytics ?? strategyQuery.data ?? {};

    const tsRange = RANGES.find(r => r.id === range)?.tsRange ?? "1m";

    // ── Range picker ─────────────────────────────────────────────────────────

    const rangePicker = (
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            {RANGES.map(r => {
                const active = range === r.id;
                return (
                    <button key={r.id} type="button" onClick={() => setRange(r.id)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                        style={{
                            background: active ? "var(--v-orange)" : "transparent",
                            color: active ? "#fff" : "var(--v-text-secondary)",
                            boxShadow: active ? "0 2px 12px rgba(244,74,34,0.4)" : "none",
                        }}
                    >
                        {r.label}
                    </button>
                );
            })}
        </div>
    );

    return (
        <VenuePageShell
            title="Analytics"
            subtitle="Cross-event performance across your entire venue"
            actions={rangePicker}
        >
            <div className="space-y-6">
                <HubTabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
                {/* ── OVERVIEW ── */}
                {activeTab === "overview" && (
                    <div className="space-y-8">
                        <RefreshBar
                            refreshedAt={overviewRefreshedAt}
                            isLoading={overviewQuery.isFetching}
                            onRefresh={() => { overviewQuery.refetch(); setOverviewRefreshedAt(new Date()); }}
                        />
                        {/* Top-line KPI strip */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <KpiCard label="Total Revenue"    value={formatINR(rawOverview.totalRevenue ?? normOverview.executive?.grossRevenue?.raw ?? 0)} icon={DollarSign} accent="#34d399" loading={overviewQuery.isLoading} />
                            <KpiCard label="Tickets Sold"     value={(rawOverview.totalTicketsSold ?? normOverview.executive?.ticketsSold?.raw ?? 0).toLocaleString("en-IN")} icon={Ticket} accent="#818cf8" loading={overviewQuery.isLoading} />
                            <KpiCard label="Check-ins"        value={(rawOverview.totalCheckIns ?? normOverview.executive?.confirmedCheckins?.raw ?? 0).toLocaleString("en-IN")} icon={CheckCircle2} accent="#f59e0b" loading={overviewQuery.isLoading} />
                            <KpiCard label="Events Hosted"    value={(rawOverview.totalEvents ?? 0).toLocaleString("en-IN")} icon={BarChart3} accent="#f44a22" loading={overviewQuery.isLoading} />
                        </div>

                        {/* Summary + Funnel from existing sections */}
                        <SummarySection data={normOverview} loading={overviewQuery.isLoading} />
                        <FunnelSection  data={normOverview} loading={overviewQuery.isLoading} />
                    </div>
                )}

                {/* ── REVENUE ── */}
                {activeTab === "revenue" && (
                    <div className="space-y-6">
                        <RefreshBar
                            refreshedAt={revenueRefreshedAt}
                            isLoading={tsRevenueQuery.isFetching || tsTicketsQuery.isFetching}
                            onRefresh={() => { tsRevenueQuery.refetch(); tsTicketsQuery.refetch(); setRevenueRefreshedAt(new Date()); }}
                        />
                        {/* KPI pair — glassmorphism */}
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: `Total Revenue · ${RANGES.find(r => r.id === range)?.label}`, value: formatINR(revTotal), glow: "rgba(52,211,153,0.22)", border: "rgba(52,211,153,0.22)", accent: "#34d399" },
                                { label: `Tickets Sold · ${RANGES.find(r => r.id === range)?.label}`, value: tickTotal.toLocaleString("en-IN"), glow: "rgba(129,140,248,0.22)", border: "rgba(129,140,248,0.22)", accent: "#818cf8" },
                            ].map((card) => (
                                <div key={card.label} style={{ position: "relative", overflow: "hidden", borderRadius: "1.1rem" }}>
                                    <div style={{
                                        position: "absolute", inset: 0, pointerEvents: "none",
                                        background: `radial-gradient(ellipse at 60% -10%, ${card.glow} 0%, transparent 65%)`,
                                    }} />
                                    <div style={{
                                        position: "relative", zIndex: 1,
                                        background: "rgba(14,14,16,0.94)",
                                        border: `1px solid ${card.border}`,
                                        borderRadius: "1.1rem",
                                        padding: "20px 22px",
                                    }}>
                                        <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: card.accent, marginBottom: 8 }}>
                                            {card.label}
                                        </p>
                                        <p className="tabular-nums" style={{ fontSize: 30, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>
                                            {card.value}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Revenue trend chart */}
                        <SectionCard title="Revenue Trend" subtitle={`Daily revenue over the selected period`}>
                            {tsRevenueQuery.isLoading ? <ChartSkeleton height={240} /> : revSeries.length > 0 ? (
                                <Suspense fallback={<ChartSkeleton height={240} />}>
                                    <LazyArea data={revSeries} xKey="label" yKey="value" color="#34d399" height={240} />
                                </Suspense>
                            ) : <EmptyChart label="No revenue data for this period" />}
                        </SectionCard>

                        {/* Tickets trend chart */}
                        <SectionCard title="Tickets Sold Trend" subtitle="Daily ticket volume over the selected period">
                            {tsTicketsQuery.isLoading ? <ChartSkeleton height={200} /> : tickSeries.length > 0 ? (
                                <Suspense fallback={<ChartSkeleton height={200} />}>
                                    <LazyArea data={tickSeries} xKey="label" yKey="value" color="#818cf8" height={200} />
                                </Suspense>
                            ) : <EmptyChart label="No ticket data for this period" />}
                        </SectionCard>
                    </div>
                )}

                {/* ── AUDIENCE ── */}
                {activeTab === "audience" && (
                    <div className="space-y-6">
                        <RefreshBar
                            refreshedAt={audienceRefreshedAt}
                            isLoading={audienceQuery.isFetching}
                            onRefresh={() => { audienceQuery.refetch(); setAudienceRefreshedAt(new Date()); }}
                        />
                        {/* KPI strip */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <KpiCard label="Total Guests"   value={(audience.totalGuests ?? 0).toLocaleString("en-IN")}   icon={Users}       accent="#818cf8" loading={audienceQuery.isLoading} />
                            <KpiCard label="Repeat Guests"  value={`${audience.repeatGuestPct ?? 0}%`}                   icon={Repeat}      accent="#34d399" loading={audienceQuery.isLoading} />
                            <KpiCard label="Avg Age"        value={audience.avgAge ? `${audience.avgAge}y` : "—"}         icon={Star}        accent="#f59e0b" loading={audienceQuery.isLoading} />
                            <KpiCard label="Top City"       value={audience.topCities?.[0]?.city ?? "—"}                  icon={Building2}   accent="#f44a22" loading={audienceQuery.isLoading} />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* Gender donut */}
                            <SectionCard title="Gender Split" subtitle="Across all events in this period">
                                {audienceQuery.isLoading ? <ChartSkeleton height={200} /> : (
                                    (() => {
                                        const g = audience.genderSplit ?? {};
                                        const male   = g.male   ?? 0;
                                        const female = g.female ?? 0;
                                        const other  = g.other  ?? 0;
                                        const total  = male + female + other;
                                        if (total === 0) return <EmptyChart label="No demographic data yet" />;
                                        const donutData = [
                                            { name: "Male",   value: male },
                                            { name: "Female", value: female },
                                            ...(other > 0 ? [{ name: "Other", value: other }] : []),
                                        ];
                                        return (
                                            <div className="flex items-center gap-6">
                                                <Suspense fallback={<ChartSkeleton height={200} />}>
                                                    <LazyDonut data={donutData} colors={["#818cf8", "#f472b6", "#a78bfa"]} size={200} />
                                                </Suspense>
                                                <div className="space-y-3 flex-1">
                                                    {donutData.map((d, i) => (
                                                        <div key={d.name} className="flex items-center justify-between gap-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: ["#818cf8","#f472b6","#a78bfa"][i] }} />
                                                                <span className="text-[13px] font-medium" style={{ color: "var(--v-text-secondary)" }}>{d.name}</span>
                                                            </div>
                                                            <span className="text-[13px] font-black tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                                                                {Math.round((d.value / total) * 100)}%
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()
                                )}
                            </SectionCard>

                            {/* Age bands */}
                            <SectionCard title="Age Distribution" subtitle="Attendees by age group">
                                {audienceQuery.isLoading ? <ChartSkeleton height={200} /> : (
                                    (audience.ageBands ?? []).length > 0 ? (
                                        <Suspense fallback={<ChartSkeleton height={200} />}>
                                            <LazyBar data={audience.ageBands} xKey="band" yKey="count" color="#f44a22" height={200} />
                                        </Suspense>
                                    ) : <EmptyChart label="No age data yet" />
                                )}
                            </SectionCard>
                        </div>

                        {/* Top cities */}
                        {(audience.topCities ?? []).length > 0 && (
                            <SectionCard title="Top Cities" subtitle="Where your guests come from">
                                <div className="space-y-3">
                                    {(audience.topCities as any[]).slice(0, 8).map((c: any, i: number) => {
                                        const max = audience.topCities[0]?.count ?? 1;
                                        const pct = Math.round((c.count / max) * 100);
                                        return (
                                            <div key={c.city} className="flex items-center gap-4">
                                                <span className="text-[11px] font-black tabular-nums w-4 shrink-0" style={{ color: "var(--v-text-tertiary)" }}>{i + 1}</span>
                                                <span className="text-[13px] font-semibold w-24 shrink-0" style={{ color: "var(--v-text-primary)" }}>{c.city}</span>
                                                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--v-border)" }}>
                                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--v-orange)" }} />
                                                </div>
                                                <span className="text-[12px] font-black tabular-nums w-12 text-right" style={{ color: "var(--v-text-secondary)" }}>{c.count.toLocaleString()}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </SectionCard>
                        )}

                        {/* Repeat vs New */}
                        {(audience.repeatVsNew) && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-5 rounded-2xl" style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}>
                                    <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--v-text-tertiary)" }}>New Guests</p>
                                    <p className="text-[28px] font-black tabular-nums" style={{ color: "var(--v-text-primary)" }}>{(audience.repeatVsNew.new ?? 0).toLocaleString()}</p>
                                </div>
                                <div className="p-5 rounded-2xl" style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}>
                                    <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--v-text-tertiary)" }}>Returning Guests</p>
                                    <p className="text-[28px] font-black tabular-nums" style={{ color: "#34d399" }}>{(audience.repeatVsNew.repeat ?? 0).toLocaleString()}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── HOSTS ── */}
                {activeTab === "hosts" && (
                    <div className="space-y-6">
                        <RefreshBar
                            refreshedAt={hostsRefreshedAt}
                            isLoading={hostsQuery.isFetching}
                            onRefresh={() => { hostsQuery.refetch(); setHostsRefreshedAt(new Date()); }}
                        />
                        {/* Host leaderboard */}
                        <SectionCard title="Host Performance" subtitle="Revenue and attendance per host across all events">
                            {hostsQuery.isLoading ? <TableSkeleton rows={5} /> : (
                                (partners.hosts ?? []).length > 0 ? (
                                    <div className="space-y-2">
                                        {([...(partners.hosts as any[])]
                                            .sort((a: any, b: any) => (b.revenue ?? 0) - (a.revenue ?? 0))
                                            .map((host: any, i: number) => {
                                                const isFirst  = i === 0;
                                                const isSecond = i === 1;
                                                const isThird  = i === 2;

                                                const cardStyle = isFirst ? {
                                                    background: "linear-gradient(135deg, rgba(244,74,34,0.88) 0%, rgba(251,146,60,0.72) 100%)",
                                                    border: "1px solid rgba(244,74,34,0.5)",
                                                    boxShadow: "0 -14px 40px rgba(244,74,34,0.32)",
                                                } : isSecond ? {
                                                    background: "rgba(38,38,42,0.95)",
                                                    border: "1px solid rgba(255,255,255,0.1)",
                                                } : isThird ? {
                                                    background: "rgba(26,26,28,0.95)",
                                                    border: "1px solid rgba(255,255,255,0.07)",
                                                } : {
                                                    background: "rgba(20,20,22,0.7)",
                                                    border: "1px solid rgba(255,255,255,0.04)",
                                                    opacity: 0.6,
                                                };

                                                const textColor = isFirst ? "#fff" : "rgba(255,255,255,0.88)";
                                                const subColor  = isFirst ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.38)";
                                                const revColor  = isFirst ? "#fff" : "#34d399";

                                                return (
                                                    <div
                                                        key={host.hostId || i}
                                                        style={{
                                                            ...cardStyle,
                                                            display: "flex", alignItems: "center", gap: 14,
                                                            borderRadius: 20, padding: "0 18px", height: 64,
                                                        }}
                                                    >
                                                        {/* Rank badge */}
                                                        <div style={{
                                                            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                                                            display: "flex", alignItems: "center", justifyContent: "center",
                                                            background: isFirst ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)",
                                                            border: `1px solid ${isFirst ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.1)"}`,
                                                            fontSize: 11, fontWeight: 900, color: isFirst ? "#fff" : "rgba(255,255,255,0.5)",
                                                        }}>
                                                            {i + 1}
                                                        </div>

                                                        {/* Avatar initials */}
                                                        <div style={{
                                                            width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                                                            display: "flex", alignItems: "center", justifyContent: "center",
                                                            background: isFirst ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)",
                                                            fontSize: 13, fontWeight: 900, color: textColor,
                                                        }}>
                                                            {(host.hostName || "H")[0].toUpperCase()}
                                                        </div>

                                                        {/* Name + events */}
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p style={{ fontSize: 14, fontWeight: 700, color: textColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                                {host.hostName || "Unknown Host"}
                                                            </p>
                                                            <p style={{ fontSize: 11, color: subColor, marginTop: 1 }}>
                                                                {host.events ?? 0} events · {(host.tickets ?? 0).toLocaleString()} tickets
                                                            </p>
                                                        </div>

                                                        {/* Revenue + fill rate */}
                                                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                                                            <p className="tabular-nums" style={{ fontSize: 15, fontWeight: 800, color: revColor, letterSpacing: "-0.01em" }}>
                                                                {formatINRCompact(host.revenue ?? 0)} ✦
                                                            </p>
                                                            {(host.fillRate ?? 0) > 0 && (
                                                                <p style={{ fontSize: 11, color: subColor, marginTop: 1 }}>
                                                                    {Math.round(host.fillRate)}% fill
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                ) : <EmptyChart label="No host data for this period" />
                            )}
                        </SectionCard>

                        {/* Promoter attribution */}
                        {(partners.promoters ?? []).length > 0 && (
                            <SectionCard title="Promoter Attribution" subtitle="Sales and revenue driven by each promoter">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr style={{ borderBottom: "1px solid var(--v-border)" }}>
                                                {["Promoter", "Sales", "Revenue", "Clicks", "Conv Rate"].map(h => (
                                                    <th key={h} className="pb-3 pr-4 text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--v-text-secondary)" }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(partners.promoters as any[]).map((p: any, i: number) => (
                                                <tr key={p.promoterId || i} className="transition-colors" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                    <td className="py-3 pr-4 text-[13px] font-semibold" style={{ color: "var(--v-text-primary)" }}>{p.promoterName || "Unknown"}</td>
                                                    <td className="py-3 pr-4 text-[13px] tabular-nums" style={{ color: "var(--v-text-secondary)" }}>{(p.sales ?? 0).toLocaleString()}</td>
                                                    <td className="py-3 pr-4 text-[13px] font-semibold tabular-nums" style={{ color: "#34d399" }}>{formatINRCompact(p.revenue ?? 0)}</td>
                                                    <td className="py-3 pr-4 text-[13px] tabular-nums" style={{ color: "var(--v-text-secondary)" }}>{(p.clicks ?? 0).toLocaleString()}</td>
                                                    <td className="py-3 pr-4 text-[13px] tabular-nums" style={{ color: "var(--v-text-secondary)" }}>
                                                        {p.clicks > 0 ? `${Math.round(((p.sales ?? 0) / p.clicks) * 100)}%` : "—"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </SectionCard>
                        )}
                    </div>
                )}

                {/* ── OPERATIONS ── */}
                {activeTab === "operations" && (
                    <div className="space-y-6">
                        <RefreshBar
                            refreshedAt={opsRefreshedAt}
                            isLoading={opsQuery.isFetching}
                            onRefresh={() => { opsQuery.refetch(); setOpsRefreshedAt(new Date()); }}
                        />
                        {/* KPI strip */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <KpiCard label="Avg Fill Rate"   value={ops.avgFillRate ? `${Math.round(ops.avgFillRate)}%` : "—"}    icon={Target}  accent="#f44a22" loading={opsQuery.isLoading} />
                            <KpiCard label="Total Scans"     value={(ops.totalScans ?? 0).toLocaleString("en-IN")}                 icon={Zap}     accent="#818cf8" loading={opsQuery.isLoading} />
                            <KpiCard label="Peak Hour"       value={ops.peakHour ?? "—"}                                          icon={Clock}   accent="#f59e0b" loading={opsQuery.isLoading} />
                            <KpiCard label="Capacity Util."  value={ops.capacityUtilisation ? `${Math.round(ops.capacityUtilisation)}%` : "—"} icon={BarChart3} accent="#34d399" loading={opsQuery.isLoading} />
                        </div>

                        {/* Day of week */}
                        {(ops.dayOfWeekBreakdown ?? []).length > 0 && (
                            <SectionCard title="Day-of-Week Performance" subtitle="Average fill rate and events per day">
                                <Suspense fallback={<ChartSkeleton height={200} />}>
                                    <LazyBar data={ops.dayOfWeekBreakdown} xKey="day" yKey="avgFill" color="#f44a22" height={200} />
                                </Suspense>
                            </SectionCard>
                        )}

                        {/* Scan velocity */}
                        {(ops.scanVelocity ?? []).length > 0 && (
                            <SectionCard title="Check-in Velocity" subtitle="Average scans per hour across events">
                                <Suspense fallback={<ChartSkeleton height={200} />}>
                                    <LazyBar data={ops.scanVelocity} xKey="hour" yKey="scans" color="#818cf8" height={200} />
                                </Suspense>
                            </SectionCard>
                        )}

                        {/* Capacity utilisation over time */}
                        {(ops.capacityTimeline ?? []).length > 0 && (
                            <SectionCard title="Capacity Utilisation Over Time" subtitle="How full each event was, chronologically">
                                <Suspense fallback={<ChartSkeleton height={220} />}>
                                    <LazyArea data={ops.capacityTimeline} xKey="date" yKey="fillRate" color="#34d399" height={220} />
                                </Suspense>
                            </SectionCard>
                        )}

                        {/* Walk-in vs online */}
                        {(ops.channelSplit) && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-5 rounded-2xl" style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}>
                                    <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--v-text-tertiary)" }}>Online Entries</p>
                                    <p className="text-[28px] font-black tabular-nums" style={{ color: "#818cf8" }}>{(ops.channelSplit.online ?? 0).toLocaleString()}</p>
                                </div>
                                <div className="p-5 rounded-2xl" style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}>
                                    <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--v-text-tertiary)" }}>Walk-in Entries</p>
                                    <p className="text-[28px] font-black tabular-nums" style={{ color: "#f59e0b" }}>{(ops.channelSplit.walkIn ?? 0).toLocaleString()}</p>
                                </div>
                            </div>
                        )}

                        {!opsQuery.isLoading && !ops.totalScans && !ops.avgFillRate && (
                            <EmptyState label="No operations data yet for this period" />
                        )}
                    </div>
                )}

                {/* ── STRATEGY ── */}
                {activeTab === "strategy" && (
                    <div className="space-y-6">
                        <RefreshBar
                            refreshedAt={strategyRefreshedAt}
                            isLoading={strategyQuery.isFetching}
                            onRefresh={() => { strategyQuery.refetch(); setStrategyRefreshedAt(new Date()); }}
                        />
                        {strategyQuery.isLoading ? (
                            <div className="space-y-3">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "var(--v-elevated)" }} />
                                ))}
                            </div>
                        ) : (strategy.recommendations ?? []).length > 0 ? (
                            <div className="space-y-4">
                                {(strategy.recommendations as any[]).map((rec: any, i: number) => (
                                    <RecommendationCard key={i} rec={rec} />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {/* Fallback insight cards when API returns nothing */}
                                <div className="p-5 rounded-2xl" style={{ background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.15)" }}>
                                    <div className="flex items-center gap-3 mb-2">
                                        <Info className="w-4 h-4" style={{ color: "#818cf8" }} />
                                        <p className="text-[13px] font-bold" style={{ color: "var(--v-text-primary)" }}>Strategy insights require at least 30 days of event data.</p>
                                    </div>
                                    <p className="text-[12px]" style={{ color: "var(--v-text-tertiary)" }}>Once your venue has sufficient event history, AI-powered recommendations will appear here — covering optimal slot timing, host selection, pricing, and capacity planning.</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </VenuePageShell>
    );
}

// ── Shared UI Components ──────────────────────────────────────────────────────

function RefreshBar({ refreshedAt, isLoading, onRefresh }: { refreshedAt: Date | null; isLoading: boolean; onRefresh: () => void }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--v-text-secondary)" }}>
                {refreshedAt
                    ? `Last updated ${refreshedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                    : "Tap Refresh to load data"}
            </span>
            <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.12em] transition-all disabled:opacity-50"
                style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)", color: "var(--v-text-secondary)" }}
            >
                <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
                Refresh
            </button>
        </div>
    );
}

function KpiCard({ label, value, icon: Icon, accent, loading }: { label: string; value: string; icon: any; accent: string; loading?: boolean }) {
    return (
        <div className="p-4 rounded-2xl relative overflow-hidden" style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}>
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.06]" style={{ background: accent, filter: "blur(30px)", transform: "translate(30%,-30%)" }} />
            <Icon className="w-4 h-4 mb-3" style={{ color: accent }} />
            {loading ? (
                <div className="h-7 w-20 rounded-lg animate-pulse mb-1" style={{ background: "var(--v-elevated)" }} />
            ) : (
                <p className="text-[22px] font-black tabular-nums mb-0.5" style={{ color: "var(--v-text-primary)" }}>{value}</p>
            )}
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-secondary)" }}>{label}</p>
        </div>
    );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <div className="p-5 rounded-2xl" style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}>
            <p className="text-[13px] font-bold mb-0.5" style={{ color: "var(--v-text-primary)" }}>{title}</p>
            {subtitle && <p className="text-[11px] mb-4" style={{ color: "var(--v-text-tertiary)" }}>{subtitle}</p>}
            {children}
        </div>
    );
}

function FillBar({ pct }: { pct: number }) {
    const clamped = Math.min(100, Math.max(0, pct));
    const color = clamped >= 80 ? "#34d399" : clamped >= 50 ? "#f59e0b" : "#f87171";
    return (
        <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--v-border)" }}>
                <div className="h-full rounded-full" style={{ width: `${clamped}%`, background: color }} />
            </div>
            <span className="text-[11px] font-bold tabular-nums" style={{ color }}>{clamped}%</span>
        </div>
    );
}

function RecommendationCard({ rec }: { rec: any }) {
    const impactColor = rec.impact === "high" ? "#34d399" : rec.impact === "medium" ? "#f59e0b" : "#818cf8";
    return (
        <div className="flex items-start gap-4 p-5 rounded-2xl" style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${impactColor}15`, border: `1px solid ${impactColor}25` }}>
                <Lightbulb className="w-4 h-4" style={{ color: impactColor }} />
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <p className="text-[13px] font-bold" style={{ color: "var(--v-text-primary)" }}>{rec.title}</p>
                    {rec.impact && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest" style={{ background: `${impactColor}15`, color: impactColor }}>
                            {rec.impact} impact
                        </span>
                    )}
                </div>
                <p className="text-[12px]" style={{ color: "var(--v-text-tertiary)" }}>{rec.description}</p>
                {rec.action && (
                    <p className="text-[11px] font-semibold mt-2" style={{ color: impactColor }}>{rec.action}</p>
                )}
            </div>
        </div>
    );
}

function EmptyChart({ label }: { label: string }) {
    return (
        <div className="py-12 flex flex-col items-center gap-2 rounded-xl" style={{ border: "1px dashed var(--v-border)" }}>
            <BarChart3 className="w-7 h-7" style={{ color: "var(--v-text-tertiary)" }} />
            <p className="text-[12px] font-semibold" style={{ color: "var(--v-text-tertiary)" }}>{label}</p>
        </div>
    );
}

function EmptyState({ label }: { label: string }) {
    return (
        <div className="py-16 flex flex-col items-center gap-3 rounded-2xl" style={{ border: "1px dashed var(--v-border)" }}>
            <Info className="w-8 h-8" style={{ color: "var(--v-text-tertiary)" }} />
            <p className="text-[13px] font-semibold" style={{ color: "var(--v-text-tertiary)" }}>{label}</p>
        </div>
    );
}

function TableSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div className="space-y-3">
            {[...Array(rows)].map((_, i) => (
                <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "var(--v-elevated)" }} />
            ))}
        </div>
    );
}

// Placeholder for Repeat icon (not in lucide standard set)
function Repeat(props: any) {
    return <Users {...props} />;
}
