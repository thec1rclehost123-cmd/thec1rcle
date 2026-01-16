"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Ticket,
    Plus,
    X,
    Users,
    User,
    Heart,
    Crown,
    Percent,
    Sparkles,
    Trash2,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Clock
} from "lucide-react";
import { ScheduledPricing } from "./components/ScheduledPricing";
import { PromoCodeManager } from "./components/PromoCodeManager";

interface ScheduledPrice {
    id: string;
    name: string;
    price: number;
    startsAt: string;
    endsAt: string;
    quantityLimit?: number; // Apply price until X units sold
}

interface DefaultScheduledPrice {
    id: string;
    name: string;
    type: "discount" | "markup";
    value: number; // percentage
    startsAt: string;
    endsAt: string;
    quantityLimit?: number;
}

interface TicketTier {
    id: string;
    name: string;
    entryType: "stag" | "couple" | "female" | "general" | "vip" | "table";
    price: number | "";
    quantity: number | "";
    minPerOrder: number | "";
    maxPerOrder: number | "";
    promoterEnabled: boolean;
    // Per-tier override flags - if true, use tier's custom value instead of event default
    overrideCommission?: boolean;
    overrideDiscount?: boolean;
    overrideScheduledPricing?: boolean;
    promoterCommission?: number | "";
    promoterCommissionType?: "percent" | "amount";
    promoterDiscount?: number | "";
    promoterDiscountType?: "percent" | "amount";
    description?: string;
    salesStart?: string;
    salesEnd?: string;
    discounts?: any[];
    hidden?: boolean;
    scheduledPrices?: ScheduledPrice[];
}

interface TicketTierStepProps {
    formData: any;
    updateFormData: (updates: any) => void;
    validationErrors: Record<string, string>;
}

const ENTRY_TYPES = [
    { id: "general", label: "General", icon: Ticket, description: "Standard entry", defaultName: "General Admission" },
    { id: "stag", label: "Stag", icon: User, description: "Solo entry", defaultName: "Stag Entry" },
    { id: "couple", label: "Couple", icon: Heart, description: "Pair entry", defaultName: "Couple Entry" },
    { id: "female", label: "Female", icon: User, description: "Girl's entry", defaultName: "Female Entry" },
    { id: "vip", label: "VIP", icon: Crown, description: "Premium access", defaultName: "VIP Access" },
];

// Get all default names for comparison
const DEFAULT_NAMES = ENTRY_TYPES.map(t => t.defaultName);

function AppleInput({
    label,
    type = "text",
    value,
    onChange,
    placeholder,
    className = "",
    prefix,
    ...rest
}: any) {
    return (
        <div className={`space-y-1.5 ${className}`}>
            {label && (
                <label className="block text-[11px] font-medium text-[#86868b] uppercase tracking-wide">
                    {label}
                </label>
            )}
            <div className="relative">
                {prefix && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b]">
                        {prefix}
                    </span>
                )}
                <input
                    type={type}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    className={`w-full px-3 py-2.5 rounded-xl bg-[#f5f5f7] border border-transparent text-[15px] text-[#1d1d1f] placeholder:text-[#86868b]/50 focus:outline-none focus:border-[#007aff] focus:bg-white transition-all ${prefix ? "pl-7" : ""}`}
                    {...rest}
                />
            </div>
        </div>
    );
}

