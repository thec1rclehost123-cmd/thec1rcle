"use client";

import clsx from "clsx";
import { ReactNode } from "react";

/**
 * Skeleton Loading Components
 * Premium shimmer effects matching THE C1RCLE design system
 */

interface SkeletonProps {
    className?: string;
    animate?: boolean;
    style?: React.CSSProperties;
}

// Base Skeleton
export function Skeleton({ className, animate = true, style }: SkeletonProps) {
    return (
        <div
            className={clsx(
                "skeleton bg-[var(--surface-tertiary)] rounded-lg",
                animate && "relative overflow-hidden",
                className
            )}
            style={style}
            aria-hidden="true"
        />
    );
}

// Text Line
export function SkeletonText({ width = "100%", className }: { width?: string; className?: string }) {
    return <Skeleton className={clsx("h-4", className)} style={{ width }} />;
}

// Title
export function SkeletonTitle({ width = "60%", className }: { width?: string; className?: string }) {
    return <Skeleton className={clsx("h-7", className)} style={{ width }} />;
}

// Avatar
export function SkeletonAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" | "xl" }) {
    const sizes = {
        sm: "w-8 h-8",
        md: "w-10 h-10",
        lg: "w-14 h-14",
        xl: "w-20 h-20",
    };
    return <Skeleton className={clsx(sizes[size], "rounded-full")} />;
}

// Stat Value
export function SkeletonStat({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
    const sizes = {
        sm: "h-6 w-16",
        md: "h-9 w-24",
        lg: "h-12 w-32",
    };
    return <Skeleton className={sizes[size]} />;
}

// Button
export function SkeletonButton({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
    const sizes = {
        sm: "h-9 w-20",
        md: "h-11 w-28",
        lg: "h-14 w-36",
    };
    return <Skeleton className={clsx(sizes[size], "rounded-xl")} />;
}

// Card
export function SkeletonCard({ children, className }: { children?: ReactNode; className?: string }) {
    return (
        <div className={clsx(
            "bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded-2xl p-6",
            className
        )}>
            {children || (
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <SkeletonAvatar size="md" />
                        <div className="flex-1 space-y-2">
                            <SkeletonText width="40%" />
                            <SkeletonText width="60%" />
                        </div>
                    </div>
                    <Skeleton className="h-32 rounded-xl" />
                    <div className="flex gap-2">
                        <SkeletonButton size="sm" />
                        <SkeletonButton size="sm" />
                    </div>
                </div>
            )}
        </div>
    );
}

// KPI Tile Skeleton
export function SkeletonKPI({ compact = false }: { compact?: boolean }) {
    return (
        <div className={clsx(
            "kpi-tile",
            compact ? "p-4" : "p-6"
        )}>
            <Skeleton className={clsx(compact ? "w-10 h-10 mb-3" : "w-12 h-12 mb-4", "rounded-xl")} />
            <SkeletonText width="40%" className="mb-3" />
            <SkeletonStat size={compact ? "sm" : "md"} />
        </div>
    );
}

// KPI Grid Skeleton
export function SkeletonKPIGrid({ count = 4 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonKPI key={i} />
            ))}
        </div>
    );
}

