"use client";

import { Bell, Search, Command } from "lucide-react";
import { useDashboardAuth } from "../providers/DashboardAuthProvider";
import { usePathname } from "next/navigation";
import { parseAsIST } from "@c1rcle/core/time";

interface AppleTopBarProps {
    title?: string;
}

export function AppleTopBar({ title }: AppleTopBarProps) {
    const { profile } = useDashboardAuth();
    const pathname = usePathname();

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
    const roleContext = pathname.startsWith('/venue') ? 'Venue Operator' :
        pathname.startsWith('/host') ? 'Production Host' :
            pathname.startsWith('/promoter') ? 'Marketing Node' : '';

    return (
        <header className="h-16 bg-[var(--surface-primary)] border-b border-[var(--border-subtle)] sticky top-0 z-40 px-8 flex items-center justify-between backdrop-blur-md bg-[var(--surface-primary)]/80">
            {/* Left - Status & Time */}
            <div className="flex items-center gap-6">
                {/* System Status Indicator */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--state-confirmed-bg)] border border-[var(--state-confirmed)]/20 shadow-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--state-confirmed)] animate-pulse shadow-[0_0_8px_var(--state-confirmed)]" />
                    <span className="text-[10px] font-bold text-[var(--state-confirmed)] uppercase tracking-[0.1em]">Verified Live</span>
                </div>

                {/* Current Time (IST) */}
                <div className="hidden md:flex items-center gap-3">
                    <span className="text-[13px] font-bold text-[var(--text-primary)]">{timeStr}</span>
                    <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
                    <span className="text-[13px] font-medium text-[var(--text-tertiary)]">{dateStr}</span>
                </div>
            </div>

            {/* Right - Search & Actions */}
            <div className="flex items-center gap-4">
                {/* Quick Search */}
                <button className="hidden md:flex items-center gap-4 px-4 py-2 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] text-[var(--text-placeholder)] hover:bg-[var(--surface-secondary)] hover:border-[var(--border-strong)] transition-all group">
                    <Search className="w-4 h-4 group-hover:text-[var(--text-primary)] transition-colors" />
                    <span className="text-[13px] font-medium">Command Index</span>
                    <div className="flex items-center gap-1 text-[10px] font-bold bg-[var(--surface-primary)] text-[var(--text-tertiary)] px-2 py-0.5 rounded-md border border-[var(--border-subtle)] shadow-sm">
                        <Command className="w-3 h-3" />
                        <span>K</span>
                    </div>
                </button>

                {/* Notifications */}
                <button className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--surface-secondary)]/30 border border-[var(--border-subtle)] hover:bg-[var(--surface-secondary)] transition-all group">
                    <Bell className="w-[18px] h-[18px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" />
                    {/* Notification dot */}
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[var(--state-risk)] rounded-full border-2 border-[var(--surface-primary)] shadow-sm" />
                </button>

                {/* Profile */}
                <button className="flex items-center gap-3 pl-4 border-l border-[var(--border-subtle)] group">
                    <div className="w-9 h-9 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] flex items-center justify-center text-xs font-bold text-[var(--text-primary)] shadow-sm group-hover:border-[var(--border-strong)] transition-all">
                        {profile?.displayName?.charAt(0) || "U"}
                    </div>
                    <div className="hidden lg:block text-left">
                        <p className="text-[13px] font-bold text-[var(--text-primary)] leading-tight">
                            {profile?.displayName?.split(' ')[0] || "User"}
                        </p>
                        <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mt-0.5">
                            {roleContext}
                        </p>
                    </div>
                </button>
            </div>
        </header>
    );
}
