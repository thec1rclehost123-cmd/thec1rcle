"use client";

import { useState } from "react";
import {
    LayoutDashboard,
    CalendarDays,
    GlassWater,
    Users,
    ClipboardList,
    ShieldCheck,
    LogOut,
    Building2,
    Armchair,
    UserCheck,
    Handshake,
    ChevronDown,
    ChevronRight,
    Sparkles,
    Utensils,
    Banknote,
    Crown,
    Zap,
    BarChart3,
    TrendingUp,
    ReceiptText,
    CreditCard,
    Activity,
    Radio,
    PanelLeftClose,
    PanelLeftOpen,
    Moon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboardAuth } from "../providers/DashboardAuthProvider";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeToggleCompact } from "../ThemeToggle";

// ── Types ─────────────────────────────────────────────────────────────────────

type NavItem = {
    label: string;
    href: string;
    icon: React.ElementType;
    minPlan: string;
    badge: string | null;
    tabKey?: string;
};

type AnalyticsSubGroup = {
    key: string;
    label: string;
    items: NavItem[];
};

type FlatGroup = {
    label: string;
    icon: React.ElementType;
    collapsible: boolean;
    items: NavItem[];
    subGroups?: never;
};

type NestedGroup = {
    label: string;
    icon: React.ElementType;
    collapsible: boolean;
    items?: never;
    subGroups: AnalyticsSubGroup[];
};

type MenuGroup = FlatGroup | NestedGroup;

// ── Analytics sub-navigation ──────────────────────────────────────────────────
//
// Overview  → day-to-day checks a venue owner makes after every event
// Advanced  → strategic / periodic deep-dives, not needed every morning
//
const ANALYTICS_SUB: AnalyticsSubGroup[] = [
    {
        key: "analytics-operational",
        label: "Operations (Daily)",
        items: [
            { label: "Dashboard",   href: "/venue/analytics/overview",   icon: LayoutDashboard, minPlan: "basic", badge: null,   tabKey: "analytics" },
            { label: "Live Event",  href: "/venue/analytics/live",       icon: Radio,           minPlan: "basic", badge: "Live", tabKey: "analytics" },
            { label: "Pace & Goals",href: "/venue/analytics/reach",      icon: TrendingUp,      minPlan: "basic", badge: null,   tabKey: "analytics" },
        ],
    },
    {
        key: "analytics-premium",
        label: "Strategic (Premium)",
        items: [
            { label: "Revenue Waterfall",     href: "/venue/analytics/revenue",     icon: Banknote,   minPlan: "silver",  badge: null, tabKey: "analytics" },
            { label: "Audience Intelligence", href: "/venue/analytics/audience",    icon: Users,      minPlan: "silver",  badge: null, tabKey: "analytics" },
            { label: "Gate Performance",      href: "/venue/analytics/ops",         icon: ShieldCheck,minPlan: "gold",    badge: null, tabKey: "analytics" },
            { label: "ROI & Partners",        href: "/venue/analytics/attribution", icon: Handshake,  minPlan: "gold",    badge: null, tabKey: "analytics" },
            { label: "AI Predictions",        href: "/venue/analytics/strategy",    icon: Sparkles,   minPlan: "diamond", badge: "AI", tabKey: "analytics" },
        ],
    },
];

// ── Full menu ──────────────────────────────────────────────────────────────────

