"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../../components/providers/AuthProvider";
import { claimPartnerSlot } from "../../actions";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export default function PartnerClaimPage() {
    const { token } = useParams();
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [status, setStatus] = useState("verifying"); // verifying, ready, claiming, success, error
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!authLoading && !user) {
            // Store redirect URL
            const currentUrl = window.location.pathname;
            router.push(`/login?redirect=${encodeURIComponent(currentUrl)}`);
        }
    }, [user, authLoading, router]);

    const handleClaim = async () => {
        setStatus("claiming");
        try {
            await claimPartnerSlot(token);
            setStatus("success");
            setTimeout(() => router.push("/tickets"), 3000);
        } catch (err) {
            setError(err.message);
            setStatus("error");
        }
    };

    if (authLoading || (status === "verifying" && user)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-orange" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-black p-4">
            <div className="w-full max-w-md">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-zinc-900 rounded-[32px] overflow-hidden shadow-2xl p-10 text-center border border-white/5"
                >
                    <AnimatePresence mode="wait">
                        {status === "success" ? (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-6"
                            >
                                <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                                    <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black uppercase text-white mb-2">Claimed!</h1>
                                    <p className="text-xs text-white/40 uppercase tracking-widest leading-relaxed">
                                        You've successfully claimed your couple ticket slot. Redirecting to your tickets...
                                    </p>
                                </div>
                            </motion.div>
                        ) : status === "error" ? (
                            <motion.div
                                key="error"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-6"
                            >
                                <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                                    <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black uppercase text-white mb-2">Failed</h1>
                                    <p className="text-xs text-red-400 uppercase tracking-widest leading-relaxed">
                                        {error || "Something went wrong"}
                                    </p>
                                </div>
                                <Link
                                    href="/tickets"
                                    className="block w-full py-4 rounded-full bg-white/5 text-white/60 font-black uppercase text-xs tracking-[0.2em] border border-white/5"
                                >
                                    Go to My Tickets
                                </Link>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="ready"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-8"
                            >
                                <div className="w-20 h-20 rounded-full bg-orange/10 flex items-center justify-center mx-auto">
                                    <svg className="w-10 h-10 text-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black uppercase text-white mb-2">Accept Invitation</h1>
                                    <p className="text-xs text-white/40 uppercase tracking-widest leading-relaxed">
                                        You've been invited as a partner for a couple ticket. Once claimed, you both must arrive together for entry.
                                    </p>
                                </div>
                                <button
                                    onClick={handleClaim}
                                    disabled={status === "claiming"}
                                    className="w-full py-5 rounded-full bg-orange text-white font-black uppercase text-xs tracking-[0.3em] shadow-lg shadow-orange/20 disabled:opacity-50"
                                >
                                    {status === "claiming" ? "Claiming..." : "Claim Slot"}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
}
