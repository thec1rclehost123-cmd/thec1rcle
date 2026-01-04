"use client";

import { Bell, Search } from "lucide-react";
import { useDashboardAuth } from "../providers/DashboardAuthProvider";

interface AppleTopBarProps {
    title?: string;
}

export function AppleTopBar({ title }: AppleTopBarProps) {
    const { profile } = useDashboardAuth();

    return (
        <header className="h-14 glass-nav sticky top-0 z-40 px-6 flex items-center justify-between">
            {/* Left - Title/Breadcrumb */}
            <div className="flex items-center gap-4">
                {title && (
                    <h2 className="text-[15px] font-medium text-[#1d1d1f]">{title}</h2>
                )}
            </div>

            {/* Right - Actions */}
            <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="input pl-10 pr-4 py-2 text-[13px] w-52 rounded-lg"
                    />
                </div>

                {/* Notifications */}
                <button className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/[0.04] transition-colors">
                    <Bell className="w-[18px] h-[18px] text-[#6e6e73]" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-[#ff3b30] rounded-full" />
                </button>

                {/* Profile */}
                <div className="flex items-center gap-2 pl-3 ml-1 border-l border-black/[0.06]">
                    <div className="avatar avatar-sm">
                        {profile?.displayName?.charAt(0) || "U"}
                    </div>
                </div>
            </div>
        </header>
    );
}
