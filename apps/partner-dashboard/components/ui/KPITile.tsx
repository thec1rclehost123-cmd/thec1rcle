"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import clsx from "clsx";

/**
 * KPI Tile Component — Bloomberg-Style Metric Display
 * 
 * Features:
 * - Large, readable numbers with tabular numeric alignment
 * - Trend indicators with color coding
 * - Optional icon with state-based coloring
 * - Subtle hover effects
 * - Currency formatting support (₹ and $)
 */

export type KPIState = "default" | "success" | "warning" | "error" | "info" | "accent";
export type TrendDirection = "up" | "down" | "neutral";
export type CurrencyType = "INR" | "USD" | "none";

interface KPITileProps {
    label: string;
    value: string | number;
    trend?: {
        value: string;
        direction: TrendDirection;
        isPositive?: boolean; // Override: sometimes down is good
    };
    subtext?: string;
    icon?: ReactNode;
    state?: KPIState;
    currency?: CurrencyType;
    compact?: boolean;
    interactive?: boolean;
    onClick?: () => void;
    className?: string;
}

const stateStyles: Record<KPIState, { icon: string; border: string }> = {
    default: {
        icon: "bg-[var(--surface-tertiary)] text-[var(--text-tertiary)]",
        border: "border-[var(--border-subtle)]"
    },
    success: {
        icon: "bg-[var(--state-success-bg)] text-[var(--state-success)]",
        border: "border-emerald-500/20"
    },
    warning: {
        icon: "bg-[var(--state-warning-bg)] text-[var(--state-warning)]",
        border: "border-amber-500/20"
    },
    error: {
        icon: "bg-[var(--state-error-bg)] text-[var(--state-error)]",
        border: "border-red-500/20"
    },
    info: {
        icon: "bg-[var(--state-info-bg)] text-[var(--state-info)]",
        border: "border-indigo-500/20"
    },
    accent: {
        icon: "bg-[var(--c1rcle-orange-glow)] text-[var(--c1rcle-orange)]",
        border: "border-orange-500/20"
    },
};

export function KPITile({
    label,
    value,
    trend,
    subtext,
    icon,
    state = "default",
    currency = "none",
    compact = false,
    interactive = false,
    onClick,
    className,
}: KPITileProps) {
    const styles = stateStyles[state];

    // Format currency
    const formattedValue = (() => {
        if (currency === "INR") return `₹${value}`;
        if (currency === "USD") return `$${value}`;
        return value;
    })();

    // Determine trend color
    const getTrendColor = () => {
        if (!trend) return "";
        const isPositive = trend.isPositive ?? (trend.direction === "up");
        if (trend.direction === "neutral") return "text-[var(--text-tertiary)] bg-[var(--surface-tertiary)]";
        return isPositive
            ? "text-[var(--trend-up)] bg-[var(--trend-up-bg)]"
            : "text-[var(--trend-down)] bg-[var(--trend-down-bg)]";
    };

    const Wrapper = interactive ? motion.button : motion.div;

    return (
        <Wrapper
            onClick={interactive ? onClick : undefined}
            whileHover={interactive ? { scale: 1.01, y: -2 } : undefined}
            whileTap={interactive ? { scale: 0.99 } : undefined}
            className={clsx(
                "kpi-tile group text-left w-full",
                state !== "default" && styles.border,
                interactive && "cursor-pointer hover:shadow-md",
                compact ? "p-4" : "p-6",
                className
            )}
        >
            {/* Icon */}
            {icon && (
                <div className={clsx(
                    "kpi-icon transition-transform group-hover:scale-105",
                    compact ? "w-10 h-10 mb-3" : "w-12 h-12 mb-4",
                    styles.icon
                )}>
                    {icon}
                </div>
            )}

            {/* Label */}
            <p className={clsx(
                "kpi-label",
                compact ? "text-[11px] mb-2" : "text-[13px] mb-3"
            )}>
                {label}
            </p>

            {/* Value + Trend */}
            <div className="flex items-end gap-3 flex-wrap">
                <h3 className={clsx(
                    "kpi-value font-semibold tracking-tight text-[var(--text-primary)]",
                    compact ? "text-2xl" : "text-[32px]"
                )}>
                    {formattedValue}
                </h3>

                {trend && (
                    <span className={clsx(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold",
                        getTrendColor()
                    )}>
                        {trend.direction === "up" && <ArrowUp className="w-3 h-3" />}
                        {trend.direction === "down" && <ArrowDown className="w-3 h-3" />}
                        {trend.direction === "neutral" && <Minus className="w-3 h-3" />}
                        {trend.value}
                    </span>
                )}
            </div>

            {/* Subtext */}
            {subtext && (
                <p className="text-[12px] text-[var(--text-tertiary)] mt-2">
                    {subtext}
                </p>
            )}
        </Wrapper>
    );
}

