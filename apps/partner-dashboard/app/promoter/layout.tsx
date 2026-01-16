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
    Link2,
    BarChart3,
    CreditCard,
    Settings,
    User,
    Users
} from "lucide-react";

const menuSections = [
    {
        items: [
            { icon: LayoutDashboard, label: "Overview", href: "/promoter" },
            {
                icon: BarChart3,
                label: "Analytics",
                href: "/promoter/analytics",
                children: [
                    { label: "Overview", href: "/promoter/analytics/overview" },
                    { label: "Event Data", href: "/promoter/analytics/performance" },
                    { label: "Audience Mix", href: "/promoter/analytics/audience" },
                    { label: "Funnel Velocity", href: "/promoter/analytics/funnel" },
                    { label: "Trust Score", href: "/promoter/analytics/trust" },
                    { label: "Strategy", href: "/promoter/analytics/strategy" },
                ]
            },
        ]
    },
    {
        items: [
            { icon: CalendarDays, label: "Events", href: "/promoter/events" },
            { icon: Link2, label: "My Links", href: "/promoter/links" },
        ]
    },
    {
        items: [
            { icon: Users, label: "Connections", href: "/promoter/connections" },
        ]
    },
    {
        items: [
            { icon: CreditCard, label: "Payouts", href: "/promoter/payouts" },
        ]
    },
    {
        items: [
            { icon: User, label: "Profile", href: "/promoter/profile" },
            { icon: Settings, label: "Settings", href: "/promoter/settings" },
        ]
    }
];

export default function PromoterLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <ApprovalGuard>
            <RoleGuard allowedType="promoter">
                <div className="min-h-screen bg-obsidian-base">
                    {/* Desktop Sidebar */}
                    <div className="hidden lg:block">
                        <AppleSidebar
                            brandLetter="P"
                            brandLabel="Promoter"
                            menuSections={menuSections}
                            basePath="/promoter"
                        />
                    </div>

                    {/* Mobile Header */}
                    <header className="lg:hidden h-14 bg-obsidian-base/80 backdrop-blur-xl border-b border-black/[0.05] fixed top-0 left-0 right-0 z-50 px-4 flex items-center justify-between">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 rounded-lg hover:bg-black/5"
                        >
                            <Menu className="h-5 w-5 text-[var(--text-primary)]" />
                        </button>
                        <span className="text-[15px] font-bold text-[var(--text-primary)] tracking-widest uppercase">C1RCLE</span>
                        <div className="w-9" />
                    </header>

                    {/* Mobile Sidebar Overlay */}
                    {sidebarOpen && (
                        <div className="fixed inset-0 z-[100] lg:hidden">
                            <div
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                onClick={() => setSidebarOpen(false)}
                            />
                            <div className="absolute inset-y-0 left-0 w-[300px] bg-obsidian-sidebar border-r border-black/[0.05] shadow-2xl animate-slide-up">
                                <div className="absolute top-4 right-4">
                                    <button
                                        onClick={() => setSidebarOpen(false)}
                                        className="p-2 rounded-lg hover:bg-black/5"
                                    >
                                        <X className="h-5 w-5 text-[var(--text-tertiary)]" />
                                    </button>
                                </div>
                                <AppleSidebar
                                    brandLetter="P"
                                    brandLabel="Promoter"
                                    menuSections={menuSections}
                                    basePath="/promoter"
                                />
                            </div>
                        </div>
                    )}

                    {/* Main Content */}
                    <div className="lg:pl-[300px] flex flex-col min-h-screen pt-14 lg:pt-0">
                        <div className="hidden lg:block sticky top-0 z-50">
                            <AppleTopBar />
                        </div>

                        <main className="flex-1 p-6 lg:p-10">
                            <div className="max-w-[1400px] mx-auto animate-slide-up">
                                {children}
                            </div>
                        </main>
                    </div>
                </div>
            </RoleGuard>
        </ApprovalGuard>
    );
}
