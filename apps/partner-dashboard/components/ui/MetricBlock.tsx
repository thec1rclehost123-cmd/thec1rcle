"use client";

import React, { type ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * MetricBlock — Single source of truth for all KPI/metric displays.
 *
 * Replaces: StatCard, KPITile, KPIBento, AppleHeroStat, VenueStatStrip
 *
 * Size controls visual weight:
 * - "primary"   → 36px value — hero metric, 1-3 per page max
 * - "secondary" → 28px value — supporting primary metrics
 * - "tertiary"  → 18px value — ambient / compact data strips
 *
 * All values use tabular-nums. Trend arrows use semantic green/red, never orange.
 */

export type MetricSize = "primary" | "secondary" | "tertiary";
export type TrendDirection = "up" | "down" | "neutral";

export interface MetricTrend {
  direction: TrendDirection;
  value: string;         // e.g. "+12%"
  period?: string;       // e.g. "vs last period"
}

export interface MetricBlockProps {
  label: string;
  value: ReactNode;
  trend?: MetricTrend;
  subtext?: ReactNode;
  size?: MetricSize;
  icon?: React.ElementType;
  className?: string;
}

const valueSizes: Record<MetricSize, string> = {
  primary:   "text-[36px] font-[600] tracking-[-0.02em]",
  secondary: "text-[28px] font-[600] tracking-[-0.015em]",
  tertiary:  "text-[18px] font-[600] tracking-[-0.01em]",
};

const labelSizes: Record<MetricSize, string> = {
  primary:   "text-[13px] font-[500] mb-1",
  secondary: "text-[12px] font-[500] mb-1",
  tertiary:  "text-[11px] font-[500] mb-0.5",
};

export function MetricBlock({
  label,
  value,
  trend,
  subtext,
  size = "secondary",
  icon: Icon,
  className,
}: MetricBlockProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className={cn(labelSizes[size], "text-[var(--text-tertiary)] uppercase tracking-[0.04em]")}>
        {label}
      </div>

      <div className={cn(
        valueSizes[size],
        "text-[var(--text-primary)] font-variant-numeric leading-none tabular-nums"
      )}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>

      {trend && (
        <div className="flex items-center gap-1 mt-1">
          <TrendIcon direction={trend.direction} size={size} />
          <span className={cn(
            "text-[12px] font-[500]",
            trend.direction === "up"   && "text-[var(--color-success)]",
            trend.direction === "down" && "text-[var(--color-error)]",
            trend.direction === "neutral" && "text-[var(--text-tertiary)]"
          )}>
            {trend.value}
          </span>
          {trend.period && (
            <span className="text-[11px] text-[var(--text-tertiary)]">{trend.period}</span>
          )}
        </div>
      )}

      {subtext && (
        <div className="text-[12px] text-[var(--text-tertiary)] mt-0.5">
          {subtext}
        </div>
      )}
    </div>
  );
}

function TrendIcon({ direction, size }: { direction: TrendDirection; size: MetricSize }) {
  const iconSize = size === "tertiary" ? 10 : 12;
  if (direction === "up")      return <TrendingUp  size={iconSize} className="text-[var(--color-success)]" />;
  if (direction === "down")    return <TrendingDown size={iconSize} className="text-[var(--color-error)]" />;
  return <Minus size={iconSize} className="text-[var(--text-tertiary)]" />;
}

/**
 * MetricStrip — Horizontal row of MetricBlocks with dividers.
 * Used for the compact secondary KPI strips.
 */
interface MetricStripProps {
  metrics: MetricBlockProps[];
  size?: MetricSize;
  className?: string;
}

export function MetricStrip({ metrics, size = "tertiary", className }: MetricStripProps) {
  return (
    <div className={cn(
      "flex items-stretch divide-x divide-[var(--border-subtle)]",
      className
    )}>
      {metrics.map((m, i) => (
        <div key={i} className={cn("flex-1 px-5 first:pl-0", i === 0 ? "" : "")}>
          <MetricBlock {...m} size={size} />
        </div>
      ))}
    </div>
  );
}

export default MetricBlock;
