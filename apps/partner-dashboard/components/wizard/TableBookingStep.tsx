"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users,
    Plus,
    X,
    ChevronDown,
    ChevronUp,
    Sparkles,
    Crown,
    Wine,
    Armchair,
    MapPin,
    DollarSign,
    Percent,
    AlertCircle,
    Check,
    Trash2
} from "lucide-react";

interface TablePackage {
    id: string;
    name: string;
    tableType: "standard" | "premium" | "vvip" | "booth" | "cabana";
    capacity: number;        // People per table
    quantity: number;        // Number of tables available
    price: number | "";
    minimumSpend?: number | "";  // Optional minimum spend requirement
    includes: string[];      // What's included (bottles, mixers, etc.)
    location?: string;       // e.g., "Main Floor", "Rooftop", "VIP Section"
    promoterEnabled: boolean;
    promoterCommission?: number | "";
    promoterCommissionType?: "percent" | "amount";
    // Buyer discount settings (same as ticket tiers)
    buyerDiscountEnabled?: boolean;
    promoterDiscount?: number | "";
    promoterDiscountType?: "percent" | "amount";
    description?: string;
}

interface TableBookingStepProps {
    formData: any;
    updateFormData: (updates: any) => void;
    validationErrors: Record<string, string>;
}

const TABLE_TYPES = [
    { id: "standard", label: "Standard", icon: Armchair, description: "Regular table", color: "#86868b" },
    { id: "premium", label: "Premium", icon: Crown, description: "Better location", color: "#F44A22" },
    { id: "vvip", label: "VVIP", icon: Sparkles, description: "Best in house", color: "#af52de" },
    { id: "booth", label: "Booth", icon: Users, description: "Private booth", color: "#007aff" },
    { id: "cabana", label: "Cabana", icon: Wine, description: "Outdoor cabana", color: "#34c759" },
];

const COMMON_INCLUDES = [
    "1 Premium Bottle",
    "2 Premium Bottles",
    "3 Premium Bottles",
    "Mixers & Ice",
    "Dedicated Server",
    "Priority Entry",
    "Reserved Seating",
    "Complimentary Snacks",
    "VIP Wristbands",
    "Private Security",
];

