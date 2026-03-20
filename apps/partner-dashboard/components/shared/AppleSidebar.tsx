"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LogOut, ChevronDown, ChevronRight } from "lucide-react";
import { useDashboardAuth } from "../providers/DashboardAuthProvider";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ThemeToggleCompact } from "../ThemeToggle";

type MenuItem = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon: React.ComponentType<any>;
    label: string;
    href: string;
    badge?: string;
    minPlan?: string;
    children?: { label: string; href: string; badge?: string }[];
};

type MenuSection = {
    label?: string;
    items: MenuItem[];
};

interface AppleSidebarProps {
    brandLetter: string;
    brandLabel: string;
    menuSections: MenuSection[];
    basePath: string;
    subscriptionPlan?: string;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}

const PLAN_HIERARCHY: Record<string, number> = {
    'basic': 0,
    'silver': 1,
    'gold': 2,
    'diamond': 3
};

export function AppleSidebar({
    brandLetter,
    brandLabel,
    menuSections,
    basePath,
    subscriptionPlan: propPlan,
    isCollapsed = false,
    onToggleCollapse
}: AppleSidebarProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { signOut, profile, subscriptionPlan: contextPlan } = useDashboardAuth();
    const [expandedItems, setExpandedItems] = useState<string[]>([]);

    const currentPlan = (propPlan || contextPlan || 'basic').toLowerCase();
    const currentPlanLevel = PLAN_HIERARCHY[currentPlan] ?? 0;

    const currentTab = searchParams.get("tab") || searchParams.get("view");

    const isActive = (path: string) => {
        if (path === basePath && pathname === basePath) return true;
        
        // Handle explicit tab matches (e.g. /venue/events?tab=calendar matched by /venue/calendar)
        if (currentTab === 'calendar') {
            if (path.includes('/calendar') || path.includes('tab=calendar')) return true;
            // If we are on the calendar tab, don't highlight the parent 'events' path
            if (pathname.includes('/events') && (path.endsWith('/events') || path.endsWith('/events/'))) return false;
        }

        if (path !== basePath && pathname.startsWith(path)) {
            // If we are on a page with tabs, only highlight the item if it doesn't have a different tab requirement
            const itemUrl = new URL(path, 'http://localhost');
            const itemTab = itemUrl.searchParams.get("tab") || itemUrl.searchParams.get("view");
            if (itemTab && itemTab !== currentTab) return false;
            
            return true;
        }
        return false;
    };

    const toggleExpand = (href: string) => {
        setExpandedItems(prev =>
            prev.includes(href)
                ? prev.filter(h => h !== href)
                : [...prev, href]
        );
    };

    const isExpanded = (href: string) => {
        return expandedItems.includes(href) || pathname.startsWith(href);
    };

    // Filter sections and items based on plan
    const visibleSections = menuSections.map(section => ({
        ...section,
        items: section.items.filter(item => !item.minPlan || PLAN_HIERARCHY[item.minPlan.toLowerCase()] <= currentPlanLevel)
    })).filter(section => section.items.length > 0);

    return (
        <aside className={`relative ${isCollapsed ? "w-[80px]" : "w-[260px]"} bg-[var(--sidebar-bg)] backdrop-blur-xl border-r border-[var(--sidebar-border)] flex flex-col h-full z-50 shrink-0 transition-all duration-300 ease-in-out`}>
            {/* Brand Header */}
            <div className={`flex items-center gap-3 ${isCollapsed ? "px-4 py-3 justify-center" : "px-4 py-3"} mb-2`}>
                <div className="w-8 h-8 min-w-[32px] rounded-xl bg-[var(--accent)] flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {brandLetter}
                </div>
                {!isCollapsed && (
                    <span className="dash-title-card text-[var(--text-primary)] truncate">
                        {brandLabel}
                    </span>
                )}
            </div>

            {/* Navigation - Continuous Flow */}
            <nav className={`flex-1 overflow-y-auto ${isCollapsed ? "px-3" : "px-3"} scrollbar-hide`}>
                {visibleSections.map((section, idx) => (
                    <div key={idx} className={idx > 0 ? "mt-5" : ""}>
                        {section.label && !isCollapsed && (
                             <p className="dash-label-sm text-[var(--text-quaternary)] px-3 mb-1 mt-1">
                                {section.label}
                             </p>
                        )}
                        <div className="space-y-1">
                            {section.items.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.href);
                                const hasChildren = item.children && item.children.length > 0;
                                const expanded = hasChildren && isExpanded(item.href);
                                const isChildActive = hasChildren && item.children?.some(child => pathname === child.href);

                                return (
                                    <div key={item.href}>
                                        <div className="relative">
                                            {hasChildren ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        toggleExpand(item.href);
                                                    }}
                                                    className={`nav-item group w-full ${isChildActive || expanded ? "nav-item-active" : ""}`}
                                                >
                                                    <div className="flex items-center gap-2.5 w-full">
                                                        <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
                                                        <span className="flex-1 text-left">{item.label}</span>
                                                        <ChevronDown className={`h-4 w-4 opacity-60 transition-transform duration-300 ease-out ${expanded ? "rotate-180" : ""}`} />
                                                    </div>
                                                </button>
                                            ) : (
                                                <Link
                                                    href={item.href}
                                                    className={`nav-item group w-full ${active ? "nav-item-active" : ""}`}
                                                >
                                                    <div className="flex items-center gap-2.5 w-full justify-center lg:justify-start">
                                                        <Icon className="w-5 h-5 min-w-[20px] flex-shrink-0" strokeWidth={1.5} />
                                                        {!isCollapsed && <span className="flex-1 text-left">{item.label}</span>}

                                                        {item.badge && !isCollapsed && (
                                                            <span className="px-2 py-0.5 rounded-full bg-[var(--accent-muted)] text-[var(--accent)] dash-label-sm">
                                                                {item.badge}
                                                            </span>
                                                        )}

                                                        {active && isCollapsed && (
                                                            <div className="absolute right-0 w-0.5 h-4 bg-[var(--accent)] rounded-full" />
                                                        )}
                                                    </div>
                                                </Link>
                                            )}
                                        </div>

                                        <AnimatePresence initial={false}>
                                            {hasChildren && expanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="ml-8 mt-1 space-y-0.5">
                                                        {item.children?.map((child) => {
                                                            const childActive = pathname === child.href;
                                                            return (
                                                                <Link
                                                                    key={child.href}
                                                                    href={child.href}
                                                                    className={`block px-3 py-2 rounded-[var(--r-md)] dash-body-sm transition-colors ${childActive
                                                                        ? "text-[var(--accent)] bg-[var(--accent-muted)] font-semibold"
                                                                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-fill)]"
                                                                        }`}
                                                                >
                                                                    {child.label}
                                                                </Link>
                                                            );
                                                        })}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Collapse Toggle — edge handle */}
            {onToggleCollapse && (
                <button
                    onClick={onToggleCollapse}
                    title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                    className="absolute right-0 translate-x-1/2 top-[52px] z-50 w-5 h-5 rounded-full bg-[var(--sidebar-bg)] border border-[var(--sidebar-border)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-text-tertiary/40 shadow-sm transition-all duration-200"
                >
                    <ChevronRight className={`h-3 w-3 transition-transform duration-300 ${isCollapsed ? "" : "rotate-180"}`} />
                </button>
            )}

            {/* Account Footer */}
            <div className={`${isCollapsed ? "px-3 py-4" : "px-4 py-4"} border-t border-[var(--border-subtle)]`}>
                <div className={`flex items-center ${isCollapsed ? "flex-col gap-3" : "gap-3"}`}>
                    <div className="h-8 w-8 min-w-[32px] rounded-full bg-[var(--bg-fill)] flex items-center justify-center text-[var(--text-primary)] font-semibold text-sm shrink-0">
                        {profile?.displayName?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="dash-body-sm font-medium text-[var(--text-primary)] truncate">
                                {profile?.displayName || "Operator"}
                            </p>
                        </div>
                    )}
                    <div className={`flex ${isCollapsed ? "flex-col" : "items-center"} gap-2`}>
                        <ThemeToggleCompact />
                        <button
                            onClick={() => signOut()}
                            className="w-8 h-8 flex items-center justify-center rounded-[var(--r-sm)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)] transition-colors"
                            title="Sign Out"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
}
