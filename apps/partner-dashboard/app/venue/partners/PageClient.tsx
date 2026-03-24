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
    { key: "active",  label: "Active",  icon: CheckCircle2 },
    { key: "pending", label: "Pending", icon: Clock },
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
        default:         return <ActivePartnershipsClient />;
    }
}

export default function PartnersPageClient() {
    const { activeTab, setTab } = useHubTab("active");
    const { profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;

    return (
        <div className="space-y-6">
            {/* Hub Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="v-text-title font-semibold" style={{ color: "var(--v-text-primary)" }}>
                        Partners
                    </h1>
                    <p className="mt-1 text-[14px]" style={{ color: "var(--v-text-secondary)" }}>
                        Hosts and promoters who operate with your venue.
                    </p>
                </div>
                <button
                    onClick={() => setTab(activeTab === "discover" ? "active" : "discover")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold uppercase tracking-widest transition-all shrink-0 ${
                        activeTab === "discover"
                            ? "text-[var(--v-orange)] border border-[var(--v-orange)]/30"
                            : "text-[var(--v-text-secondary)] hover:text-[var(--v-text-primary)] border border-[var(--v-border)]"
                    }`}
                    style={{
                        background: activeTab === "discover" ? "var(--v-orange-glow)" : "var(--v-card)",
                    }}
                >
                    <Compass className="w-3.5 h-3.5" />
                    Discover
                </button>
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
