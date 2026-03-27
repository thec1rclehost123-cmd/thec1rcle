"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NotificationCenter } from "./NotificationCenter";
import { parseAsIST } from "@c1rcle/core/time";

interface AppleTopBarProps {
    title?: string;
    primaryAction?: {
        label: string;
        href: string;
        icon?: React.ComponentType<{ className?: string }>;
    };
}

export function AppleTopBar({ title, primaryAction }: AppleTopBarProps) {
    const [currentTime, setCurrentTime] = useState<Date | null>(null);

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

    return (
        <header className="h-16 bg-surface-base/80 backdrop-blur-xl border-b border-border-subtle sticky top-0 z-40 px-6 lg:px-8 flex items-center justify-between">
            {/* Left — Status, Time & Notifications */}
            <div className="flex items-center gap-4 lg:gap-5">
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

                {/* Notifications — moved to left */}
                <NotificationCenter />
            </div>

            {/* Right — Primary CTA only */}
            <div className="flex items-center gap-3">
                {primaryAction && (
                    <Link
                        href={primaryAction.href}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--c1rcle-orange)] hover:bg-[var(--c1rcle-orange-dim)] text-white text-[13px] font-bold tracking-wide transition-all shadow-[0_0_20px_var(--c1rcle-orange-glow)] hover:shadow-[0_0_30px_var(--c1rcle-orange-glow)] active:scale-[0.97]"
                    >
                        {primaryAction.icon && <primaryAction.icon className="w-4 h-4" />}
                        {primaryAction.label}
                    </Link>
                )}
            </div>
        </header>
    );
}
