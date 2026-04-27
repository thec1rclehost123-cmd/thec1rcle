"use client";

import Link from "next/link";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    CalendarDays,
    ChevronRight,
    Image as ImageIcon,
    Search,
    ShoppingBag,
} from "lucide-react";
import { motion } from "framer-motion";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import VenueChart, { ChartSkeleton } from "@/components/ui/VenueChart";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import {
    formatINRCompact,
    formatNumber,
} from "@/lib/utils/format";

type OverviewRange = "1d" | "1w" | "1m" | "all";
type OverviewMetric = "tickets" | "revenue";

type VenueOrder = {
    id: string;
    orderNumber: string;
    orderId: string;
    attendeeId: string;
    customerName: string;
    eventId: string;
    eventName: string;
    amount: number;
    ticketsCount: number;
    createdAt: string;
    status: string;
    source: "ticket" | "rsvp";
};

type VenueOrdersResponse = {
    orders: VenueOrder[];
    pagination?: {
        page: number;
        limit: number;
        total: number;
        hasMore: boolean;
    };
};

type VenueEvent = {
    id: string;
    title: string;
    startDate?: string;
    date?: string;
    lifecycle?: string;
    status?: string;
    hostName?: string;
    coverImage?: string;
    poster?: string;
    bannerImage?: string;
    image?: string;
};

type VenueEventsResponse = {
    events: VenueEvent[];
};

type ChartPoint = {
    label: string;
    value: number;
};

type TimeSeriesPoint = {
    date: string;
    label: string;
    value?: number;
    revenue?: number;
    ticketsSold?: number;
};
type TimeSeriesResponse = { series: TimeSeriesPoint[]; total?: number; range?: string; metric?: string; venueId?: string; };

const RANGE_OPTIONS: Array<{ value: OverviewRange; label: string }> = [
    { value: "1d", label: "1D" },
    { value: "1w", label: "1W" },
    { value: "1m", label: "1M" },
    { value: "all", label: "ALL" },
];

const METRIC_OPTIONS: Array<{ value: OverviewMetric; label: string }> = [
    { value: "tickets", label: "Tickets" },
    { value: "revenue", label: "Revenue" },
];

const OVERVIEW_REFRESH_MS = 60_000;
const OVERVIEW_ORDERS_STALE_MS = 2 * 60 * 1000;
const OVERVIEW_EVENTS_STALE_MS = 5 * 60 * 1000;
const OVERVIEW_SERIES_STALE_MS = 60_000;

function formatRangeLabel(date: Date, range: OverviewRange) {
    if (range === "1d") {
        return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            hour12: true,
        });
    }

    if (range === "all") {
        return date.toLocaleDateString("en-US", {
            month: "short",
            year: "2-digit",
        });
    }

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
}

function buildEmptyRangeLabels(range: OverviewRange) {
    const now = new Date();

    if (range === "1d") {
        return Array.from({ length: 8 }, (_, index) => {
            const point = new Date(now);
            point.setHours(now.getHours() - (7 - index) * 3, 0, 0, 0);
            return formatRangeLabel(point, range);
        });
    }

    if (range === "1w") {
        return Array.from({ length: 7 }, (_, index) => {
            const point = new Date(now);
            point.setDate(now.getDate() - (6 - index));
            return formatRangeLabel(point, range);
        });
    }

    if (range === "1m") {
        return Array.from({ length: 6 }, (_, index) => {
            const point = new Date(now);
            point.setDate(now.getDate() - (5 - index) * 5);
            return formatRangeLabel(point, range);
        });
    }

    return Array.from({ length: 6 }, (_, index) => {
        const point = new Date(now);
        point.setMonth(now.getMonth() - (5 - index));
        return formatRangeLabel(point, range);
    });
}

const STATUS_LABELS: Record<string, string> = {
    live: "Live",
    published: "Live",
    scheduled: "Scheduled",
    approved: "Approved",
    pending: "Pending",
    completed: "Completed",
    cancelled: "Cancelled",
    draft: "Draft",
};

