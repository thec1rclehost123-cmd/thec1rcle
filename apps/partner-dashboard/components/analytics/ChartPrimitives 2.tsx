"use client";

/**
 * THE C1RCLE — Analytics Chart Primitives
 *
 * Production-grade chart components for the analytics page.
 * All use recharts, lazy-loaded to keep non-analytics bundles clean.
 * All render meaningful zero-states (flat lines, empty bars, muted grids).
 *
 * Components:
 *   SparkLine         — 30-point inline area chart for KPI tiles
 *   FunnelWaterfall   — horizontal funnel with stage drop-off labels
 *   HeatmapGrid       — day × hour activity heatmap
 *   HorizRankBars     — horizontal ranked bar list
 *   MultiLineChart    — overlapping lines (e.g. retention cohorts)
 *   StackedBarChart   — stacked revenue breakdown
 *   DonutSplit        — donut with center stat (gender / source)
 */

import { lazy, Suspense, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

// ── Shared tooltip style ───────────────────────────────────────────────────────

export const TOOLTIP_STYLE = {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-subtle)",
    borderRadius: 12,
    fontSize: 12,
    color: "var(--text-primary)",
    padding: "8px 12px",
};

// ── Chart skeleton ─────────────────────────────────────────────────────────────

export function ChartSkeleton({ height = 200, className }: { height?: number; className?: string }) {
    return (
        <div
            className={cn("rounded-2xl animate-pulse", className)}
            style={{ height, background: "var(--bg-fill)" }}
            aria-label="Loading chart..."
        />
    );
}

// ── SparkLine ─────────────────────────────────────────────────────────────────
// Tiny 30-point area chart that fits inside a KPI tile.

const LazySparkLine = lazy(() =>
    (import("recharts") as any).then((m: any) => ({
        default: function SparkChart({
            data, color, height,
        }: { data: number[]; color: string; height: number }) {
            const { AreaChart, Area, ResponsiveContainer } = m;
            const Defs = "defs" as any;
            const LinearGradient = "linearGradient" as any;
            const Stop = "stop" as any;
            const chartData = data.map((v, i) => ({ i, v }));
            const gradId = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;
            return (
                <ResponsiveContainer width="100%" height={height}>
                    <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                        <Defs>
                            <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="5%" stopColor={color} stopOpacity={0.35} />
                                <Stop offset="95%" stopColor={color} stopOpacity={0} />
                            </LinearGradient>
                        </Defs>
                        <Area
                            type="monotone" dataKey="v"
                            stroke={color} strokeWidth={1.5}
                            fill={`url(#${gradId})`}
                            dot={false} isAnimationActive={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            );
        },
    }))
);

interface SparkLineProps {
    data: number[];
    color?: string;
    height?: number;
    className?: string;
}

export function SparkLine({ data, color = "var(--accent)", height = 40, className }: SparkLineProps) {
    const allZero = data.every(v => v === 0);
    if (allZero) {
        return (
            <div
                className={cn("w-full", className)}
                style={{ height }}
                aria-hidden="true"
            >
                <svg width="100%" height={height}>
                    <line
                        x1="0" y1={height / 2} x2="100%" y2={height / 2}
                        stroke="rgba(128,128,128,0.20)" strokeWidth={1.5}
                        strokeDasharray="3 3"
                    />
                </svg>
            </div>
        );
    }
    return (
        <div className={cn("w-full", className)} style={{ height }}>
            <Suspense fallback={<div style={{ height }} />}>
                <LazySparkLine data={data} color={color} height={height} />
            </Suspense>
        </div>
    );
}

// ── FunnelWaterfall ───────────────────────────────────────────────────────────
// Horizontal funnel showing stage counts and drop-off percentages.

interface FunnelStage {
    name: string;
    count: number;
    dropPct: number;
    conversionFromTop: number;
    label: string;
}

interface FunnelWaterfallProps {
    stages: FunnelStage[];
    className?: string;
}

const FUNNEL_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--text-tertiary)",
];

