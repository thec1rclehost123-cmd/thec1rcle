"use client";

/**
 * THE C1RCLE — Premium Ticket Claim Page (Web)
 * 
 * Beautiful warm amber gradient claim experience matching the mobile app.
 * Features sender attribution, stylized ticket preview with QR, and elegant actions.
 */

import { useEffect, useState, use } from "react";
import { useAuth } from "../../../../components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { getShareBundle, claimTicket } from "../../actions";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";

export default function ClaimTicketPage({ params: paramsPromise }) {
    const params = use(paramsPromise);
    const { token } = params;
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [bundle, setBundle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [claimResult, setClaimResult] = useState(null);
    const [claiming, setClaiming] = useState(false);

    useEffect(() => {
        const fetchBundle = async () => {
            try {
                const data = await getShareBundle(token);
                if (!data) {
                    setError("Link invalid or expired");
                } else {
                    setBundle(data);
                    if (data.existingAssignment) {
                        setClaimResult({ alreadyClaimed: true, assignment: data.existingAssignment });
                    }
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchBundle();
    }, [token]);

    const handleClaim = async () => {
        if (!user) {
            router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
            return;
        }

        setClaiming(true);
        setError(null);
        try {
            const result = await claimTicket(token);
            setClaimResult(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setClaiming(false);
        }
    };

    const handleDecline = () => {
        router.push("/explore");
    };

    // Loading state
    if (loading || authLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#E8913A] via-[#D97B1A] to-[#7A420C] flex items-center justify-center">
                <div className="text-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white mx-auto" />
                    <p className="mt-4 text-white/90 font-semibold">Verifying your invite...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error && !bundle) {
        const isGenderMismatch = error.toLowerCase().includes("gender mismatch");
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#E8913A] via-[#D97B1A] to-[#7A420C] flex flex-col items-center justify-center p-6 text-center">
                {/* Decorative orbs */}
                <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-60 h-60 bg-white/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />

                <div className="relative z-10">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-8 ${isGenderMismatch ? 'bg-white/15' : 'bg-white/15'}`}>
                        {isGenderMismatch ? (
                            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        ) : (
                            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        )}
                    </div>
                    <h1 className="text-4xl font-black text-white mb-4">
                        Oops!
                    </h1>
                    <p className="text-white/80 mb-10 max-w-xs text-base font-medium leading-relaxed">{error}</p>
                    <Link
                        href="/explore"
                        className="inline-block px-10 py-4 rounded-full bg-white text-[#8B4513] font-bold text-sm hover:scale-105 transition-transform shadow-lg"
                    >
                        Explore Events
                    </Link>
                </div>
            </div>
        );
    }

    const { event } = bundle;
    const tier = event?.tickets?.find(t => t.id === bundle.tierId);
    const isExhausted = bundle.remainingSlots <= 0;
    const senderName = bundle.senderName || bundle.senderEmail?.split("@")[0] || "Someone";
    const ticketCount = bundle.remainingSlots || bundle.ticketCount || 1;
    const eventDate = event?.date ? new Date(event.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }) : "";

    // Success state after claiming
    if (claimResult) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#E8913A] via-[#D97B1A] to-[#7A420C] flex items-center justify-center p-4 overflow-hidden">
                {/* Decorative orbs */}
                <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-60 h-60 bg-white/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />

                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-xl rounded-[40px] p-10 shadow-2xl text-center"
                >
                    {/* Success Icon */}
                    <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
                        <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>

                    <h1 className="text-3xl font-black text-gray-900 mb-2">
                        Tickets Secured!
                    </h1>
                    <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-8">
                        {event.title}
                    </p>

                    {/* QR Code */}
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-8 mb-8 inline-block shadow-lg">
                        <QRCodeSVG
                            value={claimResult.assignment.qrPayload}
                            size={180}
                            level="H"
                        />
                        <p className="mt-6 text-xs font-bold text-gray-400 uppercase tracking-widest">
                            Show this at entrance
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="space-y-4">
                        <Link
                            href="/tickets"
                            className="block w-full py-5 rounded-full bg-gradient-to-r from-[#D97B1A] to-[#E8913A] text-white font-bold text-sm uppercase tracking-wider shadow-xl hover:scale-[1.02] transition-transform"
                        >
                            View in My Wallet
                        </Link>
                        <p className="text-xs text-gray-400 font-medium">
                            A copy has been saved to your profile
                        </p>
                    </div>
                </motion.div>
            </div>
        );
    }

    // Main claim view
    return (
        <div className="min-h-screen bg-gradient-to-b from-[#E8913A] via-[#D97B1A] to-[#7A420C] relative flex items-center justify-center p-4 overflow-hidden">
            {/* Decorative orbs */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-white/15 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-white/15 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />

            {/* Logo */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
                <div className="w-12 h-12 rounded-full bg-white/15 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                    <span className="text-white font-black text-sm">C1</span>
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", damping: 20 }}
                className="relative z-10 w-full max-w-md"
            >
                {/* Headline */}
                <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-4xl font-black text-white text-center mb-6 leading-tight"
                    style={{ textShadow: "0 2px 10px rgba(0,0,0,0.15)" }}
                >
                    {senderName} sent you {ticketCount > 1 ? "tickets" : "a ticket"}
                </motion.h1>

                {/* Ticket Card */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3, type: "spring" }}
                    className="bg-white/[0.97] backdrop-blur-xl rounded-[32px] overflow-hidden shadow-2xl"
                >
                    {/* Event Header */}
                    <div className="p-5 pb-4 border-b border-gray-100">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center">
                                <span className="text-white font-black text-[10px]">C1</span>
                            </div>
                            <span className="text-gray-500 font-semibold text-sm truncate">
                                {event.venue || "The Venue"}
                            </span>
                        </div>
                        <div className="flex items-end justify-between">
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight truncate flex-1">
                                {event.title}
                            </h2>
                            <span className="text-gray-500 font-bold text-xs ml-3 whitespace-nowrap">
                                {eventDate}
                            </span>
                        </div>
                    </div>

                    {/* QR Code Area */}
                    <div className="relative aspect-square m-5 mt-4 rounded-3xl overflow-hidden bg-gradient-to-br from-amber-100/80 via-orange-100/60 to-amber-200/80">
                        {/* Wavy lines decoration */}
                        <div className="absolute inset-0 overflow-hidden opacity-[0.08]">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute left-0 right-0 h-0.5 bg-amber-900 rounded-full"
                                    style={{ top: `${12 + i * 12}%` }}
                                />
                            ))}
                        </div>

                        {/* QR Code */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-white/85 rounded-2xl p-5 shadow-xl">
                                <QRCodeSVG
                                    value={JSON.stringify({ type: "claim", token, eventId: bundle.eventId })}
                                    size={160}
                                    level="H"
                                    imageSettings={event.image ? {
                                        src: event.image,
                                        height: 40,
                                        width: 40,
                                        excavate: true,
                                    } : undefined}
                                />
                            </div>
                        </div>

                        {/* Ticket Count Badge */}
                        <div className="absolute bottom-3 right-3 bg-white/95 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                            <span className="font-bold text-gray-700 text-sm">{ticketCount}x</span>
                            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                            </svg>
                        </div>

                        {/* ID Badge */}
                        <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                            <span className="font-bold text-white/90 text-[10px] tracking-wider uppercase">
                                {token?.slice(0, 8)}
                            </span>
                        </div>
                    </div>

                    {/* Download Prompt */}
                    <div className="px-6 pb-6 pt-2">
                        <p className="text-gray-500 text-center text-sm leading-relaxed">
                            Download the app to easily transfer tickets<br />and manage events on the go
                        </p>
                    </div>
                </motion.div>

                {/* Actions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mt-6 space-y-3"
                >
                    {isExhausted ? (
                        <>
                            <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20">
                                <p className="text-red-100 font-bold uppercase text-xs tracking-widest text-center">
                                    All spots have been claimed
                                </p>
                            </div>
                            <Link
                                href="/explore"
                                className="block w-full py-5 rounded-full border border-white/20 text-white font-bold uppercase text-sm tracking-wider text-center hover:bg-white/10 transition-colors"
                            >
                                Discover more events
                            </Link>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={handleClaim}
                                disabled={claiming}
                                className="w-full py-5 rounded-full bg-white text-gray-900 font-bold text-lg shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                                {claiming ? "Claiming..." : "Accept Tickets"}
                            </button>

                            <button
                                onClick={handleDecline}
                                className="w-full py-4 text-white/70 font-semibold text-base underline underline-offset-4 decoration-white/30 hover:text-white transition-colors"
                            >
                                Decline
                            </button>

                            {!user && (
                                <p className="text-center text-white/40 text-xs uppercase tracking-widest font-medium">
                                    A C1RCLE account is required to claim
                                </p>
                            )}

                            {tier?.isCouple && (
                                <div className="p-4 rounded-2xl bg-white/10 border border-white/20 mt-4">
                                    <p className="text-white/80 text-xs font-semibold uppercase tracking-wide text-center leading-relaxed">
                                        Note: Couple entries must arrive together at the venue for valid entry.
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                    {error && (
                        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                            <p className="text-red-200 text-sm font-medium text-center">{error}</p>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </div>
    );
}
