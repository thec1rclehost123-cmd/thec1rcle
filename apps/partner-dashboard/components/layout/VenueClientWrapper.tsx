"use client";

import { useState, useEffect, useMemo } from "react";
import { Menu, X } from "lucide-react";
import { AppleSidebar } from "@/components/shared/AppleSidebar";
import { AppleTopBar } from "@/components/shared/AppleTopBar";
import { motion, AnimatePresence } from "framer-motion";
import { ApprovalGuard } from "@/components/guards/ApprovalGuard";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { AssistantButton } from "@/components/assistant/AssistantButton";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import type { VenueTab } from "@/lib/types/staffProfile";

interface VenueClientWrapperProps {
    children: React.ReactNode;
    menuSections: any[];
}

// ── Tab-to-href mapping ────────────────────────────────────────────────────────
// Maps the first path segment after /venue to a VenueTab key.
const HREF_TO_TAB: Record<string, VenueTab> = {
    "/venue":              "overview",
    "/venue/analytics":    "analytics",
    "/venue/events":       "events",
    "/venue/create":       "events",
    "/venue/finance":      "finance",
    "/venue/calendar":     "calendar",
    "/venue/walk-ins":     "walk_ins",
    "/venue/guest-ops":    "guest_ops",
    "/venue/partnerships": "partnerships",
    "/venue/connections":  "partnerships",
    "/venue/staff":        "staff",
    "/venue/registers":    "registers",
    "/venue/page-management": "page_management",
    "/venue/settings":     "settings",
};

function itemTab(href: string): VenueTab | null {
    // Exact match first
    if (HREF_TO_TAB[href]) return HREF_TO_TAB[href];
    // Prefix match (e.g. /venue/finance/payments → finance)
    for (const [prefix, tab] of Object.entries(HREF_TO_TAB)) {
        if (href.startsWith(prefix + "/")) return tab;
    }
    return null;
}

function applyTabVisibility(
    sections: any[],
    tabVisibility: Partial<Record<VenueTab, boolean>> | null
): any[] {
    // If no profile or no visibility rules, return all sections unchanged
    if (!tabVisibility || Object.keys(tabVisibility).length === 0) return sections;

    return sections
        .map((section) => ({
            ...section,
            items: section.items.filter((item: any) => {
                const tab = itemTab(item.href);
                if (!tab) return true; // unknown tab → show by default
                // undefined in tabVisibility → default true (show)
                return tabVisibility[tab] !== false;
            }),
        }))
        .filter((section) => section.items.length > 0);
}

export function VenueClientWrapper({ children, menuSections }: VenueClientWrapperProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { profile } = useDashboardAuth();

    // Load staff profile tab visibility if member has a custom profile assigned
    const [tabVisibility, setTabVisibility] = useState<Partial<Record<VenueTab, boolean>> | null>(null);

    useEffect(() => {
        const membership = profile?.activeMembership;
        if (!membership?.staffProfileId || !membership.partnerId) return;

        fetch(
            `/api/venue/staff-profiles/${membership.staffProfileId}?venueId=${membership.partnerId}`
        )
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (data?.profile?.tabVisibility) {
                    setTabVisibility(data.profile.tabVisibility);
                }
            })
            .catch(() => {/* fail silently — use full menu */});
    }, [profile?.activeMembership?.staffProfileId, profile?.activeMembership?.partnerId]);

    const filteredSections = useMemo(
        () => applyTabVisibility(menuSections, tabVisibility),
        [menuSections, tabVisibility]
    );

    return (
        <ApprovalGuard>
            <RoleGuard allowedType="venue">
                <div className="venue-shell dark min-h-screen bg-[var(--v-canvas)]">
                    {/* Desktop Sidebar */}
                    <div className="hidden lg:block fixed left-0 top-0 bottom-0 h-full z-50">
                        <AppleSidebar
                            brandLetter="C"
                            brandLabel="Venue"
                            menuSections={filteredSections}
                            basePath="/venue"
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
                                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
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
                    <AssistantButton />
                </div>
            </RoleGuard>
        </ApprovalGuard>
    );
}
