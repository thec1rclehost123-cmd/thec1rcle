"use client";

import { useQuery } from "@tanstack/react-query";
import { PromoterKPIGrid } from "./PromoterKPIGrid";
import { PromoterActiveEventsRail } from "./PromoterActiveEventsRail";
import { PromoterConversionSnapshot } from "./PromoterConversionSnapshot";
import { PromoterTopLinkCard } from "./PromoterTopLinkCard";
import { PromoterLeaderboardCard } from "./PromoterLeaderboardCard";

export function PromoterOverviewClient({ initialData }: any) {
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["promoter", "overview"],
        queryFn: async () => {
            const res = await fetch("/api/partners/promoters/overview");
            if (!res.ok) throw new Error("Failed to fetch overview");
            return res.json();
        },
        initialData,
        staleTime: 5 * 60 * 1000,
        refetchOnMount: false,
    });

    if (isLoading && !initialData) {
        return (
            <div className="flex flex-col gap-6 w-full animate-pulse pb-16">
                <div className="h-8 w-48 bg-surface-elevated rounded-xl" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-surface-elevated rounded-2xl border border-border-subtle" />)}
                </div>
                <div className="h-64 bg-surface-elevated rounded-2xl border border-border-subtle" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="w-full flex flex-col items-center justify-center py-20 gap-4 border border-red-500/20 rounded-2xl bg-red-500/5">
                <p className="font-bold text-red-500">Failed to load overview</p>
                <p className="text-sm text-text-secondary opacity-80">There was an error fetching your performance data.</p>
                <button
                    onClick={() => refetch()}
                    className="px-5 py-2 rounded-xl bg-surface-elevated border border-border-subtle text-text-primary text-sm font-semibold hover:bg-surface-hover transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
            <header className="mb-2">
                <h1 className="text-display-sm text-text-primary tracking-tight font-bold">
                    Overview
                </h1>
                <p className="text-text-secondary text-sm mt-1 font-medium">
                    Your active performance and upcoming assignments.
                </p>
            </header>

            <PromoterKPIGrid kpis={data?.kpis} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <PromoterActiveEventsRail assignments={data?.activeAssignments} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <PromoterConversionSnapshot snapshot={data?.conversionSnapshot} />
                        <PromoterTopLinkCard topLink={data?.topLink} />
                    </div>
                </div>
                <div className="flex flex-col gap-6">
                    <PromoterLeaderboardCard position={data?.leaderboardPosition} />
                    {/* PromoterRecentActivity (omitted for now) */}
                </div>
            </div>
        </div>
    );
}
