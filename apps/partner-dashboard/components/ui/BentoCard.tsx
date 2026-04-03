"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, RefreshCw } from "lucide-react";

export interface BentoCardProps {
    // Layout
    colSpan?: 1 | 2 | 3 | 4;
    rowSpan?: 1 | 2;
    padding?: "sm" | "md" | "lg";
    minHeight?: string;

    // Appearance
    variant?: "default" | "dark" | "accent" | "ghost";

    // Interactivity
    interactive?: boolean;
    onClick?: () => void;
    href?: string;

    // Slots
    header?: ReactNode;
    footer?: ReactNode;
    children: ReactNode;

    // States
    loading?: boolean;
    empty?: boolean;
    emptyIcon?: ReactNode;
    emptyTitle?: string;
    emptyAction?: ReactNode;
    error?: boolean;
    onRetry?: () => void;

    className?: string;
    style?: React.CSSProperties;
}

const paddingClasses = {
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
};

const variantStyles: Record<string, React.CSSProperties> = {
    default: { background: "var(--v-panel-bg)" },
    dark:    { background: "var(--v-panel-hero)" },
    accent:  { background: "var(--v-card)", border: "1px solid var(--v-orange)", boxShadow: "0 0 20px var(--v-orange-glow)" },
    ghost:   { background: "transparent", border: "1px solid var(--v-border)" },
};

export function BentoCard({
    colSpan,
    rowSpan,
    padding = "md",
    minHeight,
    variant = "default",
    interactive = false,
    onClick,
    href,
    header,
    footer,
    children,
    loading = false,
    empty = false,
    emptyIcon,
    emptyTitle = "No data",
    emptyAction,
    error = false,
    onRetry,
    className,
    style,
}: BentoCardProps) {
    const shouldReduceMotion = useReducedMotion();

    const colSpanClass = colSpan ? `col-span-${colSpan}` : undefined;
    const rowSpanClass = rowSpan ? `row-span-${rowSpan}` : undefined;

    const containerStyle: React.CSSProperties = {
        ...variantStyles[variant],
        borderRadius: "var(--v-r-xl)",
        boxShadow: variant === "accent" ? variantStyles.accent.boxShadow : "var(--v-panel-shadow-card)",
        minHeight,
        ...style,
    };

    const interactiveProps = interactive && !href
        ? {
            "data-interactive": "true",
            onClick,
            role: "button",
            tabIndex: 0,
            onKeyDown: (e: React.KeyboardEvent) => e.key === "Enter" && onClick?.(),
          }
        : {};

    const inner = (
        <div
            className={cn(
                "v-bento flex flex-col overflow-hidden",
                paddingClasses[padding],
                colSpanClass,
                rowSpanClass,
                interactive && !href && "cursor-pointer",
                className
            )}
            style={containerStyle}
            aria-busy={loading}
            {...interactiveProps}
        >
            {/* Header slot */}
            {header && (
                <div className="flex items-center justify-between mb-3 shrink-0">
                    {header}
                </div>
            )}

            {/* Content area */}
            <div className="flex-1 min-h-0">
                {loading ? (
                    <BentoSkeleton />
                ) : error ? (
                    <BentoError onRetry={onRetry} />
                ) : empty ? (
                    <BentoEmpty icon={emptyIcon} title={emptyTitle} action={emptyAction} />
                ) : (
                    children
                )}
            </div>

            {/* Footer slot */}
            {footer && !loading && !error && !empty && (
                <div className="mt-3 pt-3 border-t border-[var(--v-border)] shrink-0">
                    {footer}
                </div>
            )}
        </div>
    );

    if (href) {
        return (
            <Link
                href={href}
                className={cn(
                    "v-bento flex flex-col overflow-hidden block no-underline",
                    paddingClasses[padding],
                    colSpanClass,
                    rowSpanClass,
                    "cursor-pointer",
                    className
                )}
                style={{ ...containerStyle, display: "flex" }}
                data-interactive="true"
            >
                {header && (
                    <div className="flex items-center justify-between mb-3 shrink-0">
                        {header}
                    </div>
                )}
                <div className="flex-1 min-h-0">{children}</div>
                {footer && (
                    <div className="mt-3 pt-3 border-t border-[var(--v-border)] shrink-0">
                        {footer}
                    </div>
                )}
            </Link>
        );
    }

    return inner;
}

// ── Loading Skeleton ──
function BentoSkeleton() {
    return (
        <div className="space-y-3 animate-pulse" aria-label="Loading...">
            <div className="v-skeleton h-4 w-24 rounded-md" />
            <div className="v-skeleton h-10 w-40 rounded-lg" />
            <div className="v-skeleton h-3 w-32 rounded-md" />
        </div>
    );
}

// ── Empty State ──
function BentoEmpty({
    icon,
    title,
    action,
}: {
    icon?: ReactNode;
    title: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
            {icon && (
                <div style={{ color: "var(--v-text-muted)" }} className="w-10 h-10">
                    {icon}
                </div>
            )}
            <p
                className="text-[13px] font-medium"
                style={{ color: "var(--v-text-tertiary)" }}
            >
                {title}
            </p>
            {action}
        </div>
    );
}

// ── Error State ──
function BentoError({ onRetry }: { onRetry?: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
            <AlertCircle
                className="w-8 h-8"
                style={{ color: "var(--v-error)" }}
            />
            <p
                className="text-[13px] font-medium"
                style={{ color: "var(--v-text-secondary)" }}
            >
                Something went wrong
            </p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    style={{
                        color: "var(--v-text-secondary)",
                        background: "var(--v-elevated)",
                    }}
                >
                    <RefreshCw className="w-3 h-3" />
                    Try again
                </button>
            )}
        </div>
    );
}

// ── KPI Bento Card variant ──
// Convenience wrapper for the common icon + label + value + trend pattern

interface KPIBentoProps {
    label: string;
    value: string | number;
    trend?: { value: string; direction: "up" | "down" | "neutral" };
    subtext?: string;
    icon?: ReactNode;
    iconBg?: string;
    loading?: boolean;
    className?: string;
}

export function KPIBento({
    label,
    value,
    trend,
    subtext,
    icon,
    iconBg,
    loading = false,
    className,
}: KPIBentoProps) {
    return (
        <BentoCard loading={loading} className={className}>
            {icon && (
                <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
                    style={{ background: iconBg || "var(--v-elevated)" }}
                >
                    <div style={{ color: "var(--v-text-secondary)" }}>{icon}</div>
                </div>
            )}

            <p className="v-label mb-1">{label}</p>

            <div className="flex items-end gap-2 flex-wrap">
                <span
                    className="text-[26px] font-bold leading-none tracking-tight tabular-nums"
                    style={{ color: "var(--v-text-primary)" }}
                >
                    {value}
                </span>

                {trend && (
                    <span
                        className={cn(
                            "v-trend-chip mb-1",
                            trend.direction === "up" && "v-trend-up",
                            trend.direction === "down" && "v-trend-down",
                            trend.direction === "neutral" && "v-trend-neutral"
                        )}
                    >
                        {trend.direction === "up" && "↑"}
                        {trend.direction === "down" && "↓"}
                        {trend.value}
                    </span>
                )}
            </div>

            {subtext && (
                <p className="text-[12px] mt-1.5" style={{ color: "var(--v-text-tertiary)" }}>
                    {subtext}
                </p>
            )}
        </BentoCard>
    );
}

export default BentoCard;