function TablePackageCard({
    table,
    index,
    onUpdate,
    onRemove,
    canRemove,
    eventDefaultCommission,
    eventDefaultCommissionType
}: {
    table: TablePackage;
    index: number;
    onUpdate: (updates: Partial<TablePackage>) => void;
    onRemove: () => void;
    canRemove: boolean;
    eventDefaultCommission?: number | "";
    eventDefaultCommissionType?: "percent" | "amount";
}) {
    const [expanded, setExpanded] = useState(index === 0);
    const [showIncludesDropdown, setShowIncludesDropdown] = useState(false);
    const tableType = TABLE_TYPES.find(t => t.id === table.tableType) || TABLE_TYPES[0];
    const Icon = tableType.icon;

    const toggleInclude = (item: string) => {
        const current = table.includes || [];
        if (current.includes(item)) {
            onUpdate({ includes: current.filter(i => i !== item) });
        } else {
            onUpdate({ includes: [...current, item] });
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-3xl border border-[rgba(0,0,0,0.06)] shadow-sm overflow-hidden"
        >
            {/* Header */}
            <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#f5f5f7]/50 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ backgroundColor: `${tableType.color}15`, color: tableType.color }}
                    >
                        <Icon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-[15px] font-bold text-[#1d1d1f]">
                            {table.name || "Unnamed Table"}
                        </h3>
                        <p className="text-[12px] text-[#86868b]">
                            {tableType.label} • {table.capacity} guests • {table.quantity} available
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[17px] font-bold text-[#1d1d1f]">
                        ₹{Number(table.price) || 0}
                    </span>
                    {expanded ? (
                        <ChevronUp className="w-5 h-5 text-[#86868b]" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-[#86868b]" />
                    )}
                    {canRemove && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onRemove(); }}
                            className="p-2 rounded-xl hover:bg-[#ff3b30]/10 text-[#ff3b30] transition-colors"
                        >
                            <X className="w-4 h-4" />
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
                            {/* Table Name */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-medium text-[#86868b] uppercase tracking-wide">
                                    Table/Package Name
                                </label>
                                <input
                                    type="text"
                                    value={table.name}
                                    onChange={(e) => onUpdate({ name: e.target.value })}
                                    placeholder="e.g., Gold Table, VIP Booth"
                                    className="w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border border-transparent text-[15px] text-[#1d1d1f] placeholder:text-[#86868b]/50 focus:outline-none focus:border-[#007aff] focus:bg-white transition-all"
                                />
                            </div>

                            {/* Table Type Selection */}
                            <div className="space-y-2">
                                <label className="block text-[11px] font-medium text-[#86868b] uppercase tracking-wide">
                                    Table Type
                                </label>
                                <div className="grid grid-cols-5 gap-2">
                                    {TABLE_TYPES.map(type => {
                                        const TypeIcon = type.icon;
                                        const isSelected = table.tableType === type.id;
                                        return (
                                            <button
                                                key={type.id}
                                                onClick={() => {
                                                    const updates: any = { tableType: type.id };
                                                    if (!table.name || TABLE_TYPES.some(t => table.name === `${t.label} Table`)) {
                                                        updates.name = `${type.label} Table`;
                                                    }
                                                    onUpdate(updates);
                                                }}
                                                className={`p-3 rounded-xl border text-center transition-all ${isSelected
                                                    ? "border-[#007aff] bg-[#007aff]/5"
                                                    : "border-[rgba(0,0,0,0.06)] hover:border-[rgba(0,0,0,0.12)]"
                                                    }`}
                                            >
                                                <TypeIcon
                                                    className="w-5 h-5 mx-auto mb-1"
                                                    style={{ color: isSelected ? type.color : "#86868b" }}
                                                />
                                                <p className={`text-[11px] font-medium ${isSelected ? "text-[#007aff]" : "text-[#1d1d1f]"}`}>
                                                    {type.label}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Capacity & Quantity */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-medium text-[#86868b] uppercase tracking-wide">
                                        Guests per Table
                                    </label>
                                    <div className="relative">
                                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
                                        <input
                                            type="number"
                                            value={table.capacity}
                                            onChange={(e) => onUpdate({ capacity: parseInt(e.target.value) || 4 })}
                                            min={1}
                                            max={20}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#f5f5f7] border border-transparent text-[15px] text-[#1d1d1f] focus:outline-none focus:border-[#007aff] focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-medium text-[#86868b] uppercase tracking-wide">
                                        Tables Available
                                    </label>
                                    <input
                                        type="number"
                                        value={table.quantity}
                                        onChange={(e) => onUpdate({ quantity: parseInt(e.target.value) || 1 })}
                                        min={1}
                                        className="w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border border-transparent text-[15px] text-[#1d1d1f] focus:outline-none focus:border-[#007aff] focus:bg-white transition-all"
                                    />
                                </div>
                            </div>

                            {/* Price & Minimum Spend */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-medium text-[#86868b] uppercase tracking-wide">
                                        Price per Table
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] font-bold text-[#86868b]">₹</span>
                                        <input
                                            type="number"
                                            value={table.price}
                                            onChange={(e) => onUpdate({ price: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                                            placeholder="0"
                                            className="w-full pl-8 pr-4 py-3 rounded-xl bg-[#f5f5f7] border border-transparent text-[15px] font-bold text-[#1d1d1f] focus:outline-none focus:border-[#007aff] focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-medium text-[#86868b] uppercase tracking-wide">
                                        Minimum Spend (Optional)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] font-bold text-[#86868b]">₹</span>
                                        <input
                                            type="number"
                                            value={table.minimumSpend}
                                            onChange={(e) => onUpdate({ minimumSpend: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                                            placeholder="0"
                                            className="w-full pl-8 pr-4 py-3 rounded-xl bg-[#f5f5f7] border border-transparent text-[15px] text-[#1d1d1f] focus:outline-none focus:border-[#007aff] focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Location */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-medium text-[#86868b] uppercase tracking-wide">
                                    Table Location (Optional)
                                </label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
                                    <input
                                        type="text"
                                        value={table.location || ""}
                                        onChange={(e) => onUpdate({ location: e.target.value })}
                                        placeholder="e.g., Main Floor, Rooftop, VIP Section"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#f5f5f7] border border-transparent text-[15px] text-[#1d1d1f] placeholder:text-[#86868b]/50 focus:outline-none focus:border-[#007aff] focus:bg-white transition-all"
                                    />
                                </div>
                            </div>

                            {/* What's Included */}
                            <div className="space-y-2">
                                <label className="block text-[11px] font-medium text-[#86868b] uppercase tracking-wide">
                                    What's Included
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {COMMON_INCLUDES.map(item => {
                                        const isSelected = table.includes?.includes(item);
                                        return (
                                            <button
                                                key={item}
                                                onClick={() => toggleInclude(item)}
                                                className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${isSelected
                                                    ? "bg-[#F44A22] text-white"
                                                    : "bg-[#f5f5f7] text-[#86868b] hover:bg-[#e5e5ea]"
                                                    }`}
                                            >
                                                {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                                                {item}
                                            </button>
                                        );
                                    })}
                                </div>
                                {table.includes?.length > 0 && (
                                    <p className="text-[11px] text-[#86868b]">
                                        {table.includes.length} item{table.includes.length > 1 ? 's' : ''} included
                                    </p>
                                )}
                            </div>

                            {/* Description */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-medium text-[#86868b] uppercase tracking-wide">
                                    Description (Optional)
                                </label>
                                <textarea
                                    value={table.description || ""}
                                    onChange={(e) => onUpdate({ description: e.target.value })}
                                    placeholder="Add details about this table package..."
                                    className="w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border border-transparent text-[14px] text-[#1d1d1f] placeholder:text-[#86868b]/50 focus:outline-none focus:border-[#007aff] focus:bg-white transition-all min-h-[80px] resize-none"
                                />
                            </div>

                            {/* Promoter Settings Toggle */}
                            <div className="p-3 rounded-xl bg-[#f5f5f7] flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Percent className="w-4 h-4 text-[#86868b]" />
                                    <div>
                                        <p className="text-[13px] font-medium text-[#1d1d1f]">
                                            Promoter Sales
                                        </p>
                                        <p className="text-[11px] text-[#86868b]">
                                            Allow promoters to sell this table
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onUpdate({ promoterEnabled: !table.promoterEnabled })}
                                    className={`w-12 h-7 rounded-full relative transition-colors ${table.promoterEnabled ? "bg-[#34c759]" : "bg-[rgba(0,0,0,0.1)]"
                                        }`}
                                >
                                    <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${table.promoterEnabled ? "translate-x-[22px]" : "translate-x-0.5"
                                        }`} />
                                </button>
                            </div>

                            {/* Promoter Commission (if enabled) */}
                            {table.promoterEnabled && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-widest">
                                            Promoter Commission
                                        </label>
                                        <div className="flex p-0.5 bg-[#e5e5ea] rounded-xl">
                                            <button
                                                onClick={() => onUpdate({ promoterCommissionType: "percent" })}
                                                className={`px-3 py-1.5 rounded-[8px] text-[10px] font-bold transition-all ${(table.promoterCommissionType || "percent") === "percent"
                                                    ? "bg-[#F44A22] text-white shadow-md"
                                                    : "text-[#86868b] hover:text-[#1d1d1f]"
                                                    }`}
                                            >
                                                % PERCENT
                                            </button>
                                            <button
                                                onClick={() => onUpdate({ promoterCommissionType: "amount" })}
                                                className={`px-3 py-1.5 rounded-[8px] text-[10px] font-bold transition-all ${table.promoterCommissionType === "amount"
                                                    ? "bg-[#1d1d1f] text-white shadow-md"
                                                    : "text-[#86868b] hover:text-[#1d1d1f]"
                                                    }`}
                                            >
                                                ₹ FIXED
                                            </button>
                                        </div>
                                    </div>

                                    <div className={`relative rounded-2xl overflow-hidden border-2 transition-all ${(table.promoterCommissionType || "percent") === "percent"
                                        ? "border-[#F44A22]/20 bg-[#F44A22]/5"
                                        : "border-[#1d1d1f]/20 bg-[#1d1d1f]/5"
                                        }`}>
                                        <div className={`absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center text-[16px] font-black text-white ${(table.promoterCommissionType || "percent") === "percent"
                                            ? "bg-[#F44A22]"
                                            : "bg-[#1d1d1f]"
                                            }`}>
                                            {(table.promoterCommissionType || "percent") === "percent" ? "%" : "₹"}
                                        </div>

                                        <input
                                            type="number"
                                            value={table.promoterCommission}
                                            onChange={(e) => onUpdate({ promoterCommission: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                                            placeholder={eventDefaultCommission ? String(eventDefaultCommission) : "0"}
                                            className="w-full bg-transparent py-3 pl-16 pr-4 text-[18px] font-bold text-[#1d1d1f] focus:outline-none"
                                        />
                                    </div>

                                    <div className={`p-2 rounded-lg text-[11px] font-medium ${(table.promoterCommissionType || "percent") === "percent"
                                        ? "bg-[#F44A22]/5 text-[#F44A22]"
                                        : "bg-[#1d1d1f]/5 text-[#1d1d1f]"
                                        }`}>
                                        {table.promoterCommissionType === "amount"
                                            ? `Promoters earn ₹${table.promoterCommission || eventDefaultCommission || 0} per table booking.`
                                            : `Promoters earn ${table.promoterCommission || eventDefaultCommission || 15}% of the table price.`
                                        }
                                    </div>

                                    {/* Buyer Discount Toggle */}
                                    <div className="p-3 rounded-xl bg-[#34c759]/5 border border-[#34c759]/10 flex items-center justify-between mt-3">
                                        <div className="flex items-center gap-3">
                                            <DollarSign className="w-4 h-4 text-[#34c759]" />
                                            <div>
                                                <p className="text-[13px] font-medium text-[#1d1d1f]">
                                                    Buyer Discount
                                                </p>
                                                <p className="text-[11px] text-[#86868b]">
                                                    Discount for buyers via promoter link
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onUpdate({ buyerDiscountEnabled: !table.buyerDiscountEnabled })}
                                            className={`w-12 h-7 rounded-full relative transition-colors ${table.buyerDiscountEnabled ? "bg-[#34c759]" : "bg-[rgba(0,0,0,0.1)]"
                                                }`}
                                        >
                                            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${table.buyerDiscountEnabled ? "translate-x-[22px]" : "translate-x-0.5"
                                                }`} />
                                        </button>
                                    </div>

                                    {/* Buyer Discount Amount (if enabled) */}
                                    {table.buyerDiscountEnabled && (
                                        <>
                                            <div className="flex items-center justify-between">
                                                <label className="text-[11px] font-bold text-[#34c759] uppercase tracking-widest">
                                                    Discount Amount
                                                </label>
                                                <div className="flex p-0.5 bg-[#e5e5ea] rounded-xl">
                                                    <button
                                                        onClick={() => onUpdate({ promoterDiscountType: "percent" })}
                                                        className={`px-3 py-1.5 rounded-[8px] text-[10px] font-bold transition-all ${(table.promoterDiscountType || "percent") === "percent"
                                                            ? "bg-[#34c759] text-white shadow-md"
                                                            : "text-[#86868b] hover:text-[#1d1d1f]"
                                                            }`}
                                                    >
                                                        % PERCENT
                                                    </button>
                                                    <button
                                                        onClick={() => onUpdate({ promoterDiscountType: "amount" })}
                                                        className={`px-3 py-1.5 rounded-[8px] text-[10px] font-bold transition-all ${table.promoterDiscountType === "amount"
                                                            ? "bg-[#1d1d1f] text-white shadow-md"
                                                            : "text-[#86868b] hover:text-[#1d1d1f]"
                                                            }`}
                                                    >
                                                        ₹ FIXED
                                                    </button>
                                                </div>
                                            </div>

                                            <div className={`relative rounded-2xl overflow-hidden border-2 transition-all ${(table.promoterDiscountType || "percent") === "percent"
                                                ? "border-[#34c759]/20 bg-[#34c759]/5"
                                                : "border-[#1d1d1f]/20 bg-[#1d1d1f]/5"
                                                }`}>
                                                <div className={`absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center text-[16px] font-black text-white ${(table.promoterDiscountType || "percent") === "percent"
                                                    ? "bg-[#34c759]"
                                                    : "bg-[#1d1d1f]"
                                                    }`}>
                                                    {(table.promoterDiscountType || "percent") === "percent" ? "%" : "₹"}
                                                </div>

                                                <input
                                                    type="number"
                                                    value={table.promoterDiscount}
                                                    onChange={(e) => onUpdate({ promoterDiscount: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                                                    placeholder="10"
                                                    className="w-full bg-transparent py-3 pl-16 pr-4 text-[18px] font-bold text-[#1d1d1f] focus:outline-none"
                                                />
                                            </div>

                                            <div className={`p-2 rounded-lg text-[11px] font-medium ${(table.promoterDiscountType || "percent") === "percent"
                                                ? "bg-[#34c759]/5 text-[#34c759]"
                                                : "bg-[#1d1d1f]/5 text-[#1d1d1f]"
                                                }`}>
                                                {table.promoterDiscountType === "amount"
                                                    ? `Buyers save ₹${table.promoterDiscount || 0} when booking via promoter link.`
                                                    : `Buyers save ${table.promoterDiscount || 10}% when booking via promoter link.`
                                                }
                                            </div>
                                        </>
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

export function TableBookingStep({ formData, updateFormData, validationErrors }: TableBookingStepProps) {
    const tables: TablePackage[] = formData.tables || [];
    const [tablesEnabled, setTablesEnabled] = useState(tables.length > 0);

    const totalTables = tables.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0);
    const totalCapacity = tables.reduce((sum, t) => sum + ((Number(t.quantity) || 0) * (Number(t.capacity) || 0)), 0);
    const totalValue = tables.reduce((sum, t) => sum + ((Number(t.price) || 0) * (Number(t.quantity) || 0)), 0);

    const addTable = () => {
        const newTable: TablePackage = {
            id: `table_${Date.now()}`,
            name: "Premium Table",
            tableType: "premium",
            capacity: 6,
            quantity: 5,
            price: 10000,
            includes: ["2 Premium Bottles", "Mixers & Ice", "Reserved Seating"],
            promoterEnabled: true,
        };
        updateFormData({ tables: [...tables, newTable] });
    };

    const updateTable = (index: number, updates: Partial<TablePackage>) => {
        const updated = [...tables];
        updated[index] = { ...updated[index], ...updates };
        updateFormData({ tables: updated });
    };

    const removeTable = (index: number) => {
        const updated = tables.filter((_, i) => i !== index);
        updateFormData({ tables: updated });
        if (updated.length === 0) {
            setTablesEnabled(false);
        }
    };

    const enableTables = () => {
        setTablesEnabled(true);
        if (tables.length === 0) {
            addTable();
        }
    };

    const disableTables = () => {
        setTablesEnabled(false);
        updateFormData({ tables: [] });
    };

    return (
        <div className="space-y-8">
            {/* Header with Toggle */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-headline">Table Reservations</h2>
                    <p className="text-label mt-1">
                        Offer premium table packages for group bookings
                    </p>
                </div>
                <button
                    onClick={tablesEnabled ? disableTables : enableTables}
                    className={`btn ${tablesEnabled ? "btn-secondary text-rose-600 border-rose-100 bg-rose-50" : "btn-primary"}`}
                >
                    {tablesEnabled ? "Deactivate Reservations" : "Enable Tables"}
                </button>
            </div>

            {!tablesEnabled ? (
                /* Empty State */
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-12 rounded-[2.5rem] surface-secondary border border-default text-center"
                >
                    <div className="w-20 h-20 rounded-[2rem] bg-indigo-600 text-white shadow-xl shadow-indigo-100 ring-8 ring-indigo-50 flex items-center justify-center mx-auto mb-6">
                        <Wine className="w-10 h-10" />
                    </div>
                    <h3 className="text-display-sm mb-2">
                        Reservations Offline
                    </h3>
                    <p className="text-body text-secondary mb-8 max-w-md mx-auto">
                        Enable table reservations to offer premium group packages with bottle service,
                        reserved seating, and exclusive VIP perks.
                    </p>
                    <button
                        onClick={enableTables}
                        className="btn btn-primary px-10 py-4 flex items-center gap-3 mx-auto"
                    >
                        <Plus className="w-5 h-5" />
                        Initialize Table Matrix
                    </button>
                </motion.div>
            ) : (
                <>
                    {/* Stats Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="apple-glass-card rounded-[2rem] p-6 space-y-1">
                            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#86868b]">Tables</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-[28px] font-black text-[#1d1d1f] tracking-tight">{totalTables}</span>
                                <span className="text-[13px] font-medium text-[#86868b]">Available</span>
                            </div>
                        </div>

                        <div className="apple-glass-card rounded-[2rem] p-6 space-y-1">
                            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#86868b]">Capacity</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-[28px] font-black text-[#1d1d1f] tracking-tight">{totalCapacity}</span>
                                <span className="text-[13px] font-medium text-[#86868b]">VVIP Guests</span>
                            </div>
                        </div>

                        <div className="apple-glass-card rounded-[2rem] p-6 space-y-1">
                            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#86868b]">Total Value</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-[28px] font-black text-[#F44A22] tracking-tight">₹{totalValue.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>


                    {/* Table Packages List */}
                    <div className="space-y-4">
                        <AnimatePresence>
                            {tables.map((table, index) => (
                                <TablePackageCard
                                    key={table.id}
                                    table={table}
                                    index={index}
                                    onUpdate={(updates) => updateTable(index, updates)}
                                    onRemove={() => removeTable(index)}
                                    canRemove={tables.length > 1}
                                    eventDefaultCommission={formData.commission}
                                    eventDefaultCommissionType={formData.commissionType}
                                />
                            ))}
                        </AnimatePresence>
                    </div>

                    {/* Add Table Button */}
                    <button
                        onClick={addTable}
                        className="w-full p-4 rounded-2xl border-2 border-dashed border-[rgba(0,0,0,0.1)] text-[#007aff] font-medium hover:border-[#007aff] hover:bg-[#007aff]/5 transition-all flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Add Another Table Package
                    </button>

                    {/* Pro Tips */}
                    <div className="p-4 rounded-2xl bg-[#fff9c4] border border-[#ffd54f]">
                        <div className="flex gap-3">
                            <Sparkles className="w-5 h-5 text-[#f57c00] flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-[13px] font-semibold text-[#e65100] mb-1">Pro Tips for Table Packages</p>
                                <ul className="text-[12px] text-[#bf360c] space-y-1">
                                    <li>• Include bottles and mixers to increase perceived value</li>
                                    <li>• Offer different tiers (Standard, Premium, VVIP) for varied budgets</li>
                                    <li>• Mention table location to justify premium pricing</li>
                                    <li>• Set minimum spend for tables without upfront pricing</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </>
            )
            }
        </div >
    );
}
