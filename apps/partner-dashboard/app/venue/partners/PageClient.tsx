"use client";

import { Suspense } from "react";
import { useHubTab } from "@/lib/hooks/useHubTab";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { DiscoverDirectory } from "@/components/partnerships/DiscoverDirectory";
import ActivePartnershipsClient from "../partnerships/PageClient";
import PendingRequestsClient from "../connections/requests/PageClient";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import { PageToolbar } from "@/components/ui/PageToolbar";
import { TabBar } from "@/components/ui/TabBar";

const TABS = [
    { key: "discover", label: "Discover" },
    { key: "pending",  label: "Pending"  },
    { key: "active",   label: "Active"   },
];

function TabContent({ activeTab, venueId }: { activeTab: string; venueId?: string }) {
    switch (activeTab) {
        case "discover":
            return (
                <DiscoverDirectory
                    allowedTypes={["host", "promoter"]}
                    partnerId={venueId}
                    role="venue"
                />
            );
        case "pending":
            return <PendingRequestsClient />;
        case "active":
            return <ActivePartnershipsClient />;
        default:
            return (
                <DiscoverDirectory
                    allowedTypes={["host", "promoter"]}
                    partnerId={venueId}
                    role="venue"
                />
            );
    }
}

export default function PartnersPageClient() {
    const { activeTab, setTab } = useHubTab("discover");
    const { profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;

    return (
        <VenuePageShell
            title="Partners"
            subtitle="Hosts and promoters who operate at your venue."
            toolbar={
                <PageToolbar
                    left={
                        <TabBar
                            mode="underline"
                            tabs={TABS}
                            active={activeTab}
                            onChange={setTab}
                        />
                    }
                />
            }
        >
            <Suspense fallback={<Skeleton className="h-64 w-full rounded-[var(--r-lg)]" />}>
                <TabContent activeTab={activeTab} venueId={venueId} />
            </Suspense>
        </VenuePageShell>
    );
}
