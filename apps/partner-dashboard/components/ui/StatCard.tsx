"use client";

import clsx from "clsx";
import { type ReactNode } from "react";

/**
 * StatCard Component — Key Metric Display
 * 
 * Numbers must be strong and readable.
 * State colors indicate health/attention needs.
 */

export type StatState = "default" | "confirmed" | "pending" | "risk";

export interface StatCardProps {
    label: string;
    value: string;
    icon?: ReactNode;
    change?: {
        value: string;
        direction: "up" | "down";
        isPositive?: boolean; // Sometimes down is good (e.g., refund rate)
    };
    subtext?: string;
    state?: StatState;
    className?: string;
}

const stateStyles: Record<StatState, { icon: string; card: string }> = {
    default: {
        icon: "bg-stone-100 text-stone-500",
        card: ""
    },
    confirmed: {
        icon: "bg-emerald-50 text-emerald-600",
        card: ""
    },
    pending: {
        icon: "bg-amber-50 text-amber-600",
        card: ""
    },
    risk: {
        icon: "bg-red-50 text-red-600",
        card: ""
    },
};

export function StatCard({
    label,
    value,
    icon,
    change,
    subtext,
    state = "default",
    className,
}: StatCardProps) {
    const styles = stateStyles[state];

    // Determine change color - usually up is good, down is bad
    const changeIsPositive = change?.isPositive ?? (change?.direction === "up");

    return (
        <div className={clsx(
            "bg-white rounded-xl border border-stone-100 p-5",
            styles.card,
            className
        )}>
            {icon && (
                <div className={clsx(
                    "w-9 h-9 rounded-lg flex items-center justify-center mb-3",
                    styles.icon
                )}>
                    {icon}
                </div>
            )}

            <div className="flex items-baseline gap-2">
                <p className="text-[28px] font-medium text-stone-900 leading-none tracking-tight">
                    {value}
                </p>
                {change && (
                    <span className={clsx(
                        "text-[12px] font-medium flex items-center",
                        changeIsPositive ? "text-emerald-600" : "text-red-600"
                    )}>
                        {change.direction === "up" ? "↑" : "↓"} {change.value}
                    </span>
                )}
            </div>

            <p className="text-[12px] text-stone-500 mt-1">{label}</p>

            {subtext && (
                <p className="text-[11px] text-stone-400 mt-1">{subtext}</p>
            )}
        </div>
    );
}

export default StatCard;
