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
            // Refresh bundle data to show updated slots if needed
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
                <h1 className="text-4xl font-heading font-black text-white uppercase mb-4">Oops!</h1>
                <p className="text-white/60 mb-8 max-w-xs">{error}</p>
                <Link href="/explore" className="px-8 py-4 rounded-full bg-white text-black font-bold uppercase text-xs tracking-widest">
                    Go Explore
                </Link>
            </div>
        );
    }

    const { event } = bundle;
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
                        className="object-cover opacity-40 blur-3xl scale-110"
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 w-full max-w-md"
            >
                <AnimatePresence mode="wait">
                    {claimResult ? (
                        <motion.div
                            key="success"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-zinc-900/90 backdrop-blur-2xl rounded-[48px] p-8 border border-white/10 shadow-2xl text-center"
                        >
                            <div className="mb-8">
                                <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-[0.3em] mb-4">
                                    Ticket Claimed
                                </span>
                                <h1 className="text-3xl font-heading font-black text-white uppercase leading-tight mb-2">
                                    {event.title}
                                </h1>
                                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
                                    {event.date} • {event.time}
                                </p>
                            </div>

                            <div className="bg-white rounded-[40px] p-8 mb-8 inline-block shadow-2xl">
                                <QRCodeSVG
                                    value={claimResult.assignment.qrPayload}
                                    size={200}
                                    level="H"
                                />
                                <p className="mt-6 text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">
                                    One-time use entry pass
                                </p>
                            </div>

                            <Link href="/tickets" className="block w-full py-4 rounded-full bg-white text-black font-bold uppercase text-xs tracking-[0.2em] mb-4">
                                View in My Tickets
                            </Link>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="claim"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-zinc-900/90 backdrop-blur-2xl rounded-[48px] overflow-hidden border border-white/10 shadow-2xl"
                        >
                            <div className="relative h-64 w-full">
                                <Image src={event.image || "/events/holi-edit.svg"} alt={event.title} fill className="object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
                            </div>

                            <div className="p-10 pt-4 text-center">
                                <div className="mb-8">
                                    <p className="text-[10px] font-black text-orange uppercase tracking-[0.5em] mb-4">
                                        You're Invited
                                    </p>
                                    <h1 className="text-4xl font-heading font-black text-white uppercase leading-[0.85] mb-4">
                                        {event.title}
                                    </h1>
                                    <div className="flex flex-col items-center gap-2 text-white/40 text-[10px] font-bold uppercase tracking-widest">
                                        <p>{event.host}</p>
                                        <p>{event.venue} • {event.city}</p>
                                        <p>{event.date} • {event.time}</p>
                                    </div>
                                </div>

                                {isExhausted ? (
                                    <div className="space-y-6">
                                        <p className="text-red-500 font-bold uppercase text-xs">All tickets have been claimed</p>
                                        <Link href="/explore" className="block w-full py-4 rounded-full border border-white/10 text-white font-bold uppercase text-xs tracking-widest">
                                            Find other events
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="flex flex-col items-center gap-1 mb-8">
                                            <div className="h-1 w-12 bg-orange rounded-full mb-2" />
                                            <p className="text-[10px] text-white/60 font-medium uppercase tracking-[0.2em]">
                                                {bundle.remainingSlots} of {bundle.totalSlots} Slots Remaining
                                            </p>
                                        </div>

                                        <button
                                            onClick={handleClaim}
                                            disabled={claiming}
                                            className="w-full py-5 rounded-full bg-white text-black font-black uppercase text-sm tracking-[0.3em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                        >
                                            {claiming ? "Processing..." : "Claim Ticket"}
                                        </button>

                                        {!user && (
                                            <p className="text-[9px] text-white/30 uppercase tracking-widest">
                                                Login required to claim
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
