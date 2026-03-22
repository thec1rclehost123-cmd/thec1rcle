"use client";

import { useState, useMemo } from "react";
import { Menu, X, PlusCircle } from "lucide-react";
import {
    LayoutDashboard,
    Zap,
    Calendar,
    DoorOpen,
    Handshake,
    BarChart3,
    Banknote,
    Globe,
    Settings,
} from "lucide-react";
import { AppleSidebar } from "@/components/shared/AppleSidebar";
import { AppleTopBar } from "@/components/shared/AppleTopBar";
import { motion, AnimatePresence } from "framer-motion";
import { ApprovalGuard } from "@/components/guards/ApprovalGuard";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { AssistantButton } from "@/components/assistant/AssistantButton";
import { KycBanner } from "@/components/shared/KycBanner";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { usePathname } from "next/navigation";
import type { VenueTab } from "@/lib/types/staffProfile";

const MENU_SECTIONS = [
    {
        items: [
            { icon: LayoutDashboard, label: "Overview",  href: "/venue" },
            { icon: Zap,             label: "Events",    href: "/venue/events" },
            { icon: Calendar,        label: "Calendar",  href: "/venue/calendar" },
            { icon: DoorOpen,        label: "Door",      href: "/venue/door" },
            { icon: Handshake,       label: "Partners",  href: "/venue/partners" },
            { icon: BarChart3,       label: "Analytics", href: "/venue/analytics" },
            { icon: Banknote,        label: "Finance",   href: "/venue/finance" },
            { icon: Globe,           label: "Presence",  href: "/venue/presence" },
            { icon: Settings,        label: "Settings",  href: "/venue/settings" },
        ],
    },
];

// ── Tab-to-href mapping ────────────────────────────────────────────────────────
const HREF_TO_TAB: Record<string, VenueTab> = {
    // New hub hrefs
    "/venue":             "overview",
    "/venue/events":      "events",
    "/venue/door":        "door",
    "/venue/partners":    "partners",
    "/venue/analytics":   "analytics",
    "/venue/finance":     "finance",
    "/venue/presence":    "presence",
    "/venue/settings":    "settings",
    // Legacy hrefs — kept as aliases so active-state still highlights correctly
    "/venue/create":          "events",
    "/venue/calendar":        "calendar",
    "/venue/walk-ins":        "door",
    "/venue/guest-ops":       "door",
    "/venue/registers":       "door",
    "/venue/partnerships":    "partners",
    "/venue/connections":     "partners",
    "/venue/page-management": "presence",
    "/venue/menu":            "presence",
    "/venue/staff":           "settings",
    "/venue/security":        "settings",
};

function itemTab(href: string): VenueTab | null {
    if (HREF_TO_TAB[href]) return HREF_TO_TAB[href];
    for (const [prefix, tab] of Object.entries(HREF_TO_TAB)) {
        if (href.startsWith(prefix + "/")) return tab;
    }
    return null;
}

function applyTabVisibility(
    sections: typeof MENU_SECTIONS,
    tabVisibility: Partial<Record<VenueTab, boolean>> | null
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

interface VenueClientWrapperProps {
    children: React.ReactNode;
}

export function VenueClientWrapper({ children }: VenueClientWrapperProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { tabVisibility: ctxTabVisibility } = useDashboardAuth();
    const pathname = usePathname();

    const venuePrimaryAction = { label: "+ Create Event", href: "/venue/create", icon: PlusCircle };

    // Use server-resolved tabVisibility from auth context (works for all staff roles)
    // Falls back to null (show all) for owners who have no tab restrictions
    const tabVisibility = ctxTabVisibility ?? null;

    const filteredSections = useMemo(
        () => applyTabVisibility(MENU_SECTIONS, tabVisibility as Partial<Record<VenueTab, boolean>> | null),
        [tabVisibility]
    );

    return (
        <ApprovalGuard>
            <RoleGuard allowedType="venue">
                <div className="venue-shell min-h-screen bg-[var(--v-canvas)]">
                    {/* Desktop Sidebar */}
                    <div className="hidden lg:block fixed left-0 top-0 bottom-0 h-full z-50">
                        <AppleSidebar
                            brandLetter="C"
                            brandLabel="Venue"
                            menuSections={filteredSections}
                            basePath="/venue"
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
                            <span className="w-7 h-7 rounded-lg bg-text-primary flex items-center justify-center text-text-inverse text-[11px] font-bold">C</span>
                            <span className="text-[13px] font-bold text-text-primary tracking-wide">C1RCLE</span>
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
                                        brandLetter="C"
                                        brandLabel="Venue"
                                        menuSections={filteredSections}
                                        basePath="/venue"
                                    />
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                    {/* Main Content */}
                    <div className={`${isCollapsed ? "lg:pl-[80px]" : "lg:pl-[280px]"} flex flex-col min-h-screen pt-14 lg:pt-0 transition-all duration-300 ease-in-out`}>
                        <div className="hidden lg:block sticky top-0 z-40">
                            <AppleTopBar primaryAction={venuePrimaryAction} />
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