function TicketTierCard({
    tier,
    index,
    onUpdate,
    onRemove,
    canRemove,
    capacity,
    eventDefaultCommission,
    eventDefaultCommissionType,
    promotersEnabled,
    useDefaultCommission,
    buyerDiscountsEnabled,
    useDefaultDiscount,
    eventDefaultDiscount,
    eventDefaultDiscountType,
    eventStartDate,
    scheduledPricingEnabled,
    defaultScheduledPrices,
    isRSVP
}: {
    tier: TicketTier;
    index: number;
    onUpdate: (updates: Partial<TicketTier>) => void;
    onRemove: () => void;
    canRemove: boolean;
    capacity: number;
    eventDefaultCommission?: number | "";
    eventDefaultCommissionType?: "percent" | "amount";
    promotersEnabled?: boolean;
    useDefaultCommission?: boolean;
    buyerDiscountsEnabled?: boolean;
    useDefaultDiscount?: boolean;
    eventDefaultDiscount?: number | "";
    eventDefaultDiscountType?: "percent" | "amount";
    eventStartDate?: string;
    scheduledPricingEnabled?: boolean;
    defaultScheduledPrices?: DefaultScheduledPrice[];
    isRSVP?: boolean;
}) {
    const [expanded, setExpanded] = useState(false);

    const selectedEntryType = ENTRY_TYPES.find(t => t.id === tier.entryType) || ENTRY_TYPES[0];
    const EntryIcon = selectedEntryType.icon;

    // Helper to convert DefaultScheduledPrice (relative %) to ScheduledPrice (absolute ₹)
    const convertDefaultToScheduledPrice = (defaultPrice: DefaultScheduledPrice, basePrice: number): ScheduledPrice => {
        const price = defaultPrice.type === "discount"
            ? Math.round(basePrice * (1 - defaultPrice.value / 100))
            : Math.round(basePrice * (1 + defaultPrice.value / 100));

        return {
            id: defaultPrice.id,
            name: defaultPrice.name,
            startsAt: defaultPrice.startsAt,
            endsAt: defaultPrice.endsAt,
            quantityLimit: defaultPrice.quantityLimit,
            price
        };
    };

    // Calculate which default schedules are currently active (for UI display)
    const now = new Date();
    const activeDefaultSchedules = (defaultScheduledPrices || []).filter(s => {
        const start = new Date(s.startsAt);
        const end = new Date(s.endsAt);
        return now >= start && now <= end;
    });

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            className="card border-default transition-all hover:shadow-lg group/tier"
        >
            {/* Header */}
            <div className="p-6 flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-100 flex items-center justify-center text-white ring-4 ring-indigo-50">
                    <EntryIcon className="w-7 h-7" />
                </div>

                <div className="flex-1 min-w-0">
                    <input
                        type="text"
                        value={tier.name}
                        onChange={(e) => onUpdate({ name: e.target.value })}
                        placeholder="Ticket Tier Name"
                        className="w-full text-headline-sm bg-transparent focus:outline-none mb-0.5"
                        autoCapitalize="words"
                    />
                    <div className="flex items-center gap-3">
                        <span className="text-label uppercase tracking-widest text-[#4f46e5]">
                            {selectedEntryType.label}
                        </span>
                        <div className="w-1 h-1 rounded-full bg-stone-300" />
                        <span className="text-body-sm text-muted">
                            {tier.quantity} units available
                        </span>
                    </div>
                </div>

                <div className="text-right mr-2">
                    <p className={`text-stat-sm font-black ${isRSVP ? "text-[#4f46e5]" : "text-primary"}`}>
                        {isRSVP ? "FREE RSVP" : (tier.price === 0 ? "Free" : `₹${tier.price}`)}
                    </p>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="w-10 h-10 rounded-xl hover:surface-secondary flex items-center justify-center transition-all border border-transparent hover:border-default"
                    >
                        {expanded ? (
                            <ChevronUp className="w-5 h-5 text-muted" />
                        ) : (
                            <ChevronDown className="w-5 h-5 text-muted" />
                        )}
                    </button>

                    {canRemove && (
                        <button
                            onClick={onRemove}
                            className="w-10 h-10 rounded-xl hover:bg-rose-50 flex items-center justify-center text-muted hover:text-rose-600 transition-all border border-transparent hover:border-rose-100"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Expanded Content */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-[rgba(0,0,0,0.06)]"
                    >
                        <div className="p-4 space-y-4">
                            {/* Entry Type Selection */}
                            <div>
                                <label className="block text-[11px] font-medium text-[#86868b] uppercase tracking-wide mb-2">
                                    Entry Type
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {ENTRY_TYPES.map(type => {
                                        const Icon = type.icon;
                                        const isSelected = tier.entryType === type.id;
                                        return (
                                            <button
                                                key={type.id}
                                                onClick={() => {
                                                    const updates: any = { entryType: type.id };
                                                    // Auto-fill name if it's empty or was a previous auto-generated name
                                                    if (!tier.name || tier.name === "" || DEFAULT_NAMES.includes(tier.name)) {
                                                        updates.name = type.defaultName;
                                                    }
                                                    onUpdate(updates);
                                                }}
                                                className={`p-3 rounded-xl border text-left transition-all ${isSelected
                                                    ? "border-[#007aff] bg-[#007aff]/5"
                                                    : "border-[rgba(0,0,0,0.06)] hover:border-[rgba(0,0,0,0.12)]"
                                                    }`}
                                            >
                                                <Icon className={`w-4 h-4 mb-1 ${isSelected ? "text-[#007aff]" : "text-[#86868b]"}`} />
                                                <p className={`text-[13px] font-medium ${isSelected ? "text-[#007aff]" : "text-[#1d1d1f]"}`}>
                                                    {type.label}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Price and Quantity */}
                            <div className="grid grid-cols-2 gap-3">
                                {!isRSVP ? (
                                    <div className="space-y-1.5">
                                        <AppleInput
                                            label="Price"
                                            type="number"
                                            prefix="₹"
                                            value={tier.price}
                                            onChange={(e: any) => onUpdate({ price: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                                            min="0"
                                        />
                                        {tier.price === 0 && (
                                            <p className="text-[10px] text-[#34c759] font-medium flex items-center gap-1">
                                                <span>✓ Checkout Logic:</span>
                                                <span className="bg-[#34c759]/10 px-1 rounded">RSVP Mode</span>
                                                <span>(No Gateway)</span>
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <label className="block text-[11px] font-medium text-[#86868b] uppercase tracking-wide">
                                            Pricing
                                        </label>
                                        <div className="px-3 py-2.5 rounded-xl bg-[#007aff]/5 border border-[#007aff]/20 text-[14px] font-bold text-[#007aff] flex items-center justify-center">
                                            FREE RSVP
                                        </div>
                                    </div>
                                )}
                                <AppleInput
                                    label="Quantity"
                                    type="number"
                                    value={tier.quantity}
                                    onChange={(e: any) => onUpdate({ quantity: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                                    min="1"
                                    max={capacity}
                                />
                            </div>

                            {/* Scheduled Pricing (Early Bird, Last Call, etc.) - Override Pattern */}
                            {Number(tier.price) > 0 && scheduledPricingEnabled && (
                                <div className={`rounded-xl overflow-hidden transition-all ${tier.overrideScheduledPricing
                                    ? "bg-gradient-to-br from-[#ff6b35]/5 to-[#f7931e]/5 border border-[#ff6b35]/20"
                                    : "bg-[#f5f5f7]"
                                    }`}>
                                    {/* Scheduled Pricing Header - Clickable */}
                                    <button
                                        onClick={() => {
                                            const newOverrideState = !tier.overrideScheduledPricing;
                                            let newScheduledPrices: ScheduledPrice[] = [];
                                            if (newOverrideState) {
                                                // If enabling override, convert default prices to ScheduledPrice
                                                newScheduledPrices = (defaultScheduledPrices || []).map(dp =>
                                                    convertDefaultToScheduledPrice(dp, Number(tier.price) || 0)
                                                );
                                            }
                                            onUpdate({
                                                overrideScheduledPricing: newOverrideState,
                                                scheduledPrices: newScheduledPrices
                                            });
                                        }}
                                        className="w-full p-3 flex items-center justify-between text-left"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-[#ff6b35]" />
                                            <span className="text-[11px] font-bold text-[#ff6b35] uppercase tracking-wider">
                                                Scheduled Pricing
                                            </span>
                                            {tier.overrideScheduledPricing ? (
                                                <span className="text-[9px] bg-[#ff6b35] text-white px-1.5 py-0.5 rounded-full font-semibold">
                                                    CUSTOM
                                                </span>
                                            ) : (
                                                <span className="text-[9px] bg-[#86868b]/20 text-[#86868b] px-1.5 py-0.5 rounded-full font-semibold">
                                                    DEFAULT
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[12px] text-[#86868b]">
                                            {tier.overrideScheduledPricing
                                                ? `${(tier.scheduledPrices || []).length} custom schedule(s)`
                                                : `${(defaultScheduledPrices || []).length} default schedule(s) (${activeDefaultSchedules.length} active)`
                                            }
                                        </span>
                                    </button>

                                    {/* Custom Override Editor */}
                                    {tier.overrideScheduledPricing && (
                                        <div className="px-3 pb-3">
                                            <ScheduledPricing
                                                basePrice={Number(tier.price) || 0}
                                                scheduledPrices={tier.scheduledPrices || []}
                                                onChange={(prices) => onUpdate({ scheduledPrices: prices })}
                                                eventStartDate={eventStartDate}
                                                currency="₹"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Ticket Description Note */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-medium text-[#86868b] uppercase tracking-wide">
                                    Ticket Note (Optional Description)
                                </label>
                                <textarea
                                    value={tier.description || ""}
                                    onChange={(e) => onUpdate({ description: e.target.value })}
                                    placeholder="e.g. Includes one free drink"
                                    className="w-full px-3 py-2.5 rounded-xl bg-[#f5f5f7] border border-transparent text-[14px] text-[#1d1d1f] placeholder:text-[#86868b]/50 focus:outline-none focus:border-[#007aff] focus:bg-white transition-all min-h-[60px] resize-none"
                                    autoCapitalize="sentences"
                                />
                                <p className="text-[10px] text-[#86868b]">
                                    This will appear as a subtle information icon next to the ticket on the website.
                                </p>
                            </div>

                            {/* Order Limits Removed from per-tier - Centralized now */}

                            {/* Promoter Settings - Only show if global promoters enabled */}
                            {promotersEnabled && (
                                <div className="space-y-4">
                                    {/* Per-tier enable toggle */}
                                    <div className="p-3 rounded-xl bg-[#f5f5f7] flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Percent className="w-4 h-4 text-[#86868b]" />
                                            <div>
                                                <p className="text-[13px] font-medium text-[#1d1d1f]">
                                                    Promoter Sales
                                                </p>
                                                <p className="text-[11px] text-[#86868b]">
                                                    Allow promoters to sell this tier
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onUpdate({ promoterEnabled: !tier.promoterEnabled })}
                                            className={`w-12 h-7 rounded-full relative transition-colors ${tier.promoterEnabled ? "bg-[#34c759]" : "bg-[rgba(0,0,0,0.1)]"
                                                }`}
                                        >
                                            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${tier.promoterEnabled ? "translate-x-[22px]" : "translate-x-0.5"
                                                }`} />
                                        </button>
                                    </div>

                                    {tier.promoterEnabled && (
                                        <div className="space-y-3">
                                            {/* ─── Commission ─── */}
                                            <div className={`rounded-xl overflow-hidden transition-all ${tier.overrideCommission
                                                ? "bg-[#F44A22]/5 border border-[#F44A22]/20"
                                                : "bg-[#f5f5f7]"
                                                }`}>
                                                {/* Commission Header - Always Clickable */}
                                                <button
                                                    onClick={() => onUpdate({
                                                        overrideCommission: !tier.overrideCommission,
                                                        promoterCommission: tier.overrideCommission ? "" : (eventDefaultCommission || 15),
                                                        promoterCommissionType: tier.overrideCommission ? "percent" : (eventDefaultCommissionType || "percent")
                                                    })}
                                                    className="w-full p-3 flex items-center justify-between text-left"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] font-bold text-[#F44A22] uppercase tracking-wider">
                                                            Commission
                                                        </span>
                                                        {tier.overrideCommission ? (
                                                            <span className="text-[9px] bg-[#F44A22] text-white px-1.5 py-0.5 rounded-full font-semibold">
                                                                CUSTOM
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9px] bg-[#86868b]/20 text-[#86868b] px-1.5 py-0.5 rounded-full font-semibold">
                                                                DEFAULT
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className={`text-[13px] font-semibold ${tier.overrideCommission ? "text-[#F44A22]" : "text-[#1d1d1f]"}`}>
                                                        {tier.overrideCommission
                                                            ? `${tier.promoterCommission || 0}${(tier.promoterCommissionType || "percent") === "percent" ? "%" : "₹"}`
                                                            : `${eventDefaultCommission || 15}${(eventDefaultCommissionType || "percent") === "percent" ? "%" : "₹"}`
                                                        }
                                                    </span>
                                                </button>

                                                {/* Custom Commission Editor - Only if overriding */}
                                                {tier.overrideCommission && (
                                                    <div className="px-3 pb-3 space-y-2">
                                                        <div className="flex gap-2">
                                                            <div className="flex p-0.5 bg-white rounded-lg border border-[#F44A22]/20">
                                                                <button
                                                                    onClick={() => onUpdate({ promoterCommissionType: "percent" })}
                                                                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${(tier.promoterCommissionType || "percent") === "percent"
                                                                        ? "bg-[#F44A22] text-white"
                                                                        : "text-[#86868b]"
                                                                        }`}
                                                                >
                                                                    %
                                                                </button>
                                                                <button
                                                                    onClick={() => onUpdate({ promoterCommissionType: "amount" })}
                                                                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${tier.promoterCommissionType === "amount"
                                                                        ? "bg-[#1d1d1f] text-white"
                                                                        : "text-[#86868b]"
                                                                        }`}
                                                                >
                                                                    ₹
                                                                </button>
                                                            </div>
                                                            <input
                                                                type="number"
                                                                value={tier.promoterCommission}
                                                                onChange={(e) => onUpdate({ promoterCommission: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                                                                placeholder="15"
                                                                className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-[#F44A22]/20 text-[14px] font-bold text-[#1d1d1f] focus:outline-none focus:border-[#F44A22]"
                                                            />
                                                        </div>
                                                        <p className="text-[10px] text-[#86868b]">
                                                            Promoters earn {tier.promoterCommission || 0}{(tier.promoterCommissionType || "percent") === "percent" ? "%" : "₹"} for this tier
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* ─── Buyer Discount - Hidden for RSVP as price is 0 ─── */}
                                            {!isRSVP && buyerDiscountsEnabled && (
                                                <div className={`rounded-xl overflow-hidden transition-all ${tier.overrideDiscount
                                                    ? "bg-[#34c759]/5 border border-[#34c759]/20"
                                                    : "bg-[#f5f5f7]"
                                                    }`}>
                                                    {/* Discount Header - Always Clickable */}
                                                    <button
                                                        onClick={() => onUpdate({
                                                            overrideDiscount: !tier.overrideDiscount,
                                                            promoterDiscount: tier.overrideDiscount ? "" : (eventDefaultDiscount || 10),
                                                            promoterDiscountType: tier.overrideDiscount ? "percent" : (eventDefaultDiscountType || "percent")
                                                        })}
                                                        className="w-full p-3 flex items-center justify-between text-left"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[11px] font-bold text-[#34c759] uppercase tracking-wider">
                                                                Buyer Discount
                                                            </span>
                                                            {tier.overrideDiscount ? (
                                                                <span className="text-[9px] bg-[#34c759] text-white px-1.5 py-0.5 rounded-full font-semibold">
                                                                    CUSTOM
                                                                </span>
                                                            ) : (
                                                                <span className="text-[9px] bg-[#86868b]/20 text-[#86868b] px-1.5 py-0.5 rounded-full font-semibold">
                                                                    DEFAULT
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className={`text-[13px] font-semibold ${tier.overrideDiscount ? "text-[#34c759]" : "text-[#1d1d1f]"}`}>
                                                            {tier.overrideDiscount
                                                                ? `${tier.promoterDiscount || 0}${(tier.promoterDiscountType || "percent") === "percent" ? "%" : "₹"} off`
                                                                : `${eventDefaultDiscount || 10}${(eventDefaultDiscountType || "percent") === "percent" ? "%" : "₹"} off`
                                                            }
                                                        </span>
                                                    </button>

                                                    {/* Custom Discount Editor - Only if overriding */}
                                                    {tier.overrideDiscount && (
                                                        <div className="px-3 pb-3 space-y-2">
                                                            <div className="flex gap-2">
                                                                <div className="flex p-0.5 bg-white rounded-lg border border-[#34c759]/20">
                                                                    <button
                                                                        onClick={() => onUpdate({ promoterDiscountType: "percent" })}
                                                                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${(tier.promoterDiscountType || "percent") === "percent"
                                                                            ? "bg-[#34c759] text-white"
                                                                            : "text-[#86868b]"
                                                                            }`}
                                                                    >
                                                                        %
                                                                    </button>
                                                                    <button
                                                                        onClick={() => onUpdate({ promoterDiscountType: "amount" })}
                                                                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${tier.promoterDiscountType === "amount"
                                                                            ? "bg-[#1d1d1f] text-white"
                                                                            : "text-[#86868b]"
                                                                            }`}
                                                                    >
                                                                        ₹
                                                                    </button>
                                                                </div>
                                                                <input
                                                                    type="number"
                                                                    value={tier.promoterDiscount}
                                                                    onChange={(e) => onUpdate({ promoterDiscount: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                                                                    placeholder="10"
                                                                    className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-[#34c759]/20 text-[14px] font-bold text-[#1d1d1f] focus:outline-none focus:border-[#34c759]"
                                                                />
                                                            </div>
                                                            <p className="text-[10px] text-[#86868b]">
                                                                Buyers get {tier.promoterDiscount || 0}{(tier.promoterDiscountType || "percent") === "percent" ? "%" : "₹"} off via promoter links
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export function TicketTierStep({ formData, updateFormData, validationErrors }: TicketTierStepProps) {
    const tickets: TicketTier[] = formData.tickets || [];
    const capacity = formData.capacity || 500;

    const totalTickets = tickets.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0);
    const inventoryValue = tickets.reduce((sum, t) => sum + (Number(t.price) * Number(t.quantity) || 0), 0);
    const capacityUsage = capacity > 0 ? Math.round((totalTickets / capacity) * 100) : 0;

    const updateTicket = (index: number, updates: Partial<TicketTier>) => {
        const newTickets = [...tickets];
        newTickets[index] = { ...newTickets[index], ...updates };
        updateFormData({ tickets: newTickets });
    };

    const removeTicket = (index: number) => {
        const newTickets = tickets.filter((_, i) => i !== index);
        updateFormData({ tickets: newTickets });
    };

    const addTicket = () => {
        const newTicket: TicketTier = {
            id: Date.now().toString(),
            name: "",
            entryType: "general",
            price: 0,
            quantity: 50,
            minPerOrder: 1,
            maxPerOrder: 10,
            promoterEnabled: true,
            promoterCommissionType: formData.isRSVP ? "amount" : "percent",
            promoterCommission: formData.isRSVP ? 0 : 15
        };
        updateFormData({ tickets: [...tickets, newTicket] });
    };

    return (
        <div className="space-y-6">


            {/* ─── RSVP Toggle ─── */}
            <div className="p-6 rounded-[2rem] border border-stone-200 bg-white/50 backdrop-blur-sm shadow-sm transition-all hover:shadow-md group">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors duration-500 ${formData.isRSVP
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                            : "bg-stone-100 text-stone-400"
                            }`}>
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[15px] font-bold text-primary">RSVP Mode</p>
                            <p className="text-[12px] text-stone-500">Enable for guestlists and free registrations</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            const newIsRSVP = !formData.isRSVP;
                            const updates: any = { isRSVP: newIsRSVP };
                            if (newIsRSVP) {
                                updates.scheduledPricingEnabled = false;
                                updates.tickets = (formData.tickets || []).map((t: any) => ({
                                    ...t,
                                    price: 0,
                                    promoterCommissionType: "amount",
                                    promoterCommission: t.promoterCommission ?? 0
                                }));
                                updates.minTicketsPerOrder = 1;
                                updates.maxTicketsPerOrder = 1;
                                updates.commissionType = "amount";
                                updates.buyerDiscountsEnabled = false;
                            }
                            updateFormData(updates);
                        }}
                        className={`w-14 h-8 rounded-full relative transition-all duration-300 border ${formData.isRSVP ? "bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-100" : "bg-stone-200 border-stone-300"}`}
                    >
                        <motion.div
                            className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-sm"
                            animate={{ x: formData.isRSVP ? 24 : 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                    </button>
                </div>
            </div>

            {/* Promoter Sales Settings */}
            <div className="p-8 rounded-[2.5rem] border border-stone-200 bg-white shadow-sm space-y-8">
                {/* Master Toggle: Promoter Sales */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors duration-500 ${formData.promotersEnabled
                            ? "bg-[#F44A22] text-white shadow-lg shadow-orange-100"
                            : "bg-stone-100 text-stone-400"
                            }`}>
                            <Percent className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[15px] font-bold text-primary">Promoter Sales</p>
                            <p className="text-[12px] text-stone-500">Allow ambassadors and promoters to sell your tickets</p>
                        </div>
                    </div>
                    <button
                        onClick={() => updateFormData({ promotersEnabled: !formData.promotersEnabled })}
                        className={`w-14 h-8 rounded-full relative transition-all duration-300 border ${formData.promotersEnabled ? "bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-100" : "bg-stone-200 border-stone-300"}`}
                    >
                        <motion.div
                            className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-sm"
                            animate={{ x: formData.promotersEnabled ? 24 : 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                    </button>
                </div>

                {/* If Promoter Sales ON, show commission and discount settings */}
                {formData.promotersEnabled && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="pt-8 border-t border-stone-100 space-y-8"
                    >
                        {/* ─── Commission Section ─── */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-1">
                                <p className="text-label font-black uppercase tracking-widest text-[#F44A22]">Promoter Commission</p>
                                <div className="px-3 py-1 rounded-full bg-orange-50 text-[#F44A22] text-[9px] font-black tracking-widest uppercase border border-orange-100">
                                    Promoter Payouts
                                </div>
                            </div>

                            {/* Sub-Toggle: Use Default Commission */}
                            <div className="flex items-center justify-between p-5 rounded-[1.5rem] bg-stone-50 border border-stone-100">
                                <div className="space-y-0.5">
                                    <p className="text-body-sm font-bold text-primary">Standardize Promoter Commission</p>
                                    <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest">
                                        {formData.useDefaultCommission !== false
                                            ? "Same rate for all tickets"
                                            : "Custom rates per ticket tier"
                                        }
                                    </p>
                                </div>
                                <button
                                    onClick={() => updateFormData({ useDefaultCommission: formData.useDefaultCommission === false })}
                                    className={`w-14 h-8 rounded-full relative transition-all duration-300 border ${formData.useDefaultCommission !== false ? "bg-[#F44A22] border-[#F44A22] shadow-lg shadow-orange-100" : "bg-stone-200 border-stone-300"}`}
                                >
                                    <motion.div
                                        className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-sm"
                                        animate={{ x: formData.useDefaultCommission !== false ? 24 : 0 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    />
                                </button>
                            </div>

                            {/* Default Commission Rate Input */}
                            {formData.useDefaultCommission !== false && (
                                <div className="p-6 rounded-[2rem] bg-stone-50 border border-stone-100 flex items-center justify-between gap-6">
                                    <div className="space-y-1">
                                        <p className="text-body-sm font-bold">Default Promoter Commission</p>
                                        <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest">Applied to all new entries</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex p-1 bg-white rounded-xl border border-stone-100 shadow-sm">
                                            <button
                                                onClick={() => updateFormData({ commissionType: "percent" })}
                                                className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${(formData.commissionType || "percent") === "percent"
                                                    ? "bg-[#F44A22] text-white shadow-md"
                                                    : "text-stone-400 hover:text-primary"
                                                    }`}
                                            >
                                                %
                                            </button>
                                            <button
                                                onClick={() => updateFormData({ commissionType: "amount" })}
                                                className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${formData.commissionType === "amount"
                                                    ? "bg-stone-900 text-white shadow-md"
                                                    : "text-stone-400 hover:text-primary"
                                                    }`}
                                            >
                                                ₹
                                            </button>
                                        </div>
                                        <div className="relative w-24">
                                            <input
                                                type="number"
                                                value={formData.commission}
                                                onChange={(e) => updateFormData({ commission: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                                                className="w-full h-12 bg-white border border-stone-100 rounded-xl px-4 text-center font-bold text-primary focus:outline-none focus:ring-4 focus:ring-orange-50"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {formData.useDefaultCommission === false && (
                                <div className="flex items-center gap-3 p-4 rounded-2xl bg-stone-50 border border-stone-100 text-[11px] text-stone-500 font-medium">
                                    <Sparkles className="w-4 h-4 text-[#F44A22]" />
                                    Define granular payouts within each ticket matrix entry below.
                                </div>
                            )}
                        </div>

                        {/* ─── Buyer Discount Section - Hidden for RSVP ─── */}
                        {!formData.isRSVP && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between px-1">
                                    <p className="text-label font-black uppercase tracking-widest text-[#34c759]">Buyer Discounts</p>
                                    <div className="px-3 py-1 rounded-full bg-emerald-50 text-[#34c759] text-[9px] font-black tracking-widest uppercase border border-emerald-100">
                                        Promoter Benefits
                                    </div>
                                </div>

                                {/* Master Toggle: Buyer Discounts */}
                                <div className="flex items-center justify-between p-5 rounded-[1.5rem] bg-stone-50 border border-stone-100">
                                    <div className="space-y-0.5">
                                        <p className="text-body-sm font-bold">Incentivize Buyer Sales</p>
                                        <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest">Offer discounts on promoter links</p>
                                    </div>
                                    <button
                                        onClick={() => updateFormData({ buyerDiscountsEnabled: !formData.buyerDiscountsEnabled })}
                                        className={`w-14 h-8 rounded-full relative transition-all duration-300 border ${formData.buyerDiscountsEnabled ? "bg-[#34c759] border-[#34c759] shadow-lg shadow-emerald-100" : "bg-stone-200 border-stone-300"}`}
                                    >
                                        <motion.div
                                            className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-sm"
                                            animate={{ x: formData.buyerDiscountsEnabled ? 24 : 0 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    </button>
                                </div>

                                {formData.buyerDiscountsEnabled && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        className="space-y-6"
                                    >
                                        {/* Sub-Toggle: Use Default Discount */}
                                        <div className="flex items-center justify-between p-5 rounded-[1.5rem] bg-stone-50 border border-stone-100">
                                            <div className="space-y-0.5">
                                                <p className="text-body-sm font-bold">Standardize Buyer Discounts</p>
                                                <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest">
                                                    {formData.useDefaultDiscount !== false
                                                        ? "Universal discount rate"
                                                        : "Tier-specific discounts"
                                                    }
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => updateFormData({ useDefaultDiscount: formData.useDefaultDiscount === false })}
                                                className={`w-14 h-8 rounded-full relative transition-all duration-300 border ${formData.useDefaultDiscount !== false ? "bg-[#34c759] border-[#34c759] shadow-lg shadow-emerald-100" : "bg-stone-200 border-stone-300"}`}
                                            >
                                                <motion.div
                                                    className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-sm"
                                                    animate={{ x: formData.useDefaultDiscount !== false ? 24 : 0 }}
                                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                />
                                            </button>
                                        </div>

                                        {/* Default Discount Rate Input */}
                                        {formData.useDefaultDiscount !== false && (
                                            <div className="p-6 rounded-[2rem] bg-stone-50 border border-stone-100 flex items-center justify-between gap-6">
                                                <div className="space-y-1">
                                                    <p className="text-body-sm font-bold">Default Buyer Discount</p>
                                                    <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest">Applied to all tiers</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex p-1 bg-white rounded-xl border border-stone-100 shadow-sm">
                                                        <button
                                                            onClick={() => updateFormData({ discountType: "percent" })}
                                                            className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${(formData.discountType || "percent") === "percent"
                                                                ? "bg-[#34c759] text-white shadow-md"
                                                                : "text-stone-400 hover:text-primary"
                                                                }`}
                                                        >
                                                            %
                                                        </button>
                                                        <button
                                                            onClick={() => updateFormData({ discountType: "amount" })}
                                                            className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${formData.discountType === "amount"
                                                                ? "bg-stone-900 text-white shadow-md"
                                                                : "text-stone-400 hover:text-primary"
                                                                }`}
                                                        >
                                                            ₹
                                                        </button>
                                                    </div>
                                                    <div className="relative w-24">
                                                        <input
                                                            type="number"
                                                            value={formData.discount}
                                                            onChange={(e) => updateFormData({ discount: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                                                            className="w-full h-12 bg-white border border-stone-100 rounded-xl px-4 text-center font-bold text-primary focus:outline-none focus:ring-4 focus:ring-emerald-50"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </div>

            {!formData.isRSVP && (
                <>
                    {/* Event-Level Scheduled Pricing */}
                    <div className="p-5 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-white shadow-sm space-y-4">
                        {/* Master Toggle: Scheduled Pricing */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${formData.scheduledPricingEnabled
                                    ? "bg-gradient-to-br from-[#ff6b35] to-[#f7931e] text-white shadow-xl shadow-orange-100 ring-4 ring-orange-50"
                                    : "bg-stone-100 text-stone-400"
                                    }`}>
                                    <Clock className="w-6 h-6" />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[15px] font-bold text-primary">Dynamic Pricing</p>
                                    <p className="text-[12px] text-stone-500 font-medium">Early Bird & Last Call scheduling</p>
                                </div>
                            </div>
                            <button
                                onClick={() => updateFormData({ scheduledPricingEnabled: !formData.scheduledPricingEnabled })}
                                className={`w-14 h-8 rounded-full relative transition-all duration-300 border ${formData.scheduledPricingEnabled ? "bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-100" : "bg-stone-200 border-stone-300"}`}
                            >
                                <motion.div
                                    className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-sm"
                                    animate={{ x: formData.scheduledPricingEnabled ? 24 : 0 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            </button>
                        </div>

                        {/* If Scheduled Pricing ON, show the settings */}
                        {formData.scheduledPricingEnabled && (
                            <div className="pt-4 border-t border-[rgba(0,0,0,0.06)] space-y-4">
                                {/* Quick Presets */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            const now = new Date();
                                            const earlyBirdEnd = formData.startDate
                                                ? new Date(new Date(formData.startDate).getTime() - 3 * 24 * 60 * 60 * 1000)
                                                : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

                                            const newSchedule: DefaultScheduledPrice = {
                                                id: `eb-${Date.now()}`,
                                                name: "Early Bird",
                                                type: "discount",
                                                value: 20,
                                                startsAt: now.toISOString().slice(0, 16),
                                                endsAt: earlyBirdEnd.toISOString().slice(0, 16)
                                            };
                                            updateFormData({
                                                defaultScheduledPrices: [...(formData.defaultScheduledPrices || []), newSchedule]
                                            });
                                        }}
                                        className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-[#ff6b35]/30 text-[#ff6b35] font-semibold text-[12px] hover:bg-[#ff6b35]/5 transition-colors"
                                    >
                                        ✨ Add Early Bird (20% Off)
                                    </button>
                                    <button
                                        onClick={() => {
                                            const eventDate = formData.startDate ? new Date(formData.startDate) : new Date();
                                            const lastCallStart = new Date(eventDate.getTime() - 2 * 24 * 60 * 60 * 1000);

                                            const newSchedule: DefaultScheduledPrice = {
                                                id: `lc-${Date.now()}`,
                                                name: "Last Call",
                                                type: "markup",
                                                value: 15,
                                                startsAt: lastCallStart.toISOString().slice(0, 16),
                                                endsAt: eventDate.toISOString().slice(0, 16)
                                            };
                                            updateFormData({
                                                defaultScheduledPrices: [...(formData.defaultScheduledPrices || []), newSchedule]
                                            });
                                        }}
                                        className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-[#ff3b30]/30 text-[#ff3b30] font-semibold text-[12px] hover:bg-[#ff3b30]/5 transition-colors"
                                    >
                                        ⚡ Add Last Call (15% Up)
                                    </button>
                                </div>

                                {/* Current Schedules List (Editable) */}
                                <div className="space-y-3">
                                    {(formData.defaultScheduledPrices || []).map((schedule: DefaultScheduledPrice) => (
                                        <div
                                            key={schedule.id}
                                            className={`p-4 rounded-xl border-2 space-y-3 ${schedule.type === "discount"
                                                ? "bg-[#34c759]/5 border-[#34c759]/10"
                                                : "bg-[#ff3b30]/5 border-[#ff3b30]/10"
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 flex-grow">
                                                    <input
                                                        type="text"
                                                        value={schedule.name}
                                                        onChange={(e) => {
                                                            const updated = formData.defaultScheduledPrices.map((s: DefaultScheduledPrice) =>
                                                                s.id === schedule.id ? { ...s, name: e.target.value } : s
                                                            );
                                                            updateFormData({ defaultScheduledPrices: updated });
                                                        }}
                                                        className="bg-transparent font-bold text-[14px] text-[#1d1d1f] focus:outline-none w-full"
                                                        placeholder="Schedule Name"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const updated = formData.defaultScheduledPrices.filter((s: DefaultScheduledPrice) => s.id !== schedule.id);
                                                        updateFormData({ defaultScheduledPrices: updated });
                                                    }}
                                                    className="text-[#86868b] hover:text-[#ff3b30]"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="flex p-0.5 bg-white rounded-lg border border-[rgba(0,0,0,0.06)]">
                                                    <button
                                                        onClick={() => {
                                                            const updated = formData.defaultScheduledPrices.map((s: DefaultScheduledPrice) =>
                                                                s.id === schedule.id ? { ...s, type: "discount" } : s
                                                            );
                                                            updateFormData({ defaultScheduledPrices: updated });
                                                        }}
                                                        className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${schedule.type === "discount" ? "bg-[#34c759] text-white" : "text-[#86868b]"
                                                            }`}
                                                    >
                                                        DISCOUNT
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const updated = formData.defaultScheduledPrices.map((s: DefaultScheduledPrice) =>
                                                                s.id === schedule.id ? { ...s, type: "markup" } : s
                                                            );
                                                            updateFormData({ defaultScheduledPrices: updated });
                                                        }}
                                                        className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${schedule.type === "markup" ? "bg-[#ff3b30] text-white" : "text-[#86868b]"
                                                            }`}
                                                    >
                                                        MARKUP
                                                    </button>
                                                </div>
                                                <div className="relative flex-grow">
                                                    <input
                                                        type="number"
                                                        value={schedule.value}
                                                        onChange={(e) => {
                                                            const updated = formData.defaultScheduledPrices.map((s: DefaultScheduledPrice) =>
                                                                s.id === schedule.id ? { ...s, value: parseInt(e.target.value) || 0 } : s
                                                            );
                                                            updateFormData({ defaultScheduledPrices: updated });
                                                        }}
                                                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-[rgba(0,0,0,0.06)] text-[14px] font-bold text-[#1d1d1f] focus:outline-none"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#86868b]">%</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] text-[#86868b] font-bold uppercase">Starts</label>
                                                    <input
                                                        type="datetime-local"
                                                        value={schedule.startsAt}
                                                        onChange={(e) => {
                                                            const updated = formData.defaultScheduledPrices.map((s: DefaultScheduledPrice) =>
                                                                s.id === schedule.id ? { ...s, startsAt: e.target.value } : s
                                                            );
                                                            updateFormData({ defaultScheduledPrices: updated });
                                                        }}
                                                        className="w-full px-2 py-1.5 rounded-lg bg-white border border-[rgba(0,0,0,0.06)] text-[11px] text-[#1d1d1f] focus:outline-none"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] text-[#86868b] font-bold uppercase">Ends</label>
                                                    <input
                                                        type="datetime-local"
                                                        value={schedule.endsAt}
                                                        onChange={(e) => {
                                                            const updated = formData.defaultScheduledPrices.map((s: DefaultScheduledPrice) =>
                                                                s.id === schedule.id ? { ...s, endsAt: e.target.value } : s
                                                            );
                                                            updateFormData({ defaultScheduledPrices: updated });
                                                        }}
                                                        className="w-full px-2 py-1.5 rounded-lg bg-white border border-[rgba(0,0,0,0.06)] text-[12px] text-[#1d1d1f] focus:outline-none"
                                                    />
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t border-[rgba(0,0,0,0.06)]">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${schedule.quantityLimit ? "bg-[#007aff]" : "bg-[#86868b]/30"}`} />
                                                        <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider">
                                                            Apply to first (qty)
                                                        </label>
                                                    </div>
                                                    <div className="relative w-24">
                                                        <input
                                                            type="number"
                                                            placeholder="All"
                                                            value={schedule.quantityLimit || ""}
                                                            onChange={(e) => {
                                                                const val = e.target.value === "" ? undefined : (parseInt(e.target.value) || 0);
                                                                const updated = formData.defaultScheduledPrices.map((s: DefaultScheduledPrice) =>
                                                                    s.id === schedule.id ? { ...s, quantityLimit: val } : s
                                                                );
                                                                updateFormData({ defaultScheduledPrices: updated });
                                                            }}
                                                            className="w-full px-2 py-1 rounded-lg bg-white border border-[rgba(0,0,0,0.06)] text-[12px] font-bold text-[#1d1d1f] focus:outline-none text-right"
                                                        />
                                                    </div>
                                                </div>
                                                <p className="text-[9px] text-[#86868b] mt-1 text-right italic">
                                                    Price expires after quantity limit OR end date (whichever first)
                                                </p>
                                            </div>
                                        </div>
                                    )
                                    )}
                                </div>
                                {!formData.defaultScheduledPrices?.length && (
                                    <p className="text-center text-[12px] text-[#86868b] py-4">
                                        No generic schedules active. Tiers will use their regular prices.
                                    </p>
                                )}

                                <p className="text-[11px] text-[#86868b] p-3 rounded-lg bg-[#f5f5f7]">
                                    💡 These price schedules apply to <strong>all ticket tiers</strong> by default. You can override for specific tiers below.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Centralized Order Limits */}
                    {!formData.isRSVP && (
                        <div className="p-5 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-white shadow-sm space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center text-black/40">
                                    <Users className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[15px] font-semibold text-[#1d1d1f]">Booking Limits</p>
                                    <p className="text-[12px] text-[#86868b]">Set min/max tickets allowed per account for this event</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <AppleInput
                                    label="Min Per Order"
                                    type="number"
                                    value={formData.minTicketsPerOrder || 1}
                                    onChange={(e: any) => updateFormData({ minTicketsPerOrder: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                                    min="1"
                                />
                                <AppleInput
                                    label="Max Per Account"
                                    type="number"
                                    value={formData.maxTicketsPerOrder || 10}
                                    onChange={(e: any) => updateFormData({ maxTicketsPerOrder: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                                    min="1"
                                />
                            </div>
                            <p className="text-[11px] text-[#86868b] bg-[#f5f5f7] p-3 rounded-lg flex items-start gap-2">
                                <span>💡</span>
                                <span>These limits apply per user/account across the entire event. <strong>Couple tickets</strong> count as 1 unit towards these limits.</span>
                            </p>
                        </div>
                    )}

                    {/* Capacity Overview */}
                    < div className="p-5 rounded-2xl bg-[#f5f5f7]" >
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-[13px] text-[#86868b] mb-1">Capacity</p>
                                <p className="text-[24px] font-bold text-[#1d1d1f]">
                                    {totalTickets} <span className="text-[17px] font-normal text-[#86868b]">/ {capacity}</span>
                                </p>
                            </div>
                            {!formData.isRSVP && (
                                <div className="text-right">
                                    <p className="text-[13px] text-[#86868b] mb-1">Inventory Value</p>
                                    <p className="text-[24px] font-bold text-[#1d1d1f]">
                                        ₹{inventoryValue.toLocaleString()}
                                    </p>
                                    {tickets.some(t => t.price === 0) && (
                                        <p className="text-[10px] text-[#34c759] font-medium mt-1">
                                            Includes {tickets.filter(t => t.price === 0).reduce((sum, t) => sum + (Number(t.quantity) || 0), 0)} free RSVP slots
                                        </p>
                                    )}
                                </div>
                            )}
                            {formData.isRSVP && (
                                <div className="text-right px-3 py-1.5 rounded-lg bg-[#007aff]/10 text-[#007aff] text-[12px] font-bold">
                                    FREE RSVP
                                </div>
                            )}
                        </div>

                        {/* Progress Bar */}
                        < div className="h-2 bg-white rounded-full overflow-hidden" >
                            <motion.div
                                className={`h-full rounded-full ${capacityUsage > 100 ? "bg-[#ff3b30]" :
                                    capacityUsage > 80 ? "bg-[#ff9500]" : "bg-[#34c759]"
                                    }`}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(capacityUsage, 100)}%` }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                            />
                        </div>

                        {capacityUsage > 100 && (
                            <p className="text-[13px] text-[#ff3b30] mt-2 font-medium">
                                ⚠️ Total tickets exceed venue capacity
                            </p>
                        )}
                    </div>

                    {/* Validation Error */}
                    {validationErrors.tickets && (
                        <div className="p-4 rounded-2xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-[#ff3b30]" />
                            <p className="text-[13px] text-[#ff3b30] font-medium">{validationErrors.tickets}</p>
                        </div>
                    )}
                </>
            )}

            {/* Ticket Tiers */}
            <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                    {tickets.map((tier, index) => (
                        <TicketTierCard
                            key={tier.id}
                            tier={tier}
                            index={index}
                            onUpdate={(updates) => updateTicket(index, updates)}
                            onRemove={() => removeTicket(index)}
                            canRemove={tickets.length > 1}
                            capacity={capacity}
                            eventDefaultCommission={formData.commission}
                            eventDefaultCommissionType={formData.commissionType}
                            promotersEnabled={formData.promotersEnabled}
                            useDefaultCommission={formData.useDefaultCommission}
                            buyerDiscountsEnabled={formData.buyerDiscountsEnabled}
                            useDefaultDiscount={formData.useDefaultDiscount}
                            eventDefaultDiscount={formData.discount}
                            eventDefaultDiscountType={formData.discountType}
                            eventStartDate={formData.startDate}
                            scheduledPricingEnabled={formData.scheduledPricingEnabled}
                            defaultScheduledPrices={formData.defaultScheduledPrices}
                            isRSVP={formData.isRSVP}
                        />
                    ))}
                </AnimatePresence>
            </div>

            {/* Add Tier Button */}
            <button
                onClick={addTicket}
                className="group relative w-full py-6 rounded-[2rem] border-2 border-dashed border-stone-200 text-stone-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all duration-300 overflow-hidden"
            >
                <div className="relative flex items-center justify-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white border border-stone-100 flex items-center justify-center group-hover:scale-110 group-hover:shadow-lg transition-all">
                        <Plus className="w-5 h-5" />
                    </div>
                    <span className="text-[15px] font-black uppercase tracking-widest">Add Ticket Tier</span>
                </div>
            </button>

            {!formData.isRSVP && (
                <>
                    {/* Promo Codes Section */}
                    <div className="p-5 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-white shadow-sm">
                        <PromoCodeManager
                            promoCodes={formData.promoCodes || []}
                            onChange={(codes) => updateFormData({ promoCodes: codes })}
                            tiers={tickets.map(t => ({ id: t.id, name: t.name }))}
                        />
                    </div>

                    {/* Quick Presets */}
                    <div>
                        <p className="text-[13px] font-medium text-[#86868b] mb-3">Quick Presets</p>
                        <div className="flex flex-wrap gap-2">
                            {[
                                {
                                    label: "Nightclub", tiers: [
                                        { name: "Stag Early Bird", entryType: "stag", price: 500, quantity: 100 },
                                        { name: "Couple Entry", entryType: "couple", price: 800, quantity: 150 },
                                        { name: "Female Entry", entryType: "female", price: 0, quantity: 100 },
                                        { name: "VIP Table (4)", entryType: "table", price: 5000, quantity: 10 }
                                    ]
                                },
                                {
                                    label: "Concert", tiers: [
                                        { name: "Phase 1 - Early Bird", entryType: "general", price: 499, quantity: 500 },
                                        { name: "Phase 2 - Regular", entryType: "general", price: 999, quantity: 1000 },
                                        { name: "Phase 3 - Last Call", entryType: "general", price: 1499, quantity: 500 },
                                        { name: "Fan Pit", entryType: "vip", price: 2999, quantity: 200 }
                                    ]
                                },
                                {
                                    label: "Simple Entry", tiers: [
                                        { name: "General Admission", entryType: "general", price: 0, quantity: 1000 }
                                    ]
                                }
                            ].map((preset) => (
                                <button
                                    key={preset.label}
                                    onClick={() => {
                                        const newTickets = preset.tiers.map((t, i) => ({
                                            id: `preset-${Date.now()}-${i}`,
                                            ...t,
                                            promoterEnabled: true,
                                            promoterCommissionType: "percent"
                                        }));
                                        updateFormData({
                                            tickets: newTickets,
                                            minTicketsPerOrder: 1,
                                            maxTicketsPerOrder: 10
                                        });
                                    }}
                                    className="px-4 py-2 rounded-full border border-[rgba(0,0,0,0.06)] text-[13px] font-medium text-[#1d1d1f] hover:border-[#007aff] hover:text-[#007aff] transition-colors"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            <style jsx global>{`
                input[type="number"]::-webkit-inner-spin-button,
                input[type="number"]::-webkit-outer-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                input[type="number"] {
                    -moz-appearance: textfield;
                }
            `}</style>
        </div>
    );
}
