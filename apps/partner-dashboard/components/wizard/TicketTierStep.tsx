"use client";

import { useState, forwardRef } from "react";
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
    Clock,
    DollarSign,
    Tag,
    Settings2,
    Layers,
    Wallet
} from "lucide-react";
import { ScheduledPricing } from "./components/ScheduledPricing";
import { PromoCodeManager } from "./components/PromoCodeManager";

interface ScheduledPrice {
    id: string;
    name: string;
    price: number;
    startsAt: string;
    endsAt: string;
    quantityLimit?: number;
}

interface DefaultScheduledPrice {
    id: string;
    name: string;
    type: "discount" | "markup";
    value: number;
    startsAt: string;
    endsAt: string;
    quantityLimit?: number;
}

interface TicketTier {
    id: string;
    name: string;
    entryType: "stag" | "female" | "couple" | "vip" | "table" | "cover";
    genderRequirement: "male" | "female" | "couple";
    isCouple?: boolean;
    price: number | "";
    quantity: number | "";
    minPerOrder: number | "";
    maxPerOrder: number | "";
    promoterEnabled: boolean;
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
    coverChargeConfig?: {
        enabled: boolean;
        walletAmountPaise: number;
        terminationHour: number;
        terminationPolicy: "forfeit" | "partial_refund";
        presetItems: Array<{ id: string; name: string; amountPaise: number; isAvailable: boolean }>;
    };
}

interface TicketTierStepProps {
    formData: any;
    updateFormData: (updates: any) => void;
    validationErrors: Record<string, string>;
}

const ENTRY_TYPES = [
    { id: "stag", label: "Male", icon: User, description: "Male entry", defaultName: "Stag Entry", genderRequirement: "male" as const, isCouple: false },
    { id: "female", label: "Female", icon: User, description: "Female entry", defaultName: "Ladies Entry", genderRequirement: "female" as const, isCouple: false },
    { id: "couple", label: "Couple", icon: Heart, description: "1 Male + 1 Female", defaultName: "Couple Entry", genderRequirement: null, isCouple: true },
    { id: "vip", label: "VIP", icon: Crown, description: "Premium access", defaultName: "VIP Access", genderRequirement: null, isCouple: false },
    { id: "cover", label: "Cover", icon: DollarSign, description: "Cover charge", defaultName: "Cover Charge", genderRequirement: null, isCouple: false },
];

const DEFAULT_NAMES = ENTRY_TYPES.map(t => t.defaultName);

