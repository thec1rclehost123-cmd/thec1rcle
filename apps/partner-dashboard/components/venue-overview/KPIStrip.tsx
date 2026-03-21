"use client";

import { memo } from "react";
import {
    TrendingUp,
    TrendingDown,
    Minus,
    Calendar,
    Zap,
    Users,
    Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINRCompact, formatNumberCompact } from "@/lib/utils/format";
import { PermissionGate } from "@/components/shared/PermissionGate";
import type { VenueOverviewSummary } from "@/lib/types/venueOverview";

// ── Trend chip ────────────────────────────────────────────────────────────────

function TrendChip({
    trend,
    direction,
}: {
    trend: string;
    direction: "up" | "down" | "neutral";
}) {
    const Icon =
        direction === "up"
            ? TrendingUp
            : direction === "down"
              ? TrendingDown
              : Minus;

    return (
        <span
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{
                color:
                    direction === "up"
                        ? "var(--v-success)"
                        : direction === "down"
                          ? "var(--v-error)"
                          : "var(--v-text-muted)",
                background:
                    direction === "up"
                        ? "var(--v-success-bg)"
                        : direction === "down"
                          ? "var(--v-error-bg)"
                          : "rgba(255,255,255,0.06)",
            }}
        >
            <Icon className="w-2.5 h-2.5" />
            {trend}
        </span>
    );
}

// ── Single KPI card ───────────────────────────────────────────────────────────

interface KPICardProps {
    label: string;
    value: string | number;
    subtext?: string;
    trend?: string | null;
    trendDirection?: "up" | "down" | "neutral";
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    loading: boolean;
    /** Dim card while filter is updating but data is still visible */
    dimmed?: boolean;
}

function KPICard({
    label,
    value,
    subtext,
    trend,
    trendDirection,
    icon: Icon,
    loading,
    dimmed,
}: KPICardProps) {
    return (
        <div
            className={cn(
                "v-hero-card p-4 flex flex-col gap-2.5 min-h-[96px] transition-opacity duration-300",
                dimmed && "opacity-60",
            )}
        >
            <div className="flex items-center justify-between">
                <span className="v-label uppercase tracking-widest text-[9px]">
                    {label}
                </span>
                <Icon
                    className="w-4 h-4"
                    style={{ color: "var(--v-text-muted)" }}
                />
            </div>

            {loading ? (
                <div className="v-skeleton h-7 w-24 rounded-lg" />
            ) : (
                <div className="flex flex-col gap-1">
                    <span
                        className="text-[22px] font-black tracking-tighter tabular-nums leading-none"
                        style={{ color: "var(--v-text-primary)" }}
                    >
                        {value}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap min-h-[16px]">
                        {trend && trendDirection && (
                            <TrendChip trend={trend} direction={trendDirection} />
                        )}
                        {subtext && (
                            <span
                                className="text-[11px]"
                                style={{ color: "var(--v-text-tertiary)" }}
                            >
                                {subtext}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── KPIStrip ──────────────────────────────────────────────────────────────────

interface KPIStripProps {
    data: VenueOverviewSummary | null | undefined;
    loading: boolean;
    /** True when a filter change is in flight — shows stale data dimmed */
    filterUpdating?: boolean;
}

/**
 * KPIStrip
 *
 * 4-up metric strip. Revenue card is gated by VIEW_FINANCIALS — staff/security
 * see a redacted placeholder instead of real numbers.
 *
 * Memoized so re-renders from parent state changes (e.g. range selector) only
 * trigger a re-render here when `data` actually changes.
 */
export const KPIStrip = memo(function KPIStrip({
    data,
    loading,
    filterUpdating,
}: KPIStripProps) {
    const dimmed = filterUpdating && !loading;

    return (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {/* Revenue — VIEW_FINANCIALS gated */}
            <PermissionGate
                require="VIEW_FINANCIALS"
                fallback={
                    <KPICard
                        label="Weekend Revenue"
                        value="₹ —"
                        subtext="Restricted"
                        icon={Banknote}
                        loading={false}
                    />
                }
            >
                <KPICard
                    label="Weekend Revenue"
                    value={formatINRCompact(data?.weekendRevenue ?? 0)}
                    trend={data?.revenueTrend ?? undefined}
                    trendDirection={data?.revenueTrendDirection ?? "neutral"}
                    subtext="vs last week"
                    icon={TrendingUp}
                    loading={loading}
                    dimmed={dimmed}
                />
            </PermissionGate>

            {/* Upcoming events — all roles */}
            <KPICard
                label="Upcoming Events"
                value={data?.activeEventsCount ?? "—"}
                subtext="Next 7 days"
                icon={Calendar}
                loading={loading}
                dimmed={dimmed}
            />

            {/* Entry rate — all roles (operational data) */}
            <KPICard
                label="Entry Rate"
                value={data?.avgEntryVelocity ?? "—"}
                subtext="Last session peak"
                icon={Zap}
                loading={loading}
                dimmed={dimmed}
            />

            {/* Guest profiles — all roles */}
            <KPICard
                label="Guest Profiles"
                value={formatNumberCompact(data?.totalGuestProfiles ?? 0)}
                trend={
                    data?.newGuestsThisWeek
                        ? `+${data.newGuestsThisWeek} this week`
                        : undefined
                }
                trendDirection={data?.newGuestsThisWeek ? "up" : undefined}
                icon={Users}
                loading={loading}
                dimmed={dimmed}
            />
        </div>
    );
});
