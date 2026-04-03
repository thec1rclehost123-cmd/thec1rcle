"use client";

import { useEffect, useState } from "react";
import { Search, X, Command, ChevronDown, Settings, LogOut } from "lucide-react";
import Link from "next/link";
import { NotificationCenter } from "./NotificationCenter";
import { useDashboardAuth } from "../providers/DashboardAuthProvider";
import { usePathname, useRouter } from "next/navigation";
import { parseAsIST } from "@c1rcle/core/time";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface AppleTopBarProps {
    title?: string;
    primaryAction?: {
        label: string;
        href: string;
        icon?: React.ComponentType<{ className?: string }>;
    };
}

export function AppleTopBar({ title, primaryAction }: AppleTopBarProps) {
    const { profile, signOut } = useDashboardAuth() as any;
    const pathname = usePathname();
    const router = useRouter();
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [profileOpen, setProfileOpen] = useState(false);
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
            <header className="h-16 bg-surface-base/80 backdrop-blur-xl border-b border-border-subtle px-4 lg:px-8 flex items-center justify-between gap-4 min-w-0">
                {/* Left - Status & Time */}
                <div className="flex items-center gap-3 lg:gap-6 min-w-0">
                    {/* System Status */}
                    <div className="live-indicator">
                        <span className="text-[10px] font-bold text-c1rcle-orange uppercase tracking-widest">Live</span>
                    </div>

                    {/* Time Display */}
                    <div className="hidden md:flex items-center gap-4">
                        <span className="text-[14px] font-semibold text-text-primary tabular-nums">
                            {timeStr}
                        </span>
                        <div className="w-px h-4 bg-[var(--border-default)]" />
                        <span className="text-[12px] font-medium text-text-tertiary uppercase tracking-wide">
                            {dateStr}
                        </span>
                    </div>
                </div>

                {/* Right - Search & Actions */}
                <div className="flex items-center justify-end gap-2 lg:gap-3 min-w-0">
                    {/* Primary CTA */}
                    {primaryAction && (
                        <Link
                            href={primaryAction.href}
                            className="flex items-center gap-2 px-3 xl:px-4 py-2 rounded-xl bg-[var(--c1rcle-orange)] hover:bg-[var(--c1rcle-orange-dim)] text-white text-[13px] font-bold tracking-wide transition-all shadow-[0_0_20px_var(--c1rcle-orange-glow)] hover:shadow-[0_0_30px_var(--c1rcle-orange-glow)] active:scale-[0.97] shrink-0"
                        >
                            {primaryAction.icon && <primaryAction.icon className="w-4 h-4" />}
                            <span className="hidden xl:inline">{primaryAction.label}</span>
                        </Link>
                    )}

                    {/* Quick Search */}
                    <button
                        onClick={() => setSearchOpen(true)}
                        className="flex items-center gap-3 px-3 xl:px-4 py-2.5 bg-surface-secondary hover:bg-surface-tertiary border border-border-subtle rounded-xl transition-all group min-w-0"
                    >
                        <Search className="w-4 h-4 text-text-placeholder group-hover:text-text-tertiary" />
                        <span className="hidden xl:block text-[13px] text-text-placeholder font-medium truncate">
                            Search...
                        </span>
                        <div className="hidden xl:flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-tertiary border border-border-subtle">
                            <Command className="w-3 h-3 text-text-placeholder" />
                            <span className="text-[10px] font-semibold text-text-placeholder">K</span>
                        </div>
                    </button>

                    {/* Notifications */}
                    <NotificationCenter />

                    {/* Profile */}
                    <div className="relative shrink-0">
                        <button
                            onClick={() => setProfileOpen((v) => !v)}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-surface-secondary hover:bg-surface-tertiary border border-border-subtle transition-all"
                        >
                            <div className="w-7 h-7 rounded-full bg-[var(--c1rcle-orange)] flex items-center justify-center text-white text-[11px] font-black shrink-0">
                                {profile?.displayName?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <span className="hidden lg:block text-[13px] font-semibold text-text-primary max-w-[120px] truncate">
                                {profile?.displayName || "Account"}
                            </span>
                            <ChevronDown className={cn("w-3.5 h-3.5 text-text-tertiary transition-transform duration-200", profileOpen && "rotate-180")} />
                        </button>

                        <AnimatePresence>
                            {profileOpen && (
                                <>
                                    <div className="fixed inset-0 z-[49]" onClick={() => setProfileOpen(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.97, y: -6 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.97, y: -6 }}
                                        transition={{ duration: 0.12 }}
                                        className="absolute right-0 top-full mt-2 w-56 z-50 rounded-2xl overflow-hidden"
                                        style={{
                                            background: "var(--v-card)",
                                            border: "1px solid var(--v-border)",
                                            boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
                                        }}
                                    >
                                        {/* Identity */}
                                        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--v-border)" }}>
                                            <p className="text-[13px] font-bold text-text-primary truncate">{profile?.displayName || "Account"}</p>
                                            <p className="text-[11px] text-text-tertiary truncate mt-0.5">{profile?.email || ""}</p>
                                        </div>

                                        {/* Menu items */}
                                        <div className="py-1.5">
                                            <button
                                                onClick={() => { router.push(`/${pathname.split('/')[1]}/settings`); setProfileOpen(false); }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-text-secondary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
                                            >
                                                <Settings className="w-4 h-4 shrink-0" />
                                                Settings
                                            </button>
                                            <button
                                                onClick={() => { signOut(); setProfileOpen(false); }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors"
                                                style={{ color: "var(--v-error)" }}
                                            >
                                                <LogOut className="w-4 h-4 shrink-0" />
                                                Sign out
                                            </button>
                                        </div>
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
                            className="fixed top-[calc(4rem+env(safe-area-inset-top)+1rem)] left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-2xl z-[101]"
                        >
                            <div className="bg-surface-elevated border border-border-subtle rounded-2xl shadow-2xl overflow-hidden">
                                {/* Search Input */}
                                <div className="flex items-center gap-4 px-6 py-4 border-b border-border-subtle">
                                    <Search className="w-5 h-5 text-text-tertiary" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search events, guests, reports..."
                                        autoFocus
                                        className="flex-1 bg-transparent text-[16px] text-text-primary placeholder:text-text-placeholder outline-none"
                                    />
                                    <button
                                        onClick={() => {
                                            setSearchOpen(false);
                                            setSearchQuery("");
                                        }}
                                        className="p-1.5 rounded-lg hover:bg-surface-tertiary text-text-tertiary"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Quick Actions */}
                                <div className="px-4 py-3 border-b border-border-subtle">
                                    <p className="text-label-sm text-text-tertiary px-2 mb-2">Quick Actions</p>
                                    <div className="space-y-1">
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
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-surface-tertiary transition-colors"
                                            >
                                                <span className="text-[14px] text-text-primary">{action.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Recent Searches */}
                                <div className="px-4 py-3">
                                    <p className="text-label-sm text-text-tertiary px-2 mb-2">Recent</p>
                                    <div className="flex items-center justify-center py-8">
                                        <p className="text-caption text-text-placeholder">
                                            {searchQuery ? "No results found" : "Type to search..."}
                                        </p>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="px-6 py-3 bg-surface-secondary border-t border-border-subtle flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <span className="text-[11px] text-text-tertiary flex items-center gap-1">
                                            <kbd className="px-1.5 py-0.5 rounded bg-surface-base border border-border-subtle text-[10px] font-mono">↵</kbd>
                                            to select
                                        </span>
                                        <span className="text-[11px] text-text-tertiary flex items-center gap-1">
                                            <kbd className="px-1.5 py-0.5 rounded bg-surface-base border border-border-subtle text-[10px] font-mono">esc</kbd>
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
