"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import {
    AlertTriangle,
    ArrowRight,
    CalendarDays,
    ChevronRight,
    Search,
    Ticket,
    TrendingUp,
    Wallet,
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenueActionButton, VenuePageShell } from "@/components/venue-layout/VenuePageShell";

type OverviewResponse = {
    kpis?: {
        totalClicks?: number;
        ticketsSold?: number;
        commission?: number;
        activeEvents?: number;
    };
    activeAssignments?: Array<{
        id: string;
        eventId?: string;
        eventName?: string;
        eventDate?: string | null;
        venueName?: string;
        coverImage?: string | null;
        status?: string;
        ticketsSold?: number;
        commission?: number;
    }>;
};

type AnalyticsResponse = {
    overview?: {
        totalClicks?: number;
        ticketsSold?: number;
        revenue?: number;
        commission?: number;
        conversionRate?: string;
    };
    timeline?: Array<{
        date: string;
        clicks?: number;
        sales?: number;
        revenue?: number;
    }>;
};

type GuestsResponse = {
    guests?: Array<{
        id: string;
        guestName?: string;
        eventTitle?: string;
        amount?: number;
        ticketCount?: number;
        status?: string;
        createdAt?: string;
    }>;
};

type ChartMetric = "clicks" | "revenue";
type ChartRange = "1d" | "1w" | "1m" | "all";

const METRIC_TABS: Array<{ key: ChartMetric; label: string }> = [
    { key: "clicks", label: "Clicks" },
    { key: "revenue", label: "Revenue" },
];

const RANGE_TABS: Array<{ key: ChartRange; label: string }> = [
    { key: "1d", label: "1D" },
    { key: "1w", label: "1W" },
    { key: "1m", label: "1M" },
    { key: "all", label: "ALL" },
];

const PROMOTER_OVERVIEW_STALE_MS = 5 * 60 * 1000;
const PROMOTER_GUESTS_STALE_MS = 2 * 60 * 1000;

function formatINR(amount?: number) {
    return `₹${(amount || 0).toLocaleString("en-IN")}`;
}

function formatCompactINR(amount?: number) {
    const value = amount || 0;
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value.toLocaleString("en-IN")}`;
}

function formatDateTime(date?: string) {
    if (!date) return "Unknown";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "Unknown";
    return parsed.toLocaleString("en-IN", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function formatEventDate(date?: string | null) {
    if (!date) return "Date TBA";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "Date TBA";
    return parsed.toLocaleString("en-IN", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function getInitials(name?: string) {
    if (!name) return "GU";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function getOrderStatusTone(status?: string) {
    const key = String(status || "").toLowerCase();
    if (key === "cancelled") {
        return {
            label: "Cancelled",
            color: "#f87171",
            background: "rgba(248,113,113,0.12)",
            border: "rgba(248,113,113,0.18)",
        };
    }
    return {
        label: "Ticket",
        color: "#8ab4ff",
        background: "rgba(90,141,238,0.12)",
        border: "rgba(90,141,238,0.18)",
    };
}

function buildLinePath(values: number[], width: number, height: number, padding: number) {
    const safe = values.length > 0 ? values : [0];
    const max = Math.max(...safe, 1);
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;

    return safe
        .map((value, index) => {
            const x = padding + (safe.length === 1 ? innerWidth : (index / (safe.length - 1)) * innerWidth);
            const y = padding + innerHeight - (value / max) * innerHeight;
            return `${index === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");
}

function buildAreaPath(values: number[], width: number, height: number, padding: number) {
    const safe = values.length > 0 ? values : [0];
    const line = buildLinePath(safe, width, height, padding);
    const innerWidth = width - padding * 2;
    const bottom = height - padding;
    const endX = padding + (safe.length === 1 ? innerWidth : innerWidth);
    return `${line} L ${endX} ${bottom} L ${padding} ${bottom} Z`;
}

