"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Ticket, Wine, DoorOpen, Percent, Plus, Trash2, GripVertical,
    ChevronDown, ChevronUp, IndianRupee, Info, Copy, Crown, Sparkles
} from "lucide-react";

// ─── Primitives ────────────────────────────────────────────────────────────────

function ModuleCard({ icon: Icon, iconColor, accent, title, subtitle, children, trailing }: {
    icon: any; iconColor: string; accent: string; title: string; subtitle: string; children: React.ReactNode; trailing?: React.ReactNode
}) {
    return (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-white/[0.04] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
                        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                    </div>
                    <div>
                        <h3 className="text-[13px] font-bold text-white">{title}</h3>
                        <p className="text-[10px] text-white/35 mt-0.5">{subtitle}</p>
                    </div>
                </div>
                {trailing}
            </div>
            <div className="px-6 py-5 space-y-5">
                {children}
            </div>
        </div>
    );
}

function Toggle({ enabled, onChange, label, desc }: {
    enabled: boolean; onChange: (v: boolean) => void; label: string; desc?: string
}) {
    return (
        <button type="button" onClick={() => onChange(!enabled)} className="w-full flex items-center justify-between gap-4 group">
            <div className="text-left">
                <p className="text-[12px] font-semibold text-white/70 group-hover:text-white/90 transition-colors">{label}</p>
                {desc && <p className="text-[10px] text-white/30 mt-0.5 leading-tight">{desc}</p>}
            </div>
            <div className={`w-10 h-6 rounded-full border transition-all duration-200 flex-shrink-0 ${enabled ? 'bg-[#F44A22] border-[#F44A22]' : 'bg-white/[0.06] border-white/[0.12]'}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm mt-0.5 transition-all duration-200 ${enabled ? 'ml-5' : 'ml-0.5'}`} />
            </div>
        </button>
    );
}

