import React, { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * SectionLabel — Apple-style section header.
 *
 * Replaces SectionHeader (icon + colored bg) with a quiet
 * 11px / uppercase / tracking-wider label.
 * No icons. No subtitles. No card containers.
 */

interface SectionLabelProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "h2" | "h3" | "h4";
}

export function SectionLabel({
  children,
  className,
  as: Tag = "div",
}: SectionLabelProps) {
  return (
    <Tag className={cn(
      "text-[12px] font-[600] uppercase tracking-[0.07em] text-[var(--text-tertiary)] mb-3",
      className
    )}>
      {children}
    </Tag>
  );
}

export default SectionLabel;