const MENU_GROUPS: MenuGroup[] = [
    {
        label: "Core",
        icon: Zap,
        collapsible: false,
        items: [
            { label: "Overview", href: "/venue", icon: LayoutDashboard, minPlan: "basic", badge: null, tabKey: "overview" },
        ],
    },
    {
        label: "Analytics",
        icon: BarChart3,
        collapsible: true,
        subGroups: ANALYTICS_SUB,
    },
    {
        label: "Events",
        icon: GlassWater,
        collapsible: true,
        items: [
            { label: "My Events",        href: "/venue/events",           icon: GlassWater,  minPlan: "basic",  badge: null, tabKey: "events"   },
            { label: "Finance Overview", href: "/venue/finance",          icon: Banknote,    minPlan: "basic",  badge: null, tabKey: "finance"  },
            { label: "Ledger",           href: "/venue/finance/ledger",   icon: ReceiptText, minPlan: "basic",  badge: null, tabKey: "finance"  },
            { label: "Payout Settings",  href: "/venue/finance/payouts",  icon: CreditCard,  minPlan: "basic",  badge: null, tabKey: "finance"  },
            { label: "Reports",          href: "/venue/finance/reports",  icon: TrendingUp,  minPlan: "basic",  badge: null, tabKey: "finance"  },
            { label: "Create Event",     href: "/venue/create/select-venue", icon: Sparkles,    minPlan: "basic",  badge: null, tabKey: "events"   },
            { label: "Calendar",         href: "/venue/calendar",         icon: CalendarDays,minPlan: "basic",  badge: null, tabKey: "calendar" },
        ],
    },
    {
        label: "Operations",
        icon: ShieldCheck,
        collapsible: true,
        items: [
            { label: "Connections", href: "/venue/connections", icon: Handshake,    minPlan: "basic",  badge: null, tabKey: "partnerships" },
            { label: "Staff",       href: "/venue/staff",       icon: Users,        minPlan: "basic",  badge: null, tabKey: "staff"        },
            { label: "Registers",   href: "/venue/registers",   icon: ClipboardList,minPlan: "silver", badge: null, tabKey: "registers"    },
            { label: "Security",    href: "/venue/security",    icon: ShieldCheck,  minPlan: "silver", badge: null, tabKey: "guest_ops"    },
            { label: "Tables",      href: "/venue/tables",      icon: Armchair,     minPlan: "gold",   badge: null, tabKey: "guest_ops"    },
        ],
    },
    {
        label: "Presence",
        icon: TrendingUp,
        collapsible: true,
        items: [
            { label: "Venue Page",   href: "/venue/page-management", icon: Building2, minPlan: "basic", badge: null, tabKey: "page_management" },
            { label: "Digital Menu", href: "/venue/menu",            icon: Utensils,  minPlan: "basic", badge: null, tabKey: "page_management" },
        ],
    },
];

const PLAN_HIERARCHY: Record<string, number> = {
    basic: 0, silver: 1, gold: 2, diamond: 3,
};

