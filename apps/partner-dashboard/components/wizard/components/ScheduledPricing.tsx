"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Clock,
    Calendar,
    Plus,
    X,
    ChevronDown,
    ChevronUp,
    Sparkles,
    Zap
} from "lucide-react";

interface ScheduledPrice {
    id: string;
    name: string;
    price: number;
    startsAt: string;
    endsAt: string;
    quantityLimit?: number;
}

interface ScheduledPricingProps {
    basePrice: number;
    scheduledPrices: ScheduledPrice[];
    onChange: (prices: ScheduledPrice[]) => void;
    eventStartDate?: string;
    currency?: string;
}

// Preset templates
const PRICE_PRESETS = [
    { name: "Early Bird", discount: 20, duration: 7 },
    { name: "Regular", discount: 0, duration: null },
    { name: "Last Call", markup: 10, duration: 2 }
];

export function ScheduledPricing({
    basePrice,
    scheduledPrices,
    onChange,
    eventStartDate,
    currency = "₹"
}: ScheduledPricingProps) {
    const [expanded, setExpanded] = useState(scheduledPrices.length > 0);

    const addSchedule = () => {
        const now = new Date();
        const start = now.toISOString().slice(0, 16);
        const end = eventStartDate
            ? new Date(eventStartDate).toISOString().slice(0, 16)
            : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

        const newSchedule: ScheduledPrice = {
            id: Date.now().toString(),
            name: "",
            price: basePrice,
            startsAt: start,
            endsAt: end
        };

        onChange([...scheduledPrices, newSchedule]);
    };

    const updateSchedule = (id: string, updates: Partial<ScheduledPrice>) => {
        onChange(scheduledPrices.map(s =>
            s.id === id ? { ...s, ...updates } : s
        ));
    };

    const removeSchedule = (id: string) => {
        onChange(scheduledPrices.filter(s => s.id !== id));
    };

    const applyPreset = (presetType: 'early_bird' | 'last_call') => {
        const now = new Date();
        let newSchedules: ScheduledPrice[] = [];

        if (presetType === 'early_bird') {
            // Early Bird: 20% off, starts now, ends 7 days before event or in 7 days
            const earlyBirdEnd = eventStartDate
                ? new Date(new Date(eventStartDate).getTime() - 7 * 24 * 60 * 60 * 1000)
                : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            newSchedules = [{
                id: Date.now().toString(),
                name: "Early Bird",
                price: Math.round(basePrice * 0.8), // 20% off
                startsAt: now.toISOString().slice(0, 16),
                endsAt: earlyBirdEnd.toISOString().slice(0, 16)
            }];
        } else if (presetType === 'last_call') {
            // Last Call: 15% markup, starts 2 days before event
            if (eventStartDate) {
                const lastCallStart = new Date(new Date(eventStartDate).getTime() - 2 * 24 * 60 * 60 * 1000);

                newSchedules = [{
                    id: Date.now().toString(),
                    name: "Last Call",
                    price: Math.round(basePrice * 1.15), // 15% markup
                    startsAt: lastCallStart.toISOString().slice(0, 16),
                    endsAt: new Date(eventStartDate).toISOString().slice(0, 16)
                }];
            }
        }

        onChange([...scheduledPrices, ...newSchedules]);
    };

    const formatDateTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const getPriceChange = (price: number) => {
        if (price === basePrice) return null;
        const diff = price - basePrice;
        const percent = Math.round((diff / basePrice) * 100);
        return {
            diff,
            percent,
            isDiscount: diff < 0
        };
    };

    return (
        <div className="space-y-3">
            {/* Toggle Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff9500] to-[#ff3b30] flex items-center justify-center">
                        <Clock className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                        <p className="text-[13px] font-semibold text-[#1d1d1f]">
                            Scheduled Pricing
                        </p>
                        <p className="text-[11px] text-[#86868b]">
                            {scheduledPrices.length === 0
                                ? "Early bird, last call pricing"
                                : `${scheduledPrices.length} schedule(s) active`
                            }
                        </p>
                    </div>
                </div>
                {expanded ? (
                    <ChevronUp className="w-5 h-5 text-[#86868b]" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-[#86868b]" />
                )}
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-3 overflow-hidden"
                    >
                        {/* Quick Presets */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => applyPreset('early_bird')}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#ff9500]/30 bg-[#ff9500]/5 text-[#ff9500] text-[12px] font-semibold hover:bg-[#ff9500]/10 transition-colors"
                            >
                                <Sparkles className="w-3 h-3" />
                                Add Early Bird
                            </button>
                            {eventStartDate && (
                                <button
                                    onClick={() => applyPreset('last_call')}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#ff3b30]/30 bg-[#ff3b30]/5 text-[#ff3b30] text-[12px] font-semibold hover:bg-[#ff3b30]/10 transition-colors"
                                >
                                    <Zap className="w-3 h-3" />
                                    Add Last Call
                                </button>
                            )}
                        </div>

                        {/* Schedule List */}
                        {scheduledPrices.map((schedule, index) => {
                            const priceChange = getPriceChange(schedule.price);

                            return (
                                <motion.div
                                    key={schedule.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="p-4 rounded-xl border border-[rgba(0,0,0,0.08)] bg-white space-y-3"
                                >
                                    {/* Header */}
                                    <div className="flex items-center justify-between">
                                        <input
                                            type="text"
                                            value={schedule.name}
                                            onChange={(e) => updateSchedule(schedule.id, { name: e.target.value })}
                                            placeholder="e.g. Early Bird"
                                            className="text-[14px] font-semibold text-[#1d1d1f] bg-transparent focus:outline-none placeholder:text-[#86868b]/50"
                                        />
                                        <button
                                            onClick={() => removeSchedule(schedule.id)}
                                            className="w-6 h-6 rounded-full hover:bg-[#ff3b30]/10 flex items-center justify-center"
                                        >
                                            <X className="w-4 h-4 text-[#86868b] hover:text-[#ff3b30]" />
                                        </button>
                                    </div>

                                    {/* Price */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b]">
                                                {currency}
                                            </span>
                                            <input
                                                type="number"
                                                value={schedule.price}
                                                onChange={(e) => updateSchedule(schedule.id, { price: parseInt(e.target.value) || 0 })}
                                                className="w-full pl-7 pr-3 py-2 rounded-lg bg-[#f5f5f7] text-[15px] font-bold text-[#1d1d1f] focus:outline-none focus:bg-[#e8e8ed]"
                                            />
                                        </div>
                                        {priceChange && (
                                            <span className={`text-[12px] font-semibold px-2 py-1 rounded-full ${priceChange.isDiscount
                                                ? "text-[#34c759] bg-[#34c759]/10"
                                                : "text-[#ff3b30] bg-[#ff3b30]/10"
                                                }`}>
                                                {priceChange.isDiscount ? "" : "+"}{priceChange.percent}%
                                            </span>
                                        )}
                                    </div>

                                    {/* Date Range & Qty Limit */}
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-[#86868b] font-medium uppercase">
                                                    Starts
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    value={schedule.startsAt}
                                                    onChange={(e) => updateSchedule(schedule.id, { startsAt: e.target.value })}
                                                    className="w-full px-2 py-1.5 rounded-lg bg-[#f5f5f7] text-[12px] text-[#1d1d1f] focus:outline-none"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-[#86868b] font-medium uppercase">
                                                    Ends
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    value={schedule.endsAt}
                                                    onChange={(e) => updateSchedule(schedule.id, { endsAt: e.target.value })}
                                                    className="w-full px-2 py-1.5 rounded-lg bg-[#f5f5f7] text-[12px] text-[#1d1d1f] focus:outline-none"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between p-2 rounded-lg bg-[#f5f5f7]/50 border border-[rgba(0,0,0,0.04)]">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${schedule.quantityLimit ? "bg-[#007aff]" : "bg-[#86868b]/30"}`} />
                                                <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider">
                                                    Inventory Limit
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    placeholder="Unlimited"
                                                    value={schedule.quantityLimit || ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value === "" ? undefined : (parseInt(e.target.value) || 0);
                                                        updateSchedule(schedule.id, { quantityLimit: val });
                                                    }}
                                                    className="w-16 px-1.5 py-0.5 rounded-md bg-white border border-[rgba(0,0,0,0.06)] text-[11px] font-bold text-[#1d1d1f] focus:outline-none text-right"
                                                />
                                                <span className="text-[9px] text-[#86868b] font-medium uppercase tracking-tight">Tickets</span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}

                        {/* Add Custom Button */}
                        <button
                            onClick={addSchedule}
                            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-[rgba(0,0,0,0.08)] text-[13px] font-medium text-[#007aff] hover:border-[#007aff]/30 hover:bg-[#007aff]/5 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Custom Schedule
                        </button>

                        {/* Info */}
                        <p className="text-[11px] text-[#86868b] text-center">
                            Price shown to buyers depends on the active schedule at checkout time
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default ScheduledPricing;
