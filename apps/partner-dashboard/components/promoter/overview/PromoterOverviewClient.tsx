"use client";

import { useQuery } from "@tanstack/react-query";
import { PromoterKPIGrid } from "./PromoterKPIGrid";
import { PromoterActiveEventsRail } from "./PromoterActiveEventsRail";
import { PromoterConversionSnapshot } from "./PromoterConversionSnapshot";
import { PromoterTopLinkCard } from "./PromoterTopLinkCard";
import { PromoterLeaderboardCard } from "./PromoterLeaderboardCard";

export function PromoterOverviewClient({ initialData }: any) {
    const { data } = useQuery({
        queryKey: ["promoter", "overview"],
        queryFn: async () => {
            const res = await fetch("/api/partner/promoter/overview");
            if (!res.ok) throw new Error("Failed to fetch overview");
            return res.json();
        },
        initialData,
        staleTime: 5 * 60 * 1000,
    });

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
            <header className="mb-2">
                <h1 className="text-display-sm text-[var(--text-primary)] tracking-tight font-bold">
                    Overview
                </h1>
                <p className="text-[var(--text-secondary)] text-sm mt-1 font-medium">
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
