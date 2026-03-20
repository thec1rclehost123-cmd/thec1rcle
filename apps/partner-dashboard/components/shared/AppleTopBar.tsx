"use client";

import { useEffect, useState } from "react";
// useEffect retained for keyboard shortcut listener
import { Search, X, Command, ChevronDown, LogOut } from "lucide-react";
import Link from "next/link";
import { NotificationCenter } from "./NotificationCenter";
import { useDashboardAuth } from "../providers/DashboardAuthProvider";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface AppleTopBarProps {
    title?: string;
    primaryAction?: {
        label: string;
        href: string;
        icon?: React.ComponentType<{ className?: string }>;
    };
}

export function AppleTopBar({ title, primaryAction }: AppleTopBarProps) {
    const { profile, signOut } = useDashboardAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [searchOpen, setSearchOpen] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Determine role context
    const roleContext = pathname.startsWith('/venue') ? 'Venue' :
        pathname.startsWith('/host') ? 'Host' :
            pathname.startsWith('/promoter') ? 'Promoter' : '';

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd/Ctrl + K for search
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(true);
            }
            // Also support / for search
            if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
                e.preventDefault();
                setSearchOpen(true);
            }
            if (e.key === 'Escape') {
                setSearchOpen(false);
                setSearchQuery("");
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <>
            <header className="h-14 bg-[var(--topbar-bg)] backdrop-blur-xl border-b border-[var(--topbar-border)] sticky top-0 z-40 px-5 lg:px-6 flex items-center justify-between">
                {/* Left - Breadcrumb */}
                <div className="flex items-center gap-2">
                    <span className="dash-body font-medium text-[var(--text-primary)]">
                        {title || roleContext || "Dashboard"}
                    </span>
                </div>

                {/* Right - Search & Actions */}
                <div className="flex items-center gap-2">
                    {/* Primary CTA — sm variant, does not dominate chrome */}
                    {primaryAction && (
                        <Link
                            href={primaryAction.href}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-sm)] bg-[var(--accent)] hover:opacity-90 text-white text-[12px] font-[600] transition-all active:scale-[0.97]"
                        >
                            {primaryAction.icon && <primaryAction.icon className="w-3.5 h-3.5" />}
                            {primaryAction.label}
                        </Link>
                    )}

                    {/* Quick Search — icon button, expands with ⌘K hint */}
                    <button
                        onClick={() => setSearchOpen(true)}
                        title="Search (⌘K)"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-fill)] hover:bg-[var(--bg-fill-secondary)] rounded-[var(--r-sm)] transition-colors"
                    >
                        <Search className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                        <div className="hidden lg:flex items-center gap-0.5 px-1 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                            <Command className="w-2.5 h-2.5 text-[var(--text-quaternary)]" />
                            <span className="text-[9px] font-[600] text-[var(--text-quaternary)]">K</span>
                        </div>
                    </button>

                    {/* Notifications */}
                    <NotificationCenter />

                    {/* Profile */}
                    <div className="relative">
                        <button
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            className="flex items-center gap-2 group"
                        >
                            <div className="w-8 h-8 rounded-full bg-[var(--bg-fill)] flex items-center justify-center text-[var(--text-primary)] dash-body-sm font-semibold">
                                {profile?.displayName?.charAt(0)?.toUpperCase() || "U"}
                            </div>
                            <ChevronDown className={`hidden lg:block w-4 h-4 text-[var(--text-tertiary)] transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                            {dropdownOpen && (
                                <>
                                    <div 
                                        className="fixed inset-0 z-40" 
                                        onClick={() => setDropdownOpen(false)} 
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        transition={{ duration: 0.15, ease: "easeOut" }}
                                        className="absolute right-0 top-full mt-2 w-44 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--r-xl)] shadow-[var(--shadow-xl)] p-1.5 overflow-hidden z-50"
                                    >
                                        <button
                                            onClick={() => {
                                                setDropdownOpen(false);
                                                signOut();
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-md)] text-left text-[var(--color-error)] hover:bg-[var(--color-error-bg)] transition-colors"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            <span className="dash-body-sm font-medium">Sign Out</span>
                                        </button>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </header>

            {/* Global Search Modal */}
            <AnimatePresence>
                {searchOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => {
                                setSearchOpen(false);
                                setSearchQuery("");
                            }}
                            className="fixed inset-0 bg-black/40 dark:bg-black/50 backdrop-blur-sm z-[100]"
                        />

                        {/* Search Panel */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="fixed top-20 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl z-[101]"
                        >
                            <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--r-xl)] shadow-[var(--shadow-xl)] overflow-hidden">
                                {/* Search Input */}
                                <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-subtle)]">
                                    <Search className="w-5 h-5 text-[var(--text-tertiary)] flex-shrink-0" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search events, guests, reports..."
                                        autoFocus
                                        className="flex-1 bg-transparent dash-body text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
                                    />
                                    <button
                                        onClick={() => {
                                            setSearchOpen(false);
                                            setSearchQuery("");
                                        }}
                                        className="p-1.5 rounded-[var(--r-sm)] hover:bg-[var(--bg-fill)] text-[var(--text-tertiary)]"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Quick Actions */}
                                <div className="px-3 py-3 border-b border-[var(--border-subtle)]">
                                    <p className="dash-label text-[var(--text-tertiary)] px-2 mb-2">Quick Actions</p>
                                    <div className="space-y-0.5">
                                        {[
                                            { label: "Create New Event", href: `/${roleContext.toLowerCase()}/create` },
                                            { label: "View Calendar", href: roleContext?.toLowerCase() === 'promoter' ? '/promoter/events' : `/${roleContext?.toLowerCase()}/calendar` },
                                            { label: "Manage Events", href: `/${roleContext.toLowerCase()}/events` },
                                        ].map((action, i) => (
                                            <button
                                                key={i}
                                                onClick={() => {
                                                    router.push(action.href);
                                                    setSearchOpen(false);
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-md)] text-left hover:bg-[var(--bg-fill)] transition-colors"
                                            >
                                                <span className="dash-body-sm text-[var(--text-primary)]">{action.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="px-5 py-3 bg-[var(--bg-secondary)] border-t border-[var(--border-subtle)] flex items-center gap-4">
                                    <span className="dash-caption text-[var(--text-tertiary)] flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-fill)] border border-[var(--border-subtle)] text-[10px] font-mono">↵</kbd>
                                        select
                                    </span>
                                    <span className="dash-caption text-[var(--text-tertiary)] flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-fill)] border border-[var(--border-subtle)] text-[10px] font-mono">esc</kbd>
                                        close
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}

