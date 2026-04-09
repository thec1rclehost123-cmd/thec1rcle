"use client";

import { Suspense } from "react";
import { LayoutDashboard, Handshake, FolderOpen } from "lucide-react";
import { VenuePageShell, VenueFilterTabs } from "@/components/venue-layout/VenuePageShell";
import { useHubTab } from "@/lib/hooks/useHubTab";
import { Skeleton } from "@/components/ui/Skeleton";
import { WalletPopover } from "@/components/wallet/WalletPopover";

import OverviewClient from "./PageClient";
import { PartnerPayoutsClient } from "./partner-payouts/PageClient";
import { RecordsClient } from "./records/PageClient";

const EXECUTIVE_TABS = [
    { key: "overview",         label: "Summary",          icon: LayoutDashboard },
    { key: "partner-payouts",  label: "Partner Payouts",  icon: Handshake },
    { key: "records",          label: "Records",          icon: FolderOpen },
];

function TabContent({ activeTab }: { activeTab: string }) {
    switch (activeTab) {
        case "overview":        return <OverviewClient />;
        case "partner-payouts": return <PartnerPayoutsClient />;
        case "records":         return <RecordsClient />;
        default:                return <OverviewClient />;
    }
}

export default function FinanceHub() {
    const { activeTab, setTab } = useHubTab("overview");

    const tabItems = EXECUTIVE_TABS.map((t) => ({ label: t.label, value: t.key }));

    return (
        <VenuePageShell
            title="Finance"
            noPadding
            actions={<WalletPopover />}
            filterBar={
                <VenueFilterTabs
                    tabs={tabItems}
                    active={activeTab}
                    onChange={setTab}
                    variant="finance"
                />
            }
        >
            <div className="pt-2">
                <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
                    <TabContent activeTab={activeTab} />
                </Suspense>
            </div>
        </VenuePageShell>
    );
}
