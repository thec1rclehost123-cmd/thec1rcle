"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Tag,
    Plus,
    X,
    Copy,
    Check,
    ChevronDown,
    ChevronUp,
    Percent,
    Users,
    Calendar
} from "lucide-react";

interface PromoCode {
    id: string;
    code: string;
    name: string;
    discountType: "percent" | "fixed";
    discountValue: number;
    maxRedemptions: number | null;
    maxPerUser: number | null;
    tierIds: string[];
    startsAt: string | null;
    endsAt: string | null;
    isActive: boolean;
}

interface PromoCodeManagerProps {
    eventId?: string;
    promoCodes: PromoCode[];
    onChange: (codes: PromoCode[]) => void;
    tiers?: Array<{ id: string; name: string }>;
}

export function PromoCodeManager({
    eventId,
    promoCodes,
    onChange,
    tiers = []
}: PromoCodeManagerProps) {
    const [expanded, setExpanded] = useState(promoCodes.length > 0);
    const [showAddForm, setShowAddForm] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    // New code form state
    const [newCode, setNewCode] = useState({
        code: "",
        name: "",
        discountType: "percent" as "percent" | "fixed",
        discountValue: 10,
        maxRedemptions: null as number | null,
        maxPerUser: 1,
        tierIds: [] as string[],
        startsAt: null as string | null,
        endsAt: null as string | null
    });

    const generateCode = () => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = "";
        for (let i = 0; i < 8; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        setNewCode(prev => ({ ...prev, code }));
    };

    const handleAddCode = () => {
        if (!newCode.code.trim()) {
            generateCode();
            return;
        }

        const promoCode: PromoCode = {
            id: Date.now().toString(),
            code: newCode.code.toUpperCase().replace(/[^A-Z0-9]/g, ""),
            name: newCode.name || newCode.code,
            discountType: newCode.discountType,
            discountValue: newCode.discountValue,
            maxRedemptions: newCode.maxRedemptions,
            maxPerUser: newCode.maxPerUser,
            tierIds: newCode.tierIds,
            startsAt: newCode.startsAt,
            endsAt: newCode.endsAt,
            isActive: true
        };

        onChange([...promoCodes, promoCode]);
        setNewCode({
            code: "",
            name: "",
            discountType: "percent",
            discountValue: 10,
            maxRedemptions: null,
            maxPerUser: 1,
            tierIds: [],
            startsAt: null,
            endsAt: null
        });
        setShowAddForm(false);
    };

    const removeCode = (id: string) => {
        onChange(promoCodes.filter(c => c.id !== id));
    };

    const toggleCodeActive = (id: string) => {
        onChange(promoCodes.map(c =>
            c.id === id ? { ...c, isActive: !c.isActive } : c
        ));
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    return (
        <div className="space-y-3">
            {/* Toggle Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5856d6] to-[#007aff] flex items-center justify-center">
                        <Tag className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                        <p className="text-[13px] font-semibold text-[#1d1d1f]">
                            Promo Codes
                        </p>
                        <p className="text-[11px] text-[#86868b]">
                            {promoCodes.length === 0
                                ? "Create discount codes for marketing"
                                : `${promoCodes.length} code(s) created`
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
                        {/* Existing Codes */}
                        {promoCodes.map(code => (
                            <motion.div
                                key={code.id}
                                layout
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className={`p-4 rounded-xl border ${code.isActive
                                        ? "border-[#007aff]/20 bg-[#007aff]/5"
                                        : "border-[rgba(0,0,0,0.08)] bg-[#f5f5f7] opacity-60"
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <code className="text-[15px] font-bold font-mono text-[#1d1d1f] tracking-wider">
                                            {code.code}
                                        </code>
                                        <button
                                            onClick={() => copyCode(code.code)}
                                            className="w-7 h-7 rounded-lg hover:bg-white/80 flex items-center justify-center"
                                        >
                                            {copiedCode === code.code ? (
                                                <Check className="w-3.5 h-3.5 text-[#34c759]" />
                                            ) : (
                                                <Copy className="w-3.5 h-3.5 text-[#86868b]" />
                                            )}
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${code.discountType === "percent"
                                                ? "bg-[#007aff]/10 text-[#007aff]"
                                                : "bg-[#34c759]/10 text-[#34c759]"
                                            }`}>
                                            {code.discountType === "percent"
                                                ? `${code.discountValue}% OFF`
                                                : `₹${code.discountValue} OFF`
                                            }
                                        </span>

                                        <button
                                            onClick={() => toggleCodeActive(code.id)}
                                            className={`w-10 h-6 rounded-full relative transition-colors ${code.isActive ? "bg-[#34c759]" : "bg-[rgba(0,0,0,0.1)]"
                                                }`}
                                        >
                                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${code.isActive ? "translate-x-[18px]" : "translate-x-0.5"
                                                }`} />
                                        </button>

                                        <button
                                            onClick={() => removeCode(code.id)}
                                            className="w-7 h-7 rounded-lg hover:bg-[#ff3b30]/10 flex items-center justify-center"
                                        >
                                            <X className="w-4 h-4 text-[#86868b] hover:text-[#ff3b30]" />
                                        </button>
                                    </div>
                                </div>

                                {/* Code details */}
                                <div className="flex items-center gap-4 mt-2 text-[11px] text-[#86868b]">
                                    {code.maxRedemptions && (
                                        <span className="flex items-center gap-1">
                                            <Users className="w-3 h-3" />
                                            Max {code.maxRedemptions} uses
                                        </span>
                                    )}
                                    {code.maxPerUser && (
                                        <span>1 per user</span>
                                    )}
                                    {code.tierIds.length > 0 && code.tierIds.length < (tiers?.length || 0) && (
                                        <span>Specific tiers only</span>
                                    )}
                                </div>
                            </motion.div>
                        ))}

                        {/* Add Code Form */}
                        {showAddForm ? (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 rounded-xl border border-[#007aff]/30 bg-white space-y-4"
                            >
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[13px] font-semibold text-[#1d1d1f]">New Promo Code</h4>
                                    <button
                                        onClick={() => setShowAddForm(false)}
                                        className="w-6 h-6 rounded-full hover:bg-[#f5f5f7] flex items-center justify-center"
                                    >
                                        <X className="w-4 h-4 text-[#86868b]" />
                                    </button>
                                </div>

                                {/* Code input */}
                                <div className="space-y-1">
                                    <label className="text-[10px] text-[#86868b] uppercase font-medium">Code</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newCode.code}
                                            onChange={(e) => setNewCode(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                            placeholder="e.g. SUMMER20"
                                            className="flex-1 px-3 py-2 rounded-lg bg-[#f5f5f7] text-[14px] font-mono font-bold tracking-wider focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#007aff]"
                                        />
                                        <button
                                            onClick={generateCode}
                                            className="px-3 py-2 rounded-lg bg-[#007aff]/10 text-[#007aff] text-[12px] font-semibold hover:bg-[#007aff]/20"
                                        >
                                            Generate
                                        </button>
                                    </div>
                                </div>

                                {/* Discount settings */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-[#86868b] uppercase font-medium">Discount Type</label>
                                        <select
                                            value={newCode.discountType}
                                            onChange={(e) => setNewCode(prev => ({ ...prev, discountType: e.target.value as "percent" | "fixed" }))}
                                            className="w-full px-3 py-2 rounded-lg bg-[#f5f5f7] text-[14px] focus:outline-none"
                                        >
                                            <option value="percent">Percentage (%)</option>
                                            <option value="fixed">Fixed Amount (₹)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-[#86868b] uppercase font-medium">Value</label>
                                        <input
                                            type="number"
                                            value={newCode.discountValue}
                                            onChange={(e) => setNewCode(prev => ({ ...prev, discountValue: parseInt(e.target.value) || 0 }))}
                                            className="w-full px-3 py-2 rounded-lg bg-[#f5f5f7] text-[14px] focus:outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Limits */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-[#86868b] uppercase font-medium">Max Uses (blank = unlimited)</label>
                                        <input
                                            type="number"
                                            value={newCode.maxRedemptions || ""}
                                            onChange={(e) => setNewCode(prev => ({
                                                ...prev,
                                                maxRedemptions: e.target.value ? parseInt(e.target.value) : null
                                            }))}
                                            placeholder="Unlimited"
                                            className="w-full px-3 py-2 rounded-lg bg-[#f5f5f7] text-[14px] focus:outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-[#86868b] uppercase font-medium">Max Per User</label>
                                        <input
                                            type="number"
                                            value={newCode.maxPerUser || ""}
                                            onChange={(e) => setNewCode(prev => ({
                                                ...prev,
                                                maxPerUser: e.target.value ? parseInt(e.target.value) : null
                                            }))}
                                            placeholder="1"
                                            className="w-full px-3 py-2 rounded-lg bg-[#f5f5f7] text-[14px] focus:outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={() => setShowAddForm(false)}
                                        className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold text-[#86868b] hover:bg-[#f5f5f7]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleAddCode}
                                        disabled={!newCode.code.trim()}
                                        className="flex-1 py-2.5 rounded-lg bg-[#007aff] text-white text-[13px] font-semibold hover:bg-[#0056b3] disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Create Code
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-[rgba(0,0,0,0.08)] text-[13px] font-medium text-[#007aff] hover:border-[#007aff]/30 hover:bg-[#007aff]/5 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Add Promo Code
                            </button>
                        )}

                        {/* Info */}
                        <p className="text-[11px] text-[#86868b] text-center">
                            Share promo codes with your audience to boost ticket sales
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default PromoCodeManager;
