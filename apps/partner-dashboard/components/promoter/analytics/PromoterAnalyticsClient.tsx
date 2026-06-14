"use client";

import type { ReactNode } from "react";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
    MousePointerClick,
    IndianRupee,
    Ticket,
    BarChart3,
    RefreshCw,
    Copy,
    Check,
    Link2,
    PauseCircle,
    ShoppingBag,
    Clock3,
    ArrowRight,
    Activity,
    Target,
} from "lucide-react";
import { motion } from "framer-motion";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";

const GUEST_PORTAL_URL =
    process.env.NEXT_PUBLIC_GUEST_PORTAL_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "";

type ChartMetric = "revenue" | "clicks" | "sales";

const RANGES = [
    { value: "7d", label: "7D" },
    { value: "30d", label: "30D" },
    { value: "ytd", label: "YTD" },
    { value: "all", label: "All" },
] as const;

function formatINR(n: number) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(n);
}

function formatRelativeTime(value?: string | null) {
    if (!value) return "Just now";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Just now";

    const diffMs = date.getTime() - Date.now();
    const minutes = Math.round(diffMs / 60000);
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

    if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
    const days = Math.round(hours / 24);
    return rtf.format(days, "day");
}

export function PromoterAnalyticsClient() {
    const [range, setRange] = useState("30d");
    const [chartMetric, setChartMetric] = useState<ChartMetric>("revenue");
    const [selectedEventId, setSelectedEventId] = useState("");
    const { user, profile } = useDashboardAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const promoterId = profile?.activeMembership?.partnerId;
    const eventId = searchParams.get("eventId") || "";

    useEffect(() => {
        setSelectedEventId(eventId);
    }, [eventId]);

    const { data: eventsData } = useQuery({
        queryKey: ["promoter", "analytics-events", promoterId],
        queryFn: async () => {
            const token = await user!.getIdToken();
            const res = await fetch("/api/partners/promoters/links?limit=200", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Failed to fetch links");
            return res.json();
        },
        enabled: !!user && !!promoterId,
        staleTime: 10 * 60 * 1000,
    });

    const { data, isLoading, refetch, isRefetching } = useQuery({
        queryKey: ["promoter", "analytics", range, promoterId, selectedEventId],
        queryFn: async () => {
            const token = await user!.getIdToken();
            const params = new URLSearchParams({ range });
            if (selectedEventId) params.set("eventId", selectedEventId);
            const res = await fetch(`/api/partners/promoters/analytics?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Failed to fetch analytics");
            return res.json();
        },
        enabled: !!user && !!promoterId,
        staleTime: 5 * 60 * 1000,
        refetchOnMount: false,
    });

    const overview = data?.overview || {};
    const timeline = data?.timeline || [];
    const topLinks = data?.topLinks || [];
    const activities = data?.activities || [];
    const eventOptions = useMemo(() => {
        const links = Array.isArray(eventsData?.links) ? eventsData.links : [];
        return links; // Presume backend returns ready-to-use options or links map directly to options
    }, [eventsData]);

    // Chart data points based on selected metric
    const chartData = useMemo(() => {
        return timeline.map((d: any) => ({
            date: d.date,
            value: chartMetric === "revenue" ? (d.revenue || 0) : chartMetric === "clicks" ? (d.clicks || 0) : (d.sales || 0),
        }));
    }, [timeline, chartMetric]);
    const hasOverviewData = (overview.totalClicks || 0) > 0
        || (overview.ticketsSold || 0) > 0
        || (overview.commission || 0) > 0
        || parseFloat(String(overview.conversionRate || "0")) > 0;
    const hasTimelineData = chartData.some((point: { value: number }) => point.value > 0);
    const isEmptyState = !isLoading && !hasOverviewData && !hasTimelineData && topLinks.length === 0 && activities.length === 0;

    const mp = (d: number) => ({
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.45, delay: d, ease: [0.22, 1, 0.36, 1] },
    });

    const handleEventFilterChange = (nextEventId: string) => {
        setSelectedEventId(nextEventId);
        const params = new URLSearchParams(searchParams.toString());
        if (nextEventId) params.set("eventId", nextEventId);
        else params.delete("eventId");
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
    };

    return (
        <VenuePageShell title="Analytics">
            {/* Period selector */}
            <motion.div {...mp(0)} className="flex items-center justify-end flex-wrap gap-3 mb-1">
                <div className="flex items-center gap-2">
                    <select
                        value={selectedEventId}
                        onChange={(event: React.ChangeEvent<HTMLSelectElement>) => handleEventFilterChange(event.target.value)}
                        className="rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] outline-none"
                        style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)", color: "var(--v-text-primary)" }}
                    >
                        <option value="">All Events</option>
                        {eventOptions.map((event: any) => (
                            <option key={event.id} value={event.id}>
                                {event.title}
                            </option>
                        ))}
                    </select>
                    <div className="flex items-center rounded-xl overflow-hidden" style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)" }}>
                        {RANGES.map((r) => (
                            <button
                                key={r.value}
                                onClick={() => setRange(r.value)}
                                className="relative px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-colors"
                                style={{ color: range === r.value ? "var(--v-text-primary)" : "var(--v-text-muted)" }}
                            >
                                {range === r.value && (
                                    <motion.div
                                        layoutId="analytics-range-bg"
                                        className="absolute inset-0"
                                        style={{ background: "rgba(255,255,255,0.06)", borderRadius: 12, boxShadow: "0 0 0 1px var(--v-border)" }}
                                        transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                                    />
                                )}
                                <span className="relative z-10">{r.label}</span>
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => refetch()}
                        disabled={isRefetching || isLoading}
                        className="p-2.5 rounded-xl transition-colors disabled:opacity-50"
                        style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)" }}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} style={{ color: "var(--v-text-muted)" }} />
                    </button>
                </div>
            </motion.div>

            {isEmptyState ? (
                <motion.div {...mp(0.02)} className="mb-4 overflow-hidden rounded-[28px]" style={{ position: "relative" }}>
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            pointerEvents: "none",
                            background: "radial-gradient(ellipse at 18% -10%, rgba(244,74,34,0.18) 0%, transparent 52%), radial-gradient(ellipse at 100% 0%, rgba(59,130,246,0.15) 0%, transparent 48%)",
                        }}
                    />
                    <div
                        className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                        style={{
                            background: "rgba(14,14,16,0.95)",
                            border: "1px solid rgba(244,74,34,0.14)",
                            borderRadius: "28px",
                        }}
                    >
                        <div className="max-w-2xl">
                            <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: "#fb923c" }}>
                                Zero Data State
                            </p>
                            <h2 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">
                                Your analytics will light up after your first shared link starts getting traffic.
                            </h2>
                            <p className="mt-2 text-[13px] font-medium leading-6" style={{ color: "var(--v-text-muted)" }}>
                                Clicks, ticket sales, conversion rate, and earnings will populate here as guests open your links and complete purchases.
                            </p>
                        </div>
                        <Link
                            href="/promoter/links"
                            className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[12px] font-black uppercase tracking-[0.18em] transition-colors"
                            style={{
                                background: "rgba(244,74,34,0.12)",
                                color: "#fb923c",
                                border: "1px solid rgba(244,74,34,0.22)",
                            }}
                        >
                            Manage Links
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </motion.div>
            ) : null}

            {/* KPI Cards */}
            <motion.div {...mp(0.04)} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KPICard
                    icon={<MousePointerClick className="w-4 h-4" />}
                    label="Total Clicks"
                    value={isLoading ? "—" : (overview.totalClicks || 0).toLocaleString("en-IN")}
                    color="#3b82f6"
                    loading={isLoading}
                />
                <KPICard
                    icon={<Ticket className="w-4 h-4" />}
                    label="Tickets Sold"
                    value={isLoading ? "—" : (overview.ticketsSold || 0).toLocaleString("en-IN")}
                    color="#8b5cf6"
                    loading={isLoading}
                />
                <KPICard
                    icon={<BarChart3 className="w-4 h-4" />}
                    label="Conversion Rate"
                    value={isLoading ? "—" : (overview.conversionRate || "0.00%")}
                    color="#f59e0b"
                    loading={isLoading}
                />
                <KPICard
                    icon={<IndianRupee className="w-4 h-4" />}
                    label="Total Earnings"
                    value={isLoading ? "—" : formatINR(overview.commission || 0)}
                    color="#22c55e"
                    accent
                    loading={isLoading}
                />
            </motion.div>

            {/* Chart Panel — glassmorphism */}
            <motion.div {...mp(0.08)}>
                <div style={{ position: "relative", overflow: "hidden", borderRadius: "2rem" }}>
                    {/* Glow behind chart — color shifts with selected metric */}
                    <div style={{
                        position: "absolute", inset: 0, pointerEvents: "none",
                        background: chartMetric === "revenue"
                            ? "radial-gradient(ellipse at 50% -10%, rgba(34,197,94,0.18) 0%, transparent 60%)"
                            : chartMetric === "clicks"
                            ? "radial-gradient(ellipse at 50% -10%, rgba(59,130,246,0.18) 0%, transparent 60%)"
                            : "radial-gradient(ellipse at 50% -10%, rgba(139,92,246,0.18) 0%, transparent 60%)",
                    }} />
                <div className="p-5 sm:p-6" style={{
                    position: "relative", zIndex: 1,
                    background: "rgba(14,14,16,0.95)",
                    border: chartMetric === "revenue"
                        ? "1px solid rgba(34,197,94,0.2)"
                        : chartMetric === "clicks"
                        ? "1px solid rgba(59,130,246,0.2)"
                        : "1px solid rgba(139,92,246,0.2)",
                    borderRadius: "2rem",
                }}>
                    {/* Chart header */}
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                        <div className="flex items-center gap-1 rounded-xl overflow-hidden" style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)" }}>
                            {(["revenue", "clicks", "sales"] as ChartMetric[]).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setChartMetric(m)}
                                    className="relative px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors"
                                    style={{ color: chartMetric === m ? "var(--v-text-primary)" : "var(--v-text-muted)" }}
                                >
                                    {chartMetric === m && (
                                        <motion.div
                                            layoutId="chart-metric-bg"
                                            className="absolute inset-0"
                                            style={{ background: "rgba(255,255,255,0.06)", borderRadius: 12, boxShadow: "0 0 0 1px var(--v-border)" }}
                                            transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                                        />
                                    )}
                                    <span className="relative z-10">{m}</span>
                                </button>
                            ))}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-muted)" }}>
                            Date-wise breakdown
                        </span>
                    </div>

                    {/* Chart */}
                    {isLoading ? (
                        <div className="h-[220px] rounded-2xl animate-pulse" style={{ background: "var(--v-skeleton, rgba(255,255,255,0.04))" }} />
                    ) : chartData.length === 0 ? (
                        <AnalyticsEmptyState
                            className="h-[220px]"
                            icon={<BarChart3 className="h-5 w-5" />}
                            title="No timeline data yet"
                            description="Daily performance will appear here once your links start generating clicks or ticket sales."
                            pills={["Clicks", "Sales", "Revenue"]}
                        />
                    ) : (
                        <AnalyticsAreaChart
                            data={chartData}
                            metric={chartMetric}
                        />
                    )}
                </div>
                </div>
            </motion.div>

            {/* Top Performing Links */}
            <motion.div {...mp(0.12)} className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)] gap-4">
                <div style={{ position: "relative", overflow: "hidden", borderRadius: "2rem" }}>
                    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 55% -15%, rgba(244,74,34,0.15) 0%, transparent 60%)" }} />
                <div className="p-5 sm:p-6" style={{ position: "relative", zIndex: 1, background: "rgba(14,14,16,0.95)", border: "1px solid rgba(244,74,34,0.15)", borderRadius: "2rem" }}>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-[13px] font-black uppercase tracking-widest" style={{ color: "var(--v-text-secondary)" }}>
                                Top Performing Links
                            </h2>
                            <p className="mt-1 text-[12px] font-medium" style={{ color: "var(--v-text-muted)" }}>
                                {overview.activeLinks || 0} active of {overview.totalLinks || 0} total links
                            </p>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-muted)" }}>
                            By Clicks
                        </span>
                    </div>

                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-14 rounded-2xl animate-pulse" style={{ background: "var(--v-skeleton, rgba(255,255,255,0.04))" }} />
                            ))}
                        </div>
                    ) : topLinks.length === 0 ? (
                        <AnalyticsEmptyState
                            icon={<Target className="h-5 w-5" />}
                            title="No tracked links in this range"
                            description="Create or reactivate a promoter link to compare which campaigns are driving the most traffic."
                            pills={["Rankings", "Clicks", "Conversion"]}
                            ctaHref="/promoter/links"
                            ctaLabel="Open Links"
                        />
                    ) : (
                        <div className="flex flex-col">
                            {topLinks.map((link: any, i: number) => (
                                <TopLinkRow key={link.id || i} link={link} rank={i + 1} />
                            ))}
                        </div>
                    )}
                </div>
                </div>

                {/* Activity panel — glassmorphism */}
                <div style={{ position: "relative", overflow: "hidden", borderRadius: "2rem" }}>
                    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 50% -15%, rgba(59,130,246,0.14) 0%, transparent 60%)" }} />
                    <div className="p-5 sm:p-6" style={{ position: "relative", zIndex: 1, background: "rgba(14,14,16,0.95)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: "2rem" }}>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-[13px] font-black uppercase tracking-widest" style={{ color: "var(--v-text-secondary)" }}>
                                    Recent Activity
                                </h2>
                                <p className="mt-1 text-[12px] font-medium" style={{ color: "var(--v-text-muted)" }}>
                                    Latest promoter link activity from the backend
                                </p>
                            </div>
                            <Clock3 className="w-4 h-4" style={{ color: "var(--v-text-muted)" }} />
                        </div>

                        {isLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
                                ))}
                            </div>
                        ) : activities.length === 0 ? (
                            <AnalyticsEmptyState
                                icon={<Activity className="h-5 w-5" />}
                                title="No recent activity yet"
                                description="New clicks, purchases, and link updates will stream into this feed as your audience engages."
                                pills={["Clicks", "Purchases", "Updates"]}
                            />
                        ) : (
                            <div className="flex flex-col gap-2">
                                {activities.map((activity: any) => (
                                    <ActivityRow key={activity.id} activity={activity} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </VenuePageShell>
    );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function AnalyticsEmptyState({
    icon,
    title,
    description,
    pills,
    ctaHref,
    ctaLabel,
    className = "",
}: {
    icon: ReactNode;
    title: string;
    description: string;
    pills: string[];
    ctaHref?: string;
    ctaLabel?: string;
    className?: string;
}) {
    return (
        <div
            className={`flex flex-col items-center justify-center rounded-2xl px-6 py-10 text-center ${className}`.trim()}
            style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)",
                border: "1px dashed rgba(255,255,255,0.09)",
            }}
        >
            <div
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ background: "rgba(255,255,255,0.05)", color: "#fb923c" }}
            >
                {icon}
            </div>
            <h3 className="text-[16px] font-black tracking-tight text-white">
                {title}
            </h3>
            <p className="mt-2 max-w-md text-[13px] font-medium leading-6" style={{ color: "var(--v-text-muted)" }}>
                {description}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {pills.map((pill) => (
                    <span
                        key={pill}
                        className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
                        style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            color: "var(--v-text-secondary)",
                        }}
                    >
                        {pill}
                    </span>
                ))}
            </div>
            {ctaHref && ctaLabel ? (
                <Link
                    href={ctaHref}
                    className="mt-5 inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] transition-colors"
                    style={{
                        background: "rgba(244,74,34,0.12)",
                        color: "#fb923c",
                        border: "1px solid rgba(244,74,34,0.22)",
                    }}
                >
                    {ctaLabel}
                    <ArrowRight className="h-4 w-4" />
                </Link>
            ) : null}
        </div>
    );
}

function KPICard({ icon, label, value, color, loading }: {
    icon: ReactNode;
    label: string;
    value: string;
    color: string;
    accent?: boolean;
    loading?: boolean;
}) {
    return (
        <div style={{ position: "relative", overflow: "hidden", borderRadius: "1.1rem" }}>
            {/* Radial glow */}
            <div style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: `radial-gradient(ellipse at 60% -10%, ${color}38 0%, transparent 65%)`,
            }} />
            {/* Glass surface */}
            <div style={{
                position: "relative", zIndex: 1,
                background: "rgba(14,14,16,0.94)",
                border: `1px solid ${color}38`,
                borderRadius: "1.1rem",
                padding: "18px 20px",
                display: "flex", flexDirection: "column", gap: 10,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: `${color}18`, color,
                    }}>
                        {icon}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: `${color}cc` }}>
                        {label}
                    </span>
                </div>
                {loading ? (
                    <div className="h-8 w-24 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
                ) : (
                    <span className="tabular-nums" style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>
                        {value}
                    </span>
                )}
            </div>
        </div>
    );
}

function AnalyticsAreaChart({ data, metric }: { data: { date: string; value: number }[]; metric: ChartMetric }) {
    const svgH = 220;
    const svgW = 700;
    const padX = 40;
    const padY = 24;
    const usableH = svgH - padY * 2;
    const usableW = svgW - padX * 2;
    const maxVal = Math.max(...data.map((d) => d.value), 1);

    const colors: Record<ChartMetric, string> = {
        revenue: "#22c55e",
        clicks: "#3b82f6",
        sales: "#8b5cf6",
    };
    const color = colors[metric];

    const coords = data.map((d, i) => [
        padX + (i / Math.max(data.length - 1, 1)) * usableW,
        padY + usableH - (d.value / maxVal) * usableH,
    ]);

    const linePath = coords.map((c, i) => (i === 0 ? `M${c[0]},${c[1]}` : `L${c[0]},${c[1]}`)).join(" ");
    const areaPath = `${linePath} L${coords[coords.length - 1][0]},${svgH - padY} L${coords[0][0]},${svgH - padY} Z`;

    // Y-axis labels
    const ySteps = 4;
    const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
        const val = Math.round((maxVal / ySteps) * (ySteps - i));
        return { y: padY + (i / ySteps) * usableH, label: metric === "revenue" ? `₹${(val / 1000).toFixed(0)}k` : val.toString() };
    });

    // X-axis labels (show ~5)
    const xStep = Math.max(1, Math.floor(data.length / 5));
    const xLabels = data.filter((_, i) => i % xStep === 0 || i === data.length - 1).map((d, idx, arr) => {
        const originalIdx = data.indexOf(d);
        return {
            x: padX + (originalIdx / Math.max(data.length - 1, 1)) * usableW,
            label: new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        };
    });

    return (
        <div className="w-full overflow-hidden rounded-2xl" style={{ background: "var(--v-elevated)" }}>
            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" preserveAspectRatio="none" style={{ height: 220 }}>
                <defs>
                    <linearGradient id={`analytics-fill-${metric}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.01" />
                    </linearGradient>
                </defs>

                {/* Grid lines */}
                {yLabels.map((yl, i) => (
                    <line key={i} x1={padX} y1={yl.y} x2={svgW - padX + 10} y2={yl.y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                ))}

                {/* Y labels */}
                {yLabels.map((yl, i) => (
                    <text key={i} x={padX - 8} y={yl.y + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="9" fontWeight="700">
                        {yl.label}
                    </text>
                ))}

                {/* X labels */}
                {xLabels.map((xl, i) => (
                    <text key={i} x={xl.x} y={svgH - 6} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontWeight="700">
                        {xl.label}
                    </text>
                ))}

                {/* Area fill */}
                <path d={areaPath} fill={`url(#analytics-fill-${metric})`} />

                {/* Line */}
                <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                {/* Dots */}
                {coords.map(([cx, cy], i) => (
                    <circle key={i} cx={cx} cy={cy} r="3" fill={color} stroke="var(--v-card)" strokeWidth="1.5" opacity={data.length <= 14 ? 1 : 0} />
                ))}
            </svg>
        </div>
    );
}

function TopLinkRow({ link, rank }: { link: any; rank: number }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        const slug = link.eventSlug || link.eventId || link.code;
        const ref = link.code || link.shortId || link.token || link.id;
        const url = link.fullUrl || `${GUEST_PORTAL_URL}/e/${slug}?ref=${ref}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isFirst  = rank === 1;
    const isSecond = rank === 2;
    const isThird  = rank === 3;

    const cardStyle = isFirst ? {
        background: "linear-gradient(135deg, rgba(244,74,34,0.88) 0%, rgba(251,146,60,0.72) 100%)",
        border: "1px solid rgba(244,74,34,0.5)",
        boxShadow: "0 -12px 36px rgba(244,74,34,0.28)",
    } : isSecond ? {
        background: "rgba(38,38,42,0.95)",
        border: "1px solid rgba(255,255,255,0.1)",
    } : isThird ? {
        background: "rgba(26,26,28,0.95)",
        border: "1px solid rgba(255,255,255,0.07)",
    } : {
        background: "rgba(20,20,22,0.7)",
        border: "1px solid rgba(255,255,255,0.04)",
        opacity: 0.65,
    };

    const textColor = isFirst ? "#fff" : "rgba(255,255,255,0.88)";
    const subColor  = isFirst ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)";
    const convColor = isFirst ? "#fff" : "#22c55e";

    return (
        <div
            className="group"
            style={{
                ...cardStyle,
                display: "flex", alignItems: "center", gap: 12,
                borderRadius: 18, padding: "10px 14px", marginBottom: 6,
            }}
        >
            {/* Rank badge */}
            <div style={{
                width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: isFirst ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${isFirst ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.1)"}`,
                fontSize: 11, fontWeight: 900, color: isFirst ? "#fff" : "rgba(255,255,255,0.45)",
            }}>
                {rank}
            </div>

            {/* Event name + code */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: textColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {link.eventName || "Event"}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <span style={{
                        fontSize: 10, fontFamily: "monospace", fontWeight: 600,
                        padding: "1px 6px", borderRadius: 4,
                        background: isFirst ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
                        color: subColor,
                    }}>
                        /e/{link.code}
                    </span>
                    <button onClick={handleCopy} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5">
                        {copied ? <Check className="w-3 h-3" style={{ color: isFirst ? "#fff" : "#22c55e" }} /> : <Copy className="w-3 h-3" style={{ color: subColor }} />}
                    </button>
                </div>
            </div>

            {/* Stats: clicks · sales · conv */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                <div style={{ textAlign: "center" }}>
                    <p className="tabular-nums" style={{ fontSize: 14, fontWeight: 800, color: textColor }}>{(link.clicks || 0).toLocaleString("en-IN")}</p>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: subColor }}>clicks</p>
                </div>
                <div style={{ textAlign: "center" }}>
                    <p className="tabular-nums" style={{ fontSize: 14, fontWeight: 800, color: textColor }}>{(link.sales || 0).toLocaleString("en-IN")}</p>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: subColor }}>sales</p>
                </div>
                <div style={{ textAlign: "right" }}>
                    <p className="tabular-nums" style={{ fontSize: 14, fontWeight: 800, color: convColor }}>{link.conversion || "0.0%"} ✦</p>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: subColor }}>conv.</p>
                </div>
            </div>
        </div>
    );
}

