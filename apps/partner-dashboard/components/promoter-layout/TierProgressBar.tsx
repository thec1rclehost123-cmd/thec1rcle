"use client";

import { useMemo } from "react";
import { Trophy, TrendingUp, Star, Zap, Crown, ChevronRight } from "lucide-react";

interface CommissionTier {
    threshold: number;
    rate: number;
    label: string;
}

const DEFAULT_TIERS: CommissionTier[] = [
    { threshold: 0, rate: 10, label: "Base" },
    { threshold: 10, rate: 12, label: "Silver" },
    { threshold: 25, rate: 15, label: "Gold" },
    { threshold: 50, rate: 18, label: "Platinum" },
    { threshold: 100, rate: 20, label: "Diamond" },
];

const TIER_STYLES: Record<string, { gradient: string; icon: any; badge: string; glow: string }> = {
    Base: { gradient: "from-slate-400 to-slate-500", icon: Zap, badge: "bg-slate-100 text-slate-700", glow: "" },
    Silver: { gradient: "from-slate-300 to-slate-400", icon: Star, badge: "bg-slate-50 text-slate-600 border border-slate-200", glow: "" },
    Gold: { gradient: "from-amber-400 to-yellow-500", icon: Trophy, badge: "bg-amber-50 text-amber-700 border border-amber-200", glow: "shadow-amber-100" },
    Platinum: { gradient: "from-violet-400 to-purple-500", icon: Crown, badge: "bg-violet-50 text-violet-700 border border-violet-200", glow: "shadow-violet-100" },
    Diamond: { gradient: "from-cyan-400 to-blue-500", icon: Crown, badge: "bg-cyan-50 text-cyan-700 border border-cyan-200", glow: "shadow-cyan-100" },
};

interface TierProgressProps {
    currentSales: number;
    tiers?: CommissionTier[];
    variant?: "full" | "compact" | "inline";
}

export default function TierProgressBar({ currentSales, tiers = DEFAULT_TIERS, variant = "full" }: TierProgressProps) {
    const { currentTier, nextTier, progress, salesToNext } = useMemo(() => {
        // Find current tier (last tier where threshold <= currentSales)
        let current = tiers[0];
        let next: CommissionTier | null = null;

        for (let i = tiers.length - 1; i >= 0; i--) {
            if (currentSales >= tiers[i].threshold) {
                current = tiers[i];
                next = i < tiers.length - 1 ? tiers[i + 1] : null;
                break;
            }
        }

        // Calculate progress to next tier
        const prevThreshold = current.threshold;
        const nextThreshold = next ? next.threshold : current.threshold;
        const prog = next
            ? Math.min(100, ((currentSales - prevThreshold) / (nextThreshold - prevThreshold)) * 100)
            : 100;
        const remaining = next ? nextThreshold - currentSales : 0;

        return { currentTier: current, nextTier: next, progress: prog, salesToNext: remaining };
    }, [currentSales, tiers]);

    const style = TIER_STYLES[currentTier.label] || TIER_STYLES.Base;
    const TierIcon = style.icon;

    if (variant === "inline") {
        return (
            <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${style.badge}`}>
                    <TierIcon className="w-3 h-3" />
                    {currentTier.label}
                </span>
                <span className="text-[11px] font-bold text-[var(--text-primary)]">{currentTier.rate}%</span>
                {nextTier && (
                    <span className="text-[10px] text-[var(--text-quaternary)]">
                        {salesToNext} to {nextTier.rate}%
                    </span>
                )}
            </div>
        );
    }

    if (variant === "compact") {
        return (
            <div className={`p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)] ${style.glow}`}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center`}>
                            <TierIcon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-[var(--text-primary)]">{currentTier.label} Tier</p>
                            <p className="text-[10px] text-[var(--text-tertiary)]">{currentTier.rate}% commission</p>
                        </div>
                    </div>
                    {nextTier && (
                        <span className="text-[10px] font-bold text-[var(--text-quaternary)]">
                            {salesToNext} more → {nextTier.rate}%
                        </span>
                    )}
                </div>
                <div className="h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                    <div
                        className={`h-full rounded-full bg-gradient-to-r ${style.gradient} transition-all duration-1000 ease-out`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        );
    }

    // Full variant
    return (
        <div className={`p-8 rounded-[2rem] bg-[var(--bg-elevated)] border border-[var(--border-default)] ${style.glow}`}>
            {/* Current Tier Header */}
            <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${style.gradient} flex items-center justify-center shadow-lg`}>
                        <TierIcon className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-[var(--text-tertiary)] uppercase tracking-widest">Current Tier</p>
                        <h3 className="text-2xl font-black text-[var(--text-primary)]">{currentTier.label}</h3>
                        <p className="text-sm text-[var(--text-secondary)] font-semibold mt-0.5">
                            Earning <span className="text-[var(--text-primary)]">{currentTier.rate}%</span> commission per sale
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-3xl font-black text-[var(--text-primary)]">{currentSales}</p>
                    <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Total Sales</p>
                </div>
            </div>

            {/* Progress Bar */}
            {nextTier && (
                <div className="space-y-3 mb-8">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--text-secondary)]">{currentTier.label} ({currentTier.rate}%)</span>
                        <span className="text-xs font-bold text-[var(--text-tertiary)] flex items-center gap-1">
                            {nextTier.label} ({nextTier.rate}%)
                            <ChevronRight className="w-3 h-3" />
                        </span>
                    </div>
                    <div className="h-3 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                        <div
                            className={`h-full rounded-full bg-gradient-to-r ${style.gradient} transition-all duration-1000 ease-out`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-sm text-[var(--text-tertiary)] font-medium">
                        <span className="font-bold text-[var(--text-primary)]">{salesToNext} more sale{salesToNext !== 1 ? "s" : ""}</span> to unlock{" "}
                        <span className="font-bold text-[var(--text-primary)]">{nextTier.rate}%</span> commission
                    </p>
                </div>
            )}

            {/* Tier Ladder */}
            <div className="grid grid-cols-5 gap-1.5">
                {tiers.map((t, i) => {
                    const ts = TIER_STYLES[t.label] || TIER_STYLES.Base;
                    const isActive = currentSales >= t.threshold;
                    const isCurrent = t.label === currentTier.label;

                    return (
                        <div
                            key={t.label}
                            className={`relative p-3 rounded-xl text-center transition-all ${isCurrent
                                ? `bg-gradient-to-br ${ts.gradient} text-white shadow-lg`
                                : isActive
                                    ? "bg-[var(--bg-fill)] text-[var(--text-primary)]"
                                    : "bg-[var(--bg-secondary)]/50 text-[var(--text-quaternary)]"
                                }`}
                        >
                            <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t.label}</p>
                            <p className="text-lg font-black">{t.rate}%</p>
                            <p className="text-[9px] opacity-70">{t.threshold}+ sales</p>
                        </div>
                    );
                })}
            </div>

            {/* Max Tier Message */}
            {!nextTier && (
                <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-100 text-center">
                    <p className="text-sm font-bold text-cyan-700">
                        🏆 You've reached the highest tier! Maximum commission unlocked.
                    </p>
                </div>
            )}
        </div>
    );
}

export { DEFAULT_TIERS, type CommissionTier };
