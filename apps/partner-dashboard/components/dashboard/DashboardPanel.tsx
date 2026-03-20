"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

interface DashboardPanelProps extends Omit<HTMLMotionProps<"div">, "title"> {
    title?: ReactNode;
    subtitle?: ReactNode;
    icon?: ReactNode;
    actions?: ReactNode;
    footer?: ReactNode;
    children: ReactNode;
    variant?: "default" | "elevated" | "hero" | "ghost" | "accent";
    padding?: "none" | "sm" | "md" | "lg";
    fullHeight?: boolean;
    interactive?: boolean;
    className?: string;
    headerClassName?: string;
}

export function DashboardPanel({
    title,
    subtitle,
    icon,
    actions,
    footer,
    children,
    variant = "default",
    padding = "md",
    fullHeight = false,
    interactive = false,
    className,
    headerClassName,
    ...props
}: DashboardPanelProps) {
    const variantClasses = {
        default: "bg-[var(--v-card)] border-[var(--v-border)]",
        elevated: "bg-[var(--v-elevated)] border-[var(--v-border-strong)] shadow-sm",
        hero: "bg-[var(--v-hero)] border-[var(--v-border-strong)] shadow-md",
        ghost: "bg-transparent border-transparent",
        accent: "bg-[var(--v-orange-dim)] border-[var(--v-orange-glow)]",
    };

    const paddingClasses = {
        none: "p-0",
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
    };

    const Wrapper = (interactive ? motion.div : "div") as any;

    return (
        <Wrapper
            className={cn(
                "rounded-[var(--v-r-xl)] border transition-all duration-200 overflow-hidden flex flex-col",
                variantClasses[variant],
                interactive && "hover:bg-[var(--v-card-hover)] hover:shadow-lg cursor-pointer active:scale-[0.99]",
                fullHeight && "h-full",
                className
            )}
            {...(interactive ? {
                whileHover: { y: -2 },
                transition: { duration: 0.2 }
            } : {})}
            {...props}
        >
            {/* Header */}
            {(title || icon || actions) && (
                <div className={cn("px-6 py-5 flex items-center justify-between border-b border-[var(--v-divider)]", headerClassName)}>
                    <div className="flex items-center gap-3">
                        {icon && (
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--v-orange-dim)] text-[var(--v-orange)]">
                                {icon}
                            </div>
                        )}
                        <div>
                            {title && <h3 className="text-[15px] font-bold text-[var(--v-text-primary)] leading-tight">{title}</h3>}
                            {subtitle && <p className="text-[12px] font-medium text-[var(--v-text-tertiary)] mt-0.5">{subtitle}</p>}
                        </div>
                    </div>
                    {actions && <div className="flex items-center gap-2">{actions}</div>}
                </div>
            )}

            {/* Content */}
            <div className={cn("flex-1", paddingClasses[padding])}>
                {children}
            </div>

            {/* Footer */}
            {footer && (
                <div className="px-6 py-4 border-t border-[var(--v-divider)] bg-[var(--v-canvas)]/50">
                    {footer}
                </div>
            )}
        </Wrapper>
    );
}

export default DashboardPanel;
