"use client";

import { AppleSidebar } from "@/components/shared/AppleSidebar";
import { AppleTopBar } from "@/components/shared/AppleTopBar";
import { useState } from "react";
import { Menu, X } from "lucide-react";
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
    ShieldCheck,
    Building
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
            { icon: Building, label: "Venues", href: "/host/partnerships" },
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
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <ApprovalGuard>
            <RoleGuard allowedType="host">
                <div className="min-h-screen bg-stone-50">
                    {/* Desktop Sidebar */}
                    <div className="hidden lg:block">
                        <AppleSidebar
                            brandLetter="H"
                            brandLabel="Host"
                            menuSections={menuSections}
                            basePath="/host"
                        />
                    </div>

                    {/* Mobile Header */}
                    <header className="lg:hidden h-14 glass-nav fixed top-0 left-0 right-0 z-50 px-4 flex items-center justify-between">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 rounded-lg hover:bg-stone-100"
                        >
                            <Menu className="h-5 w-5 text-stone-700" />
                        </button>
                        <span className="text-[15px] font-semibold text-stone-800">C1RCLE</span>
                        <div className="w-9" />
                    </header>

                    {/* Mobile Sidebar Overlay */}
                    {sidebarOpen && (
                        <div className="fixed inset-0 z-[100] lg:hidden">
                            <div
                                className="absolute inset-0 bg-stone-900/20"
                                onClick={() => setSidebarOpen(false)}
                            />
                            <div className="absolute inset-y-0 left-0 w-[280px] bg-white shadow-2xl animate-slide-in-right">
                                <div className="absolute top-4 right-4">
                                    <button
                                        onClick={() => setSidebarOpen(false)}
                                        className="p-2 rounded-lg hover:bg-stone-100"
                                    >
                                        <X className="h-5 w-5 text-stone-500" />
                                    </button>
                                </div>
                                <AppleSidebar
                                    brandLetter="H"
                                    brandLabel="Host"
                                    menuSections={menuSections}
                                    basePath="/host"
                                />
                            </div>
                        </div>
                    )}

                    {/* Main Content */}
                    <div className="lg:pl-[248px] flex flex-col min-h-screen pt-14 lg:pt-0">
                        <div className="hidden lg:block">
                            <AppleTopBar />
                        </div>

                        <main className="flex-1 p-6 lg:p-8">
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
