"use client";

/**
 * CancelEventModal
 * 
 * Premium full-screen modal for cancelling an event.
 * Shows impact analysis (orders, revenue), refund policy options,
 * and a confirmation flow with a typed-to-confirm safety check.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    AlertTriangle,
    X,
    Users,
    CreditCard,
    DollarSign,
    RefreshCw,
    Check,
    ShieldAlert,
    Percent,
    MessageSquare,
    Ban,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface CancelEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: CancellationPayload) => Promise<void>;
    event: {
        id: string;
        title: string;
        startDate?: string;
        lifecycle?: string;
        ticketsSold?: number;
        totalRevenue?: number;
    };
}

interface CancellationPayload {
    reason: string;
    refundPolicy: "full" | "partial" | "none";
    partialRefundPercent?: number;
    notes: string;
}

type RefundPolicy = "full" | "partial" | "none";

// ============================================
// CONSTANTS
// ============================================

const CANCELLATION_REASONS = [
    { id: "weather", label: "Weather/Natural Emergency", icon: "🌧️" },
    { id: "artist_unavailable", label: "Artist/Performer Unavailable", icon: "🎤" },
    { id: "venue_issue", label: "Venue Unavailability", icon: "🏢" },
    { id: "low_sales", label: "Insufficient Ticket Sales", icon: "📉" },
    { id: "safety_concern", label: "Safety/Security Concern", icon: "🔒" },
    { id: "permit_issue", label: "Permit/Regulatory Issue", icon: "📋" },
    { id: "personal", label: "Personal/Organizational Reasons", icon: "👤" },
    { id: "other", label: "Other Reason", icon: "💬" },
];

const REFUND_POLICIES: { id: RefundPolicy; label: string; description: string; icon: typeof DollarSign }[] = [
    {
        id: "full",
        label: "Full Refund",
        description: "100% refund to all ticket holders. Recommended for organizer-initiated cancellations.",
        icon: DollarSign,
    },
    {
        id: "partial",
        label: "Partial Refund",
        description: "Custom percentage refund. Suitable for cost-recovery scenarios.",
        icon: Percent,
    },
    {
        id: "none",
        label: "No Automatic Refund",
        description: "Refunds handled manually or via support. Use with caution.",
        icon: Ban,
    },
];

// ============================================
// COMPONENT
// ============================================

export default function CancelEventModal({
    isOpen,
    onClose,
    onConfirm,
    event,
}: CancelEventModalProps) {
    // ── State ──
    const [step, setStep] = useState<"reason" | "policy" | "confirm">("reason");
    const [selectedReason, setSelectedReason] = useState<string>("");
    const [customReason, setCustomReason] = useState("");
    const [refundPolicy, setRefundPolicy] = useState<RefundPolicy>("full");
    const [partialPercent, setPartialPercent] = useState(50);
    const [notes, setNotes] = useState("");
    const [confirmText, setConfirmText] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);

    // Reset on close
    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setStep("reason");
                setSelectedReason("");
                setCustomReason("");
                setRefundPolicy("full");
                setPartialPercent(50);
                setNotes("");
                setConfirmText("");
                setError(null);
                setIsProcessing(false);
            }, 300);
        }
    }, [isOpen]);

    // Focus confirm input
    useEffect(() => {
        if (step === "confirm" && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [step]);

    // ── Derived State ──
    const displayReason = selectedReason === "other"
        ? customReason
        : CANCELLATION_REASONS.find(r => r.id === selectedReason)?.label || "";

    const confirmRequired = "CANCEL";
    const isConfirmValid = confirmText.trim().toUpperCase() === confirmRequired;
    const ticketsSold = event.ticketsSold || 0;
    const totalRevenue = event.totalRevenue || 0;

    const canProceedFromReason = selectedReason && (selectedReason !== "other" || customReason.trim().length > 0);

    // ── Handlers ──
    const handleConfirm = useCallback(async () => {
        if (!isConfirmValid || isProcessing) return;

        setIsProcessing(true);
        setError(null);

        try {
            await onConfirm({
                reason: displayReason,
                refundPolicy,
                partialRefundPercent: refundPolicy === "partial" ? partialPercent : undefined,
                notes,
            });
            onClose();
        } catch (err: any) {
            setError(err.message || "Failed to cancel event. Please try again.");
            setIsProcessing(false);
        }
    }, [isConfirmValid, isProcessing, displayReason, refundPolicy, partialPercent, notes, onConfirm, onClose]);

    // ── Render ──
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-12"
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-stone-950/85 backdrop-blur-2xl"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.92, y: 40, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.92, y: 40, opacity: 0 }}
                        transition={{ type: "spring", damping: 28, stiffness: 350 }}
                        className="relative w-full max-w-2xl bg-[var(--bg-base)] rounded-[2.5rem] overflow-hidden shadow-[0_60px_120px_rgba(0,0,0,0.5)] border border-[var(--border-default)]"
                    >
                        {/* ── Header ── */}
                        <div className="relative px-10 pt-10 pb-6 bg-gradient-to-b from-rose-500/5 to-transparent border-b border-[var(--border-subtle)]">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-[1.5rem] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                                        <AlertTriangle className="w-7 h-7 text-rose-500" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black tracking-tight text-[var(--text-primary)]">
                                            Cancel Event
                                        </h2>
                                        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-rose-500 mt-0.5">
                                            Irreversible Action
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    disabled={isProcessing}
                                    className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[var(--bg-secondary)] transition-colors"
                                >
                                    <X className="w-5 h-5 text-[var(--text-tertiary)]" />
                                </button>
                            </div>

                            {/* Event Info Bar */}
                            <div className="mt-5 p-4 rounded-[1.25rem] bg-[var(--bg-fill)] border border-[var(--border-subtle)] flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">Event</p>
                                    <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5 truncate max-w-[300px]">
                                        {event.title}
                                    </p>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">Tickets Sold</p>
                                        <div className="flex items-center gap-1.5 justify-end mt-0.5">
                                            <Users className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                                            <span className="text-sm font-bold text-[var(--text-primary)]">{ticketsSold}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">Revenue</p>
                                        <div className="flex items-center gap-1.5 justify-end mt-0.5">
                                            <CreditCard className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                                            <span className="text-sm font-bold text-[var(--text-primary)]">₹{totalRevenue.toLocaleString("en-IN")}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Progress Indicator */}
                            <div className="flex items-center gap-2 mt-5">
                                {(["reason", "policy", "confirm"] as const).map((s, i) => (
                                    <div
                                        key={s}
                                        className={`flex-1 h-1 rounded-full transition-all duration-500 ${i <= ["reason", "policy", "confirm"].indexOf(step)
                                            ? "bg-rose-500"
                                            : "bg-[var(--bg-secondary)]"
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* ── Body ── */}
                        <div className="px-10 py-8 max-h-[460px] overflow-y-auto">
                            <AnimatePresence mode="wait">
                                {/* STEP 1: Reason */}
                                {step === "reason" && (
                                    <motion.div
                                        key="reason"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="space-y-5"
                                    >
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">
                                                Why are you cancelling?
                                            </p>
                                            <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                                                This reason will be shared with ticket holders in the cancellation notice.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2.5">
                                            {CANCELLATION_REASONS.map((r) => (
                                                <button
                                                    key={r.id}
                                                    onClick={() => setSelectedReason(r.id)}
                                                    className={`flex items-center gap-3 p-3.5 rounded-[1.25rem] border-2 text-left transition-all duration-200 ${selectedReason === r.id
                                                        ? "border-rose-500 bg-rose-500/5 shadow-sm"
                                                        : "border-[var(--border-subtle)] bg-[var(--bg-fill)] hover:border-rose-500/20"
                                                        }`}
                                                >
                                                    <span className="text-lg">{r.icon}</span>
                                                    <span className={`text-[11px] font-bold ${selectedReason === r.id ? "text-rose-500" : "text-[var(--text-secondary)]"}`}>
                                                        {r.label}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>

                                        {selectedReason === "other" && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                className="overflow-hidden"
                                            >
                                                <textarea
                                                    value={customReason}
                                                    onChange={(e) => setCustomReason(e.target.value)}
                                                    placeholder="Describe the reason for cancellation..."
                                                    className="w-full p-4 rounded-[1.25rem] bg-[var(--bg-fill)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500/20 resize-none min-h-[80px]"
                                                />
                                            </motion.div>
                                        )}
                                    </motion.div>
                                )}

                                {/* STEP 2: Refund Policy */}
                                {step === "policy" && (
                                    <motion.div
                                        key="policy"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="space-y-5"
                                    >
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">
                                                Refund Policy
                                            </p>
                                            <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                                                Choose how ticket holders will be refunded. Full refund is recommended.
                                            </p>
                                        </div>

                                        <div className="space-y-3">
                                            {REFUND_POLICIES.map((policy) => {
                                                const Icon = policy.icon;
                                                return (
                                                    <button
                                                        key={policy.id}
                                                        onClick={() => setRefundPolicy(policy.id)}
                                                        className={`w-full flex items-start gap-4 p-5 rounded-[1.5rem] border-2 text-left transition-all duration-200 ${refundPolicy === policy.id
                                                            ? "border-rose-500 bg-rose-500/5"
                                                            : "border-[var(--border-subtle)] bg-[var(--bg-fill)] hover:border-rose-500/20"
                                                            }`}
                                                    >
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${refundPolicy === policy.id
                                                            ? "bg-rose-500/15 text-rose-500"
                                                            : "bg-[var(--bg-base)] text-[var(--text-tertiary)]"
                                                            }`}>
                                                            <Icon className="w-5 h-5" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-[12px] font-bold ${refundPolicy === policy.id ? "text-rose-500" : "text-[var(--text-primary)]"}`}>
                                                                {policy.label}
                                                            </p>
                                                            <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 leading-relaxed">
                                                                {policy.description}
                                                            </p>
                                                        </div>
                                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${refundPolicy === policy.id
                                                            ? "border-rose-500 bg-rose-500"
                                                            : "border-[var(--border-default)]"
                                                            }`}>
                                                            {refundPolicy === policy.id && (
                                                                <Check className="w-3 h-3 text-[var(--text-primary)]" />
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Partial percent slider */}
                                        {refundPolicy === "partial" && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                className="overflow-hidden"
                                            >
                                                <div className="p-5 rounded-[1.5rem] bg-[var(--bg-fill)] border border-[var(--border-subtle)] space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] font-bold text-[var(--text-primary)]">Refund Percentage</span>
                                                        <span className="text-lg font-black text-rose-500">{partialPercent}%</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min={10}
                                                        max={90}
                                                        step={5}
                                                        value={partialPercent}
                                                        onChange={(e) => setPartialPercent(Number(e.target.value))}
                                                        className="w-full h-2 bg-[var(--bg-secondary)] rounded-full appearance-none cursor-pointer accent-rose-500"
                                                    />
                                                    <div className="flex justify-between text-[9px] font-bold text-[var(--text-tertiary)]">
                                                        <span>10%</span>
                                                        <span>Est. refund: ₹{Math.round(totalRevenue * partialPercent / 100).toLocaleString("en-IN")}</span>
                                                        <span>90%</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Internal Notes */}
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 px-1">
                                                <MessageSquare className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                                                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">
                                                    Internal Notes (Optional)
                                                </p>
                                            </div>
                                            <textarea
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                placeholder="Add internal notes for your team..."
                                                className="w-full p-4 rounded-[1.25rem] bg-[var(--bg-fill)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500/20 resize-none min-h-[60px]"
                                            />
                                        </div>
                                    </motion.div>
                                )}

                                {/* STEP 3: Confirm */}
                                {step === "confirm" && (
                                    <motion.div
                                        key="confirm"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="space-y-6"
                                    >
                                        {/* Impact Summary */}
                                        <div className="p-6 rounded-[1.5rem] bg-rose-500/5 border border-rose-500/15 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <ShieldAlert className="w-5 h-5 text-rose-500" />
                                                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-rose-500">
                                                    Cancellation Impact
                                                </p>
                                            </div>

                                            <div className="space-y-2.5 text-[12px]">
                                                <div className="flex justify-between items-center py-2 border-b border-rose-500/10">
                                                    <span className="text-[var(--text-secondary)]">Reason</span>
                                                    <span className="font-bold text-[var(--text-primary)] text-right max-w-[250px] truncate">
                                                        {displayReason}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center py-2 border-b border-rose-500/10">
                                                    <span className="text-[var(--text-secondary)]">Tickets Affected</span>
                                                    <span className="font-bold text-[var(--text-primary)]">{ticketsSold} tickets</span>
                                                </div>
                                                <div className="flex justify-between items-center py-2 border-b border-rose-500/10">
                                                    <span className="text-[var(--text-secondary)]">Refund Policy</span>
                                                    <span className="font-bold text-[var(--text-primary)]">
                                                        {refundPolicy === "full" ? "Full Refund (100%)" :
                                                            refundPolicy === "partial" ? `Partial Refund (${partialPercent}%)` :
                                                                "No Automatic Refund"}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center py-2">
                                                    <span className="text-[var(--text-secondary)]">Est. Refund Amount</span>
                                                    <span className="font-black text-rose-500 text-base">
                                                        ₹{(refundPolicy === "full"
                                                            ? totalRevenue
                                                            : refundPolicy === "partial"
                                                                ? Math.round(totalRevenue * partialPercent / 100)
                                                                : 0
                                                        ).toLocaleString("en-IN")}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Confirmation Input */}
                                        <div className="space-y-3">
                                            <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                                                This action is <strong className="text-rose-500">irreversible</strong>. All ticket holders will be notified,
                                                QR codes will be invalidated, and promoter links will be deactivated.
                                            </p>
                                            <p className="text-[11px] font-bold text-[var(--text-primary)]">
                                                Type <span className="text-rose-500 font-black tracking-[0.1em]">{confirmRequired}</span> to confirm:
                                            </p>
                                            <input
                                                ref={inputRef}
                                                type="text"
                                                value={confirmText}
                                                onChange={(e) => setConfirmText(e.target.value)}
                                                placeholder={confirmRequired}
                                                className={`w-full px-5 py-4 rounded-[1.25rem] bg-[var(--bg-fill)] border-2 text-[14px] font-black tracking-[0.15em] uppercase text-center placeholder:text-[var(--text-tertiary)] focus:outline-none transition-all ${isConfirmValid
                                                    ? "border-rose-500 text-rose-500 focus:ring-4 focus:ring-rose-500/15"
                                                    : "border-[var(--border-subtle)] text-[var(--text-primary)] focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500/20"
                                                    }`}
                                            />
                                        </div>

                                        {/* Error */}
                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="p-4 rounded-[1.25rem] bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-400 font-medium"
                                            >
                                                {error}
                                            </motion.div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* ── Footer ── */}
                        <div className="px-10 py-6 border-t border-[var(--border-subtle)] bg-[var(--bg-fill)] flex items-center justify-between">
                            {/* Back button */}
                            <button
                                onClick={() => {
                                    if (step === "policy") setStep("reason");
                                    else if (step === "confirm") setStep("policy");
                                    else onClose();
                                }}
                                disabled={isProcessing}
                                className="px-6 py-3 rounded-xl text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                {step === "reason" ? "Close" : "← Back"}
                            </button>

                            {/* Next/Confirm button */}
                            {step !== "confirm" ? (
                                <button
                                    onClick={() => {
                                        if (step === "reason") setStep("policy");
                                        else if (step === "policy") setStep("confirm");
                                    }}
                                    disabled={!canProceedFromReason && step === "reason"}
                                    className={`px-8 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] transition-all ${canProceedFromReason || step === "policy"
                                        ? "bg-text-primary text-white hover:opacity-90 active:scale-95"
                                        : "bg-[var(--bg-secondary)] text-[var(--text-tertiary)] cursor-not-allowed"
                                        }`}
                                >
                                    Continue →
                                </button>
                            ) : (
                                <button
                                    onClick={handleConfirm}
                                    disabled={!isConfirmValid || isProcessing}
                                    className={`px-8 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] flex items-center gap-2.5 transition-all ${isConfirmValid && !isProcessing
                                        ? "bg-rose-600 text-[var(--text-primary)] hover:bg-rose-700 active:scale-95 shadow-xl shadow-rose-500/20"
                                        : "bg-[var(--bg-secondary)] text-[var(--text-tertiary)] cursor-not-allowed"
                                        }`}
                                >
                                    {isProcessing ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <AlertTriangle className="w-4 h-4" />
                                            Cancel Event
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
