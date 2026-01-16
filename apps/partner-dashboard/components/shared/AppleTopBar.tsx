"use client";

import { useEffect, useState } from "react";
import { Bell, Search, X } from "lucide-react";
import { useDashboardAuth } from "../providers/DashboardAuthProvider";
import { usePathname } from "next/navigation";
import { parseAsIST } from "@c1rcle/core/time";

interface AppleTopBarProps {
    title?: string;
}

export function AppleTopBar({ title }: AppleTopBarProps) {
    const { profile } = useDashboardAuth();
    const pathname = usePathname();
    const [searchOpen, setSearchOpen] = useState(false);

    // Format current date/time in IST
    const now = parseAsIST(null);
    const timeStr = now.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
    });
    const dateStr = now.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'Asia/Kolkata'
    });

    // Determine role context
    const roleContext = pathname.startsWith('/venue') ? 'Venue' :
        pathname.startsWith('/host') ? 'Host' :
            pathname.startsWith('/promoter') ? 'Promoter' : '';

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
                e.preventDefault();
                setSearchOpen(true);
                setTimeout(() => document.getElementById('global-search-input')?.focus(), 100);
            }
            if (e.key === 'Escape') {
                setSearchOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <header className="h-14 sm:h-16 bg-white/80 border-b border-black/[0.05] sticky top-0 z-40 px-4 sm:px-6 lg:px-8 flex items-center justify-between backdrop-blur-xl">
            {/* Left - Status & Time */}
            <div className="flex items-center gap-3 sm:gap-6">
                {/* System Status Indicator */}
                <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/10">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10B981]" />
                    <span className="text-[8px] sm:text-[10px] font-bold text-emerald-500 uppercase tracking-[0.15em] sm:tracking-[0.2em]">Live</span>
                </div>

                {/* Current Time (IST) - Hidden on small mobile */}
                <div className="hidden sm:flex items-center gap-2 sm:gap-4">
                    <span className="text-[12px] sm:text-[13px] font-bold text-[var(--text-primary)] tabular-nums">{timeStr}</span>
                    <div className="w-[1px] h-3 bg-black/10 hidden md:block" />
                    <span className="text-[9px] sm:text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.1em] sm:tracking-[0.15em] hidden md:block">{dateStr}</span>
                </div>
            </div>

            {/* Mobile Search Overlay */}
            {searchOpen && (
                <div className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-xl flex items-start pt-20 px-4 sm:hidden animate-fade-in">
                    <div className="w-full max-w-md mx-auto">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black/30" />
                            <input
                                id="global-search-input-mobile"
                                type="text"
                                placeholder="Search records..."
                                autoFocus
                                className="w-full pl-12 pr-4 py-4 bg-black/5 border border-black/10 rounded-2xl text-base text-[var(--text-primary)] placeholder:text-black/30 focus:outline-none focus:border-black/20 transition-all font-medium"
                            />
                        </div>
                        <button
                            onClick={() => setSearchOpen(false)}
                            className="mt-4 w-full py-3 rounded-xl bg-black/5 text-sm font-bold text-[var(--text-secondary)]"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Right - Search & Actions */}
            <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
                {/* Search Button (Mobile) */}
                <button
                    onClick={() => setSearchOpen(true)}
                    className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-black/5 border border-black/10 active:scale-95 transition-transform"
                >
                    <Search className="w-4 h-4 text-black/40" />
                </button>

                {/* Quick Search (Desktop) */}
                <div className="relative group hidden sm:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30 group-focus-within:text-black transition-colors" />
                    <input
                        id="global-search-input"
                        type="text"
                        placeholder="Search..."
                        className="w-40 md:w-52 lg:w-64 pl-9 sm:pl-10 pr-8 sm:pr-12 py-2 bg-black/5 border border-black/5 rounded-lg text-sm text-[var(--text-primary)] placeholder:text-black/20 focus:outline-none focus:border-black/20 focus:w-64 transition-all font-medium"
                    />
                    <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 px-1.5 py-0.5 rounded border border-black/10 bg-black/5 text-[10px] font-bold text-black/40">
                        <span>/</span>
                    </div>
                </div>

                {/* Notifications */}
                <button className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg bg-black/5 border border-black/10 hover:bg-black/10 active:scale-95 transition-all group">
                    <Bell className="w-4 h-4 text-black/40 group-hover:text-black transition-colors" />
                    <span className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 w-1.5 h-1.5 bg-iris rounded-full shadow-[0_0_10px_#F44A22]" />
                </button>

                {/* Profile */}
                <button className="flex items-center gap-2 sm:gap-3 pl-3 sm:pl-4 lg:pl-6 border-l border-black/5 group">
                    <div className="w-8 h-8 rounded-lg bg-black/5 border border-black/10 flex items-center justify-center text-xs font-bold text-[var(--text-primary)] shadow-sm group-hover:border-black/20 active:scale-95 transition-all">
                        {profile?.displayName?.charAt(0) || "U"}
                    </div>
                    <div className="hidden md:block text-left">
                        <p className="text-[12px] lg:text-[13px] font-bold text-[var(--text-primary)] leading-tight truncate max-w-[100px] lg:max-w-none">
                            {profile?.displayName?.split(' ')[0] || "User"}
                        </p>
                        <p className="text-[8px] lg:text-[9px] font-bold text-iris uppercase tracking-[0.15em] lg:tracking-[0.2em] mt-0.5">
                            {roleContext}
                        </p>
                    </div>
                </button>
            </div>
        </header>
    );
}
