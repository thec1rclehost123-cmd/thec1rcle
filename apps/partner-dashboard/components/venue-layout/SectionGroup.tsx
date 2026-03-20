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
                    style={{ color: "var(--text-tertiary)" }}
                >
                    {label}
                </span>
                {description && (
                    <span
                        className="text-[12px]"
                        style={{ color: "var(--text-tertiary)" }}
                    >
                        {description}
                    </span>
                )}
                <div
                    className="flex-1 h-px"
                    style={{ background: "var(--border-subtle)" }}
                />
            </div>
            <div>{children}</div>
        </div>
    );
}
