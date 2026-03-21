"use client";

import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

// ── MiniSparkline ──
interface MiniSparklineProps {
    data?: number[];
    color?: string;
    height?: number;
}

export function MiniSparkline({ data, color = "#7c3aed", height = 32 }: MiniSparklineProps) {
    const bars = data && data.length > 0 ? data : [40, 65, 45, 80, 60, 90, 75];
    const maxVal = Math.max(...bars);
    return (
        <div className="flex items-end gap-0.5" style={{ height }}>
            {bars.map((val, i) => (
                <div
                    key={i}
                    className="flex-1 rounded-t-sm transition-all"
                    style={{
                        height: `${Math.max((val / maxVal) * 100, 8)}%`,
                        background: i === bars.length - 1 ? color : `${color}55`,
                    }}
                />
            ))}
        </div>
    );
}

// ── AreaChartPlaceholder ──
interface AreaChartPlaceholderProps {
    title: string;
    subtitle?: string;
    color?: string;
    height?: number;
}

export function AreaChartPlaceholder({
    title,
    subtitle,
    color = "#7c3aed",
    height = 200,
}: AreaChartPlaceholderProps) {
    const points = [15, 30, 22, 55, 40, 70, 58, 80, 65, 90, 75, 95, 82, 100];
    const svgH = height;
    const svgW = 400;
    const padX = 8;
    const padY = 12;
    const usableH = svgH - padY * 2;
    const usableW = svgW - padX * 2;
    const maxP = Math.max(...points);

    const coords = points.map((p, i) => [
        padX + (i / (points.length - 1)) * usableW,
        padY + usableH - (p / maxP) * usableH,
    ]);

    // Build smooth SVG path
    const path = coords.reduce((acc, [x, y], i) => {
        if (i === 0) return `M${x},${y}`;
        const [px, py] = coords[i - 1];
        const cpx = (px + x) / 2;
        return `${acc} C${cpx},${py} ${cpx},${y} ${x},${y}`;
    }, "");

    const areaPath = `${path} L${coords[coords.length - 1][0]},${svgH - padY} L${coords[0][0]},${svgH - padY} Z`;

    const gradId = `area-grad-${title.replace(/\s/g, "")}`;
    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return (
        <div className="rounded-[32px] bg-surface-elevated border border-border-default p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">{title}</p>
                    {subtitle && (
                        <p className="text-[13px] font-medium text-text-secondary mt-0.5">{subtitle}</p>
                    )}
                </div>
                <span className="text-[10px] font-bold text-text-placeholder uppercase tracking-widest">Last 30 days</span>
            </div>
            <div className="w-full overflow-hidden" style={{ height }}>
                <svg
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    preserveAspectRatio="none"
                    className="w-full h-full"
                >
                    <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                        </linearGradient>
                    </defs>
                    {/* Grid lines */}
                    {[0.25, 0.5, 0.75].map((f, i) => (
                        <line
                            key={i}
                            x1={padX}
                            y1={padY + f * usableH}
                            x2={svgW - padX}
                            y2={padY + f * usableH}
                            stroke="rgba(255,255,255,0.04)"
                            strokeWidth="1"
                        />
                    ))}
                    {/* Area fill */}
                    <path d={areaPath} fill={`url(#${gradId})`} />
                    {/* Line */}
                    <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Last dot */}
                    <circle
                        cx={coords[coords.length - 1][0]}
                        cy={coords[coords.length - 1][1]}
                        r="4"
                        fill={color}
                    />
                </svg>
            </div>
            {/* X-axis labels */}
            <div className="flex justify-between px-1">
                {dayLabels.map((d) => (
                    <span key={d} className="text-[9px] font-bold uppercase tracking-widest text-text-placeholder">{d}</span>
                ))}
            </div>
        </div>
    );
}

// ── BarChartPlaceholder ──
interface BarChartPlaceholderProps {
    title: string;
    subtitle?: string;
    color?: string;
    bars?: { label: string; value: number }[];
}

const DEFAULT_BARS = [
    { label: "Event A", value: 82 },
    { label: "Event B", value: 65 },
    { label: "Event C", value: 91 },
    { label: "Event D", value: 47 },
    { label: "Event E", value: 73 },
    { label: "Event F", value: 58 },
];

