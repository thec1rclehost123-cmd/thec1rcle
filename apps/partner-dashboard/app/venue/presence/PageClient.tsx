"use client";

import { Suspense } from "react";
import { Globe, UtensilsCrossed } from "lucide-react";
import { HubTabBar } from "@/components/shared/HubTabBar";
import { useHubTab } from "@/lib/hooks/useHubTab";
import { Skeleton } from "@/components/ui/Skeleton";

import VenuePageClient from "../page-management/PageClient";
import MenuPageClient from "../menu/PageClient";

const TABS = [
    { key: "page", label: "Venue Page", icon: Globe },
    { key: "menu", label: "Menu",       icon: UtensilsCrossed },
];

function TabContent({ activeTab }: { activeTab: string }) {
    switch (activeTab) {
        case "page": return <VenuePageClient />;
        case "menu": return <MenuPageClient />;
        default:     return <VenuePageClient />;
    }
}

export default function PresencePageClient() {
    const { activeTab, setTab } = useHubTab("page");

    return (
        <div className="space-y-6">
            {/* Hub Header */}
            <div>
                <h1 className="v-text-title font-semibold" style={{ color: "var(--text-primary)" }}>
                    Presence
                </h1>
                <p className="mt-1 text-[14px]" style={{ color: "var(--text-secondary)" }}>
                    How your venue appears publicly — page, menu, and identity.
                </p>
            </div>

            {/* Tab Bar */}
            <HubTabBar tabs={TABS} activeTab={activeTab} onTabChange={setTab} />

            {/* Tab Content */}
            <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
                <TabContent activeTab={activeTab} />
            </Suspense>
        </div>
    );
}
