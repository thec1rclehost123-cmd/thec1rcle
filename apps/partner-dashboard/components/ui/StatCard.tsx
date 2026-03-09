"use client";

import clsx from "clsx";
import { type ReactNode } from "react";

/**
 * StatCard Component — Key Metric Display
 * 
 * Uses CSS variables for dark mode support
 * Numbers are strong and readable with trend indicators
 */

export type StatState = "default" | "success" | "warning" | "error" | "info" | "accent";

export interface StatCardProps {
    label: string;
    value: string;
    icon?: ReactNode;
    change?: {
        value: string;
        direction: "up" | "down" | "neutral";
        isPositive?: boolean; // Override: Sometimes down is good (e.g., refund rate)
    };
    subtext?: string;
    state?: StatState;
    compact?: boolean;
    className?: string;
}

const stateStyles: Record<StatState, { icon: string; card: string }> = {
    default: {
        icon: "bg-surface-tertiary text-text-tertiary",
        card: ""
    },
    success: {
        icon: "bg-green-500/10 text-accent-primary",
        card: "border-[var(--state-success)]/10"
    },
    warning: {
        icon: "bg-yellow-500/10 text-yellow-500",
        card: "border-[var(--state-warning)]/10"
    },
    error: {
        icon: "bg-red-500/10 text-red-500",
        card: "border-[var(--state-error)]/10"
    },
    info: {
        icon: "bg-blue-500/10 text-blue-500",
        card: "border-[var(--state-info)]/10"
    },
    accent: {
        icon: "bg-accent-glow text-accent-primary",
        card: "border-accent-primary/10"
    },
};

export function StatCard({
    label,
    value,
    icon,
    change,
    subtext,
    state = "default",
    compact = false,
    className,
}: StatCardProps) {
    const styles = stateStyles[state];

    // Determine change color - usually up is good, down is bad
    const changeIsPositive = change?.isPositive ?? (change?.direction === "up");

    return (
        <div className={clsx(
            "bg-surface-elevated rounded-2xl border border-border-subtle transition-all hover:border-border-default hover:shadow-md",
            compact ? "p-4" : "p-6",
            styles.card,
            className
        )}>
            {icon && (
                <div className={clsx(
                    "rounded-xl flex items-center justify-center mb-4",
                    compact ? "w-10 h-10" : "w-12 h-12",
                    styles.icon
                )}>
                    {icon}
                </div>
            )}

            <p className="text-label text-text-tertiary mb-2">{label}</p>

            <div className="flex items-baseline gap-3 flex-wrap">
                <p className={clsx(
                    "font-semibold text-text-primary leading-none tracking-tight",
                    compact ? "text-[24px]" : "text-[32px]"
                )}>
                    {value}
                </p>
                {change && (
                    <span className={clsx(
                        "text-[11px] font-semibold flex items-center gap-1 px-2 py-1 rounded-full",
                        change.direction === "neutral"
                            ? "bg-surface-tertiary text-text-tertiary"
                            : changeIsPositive
                                ? "bg-[var(--trend-up-bg)] text-[var(--trend-up)]"
                                : "bg-[var(--trend-down-bg)] text-[var(--trend-down)]"
                    )}>
                        {change.direction === "up" && "↑"}
                        {change.direction === "down" && "↓"}
                        {change.value}
                    </span>
                )}
            </div>

            {subtext && (
                <p className="text-[12px] text-text-placeholder mt-2">{subtext}</p>
            )}
        </div>
    );
}

export default StatCard;