const STATUS_STYLES: Record<string, { color: string; background: string }> = {
    live: { color: "var(--v-success)", background: "var(--v-success-bg)" },
    published: { color: "var(--v-success)", background: "var(--v-success-bg)" },
    scheduled: { color: "var(--v-info)", background: "var(--v-info-bg)" },
    approved: { color: "var(--v-info)", background: "var(--v-info-bg)" },
    pending: { color: "var(--v-warning)", background: "var(--v-warning-bg)" },
    completed: { color: "var(--v-text-secondary)", background: "var(--v-neutral-bg)" },
    cancelled: { color: "var(--v-error)", background: "var(--v-error-bg)" },
    draft: { color: "var(--v-text-tertiary)", background: "var(--v-neutral-bg)" },
};

function getOrderStatusBadge(order: VenueOrder) {
    const statusKey = String(order.status || "").trim().toLowerCase();

    if (statusKey === "cancelled" || statusKey === "canceled") {
        return {
            label: "Cancelled",
            style: {
                color: "rgb(248, 113, 113)",
                borderColor: "rgba(248, 113, 113, 0.3)",
                background: "rgba(248, 113, 113, 0.1)",
            },
        };
    }

    if (statusKey === "refunded") {
        return {
            label: "Refunded",
            style: {
                color: "rgb(251, 191, 36)",
                borderColor: "rgba(251, 191, 36, 0.3)",
                background: "rgba(251, 191, 36, 0.1)",
            },
        };
    }

    return {
        label: order.source === "rsvp" ? "RSVP" : "Ticket",
        style: {
            color: "rgb(96, 165, 250)",
            borderColor: "rgba(96, 165, 250, 0.3)",
            background: "rgba(96, 165, 250, 0.1)",
        },
    };
}

function cardStyle(): CSSProperties {
    return {
        background: "rgba(255,255,255,0.01)",
        border: "1px solid rgba(255,255,255,0.04)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
    };
}

function startOfDay(date: Date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
}

function toDate(value?: string) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getEventDate(event: VenueEvent) {
    return toDate(event.startDate || event.date);
}

function getEventImage(event: VenueEvent) {
    return event.coverImage || event.poster || event.bannerImage || event.image || "";
}

function getEventStatus(event: VenueEvent) {
    const key = (event.lifecycle || event.status || "scheduled").toLowerCase();
    return {
        label: STATUS_LABELS[key] || "Scheduled",
        style: STATUS_STYLES[key] || STATUS_STYLES.scheduled,
    };
}

function formatOrderDateTime(value: string) {
    const date = toDate(value);
    if (!date) return "Date unavailable";
    return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}

function formatEventDateTime(value?: string) {
    const date = toDate(value);
    if (!date) return "Date to be announced";
    return date.toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}

function getInitials(name: string) {
    const parts = name
        .split(" ")
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 2);
    if (parts.length === 0) return "C";
    return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

function SectionHeader({
    eyebrow,
    title,
    description,
    trailing,
}: {
    eyebrow?: string;
    title: string;
    description?: string;
    trailing?: ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div>
                {eyebrow ? (
                    <p
                        className="text-[10px] font-black uppercase tracking-[0.24em] mb-2"
                        style={{ color: "var(--v-text-muted)" }}
                    >
                        {eyebrow}
                    </p>
                ) : null}
                <h2
                    className="text-[24px] font-black tracking-[-0.04em]"
                    style={{ color: "var(--v-text-primary)" }}
                >
                    {title}
                </h2>
                {description ? (
                    <p
                        className="text-[13px] mt-1"
                        style={{ color: "var(--v-text-tertiary)" }}
                    >
                        {description}
                    </p>
                ) : null}
            </div>
            {trailing}
        </div>
    );
}

