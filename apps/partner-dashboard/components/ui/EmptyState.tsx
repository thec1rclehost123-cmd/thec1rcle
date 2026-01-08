"use client";

import clsx from "clsx";
import { type ReactNode } from "react";

/**
 * EmptyState Component — When there's nothing to show
 * 
 * Calm, informative, actionable.
 */

export interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}

export function EmptyState({
    icon,
    title,
    description,
    action,
    className,
}: EmptyStateProps) {
    return (
        <div className={clsx(
            "flex flex-col items-center justify-center text-center py-12 px-6",
            className
        )}>
            {icon && (
                <div className="w-14 h-14 rounded-xl bg-stone-100 flex items-center justify-center mb-4">
                    <div className="text-stone-400">
                        {icon}
                    </div>
                </div>
            )}

            <h3 className="text-[16px] font-semibold text-stone-900 mb-1">{title}</h3>

            {description && (
                <p className="text-[14px] text-stone-500 max-w-sm">{description}</p>
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
