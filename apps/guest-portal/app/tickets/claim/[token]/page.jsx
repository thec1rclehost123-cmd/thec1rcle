"use client";

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

    if (loading || authLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-orange" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-8 border border-red-500/20">
                    <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>
                <h1 className="text-4xl font-heading font-black text-white uppercase mb-4 tracking-tighter">Link Invalid</h1>
                <p className="text-white/40 mb-10 max-w-xs text-sm font-medium">{error}</p>
                <Link href="/explore" className="px-10 py-4 rounded-full bg-white text-black font-black uppercase text-[10px] tracking-[0.3em] hover:scale-105 transition-transform">
                    Go Explore
                </Link>
            </div>
        );
    }

    const { event } = bundle;
    const tier = event?.tickets?.find(t => t.id === bundle.tierId);
    const isExhausted = bundle.remainingSlots <= 0;

    return (
        <div className="min-h-screen bg-black relative flex items-center justify-center p-4 overflow-hidden">
            {/* Immersive Background */}
            <div className="absolute inset-0 z-0">
                {event.image && (
                    <Image
                        src={event.image}
                        alt=""
                        fill
                        className="object-cover opacity-60 blur-3xl scale-125"
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", damping: 20 }}
                className="relative z-10 w-full max-w-md"
            >
                <AnimatePresence mode="wait">
                    {claimResult ? (
                        <motion.div
                            key="success"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-zinc-900/90 backdrop-blur-3xl rounded-[48px] p-10 border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.5)] text-center"
                        >
                            <div className="mb-10 text-center">
                                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
                                    <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h1 className="text-3xl font-heading font-black text-white uppercase leading-tight mb-3 tracking-tighter">
                                    Spot Secured!
                                </h1>
                                <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em]">
                                    {event.title}
                                </p>
                            </div>

                            <div className="bg-white rounded-[40px] p-8 mb-10 inline-block shadow-2xl transform hover:scale-[1.02] transition-transform">
                                <QRCodeSVG
                                    value={claimResult.assignment.qrPayload}
                                    size={200}
                                    level="H"
                                />
                                <p className="mt-6 text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">
                                    Show this at entrance
                                </p>
                            </div>

                            <div className="space-y-4">
                                <Link href="/tickets" className="block w-full py-5 rounded-full bg-white text-black font-black uppercase text-[11px] tracking-[0.3em] shadow-xl hover:scale-[1.02] transition-transform active:scale-95">
                                    View in My Wallet
                                </Link>
                                <p className="text-[9px] text-white/30 uppercase tracking-[0.2em]">A copy has been saved to your profile</p>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="claim"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-zinc-900/90 backdrop-blur-3xl rounded-[56px] overflow-hidden border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.6)]"
                        >
                            <div className="relative h-72 w-full">
                                <Image src={event.image || "/events/placeholder.svg"} alt={event.title} fill className="object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/20 to-transparent" />

                                <div className="absolute top-8 left-8">
                                    <div className="px-4 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white text-[10px] font-black uppercase tracking-widest">
                                        Invitation
                                    </div>
                                </div>
                            </div>

                            <div className="p-10 pt-4 text-center">
                                <div className="mb-10">
                                    <h1 className="text-5xl font-heading font-black text-white uppercase leading-[0.8] mb-6 tracking-tighter">
                                        {event.title}
                                    </h1>

                                    <div className="flex flex-col items-center gap-4">
                                        <div className="px-5 py-2 rounded-2xl bg-white text-black text-[10px] font-black uppercase tracking-[0.3em]">
                                            {tier?.name || "General Admission"}
                                        </div>

                                        <div className="flex flex-col items-center gap-1.5 text-white/50 text-[10px] font-bold uppercase tracking-[0.2em]">
                                            <p className="flex items-center gap-2">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                {event.venue} • {event.city}
                                            </p>
                                            <p className="flex items-center gap-2">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                {event.date} • {event.time}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {isExhausted ? (
                                    <div className="space-y-6">
                                        <div className="p-6 rounded-3xl bg-red-500/5 border border-red-500/10">
                                            <p className="text-red-500 font-black uppercase text-[10px] tracking-[0.2em]">All spots have been claimed</p>
                                        </div>
                                        <Link href="/explore" className="block w-full py-5 rounded-full border border-white/10 text-white font-black uppercase text-[11px] tracking-[0.3em] hover:bg-white/5 transition-colors">
                                            Discover more events
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        <div className="relative py-2">
                                            <div className="bg-white/5 h-1 w-full rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${(bundle.remainingSlots / bundle.totalSlots) * 100}%` }}
                                                    className="h-full bg-orange"
                                                />
                                            </div>
                                            <p className="mt-3 text-[10px] text-white/40 font-black uppercase tracking-[0.3em]">
                                                {bundle.remainingSlots} of {bundle.totalSlots} Slots Open
                                            </p>
                                        </div>

                                        {tier?.isCouple && (
                                            <div className="p-4 rounded-2xl bg-orange/5 border border-orange/20">
                                                <p className="text-orange text-[9px] font-black uppercase tracking-[0.2em] leading-relaxed">
                                                    Note: Couple entries must arrive together at the venue for valid entry.
                                                </p>
                                            </div>
                                        )}

                                        <button
                                            onClick={handleClaim}
                                            disabled={claiming}
                                            className="group relative w-full py-6 rounded-full bg-white text-black font-black uppercase text-xs tracking-[0.4em] shadow-[0_20px_40px_rgba(255,255,255,0.1)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 overflow-hidden"
                                        >
                                            <span className="relative z-10">{claiming ? "Claiming Spot..." : "Claim Ticket"}</span>
                                            <div className="absolute inset-0 bg-gradient-to-r from-orange to-gold opacity-0 group-hover:opacity-10 transition-opacity" />
                                        </button>

                                        {!user && (
                                            <p className="text-[10px] text-white/20 uppercase tracking-[0.3em] font-medium italic">
                                                A C1RCLE account is required to claim
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
