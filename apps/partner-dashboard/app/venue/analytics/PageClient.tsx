"use client";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import OverviewClient from "./overview/OverviewClient";

export default function AnalyticsPageClient() {
    return (
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
            <OverviewClient />
        </Suspense>
    );
}
