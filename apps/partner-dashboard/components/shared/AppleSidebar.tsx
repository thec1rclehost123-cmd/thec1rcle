"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, ChevronDown, ChevronRight } from "lucide-react";
import { useDashboardAuth } from "../providers/DashboardAuthProvider";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ThemeToggleCompact } from "../ThemeToggle";

type MenuItem = {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    href: string;
    children?: { label: string; href: string }[];
};

type MenuSection = {
    items: MenuItem[];
};

interface AppleSidebarProps {
    brandLetter: string;
    brandLabel: string;
    menuSections: MenuSection[];
    basePath: string;
}

export function AppleSidebar({ brandLetter, brandLabel, menuSections, basePath }: AppleSidebarProps) {
    const pathname = usePathname();
    const { signOut, profile } = useDashboardAuth();
    const [expandedItems, setExpandedItems] = useState<string[]>([]);

    const isActive = (path: string) => {
        if (path === basePath && pathname === basePath) return true;
        if (path !== basePath && pathname.startsWith(path)) return true;
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

    return (
        <aside className="w-[280px] bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] flex flex-col h-full overflow-hidden z-50 shrink-0">
            {/* Brand Header */}
            <div className="p-6 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-[var(--text-primary)] flex items-center justify-center text-[var(--text-inverse)] font-bold text-lg shadow-md">
                        {brandLetter}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-[15px] font-bold text-[var(--text-primary)] tracking-tight">THE C1RCLE</h1>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-tertiary)] truncate">
                            {brandLabel} Dashboard
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-6 scrollbar-hide">
                {menuSections.map((section, idx) => (
                    <div key={idx} className="space-y-1">
                        {section.items.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.href);
                            const hasChildren = item.children && item.children.length > 0;
                            const expanded = hasChildren && isExpanded(item.href);
                            const isChildActive = hasChildren && item.children?.some(child => pathname === child.href);

                            return (
                                <div key={item.href}>
                                    {/* Main Nav Item */}
                                    <div className="relative">
                                        <Link
                                            href={hasChildren ? "#" : item.href}
                                            onClick={(e) => {
                                                if (hasChildren) {
                                                    e.preventDefault();
                                                    toggleExpand(item.href);
                                                }
                                            }}
                                            className={`nav-item relative group w-full ${active || isChildActive
                                                ? "nav-item-active"
                                                : ""
                                                }`}
                                        >
                                            {/* Active Indicator */}
                                            {(active || isChildActive) && (
                                                <motion.div
                                                    layoutId="nav-active-bg"
                                                    className="absolute inset-0 bg-[var(--surface-tertiary)] dark:bg-white/[0.08] rounded-xl"
                                                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                                                />
                                            )}

                                            <div className="relative z-10 flex items-center gap-3 w-full">
                                                <Icon className={`nav-icon ${active || isChildActive
                                                    ? "text-[var(--c1rcle-orange)] opacity-100"
                                                    : "text-[var(--text-tertiary)]"
                                                    }`} />
                                                <span className="flex-1 text-left">{item.label}</span>

                                                {hasChildren && (
                                                    <ChevronDown className={`h-4 w-4 text-[var(--text-tertiary)] transition-transform duration-200 ${expanded ? "rotate-180" : ""
                                                        }`} />
                                                )}

                                                {active && !hasChildren && (
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--c1rcle-orange)] shadow-[0_0_8px_var(--c1rcle-orange)]" />
                                                )}
                                            </div>
                                        </Link>
                                    </div>

                                    {/* Submenu */}
                                    <AnimatePresence>
                                        {hasChildren && expanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="ml-10 mt-1 space-y-0.5 py-1">
                                                    {item.children?.map((child) => {
                                                        const childActive = pathname === child.href;
                                                        return (
                                                            <Link
                                                                key={child.href}
                                                                href={child.href}
                                                                className={`block px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all ${childActive
                                                                    ? "text-[var(--c1rcle-orange)] bg-[var(--c1rcle-orange-glow)]"
                                                                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-tertiary)]"
                                                                    }`}
                                                            >
                                                                <span className="flex items-center gap-2">
                                                                    {childActive && (
                                                                        <span className="w-1 h-1 rounded-full bg-[var(--c1rcle-orange)]" />
                                                                    )}
                                                                    {child.label}
                                                                </span>
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

                        {/* Section Divider */}
                        {idx < menuSections.length - 1 && (
                            <div className="pt-4">
                                <div className="h-px bg-[var(--border-subtle)]" />
                            </div>
                        )}
                    </div>
                ))}
            </nav>

            {/* Account Footer */}
            <div className="p-4 border-t border-[var(--border-subtle)] space-y-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                {/* User Info Card */}
                <div className="flex items-center gap-3 px-3 py-3 bg-[var(--surface-tertiary)] dark:bg-white/[0.04] rounded-xl border border-[var(--border-subtle)]">
                    <div className="h-9 w-9 rounded-lg bg-[var(--text-primary)] flex items-center justify-center text-[var(--text-inverse)] text-[13px] font-bold">
                        {profile?.displayName?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                            {profile?.displayName || "Operator"}
                        </p>
                        <p className="text-[10px] text-[var(--text-tertiary)] truncate">
                            {profile?.email || ""}
                        </p>
                    </div>
                    <ThemeToggleCompact />
                </div>

                {/* Sign Out */}
                <button
                    onClick={() => signOut()}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[var(--text-tertiary)] hover:text-[var(--state-error)] hover:bg-[var(--state-error-bg)] transition-all group text-[14px] font-medium"
                >
                    <LogOut className="w-4 h-4 group-hover:text-[var(--state-error)]" />
                    <span>Sign Out</span>
                </button>
            </div>
        </aside>
    );
}
