"use client";

import type { LucideIcon } from "lucide-react";

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

export function HubTabBar({ tabs, activeTab, onTabChange, className = "" }: HubTabBarProps) {
    return (
        <div className={`flex overflow-x-auto border-b border-[var(--border-subtle)] scrollbar-hide ${className}`}>
            {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.key}
                        onClick={() => onTabChange(tab.key)}
                        className={`
                            flex items-center gap-2 px-4 pb-3 pt-1 dash-body-sm font-semibold
                            whitespace-nowrap shrink-0 cursor-pointer
                            transition-colors duration-[var(--t-fast)]
                            ${isActive
                                ? "text-[var(--accent)] border-b-2 border-[var(--accent)] -mb-px"
                                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                            }
                        `}
                    >
                        {Icon && (
                            <Icon
                                className={`w-4 h-4 shrink-0 ${isActive ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]"}`}
                                strokeWidth={1.5}
                            />
                        )}
                        {tab.label}
                        {tab.badge !== undefined && tab.badge > 0 && (
                            <span
                                className={`ml-1 px-1.5 py-0.5 rounded-full dash-label-sm ${isActive ? "bg-[var(--accent-muted)] text-[var(--accent)]" : "bg-[var(--bg-fill)] text-[var(--text-tertiary)]"}`}
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