// ─── AppleInput ──────────────────────────────────────────────────────────────
function AppleInput({ label, type = "text", value, onChange, placeholder, className = "", prefix, ...rest }: any) {
    return (
        <div className={`space-y-1.5 ${className}`}>
            {label && (
                <label className="block text-[11px] font-bold text-text-tertiary uppercase tracking-widest">
                    {label}
                </label>
            )}
            <div className="relative">
                {prefix && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary font-bold text-[13px]">
                        {prefix}
                    </span>
                )}
                <input
                    type={type}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    className={`w-full px-3 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-[14px] text-text-primary placeholder:text-text-tertiary/50 focus:outline-none focus:border-indigo-500/50 focus:bg-surface-base transition-all ${prefix ? "pl-7" : ""}`}
                    {...rest}
                />
            </div>
        </div>
    );
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────
function Toggle({ on, onToggle, color = "bg-green-500" }: { on: boolean; onToggle: () => void; color?: string }) {
    return (
        <button
            onClick={onToggle}
            className={`w-12 h-7 rounded-full relative transition-all duration-300 border flex-shrink-0 ${on ? `${color} border-transparent shadow-sm` : "bg-surface-tertiary border-border-default"}`}
        >
            <motion.div
                className="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm"
                animate={{ x: on ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
        </button>
    );
}

// ─── CoverChargeConfig ────────────────────────────────────────────────────────
function CoverChargeConfig({ config, onChange }: {
    config?: TicketTier["coverChargeConfig"];
    onChange: (cfg: TicketTier["coverChargeConfig"]) => void;
}) {
    const [open, setOpen] = useState(false);

    const defaultConfig = (): NonNullable<TicketTier["coverChargeConfig"]> => ({
        enabled: true,
        walletAmountPaise: 0,
        terminationHour: 5,
        terminationPolicy: "forfeit",
        presetItems: [],
    });

    const cfg = config ?? defaultConfig();
    const isEnabled = cfg.enabled;

    const update = (patch: Partial<NonNullable<TicketTier["coverChargeConfig"]>>) =>
        onChange({ ...cfg, ...patch });

    const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => {
        const suffix = h < 12 ? "AM" : "PM";
        const display = h === 0 ? "12 AM" : h === 12 ? "12 PM" : `${h % 12} ${suffix}`;
        return { value: h, label: display };
    });

    const addPresetItem = () => {
        const id = typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `item-${Date.now()}`;
        update({
            presetItems: [...cfg.presetItems, { id, name: "", amountPaise: 0, isAvailable: true }],
        });
    };

    const updatePreset = (idx: number, patch: Partial<NonNullable<TicketTier["coverChargeConfig"]>["presetItems"][0]>) => {
        const items = [...cfg.presetItems];
        items[idx] = { ...items[idx], ...patch };
        update({ presetItems: items });
    };

    const removePreset = (idx: number) => {
        update({ presetItems: cfg.presetItems.filter((_, i) => i !== idx) });
    };

    const walletRupees = cfg.walletAmountPaise > 0
        ? `= ₹${(cfg.walletAmountPaise / 100).toFixed(2)}`
        : null;

    return (
        <div className={`rounded-xl overflow-hidden transition-all ${isEnabled ? "bg-violet-500/5 border border-violet-500/20" : "bg-surface-tertiary"}`}>
            {/* Header row */}
            <button
                onClick={() => {
                    if (!config) onChange(defaultConfig());
                    else update({ enabled: !isEnabled });
                    setOpen(v => !v);
                }}
                className="w-full p-3 flex items-center justify-between text-left"
            >
                <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-violet-500" />
                    <span className="text-[11px] font-black text-violet-500 uppercase tracking-widest">Financial Configuration</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest ${isEnabled ? "bg-violet-500 text-white" : "bg-surface-elevated text-text-tertiary border border-border-subtle"}`}>
                        {isEnabled ? "WALLET ON" : "DISABLED"}
                    </span>
                </div>
                <span className="text-[11px] text-text-tertiary font-bold uppercase tracking-widest">
                    {isEnabled && cfg.walletAmountPaise > 0 ? `₹${(cfg.walletAmountPaise / 100).toFixed(0)}` : "Configure"}
                </span>
            </button>

            {/* Expanded body */}
            <AnimatePresence>
                {open && isEnabled && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-violet-500/20"
                    >
                        <div className="p-3 space-y-3">
                            {/* Wallet Amount */}
                            <div className="space-y-1">
                                <AppleInput
                                    label="Wallet Credit Amount"
                                    type="number"
                                    prefix="₹"
                                    value={cfg.walletAmountPaise === 0 ? "" : String(cfg.walletAmountPaise)}
                                    onChange={(e: any) => {
                                        const raw = parseInt(e.target.value) || 0;
                                        update({ walletAmountPaise: raw });
                                    }}
                                    placeholder="e.g. 100000 for ₹1,000"
                                    min="0"
                                />
                                <p className="text-[10px] font-bold text-text-tertiary pl-1">
                                    Enter amount in <span className="text-violet-500">paise</span> (100 = ₹1).{" "}
                                    {walletRupees && <span className="text-violet-400">{walletRupees}</span>}
                                </p>
                            </div>

                            {/* Termination Hour */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-text-tertiary uppercase tracking-widest">
                                    Wallet Expires At
                                </label>
                                <select
                                    value={cfg.terminationHour}
                                    onChange={(e) => update({ terminationHour: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-[14px] text-text-primary focus:outline-none focus:border-violet-500/50 transition-all"
                                >
                                    {HOUR_LABELS.map(h => (
                                        <option key={h.value} value={h.value}>{h.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Termination Policy */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-text-tertiary uppercase tracking-widest">
                                    Unspent Balance Policy
                                </label>
                                <div className="flex gap-2">
                                    {([
                                        { value: "forfeit", label: "Forfeit", desc: "Club keeps remainder" },
                                        { value: "partial_refund", label: "Refund", desc: "Return to guest" },
                                    ] as const).map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => update({ terminationPolicy: opt.value })}
                                            className={`flex-1 px-3 py-2.5 rounded-xl border text-left transition-all ${cfg.terminationPolicy === opt.value
                                                ? "border-violet-500 bg-violet-500/10"
                                                : "border-border-subtle hover:border-violet-500/30 bg-surface-secondary"
                                            }`}
                                        >
                                            <p className={`text-[12px] font-black uppercase tracking-wider ${cfg.terminationPolicy === opt.value ? "text-violet-400" : "text-text-primary"}`}>
                                                {opt.label}
                                            </p>
                                            <p className="text-[10px] text-text-tertiary mt-0.5">{opt.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Preset Items */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-text-tertiary uppercase tracking-widest">
                                    Quick-Tap Preset Items
                                </label>
                                <div className="space-y-1.5">
                                    {cfg.presetItems.map((item, idx) => (
                                        <div key={item.id} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={item.name}
                                                onChange={(e) => updatePreset(idx, { name: e.target.value })}
                                                placeholder="e.g. Vodka Shot"
                                                className="flex-1 px-3 py-2 rounded-xl bg-surface-secondary border border-border-subtle text-[13px] placeholder:text-text-tertiary/50 focus:outline-none focus:border-violet-500/50 transition-all"
                                            />
                                            <div className="relative w-28 flex-shrink-0">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary font-bold text-[12px]">₹</span>
                                                <input
                                                    type="number"
                                                    value={item.amountPaise === 0 ? "" : String(item.amountPaise)}
                                                    onChange={(e) => updatePreset(idx, { amountPaise: parseInt(e.target.value) || 0 })}
                                                    placeholder="40000"
                                                    min="0"
                                                    className="w-full pl-7 pr-2 py-2 rounded-xl bg-surface-secondary border border-border-subtle text-[13px] focus:outline-none focus:border-violet-500/50 transition-all"
                                                />
                                            </div>
                                            <Toggle
                                                on={item.isAvailable}
                                                onToggle={() => updatePreset(idx, { isAvailable: !item.isAvailable })}
                                                color="bg-violet-500"
                                            />
                                            <button
                                                onClick={() => removePreset(idx)}
                                                className="w-8 h-8 rounded-lg hover:bg-rose-50 flex items-center justify-center text-text-tertiary hover:text-rose-500 transition-all flex-shrink-0"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    {cfg.presetItems.length === 0 && (
                                        <p className="text-[11px] text-text-tertiary py-1">No presets yet — bartenders can still enter custom amounts.</p>
                                    )}
                                </div>
                                <button
                                    onClick={addPresetItem}
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-violet-500 hover:text-violet-400 transition-colors mt-1"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Add Preset Item
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── TicketTierCard ───────────────────────────────────────────────────────────
const TicketTierCard = forwardRef<HTMLDivElement, {
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
}>(({
    tier, index, onUpdate, onRemove, canRemove, capacity,
    eventDefaultCommission, eventDefaultCommissionType, promotersEnabled,
    useDefaultCommission, buyerDiscountsEnabled, useDefaultDiscount,
    eventDefaultDiscount, eventDefaultDiscountType, eventStartDate,
    scheduledPricingEnabled, defaultScheduledPrices, isRSVP
}, ref) => {
    const [expanded, setExpanded] = useState(false);

    const selectedEntryType = ENTRY_TYPES.find(t => t.id === tier.entryType) || ENTRY_TYPES[0];
    const EntryIcon = selectedEntryType.icon;

    const convertDefaultToScheduledPrice = (defaultPrice: DefaultScheduledPrice, basePrice: number): ScheduledPrice => {
        const price = defaultPrice.type === "discount"
            ? Math.round(basePrice * (1 - defaultPrice.value / 100))
            : Math.round(basePrice * (1 + defaultPrice.value / 100));
        return { id: defaultPrice.id, name: defaultPrice.name, startsAt: defaultPrice.startsAt, endsAt: defaultPrice.endsAt, quantityLimit: defaultPrice.quantityLimit, price };
    };

    const ENTRY_COLORS: Record<string, string> = {
        stag: "bg-blue-600",
        female: "bg-rose-500",
        couple: "bg-pink-600",
        vip: "bg-amber-500",
        cover: "bg-violet-600",
        table: "bg-emerald-600",
    };

    const cardColor = ENTRY_COLORS[tier.entryType] || "bg-indigo-600";

    return (
        <motion.div
            ref={ref}
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16, height: 0 }}
            className="card border-default transition-all hover:shadow-md group/tier overflow-hidden"
        >
            {/* Header */}
            <div className="px-4 py-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${cardColor} shadow-md flex items-center justify-center flex-shrink-0`}>
                    <EntryIcon className="w-4 h-4 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                    <input
                        type="text"
                        value={tier.name}
                        onChange={(e) => onUpdate({ name: e.target.value })}
                        placeholder="Ticket Tier Name"
                        className="w-full text-[15px] font-bold bg-transparent focus:outline-none leading-tight truncate"
                        autoCapitalize="words"
                    />
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] uppercase tracking-widest text-indigo-500 font-bold">
                            {selectedEntryType.label}
                        </span>
                        <span className="text-[10px] text-text-tertiary">·</span>
                        <span className="text-[11px] text-text-tertiary">{tier.quantity || 0} units</span>
                    </div>
                </div>

                <p className={`text-[15px] font-black mr-1 flex-shrink-0 ${isRSVP ? "text-indigo-500" : "text-text-primary"}`}>
                    {isRSVP ? "FREE" : (tier.price === 0 ? "Free" : `₹${tier.price}`)}
                </p>

                <div className="flex items-center gap-0.5">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="w-8 h-8 rounded-lg hover:bg-surface-secondary flex items-center justify-center transition-all"
                    >
                        {expanded ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                    </button>
                    {canRemove && (
                        <button
                            onClick={onRemove}
                            className="w-8 h-8 rounded-lg hover:bg-rose-50 flex items-center justify-center text-muted hover:text-rose-500 transition-all"
                        >
                            <Trash2 className="w-4 h-4" />
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
                        className="border-t border-border-default"
                    >
                        <div className="p-3 space-y-3">
                            {/* Entry Type Selection — 3 cols × 2 rows for 6 types */}
                            <div>
                                <label className="block text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-1.5">
                                    Entry Type
                                </label>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {ENTRY_TYPES.map(type => {
                                        const Icon = type.icon;
                                        const isSelected = tier.entryType === type.id;
                                        return (
                                            <button
                                                key={type.id}
                                                onClick={() => {
                                                    const updates: any = { entryType: type.id, isCouple: type.isCouple };
                                                    if (!tier.name || DEFAULT_NAMES.includes(tier.name)) updates.name = type.defaultName;
                                                    // Auto-assign gender for stag/female/couple; keep existing for vip/cover
                                                    if (type.genderRequirement) updates.genderRequirement = type.genderRequirement;
                                                    if (type.isCouple) updates.genderRequirement = "couple";
                                                    onUpdate(updates);
                                                }}
                                                className={`py-2 px-2 rounded-xl border text-center transition-all ${isSelected
                                                    ? "border-indigo-500 bg-indigo-500/10"
                                                    : "border-border-subtle hover:border-indigo-500/30 hover:bg-surface-secondary"
                                                }`}
                                            >
                                                <Icon className={`w-3.5 h-3.5 mx-auto mb-0.5 ${isSelected ? "text-indigo-500" : "text-text-tertiary"}`} />
                                                <p className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? "text-indigo-500" : "text-text-primary"}`}>
                                                    {type.label}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Gender Category — required for VIP and Cover; locked for Stag/Female */}
                            <div>
                                <label className="block text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-1.5">
                                    Gender Category <span className="text-red-500">*</span>
                                </label>
                                {tier.entryType === "couple" ? (
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 px-3 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-[12px] font-bold text-blue-500 flex items-center justify-center gap-1.5">
                                            <User className="w-3 h-3" /> Male
                                        </div>
                                        <span className="text-[10px] text-text-tertiary font-bold">+</span>
                                        <div className="flex-1 px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[12px] font-bold text-rose-500 flex items-center justify-center gap-1.5">
                                            <User className="w-3 h-3" /> Female
                                        </div>
                                    </div>
                                ) : (tier.entryType === "stag" || tier.entryType === "female") ? (
                                    <div className="px-3 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-[13px] font-bold text-text-tertiary flex items-center gap-2">
                                        <Users className="w-3.5 h-3.5" />
                                        {tier.entryType === "stag" ? "Male only — set by entry type" : "Female only — set by entry type"}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {(["male", "female"] as const).map(g => (
                                            <button
                                                key={g}
                                                onClick={() => onUpdate({ genderRequirement: g })}
                                                className={`py-2 px-3 rounded-xl border text-center transition-all ${tier.genderRequirement === g
                                                    ? g === "male" ? "border-blue-500 bg-blue-500/10" : "border-rose-500 bg-rose-500/10"
                                                    : "border-border-subtle hover:border-indigo-500/30 hover:bg-surface-secondary"
                                                }`}
                                            >
                                                <p className={`text-[11px] font-bold uppercase tracking-wider ${tier.genderRequirement === g
                                                    ? g === "male" ? "text-blue-500" : "text-rose-500"
                                                    : "text-text-primary"
                                                }`}>
                                                    {g === "male" ? "Male" : "Female"}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {!tier.genderRequirement && (tier.entryType === "vip" || tier.entryType === "cover") && (
                                    <p className="text-[10px] text-red-500 font-bold mt-1">Gender category is required</p>
                                )}
                            </div>

                            {/* Price and Quantity */}
                            <div className="grid grid-cols-2 gap-2">
                                {!isRSVP ? (
                                    <div className="space-y-1">
                                        <AppleInput
                                            label="Price"
                                            type="number"
                                            prefix="₹"
                                            value={tier.price}
                                            onChange={(e: any) => onUpdate({ price: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                                            min="0"
                                        />
                                        {tier.price === 0 && (
                                            <p className="text-[9px] text-emerald-600 font-bold">Free RSVP — No payment gateway</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <label className="block text-[11px] font-bold text-text-tertiary uppercase tracking-widest">Pricing</label>
                                        <div className="px-3 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[13px] font-black text-indigo-500 flex items-center justify-center uppercase tracking-widest">
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

                            {/* Scheduled Pricing Override — per tier */}
                            {Number(tier.price) > 0 && scheduledPricingEnabled && (
                                <div className={`rounded-xl overflow-hidden transition-all ${tier.overrideScheduledPricing
                                    ? "bg-gradient-to-br from-[#ff6b35]/5 to-[#f7931e]/5 border border-[#ff6b35]/20"
                                    : "bg-surface-tertiary"
                                }`}>
                                    <button
                                        onClick={() => {
                                            const newOverride = !tier.overrideScheduledPricing;
                                            const newPrices = newOverride
                                                ? (defaultScheduledPrices || []).map(dp => convertDefaultToScheduledPrice(dp, Number(tier.price) || 0))
                                                : [];
                                            onUpdate({ overrideScheduledPricing: newOverride, scheduledPrices: newPrices });
                                        }}
                                        className="w-full p-3 flex items-center justify-between text-left"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-orange-500" />
                                            <span className="text-[11px] font-black text-orange-500 uppercase tracking-widest">Scheduled Pricing</span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest ${tier.overrideScheduledPricing
                                                ? "bg-orange-500 text-white"
                                                : "bg-surface-tertiary text-text-tertiary border border-border-subtle"
                                            }`}>
                                                {tier.overrideScheduledPricing ? "CUSTOM" : "DEFAULT"}
                                            </span>
                                        </div>
                                        <span className="text-[11px] text-text-tertiary font-bold uppercase tracking-widest">
                                            {tier.overrideScheduledPricing
                                                ? `${(tier.scheduledPrices || []).length} custom`
                                                : `${(defaultScheduledPrices || []).length} default`
                                            }
                                        </span>
                                    </button>
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

                            {/* Ticket Note */}
                            <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-text-tertiary uppercase tracking-widest">
                                    Ticket Note (Optional)
                                </label>
                                <textarea
                                    value={tier.description || ""}
                                    onChange={(e) => onUpdate({ description: e.target.value })}
                                    placeholder="e.g. Includes one free drink"
                                    className="w-full px-3 py-2 rounded-xl bg-surface-secondary border border-border-subtle text-[13px] placeholder:text-text-tertiary/50 focus:outline-none focus:border-indigo-400 transition-all min-h-[52px] resize-none"
                                    autoCapitalize="sentences"
                                />
                            </div>

                            {/* Financial Configuration — Cover Charge only */}
                            {tier.entryType === "cover" && (
                                <CoverChargeConfig
                                    config={tier.coverChargeConfig}
                                    onChange={(cfg) => onUpdate({ coverChargeConfig: cfg })}
                                />
                            )}

                            {/* Per-tier Promoter toggle — shown only if promoters globally enabled */}
                            {promotersEnabled && (
                                <div className="space-y-2">
                                    <div className="p-2.5 rounded-xl bg-surface-tertiary flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Percent className="w-4 h-4 text-text-tertiary" />
                                            <div>
                                                <p className="text-[12px] font-bold text-text-primary">Promoter Sales</p>
                                                <p className="text-[10px] text-text-tertiary">Allow promoters to sell this tier</p>
                                            </div>
                                        </div>
                                        <Toggle on={tier.promoterEnabled} onToggle={() => onUpdate({ promoterEnabled: !tier.promoterEnabled })} />
                                    </div>

                                    {tier.promoterEnabled && (
                                        <div className="space-y-2">
                                            {/* Commission override */}
                                            <div className={`rounded-xl overflow-hidden transition-all ${tier.overrideCommission
                                                ? "bg-[#F44A22]/5 border border-[#F44A22]/20"
                                                : "bg-surface-tertiary"
                                            }`}>
                                                <button
                                                    onClick={() => onUpdate({
                                                        overrideCommission: !tier.overrideCommission,
                                                        promoterCommission: tier.overrideCommission ? "" : (eventDefaultCommission || 15),
                                                        promoterCommissionType: tier.overrideCommission ? "percent" : (eventDefaultCommissionType || "percent")
                                                    })}
                                                    className="w-full p-3 flex items-center justify-between text-left"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] font-bold text-[#F44A22] uppercase tracking-wider">Commission</span>
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${tier.overrideCommission ? "bg-[#F44A22] text-white" : "bg-surface-elevated text-text-tertiary"}`}>
                                                            {tier.overrideCommission ? "CUSTOM" : "DEFAULT"}
                                                        </span>
                                                    </div>
                                                    <span className={`text-[13px] font-semibold ${tier.overrideCommission ? "text-[#F44A22]" : "text-text-primary"}`}>
                                                        {tier.overrideCommission
                                                            ? `${tier.promoterCommission || 0}${(tier.promoterCommissionType || "percent") === "percent" ? "%" : "₹"}`
                                                            : `${eventDefaultCommission || 15}${(eventDefaultCommissionType || "percent") === "percent" ? "%" : "₹"}`
                                                        }
                                                    </span>
                                                </button>
                                                {tier.overrideCommission && (
                                                    <div className="px-3 pb-3 space-y-2">
                                                        <div className="flex gap-2">
                                                            <div className="flex p-0.5 bg-surface-elevated rounded-lg border border-[#F44A22]/20">
                                                                {[{ v: "percent", l: "%" }, { v: "amount", l: "₹" }].map(({ v, l }) => (
                                                                    <button key={v} onClick={() => onUpdate({ promoterCommissionType: v as any })}
                                                                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${(tier.promoterCommissionType || "percent") === v ? "bg-[#F44A22] text-white" : "text-text-tertiary"}`}>
                                                                        {l}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <input type="number" value={tier.promoterCommission}
                                                                onChange={(e) => onUpdate({ promoterCommission: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                                                                placeholder="15"
                                                                className="flex-1 px-3 py-1.5 rounded-lg bg-surface-elevated border border-[#F44A22]/20 text-[14px] font-bold focus:outline-none focus:border-[#F44A22]"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Discount override */}
                                            {!isRSVP && buyerDiscountsEnabled && (
                                                <div className={`rounded-xl overflow-hidden transition-all ${tier.overrideDiscount
                                                    ? "bg-[#34c759]/5 border border-[#34c759]/20"
                                                    : "bg-surface-tertiary"
                                                }`}>
                                                    <button
                                                        onClick={() => onUpdate({
                                                            overrideDiscount: !tier.overrideDiscount,
                                                            promoterDiscount: tier.overrideDiscount ? "" : (eventDefaultDiscount || 10),
                                                            promoterDiscountType: tier.overrideDiscount ? "percent" : (eventDefaultDiscountType || "percent")
                                                        })}
                                                        className="w-full p-3 flex items-center justify-between text-left"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[11px] font-bold text-[#34c759] uppercase tracking-wider">Buyer Discount</span>
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${tier.overrideDiscount ? "bg-[#34c759] text-white" : "bg-surface-elevated text-text-tertiary"}`}>
                                                                {tier.overrideDiscount ? "CUSTOM" : "DEFAULT"}
                                                            </span>
                                                        </div>
                                                        <span className={`text-[13px] font-semibold ${tier.overrideDiscount ? "text-[#34c759]" : "text-text-primary"}`}>
                                                            {tier.overrideDiscount
                                                                ? `${tier.promoterDiscount || 0}${(tier.promoterDiscountType || "percent") === "percent" ? "%" : "₹"} off`
                                                                : `${eventDefaultDiscount || 10}${(eventDefaultDiscountType || "percent") === "percent" ? "%" : "₹"} off`
                                                            }
                                                        </span>
                                                    </button>
                                                    {tier.overrideDiscount && (
                                                        <div className="px-3 pb-3">
                                                            <div className="flex gap-2">
                                                                <div className="flex p-0.5 bg-surface-elevated rounded-lg border border-[#34c759]/20">
                                                                    {[{ v: "percent", l: "%" }, { v: "amount", l: "₹" }].map(({ v, l }) => (
                                                                        <button key={v} onClick={() => onUpdate({ promoterDiscountType: v as any })}
                                                                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${(tier.promoterDiscountType || "percent") === v ? "bg-[#34c759] text-white" : "text-text-tertiary"}`}>
                                                                            {l}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                                <input type="number" value={tier.promoterDiscount}
                                                                    onChange={(e) => onUpdate({ promoterDiscount: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                                                                    placeholder="10"
                                                                    className="flex-1 px-3 py-1.5 rounded-lg bg-surface-elevated border border-[#34c759]/20 text-[14px] font-bold focus:outline-none focus:border-[#34c759]"
                                                                />
                                                            </div>
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
});

TicketTierCard.displayName = "TicketTierCard";

// ─── TicketTierStep ────────────────────────────────────────────────────────────
type ActiveTab = 'tiers' | 'pricing' | 'promoters' | 'settings';

export function TicketTierStep({ formData, updateFormData, validationErrors }: TicketTierStepProps) {
    const [activeTab, setActiveTab] = useState<ActiveTab>('tiers');

    const tickets: TicketTier[] = formData.tickets || [];
    const capacity = formData.capacity || 500;
    // Calculations moved to backend
    const totalTickets = 0;
    const inventoryValue = 0;
    const capacityUsage = 0;

    const updateTicket = (index: number, updates: Partial<TicketTier>) => {
        const newTickets = [...tickets];
        newTickets[index] = { ...newTickets[index], ...updates };
        updateFormData({ tickets: newTickets });
    };

    const removeTicket = (index: number) => {
        updateFormData({ tickets: tickets.filter((_, i) => i !== index) });
    };

    const addTicket = () => {
        const newTicket: TicketTier = {
            id: Date.now().toString(),
            name: "",
            entryType: "stag",
            genderRequirement: "male",
            price: formData.isRSVP ? 0 : 0,
            quantity: 50,
            minPerOrder: 1,
            maxPerOrder: 10,
            promoterEnabled: true,
            promoterCommissionType: formData.isRSVP ? "amount" : "percent",
            promoterCommission: formData.isRSVP ? 0 : 15
        };
        updateFormData({ tickets: [...tickets, newTicket] });
    };

    const handleRSVPToggle = () => {
        const newIsRSVP = !formData.isRSVP;
        const updates: any = { isRSVP: newIsRSVP };
        if (newIsRSVP) {
            updates.scheduledPricingEnabled = false;
            updates.tickets = (formData.tickets || []).map((t: any) => ({
                ...t, price: 0, promoterCommissionType: "amount", promoterCommission: t.promoterCommission ?? 0
            }));
            updates.minTicketsPerOrder = 1;
            updates.maxTicketsPerOrder = 1;
            updates.commissionType = "amount";
            updates.buyerDiscountsEnabled = false;
        }
        updateFormData(updates);
    };

    const TABS = [
        { id: 'tiers', label: 'Tiers', icon: Layers, badge: tickets.length },
        { id: 'pricing', label: 'Pricing', icon: Clock, dot: formData.scheduledPricingEnabled, hidden: formData.isRSVP },
        { id: 'promoters', label: 'Promoters', icon: Percent, dot: formData.promotersEnabled },
        { id: 'settings', label: 'Settings', icon: Settings2 },
    ].filter(t => !t.hidden) as { id: ActiveTab; label: string; icon: any; badge?: number; dot?: boolean; hidden?: boolean }[];

    const QUICK_PRESETS = [
        {
            label: "Nightclub", tiers: [
                { name: "Stag Entry", entryType: "stag", genderRequirement: "male", isCouple: false, price: 500, quantity: 100 },
                { name: "Couple Entry", entryType: "couple", genderRequirement: "couple", isCouple: true, price: 800, quantity: 150 },
                { name: "Ladies Entry", entryType: "female", genderRequirement: "female", isCouple: false, price: 0, quantity: 100 },
                { name: "Cover Charge (Male)", entryType: "cover", genderRequirement: "male", isCouple: false, price: 300, quantity: 200 },
            ]
        },
        {
            label: "Concert", tiers: [
                { name: "Early Bird — Male", entryType: "stag", genderRequirement: "male", price: 499, quantity: 500 },
                { name: "Early Bird — Female", entryType: "female", genderRequirement: "female", price: 499, quantity: 500 },
                { name: "Fan Pit (Male)", entryType: "vip", genderRequirement: "male", price: 2999, quantity: 100 },
                { name: "Fan Pit (Female)", entryType: "vip", genderRequirement: "female", price: 2999, quantity: 100 },
            ]
        },
        {
            label: "Simple Entry", tiers: [
                { name: "Male Entry", entryType: "stag", genderRequirement: "male", price: 0, quantity: 500 },
                { name: "Female Entry", entryType: "female", genderRequirement: "female", price: 0, quantity: 500 },
            ]
        }
    ];

    return (
        <div className="flex flex-col gap-3">
            {/* ─── Top Bar: Mode + Capacity ─── */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-secondary border border-border-subtle">
                {/* PAID / RSVP Mode Selector */}
                <div className="flex p-0.5 bg-surface-base rounded-xl border border-border-subtle shadow-sm">
                    <button
                        onClick={() => formData.isRSVP && handleRSVPToggle()}
                        className={`px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${!formData.isRSVP ? 'bg-indigo-600 text-white shadow-sm' : 'text-text-tertiary hover:text-text-primary'}`}
                    >
                        Paid
                    </button>
                    <button
                        onClick={() => !formData.isRSVP && handleRSVPToggle()}
                        className={`px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${formData.isRSVP ? 'bg-indigo-600 text-white shadow-sm' : 'text-text-tertiary hover:text-text-primary'}`}
                    >
                        RSVP
                    </button>
                </div>

                {formData.isRSVP && (
                    <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                        Free Guestlist Mode
                    </span>
                )}

                <div className="flex-1" />

                {/* Capacity bar */}
                <div className="w-32">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-text-tertiary uppercase tracking-widest font-bold">Capacity</span>
                        <span className="text-[11px] font-bold text-text-primary">
                            {totalTickets}<span className="text-text-tertiary font-normal">/{capacity}</span>
                        </span>
                    </div>
                    <div className="h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
                        <motion.div
                            className={`h-full rounded-full ${capacityUsage > 100 ? "bg-red-500" : capacityUsage > 80 ? "bg-orange-500" : "bg-green-500"}`}
                            animate={{ width: `${Math.min(capacityUsage, 100)}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                    </div>
                </div>

                {!formData.isRSVP && inventoryValue > 0 && (
                    <div className="text-right pl-2 border-l border-border-subtle">
                        <p className="text-[9px] text-text-tertiary uppercase tracking-widest font-bold">Value</p>
                        <p className="text-[13px] font-black text-text-primary">₹{inventoryValue.toLocaleString()}</p>
                    </div>
                )}

                {capacityUsage > 100 && (
                    <div className="px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-black text-red-500">
                        OVER
                    </div>
                )}
            </div>

            {/* ─── Tab Bar ─── */}
            <div className="flex items-center gap-1 bg-surface-secondary border border-border-subtle rounded-xl p-1">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${activeTab === tab.id
                                ? 'bg-surface-base shadow-sm text-text-primary border border-border-subtle'
                                : 'text-text-tertiary hover:text-text-secondary'
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {tab.label}
                            {tab.badge !== undefined && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.id ? 'bg-indigo-500/10 text-indigo-500' : 'bg-surface-tertiary text-text-tertiary'}`}>
                                    {tab.badge}
                                </span>
                            )}
                            {tab.dot && (
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ─── Tab Content ─── */}
            <AnimatePresence mode="wait">
                {/* ── Tiers Tab ── */}
                {activeTab === 'tiers' && (
                    <motion.div key="tiers" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="space-y-2">
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

                        <button
                            onClick={addTicket}
                            className="group w-full py-3.5 rounded-xl border-2 border-dashed border-border-default text-text-tertiary hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/20 transition-all flex items-center justify-center gap-2"
                        >
                            <div className="w-7 h-7 rounded-lg bg-surface-secondary border border-border-subtle flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Plus className="w-4 h-4" />
                            </div>
                            <span className="text-[12px] font-black uppercase tracking-widest">Add Ticket Tier</span>
                        </button>

                        {/* Quick Presets */}
                        <div className="flex items-center gap-2 pt-1">
                            <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest flex-shrink-0">Quick set:</span>
                            <div className="flex flex-wrap gap-1.5">
                                {QUICK_PRESETS.map((preset) => (
                                    <button
                                        key={preset.label}
                                        onClick={() => {
                                            const newTickets = preset.tiers.map((t, i) => ({
                                                id: `preset-${Date.now()}-${i}`,
                                                ...t,
                                                minPerOrder: 1,
                                                maxPerOrder: 10,
                                                promoterEnabled: true,
                                                promoterCommissionType: "percent"
                                            }));
                                            updateFormData({ tickets: newTickets, minTicketsPerOrder: 1, maxTicketsPerOrder: 10 });
                                        }}
                                        className="px-3 py-1.5 rounded-full border border-border-subtle text-[11px] font-bold text-text-secondary hover:border-indigo-400 hover:text-indigo-500 transition-all"
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {validationErrors.tickets && (
                            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                <p className="text-[12px] text-red-500 font-medium">{validationErrors.tickets}</p>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ── Pricing Tab ── */}
                {activeTab === 'pricing' && !formData.isRSVP && (
                    <motion.div key="pricing" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="space-y-4">
                        {/* Dynamic Pricing Toggle */}
                        <div className="p-4 rounded-xl border border-border-default bg-surface-secondary space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 flex-shrink-0 ${formData.scheduledPricingEnabled ? "bg-gradient-to-br from-[#ff6b35] to-[#f7931e] text-white" : "bg-surface-tertiary text-text-tertiary"}`}>
                                        <Clock className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[14px] font-bold text-text-primary">Dynamic Pricing</p>
                                        <p className="text-[11px] text-text-secondary">Early Bird & Last Call pricing windows</p>
                                    </div>
                                </div>
                                <Toggle on={formData.scheduledPricingEnabled} onToggle={() => updateFormData({ scheduledPricingEnabled: !formData.scheduledPricingEnabled })} color="bg-green-500" />
                            </div>

                            {formData.scheduledPricingEnabled && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="pt-4 border-t border-border-default space-y-3">
                                    {/* Quick Presets */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => {
                                                const now = new Date();
                                                const earlyBirdEnd = formData.startDate
                                                    ? new Date(new Date(formData.startDate).getTime() - 3 * 24 * 60 * 60 * 1000)
                                                    : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                                                updateFormData({
                                                    defaultScheduledPrices: [...(formData.defaultScheduledPrices || []), {
                                                        id: `eb-${Date.now()}`, name: "Early Bird", type: "discount", value: 20,
                                                        startsAt: now.toISOString().slice(0, 16),
                                                        endsAt: earlyBirdEnd.toISOString().slice(0, 16)
                                                    }]
                                                });
                                            }}
                                            className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-[#ff6b35]/30 text-[#ff6b35] font-bold text-[12px] hover:bg-[#ff6b35]/5 transition-colors"
                                        >
                                            ✨ Early Bird (−20%)
                                        </button>
                                        <button
                                            onClick={() => {
                                                const eventDate = formData.startDate ? new Date(formData.startDate) : new Date();
                                                const lastCallStart = new Date(eventDate.getTime() - 2 * 24 * 60 * 60 * 1000);
                                                updateFormData({
                                                    defaultScheduledPrices: [...(formData.defaultScheduledPrices || []), {
                                                        id: `lc-${Date.now()}`, name: "Last Call", type: "markup", value: 15,
                                                        startsAt: lastCallStart.toISOString().slice(0, 16),
                                                        endsAt: eventDate.toISOString().slice(0, 16)
                                                    }]
                                                });
                                            }}
                                            className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-[#ff3b30]/30 text-[#ff3b30] font-bold text-[12px] hover:bg-[#ff3b30]/5 transition-colors"
                                        >
                                            ⚡ Last Call (+15%)
                                        </button>
                                    </div>

                                    {/* Current Schedules */}
                                    <div className="space-y-2">
                                        {(formData.defaultScheduledPrices || []).map((schedule: DefaultScheduledPrice) => (
                                            <div
                                                key={schedule.id}
                                                className={`p-3 rounded-xl border-2 space-y-2.5 ${schedule.type === "discount" ? "bg-[#34c759]/5 border-[#34c759]/15" : "bg-[#ff3b30]/5 border-[#ff3b30]/15"}`}
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
                                                            className="bg-transparent font-bold text-[14px] text-text-primary focus:outline-none w-full"
                                                            placeholder="Schedule Name"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => updateFormData({ defaultScheduledPrices: formData.defaultScheduledPrices.filter((s: DefaultScheduledPrice) => s.id !== schedule.id) })}
                                                        className="text-text-tertiary hover:text-red-500 transition-colors ml-2"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className="flex p-0.5 bg-surface-elevated rounded-lg">
                                                        {[{ v: "discount", l: "DISCOUNT", c: "bg-[#34c759]" }, { v: "markup", l: "MARKUP", c: "bg-[#ff3b30]" }].map(({ v, l, c }) => (
                                                            <button key={v}
                                                                onClick={() => updateFormData({ defaultScheduledPrices: formData.defaultScheduledPrices.map((s: DefaultScheduledPrice) => s.id === schedule.id ? { ...s, type: v } : s) })}
                                                                className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${schedule.type === v ? `${c} text-white` : "text-text-tertiary"}`}
                                                            >
                                                                {l}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <div className="relative flex-grow">
                                                        <input type="number" value={schedule.value}
                                                            onChange={(e) => updateFormData({ defaultScheduledPrices: formData.defaultScheduledPrices.map((s: DefaultScheduledPrice) => s.id === schedule.id ? { ...s, value: parseInt(e.target.value) || 0 } : s) })}
                                                            className="w-full px-3 py-1.5 rounded-lg bg-surface-elevated border border-border-subtle text-[14px] font-bold focus:outline-none pr-8"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-text-tertiary">%</span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    {[{ l: "Starts", k: "startsAt" }, { l: "Ends", k: "endsAt" }].map(({ l, k }) => (
                                                        <div key={k} className="space-y-1">
                                                            <label className="text-[10px] text-text-tertiary font-bold uppercase">{l}</label>
                                                            <input type="datetime-local" value={(schedule as any)[k]}
                                                                onChange={(e) => updateFormData({ defaultScheduledPrices: formData.defaultScheduledPrices.map((s: DefaultScheduledPrice) => s.id === schedule.id ? { ...s, [k]: e.target.value } : s) })}
                                                                className="w-full px-2 py-1.5 rounded-lg bg-surface-elevated border border-border-subtle text-[11px] text-text-primary focus:outline-none"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                        {!(formData.defaultScheduledPrices || []).length && (
                                            <p className="text-center text-[12px] text-text-tertiary py-4 bg-surface-tertiary rounded-xl">
                                                No schedules yet. Use quick set above.
                                            </p>
                                        )}
                                    </div>

                                    <p className="text-[11px] text-text-tertiary p-3 rounded-lg bg-surface-tertiary">
                                        These apply to <strong>all tiers</strong> by default. Override individually within each tier.
                                    </p>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* ── Promoters Tab ── */}
                {activeTab === 'promoters' && (
                    <motion.div key="promoters" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="space-y-4">
                        {/* Master Toggle */}
                        <div className="p-4 rounded-xl border border-border-default bg-surface-secondary space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 flex-shrink-0 ${formData.promotersEnabled ? "bg-[#F44A22] text-white" : "bg-surface-tertiary text-text-tertiary"}`}>
                                        <Percent className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[14px] font-bold text-text-primary">Promoter Sales</p>
                                        <p className="text-[11px] text-text-secondary">Allow ambassadors to sell your tickets</p>
                                    </div>
                                </div>
                                <Toggle on={formData.promotersEnabled} onToggle={() => updateFormData({ promotersEnabled: !formData.promotersEnabled })} color="bg-green-500" />
                            </div>

                            {formData.promotersEnabled && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="pt-4 border-t border-border-default space-y-4">
                                    {/* ─ Commission Section ─ */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[11px] font-black uppercase tracking-widest text-[#F44A22]">Promoter Commission</p>
                                            <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-[#F44A22] text-[9px] font-black tracking-widest uppercase border border-orange-500/20">Payouts</span>
                                        </div>

                                        <div className="flex items-center justify-between p-3 rounded-xl bg-surface-tertiary border border-border-default">
                                            <div>
                                                <p className="text-[13px] font-bold text-text-primary">Standardize Commission</p>
                                                <p className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">
                                                    {formData.useDefaultCommission !== false ? "Same rate for all tiers" : "Custom rate per tier"}
                                                </p>
                                            </div>
                                            <Toggle on={formData.useDefaultCommission !== false} onToggle={() => updateFormData({ useDefaultCommission: formData.useDefaultCommission === false })} color="bg-[#F44A22]" />
                                        </div>

                                        {formData.useDefaultCommission !== false && (
                                            <div className="p-3 rounded-xl bg-surface-tertiary border border-border-default flex items-center justify-between gap-4">
                                                <div>
                                                    <p className="text-[13px] font-bold text-text-primary">Default Commission</p>
                                                    <p className="text-[10px] text-text-tertiary uppercase tracking-widest font-bold">Applied to all tiers</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex p-1 bg-surface-secondary rounded-xl border border-border-default">
                                                        {[{ v: "percent", l: "%" }, { v: "amount", l: "₹" }].map(({ v, l }) => (
                                                            <button key={v} onClick={() => updateFormData({ commissionType: v })}
                                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${(formData.commissionType || "percent") === v ? "bg-[#F44A22] text-white shadow-sm" : "text-text-tertiary"}`}>
                                                                {l}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <input type="number" value={formData.commission}
                                                        onChange={(e) => updateFormData({ commission: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                                                        className="w-20 h-10 bg-surface-secondary border border-border-default rounded-xl px-3 text-center font-bold text-text-primary focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {formData.useDefaultCommission === false && (
                                            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-tertiary border border-border-default text-[11px] text-text-secondary font-medium">
                                                <Sparkles className="w-4 h-4 text-[#F44A22]" />
                                                Set custom commission within each tier in the Tiers tab.
                                            </div>
                                        )}
                                    </div>

                                    {/* ─ Buyer Discount Section ─ */}
                                    {!formData.isRSVP && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[11px] font-black uppercase tracking-widest text-[#34c759]">Buyer Discounts</p>
                                                <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-[#34c759] text-[9px] font-black tracking-widest uppercase border border-emerald-500/20">Via Links</span>
                                            </div>

                                            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-tertiary border border-border-default">
                                                <div>
                                                    <p className="text-[13px] font-bold text-text-primary">Buyer Discounts</p>
                                                    <p className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Offer discounts via promoter links</p>
                                                </div>
                                                <Toggle on={formData.buyerDiscountsEnabled} onToggle={() => updateFormData({ buyerDiscountsEnabled: !formData.buyerDiscountsEnabled })} color="bg-[#34c759]" />
                                            </div>

                                            {formData.buyerDiscountsEnabled && (
                                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-3">
                                                    <div className="flex items-center justify-between p-3 rounded-xl bg-surface-tertiary border border-border-default">
                                                        <div>
                                                            <p className="text-[13px] font-bold text-text-primary">Standardize Discounts</p>
                                                            <p className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">
                                                                {formData.useDefaultDiscount !== false ? "Universal rate" : "Per-tier discounts"}
                                                            </p>
                                                        </div>
                                                        <Toggle on={formData.useDefaultDiscount !== false} onToggle={() => updateFormData({ useDefaultDiscount: formData.useDefaultDiscount === false })} color="bg-[#34c759]" />
                                                    </div>

                                                    {formData.useDefaultDiscount !== false && (
                                                        <div className="p-3 rounded-xl bg-surface-tertiary border border-border-default flex items-center justify-between gap-4">
                                                            <div>
                                                                <p className="text-[13px] font-bold text-text-primary">Default Discount</p>
                                                                <p className="text-[10px] text-text-tertiary uppercase tracking-widest font-bold">Applied to all tiers</p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex p-1 bg-surface-secondary rounded-xl border border-border-default">
                                                                    {[{ v: "percent", l: "%" }, { v: "amount", l: "₹" }].map(({ v, l }) => (
                                                                        <button key={v} onClick={() => updateFormData({ discountType: v })}
                                                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${(formData.discountType || "percent") === v ? "bg-[#34c759] text-white shadow-sm" : "text-text-tertiary"}`}>
                                                                            {l}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                                <input type="number" value={formData.discount}
                                                                    onChange={(e) => updateFormData({ discount: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                                                                    className="w-20 h-10 bg-surface-secondary border border-border-default rounded-xl px-3 text-center font-bold text-text-primary focus:outline-none"
                                                                />
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
                    </motion.div>
                )}

                {/* ── Settings Tab ── */}
                {activeTab === 'settings' && (
                    <motion.div key="settings" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="space-y-4">
                        {/* Order Limits */}
                        {!formData.isRSVP && (
                            <div className="p-4 rounded-xl border border-border-default bg-surface-secondary space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-surface-tertiary flex items-center justify-center text-text-tertiary flex-shrink-0">
                                        <Users className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-bold text-text-primary">Booking Limits</p>
                                        <p className="text-[11px] text-text-secondary">Min/max tickets per account</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
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
                                <p className="text-[11px] text-text-tertiary bg-surface-tertiary p-2.5 rounded-lg">
                                    Limits apply per user account across all tiers. Couple tickets count as 1 unit.
                                </p>
                            </div>
                        )}

                        {/* Promo Codes */}
                        {!formData.isRSVP && (
                            <div className="p-4 rounded-xl border border-border-default bg-surface-secondary">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-surface-tertiary flex items-center justify-center text-text-tertiary flex-shrink-0">
                                        <Tag className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-bold text-text-primary">Promo Codes</p>
                                        <p className="text-[11px] text-text-secondary">Discount codes for buyers</p>
                                    </div>
                                </div>
                                <PromoCodeManager
                                    promoCodes={formData.promoCodes || []}
                                    onChange={(codes) => updateFormData({ promoCodes: codes })}
                                    tiers={tickets.map(t => ({ id: t.id, name: t.name }))}
                                />
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

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
