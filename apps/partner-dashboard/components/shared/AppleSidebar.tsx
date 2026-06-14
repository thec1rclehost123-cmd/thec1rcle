"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LogOut, ChevronDown, ChevronRight } from "lucide-react";
import { useDashboardAuth } from "../providers/DashboardAuthProvider";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ThemeToggleCompact } from "../ThemeToggle";

type MenuItem = {
    icon: React.ComponentType<{ className?: string }>;
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
        <aside className={`relative ${isCollapsed ? "w-[80px]" : "w-[280px]"} bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] flex flex-col h-full z-50 shrink-0 transition-all duration-300 ease-in-out`}>
            {/* Brand Header */}
            <div className={`p-6 ${isCollapsed ? "px-4" : "p-7"}`}>
                <div className="flex items-center gap-4">
                    <div
                        className="w-11 h-11 min-w-[44px] rounded-2xl flex items-center justify-center font-black text-[20px] shrink-0"
                        style={{
                            background: "var(--c1rcle-orange)",
                            color: "#fff",
                        }}
                    >
                        {brandLetter}
                    </div>
                    {!isCollapsed && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex-1 min-w-0"
                        >
                            <h1 className="text-[17px] font-bold text-text-primary tracking-tight leading-tight uppercase">THE C1RCLE</h1>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-tertiary truncate mt-0.5 opacity-60">
                                {brandLabel} Dashboard
                            </p>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Navigation - Continuous Flow */}
            <nav className={`flex-1 overflow-y-auto ${isCollapsed ? "px-3" : "px-5"} space-y-1 scrollbar-hide`}>
                {visibleSections.map((section, idx) => (
                    <div key={idx} className="pt-0">
                        {section.label && !isCollapsed && (
                             <p className="px-5 pb-2 pt-4 text-[10px] font-black text-text-tertiary uppercase tracking-[0.25em] opacity-30">
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
                                                    className={`nav-item relative group w-full ${isChildActive || expanded ? "text-text-primary" : ""}`}
                                                >
                                                    <div className="relative z-10 flex items-center gap-4 w-full">
                                                        <Icon className={`h-6 w-6 transition-colors ${isChildActive || expanded ? "text-text-primary" : "text-text-tertiary/60 group-hover:text-text-primary/70"}`} />
                                                        <span className="flex-1 text-left text-[20px] font-semibold leading-none">{item.label}</span>
                                                        <ChevronDown className={`h-4 w-4 text-text-tertiary transition-transform duration-300 ease-out ${expanded ? "rotate-180" : ""}`} />
                                                    </div>
                                                </button>
                                            ) : (
                                                <Link
                                                    href={item.href}
                                                    className={`nav-item relative group w-full ${active ? "nav-item-active" : ""}`}
                                                >
                                                    {active && (
                                                        <motion.div
                                                            layoutId="nav-active-bg"
                                                            className="absolute inset-0 bg-surface-tertiary dark:bg-white/[0.06] rounded-2xl"
                                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                        />
                                                    )}

                                                    <div className="relative z-10 flex items-center gap-4 w-full justify-center lg:justify-start">
                                                        <Icon className={`h-6 w-6 min-w-[24px] transition-colors ${active ? "text-text-primary" : "text-text-tertiary/60 group-hover:text-text-primary/70"}`} />
                                                        {!isCollapsed && <span className="flex-1 text-left text-[20px] leading-none">{item.label}</span>}
                                                        
                                                        {item.badge && !isCollapsed && (
                                                            <span className="px-2 py-0.5 rounded-full bg-c1rcle-orange/10 text-c1rcle-orange text-[9px] font-black uppercase tracking-widest ring-1 ring-c1rcle-orange/20">
                                                                {item.badge}
                                                            </span>
                                                        )}

                                                        {active && !isCollapsed && (
                                                            <div className="w-1.5 h-1.5 rounded-full bg-c1rcle-orange shadow-[0_0_12px_var(--c1rcle-orange)]" />
                                                        )}

                                                        {active && isCollapsed && (
                                                            <div className="absolute left-0 w-0.5 h-5 bg-c1rcle-orange rounded-full" />
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
                                                    <div className="ml-7 pl-6 mt-1 space-y-1 border-l-2 border-border-subtle/30">
                                                        {item.children?.map((child) => {
                                                            const childActive = pathname === child.href;
                                                            return (
                                                                <Link
                                                                    key={child.href}
                                                                    href={child.href}
                                                                    className={`block px-4 py-3 rounded-xl text-[15px] font-semibold transition-all ${childActive
                                                                        ? "text-[var(--v-text-primary)] bg-[var(--v-border)]"
                                                                        : "text-[var(--v-text-secondary)] hover:text-[var(--v-text-primary)] hover:bg-[var(--v-border)]"
                                                                        }`}
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <span>{child.label}</span>
                                                                        {childActive && (
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-text-primary" />
                                                                        )}
                                                                    </div>
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
                    className="absolute right-0 translate-x-1/2 top-[52px] z-50 w-5 h-5 rounded-full bg-[var(--sidebar-bg)] border border-[var(--sidebar-border)] flex items-center justify-center text-text-tertiary hover:text-text-primary hover:border-text-tertiary/40 shadow-sm transition-all duration-200"
                >
                    <ChevronRight className={`h-3 w-3 transition-transform duration-300 ${isCollapsed ? "" : "rotate-180"}`} />
                </button>
            )}

            {/* Account Footer */}
            <div className={`p-4 ${isCollapsed ? "px-2" : "p-6"} border-t border-border-subtle bg-surface-tertiary/10`}>
                <div className={`flex items-center ${isCollapsed ? "flex-col gap-4" : "gap-4"} mb-2`}>
                    <div className="h-10 w-10 min-w-[40px] rounded-full bg-surface-secondary border border-border-subtle flex items-center justify-center text-text-primary font-bold text-base shadow-inner shrink-0">
                        {profile?.displayName?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-bold text-text-primary truncate">
                                {profile?.displayName || "Operator"}
                            </p>
                        </div>
                    )}
                    <div className={`flex ${isCollapsed ? "flex-col" : "items-center"} gap-2`}>
                        <ThemeToggleCompact />
                        <button
                            onClick={() => signOut()}
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all"
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
