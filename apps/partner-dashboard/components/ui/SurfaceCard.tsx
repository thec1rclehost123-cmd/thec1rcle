"use client";

import React, { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * SurfaceCard — The one card primitive for venue dashboard pages.
 *
 * Design rules:
 * - Solid surface, never glassy on content
 * - 16px radius (--r-lg)
 * - Subtle 1px border
 * - shadow-sm only; no shadow-xl, no glow
 * - Interactive variant: border + shadow on hover, no translateY
 */

type SurfaceCardPadding = "compact" | "standard" | "spacious" | "none";

interface SurfaceCardProps {
  padding?: SurfaceCardPadding;
  interactive?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
  onClick?: () => void;
}

const paddingMap: Record<SurfaceCardPadding, string> = {
  none:      "",
  compact:   "p-4",
  standard:  "p-5",
  spacious:  "p-6",
};

function SurfaceCard({
  padding = "standard",
  interactive = false,
  className,
  style,
  children,
  onClick,
}: SurfaceCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-[var(--r-lg)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] shadow-[var(--shadow-sm)]",
        interactive && "cursor-pointer transition-all duration-100 hover:border-[var(--border-default)] hover:shadow-[var(--shadow-md)]",
        onClick && "cursor-pointer",
        paddingMap[padding],
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}

// ── Compound sub-components ──────────────────────────────────────────────────

interface CardHeaderProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}

function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3 mb-4", className)}>
      <div className="min-w-0">
        {title && (
          <div className="text-[15px] font-[500] text-[var(--text-primary)] leading-snug">
            {title}
          </div>
        )}
        {subtitle && (
          <div className="text-[13px] text-[var(--text-tertiary)] mt-0.5">
            {subtitle}
          </div>
        )}
      </div>
      {action && (
        <div className="flex-shrink-0">{action}</div>
      )}
    </div>
  );
}

interface CardBodyProps {
  className?: string;
  children: ReactNode;
}

function CardBody({ className, children }: CardBodyProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {children}
    </div>
  );
}

interface CardFooterProps {
  className?: string;
  children: ReactNode;
}

function CardFooter({ className, children }: CardFooterProps) {
  return (
    <div className={cn(
      "flex items-center justify-between gap-3 pt-4 mt-4 border-t border-[var(--border-subtle)]",
      className
    )}>
      {children}
    </div>
  );
}

// Attach sub-components
SurfaceCard.Header = CardHeader;
SurfaceCard.Body = CardBody;
SurfaceCard.Footer = CardFooter;

export { SurfaceCard };
export type { SurfaceCardProps, SurfaceCardPadding };
export default SurfaceCard;
