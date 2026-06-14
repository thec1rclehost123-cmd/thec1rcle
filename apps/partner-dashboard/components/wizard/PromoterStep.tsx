"use client";

import { useState, useEffect, useMemo } from "react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users, Percent, Search, Check, X, Loader2,
    ChevronDown, ChevronUp
} from "lucide-react";

interface Promoter {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    instagram?: string;
    connectionId?: string;
}

interface PromoterStepProps {
    formData: any;
    updateFormData: (updates: any) => void;
    role: 'venue' | 'host';
}

export function PromoterStep({ formData, updateFormData, role }: PromoterStepProps) {
    const { user } = useDashboardAuth();
    const [connectedPromoters, setConnectedPromoters] = useState<Promoter[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [showSettings, setShowSettings] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selectedIds: string[] = Array.isArray(formData.promoters) ? formData.promoters : [];
    const entityId = role === 'venue' ? formData.venueId : formData.creatorId;

    useEffect(() => {
        if (!user || !entityId) return;

        const fetchConnectedPromoters = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = await user.getIdToken();
                const res = await fetch(
                    `/api/promoters/connections?entityId=${encodeURIComponent(entityId)}&entityType=${role}&status=approved`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (!res.ok) throw new Error("Failed to fetch connected promoters");
                const data = await res.json();
                const list = Array.isArray(data) ? data : (data.connections || data.data || []);
                setConnectedPromoters(
                    list.map((c: any) => ({
                        id: c.promoterId || c.otherId || c.id,
                        name: c.promoterName || c.otherName || c.name || "Unknown Promoter",
                        email: c.promoterEmail || c.email,
                        phone: c.promoterPhone || c.phone,
                        instagram: c.promoterInstagram || c.instagram,
                        connectionId: c.id,
                    }))
                );
            } catch (err: any) {
                console.error("[PromoterStep] Fetch error:", err);
                setError(err.message || "Could not load promoter list");
            } finally {
                setLoading(false);
            }
        };

        fetchConnectedPromoters();
    }, [user, entityId, role]);

    const filteredPromoters = useMemo(() => {
        if (!searchQuery.trim()) return connectedPromoters;
        const q = searchQuery.toLowerCase();
        return connectedPromoters.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                (p.email || "").toLowerCase().includes(q) ||
                (p.instagram || "").toLowerCase().includes(q)
        );
    }, [connectedPromoters, searchQuery]);

    const toggle = (promoterId: string) => {
        const updated = selectedIds.includes(promoterId)
            ? selectedIds.filter((id: string) => id !== promoterId)
            : [...selectedIds, promoterId];
        updateFormData({ promoters: updated });
    };

    const toggleAll = () => {
        if (selectedIds.length === filteredPromoters.length && filteredPromoters.length > 0) {
            updateFormData({ promoters: [] });
        } else {
            updateFormData({ promoters: filteredPromoters.map((p) => p.id) });
        }
    };

    const updatePromoterSetting = (key: string, value: any) => {
        updateFormData({ [key]: value });
    };

    return (
        <div className="space-y-6">
            {/* Section 1: Promoter Settings */}
            <div className="rounded-[18px] border border-border-default bg-[var(--v-card)] overflow-hidden">
                <button
                    type="button"
                    onClick={() => setShowSettings(!showSettings)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[rgba(244,74,34,0.12)] flex items-center justify-center">
                            <Percent className="w-4 h-4 text-[var(--v-orange)]" />
                        </div>
                        <div className="text-left">
                            <p className="text-[13px] font-bold text-[var(--v-text-primary)]">Commission & Discount Settings</p>
                            <p className="text-[10px] text-[var(--v-text-secondary)] font-medium">
                                {formData.promotersEnabled
                                    ? `${formData.commission}% commission · ${formData.buyerDiscountsEnabled ? ` ${formData.discount}% buyer discount` : "No buyer discounts"}`
                                    : "Promoters disabled"}
                            </p>
                        </div>
                    </div>
                    {showSettings ? (
                        <ChevronUp className="w-4 h-4 text-[var(--v-text-muted)]" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-[var(--v-text-muted)]" />
                    )}
                </button>

                <AnimatePresence>
                    {showSettings && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="px-6 pb-5 space-y-5 border-t border-border-subtle pt-4">
                                {/* Enable Promoters Toggle */}
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div>
                                        <p className="text-[12px] font-bold text-[var(--v-text-primary)]">Enable Promoters</p>
                                        <p className="text-[10px] text-[var(--v-text-secondary)] font-medium">Allow promoters to sell tickets for this event</p>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={formData.promotersEnabled}
                                        onClick={() => updatePromoterSetting("promotersEnabled", !formData.promotersEnabled)}
                                        className={`relative w-11 h-6 rounded-full transition-colors ${formData.promotersEnabled ? "bg-[var(--v-orange)]" : "bg-white/10"}`}
                                    >
                                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${formData.promotersEnabled ? "translate-x-5" : "translate-x-0"}`} />
                                    </button>
                                </label>

                                {formData.promotersEnabled && (
                                    <>
                                        {/* Commission Rate */}
                                        <div>
                                            <label className="text-[11px] font-bold text-[var(--v-text-secondary)] mb-1.5 block">
                                                Commission Rate
                                            </label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    value={formData.commission}
                                                    onChange={(e) => updatePromoterSetting("commission", Math.min(100, Math.max(0, Number(e.target.value))))}
                                                    className="w-20 px-3 py-2 text-[14px] font-bold bg-transparent border border-border-default rounded-xl focus:outline-none focus:border-[var(--v-orange)] text-[var(--v-text-primary)]"
                                                />
                                                <span className="text-[13px] font-bold text-[var(--v-text-muted)]">%</span>
                                                <select
                                                    value={formData.commissionType}
                                                    onChange={(e) => updatePromoterSetting("commissionType", e.target.value)}
                                                    className="px-3 py-2 text-[12px] font-bold bg-transparent border border-border-default rounded-xl focus:outline-none focus:border-[var(--v-orange)] text-[var(--v-text-primary)]"
                                                >
                                                    <option value="percent">Percent</option>
                                                    <option value="fixed">Fixed (INR)</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Default Commission Toggle */}
                                        <label className="flex items-center justify-between cursor-pointer">
                                            <div>
                                                <p className="text-[12px] font-bold text-[var(--v-text-primary)]">Use Default Commission</p>
                                                <p className="text-[10px] text-[var(--v-text-secondary)] font-medium">Apply your default promoter commission rate</p>
                                            </div>
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={formData.useDefaultCommission}
                                                onClick={() => updatePromoterSetting("useDefaultCommission", !formData.useDefaultCommission)}
                                                className={`relative w-11 h-6 rounded-full transition-colors ${formData.useDefaultCommission ? "bg-[var(--v-orange)]" : "bg-white/10"}`}
                                            >
                                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${formData.useDefaultCommission ? "translate-x-5" : "translate-x-0"}`} />
                                            </button>
                                        </label>

                                        {/* Buyer Discounts */}
                                        <div className="pt-2 border-t border-border-subtle">
                                            <label className="flex items-center justify-between cursor-pointer">
                                                <div>
                                                    <p className="text-[12px] font-bold text-[var(--v-text-primary)]">Enable Buyer Discounts</p>
                                                    <p className="text-[10px] text-[var(--v-text-secondary)] font-medium">Let promoters offer discounts to their buyers</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={formData.buyerDiscountsEnabled}
                                                    onClick={() => updatePromoterSetting("buyerDiscountsEnabled", !formData.buyerDiscountsEnabled)}
                                                    className={`relative w-11 h-6 rounded-full transition-colors ${formData.buyerDiscountsEnabled ? "bg-emerald-500" : "bg-white/10"}`}
                                                >
                                                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${formData.buyerDiscountsEnabled ? "translate-x-5" : "translate-x-0"}`} />
                                                </button>
                                            </label>

                                            {formData.buyerDiscountsEnabled && (
                                                <div className="mt-3 ml-0">
                                                    <label className="text-[11px] font-bold text-[var(--v-text-secondary)] mb-1.5 block">
                                                        Discount Amount
                                                    </label>
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={100}
                                                            value={formData.discount}
                                                            onChange={(e) => updatePromoterSetting("discount", Math.min(100, Math.max(0, Number(e.target.value))))}
                                                            className="w-20 px-3 py-2 text-[14px] font-bold bg-transparent border border-border-default rounded-xl focus:outline-none focus:border-emerald-500 text-[var(--v-text-primary)]"
                                                        />
                                                        <span className="text-[13px] font-bold text-[var(--v-text-muted)]">
                                                            {formData.discountType === "percent" ? "%" : "INR"}
                                                        </span>
                                                        <select
                                                            value={formData.discountType}
                                                            onChange={(e) => updatePromoterSetting("discountType", e.target.value)}
                                                            className="px-3 py-2 text-[12px] font-bold bg-transparent border border-border-default rounded-xl focus:outline-none focus:border-emerald-500 text-[var(--v-text-primary)]"
                                                        >
                                                            <option value="percent">Percent</option>
                                                            <option value="fixed">Fixed (INR)</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Section 2: Assign Promoters */}
            <div className="rounded-[18px] border border-border-default bg-[var(--v-card)] overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border-subtle">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[rgba(56,122,255,0.12)] flex items-center justify-center">
                                <Users className="w-4 h-4 text-[#7aa2ff]" />
                            </div>
                            <div>
                                <p className="text-[13px] font-bold text-[var(--v-text-primary)]">Assign Promoters</p>
                                <p className="text-[10px] text-[var(--v-text-secondary)] font-medium">
                                    {loading ? "Loading..." : `${connectedPromoters.length} connected · ${selectedIds.length} selected`}
                                </p>
                            </div>
                        </div>
                        {connectedPromoters.length > 0 && (
                            <button
                                type="button"
                                onClick={toggleAll}
                                className="text-[10px] font-black uppercase tracking-widest text-[#7aa2ff] hover:text-[#5a82df] transition-colors"
                            >
                                {selectedIds.length === filteredPromoters.length && filteredPromoters.length > 0
                                    ? "Deselect All"
                                    : "Select All"}
                            </button>
                        )}
                    </div>
                </div>

                {/* Search */}
                <div className="px-6 py-3 border-b border-border-subtle">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--v-text-muted)]" />
                        <input
                            type="text"
                            aria-label="Search promoters"
                            placeholder="Search promoters..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-[12px] bg-transparent border border-border-default rounded-xl focus:outline-none focus:border-[#7aa2ff] text-[var(--v-text-primary)] placeholder:text-[var(--v-text-muted)]"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2"
                            >
                                <X className="w-3 h-3 text-[var(--v-text-muted)]" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Promoter List */}
                <div className="max-h-[400px] overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-5 h-5 animate-spin text-[var(--v-text-muted)]" />
                        </div>
                    ) : error ? (
                        <div className="px-6 py-8 text-center">
                            <p className="text-[12px] text-red-400 font-medium">{error}</p>
                            <p className="text-[10px] text-[var(--v-text-secondary)] mt-1">
                                Connect promoters in your {role === 'venue' ? 'venue' : 'host'} settings
                            </p>
                        </div>
                    ) : connectedPromoters.length === 0 ? (
                        <div className="px-6 py-8 text-center">
                            <div className="w-10 h-10 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-3">
                                <Users className="w-5 h-5 text-[var(--v-text-muted)]" />
                            </div>
                            <p className="text-[13px] font-bold text-[var(--v-text-primary)]">No connected promoters</p>
                            <p className="text-[10px] text-[var(--v-text-secondary)] mt-1">
                                {role === 'venue'
                                    ? "Invite promoters in your Promoters section to get started"
                                    : "Request promoter partnerships in your Promoters section"}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border-subtle">
                            {filteredPromoters.length === 0 && searchQuery ? (
                                <div className="px-6 py-8 text-center">
                                    <p className="text-[12px] text-[var(--v-text-secondary)]">No promoters match "{searchQuery}"</p>
                                </div>
                            ) : (
                                filteredPromoters.map((promoter) => {
                                    const isSelected = selectedIds.includes(promoter.id);
                                    return (
                                        <button
                                            key={promoter.id}
                                            type="button"
                                            onClick={() => toggle(promoter.id)}
                                            className={`w-full flex items-center gap-4 px-6 py-3.5 text-left transition-colors hover:bg-white/[0.02] ${isSelected ? "bg-[rgba(56,122,255,0.06)]" : ""}`}
                                        >
                                            {/* Checkbox */}
                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? "bg-[#7aa2ff] border-[#7aa2ff]" : "border-white/20"}`}>
                                                {isSelected && <Check className="w-3 h-3 text-white" />}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-bold text-[var(--v-text-primary)] truncate">
                                                    {promoter.name}
                                                </p>
                                                <div className="flex items-center gap-2 text-[10px] text-[var(--v-text-secondary)] font-medium">
                                                    {promoter.email && <span className="truncate">{promoter.email}</span>}
                                                    {promoter.instagram && (
                                                        <span className="truncate text-purple-400">@{promoter.instagram}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Badge */}
                                            {isSelected && (
                                                <span className="text-[9px] font-black uppercase tracking-widest text-[#7aa2ff] flex-shrink-0">
                                                    Selected
                                                </span>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>

                {/* Selection Summary Footer */}
                {selectedIds.length > 0 && (
                    <div className="px-6 py-3 border-t border-border-subtle bg-[rgba(56,122,255,0.04)]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-[11px] font-bold text-emerald-400">
                                    {selectedIds.length} promoter{selectedIds.length > 1 ? "s" : ""} assigned
                                </span>
                            </div>
                            <div className="flex -space-x-2">
                                {connectedPromoters
                                    .filter((p) => selectedIds.includes(p.id))
                                    .slice(0, 5)
                                    .map((p) => (
                                        <div
                                            key={p.id}
                                            className="w-7 h-7 rounded-full bg-[var(--v-card)] border border-border-default flex items-center justify-center"
                                            title={p.name}
                                        >
                                            <span className="text-[9px] font-bold text-[var(--v-text-secondary)]">
                                                {p.name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    ))}
                                {selectedIds.length > 5 && (
                                    <div className="w-7 h-7 rounded-full bg-[var(--v-card)] border border-border-default flex items-center justify-center">
                                        <span className="text-[9px] font-bold text-[var(--v-text-secondary)]">+{selectedIds.length - 5}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
