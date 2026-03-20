import { cn } from "@/lib/utils";
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
  success: "bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success)]/20",
  warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning)]/20",
  error:   "bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error)]/20",
  info:    "bg-[var(--color-info-bg)] text-[var(--color-info)] border-[var(--color-info)]/20",
  accent:  "bg-[var(--accent-muted)] text-[var(--accent)] border-[var(--accent)]/20",
  neutral: "bg-[var(--bg-fill)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
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
      className={cn(
        "inline-flex items-center border font-[600] rounded-[var(--r-badge)] whitespace-nowrap",
        toneStyles[tone],
        sizeStyles[size],
        className
      )}
      {...rest}
    >
      {dot && (
        <span className={cn(
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