const formatINR = (v: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

// ─── Ticket Tier Builder ──────────────────────────────────────────────────────

const ENTRY_TYPES = [
    { id: 'general', label: 'General', color: '#6B7280' },
    { id: 'stag',    label: 'Stag',    color: '#3B82F6' },
    { id: 'couple',  label: 'Couple',  color: '#EC4899' },
    { id: 'female',  label: 'Female',  color: '#A855F7' },
    { id: 'vip',     label: 'VIP',     color: '#F59E0B' },
] as const;

const PRESET_TIERS = [
    { name: 'Early Bird',    entryType: 'general' as const, price: 299,  quantity: 50  },
    { name: 'Phase 1',       entryType: 'general' as const, price: 499,  quantity: 100 },
    { name: 'Phase 2',       entryType: 'general' as const, price: 699,  quantity: 100 },
    { name: 'Final Release', entryType: 'general' as const, price: 999,  quantity: 50  },
    { name: 'Stag Entry',    entryType: 'stag'    as const, price: 599,  quantity: 100 },
    { name: 'Couple Entry',  entryType: 'couple'  as const, price: 999,  quantity: 50  },
    { name: 'Female Entry',  entryType: 'female'  as const, price: 299,  quantity: 80  },
    { name: 'VIP Access',    entryType: 'vip'     as const, price: 1499, quantity: 30  },
];

function newTier(): any {
    return {
        id: `tier_${Date.now()}`,
        name: '',
        entryType: 'general',
        price: '',
        quantity: '',
        minPerOrder: 1,
        maxPerOrder: 10,
        promoterEnabled: true,
    };
}

interface TicketTierCardProps {
    tier: any;
    index: number;
    onUpdate: (updates: any) => void;
    onRemove: () => void;
    onDuplicate: () => void;
    promotersEnabled: boolean;
    globalCommission: number;
    globalCommissionType: string;
}

function TicketTierCard({ tier, index, onUpdate, onRemove, onDuplicate, promotersEnabled, globalCommission, globalCommissionType }: TicketTierCardProps) {
    const [expanded, setExpanded] = useState(false);
    const entryColor = ENTRY_TYPES.find(e => e.id === tier.entryType)?.color || '#6B7280';
    const gross = (Number(tier.price) || 0) * (Number(tier.quantity) || 0);

    return (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
            {/* Tier header row */}
            <div className="p-4">
                <div className="flex items-center gap-3">
                    {/* Drag handle placeholder */}
                    <GripVertical className="w-3.5 h-3.5 text-white/15 flex-shrink-0 cursor-grab" />

                    {/* Entry type badge */}
                    <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-[9px] font-black"
                        style={{ backgroundColor: `${entryColor}20`, color: entryColor }}
                    >
                        {tier.entryType?.[0]?.toUpperCase() || 'G'}
                    </div>

                    {/* Name */}
                    <input
                        value={tier.name}
                        onChange={e => onUpdate({ name: e.target.value })}
                        placeholder={`Tier ${index + 1} name`}
                        className="flex-1 min-w-0 bg-transparent text-[13px] font-bold text-white placeholder:text-white/20 focus:outline-none"
                    />

                    {/* Price */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-white/30 text-[11px]">₹</span>
                        <input
                            type="number"
                            value={tier.price}
                            onChange={e => onUpdate({ price: e.target.value === '' ? '' : Number(e.target.value) })}
                            placeholder="0"
                            min={0}
                            className="w-20 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 h-8 text-[12px] font-bold text-white text-right focus:outline-none focus:border-[#F44A22]/50 transition-all [appearance:textfield]"
                        />
                    </div>

                    {/* Qty */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-white/30 text-[10px]">×</span>
                        <input
                            type="number"
                            value={tier.quantity}
                            onChange={e => onUpdate({ quantity: e.target.value === '' ? '' : Number(e.target.value) })}
                            placeholder="qty"
                            min={1}
                            className="w-16 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 h-8 text-[12px] font-bold text-white text-right focus:outline-none focus:border-[#F44A22]/50 transition-all [appearance:textfield]"
                        />
                    </div>

                    {/* Gross preview */}
                    {gross > 0 && (
                        <span className="text-emerald-400/70 text-[11px] font-semibold tabular-nums flex-shrink-0">
                            {formatINR(gross)}
                        </span>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button type="button" onClick={() => setExpanded(p => !p)} className="w-7 h-7 rounded-lg hover:bg-white/[0.06] flex items-center justify-center transition-colors">
                            {expanded ? <ChevronUp className="w-3 h-3 text-white/40" /> : <ChevronDown className="w-3 h-3 text-white/40" />}
                        </button>
                        <button type="button" onClick={onDuplicate} className="w-7 h-7 rounded-lg hover:bg-white/[0.06] flex items-center justify-center transition-colors">
                            <Copy className="w-3 h-3 text-white/40" />
                        </button>
                        <button type="button" onClick={onRemove} className="w-7 h-7 rounded-lg hover:bg-red-500/10 flex items-center justify-center transition-colors">
                            <Trash2 className="w-3 h-3 text-white/30 hover:text-red-400" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Expanded details */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 border-t border-white/[0.05] pt-4 space-y-4">
                            {/* Entry type */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">Entry Type</label>
                                <div className="flex gap-1.5 flex-wrap">
                                    {ENTRY_TYPES.map(et => (
                                        <button
                                            key={et.id}
                                            type="button"
                                            onClick={() => onUpdate({ entryType: et.id })}
                                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${tier.entryType === et.id ? 'text-white' : 'text-white/30 hover:text-white/55 bg-white/[0.03]'}`}
                                            style={tier.entryType === et.id ? { backgroundColor: `${et.color}20`, color: et.color, border: `1px solid ${et.color}40` } : { border: '1px solid transparent' }}
                                        >
                                            {et.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Sale window */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">Sale Start</label>
                                    <input
                                        type="datetime-local"
                                        value={tier.salesStart || ''}
                                        onChange={e => onUpdate({ salesStart: e.target.value })}
                                        className="w-full px-3 h-10 rounded-xl text-[11px] text-white bg-white/[0.05] border border-white/[0.08] focus:outline-none focus:border-[#F44A22]/50 transition-all [color-scheme:dark]"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">Sale End</label>
                                    <input
                                        type="datetime-local"
                                        value={tier.salesEnd || ''}
                                        onChange={e => onUpdate({ salesEnd: e.target.value })}
                                        className="w-full px-3 h-10 rounded-xl text-[11px] text-white bg-white/[0.05] border border-white/[0.08] focus:outline-none focus:border-[#F44A22]/50 transition-all [color-scheme:dark]"
                                    />
                                </div>
                            </div>

                            {/* Order limits */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">Min per order</label>
                                    <input
                                        type="number"
                                        value={tier.minPerOrder || 1}
                                        onChange={e => onUpdate({ minPerOrder: parseInt(e.target.value) || 1 })}
                                        min={1}
                                        className="w-full px-3 h-10 rounded-xl text-[12px] font-bold text-white bg-white/[0.05] border border-white/[0.08] focus:outline-none focus:border-[#F44A22]/50 transition-all [appearance:textfield]"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">Max per order</label>
                                    <input
                                        type="number"
                                        value={tier.maxPerOrder || 10}
                                        onChange={e => onUpdate({ maxPerOrder: parseInt(e.target.value) || 10 })}
                                        min={1}
                                        className="w-full px-3 h-10 rounded-xl text-[12px] font-bold text-white bg-white/[0.05] border border-white/[0.08] focus:outline-none focus:border-[#F44A22]/50 transition-all [appearance:textfield]"
                                    />
                                </div>
                            </div>

                            {/* Promoter override */}
                            {promotersEnabled && (
                                <div className="space-y-3">
                                    <Toggle
                                        enabled={tier.promoterEnabled ?? true}
                                        onChange={v => onUpdate({ promoterEnabled: v })}
                                        label="Available via promoters"
                                        desc="Promoters can sell this tier"
                                    />
                                    {tier.promoterEnabled && (
                                        <Toggle
                                            enabled={tier.overrideCommission ?? false}
                                            onChange={v => onUpdate({ overrideCommission: v })}
                                            label="Override commission for this tier"
                                            desc={`Default: ${globalCommission}${globalCommissionType === 'percent' ? '%' : '₹ flat'}`}
                                        />
                                    )}
                                    {tier.promoterEnabled && tier.overrideCommission && (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={tier.promoterCommission ?? ''}
                                                onChange={e => onUpdate({ promoterCommission: Number(e.target.value) })}
                                                placeholder={String(globalCommission)}
                                                min={0}
                                                className="w-24 px-3 h-9 rounded-lg text-[12px] font-bold text-white bg-white/[0.06] border border-white/[0.08] focus:outline-none focus:border-[#F44A22]/50 transition-all [appearance:textfield]"
                                            />
                                            <div className="flex gap-1">
                                                {(['percent', 'amount'] as const).map(t => (
                                                    <button
                                                        key={t}
                                                        type="button"
                                                        onClick={() => onUpdate({ promoterCommissionType: t })}
                                                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${(tier.promoterCommissionType || 'percent') === t ? 'bg-white/[0.1] text-white' : 'text-white/30'}`}
                                                    >
                                                        {t === 'percent' ? '%' : '₹'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Table Package Builder ─────────────────────────────────────────────────────

const TABLE_TYPES = [
    { id: 'standard', label: 'Standard', color: '#6B7280' },
    { id: 'premium',  label: 'Premium',  color: '#F44A22' },
    { id: 'vvip',     label: 'VVIP',     color: '#A855F7' },
    { id: 'booth',    label: 'Booth',    color: '#3B82F6' },
    { id: 'cabana',   label: 'Cabana',   color: '#10B981' },
] as const;

const TABLE_INCLUDES = [
    '1 Premium Bottle', '2 Premium Bottles', '3 Premium Bottles',
    'Mixers & Ice', 'Dedicated Server', 'Priority Entry',
    'Reserved Seating', 'Complimentary Snacks', 'VIP Wristbands',
];

function newTable(): any {
    return {
        id: `tbl_${Date.now()}`,
        name: '',
        tableType: 'standard',
        capacity: 4,
        quantity: 5,
        price: '',
        minimumSpend: '',
        includes: [],
        location: '',
        promoterEnabled: false,
    };
}

interface TablePackageCardProps {
    pkg: any;
    onUpdate: (updates: any) => void;
    onRemove: () => void;
}

function TablePackageCard({ pkg, onUpdate, onRemove }: TablePackageCardProps) {
    const [expanded, setExpanded] = useState(true);
    const typeColor = TABLE_TYPES.find(t => t.id === pkg.tableType)?.color || '#6B7280';
    const gross = (Number(pkg.price) || 0) * (Number(pkg.quantity) || 0);

    const toggleInclude = (item: string) => {
        const curr: string[] = pkg.includes || [];
        onUpdate({ includes: curr.includes(item) ? curr.filter(i => i !== item) : [...curr, item] });
    };

    return (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
            <div className="p-4">
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-[9px] font-black" style={{ backgroundColor: `${typeColor}20`, color: typeColor }}>
                        <Wine className="w-3 h-3" style={{ color: typeColor }} />
                    </div>
                    <input
                        value={pkg.name}
                        onChange={e => onUpdate({ name: e.target.value })}
                        placeholder="Package name"
                        className="flex-1 min-w-0 bg-transparent text-[13px] font-bold text-white placeholder:text-white/20 focus:outline-none"
                    />
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-white/30 text-[11px]">₹</span>
                        <input
                            type="number"
                            value={pkg.price}
                            onChange={e => onUpdate({ price: e.target.value === '' ? '' : Number(e.target.value) })}
                            placeholder="0"
                            min={0}
                            className="w-20 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 h-8 text-[12px] font-bold text-white text-right focus:outline-none focus:border-[#F44A22]/50 transition-all [appearance:textfield]"
                        />
                    </div>
                    {gross > 0 && <span className="text-emerald-400/70 text-[11px] font-semibold tabular-nums flex-shrink-0">{formatINR(gross)}</span>}
                    <button type="button" onClick={() => setExpanded(p => !p)} className="w-7 h-7 rounded-lg hover:bg-white/[0.06] flex items-center justify-center transition-colors">
                        {expanded ? <ChevronUp className="w-3 h-3 text-white/40" /> : <ChevronDown className="w-3 h-3 text-white/40" />}
                    </button>
                    <button type="button" onClick={onRemove} className="w-7 h-7 rounded-lg hover:bg-red-500/10 flex items-center justify-center transition-colors">
                        <Trash2 className="w-3 h-3 text-white/30 hover:text-red-400" />
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 border-t border-white/[0.05] pt-4 space-y-4">
                            {/* Table type */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">Table Type</label>
                                <div className="flex gap-1.5 flex-wrap">
                                    {TABLE_TYPES.map(t => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => onUpdate({ tableType: t.id })}
                                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all`}
                                            style={pkg.tableType === t.id
                                                ? { backgroundColor: `${t.color}20`, color: t.color, border: `1px solid ${t.color}40` }
                                                : { color: 'rgba(255,255,255,0.3)', border: '1px solid transparent' }
                                            }
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">Tables</label>
                                    <input type="number" value={pkg.quantity} onChange={e => onUpdate({ quantity: parseInt(e.target.value) || 0 })} min={0}
                                        className="w-full px-3 h-10 rounded-xl text-[12px] font-bold text-white bg-white/[0.05] border border-white/[0.08] focus:outline-none focus:border-[#F44A22]/50 [appearance:textfield]" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">Seats</label>
                                    <input type="number" value={pkg.capacity} onChange={e => onUpdate({ capacity: parseInt(e.target.value) || 0 })} min={1}
                                        className="w-full px-3 h-10 rounded-xl text-[12px] font-bold text-white bg-white/[0.05] border border-white/[0.08] focus:outline-none focus:border-[#F44A22]/50 [appearance:textfield]" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">Min Spend</label>
                                    <input type="number" value={pkg.minimumSpend ?? ''} onChange={e => onUpdate({ minimumSpend: e.target.value === '' ? '' : Number(e.target.value) })} min={0} placeholder="–"
                                        className="w-full px-3 h-10 rounded-xl text-[12px] font-bold text-white bg-white/[0.05] border border-white/[0.08] focus:outline-none focus:border-[#F44A22]/50 [appearance:textfield]" />
                                </div>
                            </div>

                            {/* Location */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">Zone / Location</label>
                                <input value={pkg.location || ''} onChange={e => onUpdate({ location: e.target.value })} placeholder="e.g. Main Floor, Rooftop, Balcony"
                                    className="w-full px-3 h-10 rounded-xl text-[12px] text-white bg-white/[0.05] border border-white/[0.08] focus:outline-none focus:border-[#F44A22]/50 transition-all placeholder:text-white/20" />
                            </div>

                            {/* Includes */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">Includes</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {TABLE_INCLUDES.map(item => {
                                        const selected = (pkg.includes || []).includes(item);
                                        return (
                                            <button
                                                key={item}
                                                type="button"
                                                onClick={() => toggleInclude(item)}
                                                className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${selected ? 'bg-[#F44A22]/15 border border-[#F44A22]/30 text-[#F44A22]' : 'bg-white/[0.04] border border-white/[0.06] text-white/35 hover:text-white/55'}`}
                                            >
                                                {item}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Main Step Component ──────────────────────────────────────────────────────

interface RevenueStepV3Props {
    formData: any;
    updateFormData: (updates: any) => void;
    validationErrors: Record<string, string>;
}

export function RevenueStepV3({ formData, updateFormData, validationErrors }: RevenueStepV3Props) {
    const [showPresets, setShowPresets] = useState(false);
    const [showPromoterRules, setShowPromoterRules] = useState(false);

    const tickets: any[] = formData.tickets || [];
    const tables: any[] = formData.tables || [];

    const updateTier = (id: string, updates: any) =>
        updateFormData({ tickets: tickets.map(t => t.id === id ? { ...t, ...updates } : t) });

    const removeTier = (id: string) =>
        updateFormData({ tickets: tickets.filter(t => t.id !== id) });

    const duplicateTier = (tier: any) =>
        updateFormData({ tickets: [...tickets, { ...tier, id: `tier_${Date.now()}`, name: `${tier.name} (copy)` }] });

    const updateTable = (id: string, updates: any) =>
        updateFormData({ tables: tables.map(t => t.id === id ? { ...t, ...updates } : t) });

    const removeTable = (id: string) =>
        updateFormData({ tables: tables.filter(t => t.id !== id) });

    return (
        <div className="space-y-4">

            {/* 1. Ticket Tiers */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
                <div className="px-6 pt-6 pb-4 border-b border-white/[0.04] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#F44A22]/10 flex items-center justify-center">
                            <Ticket className="w-3.5 h-3.5 text-[#F44A22]" />
                        </div>
                        <div>
                            <h3 className="text-[13px] font-bold text-white">Ticket Tiers</h3>
                            <p className="text-[10px] text-white/35 mt-0.5">{tickets.length} tier{tickets.length !== 1 ? 's' : ''} · price ladder from early to door</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowPresets(p => !p)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-[10px] font-semibold text-white/50 hover:text-white/80 hover:border-white/[0.12] transition-all"
                        >
                            <Sparkles className="w-3 h-3" />
                            Presets
                        </button>
                        <button
                            type="button"
                            onClick={() => updateFormData({ tickets: [...tickets, newTier()] })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#F44A22]/30 bg-[#F44A22]/10 text-[10px] font-bold text-[#F44A22] hover:bg-[#F44A22]/15 transition-all"
                        >
                            <Plus className="w-3 h-3" />
                            Add tier
                        </button>
                    </div>
                </div>

                <div className="px-6 py-5 space-y-3">
                    {/* Presets panel */}
                    <AnimatePresence>
                        {showPresets && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3 mb-2">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Quick-add preset tiers</p>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {PRESET_TIERS.map(preset => (
                                            <button
                                                key={preset.name}
                                                type="button"
                                                onClick={() => {
                                                    updateFormData({ tickets: [...tickets, { ...newTier(), ...preset, id: `tier_${Date.now()}` }] });
                                                    setShowPresets(false);
                                                }}
                                                className="text-left p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1] transition-all"
                                            >
                                                <p className="text-[11px] font-bold text-white/70">{preset.name}</p>
                                                <p className="text-[9px] text-white/30 mt-0.5">₹{preset.price} · {preset.quantity} spots</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {tickets.length === 0 ? (
                        <div className="py-8 text-center">
                            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mx-auto mb-3">
                                <Ticket className="w-4 h-4 text-white/20" />
                            </div>
                            <p className="text-[12px] text-white/30 font-medium">No ticket tiers yet</p>
                            <p className="text-[10px] text-white/20 mt-1">Add tiers or choose from presets above</p>
                        </div>
                    ) : (
                        tickets.map((tier, i) => (
                            <TicketTierCard
                                key={tier.id}
                                tier={tier}
                                index={i}
                                onUpdate={u => updateTier(tier.id, u)}
                                onRemove={() => removeTier(tier.id)}
                                onDuplicate={() => duplicateTier(tier)}
                                promotersEnabled={formData.promotersEnabled}
                                globalCommission={formData.commission || 15}
                                globalCommissionType={formData.commissionType || 'percent'}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* 2. Tables */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
                <div className="px-6 pt-6 pb-4 border-b border-white/[0.04]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${formData.tablesEnabled ? 'bg-purple-500/10' : 'bg-white/[0.04]'}`}>
                                <Wine className={`w-3.5 h-3.5 ${formData.tablesEnabled ? 'text-purple-400' : 'text-white/25'}`} />
                            </div>
                            <div>
                                <h3 className="text-[13px] font-bold text-white">Table Packages</h3>
                                <p className="text-[10px] text-white/35 mt-0.5">Reserved seating with minimum spends</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {formData.tablesEnabled && (
                                <button
                                    type="button"
                                    onClick={() => updateFormData({ tables: [...tables, newTable()] })}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-[10px] font-bold text-purple-400 hover:bg-purple-500/15 transition-all"
                                >
                                    <Plus className="w-3 h-3" />
                                    Add package
                                </button>
                            )}
                            {/* Toggle */}
                            <button
                                type="button"
                                onClick={() => updateFormData({ tablesEnabled: !formData.tablesEnabled })}
                                className={`w-10 h-6 rounded-full border transition-all duration-200 flex-shrink-0 ${formData.tablesEnabled ? 'bg-purple-500 border-purple-500' : 'bg-white/[0.06] border-white/[0.12]'}`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm mt-0.5 transition-all duration-200 ${formData.tablesEnabled ? 'ml-5' : 'ml-0.5'}`} />
                            </button>
                        </div>
                    </div>
                </div>
                {formData.tablesEnabled && (
                    <div className="px-6 py-5 space-y-3">
                        {tables.length === 0 ? (
                            <div className="py-8 text-center">
                                <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mx-auto mb-3">
                                    <Wine className="w-4 h-4 text-white/20" />
                                </div>
                                <p className="text-[12px] text-white/30 font-medium">No table packages yet</p>
                            </div>
                        ) : (
                            tables.map(pkg => (
                                <TablePackageCard
                                    key={pkg.id}
                                    pkg={pkg}
                                    onUpdate={u => updateTable(pkg.id, u)}
                                    onRemove={() => removeTable(pkg.id)}
                                />
                            ))
                        )}
                    </div>
                )}
                {!formData.tablesEnabled && (
                    <div className="px-6 py-4">
                        <p className="text-[11px] text-white/25 italic">Enable tables to configure packages and minimum spends</p>
                    </div>
                )}
            </div>

            {/* 3. Walk-in Cover */}
            {formData.walkInEnabled && (
                <ModuleCard
                    icon={DoorOpen}
                    iconColor="text-blue-400"
                    accent="bg-blue-500/10"
                    title="Walk-in Cover"
                    subtitle="Additional cover revenue tracked separately"
                >
                    <div className="flex items-center gap-3">
                        <div className="flex-1 space-y-1.5">
                            <label className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">Cover Price (₹)</label>
                            <input
                                type="number"
                                value={formData.coverPrice ?? formData.walkInCoverPrice ?? ''}
                                onChange={e => updateFormData({ coverPrice: Number(e.target.value), walkInCoverPrice: Number(e.target.value) })}
                                placeholder="500"
                                min={0}
                                className="w-full px-4 h-12 rounded-xl text-[14px] font-bold text-white bg-white/[0.05] border border-white/[0.08] focus:outline-none focus:border-[#F44A22]/50 transition-all [appearance:textfield]"
                            />
                        </div>
                    </div>
                    <p className="text-[9px] text-white/20">Shown to guests as walk-in price. Collected at door, not through the app inventory.</p>
                </ModuleCard>
            )}

            {/* 4. Promoter Sales */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
                <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <Percent className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-[13px] font-bold text-white">Promoter Sales</h3>
                            <p className="text-[10px] text-white/35 mt-0.5">Commission and discount rules</p>
                        </div>
                    </div>
                    <Toggle
                        enabled={formData.promotersEnabled ?? true}
                        onChange={v => updateFormData({ promotersEnabled: v })}
                        label=""
                    />
                </div>

                {formData.promotersEnabled && (
                    <div className="px-6 pb-5 border-t border-white/[0.04] pt-5 space-y-5">
                        {/* Commission model */}
                        <div className="space-y-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Default Commission</p>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    value={formData.commission ?? 15}
                                    onChange={e => updateFormData({ commission: Number(e.target.value) })}
                                    min={0}
                                    max={formData.commissionType === 'percent' ? 100 : undefined}
                                    className="w-24 px-3 h-11 rounded-xl text-[15px] font-bold text-white bg-white/[0.05] border border-white/[0.08] focus:outline-none focus:border-[#F44A22]/50 transition-all [appearance:textfield]"
                                />
                                <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                                    {(['percent', 'amount'] as const).map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => updateFormData({ commissionType: t })}
                                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${formData.commissionType === t ? 'bg-white/[0.1] text-white' : 'text-white/35 hover:text-white/55'}`}
                                        >
                                            {t === 'percent' ? '% per sale' : '₹ flat / ticket'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <p className="text-[9px] text-white/25">
                                {formData.commissionType === 'percent'
                                    ? `Promoters earn ${formData.commission || 15}% of every ticket sold through their link`
                                    : `Promoters earn ₹${formData.commission || 15} per ticket sold through their link`
                                }
                            </p>
                        </div>

                        {/* Buyer discounts */}
                        <div className="space-y-3 pt-4 border-t border-white/[0.04]">
                            <Toggle
                                enabled={formData.buyerDiscountsEnabled ?? false}
                                onChange={v => updateFormData({ buyerDiscountsEnabled: v })}
                                label="Enable buyer discounts via promoter links"
                                desc="Guests who buy via a promoter link get a discount"
                            />
                            {formData.buyerDiscountsEnabled && (
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        value={formData.discount ?? 10}
                                        onChange={e => updateFormData({ discount: Number(e.target.value) })}
                                        min={0}
                                        max={formData.discountType === 'percent' ? 100 : undefined}
                                        className="w-24 px-3 h-11 rounded-xl text-[15px] font-bold text-white bg-white/[0.05] border border-white/[0.08] focus:outline-none focus:border-[#F44A22]/50 transition-all [appearance:textfield]"
                                    />
                                    <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                                        {(['percent', 'amount'] as const).map(t => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => updateFormData({ discountType: t })}
                                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${formData.discountType === t ? 'bg-white/[0.1] text-white' : 'text-white/35 hover:text-white/55'}`}
                                            >
                                                {t === 'percent' ? '% off' : '₹ off'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
