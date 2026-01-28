"use client";

import { useState } from "react";
import {
    LayoutDashboard,
    CalendarDays,
    GlassWater,
    Users,
    ClipboardList,
    ShieldCheck,
    Settings,
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
    TrendingUp
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboardAuth } from "../providers/DashboardAuthProvider";
import { cleanJargon } from "@/lib/utils/jargon";
import { motion, AnimatePresence } from "framer-motion";

const MENU_GROUPS = [
    {
        label: "Core",
        icon: Zap,
        collapsible: false,
        items: [
            { label: "Overview", href: "/venue", icon: LayoutDashboard, minPlan: "basic", badge: null },
            { label: "Analytics", href: "/venue/analytics", icon: BarChart3, minPlan: "basic", badge: "new" },
        ]
    },
    {
        label: "Events",
        icon: GlassWater,
        collapsible: true,
        items: [
            { label: "My Events", href: "/venue/events", icon: GlassWater, minPlan: "basic", badge: null },
            { label: "Create Event", href: "/venue/create", icon: Sparkles, minPlan: "basic", badge: null },
            { label: "Calendar", href: "/venue/calendar", icon: CalendarDays, minPlan: "basic", badge: null },
        ]
    },
    {
        label: "Operations",
        icon: ShieldCheck,
        collapsible: true,
        items: [
            { label: "Connections", href: "/venue/connections", icon: Handshake, minPlan: "basic", badge: null },
            { label: "Staff", href: "/venue/staff", icon: Users, minPlan: "basic", badge: null },
            { label: "Registers", href: "/venue/registers", icon: ClipboardList, minPlan: "silver", badge: null },
            { label: "Security", href: "/venue/security", icon: ShieldCheck, minPlan: "silver", badge: null },
            { label: "Tables", href: "/venue/tables", icon: Armchair, minPlan: "gold", badge: null },
        ]
    },
    {
        label: "Presence",
        icon: TrendingUp,
        collapsible: true,
        items: [
            { label: "Venue Page", href: "/venue/page-management", icon: Building2, minPlan: "basic", badge: null },
            { label: "Digital Menu", href: "/venue/menu", icon: Utensils, minPlan: "basic", badge: null },
        ]
    },
    {
        label: "Finance",
        icon: Banknote,
        collapsible: true,
        items: [
            { label: "Payouts", href: "/venue/payouts", icon: Banknote, minPlan: "basic", badge: null },
            { label: "Settings", href: "/venue/settings", icon: Settings, minPlan: "basic", badge: null },
        ]
    }
];

const PLAN_HIERARCHY: Record<string, number> = {
    'basic': 0,
    'silver': 1,
    'gold': 2,
    'diamond': 3
};

const PLAN_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
    'basic': { bg: 'bg-slate-500/10', text: 'text-slate-500', glow: '' },
    'silver': { bg: 'bg-slate-400/10', text: 'text-slate-400', glow: 'shadow-[0_0_10px_rgba(148,163,184,0.3)]' },
    'gold': { bg: 'bg-amber-500/10', text: 'text-amber-500', glow: 'shadow-[0_0_10px_rgba(245,158,11,0.3)]' },
    'diamond': { bg: 'bg-violet-500/10', text: 'text-violet-500', glow: 'shadow-[0_0_10px_rgba(139,92,246,0.4)]' }
};