function buildZeroStateDates(range: ChartRange) {
    const now = new Date();

    if (range === "1d") {
        return Array.from({ length: 8 }, (_, index) => {
            const point = new Date(now);
            point.setHours(now.getHours() - (7 - index) * 3, 0, 0, 0);
            return point.toISOString();
        });
    }

    if (range === "1w") {
        return Array.from({ length: 7 }, (_, index) => {
            const point = new Date(now);
            point.setDate(now.getDate() - (6 - index));
            point.setHours(0, 0, 0, 0);
            return point.toISOString();
        });
    }

    if (range === "1m") {
        return Array.from({ length: 6 }, (_, index) => {
            const point = new Date(now);
            point.setDate(now.getDate() - (5 - index) * 6);
            point.setHours(0, 0, 0, 0);
            return point.toISOString();
        });
    }

    return Array.from({ length: 6 }, (_, index) => {
        const point = new Date(now);
        point.setMonth(now.getMonth() - (5 - index));
        point.setDate(1);
        point.setHours(0, 0, 0, 0);
        return point.toISOString();
    });
}

function formatChartLabel(dateValue: string, range: ChartRange) {
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return dateValue;

    if (range === "1d") {
        return parsed.toLocaleTimeString("en-IN", {
            hour: "numeric",
            hour12: true,
        });
    }

    if (range === "all") {
        return parsed.toLocaleDateString("en-IN", {
            month: "short",
            year: "2-digit",
        });
    }

    return parsed.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
    });
}

