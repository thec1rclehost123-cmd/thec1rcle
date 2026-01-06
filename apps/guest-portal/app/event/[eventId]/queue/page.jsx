"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../../../components/providers/AuthProvider";
import { useToast } from "../../../../components/providers/ToastProvider";

const WaitingRoom = () => {
    const { eventId } = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const { toast } = useToast();

    const [status, setStatus] = useState("initializing"); // initializing, waiting, admitted, expired, error
    const [queueData, setQueueData] = useState(null);
    const [waitTime, setWaitTime] = useState(null);
    const timerRef = useRef(null);

    // Set document title and meta robots
    useEffect(() => {
        document.title = "Virtual Waiting Room | THE C1RCLE";
        const meta = document.createElement('meta');
        meta.name = "robots";
        meta.content = "noindex, nofollow";
        document.getElementsByTagName('head')[0].appendChild(meta);
        return () => {
            document.getElementsByTagName('head')[0].removeChild(meta);
        };
    }, []);

    const fetchStatus = async (qid) => {
        try {
            const res = await fetch(`/api/events/${eventId}/queue?queueId=${qid}`);
            const data = await res.json();

            if (data.status === "admitted") {
                clearInterval(timerRef.current);
                setQueueData(data);
                setStatus("admitted");

                // Save token to session storage
                sessionStorage.setItem(`admission_token_${eventId}`, data.token);

                // Auto-advance after 2 seconds
                toast("You're in! Redirecting to checkout...", "success");
                setTimeout(() => {
                    const nextUrl = searchParams.get("returnTo") || `/event/${eventId}`;
                    router.push(nextUrl);
                }, 2000);
            } else if (data.status === "waiting") {
                setQueueData(data);
                setStatus("waiting");
                // Estimating wait time: each position takes ~10 seconds on average (mock)
                setWaitTime(Math.ceil(data.position * 0.5));
            } else if (data.status === "expired") {
                setStatus("expired");
                clearInterval(timerRef.current);
            }
        } catch (err) {
            console.error("Failed to fetch queue status", err);
        }
    };

    const join = async () => {
        try {
            const res = await fetch(`/api/events/${eventId}/queue`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user?.uid })
            });
            const data = await res.json();

            if (data.id) {
                setQueueData(data);
                setStatus(data.status);
                if (data.status === "waiting") {
                    timerRef.current = setInterval(() => fetchStatus(data.id), 5000);
                } else if (data.status === "admitted") {
                    sessionStorage.setItem(`admission_token_${eventId}`, data.token);
                    const nextUrl = searchParams.get("returnTo") || `/event/${eventId}`;
                    router.push(nextUrl);
                }
            } else {
                setStatus("error");
            }
        } catch (err) {
            setStatus("error");
        }
    };

    useEffect(() => {
        if (eventId) {
            join();
        }
        return () => clearInterval(timerRef.current);
    }, [eventId, user]);

    return (
        <div className="relative min-h-[90vh] flex flex-col items-center justify-center p-6 bg-black overflow-hidden">
            {/* Background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange/20 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-iris/20 blur-[120px] rounded-full animate-pulse decoration-delay-2000" />
            </div>

            <AnimatePresence mode="wait">
                {status === "initializing" && (
                    <motion.div
                        key="init"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center"
                    >
                        <div className="w-12 h-12 border-4 border-white/10 border-t-orange rounded-full animate-spin mx-auto mb-6" />
                        <h1 className="font-heading text-xl font-black uppercase tracking-widest text-white">Entering Waiting Room</h1>
                    </motion.div>
                )}

                {status === "waiting" && (
                    <motion.div
                        key="waiting"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="w-full max-w-md bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[40px] p-10 text-center relative z-10"
                    >
                        <div className="mb-10">
                            <span className="inline-block px-4 py-1.5 rounded-full bg-orange/10 text-orange font-black text-[10px] uppercase tracking-widest mb-4">
                                Dynamic Queue Active
                            </span>
                            <h1 className="font-heading text-4xl font-black uppercase tracking-tight text-white mb-2">You're in line</h1>
                            <p className="text-white/40 font-medium text-sm">Please don't refresh this page. You will be admitted automatically.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-10">
                            <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                                <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 text-left">Your Position</div>
                                <div className="text-4xl font-black text-white text-left tracking-tight">#{queueData?.position || "..."}</div>
                            </div>
                            <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                                <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 text-left">Est. Wait</div>
                                <div className="text-4xl font-black text-white text-left tracking-tight">{waitTime || "..."}<span className="text-sm ml-1 opacity-40">MIN</span></div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden mb-10">
                            <motion.div
                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange to-iris"
                                initial={{ width: "0%" }}
                                animate={{ width: `${Math.max(5, 100 - (queueData?.position || 100))}%` }}
                                transition={{ type: "spring", stiffness: 50 }}
                            />
                        </div>

                        <div className="space-y-4">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 leading-relaxed">
                                High traffic detected. We're processing orders in batches to ensure inventory fairness.
                            </p>
                        </div>
                    </motion.div>
                )}

                {status === "admitted" && (
                    <motion.div
                        key="admitted"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center z-10"
                    >
                        <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                            <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h1 className="font-heading text-5xl font-black uppercase tracking-tight text-white mb-4">Admitted!</h1>
                        <p className="text-white/60 font-medium">Redirecting you to checkout now...</p>
                    </motion.div>
                )}

                {status === "expired" && (
                    <motion.div
                        key="expired"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center z-10"
                    >
                        <h1 className="text-white text-2xl font-black mb-4">Queue Expired</h1>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-8 py-4 bg-orange text-white rounded-full font-black uppercase tracking-widest text-xs"
                        >
                            Re-join Queue
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default WaitingRoom;
