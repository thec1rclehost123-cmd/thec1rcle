"use client";

import dynamic from "next/dynamic";
import { Suspense, useState } from "react";
import { cn } from "@/lib/utils";
import type { CashflowDataPoint } from "@/lib/finance/definitions";
import { formatINRCompact } from "@/lib/finance/definitions";
import { ChartSkeleton } from "@/components/ui/VenueChart";

// Disable SSR for recharts to prevent useContext/DOM errors during Next.js generation
const RechartsComposed = dynamic(() =>
    // @ts-ignore
    import("recharts").then((m: any) => {
        return function CashflowInner({
            data,
            series,
            height,
        }: {
            data: CashflowDataPoint[];
            series: SeriesConfig[];
            height: number;
        }) {
            const {
                ComposedChart,
                Area,
                Line,
                Bar,
                XAxis,
                YAxis,
                Tooltip,
                Legend,
                ResponsiveContainer,
                CartesianGrid,
            } = m;

            return (
                <ResponsiveContainer width="100%" height={height}>
                    <ComposedChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                        <defs>
                            <linearGradient id="grad-in" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor="#34D399" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="grad-out" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor="#F87171" stopOpacity={0.18} />
                                <stop offset="95%" stopColor="#F87171" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="grad-net" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor="#818CF8" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#818CF8" stopOpacity={0} />
                            </linearGradient>
                        </defs>

                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(128,128,128,0.12)"
                            vertical={false}
                        />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: "#9B9B9F" }}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: "#9B9B9F" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={formatINRCompact}
                        />
                        <Tooltip
                            contentStyle={{
                                background: "var(--bg-elevated)",
                                border: "1px solid var(--border-subtle)",
                                borderRadius: 14,
                                fontSize: 12,
                                color: "var(--text-primary)",
                                boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                                padding: "10px 14px",
                            }}
                            labelStyle={{ color: "var(--text-tertiary)", marginBottom: 6, fontSize: 10 }}
                            cursor={{ stroke: "rgba(128,128,128,0.20)" }}
                            formatter={(value: number) => formatINRCompact(value)}
                        />
                        <Legend
                            wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                            formatter={(label) => (
                                <span style={{ color: "var(--text-secondary)", fontWeight: 600, letterSpacing: "0.04em" }}>
                                    {label}
                                </span>
                            )}
                        />

                        {/* Money In — filled area */}
                        {series.includes("moneyIn") && (
                            <Area
                                type="monotone"
                                dataKey="moneyIn"
                                name="Money In"
                                stroke="#34D399"
                                strokeWidth={2}
                                fill="url(#grad-in)"
                                dot={false}
                                isAnimationActive={true}
                            />
                        )}
                        {/* Money Out — filled area */}
                        {series.includes("moneyOut") && (
                            <Area
                                type="monotone"
                                dataKey="moneyOut"
                                name="Money Out"
                                stroke="#F87171"
                                strokeWidth={2}
                                fill="url(#grad-out)"
                                dot={false}
                                isAnimationActive={true}
                            />
                        )}
                        {/* Net — line, most prominent */}
                        {series.includes("net") && (
                            <Line
                                type="monotone"
                                dataKey="net"
                                name="Net"
                                stroke="#818CF8"
                                strokeWidth={2.5}
                                dot={false}
                                isAnimationActive={true}
                            />
                        )}
                        {/* Fees — subtle bar */}
                        {series.includes("fees") && (
                            <Bar
                                dataKey="fees"
                                name="Fees"
                                fill="rgba(251,146,60,0.5)"
                                radius={[2, 2, 0, 0]}
                                maxBarSize={8}
                                isAnimationActive={true}
                            />
                        )}
                        {/* Refunds — bar */}
                        {series.includes("refunds") && (
                            <Bar
                                dataKey="refunds"
                                name="Refunds"
                                fill="rgba(148,163,184,0.5)"
                                radius={[2, 2, 0, 0]}
                                maxBarSize={8}
                                isAnimationActive={true}
                            />
                        )}
                        {/* Payouts — bar */}
                        {series.includes("payouts") && (
                            <Bar
                                dataKey="payouts"
                                name="Payouts"
                                fill="rgba(99,102,241,0.5)"
                                radius={[2, 2, 0, 0]}
                                maxBarSize={8}
                                isAnimationActive={true}
                            />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            );
        };
    }),
    { ssr: false }
);

