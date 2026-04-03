"use client";

import React, { type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface VenuePageShellProps {
    title: string;
    subtitle?: ReactNode;
    actions?: ReactNode;
    filterBar?: ReactNode;
    children: ReactNode;
    maxWidth?: "sm" | "md" | "full";
    noPadding?: boolean;
    /** Hex or CSS color for --v-page-accent. Defaults to --v-orange. */
    pageAccent?: string;
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
    pageAccent,
}: VenuePageShellProps) {
    const hasControlBar = !!filterBar;

    return (
        <div
            className={cn("mx-auto w-full pb-20 min-w-0", maxWidthClasses[maxWidth])}
            data-page-shell
            style={pageAccent ? { "--v-page-accent": pageAccent } as React.CSSProperties : undefined}
        >
            {/* Page Header */}
            <div className="mb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                        <h1
                            className="v-text-title font-semibold"
                            style={{ color: "var(--v-text-primary)" }}
                        >
                            {title}
                        </h1>
                        {subtitle ? (
                            <div
                                className="mt-1 text-sm leading-6"
                                style={{ color: "var(--v-text-secondary)" }}
                            >
                                {subtitle}
                            </div>
                        ) : null}
                    </div>
                    {actions && !hasControlBar ? (
                        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end shrink-0">
                            {actions}
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Sticky Control Bar — tabs on left, actions on right */}
            {hasControlBar && (
                <div
                    className="sticky top-14 lg:top-16 z-10 mb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10 border-b border-[var(--v-divider)]"
                    style={{
                        background: "var(--v-canvas)",
                        backdropFilter: "blur(12px)",
                        WebkitBackdropFilter: "blur(12px)",
                        paddingTop: "10px",
                        paddingBottom: "10px",
                    }}
                >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1 overflow-x-auto scrollbar-hide">
                            {filterBar}
                        </div>
                        {actions && filterBar && (
                            <div className="flex flex-wrap items-center gap-2 shrink-0 overflow-x-auto scrollbar-hide">
                                {actions}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Content */}
            <div className={noPadding ? "" : "space-y-4"}>
                {children}
            </div>
        </div>
    );
}

// ── Shared action button styles for VenuePageShell actions slot ──

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
    variant?: "primary" | "secondary" | "ghost";
    disabled?: boolean;
    className?: string;
}) {
    const base =
        "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--v-focus)] disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
        primary:
            "bg-[var(--v-orange)] text-white hover:brightness-110 active:scale-[0.98]",
        secondary:
            "bg-[var(--v-elevated)] text-[var(--v-text-primary)] border border-[var(--v-border)] hover:bg-[var(--v-card-hover)] active:scale-[0.98]",
        ghost:
            "text-[var(--v-text-secondary)] hover:text-[var(--v-text-primary)] hover:bg-[var(--v-card)] active:scale-[0.98]",
    };

    return (
        <button onClick={onClick} disabled={disabled} className={cn(base, variants[variant], className)}>
            {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
            {children}
        </button>
    );
}

// ── Filter tabs component ──

interface VenueFilterTabsProps {
    tabs: Array<{ label: string; value: string; count?: number }>;
    active: string;
    onChange: (value: string) => void;
    variant?: "default" | "analytics" | "finance" | "door" | "partners";
    trailing?: React.ReactNode;
}

export function VenueFilterTabs({ tabs, active, onChange, variant = "default", trailing }: VenueFilterTabsProps) {
    return (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide min-w-0">
            <div
                className="flex items-center gap-1 p-1 rounded-2xl flex-shrink-0"
                style={{
                    background: "var(--v-card)",
                    border: "1px solid var(--v-border)",
                    boxShadow: "var(--v-shadow-card)",
                    backdropFilter: "blur(20px)"
                }}
            >
                {tabs.map((tab) => {
                    const isActive = tab.value === active;
                    return (
                        <button
                            key={tab.value}
                            onClick={() => onChange(tab.value)}
                            className={cn(
                                "px-4 py-2 rounded-xl text-[12px] font-bold uppercase tracking-widest transition-all duration-300 relative",
                                isActive 
                                    ? "text-[var(--v-text-primary)]" 
                                    : "text-[var(--v-text-muted)] hover:text-[var(--v-text-secondary)] hover:bg-[var(--v-neutral-bg)]"
                            )}
                            style={{
                                background: isActive ? "var(--v-elevated)" : "transparent",
                                boxShadow: isActive ? "0 0 20px rgba(244, 74, 34, 0.1), inset 0 0 0 1px var(--v-border)" : "none",
                                border: isActive ? "1px solid var(--v-border)" : "1px solid transparent",
                            }}
                        >
                            {tab.label}
                            {tab.count !== undefined && (
                                <span
                                    className={cn(
                                        "ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-black",
                                        isActive
                                            ? "bg-[var(--v-orange)] text-white"
                                            : "bg-surface-tertiary text-[var(--v-text-secondary)]"
                                    )}
                                >
                                    {tab.count}
                                </span>
                            )}
                            {isActive && variant === "finance" && (
                                <motion.div 
                                    layoutId="active-pill-glow"
                                    className="absolute inset-0 rounded-xl pointer-events-none"
                                    style={{ border: "1px solid var(--v-orange)", opacity: 0.2 }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>
            {trailing && <div className="flex-shrink-0">{trailing}</div>}
        </div>
    );
}

// ── Tab style helpers ──

export function getTabItemStyle(
    variant: "default" | "analytics" | "finance" | "door" | "partners",
    isActive: boolean
): string {
    switch (variant) {
        case "analytics":
            return isActive
                ? "font-semibold bg-[var(--v-card)] shadow-sm"
                : "font-medium text-[var(--v-text-tertiary)] hover:text-[var(--v-text-secondary)]";
        case "finance":
            return isActive
                ? "font-bold text-[var(--v-text-primary)] border-b-2 rounded-none pb-[6px]"
                : "font-medium text-[var(--v-text-tertiary)] hover:text-[var(--v-text-secondary)] rounded-none";
        case "door":
            return isActive
                ? "font-black text-[var(--v-text-primary)] bg-[var(--v-elevated)] shadow-sm tracking-wide"
                : "font-semibold text-[var(--v-text-tertiary)] hover:text-[var(--v-text-secondary)] tracking-wide";
        case "partners":
            return isActive
                ? "font-medium text-[var(--v-text-primary)] bg-[var(--v-card)] shadow-sm"
                : "font-normal text-[var(--v-text-tertiary)] hover:text-[var(--v-text-secondary)]";
        default:
            return isActive
                ? "font-medium bg-[var(--v-card)] text-[var(--v-text-primary)] shadow-sm"
                : "font-medium text-[var(--v-text-tertiary)] hover:text-[var(--v-text-secondary)]";
    }
}