// Table Skeleton
export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
    return (
        <div className="table-container">
            <table className="table w-full">
                <thead>
                    <tr>
                        {Array.from({ length: columns }).map((_, i) => (
                            <th key={i}>
                                <SkeletonText width="60%" />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: rows }).map((_, rowIndex) => (
                        <tr key={rowIndex}>
                            {Array.from({ length: columns }).map((_, colIndex) => (
                                <td key={colIndex}>
                                    <SkeletonText width={colIndex === 0 ? "80%" : "50%"} />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// List Item Skeleton
export function SkeletonListItem() {
    return (
        <div className="flex items-center gap-4 py-4 border-b border-[var(--border-subtle)]">
            <SkeletonAvatar size="md" />
            <div className="flex-1 space-y-2">
                <SkeletonText width="50%" />
                <SkeletonText width="30%" />
            </div>
            <Skeleton className="w-16 h-6 rounded-full" />
        </div>
    );
}

// Event Card Skeleton
export function SkeletonEventCard() {
    return (
        <div className="bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded-3xl overflow-hidden">
            <Skeleton className="h-48 rounded-none" />
            <div className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <Skeleton className="w-20 h-5 rounded-full" />
                    <Skeleton className="w-16 h-5 rounded-full" />
                </div>
                <SkeletonTitle width="80%" />
                <div className="flex items-center gap-3">
                    <SkeletonAvatar size="sm" />
                    <SkeletonText width="40%" />
                </div>
                <div className="flex gap-2 pt-2">
                    <SkeletonButton size="sm" />
                    <SkeletonButton size="sm" />
                </div>
            </div>
        </div>
    );
}

// Chart Skeleton
export function SkeletonChart({ height = "h-64" }: { height?: string }) {
    return (
        <div className={clsx("relative bg-[var(--surface-secondary)] rounded-xl overflow-hidden", height)}>
            {/* Fake bar chart lines */}
            <div className="absolute inset-0 flex items-end justify-around p-6 gap-3">
                {[40, 65, 45, 80, 55, 70, 50, 75, 60, 85, 45, 70].map((height, i) => (
                    <Skeleton
                        key={i}
                        className="flex-1 rounded-t-md"
                        style={{ height: `${height}%` }}
                    />
                ))}
            </div>
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between p-6">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-px bg-[var(--border-subtle)]" />
                ))}
            </div>
        </div>
    );
}

// Calendar Skeleton
export function SkeletonCalendar() {
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <SkeletonTitle width="30%" />
                <div className="flex gap-2">
                    <SkeletonButton size="sm" />
                    <SkeletonButton size="sm" />
                </div>
            </div>
            {/* Grid */}
            <div className="calendar-grid">
                {/* Day headers */}
                {["S", "M", "T", "W", "T", "F", "S"].map((_, i) => (
                    <div key={i} className="calendar-header">
                        <Skeleton className="w-6 h-4 mx-auto rounded" />
                    </div>
                ))}
                {/* Day cells */}
                {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="calendar-cell">
                        <Skeleton className="w-6 h-6 rounded-md" />
                    </div>
                ))}
            </div>
        </div>
    );
}

// Sidebar Skeleton
export function SkeletonSidebar() {
    return (
        <div className="w-[280px] h-screen bg-[var(--sidebar-bg)] border-r border-[var(--border-subtle)] p-6 space-y-6">
            {/* Brand */}
            <div className="flex items-center gap-3 mb-8">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="space-y-2">
                    <SkeletonText width="80px" />
                    <SkeletonText width="60px" />
                </div>
            </div>
            {/* Nav Items */}
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-5 h-5 rounded" />
                    <SkeletonText width={`${60 + Math.random() * 40}%`} />
                </div>
            ))}
        </div>
    );
}

// Full Page Loading
export function SkeletonDashboard() {
    return (
        <div className="min-h-screen bg-[var(--surface-base)]">
            {/* Top Bar */}
            <div className="h-16 border-b border-[var(--border-subtle)] px-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Skeleton className="w-24 h-6 rounded-full" />
                    <Skeleton className="w-32 h-9 rounded-lg" />
                </div>
                <div className="flex items-center gap-3">
                    <Skeleton className="w-48 h-10 rounded-lg" />
                    <SkeletonAvatar size="md" />
                </div>
            </div>

            {/* Content */}
            <div className="p-6 lg:p-10 max-w-[1400px] mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-end justify-between">
                    <div className="space-y-3">
                        <SkeletonText width="120px" />
                        <SkeletonTitle width="200px" />
                    </div>
                    <div className="flex gap-3">
                        <SkeletonButton />
                        <SkeletonButton />
                    </div>
                </div>

                {/* KPI Grid */}
                <SkeletonKPIGrid count={4} />

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <SkeletonCard>
                            <div className="space-y-4">
                                <div className="flex justify-between">
                                    <SkeletonTitle width="40%" />
                                    <Skeleton className="w-32 h-8 rounded-lg" />
                                </div>
                                <SkeletonChart height="h-72" />
                            </div>
                        </SkeletonCard>
                    </div>
                    <SkeletonCard>
                        <div className="space-y-4">
                            <SkeletonTitle width="60%" />
                            {Array.from({ length: 5 }).map((_, i) => (
                                <SkeletonListItem key={i} />
                            ))}
                        </div>
                    </SkeletonCard>
                </div>
            </div>
        </div>
    );
}

export default Skeleton;
