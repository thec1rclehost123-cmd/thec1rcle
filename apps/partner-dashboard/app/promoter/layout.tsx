"use client";

import { AppleSidebar } from "@/components/shared/AppleSidebar";
import { AppleTopBar } from "@/components/shared/AppleTopBar";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ApprovalGuard } from "@/components/guards/ApprovalGuard";
import { motion, AnimatePresence } from "framer-motion";
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
                <div className="min-h-screen bg-[var(--surface-base)]">
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
                    <header className="lg:hidden h-14 bg-[var(--surface-base)]/90 backdrop-blur-xl border-b border-[var(--border-subtle)] fixed top-0 left-0 right-0 z-50 px-4 flex items-center justify-between">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 rounded-lg hover:bg-[var(--surface-secondary)] transition-colors"
                        >
                            <Menu className="h-5 w-5 text-[var(--text-primary)]" />
                        </button>
                        <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-[var(--text-primary)] flex items-center justify-center text-[var(--text-inverse)] text-[11px] font-bold">P</span>
                            <span className="text-[13px] font-bold text-[var(--text-primary)] tracking-wide">C1RCLE</span>
                        </div>
                        <div className="w-9" />
                    </header>

                    {/* Mobile Sidebar Overlay */}
                    <AnimatePresence>
                        {sidebarOpen && (
                            <div className="fixed inset-0 z-[100] lg:hidden">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                    onClick={() => setSidebarOpen(false)}
                                />
                                <motion.div
                                    initial={{ x: -280 }}
                                    animate={{ x: 0 }}
                                    exit={{ x: -280 }}
                                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                    className="absolute inset-y-0 left-0 w-[280px] bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] shadow-2xl"
                                >
                                    <div className="absolute top-4 right-4 z-10">
                                        <button
                                            onClick={() => setSidebarOpen(false)}
                                            className="p-2 rounded-lg hover:bg-[var(--surface-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all"
                                        >
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>
                                    <AppleSidebar
                                        brandLetter="P"
                                        brandLabel="Promoter"
                                        menuSections={menuSections}
                                        basePath="/promoter"
                                    />
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                    {/* Main Content */}
                    <div className="lg:pl-[280px] flex flex-col min-h-screen pt-14 lg:pt-0">
                        <div className="hidden lg:block sticky top-0 z-40">
                            <AppleTopBar />
                        </div>

                        <main className="flex-1 p-4 sm:p-6 lg:p-8 xl:p-10">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                className="max-w-[1600px] mx-auto"
                            >
                                {children}
                            </motion.div>
                        </main>
                    </div>
                </div>
            </RoleGuard>
        </ApprovalGuard>
    );
}
