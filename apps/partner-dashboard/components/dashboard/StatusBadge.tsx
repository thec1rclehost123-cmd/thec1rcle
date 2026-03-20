"use client";

import React, { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral" | "accent";

interface StatusBadgeProps {
    children: ReactNode;
    variant?: BadgeVariant;
    size?: "sm" | "md";
    icon?: ReactNode;
    dot?: boolean;
    pill?: boolean;
    className?: string;
}

export function StatusBadge({
    children,
    variant = "neutral",
    size = "md",
    icon,
    dot = false,
    pill = true,
    className,
}: StatusBadgeProps) {
    const variantClasses = {
        success: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
        warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
        error: "bg-[var(--color-error-bg)] text-[var(--color-error)]",
        info: "bg-[var(--color-info-bg)] text-[var(--color-info)]",
        neutral: "bg-white/5 text-[var(--text-tertiary)]",
        accent: "bg-[var(--accent-muted)] text-[var(--accent)]",
    };

    const sizeClasses = {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-2.5 py-1 text-[11px]",
    };

    return (
        <div
            className={cn(
                "inline-flex items-center gap-1.5 font-bold uppercase tracking-widest transition-all duration-200",
                variantClasses[variant],
                sizeClasses[size],
                pill ? "rounded-full" : "rounded-lg",
                className
            )}
        >
            {dot && (
                <span 
                    className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0", 
                        variant === "success" && "animate-pulse bg-current"
                    )}
                    style={{ background: variant === "success" ? undefined : "currentColor" }}
                />
            )}
            {icon && <span className="shrink-0">{icon}</span>}
            <span className="leading-none">{children}</span>
        </div>
    );
}

export default StatusBadge;
