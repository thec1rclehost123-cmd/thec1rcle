"use client";

interface Tab {
    key: string;
    label: string;
    count?: number;
}

interface DashTabsProps {
    tabs: Tab[];
    activeKey: string;
    onChange: (key: string) => void;
    className?: string;
}

export function DashTabs({ tabs, activeKey, onChange, className = "" }: DashTabsProps) {
    return (
        <div className={`flex border-b border-[var(--border-subtle)] ${className}`}>
            {tabs.map((tab) => {
                const isActive = tab.key === activeKey;
                return (
                    <button
                        key={tab.key}
                        onClick={() => onChange(tab.key)}
                        className={`
                            relative px-4 pb-3 pt-1 dash-body-sm font-semibold cursor-pointer
                            transition-colors duration-[var(--t-fast)]
                            ${isActive
                                ? "text-[var(--accent)] border-b-2 border-[var(--accent)] -mb-px"
                                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                            }
                        `}
                    >
                        <span>{tab.label}</span>
                        {tab.count !== undefined && (
                            <span
                                className={`
                                    ml-1.5 px-1.5 py-0.5 rounded-full dash-label-sm
                                    ${isActive
                                        ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                                        : "bg-[var(--bg-fill)] text-[var(--text-tertiary)]"
                                    }
                                `}
                            >
                                {tab.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