export function VenueSidebar({ className = "" }: { className?: string }) {
    const pathname = usePathname();
    const { signOut, profile, subscriptionPlan } = useDashboardAuth();
    const [expandedSections, setExpandedSections] = useState<string[]>(["Core", "Events"]);

    const currentPlanLevel = PLAN_HIERARCHY[subscriptionPlan || 'basic'] ?? 0;
    const planStyle = PLAN_COLORS[subscriptionPlan || 'basic'];

    const isActive = (path: string) => {
        if (path === '/venue' && pathname === '/venue') return true;
        if (path !== '/venue' && pathname.startsWith(path)) return true;
        return false;
    };

    const toggleSection = (label: string) => {
        setExpandedSections(prev =>
            prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
        );
    };

    const isExpanded = (label: string) => expandedSections.includes(label);

    return (
        <aside className={`flex flex-col h-full bg-[#0D0D0F] w-[260px] shrink-0 ${className}`}>
            {/* Header / Brand - Premium Dark Style */}
            <div className="p-5 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                    {/* Glowing Logo Container */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 rounded-xl blur-lg" />
                        <div className="relative h-11 w-11 rounded-xl bg-gradient-to-br from-[#1a1a1f] to-[#0f0f12] flex items-center justify-center border border-white/10 shadow-lg">
                            <span className="text-lg font-black bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">C</span>
                        </div>
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="font-semibold text-white text-sm truncate leading-tight">
                            {profile?.activeMembership?.partnerName || "THE C1RCLE"}
                        </h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Venue Dashboard</span>
                        </div>
                    </div>
                    {/* Plan Badge */}
                    <div className={`px-2 py-1 rounded-md ${planStyle.bg} ${planStyle.glow} border border-white/5`}>
                        <div className="flex items-center gap-1">
                            <Crown className={`h-3 w-3 ${planStyle.text}`} />
                            <span className={`text-[9px] font-bold uppercase tracking-wide ${planStyle.text}`}>
                                {subscriptionPlan || 'Basic'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
                {MENU_GROUPS.map((group, idx) => {
                    const visibleItems = group.items.filter(item => PLAN_HIERARCHY[item.minPlan] <= currentPlanLevel);
                    if (visibleItems.length === 0) return null;

                    const GroupIcon = group.icon;
                    const expanded = !group.collapsible || isExpanded(group.label);
                    const hasActiveItem = visibleItems.some(item => isActive(item.href));

                    return (
                        <div key={idx} className="mb-1">
                            {/* Section Header */}
                            {group.collapsible ? (
                                <button
                                    onClick={() => toggleSection(group.label)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 group
                                        ${hasActiveItem ? 'text-white/90' : 'text-white/40 hover:text-white/60 hover:bg-white/[0.02]'}`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <GroupIcon className="h-3.5 w-3.5" />
                                        <span className="text-[11px] font-semibold uppercase tracking-wider">{group.label}</span>
                                    </div>
                                    <motion.div
                                        animate={{ rotate: expanded ? 180 : 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    </motion.div>
                                </button>
                            ) : (
                                <div className="flex items-center gap-2.5 px-3 py-2 text-white/40">
                                    <GroupIcon className="h-3.5 w-3.5" />
                                    <span className="text-[11px] font-semibold uppercase tracking-wider">{group.label}</span>
                                </div>
                            )}

                            {/* Section Items */}
                            <AnimatePresence initial={false}>
                                {expanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2, ease: "easeInOut" }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mt-1 space-y-0.5 pl-2">
                                            {visibleItems.map((item) => {
                                                const Icon = item.icon;
                                                const active = isActive(item.href);
                                                return (
                                                    <Link
                                                        key={item.href}
                                                        href={item.href}
                                                        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group
                                                            ${active
                                                                ? "text-white bg-white/[0.08]"
                                                                : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
                                                            }`}
                                                    >
                                                        {/* Active Indicator Line */}
                                                        {active && (
                                                            <motion.div
                                                                layoutId="activeIndicator"
                                                                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-gradient-to-b from-violet-400 to-fuchsia-500"
                                                                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                                                            />
                                                        )}

                                                        {/* Icon Container */}
                                                        <div className={`relative flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200
                                                            ${active
                                                                ? "bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20"
                                                                : "bg-white/[0.03] group-hover:bg-white/[0.06]"
                                                            }`}
                                                        >
                                                            <Icon className={`h-3.5 w-3.5 transition-all ${active ? "text-violet-400" : ""}`} />
                                                        </div>

                                                        {/* Label */}
                                                        <span className="text-[13px] font-medium">{item.label}</span>

                                                        {/* Badge */}
                                                        {item.badge && (
                                                            <span className="ml-auto px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-violet-500/20 text-violet-400 border border-violet-500/20">
                                                                {item.badge}
                                                            </span>
                                                        )}

                                                        {/* Active Glow */}
                                                        {active && (
                                                            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-violet-500/5 to-transparent pointer-events-none" />
                                                        )}
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
            </nav>

            {/* Upgrade CTA - Only show for non-diamond plans */}
            {subscriptionPlan !== 'diamond' && (
                <div className="px-3 pb-3">
                    <div className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/10 to-violet-500/5 border border-white/[0.06]">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-violet-500/20 to-transparent rounded-full blur-2xl" />
                        <div className="relative">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="h-4 w-4 text-violet-400" />
                                <span className="text-xs font-bold text-white/90">C1RCLE PRO</span>
                            </div>
                            <p className="text-[11px] text-white/50 leading-relaxed mb-3">
                                Unlock advanced analytics, host management & more
                            </p>
                            <button className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-xs font-semibold hover:from-violet-400 hover:to-fuchsia-400 transition-all shadow-lg shadow-violet-500/20">
                                Upgrade Now
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer / User Profile */}
            <div className="p-3 border-t border-white/[0.06]">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer group">
                    {/* Avatar with Status */}
                    <div className="relative">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 flex items-center justify-center font-semibold text-white text-sm border border-white/10">
                            {profile?.displayName?.[0]?.toUpperCase() || 'A'}
                        </div>
                        {/* Online indicator */}
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0D0D0F]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/90 truncate">
                            {profile?.displayName || 'Administrator'}
                        </p>
                        <p className="text-[10px] text-white/40 truncate">
                            {profile?.email || 'admin@venue.com'}
                        </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/40 transition-colors" />
                </div>

                {/* Sign Out Button */}
                <button
                    onClick={() => signOut()}
                    className="mt-2 flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all text-xs font-medium"
                >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
