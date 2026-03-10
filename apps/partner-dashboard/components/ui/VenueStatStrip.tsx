"use client";

import { ReactNode } from "react";
import clsx from "clsx";

interface StatItem {
    label: string;
    value: string | number;
    trend?: { value: string; direction: "up" | "down" | "neutral" };
    icon?: ReactNode;
    loading?: boolean;
    liveIndicator?: boolean;
}

interface VenueStatStripProps {
    stats: StatItem[];
    columns?: 2 | 3 | 4;
    className?: string;
}

const colClasses: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
};

export function VenueStatStrip({ stats, columns = 3, className }: VenueStatStripProps) {
    return (
        <div
            className={clsx("grid divide-x divide-[var(--v-border)] rounded-[var(--v-r-xl)] overflow-hidden", colClasses[columns], className)}
            style={{ background: "var(--v-card)" }}
        >
            {stats.map((stat, i) => (
                <StatCell key={i} stat={stat} />
            ))}
        </div>
    );
}

function StatCell({ stat }: { stat: StatItem }) {
    if (stat.loading) {
        return (
            <div className="px-6 py-5 flex flex-col gap-2" aria-busy="true">
                <div className="v-skeleton h-2.5 w-16 rounded" />
                <div className="v-skeleton h-8 w-24 rounded-lg" />
            </div>
        );
    }

    return (
        <div className="px-6 py-5 flex flex-col gap-1">
            {/* Label row */}
            <div className="flex items-center gap-2">
                {stat.icon && (
                    <span style={{ color: "var(--v-text-muted)" }} className="w-3.5 h-3.5 flex-shrink-0">
                        {stat.icon}
                    </span>
                )}
                {stat.liveIndicator && <span className="v-live-dot" aria-label="Live" />}
                <span className="v-label">{stat.label}</span>
            </div>

            {/* Value row */}
            <div className="flex items-baseline gap-2 flex-wrap">
                <span
                    className="text-[28px] font-bold leading-none tabular-nums tracking-tight"
                    style={{ color: "var(--v-text-primary)" }}
                >
                    {stat.value}
                </span>

                {stat.trend && (
                    <span
                        className={clsx(
                            "v-trend-chip text-[11px]",
                            stat.trend.direction === "up" && "v-trend-up",
                            stat.trend.direction === "down" && "v-trend-down",
                            stat.trend.direction === "neutral" && "v-trend-neutral"
                        )}
                    >
                        {stat.trend.direction === "up" && "↑ "}
                        {stat.trend.direction === "down" && "↓ "}
                        {stat.trend.value}
                    </span>
                )}
            </div>
        </div>
    );
}

export default VenueStatStrip;
