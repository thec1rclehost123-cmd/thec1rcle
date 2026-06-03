"use client";

import { useMemo } from "react";

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

function formatCompactINR(value: number | undefined) {
    if (value === undefined || value === null) return "₹0";
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(value);
}

interface OverviewChartProps {
    metric: ChartMetric;
    setMetric: (metric: ChartMetric) => void;
    range: ChartRange;
    setRange: (range: ChartRange) => void;
    analyticsTimeline: any[];
    analyticsOverview: any;
    loading: boolean;
}

export default function OverviewChart({
    metric,
    setMetric,
    range,
    setRange,
    analyticsTimeline,
    analyticsOverview,
    loading
}: OverviewChartProps) {

    const chartValues = useMemo(() => {
        const source = analyticsTimeline.length > 0 ? analyticsTimeline : buildZeroStateDates(range).map((date) => ({ date }));
        return source.map((point: any) =>
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

    return (
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
                        {chartLabels.filter((_, index) => index % Math.max(1, Math.floor(chartLabels.length / 6)) === 0).slice(0, 6).map((label, i) => (
                            <span
                                key={`${label}-${i}`}
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
                                background: active ? "#2e3038" : "transparent",
                                color: active ? "#fff" : "rgba(255,255,255,0.3)",
                            }}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
