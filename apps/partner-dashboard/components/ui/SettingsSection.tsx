"use client";

import React, { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * SettingsSection + SettingsRow — Apple System Preferences style.
 *
 * No card containers. No icons in section headers.
 * Flat rows with hairline dividers.
 * Section label: 11px / uppercase / tracking-wider / tertiary
 * Row label: 13px / 500 / primary
 * Row description: 12px / 400 / tertiary (optional)
 * Control: right-aligned for toggles, below-label for inputs/selects
 */

// ── SettingsSection ───────────────────────────────────────────────────────────

interface SettingsSectionProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function SettingsSection({
  label,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <div className={cn("mb-8", className)}>
      <div className="text-[12px] font-[600] uppercase tracking-[0.07em] text-[var(--text-tertiary)] mb-1 pb-2 border-b border-[var(--border-subtle)]">
        {label}
      </div>
      <div className="divide-y divide-[var(--border-subtle)]">
        {children}
      </div>
    </div>
  );
}

// ── SettingsRow ───────────────────────────────────────────────────────────────

type SettingsRowLayout = "inline" | "stacked";

interface SettingsRowProps {
  label: string;
  description?: string;
  control: ReactNode;
  layout?: SettingsRowLayout;
  className?: string;
}

export function SettingsRow({
  label,
  description,
  control,
  layout = "stacked",
  className,
}: SettingsRowProps) {
  if (layout === "inline") {
    // Inline: label+description left, control right (for toggles)
    return (
      <div className={cn(
        "flex items-center justify-between gap-6 py-3 min-h-[44px]",
        className
      )}>
        <div className="min-w-0">
          <div className="text-[14px] font-[500] text-[var(--text-primary)]">{label}</div>
          {description && (
            <div className="text-[13px] text-[var(--text-tertiary)] mt-0.5">{description}</div>
          )}
        </div>
        <div className="flex-shrink-0">{control}</div>
      </div>
    );
  }

  // Stacked: label on top, control below (for text inputs, selects)
  return (
    <div className={cn("py-4", className)}>
      <div className="text-[14px] font-[500] text-[var(--text-primary)] mb-0.5">{label}</div>
      {description && (
        <div className="text-[13px] text-[var(--text-tertiary)] mb-2">{description}</div>
      )}
      <div>{control}</div>
    </div>
  );
}

export default SettingsSection;
