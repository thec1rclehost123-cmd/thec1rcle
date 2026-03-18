import React, { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudioCardProps {
    title: string;
    children: ReactNode;
    className?: string;
    rightElement?: ReactNode;
}

export function StudioCard({ title, children, className, rightElement }: StudioCardProps) {
    return (
        <div className={cn("bg-surface-elevated border border-border-default rounded-[2rem] p-8 shadow-sm hover:shadow-md transition-shadow", className)}>
            <div className="flex items-center justify-between mb-8">
                <h3 className="text-sm font-black uppercase tracking-widest text-text-tertiary">{title}</h3>
                {rightElement}
            </div>
            {children}
        </div>
    );
}

interface KPICardProps {
    label: string;
    value: string | number;
    trend?: string;
    trendType?: "up" | "down" | "neutral";
    description?: string;
    suffix?: ReactNode;
    color?: "default" | "emerald" | "indigo" | "rose" | "amber";
}

export function KPICard({ label, value, trend, trendType = "neutral", description, suffix, color = "default" }: KPICardProps) {
    const trendColors = {
        up: "text-emerald-500 bg-emerald-50",
        down: "text-rose-500 bg-rose-50",
        neutral: "text-text-tertiary bg-surface-tertiary"
    };

    const TrendIcon = (trendType === "up" ? TrendingUp : trendType === "down" ? TrendingDown : Minus) as any;

    return (
        <div className="bg-surface-elevated border border-border-default rounded-[2rem] p-8 shadow-sm group hover:border-border-strong transition-all">
            <div className="flex justify-between items-start mb-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-text-tertiary group-hover:text-text-primary transition-colors">{label}</p>
                {trend && (
                    <div className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black", trendColors[trendType])}>
                        {React.createElement(TrendIcon, { className: "h-3 w-3" })}
                        {trend}
                    </div>
                )}
            </div>

            <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-text-primary tracking-tighter leading-none">{value}</span>
                {suffix && <span className="text-sm font-bold text-text-tertiary">{suffix}</span>}
            </div>

            {description && (
                <p className="mt-4 text-[10px] font-medium text-text-tertiary leading-relaxed uppercase tracking-wider italic flex items-center gap-2">
                    {React.createElement(Info as any, { className: "h-3 w-3 opacity-50" })}
                    {description}
                </p>
            )}
        </div>
    );
}

export function StudioKPIGrid({ children }: { children: ReactNode }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {children}
        </div>
    );
}

export function ChartPlaceholder({ height = "h-48", label = "Chart Data" }: { height?: string, label?: string }) {
    return (
        <div className={cn("w-full bg-surface-tertiary/50 border border-dashed border-border-default rounded-2xl flex flex-col items-center justify-center p-8", height)}>
            <div className="text-text-placeholder font-black uppercase tracking-widest text-[10px]">{label}</div>
        </div>
    );
}
