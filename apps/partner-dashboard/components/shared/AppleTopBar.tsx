"use client";

import { useEffect, useState } from "react";
import { Bell, Search, X, Command, ChevronDown } from "lucide-react";
import { useDashboardAuth } from "../providers/DashboardAuthProvider";
import { usePathname, useRouter } from "next/navigation";
import { parseAsIST } from "@c1rcle/core/time";
import { motion, AnimatePresence } from "framer-motion";

interface AppleTopBarProps {
    title?: string;
}

export function AppleTopBar({ title }: AppleTopBarProps) {
    const { profile } = useDashboardAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentTime, setCurrentTime] = useState<Date | null>(null);

    // Update time every minute
    useEffect(() => {
        setCurrentTime(parseAsIST(null));
        const interval = setInterval(() => {
            setCurrentTime(parseAsIST(null));
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    const timeStr = currentTime?.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
    }) || '--:--';

    const dateStr = currentTime?.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'Asia/Kolkata'
    }) || '---';

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
            <header className="h-16 bg-[var(--surface-base)]/80 backdrop-blur-xl border-b border-[var(--border-subtle)] sticky top-0 z-40 px-6 lg:px-8 flex items-center justify-between">
                {/* Left - Status & Time */}
                <div className="flex items-center gap-4 lg:gap-6">
                    {/* System Status */}
                    <div className="live-indicator">
                        <span className="text-[10px] font-bold text-[var(--state-success)] uppercase tracking-widest">Live</span>
                    </div>

                    {/* Time Display */}
                    <div className="hidden md:flex items-center gap-4">
                        <span className="text-[14px] font-semibold text-[var(--text-primary)] tabular-nums">
                            {timeStr}
                        </span>
                        <div className="w-px h-4 bg-[var(--border-default)]" />
                        <span className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                            {dateStr}
                        </span>
                    </div>
                </div>

                {/* Right - Search & Actions */}
                <div className="flex items-center gap-3 lg:gap-4">
                    {/* Quick Search */}
                    <button
                        onClick={() => setSearchOpen(true)}
                        className="flex items-center gap-3 px-4 py-2.5 bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] border border-[var(--border-subtle)] rounded-xl transition-all group"
                    >
                        <Search className="w-4 h-4 text-[var(--text-placeholder)] group-hover:text-[var(--text-tertiary)]" />
                        <span className="hidden lg:block text-[13px] text-[var(--text-placeholder)] font-medium">
                            Search...
                        </span>
                        <div className="hidden lg:flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--surface-tertiary)] border border-[var(--border-subtle)]">
                            <Command className="w-3 h-3 text-[var(--text-placeholder)]" />
                            <span className="text-[10px] font-semibold text-[var(--text-placeholder)]">K</span>
                        </div>
                    </button>

                    {/* Notifications */}
                    <button className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--surface-tertiary)] transition-all group">
                        <Bell className="w-[18px] h-[18px] text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]" />
                        <span className="absolute top-2 right-2 w-2 h-2 bg-[var(--c1rcle-orange)] rounded-full ring-2 ring-[var(--surface-base)]" />
                    </button>

                    {/* Divider */}
                    <div className="w-px h-8 bg-[var(--border-subtle)] hidden lg:block" />

                    {/* Profile */}
                    <button className="flex items-center gap-3 pl-2 group">
                        <div className="w-10 h-10 rounded-xl bg-[var(--text-primary)] flex items-center justify-center text-[var(--text-inverse)] text-[14px] font-bold shadow-sm">
                            {profile?.displayName?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div className="hidden lg:block text-left">
                            <p className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight">
                                {profile?.displayName?.split(' ')[0] || "User"}
                            </p>
                            <p className="text-[10px] font-semibold text-[var(--c1rcle-orange)] uppercase tracking-widest">
                                {roleContext}
                            </p>
                        </div>
                        <ChevronDown className="hidden lg:block w-4 h-4 text-[var(--text-tertiary)]" />
                    </button>
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
                            className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-[100]"
                        />

                        {/* Search Panel */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-[90%] max-w-2xl z-[101]"
                        >
                            <div className="bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden">
                                {/* Search Input */}
                                <div className="flex items-center gap-4 px-6 py-4 border-b border-[var(--border-subtle)]">
                                    <Search className="w-5 h-5 text-[var(--text-tertiary)]" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search events, guests, reports..."
                                        autoFocus
                                        className="flex-1 bg-transparent text-[16px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none"
                                    />
                                    <button
                                        onClick={() => {
                                            setSearchOpen(false);
                                            setSearchQuery("");
                                        }}
                                        className="p-1.5 rounded-lg hover:bg-[var(--surface-tertiary)] text-[var(--text-tertiary)]"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Quick Actions */}
                                <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
                                    <p className="text-label-sm text-[var(--text-tertiary)] px-2 mb-2">Quick Actions</p>
                                    <div className="space-y-1">
                                        {[
                                            { label: "Create New Event", href: `/${roleContext.toLowerCase()}/create` },
                                            { label: "View Calendar", href: `/${roleContext.toLowerCase()}/calendar` },
                                            { label: "Manage Events", href: `/${roleContext.toLowerCase()}/events` },
                                        ].map((action, i) => (
                                            <button
                                                key={i}
                                                onClick={() => {
                                                    router.push(action.href);
                                                    setSearchOpen(false);
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-[var(--surface-tertiary)] transition-colors"
                                            >
                                                <span className="text-[14px] text-[var(--text-primary)]">{action.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Recent Searches */}
                                <div className="px-4 py-3">
                                    <p className="text-label-sm text-[var(--text-tertiary)] px-2 mb-2">Recent</p>
                                    <div className="flex items-center justify-center py-8">
                                        <p className="text-caption text-[var(--text-placeholder)]">
                                            {searchQuery ? "No results found" : "Type to search..."}
                                        </p>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="px-6 py-3 bg-[var(--surface-secondary)] border-t border-[var(--border-subtle)] flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <span className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1">
                                            <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-base)] border border-[var(--border-subtle)] text-[10px] font-mono">↵</kbd>
                                            to select
                                        </span>
                                        <span className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1">
                                            <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-base)] border border-[var(--border-subtle)] text-[10px] font-mono">esc</kbd>
                                            to close
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
