"use client";

import clsx from "clsx";
import { type ReactNode } from "react";

/**
 * Badge Component — State-Based Indicators
 * 
 * Uses CSS variables for dark mode support
 * Color is state, not decoration.
 */

type BadgeTone = "success" | "warning" | "error" | "info" | "accent" | "neutral";
type BadgeSize = "sm" | "md" | "lg";

const toneStyles: Record<BadgeTone, string> = {
  success: "bg-green-500/10 text-accent-primary border-[var(--state-success)]/20",
  warning: "bg-yellow-500/10 text-yellow-500 border-[var(--state-warning)]/20",
  error: "bg-red-500/10 text-red-500 border-[var(--state-error)]/20",
  info: "bg-blue-500/10 text-blue-500 border-[var(--state-info)]/20",
  accent: "bg-accent-glow text-accent-primary border-accent-primary/20",
  neutral: "bg-surface-tertiary text-text-secondary border-border-subtle",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[10px] gap-1",
  md: "px-2.5 py-1 text-[11px] gap-1.5",
  lg: "px-3 py-1.5 text-[12px] gap-2",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
  icon?: ReactNode;
  dot?: boolean;
  pulse?: boolean;
}

export const Badge = ({
  tone = "neutral",
  size = "md",
  icon,
  dot = false,
  pulse = false,
  className,
  children,
  ...rest
}: BadgeProps) => {
  return (
    <span
      className={clsx(
        "inline-flex items-center border font-semibold rounded-full whitespace-nowrap",
        toneStyles[tone],
        sizeStyles[size],
        className
      )}
      {...rest}
    >
      {dot && (
        <span className={clsx(
          "w-1.5 h-1.5 rounded-full flex-shrink-0",
          tone === "success" && "bg-green-500",
          tone === "warning" && "bg-[var(--state-warning)]",
          tone === "error" && "bg-[var(--state-error)]",
          tone === "info" && "bg-[var(--state-info)]",
          tone === "accent" && "bg-accent-primary",
          tone === "neutral" && "bg-[var(--text-tertiary)]",
          pulse && "animate-pulse"
        )} />
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
};

// Alias exports for backward compatibility
export const BadgeConfirmed = (props: Omit<BadgeProps, "tone">) => <Badge tone="success" {...props} />;
export const BadgePending = (props: Omit<BadgeProps, "tone">) => <Badge tone="warning" {...props} />;
export const BadgeRisk = (props: Omit<BadgeProps, "tone">) => <Badge tone="error" {...props} />;
export const BadgeDraft = (props: Omit<BadgeProps, "tone">) => <Badge tone="info" {...props} />;

export default Badge;
