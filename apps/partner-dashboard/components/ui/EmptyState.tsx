import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

/**
 * EmptyState Component — When there's nothing to show
 * 
 * Calm, informative, actionable.
 */

export interface EmptyStateProps {
    icon?: any; // Supporting LucideIcon components or element nodes
    title: string;
    description?: string;
    action?: React.ReactNode;
    className?: string;
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}: EmptyStateProps) {
    const isComponent = typeof Icon === "function" || (typeof Icon === "object" && Icon !== null && "render" in (Icon as any));
    return (
        <div className={cn(
            "flex flex-col items-center justify-center text-center py-12 px-6",
            className
        )}>
            {Icon && (
                <div className="text-[var(--text-tertiary)] mb-3">
                    {isComponent ? (
                        <Icon className="h-6 w-6" />
                    ) : (
                        Icon as React.ReactNode
                    )}
                </div>
            )}

            <h3 className="text-[15px] font-[500] text-[var(--text-secondary)] mb-1">{title}</h3>

            {description && (
                <p className="text-[13px] text-[var(--text-tertiary)] max-w-[280px]">{description}</p>
            )}

            {action && (
                <div className="mt-4">
                    {action}
                </div>
            )}
        </div>
    );
}

export default EmptyState;
