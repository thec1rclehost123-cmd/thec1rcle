"use client";

import type { LucideIcon } from "lucide-react";
import { getTabItemStyle } from "@/components/venue-layout/VenuePageShell";

export interface HubTab {
    key: string;
    label: string;
    icon?: LucideIcon;
    badge?: number;
}

interface HubTabBarProps {
    tabs: HubTab[];
    activeTab: string;
    onTabChange: (key: string) => void;
    className?: string;
    variant?: "default" | "analytics" | "finance" | "door" | "partners";
}

export function HubTabBar({ tabs, activeTab, onTabChange, className = "", variant = "default" }: HubTabBarProps) {
    const isFinance = variant === "finance";

    return (
        <div
            className={`flex flex-wrap p-1 rounded-xl gap-1 ${className}`}
            style={{ 
                background: "var(--v-card)", 
                border: "1px solid var(--v-border)",
                backdropFilter: "blur(20px)",
                boxShadow: "var(--v-shadow-card)"
            }}
        >
            {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                    <button
                        key={tab.key}
                        onClick={() => onTabChange(tab.key)}
                        className={`flex items-center gap-2.5 px-4 py-2 text-[12px] font-bold uppercase tracking-widest transition-all duration-200 rounded-lg ${
                            isActive 
                                ? "text-[var(--v-text-primary)] shadow-sm" 
                                : "text-[var(--v-text-muted)] hover:text-[var(--v-text-secondary)] hover:bg-white/[0.02]"
                        }`}
                        style={{
                            background: isActive ? "var(--v-elevated)" : "transparent",
                            border: isActive ? "1px solid var(--v-border)" : "1px solid transparent",
                        }}
                    >
                        {tab.icon && <tab.icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-[var(--v-orange)]" : "opacity-50"}`} />}
                        {tab.label}
                        {tab.badge !== undefined && tab.badge > 0 && (
                            <span
                                className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black"
                                style={{ background: "var(--v-orange)", color: "white" }}
                            >
                                {tab.badge}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
