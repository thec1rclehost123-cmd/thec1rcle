"use client";

import { useState, useMemo } from "react";
import { Menu, X, PlusCircle } from "lucide-react";
import Link from "next/link";
import {
    LayoutDashboard,
    Zap,
    Calendar,
    Network,
    Users,
    BarChart2,
    Banknote,
    Settings,
    Layout,
    Inbox,
} from "lucide-react";
import { AppleSidebar } from "@/components/shared/AppleSidebar";
import { AppleTopBar } from "@/components/shared/AppleTopBar";
import { motion, AnimatePresence } from "framer-motion";
import { ApprovalGuard } from "@/components/guards/ApprovalGuard";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { AssistantButton } from "@/components/assistant/AssistantButton";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { getDefaultTabVisibility } from "@/lib/rbac/types";
import { KycBanner } from "@/components/shared/KycBanner";
import { usePathname } from "next/navigation";

const MENU_SECTIONS = [
    {
        items: [
            { icon: LayoutDashboard, label: "Overview",  href: "/host" },
            { icon: Zap,             label: "Events",    href: "/host/events" },
            { icon: Inbox,           label: "Requests",  href: "/host/events/requests" },
            { icon: Calendar,        label: "Calendar",  href: "/host/calendar" },
            { icon: Network,         label: "Network",   href: "/host/network" },
            { icon: Users,           label: "Audience",  href: "/host/audience" },
            { icon: BarChart2,       label: "Analytics", href: "/host/analytics" },
            { icon: Banknote,        label: "Finance",   href: "/host/finance" },
            { icon: Layout,          label: "Presence",  href: "/host/presence" },
            { icon: Settings,        label: "Settings",  href: "/host/settings" },
        ],
    },
];

// ── Tab-to-href mapping ────────────────────────────────────────────────────────
const HOST_HREF_TO_TAB: Record<string, string> = {
    "/host":            "overview",
    "/host/events":          "events",
    "/host/events/requests": "requests",
    "/host/calendar":        "calendar",
    "/host/network":    "network",
    "/host/audience":   "audience",
    "/host/analytics":  "analytics",
    "/host/finance":    "finance",
    "/host/presence":   "presence",
    "/host/settings":   "settings",
};

function itemTab(href: string): string | null {
    if (HOST_HREF_TO_TAB[href]) return HOST_HREF_TO_TAB[href];
    for (const [prefix, tab] of Object.entries(HOST_HREF_TO_TAB)) {
        if (href.startsWith(prefix + "/")) return tab;
    }
    return null;
}

function applyTabVisibility(
    sections: typeof MENU_SECTIONS,
    tabVisibility: Partial<Record<string, boolean>> | null
): typeof MENU_SECTIONS {
    if (!tabVisibility || Object.keys(tabVisibility).length === 0) return sections;
    return sections
        .map((section) => ({
            ...section,
            items: section.items.filter((item) => {
                const tab = itemTab(item.href);
                if (!tab) return true;
                return tabVisibility[tab] !== false;
            }),
        }))
        .filter((section) => section.items.length > 0) as typeof MENU_SECTIONS;
}

interface HostClientWrapperProps {
    children: React.ReactNode;
}

export function HostClientWrapper({ children }: HostClientWrapperProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { tabVisibility: ctxTabVisibility, profile } = useDashboardAuth();
    const pathname = usePathname();

    const hostPrimaryAction = { label: "+ Create Event", href: "/host/create/select-venue", icon: PlusCircle };

    // Use server-resolved tabVisibility from auth context if set (custom staff profiles).
    // Fall back to role-based defaults so host COHOST/STAFF only see permitted tabs
    // even without a custom staff profile configured.
    const membership = profile?.activeMembership;
    const tabVisibility = ctxTabVisibility ?? (
        membership?.role
            ? getDefaultTabVisibility(membership.partnerType, membership.role)
            : null
    );

    const filteredSections = useMemo(
        () => applyTabVisibility(MENU_SECTIONS, tabVisibility),
        [tabVisibility]
    );

    return (
        <ApprovalGuard>
            <RoleGuard allowedType="host">
                <div className="venue-shell min-h-screen bg-[var(--v-canvas)]">
                    {/* Desktop Sidebar */}
                    <div className="hidden lg:block fixed left-0 top-0 bottom-0 h-full z-50">
                        <AppleSidebar
                            brandLetter="H"
                            brandLabel="Host"
                            menuSections={filteredSections}
                            basePath="/host"
                            isCollapsed={isCollapsed}
                            onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
                        />
                    </div>

                    {/* Mobile Header */}
                    <header className="lg:hidden h-14 bg-surface-base/90 backdrop-blur-xl border-b border-border-subtle fixed top-0 left-0 right-0 z-50 px-4 flex items-center justify-between">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 rounded-lg hover:bg-surface-secondary transition-colors"
                        >
                            <Menu className="h-5 w-5 text-text-primary" />
                        </button>
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-text-primary flex items-center justify-center text-text-inverse text-[13px] font-bold">H</span>
                            <span className="text-[15px] font-bold text-text-primary tracking-wide">C1RCLE</span>
                        </div>
                        <Link
                            href="/host/create/select-venue"
                            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                            style={{ background: "var(--c1rcle-orange)" }}
                            title="Create Event"
                        >
                            <PlusCircle className="h-4 w-4 text-white" />
                        </Link>
                    </header>

                    {/* Mobile Sidebar Overlay */}
                    <AnimatePresence>
                        {sidebarOpen && (
                            <div className="fixed inset-0 z-[100] lg:hidden">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm"
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
                                            className="p-2 rounded-lg hover:bg-surface-tertiary text-text-tertiary hover:text-text-primary transition-all"
                                        >
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>
                                    <AppleSidebar
                                        brandLetter="H"
                                        brandLabel="Host"
                                        menuSections={filteredSections}
                                        basePath="/host"
                                    />
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                    {/* Main Content */}
                    <div className={`${isCollapsed ? "lg:pl-[80px]" : "lg:pl-[280px]"} flex flex-col min-h-screen pt-14 lg:pt-0 transition-all duration-300 ease-in-out`}>
                        <div className="hidden lg:block sticky top-0 z-40">
                            <AppleTopBar primaryAction={hostPrimaryAction} />
                        </div>
                        <KycBanner />
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
                    <AssistantButton />
                </div>
            </RoleGuard>
        </ApprovalGuard>
    );
}
