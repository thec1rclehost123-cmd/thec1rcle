"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Star, ShieldCheck, ChevronRight, Loader2 } from "lucide-react";

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
                className="bg-surface-elevated border border-border-default rounded-[2rem] w-full max-w-lg shadow-[0_32px_80px_rgba(0,0,0,0.2)] overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-start justify-between p-8 border-b border-border-subtle">
                    <div>
                        <p className="text-label font-black text-text-tertiary uppercase tracking-widest mb-2">
                            Contract Tier
                        </p>
                        <h2 className="text-headline-sm font-bold text-text-primary">
                            Approve {partnerName}
                        </h2>
                        <p className="text-body-sm text-text-secondary mt-1">
                            Select the access level for this {partnerType}.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-all mt-1"
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
                            className={`w-full text-left rounded-2xl border-2 p-6 transition-all ${
                                selected === tier.id
                                    ? tier.id === "trusted"
                                        ? "border-accent-primary bg-accent-glow"
                                        : "border-border-strong bg-surface-tertiary"
                                    : "border-border-default hover:border-border-strong bg-surface-secondary"
                            }`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    {tier.id === "trusted" ? (
                                        <Star className="w-5 h-5 text-accent-primary" />
                                    ) : (
                                        <ShieldCheck className="w-5 h-5 text-text-secondary" />
                                    )}
                                    <span className="text-title font-bold text-text-primary">
                                        {tier.label}
                                    </span>
                                </div>
                                <span
                                    className={`text-label px-2.5 py-1 rounded-lg font-bold ${
                                        tier.id === "trusted"
                                            ? "bg-accent-glow text-accent-primary"
                                            : "bg-surface-base text-text-tertiary border border-border-default"
                                    }`}
                                >
                                    {tier.badge}
                                </span>
                            </div>
                            <p className="text-body-sm text-text-secondary mb-4">{tier.description}</p>
                            <ul className="space-y-2">
                                {tier.capabilities.map((cap, i) => (
                                    <li
                                        key={i}
                                        className="flex items-center gap-2.5 text-caption text-text-secondary"
                                    >
                                        <span
                                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                tier.id === "trusted"
                                                    ? "bg-accent-primary"
                                                    : "bg-text-tertiary"
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
                <div className="flex gap-3 p-6 pt-0">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3.5 rounded-xl border border-border-default text-text-secondary text-sm font-semibold hover:bg-surface-secondary transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selected || loading}
                        className="flex-1 py-3.5 rounded-xl bg-accent-primary text-text-inverse text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
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
