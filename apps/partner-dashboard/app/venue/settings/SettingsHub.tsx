"use client";
import { Suspense, useState, ReactNode } from "react";
import { Settings, Shield, Users, Lock, UserCircle } from "lucide-react";
import { HubTabBar } from "@/components/shared/HubTabBar";
import { useHubTab } from "@/lib/hooks/useHubTab";
import { Skeleton } from "@/components/ui/Skeleton";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";

import GeneralClient from "./PageClient";
import StaffClient from "../staff/PageClient";
import SecurityClient from "../security/PageClient";
import VenueProfileClient from "./VenueProfileClient";

const TABS = [
    { key: "profile",  label: "Profile",         icon: UserCircle },
    { key: "general",  label: "General",         icon: Settings },
    { key: "staff",    label: "Staff",           icon: Users },
    { key: "security", label: "Gate & Security", icon: Lock },
];

function TabContent({ activeTab, setActions }: { activeTab: string; setActions: (actions: ReactNode) => void }) {
    switch (activeTab) {
        case "profile":  return <VenueProfileClient setActions={setActions} />;
        case "general":  return <GeneralClient setActions={setActions} />;
        case "staff":    return <StaffClient setActions={setActions} />;
        case "security": return <SecurityClient setActions={setActions} />;
        default:         return <VenueProfileClient setActions={setActions} />;
    }
}

export default function SettingsHub() {
    const { activeTab, setTab } = useHubTab("profile");
    const [actions, setActions] = useState<ReactNode>(null);

    return (
        <VenuePageShell
            title="Settings"
            subtitle="Venue configuration, staff access, and security controls."
            filterBar={<HubTabBar tabs={TABS} activeTab={activeTab} onTabChange={setTab} />}
            actions={actions}
        >
            <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
                <TabContent activeTab={activeTab} setActions={setActions} />
            </Suspense>
        </VenuePageShell>
    );
}