// ── Types ────────────────────────────────────────────────────────────────────

type SeriesConfig = "moneyIn" | "moneyOut" | "net" | "fees" | "refunds" | "payouts";
type TimeRange = "7d" | "30d" | "90d" | "ytd";

interface CashflowChartProps {
    data: CashflowDataPoint[];
    height?: number;
    loading?: boolean;
    showSeriesToggle?: boolean;
    showTimeRangePicker?: boolean;
    onTimeRangeChange?: (range: TimeRange) => void;
    activeRange?: TimeRange;
    className?: string;
}

const SERIES_OPTIONS: { key: SeriesConfig; label: string; color: string }[] = [
    { key: "moneyIn",  label: "Money In",  color: "#34D399" },
    { key: "moneyOut", label: "Money Out", color: "#F87171" },
    { key: "net",      label: "Net",       color: "#818CF8" },
    { key: "fees",     label: "Fees",      color: "#FB923C" },
    { key: "refunds",  label: "Refunds",   color: "#94A3B8" },
    { key: "payouts",  label: "Payouts",   color: "#6366F1" },
];

const TIME_RANGES: { value: TimeRange; label: string }[] = [
    { value: "7d",  label: "7D" },
    { value: "30d", label: "30D" },
    { value: "90d", label: "90D" },
    { value: "ytd", label: "YTD" },
];

// ── CashflowChart ────────────────────────────────────────────────────────────

export function CashflowChart({
    data,
    height = 280,
    loading = false,
    showSeriesToggle = true,
    showTimeRangePicker = true,
    onTimeRangeChange,
    activeRange = "30d",
    className,
}: CashflowChartProps) {
    const [activeSeries, setActiveSeries] = useState<SeriesConfig[]>(["moneyIn", "moneyOut", "net"]);

    const toggleSeries = (key: SeriesConfig) => {
        setActiveSeries((prev) =>
            prev.includes(key) ? (prev.length > 1 ? prev.filter((s) => s !== key) : prev) : [...prev, key]
        );
    };

    return (
        <div className={cn("flex flex-col gap-4", className)}>
            {/* Controls row */}
            {(showSeriesToggle || showTimeRangePicker) && (
                <div className="flex items-center justify-between flex-wrap gap-3">
                    {/* Series toggles */}
                    {showSeriesToggle && (
                        <div className="flex items-center gap-2 flex-wrap">
                            {SERIES_OPTIONS.map((opt) => {
                                const active = activeSeries.includes(opt.key);
                                return (
                                    <button
                                        key={opt.key}
                                        onClick={() => toggleSeries(opt.key)}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wide transition-all duration-150"
                                        style={{
                                            background: active ? `${opt.color}18` : "var(--bg-fill)",
                                            color: active ? opt.color : "var(--text-tertiary)",
                                            border: `1px solid ${active ? `${opt.color}30` : "transparent"}`,
                                        }}
                                    >
                                        <span
                                            className="w-2 h-2 rounded-full"
                                            style={{ background: active ? opt.color : "var(--border-default)" }}
                                        />
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Time range picker */}
                    {showTimeRangePicker && (
                        <div className="flex items-center gap-0.5 p-0.5 rounded-xl" style={{ background: "var(--bg-fill)" }}>
                            {TIME_RANGES.map((r) => (
                                <button
                                    key={r.value}
                                    onClick={() => onTimeRangeChange?.(r.value)}
                                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all duration-150"
                                    style={{
                                        background: activeRange === r.value ? "var(--bg-elevated)" : "transparent",
                                        color: activeRange === r.value ? "var(--text-primary)" : "var(--text-tertiary)",
                                    }}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Chart */}
            {loading ? (
                <ChartSkeleton height={height} />
            ) : !data || data.length === 0 ? (
                <div
                    className="w-full rounded-2xl flex items-center justify-center"
                    style={{
                        height,
                        background: "var(--bg-fill)",
                        border: "1px dashed var(--border-subtle)",
                    }}
                >
                    <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                        No data for this period
                    </span>
                </div>
            ) : (
                <Suspense fallback={<ChartSkeleton height={height} />}>
                    <RechartsComposed data={data} series={activeSeries} height={height} />
                </Suspense>
            )}
        </div>
    );
}

export default CashflowChart;
