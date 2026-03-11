import React, { Suspense } from "react";
import { SkeletonKPIGrid, SkeletonCard } from "@/components/ui/Skeleton";
import dynamic from "next/dynamic";

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

export default function VenueDashboardStreaming() {
    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-20">
            {/* KPI Grid */}
            <Suspense fallback={<SkeletonKPIGrid count={4} />}>
                <KPIGridModule />
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
