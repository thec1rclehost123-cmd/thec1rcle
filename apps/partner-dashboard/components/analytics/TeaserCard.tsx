"use client";

import React from "react";
import { Lock, Sparkles, TrendingUp, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

interface TeaserCardProps {
    title: string;
    subtitle: string;
    metricLabel: string;
    icon: React.ElementType;
    accentColor?: string;
    accentBg?: string;
    blurredValue?: string;
}

export function TeaserCard({
    title,
    subtitle,
    metricLabel,
    icon: Icon,
    accentColor = "var(--v-orange)",
    accentBg = "rgba(244,74,34,0.1)",
    blurredValue = "84.2%",
}: TeaserCardProps) {
    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.01 }}
            className="group relative overflow-hidden rounded-[2rem] border flex flex-col p-6 min-h-[220px] transition-all duration-300"
            style={{ background: "var(--v-elevated)", borderColor: "var(--v-border)" }}
        >
            {/* Ambient glow on hover */}
            <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at top right, ${accentBg} 0%, transparent 60%)` }}
            />

            {/* Header */}
            <div className="flex items-start justify-between mb-auto relative z-10">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                    style={{ background: accentBg }}
                >
                    <Icon className="w-5 h-5" style={{ color: accentColor }} />
                </div>
                <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border"
                    style={{ background: "var(--v-neutral-bg)", borderColor: "var(--v-border)" }}
                >
                    <Lock className="w-2.5 h-2.5" style={{ color: accentColor, opacity: 0.8 }} />
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: accentColor, opacity: 0.8 }}>Pro</span>
                </div>
            </div>

            {/* Content */}
            <div className="mt-4 relative z-10">
                <h4
                    className="text-[10px] font-black uppercase tracking-[0.18em] mb-1.5"
                    style={{ color: "var(--v-text-muted)" }}
                >
                    {title}
                </h4>
                <div className="flex items-baseline gap-2">
                    <span
                        className="text-2xl font-black select-none"
                        style={{ color: accentColor, filter: "blur(6px)", opacity: 0.5 }}
                    >
                        {blurredValue}
                    </span>
                    <TrendingUp
                        className="w-4 h-4"
                        style={{ color: accentColor, filter: "blur(2px)", opacity: 0.3 }}
                    />
                </div>
                <p className="text-[12px] font-medium leading-relaxed mt-2" style={{ color: "var(--v-text-muted)" }}>
                    {subtitle}
                </p>
            </div>

            {/* CTA Overlay on Hover */}
            <div
                className="absolute inset-x-0 bottom-0 p-5 translate-y-full group-hover:translate-y-0 transition-transform duration-300 flex items-center justify-center"
                style={{ background: `linear-gradient(to top, var(--v-elevated) 60%, transparent)` }}
            >
                <button
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                    style={{ background: accentBg, color: accentColor, border: `1px solid ${accentColor}30` }}
                >
                    Unlock {metricLabel}
                    <ArrowRight className="w-3 h-3" />
                </button>
            </div>
        </motion.div>
    );
}