export function FunnelWaterfall({ stages, className }: FunnelWaterfallProps) {
    const maxCount = Math.max(...stages.map(s => s.count), 1);

    return (
        <div className={cn("space-y-2", className)} role="img" aria-label="Conversion funnel">
            {stages.map((stage, i) => {
                const widthPct = maxCount > 0 ? Math.max((stage.count / maxCount) * 100, 4) : 4;
                const color = FUNNEL_COLORS[i % FUNNEL_COLORS.length];
                const isLast = i === stages.length - 1;

                return (
                    <div key={stage.name} className="group">
                        {/* Bar row */}
                        <div className="flex items-center gap-3">
                            {/* Stage label */}
                            <div className="w-28 shrink-0 text-right">
                                <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                                    {stage.label}
                                </span>
                            </div>

                            {/* Bar */}
                            <div className="flex-1 relative">
                                <div
                                    className="h-8 rounded-lg transition-all duration-700 flex items-center justify-end pr-3"
                                    style={{
                                        width: `${widthPct}%`,
                                        background: stage.count === 0
                                            ? "var(--bg-fill)"
                                            : color,
                                        opacity: stage.count === 0 ? 0.4 : 1,
                                    }}
                                >
                                    <span
                                        className="text-[11px] font-bold tabular-nums"
                                        style={{ color: stage.count === 0 ? "var(--text-tertiary)" : "rgba(255,255,255,0.9)" }}
                                    >
                                        {stage.count === 0 ? "—" : stage.count.toLocaleString("en-IN")}
                                    </span>
                                </div>
                            </div>

                            {/* Conversion from top */}
                            <div className="w-14 shrink-0 text-right">
                                <span className="text-[11px] font-semibold tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                                    {stage.count === 0 ? "—" : `${stage.conversionFromTop.toFixed(0)}%`}
                                </span>
                            </div>
                        </div>

                        {/* Drop arrow between stages */}
                        {!isLast && stage.dropPct > 0 && (
                            <div className="flex items-center gap-3 py-0.5 opacity-60">
                                <div className="w-28 shrink-0" />
                                <div className="pl-1">
                                    <span className="text-[10px] font-semibold" style={{ color: "var(--color-error)" }}>
                                        ↓ {stage.dropPct.toFixed(0)}% drop
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ── HeatmapGrid ───────────────────────────────────────────────────────────────
// Day × hour heatmap for arrival / activity patterns.

interface HeatmapCell {
    day: string;
    hour: string;
    value: number;
}

interface HeatmapGridProps {
    data: HeatmapCell[];
    days: string[];
    hours: string[];
    label?: string;
    className?: string;
}

export function HeatmapGrid({ data, days, hours, label = "Activity Heatmap", className }: HeatmapGridProps) {
    const maxVal = Math.max(...data.map(c => c.value), 1);

    function getCell(day: string, hour: string): HeatmapCell | undefined {
        return data.find(c => c.day === day && c.hour === hour);
    }

    function getCellOpacity(value: number): number {
        if (value === 0) return 0.04;
        return 0.12 + (value / maxVal) * 0.82;
    }

    return (
        <div className={cn("overflow-x-auto", className)} role="img" aria-label={label}>
            <div className="min-w-[440px]">
                {/* Hour labels */}
                <div className="flex items-center mb-1.5 pl-9">
                    {hours.map(hour => (
                        <div key={hour} className="flex-1 text-center">
                            <span className="text-[9px] font-semibold" style={{ color: "var(--text-tertiary)" }}>
                                {hour.slice(0, 2)}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Grid */}
                {days.map(day => (
                    <div key={day} className="flex items-center mb-1">
                        {/* Day label */}
                        <div className="w-8 shrink-0 mr-1">
                            <span className="text-[10px] font-semibold" style={{ color: "var(--text-tertiary)" }}>
                                {day}
                            </span>
                        </div>

                        {/* Hour cells */}
                        {hours.map(hour => {
                            const cell = getCell(day, hour);
                            const val = cell?.value ?? 0;
                            const opacity = getCellOpacity(val);

                            return (
                                <div key={hour} className="flex-1 px-0.5">
                                    <div
                                        className="w-full rounded-md transition-all duration-300 group relative cursor-default"
                                        style={{
                                            height: 22,
                                            background: `rgba(244, 74, 34, ${opacity})`,
                                            border: "1px solid var(--border-subtle)",
                                        }}
                                        title={val > 0 ? `${day} ${hour}: ${val} guests` : undefined}
                                    />
                                </div>
                            );
                        })}
                    </div>
                ))}

                {/* Legend */}
                <div className="flex items-center gap-2 mt-3 pl-9">
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Less</span>
                    {[0.04, 0.18, 0.36, 0.55, 0.75, 0.94].map((op, i) => (
                        <div
                            key={i}
                            className="w-4 h-4 rounded"
                            style={{ background: `rgba(244, 74, 34, ${op})` }}
                        />
                    ))}
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>More</span>
                </div>
            </div>
        </div>
    );
}

// ── HorizRankBars ─────────────────────────────────────────────────────────────
// Horizontal ranked bar list for promoter/channel rankings.

interface RankRow {
    label: string;
    value: number;
    formattedValue?: string;
    subValue?: string;
    badge?: string;
    badgeColor?: string;
    color?: string;
}

interface HorizRankBarsProps {
    rows: RankRow[];
    maxValue?: number;
    showRank?: boolean;
    className?: string;
}

export function HorizRankBars({ rows, maxValue, showRank = true, className }: HorizRankBarsProps) {
    const max = maxValue ?? Math.max(...rows.map(r => r.value), 1);

    return (
        <div className={cn("space-y-3", className)}>
            {rows.map((row, i) => {
                const widthPct = max > 0 ? Math.max((row.value / max) * 100, 2) : 2;
                const color = row.color ?? `var(--chart-${(i % 5) + 1})`;

                return (
                    <div key={row.label} className="group">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                {showRank && (
                                    <span
                                        className="text-[10px] font-black w-4 text-right shrink-0"
                                        style={{ color: "var(--text-tertiary)" }}
                                    >
                                        {i + 1}
                                    </span>
                                )}
                                <span
                                    className="text-[13px] font-semibold truncate max-w-[120px]"
                                    style={{ color: "var(--text-primary)" }}
                                >
                                    {row.label}
                                </span>
                                {row.badge && (
                                    <span
                                        className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                                        style={{
                                            background: row.badgeColor
                                                ? `${row.badgeColor}22`
                                                : "var(--bg-fill)",
                                            color: row.badgeColor ?? "var(--text-tertiary)",
                                        }}
                                    >
                                        {row.badge}
                                    </span>
                                )}
                            </div>
                            <div className="text-right shrink-0 ml-3">
                                <span
                                    className="text-[13px] font-bold tabular-nums"
                                    style={{ color: row.value === 0 ? "var(--text-tertiary)" : "var(--text-primary)" }}
                                >
                                    {row.formattedValue ?? (row.value === 0 ? "—" : row.value.toLocaleString("en-IN"))}
                                </span>
                                {row.subValue && (
                                    <div
                                        className="text-[10px] font-medium"
                                        style={{ color: "var(--text-tertiary)" }}
                                    >
                                        {row.subValue}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div
                            className="w-full rounded-full overflow-hidden"
                            style={{ height: 4, background: "var(--border-subtle)" }}
                        >
                            <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                    width: `${widthPct}%`,
                                    background: row.value === 0
                                        ? "var(--bg-fill)"
                                        : color,
                                    opacity: row.value === 0 ? 0.5 : 1,
                                }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── DonutSplit ────────────────────────────────────────────────────────────────
// Donut chart with center label for audience/source splits.

const LazyDonutSplit = lazy(() =>
    (import("recharts") as any).then((m: any) => ({
        default: function DonutChart({
            data, colors, centerLabel, centerSub, height,
        }: {
            data: { name: string; value: number }[];
            colors: string[];
            centerLabel: string;
            centerSub?: string;
            height: number;
        }) {
            const { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } = m;
            const hasData = data.some(d => d.value > 0);
            const chartData = hasData ? data : [{ name: "No data", value: 1 }];
            const chartColors = hasData ? colors : ["var(--border-subtle)"];

            return (
                <ResponsiveContainer width="100%" height={height}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={Math.floor(height * 0.28)}
                            outerRadius={Math.floor(height * 0.42)}
                            paddingAngle={hasData ? 2 : 0}
                            dataKey="value"
                            strokeWidth={0}
                            startAngle={90}
                            endAngle={-270}
                        >
                            {chartData.map((_: any, i: number) => (
                                <Cell key={i} fill={chartColors[i % chartColors.length]} />
                            ))}
                        </Pie>
                        {hasData && (
                            <Tooltip
                                contentStyle={TOOLTIP_STYLE}
                                formatter={(val: any, name: any) => [
                                    `${Number(val).toLocaleString("en-IN")} (${
                                        data.reduce((sum, d) => sum + d.value, 0) > 0
                                            ? ((Number(val) / data.reduce((s, d) => s + d.value, 0)) * 100).toFixed(1)
                                            : 0
                                    }%)`,
                                    name,
                                ]}
                            />
                        )}
                    </PieChart>
                </ResponsiveContainer>
            );
        },
    }))
);

interface DonutSplitProps {
    data: { name: string; value: number }[];
    colors?: string[];
    centerLabel?: string;
    centerSub?: string;
    height?: number;
    className?: string;
}

const DEFAULT_DONUT_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
];

export function DonutSplit({
    data,
    colors = DEFAULT_DONUT_COLORS,
    centerLabel = "",
    centerSub,
    height = 180,
    className,
}: DonutSplitProps) {
    return (
        <div className={cn("relative", className)} style={{ height }}>
            <Suspense fallback={<ChartSkeleton height={height} />}>
                <LazyDonutSplit
                    data={data}
                    colors={colors}
                    centerLabel={centerLabel}
                    centerSub={centerSub}
                    height={height}
                />
            </Suspense>
            {centerLabel && (
                <div
                    className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                    aria-hidden="true"
                >
                    <span
                        className="text-[22px] font-black tabular-nums"
                        style={{ color: "var(--text-primary)" }}
                    >
                        {centerLabel}
                    </span>
                    {centerSub && (
                        <span
                            className="text-[10px] font-semibold mt-0.5"
                            style={{ color: "var(--text-tertiary)" }}
                        >
                            {centerSub}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

// ── StackedAreaChart ──────────────────────────────────────────────────────────
// Multi-series stacked area for revenue breakdown over time.

const LazyStacked = lazy(() =>
    (import("recharts") as any).then((m: any) => ({
        default: function StackedChart({
            data, keys, colors, xKey, height,
        }: {
            data: Record<string, number | string>[];
            keys: string[];
            colors: string[];
            xKey: string;
            height: number;
        }) {
            const { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } = m;
            return (
                <ResponsiveContainer width="100%" height={height}>
                    <AreaChart data={data} margin={{ top: 8, right: 0, left: -20, bottom: 0 }} stackOffset="expand">
                        <CartesianGrid stroke="rgba(128,128,128,0.12)" vertical={false} />
                        <XAxis
                            dataKey={xKey}
                            tick={{ fontSize: 10, fill: "#9B9B9F" }}
                            axisLine={false} tickLine={false}
                        />
                        <YAxis
                            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                            tick={{ fontSize: 10, fill: "#9B9B9F" }}
                            axisLine={false} tickLine={false}
                        />
                        <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            formatter={(val: any, name: any) => [
                                `${(Number(val) * 100).toFixed(1)}%`, name,
                            ]}
                        />
                        {keys.map((key, i) => (
                            <Area
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stackId="1"
                                stroke={colors[i % colors.length]}
                                fill={colors[i % colors.length]}
                                fillOpacity={0.65}
                                strokeWidth={1}
                                isAnimationActive
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            );
        },
    }))
);

interface StackedAreaProps {
    data: Record<string, number | string>[];
    keys: string[];
    colors?: string[];
    xKey?: string;
    height?: number;
    className?: string;
}

export function StackedAreaChart({
    data, keys, colors = DEFAULT_DONUT_COLORS, xKey = "date", height = 180, className,
}: StackedAreaProps) {
    return (
        <div className={cn("w-full", className)}>
            <Suspense fallback={<ChartSkeleton height={height} />}>
                <LazyStacked data={data} keys={keys} colors={colors} xKey={xKey} height={height} />
            </Suspense>
        </div>
    );
}

// ── CohortGrid ────────────────────────────────────────────────────────────────
// Visual cohort retention grid.

interface CohortRow {
    month: string;
    returnRatePct: number;
    totalGuests: number;
}

interface CohortGridProps {
    cohorts: CohortRow[];
    className?: string;
}

export function CohortGrid({ cohorts, className }: CohortGridProps) {
    return (
        <div className={cn("space-y-2", className)}>
            {cohorts.map((cohort) => {
                const pct = Math.min(Math.max(cohort.returnRatePct, 0), 100);
                const color = pct >= 60
                    ? "var(--color-success)"
                    : pct >= 30
                        ? "var(--color-warning)"
                        : "var(--color-error)";

                return (
                    <div key={cohort.month} className="flex items-center gap-3">
                        <span
                            className="w-14 text-[11px] font-semibold shrink-0"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            {cohort.month}
                        </span>
                        <div
                            className="flex-1 rounded-full overflow-hidden"
                            style={{ height: 8, background: "var(--border-subtle)" }}
                        >
                            <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                    width: `${pct === 0 ? 2 : pct}%`,
                                    background: pct === 0 ? "var(--bg-fill)" : color,
                                }}
                            />
                        </div>
                        <span
                            className="w-10 text-right text-[11px] font-bold tabular-nums shrink-0"
                            style={{ color: pct === 0 ? "var(--text-tertiary)" : color }}
                        >
                            {pct === 0 ? "—" : `${pct.toFixed(0)}%`}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

// ── ScoreRing ──────────────────────────────────────────────────────────────────
// Circular score indicator for quality/efficiency scores.

interface ScoreRingProps {
    score: number;   // 0-100
    label?: string;
    size?: number;
    strokeWidth?: number;
    className?: string;
}

export function ScoreRing({ score, label, size = 64, strokeWidth = 5, className }: ScoreRingProps) {
    const radius = (size - strokeWidth * 2) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    const color = score >= 80
        ? "var(--color-success)"
        : score >= 50
            ? "var(--color-warning)"
            : "var(--color-error)";

    return (
        <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none"
                    stroke="var(--border-subtle)"
                    strokeWidth={strokeWidth}
                />
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none"
                    stroke={score === 0 ? "var(--border-subtle)" : color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 0.8s ease" }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                    className="text-[13px] font-black tabular-nums"
                    style={{ color: score === 0 ? "var(--text-tertiary)" : color }}
                >
                    {score === 0 ? "—" : score}
                </span>
                {label && (
                    <span className="text-[8px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                        {label}
                    </span>
                )}
            </div>
        </div>
    );
}
