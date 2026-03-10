"use client";

import { ReactNode } from "react";
import clsx from "clsx";

interface VenuePageShellProps {
    title: string;
    subtitle?: string;
    actions?: ReactNode;
    filterBar?: ReactNode;
    children: ReactNode;
    maxWidth?: "sm" | "md" | "full";
    noPadding?: boolean;
}

const maxWidthClasses = {
    sm: "max-w-[1024px]",
    md: "max-w-[1280px]",
    full: "max-w-[1600px]",
};

export function VenuePageShell({
    title,
    subtitle,
    actions,
    filterBar,
    children,
    maxWidth = "full",
    noPadding = false,
}: VenuePageShellProps) {
    return (
        <div className={clsx("mx-auto w-full pb-20", maxWidthClasses[maxWidth])}>
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                <div>
                    <h1
                        className="v-text-title font-semibold"
                        style={{ color: "var(--v-text-primary)" }}
                    >
                        {title}
                    </h1>
                    {subtitle && (
                        <p
                            className="mt-1 text-[14px]"
                            style={{ color: "var(--v-text-secondary)" }}
                        >
                            {subtitle}
                        </p>
                    )}
                </div>
                {actions && (
                    <div className="flex items-center gap-3 shrink-0">{actions}</div>
                )}
            </div>

            {/* Filter Bar */}
            {filterBar && (
                <div className="mb-6">{filterBar}</div>
            )}

            {/* Content */}
            <div className={noPadding ? "" : "space-y-6"}>
                {children}
            </div>
        </div>
    );
}

// ── Shared action button styles for VenuePageShell actions slot ──

export function VenueActionButton({
    children,
    onClick,
    variant = "primary",
    className,
}: {
    children: ReactNode;
    onClick?: () => void;
    variant?: "primary" | "secondary" | "ghost";
    className?: string;
}) {
    const base =
        "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--v-focus)]";

    const variants = {
        primary:
            "bg-[var(--v-orange)] text-white hover:brightness-110 active:scale-[0.98]",
        secondary:
            "bg-[var(--v-elevated)] text-[var(--v-text-primary)] border border-[var(--v-border)] hover:bg-[var(--v-card-hover)] active:scale-[0.98]",
        ghost:
            "text-[var(--v-text-secondary)] hover:text-[var(--v-text-primary)] hover:bg-[var(--v-card)] active:scale-[0.98]",
    };

    return (
        <button onClick={onClick} className={clsx(base, variants[variant], className)}>
            {children}
        </button>
    );
}

// ── Filter tabs component ──

interface VenueFilterTabsProps {
    tabs: Array<{ label: string; value: string; count?: number }>;
    active: string;
    onChange: (value: string) => void;
}

export function VenueFilterTabs({ tabs, active, onChange }: VenueFilterTabsProps) {
    return (
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-[var(--v-hero)] w-fit">
            {tabs.map((tab) => {
                const isActive = tab.value === active;
                return (
                    <button
                        key={tab.value}
                        onClick={() => onChange(tab.value)}
                        className={clsx(
                            "px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-150",
                            isActive
                                ? "bg-[var(--v-card)] text-[var(--v-text-primary)] shadow-sm"
                                : "text-[var(--v-text-tertiary)] hover:text-[var(--v-text-secondary)]"
                        )}
                    >
                        {tab.label}
                        {tab.count !== undefined && (
                            <span
                                className={clsx(
                                    "ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                                    isActive
                                        ? "bg-[var(--v-orange)] text-white"
                                        : "bg-[var(--v-elevated)] text-[var(--v-text-muted)]"
                                )}
                            >
                                {tab.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
