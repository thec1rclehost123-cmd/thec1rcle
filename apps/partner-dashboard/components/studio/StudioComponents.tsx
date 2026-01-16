"use client";

import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface StudioCardProps {
    title: string;
    children: ReactNode;
    className?: string;
    rightElement?: ReactNode;
}

export function StudioCard({ title, children, className, rightElement }: StudioCardProps) {
    return (
        <div className={cn("bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm hover:shadow-md transition-shadow", className)}>
            <div className="flex items-center justify-between mb-8">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">{title}</h3>
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
        neutral: "text-slate-500 bg-slate-50"
    };

    const TrendIcon = trendType === "up" ? TrendingUp : trendType === "down" ? TrendingDown : Minus;

    return (
        <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm group hover:border-slate-300 transition-all">
            <div className="flex justify-between items-start mb-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-slate-900 transition-colors">{label}</p>
                {trend && (
                    <div className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black", trendColors[trendType])}>
                        <TrendIcon className="h-3 w-3" />
                        {trend}
                    </div>
                )}
            </div>

            <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{value}</span>
                {suffix && <span className="text-sm font-bold text-slate-400">{suffix}</span>}
            </div>

            {description && (
                <p className="mt-4 text-[10px] font-medium text-slate-400 leading-relaxed uppercase tracking-wider italic flex items-center gap-2">
                    <Info className="h-3 w-3 opacity-50" />
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
        <div className={cn("w-full bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-8", height)}>
            <div className="text-slate-300 font-black uppercase tracking-widest text-[10px]">{label}</div>
        </div>
    );
}
