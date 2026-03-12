"use client";

import { ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useReducedMotion, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface AppleHeroStatProps {
    label: string;
    value: string | number;
    trend?: {
        value: string;
        direction: "up" | "down" | "neutral";
    };
    subtitle?: string;
    liveIndicator?: boolean;
    cta?: { label: string; href: string };
    secondaryCta?: { label: string; href: string };
    loading?: boolean;
    noData?: boolean;
    className?: string;
    children?: ReactNode;
}

export function AppleHeroStat({
    label,
    value,
    trend,
    subtitle,
    liveIndicator,
    cta,
    secondaryCta,
    loading = false,
    noData = false,
    className,
    children,
}: AppleHeroStatProps) {
    const shouldReduceMotion = useReducedMotion();

    return (
        <div
            className={clsx("v-hero-card w-full py-8 px-6 sm:py-10 sm:px-8", className)}
            aria-busy={loading}
        >
            {loading ? (
                <HeroSkeleton />
            ) : (
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8">
                    {/* Left: main metric */}
                    <div>
                        {/* Live indicator + label row */}
                        <div className="flex items-center gap-2 mb-3">
                            {liveIndicator && <span className="v-live-dot" aria-label="Live" />}
                            <span className="v-label">{label}</span>
                        </div>

                        {/* Hero value */}
                        <motion.div
                            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                        >
                            <span
                                className="v-text-hero block"
                                style={{ color: noData ? "var(--v-text-tertiary)" : "var(--v-text-primary)" }}
                            >
                                {noData ? "—" : value}
                            </span>
                        </motion.div>

                        {/* Trend + subtitle row */}
                        <div className="flex items-center flex-wrap gap-3 mt-3">
                            {trend && !noData && (
                                <span
                                    className={clsx(
                                        "v-trend-chip text-[12px] px-3 py-1",
                                        trend.direction === "up" && "v-trend-up",
                                        trend.direction === "down" && "v-trend-down",
                                        trend.direction === "neutral" && "v-trend-neutral"
                                    )}
                                >
                                    {trend.direction === "up" && "↑ "}
                                    {trend.direction === "down" && "↓ "}
                                    {trend.value}
                                </span>
                            )}
                            {subtitle && (
                                <span
                                    className="text-[14px]"
                                    style={{ color: "var(--v-text-secondary)" }}
                                >
                                    {subtitle}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Right: CTA area or extra content */}
                    {(cta || secondaryCta || children) && (
                        <div className="flex items-center gap-3 shrink-0">
                            {secondaryCta && (
                                <Link
                                    href={secondaryCta.href}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold border border-[var(--v-border)] transition-colors"
                                    style={{ color: "var(--v-text-secondary)", background: "var(--v-elevated)" }}
                                >
                                    {secondaryCta.label}
                                </Link>
                            )}
                            {cta && (
                                <Link
                                    href={cta.href}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
                                    style={{ background: "var(--v-orange)", color: "#fff" }}
                                >
                                    {cta.label}
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            )}
                            {children}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function HeroSkeleton() {
    return (
        <div className="flex flex-col gap-3" aria-label="Loading...">
            <div className="v-skeleton h-3 w-20 rounded" />
            <div className="v-skeleton h-16 w-48 rounded-xl" />
            <div className="v-skeleton h-3 w-32 rounded" />
        </div>
    );
}

export default AppleHeroStat;
