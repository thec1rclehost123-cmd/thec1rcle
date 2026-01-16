"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tag, Check, X, Loader2 } from "lucide-react";

interface PromoCodeInputProps {
    eventId: string;
    onApply: (code: string) => Promise<{
        valid: boolean;
        discountAmount?: number;
        message?: string;
        error?: string;
    }>;
    appliedCode?: string | null;
    onRemove?: () => void;
    disabled?: boolean;
    className?: string;
}

export function PromoCodeInput({
    eventId,
    onApply,
    appliedCode = null,
    onRemove,
    disabled = false,
    className = ""
}: PromoCodeInputProps) {
    const [code, setCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<{ code: string; message: string; amount: number } | null>(null);

    const handleApply = async () => {
        if (!code.trim() || isLoading || disabled) return;

        setIsLoading(true);
        setError(null);

        try {
            const result = await onApply(code.trim().toUpperCase());

            if (result.valid) {
                setSuccess({
                    code: code.trim().toUpperCase(),
                    message: result.message || 'Discount applied!',
                    amount: result.discountAmount || 0
                });
                setCode("");
            } else {
                setError(result.error || 'Invalid promo code');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to apply code');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemove = () => {
        setSuccess(null);
        setError(null);
        if (onRemove) onRemove();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleApply();
        }
    };

    // Show applied code state
    if (appliedCode || success) {
        const displayCode = appliedCode || success?.code;
        const displayMessage = success?.message || 'Promo code applied';

        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-2xl bg-[#34c759]/10 border border-[#34c759]/20 ${className}`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#34c759]/20 flex items-center justify-center">
                            <Check className="w-5 h-5 text-[#34c759]" />
                        </div>
                        <div>
                            <p className="text-[14px] font-semibold text-[#34c759]">
                                {displayCode}
                            </p>
                            <p className="text-[12px] text-[#34c759]/80">
                                {displayMessage}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleRemove}
                        disabled={disabled}
                        className="w-8 h-8 rounded-full hover:bg-[#34c759]/20 flex items-center justify-center transition-colors"
                    >
                        <X className="w-4 h-4 text-[#34c759]" />
                    </button>
                </div>
            </motion.div>
        );
    }

    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-inherit opacity-30" />
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => {
                            setCode(e.target.value.toUpperCase());
                            setError(null);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="PROMO CODE"
                        disabled={disabled || isLoading}
                        className={`w-full pl-11 pr-4 py-3.5 rounded-2xl bg-zinc-800 border border-white/10 text-[13px] font-black tracking-[0.1em] text-white placeholder:text-white/20 focus:outline-none focus:bg-zinc-700 transition-all ${error
                            ? "border-red-500/50 focus:border-red-500"
                            : "focus:border-white/30"
                            }`}
                    />
                </div>

                <button
                    onClick={handleApply}
                    disabled={!code.trim() || isLoading || disabled}
                    className={`px-6 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${!code.trim() || isLoading || disabled
                        ? "bg-white/5 text-white/10 cursor-not-allowed"
                        : "bg-white text-black hover:scale-[1.02] active:scale-95 shadow-xl shadow-white/5"
                        }`}
                >
                    {isLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        "Apply"
                    )}
                </button>
            </div>

            <AnimatePresence>
                {error && (
                    <motion.p
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="text-[12px] text-[#ff3b30] font-medium pl-1"
                    >
                        {error}
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    );
}

export default PromoCodeInput;