export default function PromoterDashboardHome() {
    const { profile, user } = useDashboardAuth();
    const promoterId = profile?.activeMembership?.partnerId;
    const shouldReduceMotion = useReducedMotion();

    const [metric, setMetric] = useState<ChartMetric>("clicks");
    const [range, setRange] = useState<ChartRange>("1m");
    const [orderSearch, setOrderSearch] = useState("");

    const overviewQuery = useQuery<OverviewResponse>({
        queryKey: ["promoter", "overview", promoterId],
        queryFn: async () => {
            const token = await user!.getIdToken();
            const res = await fetch("/api/partner/promoter/overview", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Failed to load promoter overview");
            return res.json();
        },
        enabled: !!promoterId && !!user,
        staleTime: PROMOTER_OVERVIEW_STALE_MS,
        refetchOnMount: false,
    });

    const analyticsQuery = useQuery<AnalyticsResponse>({
        queryKey: ["promoter", "analytics", promoterId, range],
        queryFn: async () => {
            const token = await user!.getIdToken();
            const res = await fetch(`/api/partner/promoter/analytics?range=${range}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Failed to load promoter analytics");
            return res.json();
        },
        enabled: !!promoterId && !!user,
        staleTime: PROMOTER_OVERVIEW_STALE_MS,
        refetchOnMount: false,
    });

    const guestsQuery = useQuery<GuestsResponse>({
        queryKey: ["promoter", "guests", promoterId],
        queryFn: async () => {
            const token = await user!.getIdToken();
            const res = await fetch(`/api/promoter/guests?promoterId=${promoterId}&limit=6`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Failed to load promoter guests");
            return res.json();
        },
        enabled: !!promoterId && !!user,
        staleTime: PROMOTER_GUESTS_STALE_MS,
        refetchOnMount: false,
    });

    const assignments = overviewQuery.data?.activeAssignments || [];
    const guestOrders = guestsQuery.data?.guests || [];
    const analyticsTimeline = analyticsQuery.data?.timeline || [];
    const analyticsOverview = analyticsQuery.data?.overview || {};

    const filteredOrders = useMemo(() => {
        const query = orderSearch.trim().toLowerCase();
        if (!query) return guestOrders;
        return guestOrders.filter((order) =>
            [order.guestName, order.eventTitle, order.status]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query))
        );
    }, [guestOrders, orderSearch]);

    const chartValues = useMemo(() => {
        const source = analyticsTimeline.length > 0 ? analyticsTimeline : buildZeroStateDates(range).map((date) => ({ date }));
        return source.map((point) =>
            metric === "clicks" ? Number(point.clicks || 0) : Number(point.revenue || 0)
        );
    }, [analyticsTimeline, metric, range]);

    const chartLabels = useMemo(() => {
        const source = analyticsTimeline.length > 0 ? analyticsTimeline : buildZeroStateDates(range).map((date) => ({ date }));
        return source.map((point) => formatChartLabel(point.date, range));
    }, [analyticsTimeline, range]);

    const chartValue = metric === "clicks"
        ? Number(analyticsOverview.totalClicks || 0)
        : Number(analyticsOverview.revenue || 0);

    const linePath = buildLinePath(chartValues, 840, 290, 18);
    const areaPath = buildAreaPath(chartValues, 840, 290, 18);

    const pageError = overviewQuery.isError || analyticsQuery.isError || guestsQuery.isError;
    const loading = overviewQuery.isLoading || analyticsQuery.isLoading || guestsQuery.isLoading;

    const mp = (delay: number) =>
        shouldReduceMotion
            ? {}
            : {
                  initial: { opacity: 0, y: 14 },
                  animate: { opacity: 1, y: 0 },
                  transition: { duration: 0.32, ease: [0.25, 0.1, 0.25, 1], delay },
              };

    if (pageError) {
        return (
            <VenuePageShell
                title="Overview"
                actions={
                    <Link href="/promoter/events">
                        <VenueActionButton variant="primary">Open Events</VenueActionButton>
                    </Link>
                }
            >
                <div
                    className="rounded-[32px] px-8 py-16 flex flex-col items-center text-center gap-4"
                    style={{ background: "#141416", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                    <AlertTriangle className="w-10 h-10 text-red-400" />
                    <div>
                        <p className="text-[16px] font-semibold text-white">Failed to load overview</p>
                        <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                            One or more promoter data feeds did not return successfully.
                        </p>
                    </div>
                </div>
            </VenuePageShell>
        );
    }

    return (
        <VenuePageShell
            title="Overview"
            actions={
                <>
                    <Link href="/promoter/analytics">
                        <VenueActionButton variant="secondary">
                            <TrendingUp className="w-4 h-4" />
                            Analytics
                        </VenueActionButton>
                    </Link>
                    <Link href="/promoter/payouts">
                        <VenueActionButton variant="primary">
                            <Wallet className="w-4 h-4" />
                            Withdraw {formatCompactINR(overviewQuery.data?.kpis?.commission)}
                        </VenueActionButton>
                    </Link>
                </>
            }
        >
            <motion.div {...mp(0)} className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_370px] gap-5">
                <section
                    className="rounded-[28px] p-5 md:p-6"
                    style={{ background: "#141416", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                    <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                            <h2 className="text-[24px] md:text-[28px] leading-none font-semibold text-white">
                                Performance
                            </h2>
                        </div>
                        <div className="text-right shrink-0">
                            <p
                                className="text-[10px] font-bold uppercase tracking-[0.22em]"
                                style={{ color: "rgba(255,255,255,0.28)" }}
                            >
                                {metric}
                            </p>
                            <p className="text-[38px] leading-none font-semibold text-white mt-2">
                                {loading ? "—" : metric === "clicks" ? chartValue.toLocaleString("en-IN") : formatCompactINR(chartValue)}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
                        <div
                            className="inline-flex items-center gap-1 p-1 rounded-[18px]"
                            style={{ background: "#202126", border: "1px solid rgba(255,255,255,0.05)" }}
                        >
                            {METRIC_TABS.map((tab) => {
                                const active = tab.key === metric;
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => setMetric(tab.key)}
                                        className="px-4 py-2 rounded-[14px] text-[11px] font-black uppercase tracking-[0.2em] transition-all"
                                        style={{
                                            background: active ? "#f46a3a" : "transparent",
                                            color: active ? "#fff" : "rgba(255,255,255,0.42)",
                                            boxShadow: active ? "0 10px 24px rgba(244,106,58,0.28)" : "none",
                                        }}
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="relative h-[320px] rounded-[24px] overflow-hidden">
                        <div className="absolute inset-0 flex flex-col justify-between py-4">
                            {[0, 1, 2, 3].map((row) => (
                                <div
                                    key={row}
                                    className="border-t"
                                    style={{ borderColor: "rgba(255,255,255,0.04)" }}
                                />
                            ))}
                        </div>

                        <svg viewBox="0 0 840 290" className="relative z-10 h-full w-full">
                            <defs>
                                <linearGradient id="promoter-chart-fill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="rgba(120,130,255,0.45)" />
                                    <stop offset="100%" stopColor="rgba(120,130,255,0)" />
                                </linearGradient>
                            </defs>
                            <path d={areaPath} fill="url(#promoter-chart-fill)" />
                            <path
                                d={linePath}
                                fill="none"
                                stroke="#7f88ff"
                                strokeWidth="3"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                        </svg>

                        {chartLabels.length > 0 && (
                            <div className="absolute inset-x-3 bottom-0 grid grid-cols-6 gap-2 pb-1">
                                {chartLabels.filter((_, index) => index % Math.max(1, Math.floor(chartLabels.length / 6)) === 0).slice(0, 6).map((label) => (
                                    <span
                                        key={label}
                                        className="text-[10px] font-medium"
                                        style={{ color: "rgba(255,255,255,0.3)" }}
                                    >
                                        {label}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mt-5 flex items-center justify-end gap-2">
                        {RANGE_TABS.map((tab) => {
                            const active = tab.key === range;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setRange(tab.key)}
                                    className="h-9 min-w-10 px-4 rounded-[14px] text-[11px] font-black uppercase tracking-[0.18em] transition-all"
                                    style={{
                                        background: active ? "#f46a3a" : "#202126",
                                        color: active ? "#fff" : "rgba(255,255,255,0.38)",
                                        boxShadow: active ? "0 10px 22px rgba(244,106,58,0.26)" : "none",
                                    }}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section
                    className="rounded-[28px] p-5 md:p-6 flex flex-col"
                    style={{ background: "#141416", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <h2 className="text-[18px] md:text-[20px] font-semibold text-white">
                            Latest Orders
                        </h2>
                        <Link
                            href="/promoter/guests"
                            className="h-9 px-4 inline-flex items-center rounded-full text-[11px] font-black uppercase tracking-[0.18em]"
                            style={{
                                background: "#18191e",
                                color: "rgba(255,255,255,0.42)",
                                border: "1px solid rgba(255,255,255,0.05)",
                            }}
                        >
                            View More
                        </Link>
                    </div>

                    <div
                        className="mb-4 h-11 rounded-[18px] px-4 flex items-center gap-3"
                        style={{ background: "#1a1b20", border: "1px solid rgba(255,255,255,0.05)" }}
                    >
                        <Search className="w-4 h-4" style={{ color: "rgba(255,255,255,0.28)" }} />
                        <input
                            value={orderSearch}
                            onChange={(e) => setOrderSearch(e.target.value)}
                            placeholder="Search orders, customers, events..."
                            className="w-full bg-transparent text-[13px] outline-none"
                            style={{ color: "#fff" }}
                        />
                    </div>

                    <div className="flex flex-col gap-3">
                        {filteredOrders.slice(0, 4).map((order, index) => (
                            <OrderRow key={order.id || index} order={order} />
                        ))}

                        {!loading && filteredOrders.length === 0 && (
                            <div
                                className="rounded-[22px] px-5 py-10 text-center"
                                style={{ background: "#18191d", border: "1px solid rgba(255,255,255,0.05)" }}
                            >
                                <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                                    No matching orders found.
                                </p>
                            </div>
                        )}

                        {loading && (
                            <>
                                {[0, 1, 2].map((row) => (
                                    <div
                                        key={row}
                                        className="h-[92px] rounded-[22px] animate-pulse"
                                        style={{ background: "#18191d" }}
                                    />
                                ))}
                            </>
                        )}
                    </div>
                </section>
            </motion.div>

            <motion.section
                {...mp(0.08)}
                className="rounded-[28px] p-5 md:p-6"
                style={{ background: "#141416", border: "1px solid rgba(255,255,255,0.06)" }}
            >
                <div className="flex items-center justify-between gap-4 mb-4">
                    <h2 className="text-[18px] md:text-[20px] font-semibold text-white">
                        Upcoming Events
                    </h2>
                    <Link
                        href="/promoter/events"
                        className="inline-flex items-center gap-1 text-[12px] font-semibold"
                        style={{ color: "#f46a3a" }}
                    >
                        Open events <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>

                <div className="flex flex-col gap-3">
                    {assignments.slice(0, 4).map((assignment, index) => (
                        <UpcomingEventCard key={assignment.id || index} assignment={assignment} />
                    ))}

                    {!loading && assignments.length === 0 && (
                        <div
                            className="rounded-[24px] px-6 py-14 flex flex-col items-center text-center gap-3"
                            style={{ background: "#18191d", border: "1px solid rgba(255,255,255,0.05)" }}
                        >
                            <CalendarDays className="w-7 h-7" style={{ color: "rgba(255,255,255,0.28)" }} />
                            <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.42)" }}>
                                No assigned events yet.
                            </p>
                        </div>
                    )}

                    {loading && (
                        <div
                            className="h-[144px] rounded-[24px] animate-pulse"
                            style={{ background: "#18191d" }}
                        />
                    )}
                </div>
            </motion.section>
        </VenuePageShell>
    );
}

function OrderRow({ order }: { order: NonNullable<GuestsResponse["guests"]>[number] }) {
    const tone = getOrderStatusTone(order.status);

    return (
        <div
            className="rounded-[22px] px-4 py-3 flex items-center gap-3"
            style={{ background: "#18191d", border: "1px solid rgba(255,255,255,0.05)" }}
        >
            <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-[14px] font-black shrink-0"
                style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.8)",
                    border: "1px solid rgba(255,255,255,0.06)",
                }}
            >
                {getInitials(order.guestName)}
            </div>

            <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-white truncate">{order.guestName || "Guest"}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span
                        className="px-2 py-0.5 rounded-[10px] text-[10px] font-black uppercase tracking-[0.12em]"
                        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.42)" }}
                    >
                        {order.eventTitle || "Event"}
                    </span>
                    <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.28)" }}>
                        {formatDateTime(order.createdAt)}
                    </span>
                </div>
            </div>

            <div className="text-right shrink-0">
                <span
                    className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em]"
                    style={{
                        color: tone.color,
                        background: tone.background,
                        border: `1px solid ${tone.border}`,
                    }}
                >
                    {tone.label}
                </span>
                <p className="text-[24px] leading-none font-semibold text-white mt-3">
                    {formatINR(order.amount)}
                </p>
            </div>
        </div>
    );
}

function UpcomingEventCard({ assignment }: { assignment: NonNullable<OverviewResponse["activeAssignments"]>[number] }) {
    const href = assignment.id ? `/promoter/events/${assignment.id}` : "/promoter/events";
    const stats = [
        { label: "Clicks", value: "0" },
        { label: "Tickets Sold", value: String(assignment.ticketsSold || 0) },
        { label: "Earnings", value: formatCompactINR(assignment.commission) },
    ];

    return (
        <Link
            href={href}
            className="group rounded-[24px] p-4 md:p-5 transition-all"
            style={{ background: "#17191f", border: "1px solid rgba(255,255,255,0.08)" }}
        >
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
                <div
                    className="h-[104px] w-full overflow-hidden rounded-[20px] shrink-0 xl:h-[120px] xl:w-[140px]"
                    style={{ background: "linear-gradient(180deg, rgba(244,106,58,0.18), rgba(94,194,255,0.08))" }}
                >
                    {assignment.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={assignment.coverImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center">
                            <Ticket className="w-8 h-8" style={{ color: "rgba(255,255,255,0.38)" }} />
                        </div>
                    )}
                </div>

                <div className="min-w-0 flex-1 xl:flex xl:items-center">
                    <div className="w-full xl:flex xl:items-center xl:gap-6">
                        <div className="min-w-0 xl:flex xl:min-h-[120px] xl:flex-col xl:justify-center">
                            <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: "#ff9a66" }}>
                                {assignment.venueName || "Venue TBA"}
                            </p>
                            <p className="text-[22px] md:text-[24px] font-semibold text-white truncate">
                                {assignment.eventName || "Untitled Event"}
                            </p>
                            <p className="text-[15px] mt-1" style={{ color: "#ffd9c7" }}>
                                {formatEventDate(assignment.eventDate)}
                            </p>
                        </div>

                        <div className="flex items-center justify-center xl:min-h-[120px] xl:flex-1">
                            <div className="grid grid-cols-3 gap-2 xl:min-w-[360px] xl:max-w-[420px]">
                                {stats.map((stat) => (
                                    <div
                                        key={stat.label}
                                        className="rounded-[16px] px-3 py-3 text-center"
                                        style={{
                                            background: "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.04) 100%)",
                                            border: "1px solid rgba(255,255,255,0.12)",
                                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                                        }}
                                    >
                                        <p className="text-[20px] leading-none font-semibold text-white">
                                            {stat.value}
                                        </p>
                                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "#ffc6a8" }}>
                                            {stat.label}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="shrink-0 flex items-center justify-end gap-3 xl:self-center">
                    <div
                        className="flex h-14 w-14 items-center justify-center rounded-[18px]"
                        style={{
                            background: "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.04) 100%)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                        }}
                    >
                        <ChevronRight className="w-5 h-5" style={{ color: "#f46a3a" }} />
                    </div>
                </div>
            </div>
        </Link>
    );
}
