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
                <div className="w-14 h-14 rounded-xl bg-surface-secondary flex items-center justify-center mb-4">
                    <div className="text-text-tertiary">
                        {isComponent ? (
                            <Icon className="h-6 w-6" />
                        ) : (
                            Icon as React.ReactNode
                        )}
                    </div>
                </div>
            )}

            <h3 className="text-[16px] font-semibold text-text-primary mb-1">{title}</h3>

            {description && (
                <p className="text-[14px] text-text-tertiary max-w-sm">{description}</p>
            )}

            {action && (
                <div className="mt-5">
                    {action}
                </div>
            )}
        </div>
    );
}

export default EmptyState;
