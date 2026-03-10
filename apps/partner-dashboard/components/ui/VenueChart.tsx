"use client";

import React, { Suspense, lazy, ReactNode } from "react";
import clsx from "clsx";
import { useReducedMotion } from "framer-motion";

// ── Lazy-load recharts to keep it out of non-analytics bundles ──
const RechartsArea = lazy(() =>
    import("recharts").then((m) => ({
        default: function AreaChartWrapper({
            data,
            dataKey,
            xKey,
            color,
            height,
            title,
            gradientId,
        }: {
            data: any[];
            dataKey: string;
            xKey: string;
            color: string;
            height: number;
            title: string;
            gradientId: string;
        }) {
            const { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, defs, linearGradient, stop } = m;
            return (
                <div role="img" aria-label={title}>
                    <ResponsiveContainer width="100%" height={height}>
                        <AreaChart data={data} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey={xKey}
                                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.30)" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.30)" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: "#1a1a1d",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    borderRadius: 12,
                                    fontSize: 12,
                                    color: "rgba(255,255,255,0.9)",
                                }}
                                cursor={{ stroke: "rgba(255,255,255,0.1)" }}
                            />
                            <Area
                                type="monotone"
                                dataKey={dataKey}
                                stroke={color}
                                strokeWidth={2}
                                fill={`url(#${gradientId})`}
                                isAnimationActive={true}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            );
        },
    }))
);

const RechartsBar = lazy(() =>
    import("recharts").then((m) => ({
        default: function BarChartWrapper({
            data,
            dataKey,
            xKey,
            color,
            height,
            title,
        }: {
            data: any[];
            dataKey: string;
            xKey: string;
            color: string;
            height: number;
            title: string;
        }) {
            const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } = m;
            return (
                <div role="img" aria-label={title}>
                    <ResponsiveContainer width="100%" height={height}>
                        <BarChart data={data} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
                            <XAxis
                                dataKey={xKey}
                                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.30)" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.30)" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: "#1a1a1d",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    borderRadius: 12,
                                    fontSize: 12,
                                    color: "rgba(255,255,255,0.9)",
                                }}
                                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                            />
                            <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} isAnimationActive={true}>
                                {data.map((_, index) => (
                                    <Cell key={index} fill={color} opacity={0.85} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );
        },
    }))
);

const RechartsLine = lazy(() =>
    import("recharts").then((m) => ({
        default: function LineChartWrapper({
            data,
            dataKey,
            xKey,
            color,
            height,
            title,
        }: {
            data: any[];
            dataKey: string;
            xKey: string;
            color: string;
            height: number;
            title: string;
        }) {
            const { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } = m;
            return (
                <div role="img" aria-label={title}>
                    <ResponsiveContainer width="100%" height={height}>
                        <LineChart data={data} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
                            <XAxis
                                dataKey={xKey}
                                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.30)" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.30)" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: "#1a1a1d",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    borderRadius: 12,
                                    fontSize: 12,
                                    color: "rgba(255,255,255,0.9)",
                                }}
                                cursor={{ stroke: "rgba(255,255,255,0.1)" }}
                            />
                            <Line
                                type="monotone"
                                dataKey={dataKey}
                                stroke={color}
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={true}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            );
        },
    }))
);

// ── Public VenueChart interface ──

export interface VenueChartConfig {
    dataKey: string;
    xKey: string;
    color?: string;
    gradientId?: string;
}

export interface VenueChartProps {
    type: "area" | "bar" | "line";
    data: any[];
    config: VenueChartConfig;
    height?: number;
    loading?: boolean;
    empty?: boolean;
    title: string;
    className?: string;
}

export function VenueChart({
    type,
    data,
    config,
    height = 240,
    loading = false,
    empty = false,
    title,
    className,
}: VenueChartProps) {
    const shouldReduceMotion = useReducedMotion();
    const color = config.color || "var(--v-chart-1)";
    const gradientId = config.gradientId || `grad-${config.dataKey}`;

    if (loading) {
        return <ChartSkeleton height={height} className={className} />;
    }

    if (empty || !data || data.length === 0) {
        return <ChartEmpty height={height} label={title} className={className} />;
    }

    const chartProps = {
        data,
        dataKey: config.dataKey,
        xKey: config.xKey,
        color,
        height,
        title,
        gradientId,
    };

    return (
        <div className={clsx("w-full", className)}>
            <Suspense fallback={<ChartSkeleton height={height} />}>
                {type === "area" && <RechartsArea {...chartProps} />}
                {type === "bar" && <RechartsBar {...chartProps} />}
                {type === "line" && <RechartsLine {...chartProps} />}
            </Suspense>
        </div>
    );
}

// ── Chart loading skeleton ──
export function ChartSkeleton({ height = 240, className }: { height?: number; className?: string }) {
    return (
        <div
            className={clsx("v-skeleton w-full rounded-2xl", className)}
            style={{ height }}
            aria-label="Loading chart..."
        />
    );
}

// ── Chart empty state ──
function ChartEmpty({ height = 240, label, className }: { height?: number; label: string; className?: string }) {
    return (
        <div
            className={clsx(
                "w-full rounded-2xl flex items-center justify-center",
                className
            )}
            style={{
                height,
                background: "rgba(255,255,255,0.03)",
                border: "1px dashed rgba(255,255,255,0.08)",
            }}
            role="img"
            aria-label={`${label}: No data for this period`}
        >
            <span
                className="text-[11px] font-semibold uppercase tracking-widest"
                style={{ color: "var(--v-text-muted)" }}
            >
                No data for this period
            </span>
        </div>
    );
}

export default VenueChart;
