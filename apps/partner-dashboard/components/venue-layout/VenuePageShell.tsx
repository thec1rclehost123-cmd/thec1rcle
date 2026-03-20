"use client";

import React, { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface VenuePageShellProps {
    title: string;
    subtitle?: ReactNode;
    actions?: ReactNode;
    /** @deprecated Use `toolbar` instead for composed PageToolbar */
    filterBar?: ReactNode;
    /** Composed PageToolbar component — replaces filterBar */
    toolbar?: ReactNode;
    children: ReactNode;
    maxWidth?: "sm" | "md" | "full";
    noPadding?: boolean;
}

const maxWidthClasses = {
    sm: "max-w-[1024px]",
    md: "max-w-[1280px]",
    full: "max-w-[1440px]",
};

export function VenuePageShell({
    title,
    subtitle,
    actions,
    filterBar,
    toolbar,
    children,
    maxWidth = "full",
    noPadding = false,
}: VenuePageShellProps) {
    const hasControlBar = !!(toolbar ?? filterBar);

    return (
        <div className={cn("mx-auto w-full pb-20", maxWidthClasses[maxWidth])}>
            {/* Page Header */}
            {title && (
                <div className="flex items-center justify-between gap-4 pt-7 mb-5">
                    <div className="min-w-0">
                        <h1 className="text-[28px] font-[700] tracking-[-0.02em] text-[var(--text-primary)] leading-tight">
                            {title}
                        </h1>
                        {subtitle && (
                            <div className="text-[14px] text-[var(--text-tertiary)] mt-1">
                                {subtitle}
                            </div>
                        )}
                    </div>
                    {actions && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {actions}
                        </div>
                    )}
                </div>
            )}

            {/* Toolbar (composed PageToolbar or legacy filterBar) */}
            {hasControlBar && (
                toolbar ? toolbar : (
                    <div
                        className="sticky top-14 z-20 mb-5 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10 py-3"
                        style={{
                            background: "var(--bg-base)",
                            backdropFilter: "blur(16px)",
                            WebkitBackdropFilter: "blur(16px)",
                            borderBottom: "1px solid var(--border-subtle)",
                        }}
                    >
                        {filterBar}
                    </div>
                )
            )}

            {/* Content */}
            <div className={noPadding ? "" : "space-y-5"}>
                {children}
            </div>
        </div>
    );
}

// ── Shared action button for VenuePageShell actions slot ──

export function VenueActionButton({
    children,
    onClick,
    icon: Icon,
    variant = "primary",
    disabled = false,
    className,
}: {
    children: React.ReactNode;
    onClick?: () => void;
    icon?: React.ElementType;
    variant?: "primary" | "secondary" | "ghost" | "destructive";
    disabled?: boolean;
    className?: string;
}) {
    const base =
        "inline-flex items-center gap-2 px-4 py-2 rounded-[var(--r-md)] dash-body-sm font-semibold transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
        primary:
            "bg-[var(--accent)] text-white hover:opacity-90",
        secondary:
            "bg-[var(--bg-fill)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--bg-fill-secondary)]",
        ghost:
            "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-fill)]",
        destructive:
            "bg-[var(--color-error-bg)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)]",
    };

    return (
        <button onClick={onClick} disabled={disabled} className={cn(base, variants[variant], className)}>
            {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
            {children}
        </button>
    );
}

// ── VenueFilterTabs — legacy pill tabs, kept for backward compat ──
// New code should use DashTabs from @/components/ui/DashTabs instead

interface VenueFilterTabsProps {
    tabs: Array<{ label: string; value: string; count?: number }>;
    active: string;
    onChange: (value: string) => void;
    variant?: "default" | "analytics" | "finance" | "door" | "partners";
    trailing?: React.ReactNode;
}

export function VenueFilterTabs({ tabs, active, onChange, trailing }: VenueFilterTabsProps) {
    return (
        <div className="flex items-center gap-2">
            <div className="flex border-b border-[var(--border-subtle)] w-fit">
                {tabs.map((tab) => {
                    const isActive = tab.value === active;
                    return (
                        <button
                            key={tab.value}
                            onClick={() => onChange(tab.value)}
                            className={cn(
                                "px-4 pb-3 pt-1 dash-body-sm font-semibold transition-colors duration-[var(--t-fast)]",
                                isActive
                                    ? "text-[var(--accent)] border-b-2 border-[var(--accent)] -mb-px"
                                    : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                            )}
                        >
                            {tab.label}
                            {tab.count !== undefined && (
                                <span
                                    className={cn(
                                        "ml-1.5 px-1.5 py-0.5 rounded-full dash-label-sm",
                                        isActive
                                            ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                                            : "bg-[var(--bg-fill)] text-[var(--text-tertiary)]"
                                    )}
                                >
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            {trailing}
        </div>
    );
}

// ── Tab style helpers — kept for any remaining usages ──

export function getTabItemStyle(
    _variant: "default" | "analytics" | "finance" | "door" | "partners",
    isActive: boolean
): string {
    return isActive
        ? "font-semibold text-[var(--accent)] border-b-2 border-[var(--accent)]"
        : "font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]";
}