export function BarChartPlaceholder({
    title,
    subtitle,
    color = "#7c3aed",
    bars = DEFAULT_BARS,
}: BarChartPlaceholderProps) {
    const maxVal = Math.max(...bars.map((b) => b.value));
    return (
        <div className="rounded-[32px] bg-surface-elevated border border-border-default p-6 flex flex-col gap-4">
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">{title}</p>
                {subtitle && (
                    <p className="text-[13px] font-medium text-text-secondary mt-0.5">{subtitle}</p>
                )}
            </div>
            <div className="flex items-end gap-2 h-36">
                {bars.map((bar, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <motion.div
                            className="w-full rounded-t-lg"
                            style={{ background: i === 0 ? color : `${color}88`, minHeight: 4 }}
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max((bar.value / maxVal) * 128, 4)}px` }}
                            transition={{ duration: 0.5, delay: i * 0.06, ease: "easeOut" }}
                        />
                        <span className="text-[8px] font-bold uppercase tracking-widest text-text-placeholder truncate w-full text-center">
                            {bar.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── DonutChartPlaceholder ──
interface DonutSegment {
    label: string;
    value: number;
    color: string;
}

interface DonutChartPlaceholderProps {
    title: string;
    segments?: DonutSegment[];
}

const DEFAULT_SEGMENTS: DonutSegment[] = [
    { label: "WhatsApp", value: 42, color: "#22c55e" },
    { label: "Instagram", value: 28, color: "#ec4899" },
    { label: "Direct", value: 18, color: "#818cf8" },
    { label: "Other", value: 12, color: "#f59e0b" },
];

export function DonutChartPlaceholder({ title, segments = DEFAULT_SEGMENTS }: DonutChartPlaceholderProps) {
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    const r = 38;
    const cx = 56;
    const cy = 56;
    const circumference = 2 * Math.PI * r;

    let cumulative = 0;
    const arcs = segments.map((seg) => {
        const fraction = seg.value / total;
        const strokeDasharray = `${fraction * circumference} ${circumference}`;
        const strokeDashoffset = -cumulative * circumference;
        cumulative += fraction;
        return { ...seg, strokeDasharray, strokeDashoffset };
    });

    return (
        <div className="rounded-[32px] bg-surface-elevated border border-border-default p-6 flex flex-col gap-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">{title}</p>
            <div className="flex items-center gap-6">
                <svg viewBox="0 0 112 112" className="w-28 h-28 shrink-0 -rotate-90">
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="14" />
                    {arcs.map((arc, i) => (
                        <circle
                            key={i}
                            cx={cx}
                            cy={cy}
                            r={r}
                            fill="none"
                            stroke={arc.color}
                            strokeWidth="14"
                            strokeDasharray={arc.strokeDasharray}
                            strokeDashoffset={arc.strokeDashoffset}
                            strokeLinecap="butt"
                        />
                    ))}
                </svg>
                <div className="flex flex-col gap-2 flex-1">
                    {segments.map((seg, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
                                <span className="text-[11px] font-semibold text-text-secondary">{seg.label}</span>
                            </div>
                            <span className="text-[11px] font-black text-text-primary tabular-nums">
                                {Math.round((seg.value / total) * 100)}%
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── StatTrendCard ──
interface StatTrendCardProps {
    label: string;
    value: string | number;
    trend?: string;
    trendUp?: boolean;
    sparkData?: number[];
    color?: string;
    icon?: React.ReactNode;
}

export function StatTrendCard({
    label,
    value,
    trend,
    trendUp,
    sparkData,
    color = "#7c3aed",
    icon,
}: StatTrendCardProps) {
    return (
        <div
            className="rounded-[32px] bg-surface-elevated border border-border-default p-5 flex flex-col gap-3 relative overflow-hidden"
            style={trendUp ? { borderColor: `${color}44` } : undefined}
        >
            {trendUp && (
                <div
                    className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl pointer-events-none"
                    style={{ background: `${color}10` }}
                />
            )}
            <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2">
                    {icon && (
                        <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: `${color}18`, color }}
                        >
                            {icon}
                        </div>
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">{label}</span>
                </div>
                {trend && (
                    <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{
                            background: trendUp ? "rgba(52,211,153,0.12)" : "rgba(239,68,68,0.1)",
                            color: trendUp ? "#34d399" : "#f87171",
                        }}
                    >
                        {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {trend}
                    </span>
                )}
            </div>
            <p
                className="text-[28px] font-black tracking-tighter leading-none tabular-nums relative z-10"
                style={{ color: "var(--v-text-primary, #fff)" }}
            >
                {value}
            </p>
            {sparkData && (
                <div className="relative z-10">
                    <MiniSparkline data={sparkData} color={color} height={28} />
                </div>
            )}
        </div>
    );
}

// ── LeaderboardPlaceholder ──
interface LeaderboardItem {
    rank: number;
    label: string;
    value: string;
    badge?: string;
}

interface LeaderboardPlaceholderProps {
    title: string;
    items?: LeaderboardItem[];
}

const DEFAULT_LEADERBOARD: LeaderboardItem[] = [
    { rank: 1, label: "Summer Rave — Kitty Su", value: "₹18,400", badge: "Top Earner" },
    { rank: 2, label: "Sunburn Warm-up — VH", value: "₹12,200" },
    { rank: 3, label: "BLNK x MH01 — Auro", value: "₹9,800" },
    { rank: 4, label: "Lockdown Weekender", value: "₹6,150" },
    { rank: 5, label: "Closer Sessions", value: "₹4,300" },
];

const RANK_STYLES: Record<number, { bg: string; text: string }> = {
    1: { bg: "rgba(251,191,36,0.15)", text: "#fbbf24" },
    2: { bg: "rgba(148,163,184,0.12)", text: "#94a3b8" },
    3: { bg: "rgba(180,120,60,0.12)", text: "#b4783c" },
};

export function LeaderboardPlaceholder({ title, items = DEFAULT_LEADERBOARD }: LeaderboardPlaceholderProps) {
    return (
        <div className="rounded-[32px] bg-surface-elevated border border-border-default p-6 flex flex-col gap-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">{title}</p>
            <div className="flex flex-col gap-2">
                {items.map((item) => {
                    const style = RANK_STYLES[item.rank];
                    return (
                        <div
                            key={item.rank}
                            className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                            style={{ background: style ? style.bg : "rgba(255,255,255,0.03)" }}
                        >
                            <span
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0"
                                style={style ? { background: style.bg, color: style.text } : { background: "rgba(255,255,255,0.06)", color: "var(--v-text-muted)" }}
                            >
                                {item.rank}
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold text-text-primary truncate">{item.label}</p>
                                {item.badge && (
                                    <span className="text-[9px] font-black uppercase tracking-widest text-text-placeholder">{item.badge}</span>
                                )}
                            </div>
                            <span className="text-[13px] font-black tabular-nums" style={{ color: style ? style.text : "var(--v-text-primary)" }}>
                                {item.value}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── FunnelPlaceholder ──
interface FunnelStep {
    label: string;
    value: number;
    color: string;
}

interface FunnelPlaceholderProps {
    title: string;
    steps?: FunnelStep[];
}

const DEFAULT_FUNNEL_STEPS: FunnelStep[] = [
    { label: "Link Clicks", value: 1200, color: "#818cf8" },
    { label: "Page Views", value: 840, color: "#7c3aed" },
    { label: "Ticket Bought", value: 320, color: "#22c55e" },
    { label: "Checked In", value: 218, color: "#34d399" },
];

export function FunnelPlaceholder({ title, steps = DEFAULT_FUNNEL_STEPS }: FunnelPlaceholderProps) {
    const maxVal = steps[0]?.value || 1;
    return (
        <div className="rounded-[32px] bg-surface-elevated border border-border-default p-6 flex flex-col gap-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">{title}</p>
            <div className="flex flex-col gap-3">
                {steps.map((step, i) => {
                    const pct = Math.round((step.value / maxVal) * 100);
                    const convPct = i > 0 ? Math.round((step.value / steps[i - 1].value) * 100) : 100;
                    return (
                        <div key={i} className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-text-secondary">{step.label}</span>
                                <div className="flex items-center gap-2">
                                    {i > 0 && (
                                        <span className="text-[10px] font-bold text-text-placeholder">{convPct}% conv.</span>
                                    )}
                                    <span className="text-[12px] font-black tabular-nums text-text-primary">
                                        {step.value.toLocaleString("en-IN")}
                                    </span>
                                </div>
                            </div>
                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full rounded-full"
                                    style={{ background: step.color }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
