"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronDown, Calendar, Activity, LayoutDashboard,
    CreditCard, Wallet, Settings, FileText, Banknote,
    Clock, TrendingUp, Users, ShieldCheck, Handshake,
    LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarFilterPopup } from "./CalendarFilterPopup";

export interface ExecutiveTab {
    key: string;
    label: string;
    icon: LucideIcon;
    badge?: number;
}

interface VenueExecutiveHeaderProps {
    title: string;
    statusLabel?: string;
    statusColor?: "emerald" | "amber" | "red";
    contextLabel?: string;
    tabs: ExecutiveTab[];
    activeTab: string;
    onTabChange: (key: string) => void;
    periods: Array<{ label: string; value: string }>;
    activePeriod: string;
    onPeriodChange: (value: string) => void;
    actions?: React.ReactNode;
    selectedDate?: Date | null;
    onDateSelect?: (date: Date | null) => void;
}

const DATE_FMT = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

export function VenueExecutiveHeader({
    title,
    statusLabel = "Running Well",
    statusColor = "emerald",
    contextLabel = "Global (All Items)",
    tabs,
    activeTab,
    onTabChange,
    periods,
    activePeriod,
    onPeriodChange,
    actions,
    selectedDate,
    onDateSelect,
}: VenueExecutiveHeaderProps) {
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
    const contextBtnRef = useRef<HTMLButtonElement>(null);

    function openCalendar() {
        if (contextBtnRef.current) {
            setTriggerRect(contextBtnRef.current.getBoundingClientRect());
        }
        setCalendarOpen(true);
    }

    const buttonLabel = selectedDate
        ? DATE_FMT.format(selectedDate)
        : contextLabel;

    return (
        <div className="sticky top-0 z-40 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10 border-b border-[var(--border-subtle)] backdrop-blur-2xl" style={{ background: "var(--bg-base)" }}>
            {/* Row 1: Context & Filters */}
            <div className="flex items-center justify-between h-14 md:h-16">
                <div className="flex items-center gap-4">
                    {/* Brand Icon */}
                    <div className="relative group">
                        <div className="absolute inset-0 bg-orange-500 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                        <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-[0_0_15px_rgba(244,74,34,0.4)]">
                            <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
                        </div>
                    </div>

                    {/* Title */}
                    <div className="flex items-center gap-3">
                        <h1 className="text-[13px] font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">
                            {title}
                        </h1>
                        <div className="w-px h-4 bg-[var(--border-default)]" />
                    </div>

                    {/* Status Pill */}
                    <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 transition-all hover:bg-emerald-500/10 group cursor-default">
                        <div className="relative">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 blur-sm opacity-60" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                            {statusLabel}
                        </span>
                    </div>

                    {/* Context Switcher — opens calendar */}
                    <button
                        ref={contextBtnRef}
                        onClick={openCalendar}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all group"
                        style={{
                            borderColor: selectedDate ? "var(--accent)" : "var(--border-subtle)",
                            background: selectedDate ? "var(--accent-muted)" : "var(--bg-fill)",
                        }}
                    >
                        <div className="w-6 h-6 rounded-lg bg-orange-500/10 flex items-center justify-center">
                            <Calendar className="w-3.5 h-3.5 text-orange-500" />
                        </div>
                        <span
                            className="text-[11px] font-bold transition-colors"
                            style={{ color: selectedDate ? "var(--accent)" : "var(--text-secondary)" }}
                        >
                            {buttonLabel}
                        </span>
                        <ChevronDown
                            className="w-3.5 h-3.5"
                            style={{ color: selectedDate ? "var(--accent)" : "var(--text-tertiary)" }}
                        />
                    </button>
                </div>

                {/* Actions & Period Controls */}
                <div className="flex items-center gap-3">
                    {actions && (
                        <div className="flex items-center gap-2 mr-2">
                            {actions}
                        </div>
                    )}
                    
                    <div className="p-1 rounded-xl bg-[var(--bg-fill)] border border-[var(--border-subtle)] flex items-center gap-0.5">
                        {periods.map((p) => {
                            const isActive = p.value === activePeriod;
                            return (
                                <button
                                    key={p.value}
                                    onClick={() => onPeriodChange(p.value)}
                                    className={cn(
                                        "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 relative overflow-hidden",
                                        isActive
                                            ? "text-white"
                                            : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-fill)]"
                                    )}
                                >
                                    {isActive && (
                                        <motion.div 
                                            layoutId="executive-period-bg"
                                            className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-600 shadow-[0_0_20px_rgba(244,74,34,0.4)]"
                                        />
                                    )}
                                    <span className="relative z-10">{p.label}</span>
                                </button>
                            );
                        })}
                    </div>
                    
                    <button className="w-9 h-9 flex items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-fill)] hover:bg-[var(--bg-fill)] transition-all text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)]">
                        <Calendar className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Row 2: Sub-navigation Tabs */}
            <div className="flex items-center gap-1 md:gap-2 pb-1 overflow-x-auto no-scrollbar scroll-smooth">
                {tabs.map((tab) => {
                    const isActive = tab.key === activeTab;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => onTabChange(tab.key)}
                            className={cn(
                                "flex items-center gap-2.5 px-4 py-3.5 border-b-2 transition-all duration-200 group relative shrink-0",
                                isActive
                                    ? "border-orange-500"
                                    : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                            )}
                        >
                            <Icon className={cn(
                                "w-3.5 h-3.5 transition-all duration-300",
                                isActive ? "text-orange-500 scale-110" : "opacity-50 group-hover:opacity-100"
                            )} />
                            <span className={cn(
                                "text-[11px] font-black uppercase tracking-[0.15em] transition-all duration-300",
                                isActive ? "text-[var(--text-primary)]" : ""
                            )}>
                                {tab.label}
                            </span>

                            {tab.badge !== undefined && tab.badge > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-orange-500 text-[8px] font-black text-white ml-[-4px] translate-y-[-6px]">
                                    {tab.badge}
                                </span>
                            )}

                            {isActive && (
                                <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-orange-500/10 to-transparent pointer-events-none" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Calendar popup portal */}
            <AnimatePresence>
                {calendarOpen && onDateSelect && (
                    <CalendarFilterPopup
                        selectedDate={selectedDate ?? null}
                        onDateSelect={(d) => {
                            onDateSelect(d);
                            setCalendarOpen(false);
                        }}
                        onClose={() => setCalendarOpen(false)}
                        triggerRect={triggerRect}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
