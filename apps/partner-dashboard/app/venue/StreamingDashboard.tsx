"use client";

import React, { Suspense, useState } from "react";
import { SkeletonKPIGrid, SkeletonCard } from "@/components/ui/Skeleton";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

// Dynamically import sections with Suspense support
const KPIGridModule = dynamic(() => import("./KPIGridModule"), {
    ssr: false,
    loading: () => <SkeletonKPIGrid count={4} />
});

const TonightOpsModule = dynamic(() => import("./TonightOpsModule"), {
    ssr: false,
    loading: () => <SkeletonCard className="h-[400px]" />
});

const UpcomingScheduleModule = dynamic(() => import("./UpcomingScheduleModule"), {
    ssr: false,
    loading: () => <SkeletonCard className="h-[400px]" />
});

const DashboardSidebarModule = dynamic(() => import("./DashboardSidebarModule"), {
    ssr: false,
    loading: () => <SkeletonCard className="h-[600px]" />
});

type TimeRange = "today" | "week" | "month" | "custom";

const TIME_RANGES: { id: TimeRange; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "week",  label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "custom", label: "Custom" },
];

export default function VenueDashboardStreaming() {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme !== "light";

    const [range, setRange] = useState<TimeRange>("month");
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");
    const [showCustom, setShowCustom] = useState(false);

    const handleRangeClick = (id: TimeRange) => {
        setRange(id);
        setShowCustom(id === "custom");
    };

    // Derive API range string from selection
    const apiRange =
        range === "today"  ? "today" :
        range === "week"   ? "7d" :
        range === "month"  ? "30d" :
        customFrom && customTo ? `custom:${customFrom}:${customTo}` : "30d";

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-20">

            {/* ── Time filter bar ─────────────────────────────────────── */}
            <div className="flex items-center gap-3 flex-wrap">
                <div
                    className="flex items-center gap-0.5 p-[3px] rounded-xl"
                    style={{
                        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)",
                        border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.10)",
                    }}
                >
                    {TIME_RANGES.map(r => (
                        <button
                            key={r.id}
                            onClick={() => handleRangeClick(r.id)}
                            className="px-4 py-2 rounded-[10px] text-[11px] font-black uppercase tracking-widest transition-all"
                            style={
                                range === r.id
                                    ? {
                                        background: "var(--v-orange)",
                                        color: "#fff",
                                        boxShadow: "0 2px 12px rgba(244,74,34,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                                    }
                                    : {
                                        background: "transparent",
                                        color: isDark ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.50)",
                                    }
                            }
                        >
                            {r.label}
                        </button>
                    ))}
                </div>

                {/* Custom date inputs — shown only when "Custom" is selected */}
                {showCustom && (
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={customFrom}
                            onChange={e => setCustomFrom(e.target.value)}
                            className="rounded-xl px-3 py-2 text-[12px] font-semibold focus:outline-none"
                            style={{
                                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                                border: isDark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(0,0,0,0.10)",
                                color: "var(--v-text-primary)",
                                colorScheme: isDark ? "dark" : "light",
                            }}
                        />
                        <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.3)" }}>to</span>
                        <input
                            type="date"
                            value={customTo}
                            onChange={e => setCustomTo(e.target.value)}
                            className="rounded-xl px-3 py-2 text-[12px] font-semibold focus:outline-none"
                            style={{
                                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                                border: isDark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(0,0,0,0.10)",
                                color: "var(--v-text-primary)",
                                colorScheme: isDark ? "dark" : "light",
                            }}
                        />
                    </div>
                )}
            </div>

            {/* KPI Grid */}
            <Suspense fallback={<SkeletonKPIGrid count={4} />}>
                <KPIGridModule range={apiRange} />
            </Suspense>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
                <div className="xl:col-span-2 space-y-6">
                    <Suspense fallback={<SkeletonCard className="h-[400px]" />}>
                        <TonightOpsModule />
                    </Suspense>
                    <Suspense fallback={<SkeletonCard className="h-[400px]" />}>
                        <UpcomingScheduleModule />
                    </Suspense>
                </div>
                <div className="space-y-6">
                    <Suspense fallback={<SkeletonCard className="h-[600px]" />}>
                        <DashboardSidebarModule />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
