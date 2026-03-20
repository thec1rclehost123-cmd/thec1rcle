"use client";

import { type ReactNode } from "react";

interface SectionGroupProps {
    label: string;
    description?: string;
    children: ReactNode;
    className?: string;
}

export function SectionGroup({ label, description, children, className = "" }: SectionGroupProps) {
    return (
        <div className={`space-y-3 ${className}`}>
            <div className="flex items-center gap-3">
                <span
                    className="text-[10px] font-black uppercase tracking-[0.18em]"
                    style={{ color: "var(--v-text-tertiary)" }}
                >
                    {label}
                </span>
                {description && (
                    <span
                        className="text-[12px]"
                        style={{ color: "var(--v-text-muted, var(--v-text-tertiary))" }}
                    >
                        {description}
                    </span>
                )}
                <div
                    className="flex-1 h-px"
                    style={{ background: "var(--v-border)" }}
                />
            </div>
            <div>{children}</div>
        </div>
    );
}
