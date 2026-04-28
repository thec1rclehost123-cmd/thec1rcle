"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { Share2, Sparkles } from "lucide-react";
import { useAuth } from "../../components/providers/AuthProvider";
import { sendTransferOTP, verifyAndCreateShareBundle } from "./ticketApi";

const ShareModal = ({ ticket, onClose, onSuccess, onChanged }) => {
    const { user, profile } = useAuth();
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [shareUrl, setShareUrl] = useState(null);
    const [copied, setCopied] = useState(false);
    const [showVerification, setShowVerification] = useState(false);
    const [otpCode, setOtpCode] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);

    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendTimer]);

    const otpRecipient = profile?.email || user?.email || ticket?.userEmail || ticket?.buyerEmail || "";

    const requestShareOtp = async () => {
        if (!otpRecipient) {
            throw new Error("We could not find your account email for verification. Refresh and sign in again.");
        }
        return sendTransferOTP(otpRecipient);
    };

    const handleResend = async () => {
        if (resendTimer > 0) return;
        try {
            await requestShareOtp();
            setResendTimer(60);
            setError(null);
        } catch (err) {
            setError(err.message);
        }
    };

    const { eventTitle, orderId, eventId } = ticket;

    // Group tickets by tier to show breakdown
    const tierBreakdown = {};
    ticket.tickets?.forEach(t => {
        if (t.isClaimed || t.isClaimedByOther || t.slotIndex === 0) return; // Skip claimed and owner
        if (!tierBreakdown[t.tierId]) {
            tierBreakdown[t.tierId] = {
                name: t.ticketType,
                count: 0,
                id: t.tierId,
                isCouple: t.isCouple,
                gender: t.requiredGender
            };
        }
        tierBreakdown[t.tierId].count++;
    });

    const availableTiers = Object.values(tierBreakdown);
    const [selectedTierId, setSelectedTierId] = useState(availableTiers[0]?.id || null);

    // If we already have a token for the selected tier, use it
    const existingToken = ticket.tickets?.find(t => t.tierId === selectedTierId)?.shareToken;

    useEffect(() => {
        if (existingToken) {
            setShareUrl(`${window.location.origin}/tickets/claim/${existingToken}`);
        } else {
            setShareUrl(null);
        }
    }, [selectedTierId, existingToken]);

    const handleCreate = async () => {
        setLoading(true);
        setError(null);
        try {
            await requestShareOtp();
            setShowVerification(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyAndCreate = async () => {
        if (otpCode.length !== 6) return;
        setVerifying(true);
        setError(null);
        try {
            const tier = availableTiers.find(t => t.id === selectedTierId);
            if (!tier) {
                throw new Error("Select a ticket type before creating a share link.");
            }
            const bundle = await verifyAndCreateShareBundle(orderId, eventId, tier.count, selectedTierId, otpCode, otpRecipient);
            const url = `${window.location.origin}/tickets/claim/${bundle.token}`;
            setShareUrl(url);
            setShowVerification(false);
            await onChanged?.();
        } catch (err) {
            setError(err.message);
        } finally {
            setVerifying(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative bg-white dark:bg-zinc-900 w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl p-8"
                onClick={e => e.stopPropagation()}
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange/10 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />

                <div className="relative z-10">
                    <h2 className="text-3xl font-heading font-black uppercase text-black dark:text-white mb-2 tracking-tighter">Share Tickets</h2>
                    <p className="text-[10px] text-black/40 dark:text-white/40 mb-8 uppercase tracking-[0.3em] font-bold">{eventTitle}</p>

                    {shareUrl ? (
                        <div className="space-y-8">
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-orange to-gold rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                                <div className="relative p-6 rounded-2xl bg-white dark:bg-black/40 border border-black/5 dark:border-white/10 backdrop-blur-xl">
                                    <p className="text-[10px] font-black text-orange uppercase tracking-[0.2em] mb-4">Live Share Link</p>
                                    <p className="text-sm font-bold text-black dark:text-white break-all mb-6 selection:bg-orange/30 font-mono leading-relaxed opacity-90">{shareUrl}</p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleCopy}
                                            className={clsx(
                                                "flex-1 py-4 rounded-xl font-black uppercase text-[11px] tracking-[0.2em] transition-all active:scale-[0.98]",
                                                copied
                                                    ? "bg-green-500 text-white"
                                                    : "bg-black dark:bg-white text-white dark:text-black shadow-lg"
                                            )}
                                        >
                                            {copied ? "Link Copied!" : "Copy Link"}
                                        </button>
                                        {typeof navigator !== 'undefined' && navigator.share && (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await navigator.share({
                                                            title: `Claim your tickets for ${eventTitle}`,
                                                            text: `I've shared some tickets for ${eventTitle} with you. Claim them here:`,
                                                            url: shareUrl
                                                        });
                                                    } catch {
                                                        // AbortError: user dismissed share sheet — expected
                                                    }
                                                }}
                                                className="h-[52px] w-[52px] flex items-center justify-center rounded-xl bg-orange text-white shadow-lg shadow-orange/20 active:scale-95 transition-all"
                                            >
                                                <Share2 className="h-5 w-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col items-center gap-4 px-4">
                                <p className="text-center text-[10px] text-black/50 dark:text-white/40 uppercase tracking-[0.2em] font-medium leading-loose">
                                    Send this link to your friends.<br />
                                    <span className="text-orange font-bold font-heading uppercase text-[8px] tracking-[0.1em]">Identity requested: Anyone who claims must have a C1RCLE account.</span>
                                </p>
                            </div>

                            <button
                                onClick={onSuccess}
                                className="w-full py-4 rounded-full border border-black/10 dark:border-white/10 text-black dark:text-white font-black uppercase text-[11px] tracking-[0.3em] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    ) : showVerification ? (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange/10 mb-4">
                                    <Sparkles className="h-6 w-6 text-orange" />
                                </div>
                                <h3 className="text-xl font-heading font-black uppercase text-black dark:text-white mb-2">Verify Share</h3>
                                <p className="text-[10px] text-black/40 dark:text-white/40 uppercase tracking-[0.2em] font-bold leading-relaxed px-4">
                                    A security code has been dispatched to your email. Enter it to authorize this share.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <input
                                    type="text"
                                    maxLength={6}
                                    placeholder="0 0 0 0 0 0"
                                    className="w-full px-5 py-5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 focus:border-orange/30 outline-none text-center text-2xl font-black tracking-[0.5em] text-black dark:text-white placeholder:text-black/5 dark:placeholder:text-white/5"
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                />

                                {error && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest text-center">{error}</p>}

                                <button
                                    disabled={verifying || otpCode.length !== 6}
                                    onClick={handleVerifyAndCreate}
                                    className="w-full py-5 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-black uppercase text-xs tracking-[0.3em] shadow-xl disabled:opacity-30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    {verifying ? "Authorizing..." : "Verify & Generate"}
                                </button>

                                <div className="flex flex-col items-center gap-2">
                                    <button
                                        onClick={() => setShowVerification(false)}
                                        className="w-full py-3 text-black/40 dark:text-white/40 uppercase text-[10px] font-bold tracking-[0.2em]"
                                    >
                                        ← Back to Selection
                                    </button>

                                    <button
                                        onClick={handleResend}
                                        disabled={resendTimer > 0}
                                        className="text-[9px] font-black uppercase tracking-widest text-orange disabled:opacity-40"
                                    >
                                        {resendTimer > 0 ? `Resend code in ${resendTimer}s` : "Resend Security Code"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* ... existing ticket selection code ... */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40 dark:text-white/40 ml-1">Select Ticket Type</p>
                                <div className="space-y-2">
                                    {availableTiers.map(tier => (
                                        <button
                                            key={tier.id}
                                            onClick={() => setSelectedTierId(tier.id)}
                                            className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all ${selectedTierId === tier.id
                                                ? "border-orange bg-orange/5"
                                                : "border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] hover:border-black/10"}`}
                                        >
                                            <div className="text-left">
                                                <p className="text-sm font-black uppercase tracking-tight text-black dark:text-white">{tier.name}</p>
                                                <p className="text-[9px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest">{tier.gender} only</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-black text-orange">{tier.count} Left</span>
                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedTierId === tier.id ? "border-orange bg-orange" : "border-black/10"}`}>
                                                    {selectedTierId === tier.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {error && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest text-center">{error}</p>}

                            <button
                                disabled={loading || !selectedTierId}
                                onClick={handleCreate}
                                className="w-full py-5 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-black uppercase text-xs tracking-[0.3em] shadow-xl disabled:opacity-30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {loading ? "Initiating..." : "Generate Share Link"}
                            </button>

                            <button
                                onClick={onClose}
                                className="w-full py-3 text-black/40 dark:text-white/40 uppercase text-[10px] font-bold tracking-[0.2em]"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

export { ShareModal };
