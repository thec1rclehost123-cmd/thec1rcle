"use client";

import React, { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * TabBar — Unified tab primitive for venue dashboard pages.
 *
 * Three modes:
 * - "underline"  → Page-level section navigation (40px height, 2px orange underline on active)
 * - "segmented"  → View/display switching (compact, filled active segment)
 * - "compact"    → Toolbar-level dense filtering
 *
 * Design rules:
 * - Only one primary button per page; tabs are secondary wayfinding
 * - Active accent: 2px underline (underline mode) or bg-fill segment (segmented mode)
 * - Count badges: 6px radius, not pill; semantic color on active, neutral on rest
 */

export type TabMode = "underline" | "segmented" | "compact";

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

interface TabBarProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  mode?: TabMode;
  className?: string;
  trailing?: ReactNode;
}

export function TabBar({
  tabs,
  active,
  onChange,
  mode = "underline",
  className,
  trailing,
}: TabBarProps) {
  if (mode === "underline") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <div className="flex border-b border-[var(--border-subtle)]">
          {tabs.map((tab) => {
            const isActive = tab.key === active;
            return (
              <button
                key={tab.key}
                onClick={() => onChange(tab.key)}
                className={cn(
                  "px-4 pb-3 pt-1 text-[14px] font-[500] transition-colors duration-100 whitespace-nowrap",
                  isActive
                    ? "text-[var(--accent)] border-b-2 border-[var(--accent)] -mb-px"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                )}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={cn(
                    "ml-1.5 px-1.5 py-0.5 rounded-[var(--r-badge)] text-[11px] font-[600]",
                    isActive
                      ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                      : "bg-[var(--bg-fill)] text-[var(--text-tertiary)]"
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {trailing && <div className="flex-shrink-0 ml-2">{trailing}</div>}
      </div>
    );
  }

  if (mode === "segmented") {
    return (
      <div className={cn(
        "inline-flex items-center p-[3px] rounded-[var(--r-sm)] border border-[var(--border-subtle)] bg-[var(--bg-fill-secondary)]",
        className
      )}>
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={cn(
                "px-3 py-1.5 text-[12px] font-[500] rounded-[5px] transition-all duration-100 whitespace-nowrap",
                isActive
                  ? "bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-[var(--shadow-xs)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    );
  }

  // compact mode
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              "px-3 py-1.5 text-[12px] font-[500] rounded-[var(--r-sm)] transition-all duration-100 whitespace-nowrap",
              isActive
                ? "bg-[var(--bg-fill)] text-[var(--text-primary)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-fill-secondary)]"
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1 text-[10px]">{tab.count}</span>
            )}
          </button>
        );
      })}
      {trailing && <div className="flex-shrink-0">{trailing}</div>}
    </div>
  );
}

export default TabBar;