function SegmentedControl<T extends string>({
    items,
    value,
    onChange,
}: {
    items: Array<{ value: T; label: string; disabled?: boolean }>;
    value: T;
    onChange: (next: T) => void;
}) {
    return (
        <div
            className="inline-flex items-center gap-1 rounded-2xl p-1"
            style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)" }}
        >
            {items.map((item) => {
                const isActive = item.value === value;
                return (
                    <button
                        key={item.value}
                        type="button"
                        disabled={item.disabled}
                        onClick={() => onChange(item.value)}
                        className="px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-[0.14em] transition-all disabled:cursor-not-allowed disabled:opacity-40"
                        style={
                            isActive
                                ? {
                                      background: "var(--v-orange)",
                                      color: "#fff",
                                      boxShadow: "0 8px 18px rgba(244,74,34,0.22)",
                                  }
                                : {
                                      background: "transparent",
                                      color: "var(--v-text-tertiary)",
                                  }
                        }
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}

async function fetchOrdersPage(
    token: string,
    venueId: string,
    page: number,
    limit: number,
) {
    const params = new URLSearchParams({
        venueId,
        page: String(page),
        limit: String(limit),
    });
    const response = await fetch(`/api/venue/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Failed to fetch venue orders");
    return response.json() as Promise<VenueOrdersResponse>;
}


export default function VenueDashboardStreaming() {
    const { profile, user, hasPermission } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;
    const membership = profile?.activeMembership;
    const venueName = membership?.partnerName || "Venue Overview";

    const canViewOrders = hasPermission("VIEW_GUESTLIST");
    const canViewRevenue = hasPermission("VIEW_FINANCIALS");

    const [selectedRange, setSelectedRange] = useState<OverviewRange>("1m");
    const [selectedMetric, setSelectedMetric] = useState<OverviewMetric>("tickets");
    const [orderSearch, setOrderSearch] = useState("");

    useEffect(() => {
        if (selectedMetric === "revenue" && !canViewRevenue) {
            setSelectedMetric("tickets");
        }
    }, [canViewRevenue, selectedMetric]);

    const recentOrdersQuery = useQuery({
        queryKey: ["venue", venueId, "overview-orders-latest"],
        enabled: Boolean(venueId && user && canViewOrders),
        queryFn: async () => {
            const token = await user!.getIdToken();
            const payload = await fetchOrdersPage(token, venueId!, 1, 20);
            return payload.orders || [];
        },
        staleTime: OVERVIEW_ORDERS_STALE_MS,
        refetchOnMount: false,
    });

    const timeSeriesQuery = useQuery({
        queryKey: ["venue", venueId, "time-series", selectedRange, selectedMetric],
        enabled: Boolean(venueId && user && canViewOrders),
        queryFn: async (): Promise<TimeSeriesResponse> => {
            const token = await user!.getIdToken();
            const params = new URLSearchParams({
                venueId: venueId!,
                range: selectedRange,
                metric: selectedMetric,
            });
            const res = await fetch(`/api/venue/analytics/time-series?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                const errorText = await res.text();
                console.error("[Venue Overview] time-series request failed", {
                    venueId,
                    range: selectedRange,
                    metric: selectedMetric,
                    status: res.status,
                    body: errorText,
                });
                throw new Error("Failed to fetch time-series data");
            }
            return res.json();
        },
        staleTime: OVERVIEW_SERIES_STALE_MS,
        refetchOnMount: false,
        refetchInterval: selectedRange === "1d" ? OVERVIEW_REFRESH_MS : false,
        refetchIntervalInBackground: false,
    });

    const upcomingEventsQuery = useQuery({
        queryKey: ["venue", venueId, "overview-events"],
        enabled: Boolean(venueId && user),
        queryFn: async () => {
            const token = await user!.getIdToken();
            const params = new URLSearchParams({
                venueId: venueId!,
                limit: "20",
                status: "all",
            });
            const response = await fetch(`/api/venue/events?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) throw new Error("Failed to fetch venue events");
            return response.json() as Promise<VenueEventsResponse>;
        },
        staleTime: OVERVIEW_EVENTS_STALE_MS,
        refetchOnMount: false,
    });

    const latestOrders = recentOrdersQuery.data || [];
    const filteredLatestOrders = useMemo(() => {
        const query = orderSearch.trim().toLowerCase();
        if (!query) return latestOrders;
        return latestOrders.filter((order) =>
            [order.customerName, order.eventName, order.orderNumber]
                .filter(Boolean)
                .some((value) => value.toLowerCase().includes(query))
        );
    }, [latestOrders, orderSearch]);

    const chartData = useMemo((): ChartPoint[] => {
        const series = timeSeriesQuery.data?.series || [];
        return series.map((pt) => ({
            label: pt.label,
            value: Number(
                selectedMetric === "revenue"
                    ? (pt.revenue ?? pt.value ?? 0)
                    : (pt.ticketsSold ?? pt.value ?? 0)
            ),
        }));
    }, [timeSeriesQuery.data, selectedMetric]);

    const chartTotal = useMemo(
        () => chartData.reduce((sum: number, point: ChartPoint) => sum + point.value, 0),
        [chartData],
    );
    const emptyChartLabels = useMemo(
        () => buildEmptyRangeLabels(selectedRange),
        [selectedRange],
    );

    const upcomingEvents = useMemo(() => {
        const now = startOfDay(new Date());
        const items = (upcomingEventsQuery.data?.events || [])
            .filter((event) => {
                const eventDate = getEventDate(event);
                return Boolean(eventDate && eventDate >= now);
            })
            .sort((left, right) => {
                const leftDate = getEventDate(left)?.getTime() || 0;
                const rightDate = getEventDate(right)?.getTime() || 0;
                return leftDate - rightDate;
            });
        return items.slice(0, 8);
    }, [upcomingEventsQuery.data]);

    return (
        <div className="pt-[3px] lg:pt-[6px]">
        <VenuePageShell
            title="Overview"
            noPadding
        >
            <div className="flex flex-col gap-2">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.85fr)_minmax(320px,0.95fr)] gap-6 xl:items-stretch">
                <section
                    className="rounded-[32px] px-4 pt-4 pb-2 h-full"
                    style={cardStyle()}
                >
                    <div className="flex flex-col gap-1">
                        <SectionHeader title="Performance" />

                        <div className="flex flex-wrap items-end justify-between gap-4 mt-2 mb-2">
                            <SegmentedControl<OverviewMetric>
                                items={METRIC_OPTIONS.map((option) => ({
                                    ...option,
                                    disabled: option.value === "revenue" && !canViewRevenue,
                                }))}
                                value={selectedMetric}
                                onChange={(next) => setSelectedMetric(next)}
                            />
                            <div className="text-left sm:text-right leading-none min-w-[110px]">
                                <p
                                    className="text-[10px] font-black uppercase tracking-[0.22em]"
                                    style={{ color: "var(--v-text-muted)" }}
                                >
                                    {selectedMetric === "revenue" ? "Revenue" : "Tickets"}
                                </p>
                                <p
                                    className="text-[40px] font-black tracking-[-0.08em] leading-[0.82] mt-3 whitespace-normal break-words"
                                    style={{ color: "var(--v-text-primary)" }}
                                >
                                    {selectedMetric === "revenue"
                                        ? formatINRCompact(chartTotal)
                                        : formatNumber(chartTotal)}
                                </p>
                            </div>
                        </div>

                        {!canViewOrders ? (
                            <div
                                className="rounded-[28px] min-h-[360px] flex flex-col items-center justify-center text-center px-6"
                                style={{
                                    background: "var(--v-neutral-bg)",
                                    border: "1px dashed var(--v-border)",
                                }}
                            >
                                <ShoppingBag
                                    className="w-8 h-8 mb-3"
                                    style={{ color: "var(--v-text-muted)" }}
                                />
                                <p
                                    className="text-[15px] font-semibold"
                                    style={{ color: "var(--v-text-primary)" }}
                                >
                                    Order history access is required
                                </p>
                                <p
                                    className="text-[12px] mt-2 max-w-sm"
                                    style={{ color: "var(--v-text-tertiary)" }}
                                >
                                    This graph is built from cross-event venue orders, so it only appears for roles with guestlist access.
                                </p>
                            </div>
                        ) : timeSeriesQuery.isLoading ? (
                            <ChartSkeleton height={360} />
                        ) : (
                            <VenueChart
                                type={selectedMetric === "tickets" ? "line" : "area"}
                                data={chartData}
                                config={{
                                    dataKey: "value",
                                    xKey: "label",
                                    color: selectedMetric === "tickets" ? "var(--v-chart-2)" : "var(--v-chart-1)",
                                    gradientId: `venue-overview-${selectedMetric}-${selectedRange}`,
                                }}
                                title={`${selectedMetric} over ${selectedRange}`}
                                height={360}
                                empty={chartData.length === 0 || chartTotal === 0}
                                emptyLabels={emptyChartLabels}
                            />
                        )}

                        <div className="flex justify-end mt-2">
                            <SegmentedControl<OverviewRange>
                                items={RANGE_OPTIONS}
                                value={selectedRange}
                                onChange={(next) => setSelectedRange(next)}
                            />
                        </div>
                    </div>
                </section>

                <aside
                    className="rounded-[32px] px-4 pt-4 pb-3 flex flex-col min-h-[500px] xl:h-[580px]"
                    style={cardStyle()}
                >
                    <SectionHeader
                        title="Latest Orders"
                        trailing={
                            <Link
                                href="/venue/orders"
                                className="inline-flex items-center px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all hover:bg-white/5 active:scale-95 border border-white/5 hover:border-white/10"
                                style={{ color: "var(--v-text-tertiary)" }}
                            >
                                View more
                            </Link>
                        }
                    />

                    <div className="mt-4 relative group">
                        <Search
                            className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors group-focus-within:text-orange-500"
                            style={{ color: "var(--v-text-muted)" }}
                        />
                        <input
                            type="text"
                            value={orderSearch}
                            onChange={(event) => setOrderSearch(event.target.value)}
                            placeholder="Search orders, customers, events..."
                            className="w-full h-12 rounded-[20px] pl-11 pr-4 text-[13px] font-medium outline-none transition-all placeholder:text-text-placeholder focus:ring-2 focus:ring-orange-500/20"
                            style={{
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid var(--v-divider)",
                                color: "var(--v-text-primary)",
                            }}
                        />
                    </div>

                    <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar min-h-0">
                        {!canViewOrders ? (
                            <div
                                className="rounded-[24px] px-5 py-8 text-center"
                                style={{
                                    background: "var(--v-neutral-bg)",
                                    border: "1px dashed var(--v-border)",
                                }}
                            >
                                <p
                                    className="text-[13px] font-semibold"
                                    style={{ color: "var(--v-text-primary)" }}
                                >
                                    Orders are hidden for this role
                                </p>
                                <p
                                    className="text-[12px] mt-2"
                                    style={{ color: "var(--v-text-tertiary)" }}
                                >
                                    Guestlist access is required to view venue-wide order activity.
                                </p>
                            </div>
                        ) : recentOrdersQuery.isLoading ? (
                            Array.from({ length: 5 }).map((_, index) => (
                                <div
                                    key={index}
                                    className="h-[88px] rounded-[24px] v-skeleton"
                                />
                            ))
                        ) : filteredLatestOrders.length === 0 ? (
                            <div
                                className="rounded-[24px] px-5 py-10 text-center"
                                style={{
                                    background: "var(--v-neutral-bg)",
                                    border: "1px dashed var(--v-border)",
                                }}
                            >
                                <ShoppingBag
                                    className="w-8 h-8 mx-auto mb-3"
                                    style={{ color: "var(--v-text-muted)" }}
                                />
                                <p
                                    className="text-[13px] font-semibold"
                                    style={{ color: "var(--v-text-primary)" }}
                                >
                                    {orderSearch.trim() ? "No matching orders" : "No recent orders"}
                                </p>
                            </div>
                        ) : (
                             filteredLatestOrders.map((order) => {
                                const badge = getOrderStatusBadge(order);

                                return (
                                <Link
                                    key={order.id}
                                    href={`/venue/events/${order.eventId}?section=attendees&attendeeId=${encodeURIComponent(order.attendeeId)}&orderId=${encodeURIComponent(order.orderId)}`}
                                >
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="group relative rounded-[28px] p-4 transition-all hover:bg-white/[0.04] active:scale-[0.98] cursor-pointer"
                                    style={{
                                        background: "rgba(255,255,255,0.02)",
                                        border: "1px solid rgba(255,255,255,0.05)",
                                    }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="relative shrink-0">
                                            <div
                                                className="h-12 w-12 rounded-2xl flex items-center justify-center text-[14px] font-black tracking-tight transition-transform group-hover:scale-105"
                                                style={{
                                                    background: "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))",
                                                    border: "1px solid rgba(255,255,255,0.08)",
                                                    color: "var(--v-text-primary)",
                                                    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                                                }}
                                            >
                                                {getInitials(order.customerName)}
                                            </div>
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <p
                                                className="text-[14px] font-black truncate leading-none group-hover:text-orange-500 transition-colors"
                                                style={{ color: "var(--v-text-primary)" }}
                                            >
                                                {order.customerName}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5 overflow-hidden">
                                                <span 
                                                    className="text-[11px] font-bold uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-md"
                                                    style={{ color: "var(--v-text-tertiary)" }}
                                                >
                                                    {order.eventName}
                                                </span>
                                                <span className="shrink-0 w-1 h-1 rounded-full bg-white/20" />
                                                <span className="text-[11px] font-medium truncate" style={{ color: "var(--v-text-muted)" }}>
                                                    {formatOrderDateTime(order.createdAt).split(",")[0]}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <div
                                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest mb-2 border"
                                                style={badge.style}
                                            >
                                                {badge.label}
                                            </div>
                                            <p
                                                className="text-[16px] font-black tracking-[-0.04em] leading-none"
                                                style={{ color: "var(--v-text-primary)" }}
                                            >
                                                {canViewRevenue
                                                    ? formatINRCompact(order.amount)
                                                    : `${formatNumber(order.ticketsCount)} tix`}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* Subtle Gradient Glow on Hover */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 to-orange-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity rounded-[28px] pointer-events-none" />
                                </motion.div>
                                </Link>
                            )})
                        )}
                    </div>

                </aside>
            </div>

            <div className="pt-1">
                <SectionHeader title="Upcoming Events" />
            </div>

            <section
                className="rounded-[32px] px-4 pt-4 pb-4"
                style={cardStyle()}
            >

                <div className="space-y-3">
                    {upcomingEventsQuery.isLoading ? (
                        Array.from({ length: 4 }).map((_, index) => (
                            <div
                                key={index}
                                className="h-[108px] rounded-[28px] v-skeleton"
                            />
                        ))
                    ) : upcomingEvents.length === 0 ? (
                        <div
                            className="rounded-[28px] px-6 py-12 text-center"
                            style={{
                                background: "var(--v-neutral-bg)",
                                border: "1px dashed var(--v-border)",
                            }}
                        >
                            <CalendarDays
                                className="w-8 h-8 mx-auto mb-3"
                                style={{ color: "var(--v-text-muted)" }}
                            />
                            <p
                                className="text-[14px] font-semibold"
                                style={{ color: "var(--v-text-primary)" }}
                            >
                                No upcoming events scheduled
                            </p>
                        </div>
                    ) : (
                        upcomingEvents.map((event) => {
                            const eventImage = getEventImage(event);
                            const status = getEventStatus(event);

                            return (
                                <Link
                                    key={event.id}
                                    href={`/venue/events/${event.id}`}
                                    className="group relative block rounded-[28px] p-4 sm:p-5 transition-all overflow-hidden"
                                    style={{
                                        background: "transparent",
                                        border: "1px solid var(--v-divider)",
                                    }}
                                >
                                    {eventImage ? (
                                        <>
                                            <div
                                                className="absolute inset-y-0 left-0 w-[52%] opacity-[0.28] transition-opacity duration-500 group-hover:opacity-[0.38]"
                                                style={{
                                                    backgroundImage: `url(${eventImage})`,
                                                    backgroundSize: "cover",
                                                    backgroundPosition: "center",
                                                    filter: "blur(44px) saturate(1.22) brightness(1.02)",
                                                    transform: "scale(1.16)",
                                                }}
                                            />
                                            <div
                                                className="absolute inset-y-0 left-[8%] w-[28%] opacity-[0.22] transition-opacity duration-500 group-hover:opacity-[0.3]"
                                                style={{
                                                    backgroundImage: `url(${eventImage})`,
                                                    backgroundSize: "cover",
                                                    backgroundPosition: "center",
                                                    filter: "blur(70px) saturate(1.35)",
                                                    transform: "scale(1.3)",
                                                }}
                                            />
                                            <div
                                                className="absolute inset-0"
                                                style={{
                                                    background:
                                                        "linear-gradient(90deg, rgba(18,18,20,0.46) 0%, rgba(18,18,20,0.62) 22%, rgba(18,18,20,0.84) 48%, rgba(18,18,20,0.96) 100%)",
                                                }}
                                            />
                                        </>
                                    ) : null}

                                    <div className="relative z-10 flex items-center gap-4">
                                        <div
                                            className="w-[84px] h-[112px] sm:w-[96px] sm:h-[128px] rounded-[22px] overflow-hidden shrink-0"
                                            style={{ background: "var(--v-neutral-bg)" }}
                                        >
                                            {eventImage ? (
                                                <img
                                                    src={eventImage}
                                                    alt={event.title}
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <ImageIcon
                                                        className="w-7 h-7"
                                                        style={{ color: "var(--v-text-muted)" }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <h3
                                                className="text-[18px] font-black tracking-[-0.04em] mt-3 line-clamp-1 uppercase"
                                                style={{ color: "var(--v-text-primary)" }}
                                            >
                                                {event.title}
                                            </h3>

                                            <p
                                                className="text-[13px] mt-2 line-clamp-2"
                                                style={{ color: "var(--v-text-secondary)" }}
                                            >
                                                {formatEventDateTime(event.startDate || event.date)}
                                            </p>

                                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                                                <span
                                                    className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]"
                                                    style={status.style}
                                                >
                                                    {status.label}
                                                </span>
                                                {venueName ? (
                                                    <span
                                                        className="text-[11px] font-semibold"
                                                        style={{ color: "var(--v-text-tertiary)" }}
                                                    >
                                                        {venueName}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="shrink-0 hidden sm:flex items-center gap-2">
                                            <span
                                                className="text-[11px] font-black uppercase tracking-[0.14em]"
                                                style={{ color: "var(--v-orange)" }}
                                            >
                                                Open
                                            </span>
                                            <ChevronRight
                                                className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                                                style={{ color: "var(--v-orange)" }}
                                            />
                                        </div>
                                    </div>
                                </Link>
                            );
                        })
                    )}
                </div>
            </section>
            </div>
        </VenuePageShell>
        </div>
    );
}