const PLAN_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
    basic:   { bg: "bg-surface-tertiary0/10", text: "text-text-tertiary", glow: "" },
    silver:  { bg: "bg-slate-400/10",         text: "text-text-tertiary", glow: "shadow-[0_0_10px_rgba(148,163,184,0.3)]" },
    gold:    { bg: "bg-amber-500/10",          text: "text-amber-500",     glow: "shadow-[0_0_10px_rgba(245,158,11,0.3)]" },
    diamond: { bg: "bg-violet-500/10",         text: "text-violet-500",    glow: "shadow-[0_0_10px_rgba(139,92,246,0.4)]" },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function VenueSidebar({
    className = "",
    isCollapsed = false,
    onToggleCollapse
}: {
    className?: string;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}) {
    const pathname = usePathname();
    const { signOut, profile, subscriptionPlan, tabVisibility } = useDashboardAuth();

    // Top-level section collapse state — "Core" + "Analytics" both open by default
    const [expandedSections, setExpandedSections] = useState<string[]>(["Core", "Analytics", "Events"]);
    // Analytics sub-group collapse state — both open by default
    const [expandedSubSections, setExpandedSubSections] = useState<string[]>(["analytics-operational", "analytics-premium"]);

    const currentPlanLevel = PLAN_HIERARCHY[subscriptionPlan || "basic"] ?? 0;
    const planStyle = PLAN_COLORS[subscriptionPlan || "basic"];

    // Returns true if the item should be visible for this user's role.
    // tabVisibility null means owner (show everything).
    const isTabAllowed = (item: NavItem) => {
        if (!tabVisibility) return true;
        if (!item.tabKey) return true;
        return tabVisibility[item.tabKey] === true;
    };

    const isActive = (path: string) => {
        if (path === "/venue" && pathname === "/venue") return true;
        if (path !== "/venue" && pathname.startsWith(path)) return true;
        return false;
    };

    const toggleSection = (label: string) =>
        setExpandedSections(prev =>
            prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
        );

    const toggleSubSection = (key: string) =>
        setExpandedSubSections(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );

    const isExpanded = (label: string) => expandedSections.includes(label);

    // ── Shared nav item renderer ───────────────────────────────────────────────
    const renderNavItem = (item: NavItem) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
            <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-4 px-3 py-2.5 rounded-xl transition-all duration-300 group
                    ${active
                        ? "text-white bg-white/[0.03]"
                        : "text-white/50 hover:text-white/90 hover:bg-white/[0.02]"
                    }`}
            >
                {/* Active indicator */}
                {active && (
                    <motion.div
                        layoutId="activeIndicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[4px] h-6 rounded-full bg-gradient-to-b from-orange-500 to-rose-600 shadow-[0_0_12px_rgba(244,74,34,0.4)]"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                    />
                )}

                {/* Icon */}
                <div className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-300 shrink-0
                    ${active
                        ? "bg-gradient-to-br from-orange-500/20 to-rose-600/20 border border-orange-500/20"
                        : "bg-white/[0.02] group-hover:bg-white/[0.05]"
                    }`}
                >
                    <Icon className={`h-4 w-4 transition-all ${active ? "text-orange-500" : "opacity-70 group-hover:opacity-100"}`} />
                </div>

                {/* Label */}
                {!isCollapsed && (
                    <span className={`text-[14px] font-black tracking-tight ${active ? "text-white" : ""}`}>
                        {item.label}
                    </span>
                )}

                {/* Badge — "Live" uses red pulse, others use orange */}
                {item.badge && (
                    item.badge === "Live" ? (
                        <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-70" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                            </span>
                            <span className="text-[8px] font-black uppercase text-red-400">Live</span>
                        </span>
                    ) : (
                        <span className="ml-auto px-2 py-0.5 text-[8px] font-black uppercase rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/20">
                            {item.badge}
                        </span>
                    )
                )}

                {/* Active glow overlay */}
                {active && (
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-500/5 to-transparent pointer-events-none" />
                )}
            </Link>
        );
    };

    return (
        <aside className={`flex flex-col h-full bg-[#0D0D0F] ${isCollapsed ? "w-[80px]" : "w-[260px]"} shrink-0 transition-all duration-300 ease-in-out ${className}`}>
            {/* Header / Brand */}
            <div className={`p-5 border-b border-white/[0.06] ${isCollapsed ? "px-3" : "p-5"}`}>
                <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/30 to-rose-600/20 rounded-xl blur-lg" />
                        <div className="relative h-12 w-12 rounded-xl bg-gradient-to-br from-[#1a1a1f] to-[#0f0f12] flex items-center justify-center border border-white/10 shadow-xl overflow-hidden">
                            {(profile?.activeMembership as any)?.partnerLogo ? (
                                <img src={(profile.activeMembership as any).partnerLogo} alt="Logo" className="h-full w-full object-cover" />
                            ) : (
                                <span className="text-xl font-black bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
                                    {(profile?.activeMembership as any)?.partnerName?.[0] || "C"}
                                </span>
                            )}
                        </div>
                    </div>
                    {!isCollapsed && (
                        <div className="min-w-0 flex-1">
                            <h1 className="font-black text-text-primary text-sm tracking-tight truncate leading-tight">
                                {profile?.activeMembership?.partnerName || "THE C1RCLE"}
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-orange-500/60 font-black uppercase tracking-widest">Venue Host</span>
                            </div>
                        </div>
                    )}
                </div>
                {onToggleCollapse && (
                    <div className={`flex mt-4 ${isCollapsed ? "justify-center" : "justify-end"}`}>
                        <button
                            onClick={onToggleCollapse}
                            className="p-1.5 rounded-lg bg-white/[0.03] border border-white/5 text-text-primary/40 hover:text-text-primary hover:bg-white/[0.08] transition-all"
                        >
                            {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                        </button>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
                {MENU_GROUPS.map((group, idx) => {
                    const GroupIcon = group.icon;

                    // ── Nested group (Analytics) ─────────────────────────────
                    if (group.subGroups) {
                        const hasAnyVisible = group.subGroups.some(sg =>
                            sg.items.some(item => PLAN_HIERARCHY[item.minPlan] <= currentPlanLevel)
                        );
                        if (!hasAnyVisible) return null;

                        const hasActiveItem = group.subGroups.some(sg =>
                            sg.items.some(item => isActive(item.href))
                        );
                        const expanded = isExpanded(group.label);

                        return (
                            <div key={idx} className="mb-1">
                                {/* Group header */}
                                <button
                                    onClick={() => toggleSection(group.label)}
                                    className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-300 group
                                        ${hasActiveItem ? "text-white" : "text-white/30 hover:text-white/60"}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <GroupIcon className={`h-4 w-4 ${hasActiveItem ? "text-orange-500" : ""}`} />
                                        <span className="text-[12px] font-black uppercase tracking-[0.15em]">{group.label}</span>
                                    </div>
                                    <motion.div
                                        animate={{ rotate: expanded ? 180 : 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <ChevronDown className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100" />
                                    </motion.div>
                                </button>

                                {/* Sub-groups */}
                                <AnimatePresence initial={false}>
                                    {expanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2, ease: "easeInOut" }}
                                            className="overflow-hidden"
                                        >
                                            <div className="mt-0.5 space-y-1 pl-2">
                                                {group.subGroups.map((sg) => {
                                                    const visibleItems = sg.items.filter(
                                                        item => PLAN_HIERARCHY[item.minPlan] <= currentPlanLevel && isTabAllowed(item)
                                                    );
                                                    if (visibleItems.length === 0) return null;

                                                    const sgExpanded = expandedSubSections.includes(sg.key);
                                                    const sgHasActive = visibleItems.some(item => isActive(item.href));

                                                    return (
                                                        <div key={sg.key}>
                                                            {/* Sub-group toggle */}
                                                            <button
                                                                onClick={() => toggleSubSection(sg.key)}
                                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200
                                                                    ${sgHasActive ? "text-white/60" : "text-white/20 hover:text-white/40"}`}
                                                            >
                                                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                                                                    {sg.label}
                                                                </span>
                                                                <motion.div
                                                                    animate={{ rotate: sgExpanded ? 180 : 0 }}
                                                                    transition={{ duration: 0.15 }}
                                                                >
                                                                    <ChevronDown className="h-3 w-3 opacity-50" />
                                                                </motion.div>
                                                            </button>

                                                            {/* Sub-group items */}
                                                            <AnimatePresence initial={false}>
                                                                {sgExpanded && (
                                                                    <motion.div
                                                                        initial={{ height: 0, opacity: 0 }}
                                                                        animate={{ height: "auto", opacity: 1 }}
                                                                        exit={{ height: 0, opacity: 0 }}
                                                                        transition={{ duration: 0.15, ease: "easeInOut" }}
                                                                        className="overflow-hidden"
                                                                    >
                                                                        <div className="mt-0.5 space-y-0.5 pl-2">
                                                                            {visibleItems.map(renderNavItem)}
                                                                        </div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    }

                        // ── Flat group (Core, Events, Operations, Presence) ───────
                        const visibleItems = (group.items ?? []).filter(
                            item => PLAN_HIERARCHY[item.minPlan] <= currentPlanLevel && isTabAllowed(item)
                        );
                        if (visibleItems.length === 0) return null;

                        const expanded = (!group.collapsible || isExpanded(group.label)) && !isCollapsed;
                        const hasActiveItem = visibleItems.some(item => isActive(item.href));

                        return (
                            <div key={idx} className="mb-1">
                                {/* Section header */}
                                {group.collapsible && !isCollapsed ? (
                                    <button
                                        onClick={() => toggleSection(group.label)}
                                        className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-300 group
                                            ${hasActiveItem ? "text-text-primary" : "text-text-primary/30 hover:text-text-primary/60"}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <GroupIcon className={`h-4 w-4 ${hasActiveItem ? "text-orange-500" : ""}`} />
                                            <span className="text-[12px] font-black uppercase tracking-[0.15em]">{group.label}</span>
                                        </div>
                                        <motion.div
                                            animate={{ rotate: expanded ? 180 : 0 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <ChevronDown className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100" />
                                        </motion.div>
                                    </button>
                                ) : (
                                    <div className={`flex items-center gap-3 px-3 py-3 text-text-primary/30 ${isCollapsed ? "justify-center" : ""}`}>
                                        <GroupIcon className="h-4 w-4" />
                                        {!isCollapsed && <span className="text-[12px] font-black uppercase tracking-[0.15em]">{group.label}</span>}
                                    </div>
                                )}

                                {/* Section items */}
                                <AnimatePresence initial={false}>
                                    {expanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2, ease: "easeInOut" }}
                                            className="overflow-hidden"
                                        >
                                            <div className="mt-0.5 space-y-0.5 pl-4">
                                                {visibleItems.map(renderNavItem)}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                {isCollapsed && hasActiveItem && !expanded && (
                                    <div className="mt-0.5 space-y-0.5">
                                        {visibleItems.filter(i => isActive(i.href)).map(renderNavItem)}
                                    </div>
                                )}
                            </div>
                        );
                })}
            </nav>

            {/* Upgrade CTA */}
            {subscriptionPlan !== "diamond" && !isCollapsed && (
                <div className="px-4 pb-4">
                    <div className="relative overflow-hidden rounded-[1.5rem] p-5 bg-gradient-to-br from-orange-500/10 via-rose-500/5 to-transparent border border-white/[0.06] group/cta">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-orange-500/20 to-transparent rounded-full blur-2xl group-hover/cta:scale-125 transition-transform duration-500" />
                        <div className="relative">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="h-4 w-4 text-orange-500" />
                                <span className="text-[11px] font-black text-text-primary tracking-widest uppercase">C1RCLE PRO</span>
                            </div>
                            <p className="text-[11px] text-text-primary/40 leading-relaxed font-medium mb-4">
                                Unlock advanced analytics, host management & connections
                            </p>
                            <button className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 text-white text-[11px] font-black uppercase tracking-wider hover:scale-[1.02] transition-all shadow-xl shadow-orange-500/20">
                                Upgrade Now
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer / User */}
            <div className={`p-3 border-t border-white/[0.06] ${isCollapsed ? "px-2" : "p-3"}`}>
                <div className={`flex items-center gap-3 p-2 rounded-xl bg-surface-elevated/[0.02] hover:bg-surface-elevated/[0.04] transition-all cursor-pointer group ${isCollapsed ? "flex-col" : ""}`}>
                    <div className="relative shrink-0">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-rose-600/20 flex items-center justify-center font-black text-text-primary text-sm border border-white/5">
                            {profile?.displayName?.[0]?.toUpperCase() || "A"}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-[3px] border-[#0D0D0F]" />
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary/90 truncate">
                                {profile?.displayName || "Administrator"}
                            </p>
                            <p className="text-[10px] text-text-primary/40 truncate">
                                {profile?.email || "admin@venue.com"}
                            </p>
                        </div>
                    )}
                    {!isCollapsed && <ChevronRight className="h-4 w-4 text-text-primary/20 group-hover:text-text-primary/40 transition-colors" />}
                    
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
