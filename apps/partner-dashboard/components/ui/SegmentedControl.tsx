"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * SegmentedControl — Period / view switcher.
 *
 * 32px height. Compact. Used for time ranges (7D/30D/YTD) and binary view
 * toggles (Month/Week). Does NOT replace TabBar — use TabBar for page
 * section navigation.
 *
 * Design rules:
 * - 8px radius (--r-sm)
 * - Active: bg-fill segment with xs shadow
 * - Subtle outer border + bg-fill-secondary background
 * - 12px text, 500 weight
 */

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string = string> {
  options: ReadonlyArray<SegmentedOption<T> | T>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  className,
  size = "sm",
}: SegmentedControlProps<T>) {
  const normalized = options.map((o): SegmentedOption<T> =>
    typeof o === "string" ? { value: o as T, label: o as string } : o
  );

  const padding = size === "sm" ? "px-3 py-1.5" : "px-4 py-2";
  const textSize = size === "sm" ? "text-[12px]" : "text-[13px]";

  return (
    <div className={cn(
      "inline-flex items-center p-[3px] rounded-[var(--r-sm)] border border-[var(--border-subtle)] bg-[var(--bg-fill-secondary)]",
      className
    )}>
      {normalized.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              padding,
              textSize,
              "font-[500] rounded-[5px] transition-all duration-100 whitespace-nowrap",
              isActive
                ? "bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-[var(--shadow-xs)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