/**
 * KPI Grid — Responsive container for multiple KPI tiles
 */
interface KPIGridProps {
    children: ReactNode;
    columns?: 2 | 3 | 4 | 5;
    className?: string;
}

export function KPIGrid({ children, columns = 4, className }: KPIGridProps) {
    const colClasses = {
        2: "grid-cols-1 sm:grid-cols-2",
        3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
    };

    return (
        <div className={clsx("grid gap-4 md:gap-6", colClasses[columns], className)}>
            {children}
        </div>
    );
}

/**
 * Mini Stats Row — Compact inline statistics
 */
interface MiniStatProps {
    label: string;
    value: string | number;
    trend?: TrendDirection;
    trendValue?: string;
}

export function MiniStat({ label, value, trend, trendValue }: MiniStatProps) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)] last:border-b-0">
            <span className="text-[13px] text-[var(--text-secondary)]">{label}</span>
            <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-[var(--text-primary)] tabular-nums">
                    {value}
                </span>
                {trend && trendValue && (
                    <span className={clsx(
                        "text-[11px] font-medium flex items-center gap-0.5",
                        trend === "up" && "text-[var(--trend-up)]",
                        trend === "down" && "text-[var(--trend-down)]",
                        trend === "neutral" && "text-[var(--text-tertiary)]"
                    )}>
                        {trend === "up" && <ArrowUp className="w-3 h-3" />}
                        {trend === "down" && <ArrowDown className="w-3 h-3" />}
                        {trendValue}
                    </span>
                )}
            </div>
        </div>
    );
}

/**
 * Large Hero Stat — For prominent single metrics
 */
interface HeroStatProps {
    label: string;
    value: string | number;
    prefix?: string;
    suffix?: string;
    trend?: {
        value: string;
        direction: TrendDirection;
    };
    description?: string;
    className?: string;
}

export function HeroStat({
    label,
    value,
    prefix,
    suffix,
    trend,
    description,
    className
}: HeroStatProps) {
    return (
        <div className={clsx("text-center py-8", className)}>
            <p className="text-label-sm text-[var(--text-tertiary)] mb-4 uppercase tracking-widest">
                {label}
            </p>
            <div className="flex items-baseline justify-center gap-2">
                {prefix && (
                    <span className="text-stat-lg text-[var(--text-tertiary)]">{prefix}</span>
                )}
                <motion.span
                    className="text-stat-hero text-[var(--text-primary)]"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                >
                    {value}
                </motion.span>
                {suffix && (
                    <span className="text-stat-lg text-[var(--text-tertiary)]">{suffix}</span>
                )}
            </div>
            {trend && (
                <div className="flex justify-center mt-4">
                    <span className={clsx(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold",
                        trend.direction === "up" && "bg-[var(--trend-up-bg)] text-[var(--trend-up)]",
                        trend.direction === "down" && "bg-[var(--trend-down-bg)] text-[var(--trend-down)]",
                        trend.direction === "neutral" && "bg-[var(--surface-tertiary)] text-[var(--text-tertiary)]"
                    )}>
                        {trend.direction === "up" && <ArrowUp className="w-3.5 h-3.5" />}
                        {trend.direction === "down" && <ArrowDown className="w-3.5 h-3.5" />}
                        {trend.value}
                    </span>
                </div>
            )}
            {description && (
                <p className="text-body-sm text-[var(--text-tertiary)] mt-3">
                    {description}
                </p>
            )}
        </div>
    );
}

/**
 * Progress Stat — Metric with progress bar
 */
interface ProgressStatProps {
    label: string;
    value: number;
    max: number;
    displayValue?: string;
    color?: "accent" | "success" | "warning" | "info";
    showPercentage?: boolean;
}

export function ProgressStat({
    label,
    value,
    max,
    displayValue,
    color = "accent",
    showPercentage = true
}: ProgressStatProps) {
    const percentage = Math.min((value / max) * 100, 100);

    const colorClasses = {
        accent: "bg-[var(--c1rcle-orange)]",
        success: "bg-[var(--state-success)]",
        warning: "bg-[var(--state-warning)]",
        info: "bg-[var(--state-info)]",
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-[13px] text-[var(--text-secondary)]">{label}</span>
                <span className="text-[15px] font-semibold text-[var(--text-primary)] tabular-nums">
                    {displayValue || value}
                    {showPercentage && (
                        <span className="text-[11px] text-[var(--text-tertiary)] ml-1">
                            ({percentage.toFixed(0)}%)
                        </span>
                    )}
                </span>
            </div>
            <div className="progress-bar">
                <motion.div
                    className={clsx("progress-bar-fill", colorClasses[color])}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                />
            </div>
        </div>
    );
}

export default KPITile;
