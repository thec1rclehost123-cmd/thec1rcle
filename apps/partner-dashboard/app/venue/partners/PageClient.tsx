"use client";

import { Suspense } from "react";
import { CheckCircle2, Clock, Compass } from "lucide-react";
import { HubTabBar } from "@/components/shared/HubTabBar";
import { useHubTab } from "@/lib/hooks/useHubTab";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { DiscoverDirectory } from "@/components/partnerships/DiscoverDirectory";
import ActivePartnershipsClient from "../partnerships/PageClient";
import PendingRequestsClient from "../connections/requests/PageClient";

const TABS = [
    { key: "discover", label: "Discover", icon: Compass },
    { key: "pending",  label: "Pending",  icon: Clock },
    { key: "active",   label: "Active",   icon: CheckCircle2 },
];

function TabContent({ activeTab, venueId }: { activeTab: string, venueId?: string }) {
    switch (activeTab) {
        case "discover": return (
            <div className="animate-in fade-in duration-500">
                <DiscoverDirectory
                    allowedTypes={["host", "promoter"]}
                    partnerId={venueId}
                    role="venue"
                />
            </div>
        );
        case "pending":  return <PendingRequestsClient />;
        case "active":   return <ActivePartnershipsClient />;
        default:         return (
            <div className="animate-in fade-in duration-500">
                <DiscoverDirectory
                    allowedTypes={["host", "promoter"]}
                    partnerId={venueId}
                    role="venue"
                />
            </div>
        );
    }
}

export default function PartnersPageClient() {
    const { activeTab, setTab } = useHubTab("discover");
    const { profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;

    return (
        <div className="space-y-6">
            {/* Hub Header */}
            <div>
                <h1 className="v-text-title font-semibold" style={{ color: "var(--v-text-primary)" }}>
                    Partners
                </h1>
                <p className="mt-1 text-[14px]" style={{ color: "var(--v-text-secondary)" }}>
                    Hosts and promoters who operate with your venue.
                </p>
            </div>

            {/* Tab Bar */}
            <HubTabBar tabs={TABS} activeTab={activeTab} onTabChange={setTab} />

            {/* Tab Content */}
            <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
                <TabContent activeTab={activeTab} venueId={venueId} />
            </Suspense>
        </div>
    );
}
