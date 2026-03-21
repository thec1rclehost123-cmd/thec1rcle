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
        success: "bg-[var(--v-success-bg)] text-[var(--v-success)]",
        warning: "bg-[var(--v-warning-bg)] text-[var(--v-warning)]",
        error: "bg-[var(--v-error-bg)] text-[var(--v-error)]",
        info: "bg-[var(--v-info-bg)] text-[var(--v-info)]",
        neutral: "bg-white/5 text-[var(--v-text-tertiary)]",
        accent: "bg-[var(--v-orange-dim)] text-[var(--v-orange)]",
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
