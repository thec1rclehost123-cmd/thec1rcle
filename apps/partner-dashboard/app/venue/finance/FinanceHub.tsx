"use client";

import { useState, Suspense } from "react";
import { LayoutDashboard, CreditCard, Building2, Users, BookOpen, FileBarChart, Banknote, ShieldCheck, Clock, TrendingUp, Handshake, Wallet } from "lucide-react";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import { useHubTab } from "@/lib/hooks/useHubTab";
import { Skeleton } from "@/components/ui/Skeleton";

import OverviewClient from "./PageClient";
import { PaymentsClient } from "./payments/PageClient";
import { VenuePayoutsClient } from "./venue-payouts/PageClient";
import { HostPayoutsClient } from "./host-payouts/PageClient";
import { PromoterPayoutsClient } from "./promoter-payouts/PageClient";
import LedgerClient from "./ledger/PageClient";
import ReportsClient from "./reports/PageClient";
import { CoverReconClient } from "./cover/PageClient";

const EXECUTIVE_TABS = [
    { key: "overview",          label: "Summary",          icon: LayoutDashboard },
    { key: "payments",          label: "Transactions",     icon: CreditCard },
    { key: "venue-payouts",     label: "Venue Payouts",    icon: Building2 },
    { key: "host-payouts",      label: "Host Payouts",     icon: Users },
    { key: "promoter-payouts",  label: "Promoter Rewards", icon: Banknote },
    { key: "ledger",            label: "Ledger",           icon: BookOpen },
    { key: "reports",           label: "Reports",          icon: FileBarChart },
    { key: "cover",             label: "Cover Charge",     icon: Wallet },
];

const PERIODS = [
    { label: "Tonight",      value: "1d" },
    { label: "7 Days",       value: "7d" },
    { label: "30 Days",      value: "30d" },
    { label: "Quarter",      value: "90d" },
    { label: "All Time",     value: "ytd" },
];

function TabContent({ activeTab, period, onPeriodChange }: { 
    activeTab: string; 
    period: string;
    onPeriodChange: (p: any) => void;
}) {
    switch (activeTab) {
        case "overview":         return <OverviewClient />;
        case "payments":         return <PaymentsClient />;
        case "venue-payouts":    return <VenuePayoutsClient />;
        case "host-payouts":     return <HostPayoutsClient />;
        case "promoter-payouts": return <PromoterPayoutsClient />;
        case "ledger":           return <LedgerClient />;
        case "reports":          return <ReportsClient />;
        case "cover":            return <CoverReconClient />;
        default:                 return <OverviewClient />;
    }
}

export default function FinanceHub() {
    const { activeTab, setTab } = useHubTab("overview");
    const [period, setPeriod] = useState("30d");

    return (
        <VenuePageShell
            title="Finance"
            noPadding
        >
            <div className="flex flex-col gap-4">
                {/* Tab Content */}
                <div className="px-1">
                    <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
                        <TabContent 
                            activeTab={activeTab} 
                            period={period}
                            onPeriodChange={setPeriod}
                        />
                    </Suspense>
                </div>
            </div>
        </VenuePageShell>
    );
}
