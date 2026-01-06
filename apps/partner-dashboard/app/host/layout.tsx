"use client";

import { useDashboardAuth } from "../../components/providers/DashboardAuthProvider";
import { AppleSidebar } from "../../components/shared/AppleSidebar";
import { AppleTopBar } from "../../components/shared/AppleTopBar";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ApprovalGuard } from "@/components/guards/ApprovalGuard";
import {
    LayoutDashboard,
    CalendarDays,
    PlusCircle,
    BarChart3,
    Users,
    Settings,
    Layout,
    ShieldCheck
} from "lucide-react";

const menuSections = [
    {
        items: [
            { icon: LayoutDashboard, label: "Overview", href: "/host" },
            {
                icon: BarChart3,
                label: "Analytics",
                href: "/host/analytics",
                children: [
                    { label: "Overview", href: "/host/analytics/overview" },
                    { label: "Performance", href: "/host/analytics/performance" },
                    { label: "Audience Quality", href: "/host/analytics/audience" },
                    { label: "Trust & Reliability", href: "/host/analytics/reliability" },
                    { label: "Venue ROI", href: "/host/analytics/partners" },
                    { label: "Strategy", href: "/host/analytics/strategy" },
                ]
            },
        ]
    },
    {
        items: [
            { icon: CalendarDays, label: "Events", href: "/host/events" },
            { icon: PlusCircle, label: "Create Event", href: "/host/create" },
            { icon: ShieldCheck, label: "Entry Control", href: "/host/ops" },
        ]
    },
    {
        items: [
            { icon: Users, label: "Promoters", href: "/host/promoters" },
            { icon: Users, label: "Venues", href: "/host/partnerships" },
        ]
    },
    {
        items: [
            { icon: Layout, label: "Public Page", href: "/host/profile" },
            { icon: Settings, label: "Settings", href: "/host/settings" },
        ]
    }
];

export default function HostLayout({ children }: { children: React.ReactNode }) {
    return (
        <ApprovalGuard>
            <RoleGuard allowedType="host">
                <div className="min-h-screen bg-[#fbfbfd]">
                    <AppleSidebar
                        brandLetter="H"
                        brandLabel="Host"
                        menuSections={menuSections}
                        basePath="/host"
                    />

                    <div className="pl-[260px] flex flex-col min-h-screen">
                        <AppleTopBar />

                        <main className="flex-1 p-8">
                            <div className="max-w-[1100px] mx-auto animate-slide-up">
                                {children}
                            </div>
                        </main>
                    </div>
                </div>
            </RoleGuard>
        </ApprovalGuard>
    );
}
