"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Star, ShieldCheck, ChevronRight, Loader2, Handshake } from "lucide-react";

export type ContractTier = "trusted" | "standard";

interface TierSelectionModalProps {
    partnerName: string;
    partnerType: "host" | "promoter";
    connectionId: string;
    onConfirm: (tier: ContractTier, connectionId: string) => Promise<void>;
    onClose: () => void;
}

const TIERS: {
    id: ContractTier;
    label: string;
    badge: string;
    description: string;
    capabilities: string[];
}[] = [
    {
        id: "trusted",
        label: "Trusted Partner",
        badge: "TIER 1",
        description: "Full operational access. Best for established partners with a verified track record.",
        capabilities: [
            "Auto-publish events without approval",
            "Full venue calendar access",
            "Generate affiliate tracking links",
        ],
    },
    {
        id: "standard",
        label: "Standard Partner",
        badge: "TIER 2",
        description: "Supervised access. Partner can draft events but listings require venue approval.",
        capabilities: [
            "View venue calendar",
            "Draft events for review",
            "Venue manager approval required before publishing",
        ],
    },
];

export function TierSelectionModal({
    partnerName,
    partnerType,
    connectionId,
    onConfirm,
    onClose,
}: TierSelectionModalProps) {
    const [selected, setSelected] = useState<ContractTier | null>(null);
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        if (!selected) return;
        setLoading(true);
        try {
            await onConfirm(selected, connectionId);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[8px]">
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 16 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 16 }}
                transition={{ type: "spring", damping: 26, stiffness: 320 }}
                className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[2rem] w-full max-w-lg shadow-[0_32px_80px_rgba(0,0,0,0.2)] overflow-hidden"
            >
                {/* Header */}
                <div className="p-8 border-b border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="p-3 bg-orange-500/10 rounded-2xl">
                            <Handshake className="w-8 h-8 text-orange-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight">
                                Approve Partnership
                            </h2>
                            <p className="text-white/40 text-sm font-medium mt-0.5">
                                Select a partnership tier for {partnerName}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute top-8 right-8 p-2 rounded-xl text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-fill)] transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tier Options */}
                <div className="p-6 space-y-4">
                    {TIERS.map((tier) => (
                        <button
                            key={tier.id}
                            onClick={() => setSelected(tier.id)}
                            className={`w-full text-left rounded-[1.5rem] border-2 p-6 transition-all duration-300 relative overflow-hidden group ${
                                selected === tier.id
                                    ? tier.id === "trusted"
                                        ? "border-orange-500 bg-orange-500/[0.04]"
                                        : "border-white/20 bg-white/[0.04]"
                                    : "border-white/5 hover:border-white/10 bg-white/[0.02]"
                            }`}
                        >
                            {selected === tier.id && tier.id === "trusted" && (
                                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.05] to-transparent pointer-events-none" />
                            )}
                            <div className="flex items-center justify-between mb-3 relative z-10">
                                <div className="flex items-center gap-3">
                                    {tier.id === "trusted" ? (
                                        <div className="p-2 bg-orange-500/10 rounded-xl">
                                            <Star className="w-5 h-5 text-orange-500" />
                                        </div>
                                    ) : (
                                        <div className="p-2 bg-white/5 rounded-xl">
                                            <ShieldCheck className="w-5 h-5 text-white/60" />
                                        </div>
                                    )}
                                    <span className="text-title font-bold text-white">
                                        {tier.label}
                                    </span>
                                </div>
                                <span
                                    className={`text-[10px] px-3 py-1 rounded-lg font-black uppercase tracking-widest ${
                                        tier.id === "trusted"
                                            ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                                            : "bg-white/5 text-white/40 border border-white/5"
                                    }`}
                                >
                                    {tier.badge}
                                </span>
                            </div>
                            <p className="text-body-sm text-white/50 mb-4 relative z-10 leading-relaxed font-medium">{tier.description}</p>
                            <ul className="space-y-2.5 relative z-10">
                                {tier.capabilities.map((cap, i) => (
                                    <li
                                        key={i}
                                        className="flex items-center gap-3 text-[12px] text-white/40 group-hover:text-white/60 transition-colors"
                                    >
                                        <div
                                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                tier.id === "trusted"
                                                    ? "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]"
                                                    : "bg-white/20"
                                            }`}
                                        />
                                        {cap}
                                    </li>
                                ))}
                            </ul>
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex gap-4 p-8 pt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 rounded-2xl border border-white/10 text-[var(--text-secondary)] text-sm font-bold hover:bg-white/5 transition-all active:scale-95"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selected || loading}
                        className={`flex-1 py-4 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-20 disabled:cursor-not-allowed ${
                            selected === 'trusted' 
                                ? 'bg-gradient-to-r from-orange-500 to-rose-600 hover:shadow-lg hover:shadow-orange-500/20' 
                                : 'bg-[var(--bg-secondary)] border border-white/10 hover:bg-[var(--bg-secondary)]/80'
                        } ${!selected ? 'bg-white/5 border border-white/5 text-white/20' : ''}`}
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                Confirm & Approve
                                <ChevronRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
