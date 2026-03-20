"use client";

import React, { type ReactNode } from "react";
import { AlertTriangle, Info, CheckCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AlertStrip — Thin operational alert, 40px height.
 *
 * Replaces full-card alert banners. Does not compete with page hierarchy.
 * Uses a colored left-border + very subtle background, no heavy card treatment.
 *
 * Tones: warning (amber), error (red), success (green), info (indigo)
 */

type AlertTone = "warning" | "error" | "success" | "info";

interface AlertStripProps {
  tone?: AlertTone;
  message: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const toneConfig: Record<AlertTone, {
  border: string;
  bg: string;
  icon: React.ElementType;
  iconColor: string;
}> = {
  warning: {
    border:    "border-l-[var(--color-warning)]",
    bg:        "bg-[var(--color-warning-bg)]",
    icon:      AlertTriangle,
    iconColor: "text-[var(--color-warning)]",
  },
  error: {
    border:    "border-l-[var(--color-error)]",
    bg:        "bg-[var(--color-error-bg)]",
    icon:      AlertTriangle,
    iconColor: "text-[var(--color-error)]",
  },
  success: {
    border:    "border-l-[var(--color-success)]",
    bg:        "bg-[var(--color-success-bg)]",
    icon:      CheckCircle,
    iconColor: "text-[var(--color-success)]",
  },
  info: {
    border:    "border-l-[var(--color-info)]",
    bg:        "bg-[var(--color-info-bg)]",
    icon:      Info,
    iconColor: "text-[var(--color-info)]",
  },
};

export function AlertStrip({
  tone = "warning",
  message,
  action,
  onDismiss,
  className,
}: AlertStripProps) {
  const { border, bg, icon: Icon, iconColor } = toneConfig[tone];

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 rounded-[var(--r-sm)]",
      "min-h-[40px] py-2",
      "border-l-2", border, bg,
      className
    )}>
      <Icon size={14} className={cn("flex-shrink-0", iconColor)} />
      <div className="flex-1 text-[13px] font-[500] text-[var(--text-primary)]">
        {message}
      </div>
      {action && (
        <div className="flex-shrink-0">{action}</div>
      )}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export default AlertStrip;
