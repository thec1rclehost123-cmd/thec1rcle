"use client";

import { useState, Suspense } from "react";
import { LayoutDashboard, CreditCard, Building2, Users, BookOpen, FileBarChart, Banknote, Wallet, CalendarClock, Megaphone, SplitSquareVertical } from "lucide-react";
import { VenuePageShell, VenueFilterTabs } from "@/components/venue-layout/VenuePageShell";
import { useHubTab } from "@/lib/hooks/useHubTab";
import { Skeleton } from "@/components/ui/Skeleton";
import { WalletPopover } from "@/components/wallet/WalletPopover";

import OverviewClient from "./PageClient";
import { PaymentsClient } from "./payments/PageClient";
import { VenuePayoutsClient } from "./venue-payouts/PageClient";
import { HostPayoutsClient } from "./host-payouts/PageClient";
import { PromoterPayoutsClient } from "./promoter-payouts/PageClient";
import LedgerClient from "./ledger/PageClient";
import ReportsClient from "./reports/PageClient";
import { CoverReconClient } from "./cover/PageClient";
import { SubscriptionClient } from "./subscription/PageClient";
import { MarketingClient } from "./marketing/PageClient";
import { RevenueSplitsClient } from "./revenue-splits/PageClient";

const EXECUTIVE_TABS = [
    { key: "overview",          label: "Summary",          icon: LayoutDashboard },
    { key: "payments",          label: "Transactions",     icon: CreditCard },
    { key: "venue-payouts",     label: "Venue Payouts",    icon: Building2 },
    { key: "host-payouts",      label: "Host Payouts",     icon: Users },
    { key: "promoter-payouts",  label: "Promoter Rewards", icon: Banknote },
    { key: "ledger",            label: "Ledger",           icon: BookOpen },
    { key: "reports",           label: "Reports",          icon: FileBarChart },
    { key: "cover",             label: "Cover Charge",     icon: Wallet },
    { key: "subscription",      label: "Subscription",     icon: CalendarClock },
    { key: "marketing",         label: "Marketing",        icon: Megaphone },
    { key: "revenue-splits",    label: "Revenue Splits",   icon: SplitSquareVertical },
];

function TabContent({ activeTab }: { activeTab: string }) {
    switch (activeTab) {
        case "overview":         return <OverviewClient />;
        case "payments":         return <PaymentsClient />;
        case "venue-payouts":    return <VenuePayoutsClient />;
        case "host-payouts":     return <HostPayoutsClient />;
        case "promoter-payouts": return <PromoterPayoutsClient />;
        case "ledger":           return <LedgerClient />;
        case "reports":          return <ReportsClient />;
        case "cover":            return <CoverReconClient />;
        case "subscription":     return <SubscriptionClient />;
        case "marketing":        return <MarketingClient />;
        case "revenue-splits":   return <RevenueSplitsClient />;
        default:                 return <OverviewClient />;
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
