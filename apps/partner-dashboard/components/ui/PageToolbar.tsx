"use client";

import React, { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * PageToolbar — Sticky composed control surface below page header.
 *
 * Two defined zones: left (tabs / filters) and right (search + actions).
 * 48px height. Backdrop blur for chrome feel.
 *
 * Design rules:
 * - Left zone: TabBar or SegmentedControl
 * - Right zone: SearchInput + optional action buttons
 * - Consistent 48px height across all venue pages
 * - 1px bottom border, backdrop-blur
 */

interface PageToolbarProps {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
  sticky?: boolean;
}

export function PageToolbar({
  left,
  right,
  className,
  sticky = true,
}: PageToolbarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        "min-h-[48px] mb-5",
        "-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10",
        sticky && "sticky top-14 z-20",
        className
      )}
      style={{
        background: "var(--bg-base)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      {left && (
        <div className="flex items-center min-w-0 flex-1">
          {left}
        </div>
      )}
      {right && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {right}
        </div>
      )}
    </div>
  );
}

/**
 * SearchInput — Compact 36px search field for toolbar right zone.
 */
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <svg
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"
        width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-9 pl-8 pr-3 text-[13px] font-[400] rounded-[var(--r-sm)]",
          "bg-[var(--bg-fill)] border border-[var(--border-subtle)]",
          "text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]",
          "focus:outline-none focus:border-[var(--border-default)] focus:bg-[var(--surface-elevated)]",
          "transition-all duration-100 w-[200px] focus:w-[240px]"
        )}
      />
    </div>
  );
}

export default PageToolbar;
