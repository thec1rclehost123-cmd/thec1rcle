"use client";

import { AppleSidebar } from "@/components/shared/AppleSidebar";
import { AppleTopBar } from "@/components/shared/AppleTopBar";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { ApprovalGuard } from "@/components/guards/ApprovalGuard";
import {
    LayoutDashboard,
    CalendarDays,
    Link2,
    BarChart3,
    Users,
    CreditCard,
    Settings,
    User,
    Handshake
} from "lucide-react";

const menuSections = [
    {
        items: [
            { icon: LayoutDashboard, label: "Overview", href: "/promoter" },
            { icon: BarChart3, label: "Stats", href: "/promoter/stats" },
        ]
    },
    {
        items: [
            { icon: CalendarDays, label: "Events", href: "/promoter/events" },
            { icon: Link2, label: "My Links", href: "/promoter/links" },
            { icon: Users, label: "Guests", href: "/promoter/guests" },
        ]
    },
    {
        items: [
            { icon: Handshake, label: "Connections", href: "/promoter/connections" },
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
                <div className="min-h-screen bg-[#fbfbfd]">
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
                    <header className="lg:hidden h-14 glass-nav fixed top-0 left-0 right-0 z-50 px-4 flex items-center justify-between">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 rounded-lg hover:bg-black/[0.04]"
                        >
                            <Menu className="h-5 w-5 text-[#1d1d1f]" />
                        </button>
                        <span className="text-[15px] font-semibold text-[#1d1d1f]">C1RCLE</span>
                        <div className="w-9" />
                    </header>

                    {/* Mobile Sidebar Overlay */}
                    {sidebarOpen && (
                        <div className="fixed inset-0 z-[100] lg:hidden">
                            <div
                                className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                                onClick={() => setSidebarOpen(false)}
                            />
                            <div className="absolute inset-y-0 left-0 w-[280px] bg-white shadow-xl animate-slide-up">
                                <div className="absolute top-4 right-4">
                                    <button
                                        onClick={() => setSidebarOpen(false)}
                                        className="p-2 rounded-lg hover:bg-black/[0.04]"
                                    >
                                        <X className="h-5 w-5 text-[#86868b]" />
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
                    <div className="lg:pl-[260px] flex flex-col min-h-screen pt-14 lg:pt-0">
                        <div className="hidden lg:block">
                            <AppleTopBar />
                        </div>

                        <main className="flex-1 p-6 lg:p-8">
                            <div className="max-w-[900px] mx-auto animate-slide-up">
                                {children}
                            </div>
                        </main>
                    </div>
                </div>
            </RoleGuard>
        </ApprovalGuard>
    );
}