function ActivityRow({ activity }: { activity: any }) {
    const config = (() => {
        if (activity.type === "sale") {
            return {
                icon: <ShoppingBag className="w-4 h-4" />,
                color: "#22c55e",
                bg: "rgba(34,197,94,0.12)",
                border: "rgba(34,197,94,0.28)",
            };
        }
        if (activity.type === "link_deactivated") {
            return {
                icon: <PauseCircle className="w-4 h-4" />,
                color: "#f59e0b",
                bg: "rgba(245,158,11,0.12)",
                border: "rgba(245,158,11,0.28)",
            };
        }
        return {
            icon: <Link2 className="w-4 h-4" />,
            color: "#3b82f6",
            bg: "rgba(59,130,246,0.12)",
            border: "rgba(59,130,246,0.28)",
        };
    })();

    return (
        <div style={{
            display: "flex", alignItems: "center", gap: 12,
            borderRadius: 18, padding: "11px 14px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
        }}>
            {/* Status icon circle */}
            <div style={{
                width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: config.bg, border: `2px solid ${config.border}`, color: config.color,
            }}>
                {config.icon}
            </div>

            {/* Title + detail */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.88)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {activity.title}
                </p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.36)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {activity.eventName || "Event"}{activity.linkCode ? ` · ${activity.linkCode}` : ""}
                </p>
            </div>

            {/* Right: amount or time */}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
                {activity.type === "sale" ? (
                    <>
                        <p className="tabular-nums" style={{ fontSize: 14, fontWeight: 800, color: config.color, letterSpacing: "-0.01em" }}>
                            {formatINR(activity.commission || 0)}
                        </p>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                            on {formatINR(activity.amount || 0)}
                        </p>
                    </>
                ) : (
                    <span style={{
                        fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em",
                        background: config.bg, color: config.color, border: `1px solid ${config.border}`,
                        borderRadius: 100, padding: "2px 7px", display: "inline-block",
                    }}>
                        {formatRelativeTime(activity.createdAt)}
                    </span>
                )}
            </div>
        </div>
    );
}
