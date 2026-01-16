"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../../../components/providers/AuthProvider";
import { useToast } from "../../../../components/providers/ToastProvider";
import { Ticket, ShieldCheck, Clock, AlertTriangle, Fingerprint } from "lucide-react";

/**
 * THE C1RCLE - Virtual Waiting Room (v2 Hardened)
 */
const WaitingRoom = () => {
    const { eventId } = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const { toast } = useToast();

    const [status, setStatus] = useState("initializing"); // initializing, waiting, admitted, expired, error
    const [queueData, setQueueData] = useState(null);
    const [eventData, setEventData] = useState(null);
    const [waitTime, setWaitTime] = useState(null);
    const timerRef = useRef(null);

    // Initial check and Metadata
    useEffect(() => {
        document.title = "Virtual Waiting Room | THE C1RCLE";
        const fetchEventPreview = async () => {
            try {
                const res = await fetch(`/api/events/${eventId}`);
                const data = await res.json();
                setEventData(data.event);
            } catch (err) {
                console.error("Failed to fetch event preview", err);
            }
        };
        fetchEventPreview();
    }, [eventId]);

    const fetchStatus = async (qid) => {
        try {
            const res = await fetch(`/api/events/${eventId}/queue?queueId=${qid}`);
            const data = await res.json();

            if (data.status === "admitted" || data.status === "payment_failed") {
                // Adjust interval for admitted users (Heartbeat is critical here)
                resetHeartbeat(qid, 10000);

                setQueueData(data);
                setStatus("admitted");

                sessionStorage.setItem(`admission_token_${eventId}`, data.token);

                if (data.status === "payment_failed") {
                    toast("Payment Retry Window Active!", "success");
                }

                setTimeout(() => {
                    const nextUrl = searchParams.get("returnTo") || `/event/${eventId}`;
                    router.push(nextUrl);
                }, 1500);
            } else if (data.status === "waiting") {
                setQueueData(data);
                setStatus("waiting");
                // Lane-aware wait estimation
                const pos = data.lanePosition || data.position || 0;
                setWaitTime(Math.ceil(pos * 0.3));
            } else if (data.status === "expired" || data.status === "abandoned") {
                setStatus("expired");
                clearInterval(timerRef.current);
            }
        } catch (err) {
            console.error("Failed to fetch queue status", err);
        }
    };

    const resetHeartbeat = (qid, ms) => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => fetchStatus(qid), ms);
    };

    const join = async () => {
        try {
            const res = await fetch(`/api/events/${eventId}/queue`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user?.uid })
            });
            const data = await res.json();

            if (res.status === 429) {
                toast("Too many attempts. Please slow down.", "error");
                setStatus("error");
                return;
            }

            if (data.id) {
                setQueueData(data);
                setStatus(data.status);

                if (data.status === "waiting") {
                    // Poll waiting status every 15s to save server resources
                    resetHeartbeat(data.id, 15000);
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
        if (eventId && user !== undefined) {
            join();
        }
        return () => clearInterval(timerRef.current);
    }, [eventId, user]);

    const lowestPrice = eventData?.tickets?.reduce((min, t) => Math.min(min, t.price), Infinity) || 0;

    return (
        <div className="relative min-h-screen flex flex-col items-center justify-center p-6 bg-black overflow-hidden font-sans">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-iris/10 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-orange/10 blur-[150px] rounded-full" />
            </div>

            <AnimatePresence mode="wait">
                {status === "initializing" && (
                    <motion.div key="init" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                        <div className="w-16 h-16 border-4 border-white/10 border-t-iris rounded-full animate-spin mx-auto mb-8" />
                        <h1 className="text-2xl font-black uppercase tracking-widest text-white">Trust Verification</h1>
                        <p className="text-white/40 mt-4 font-bold text-[10px] tracking-[0.3em] uppercase">Analyzing Behavioural Signals</p>
                    </motion.div>
                )}

                {status === "waiting" && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-xl relative z-10"
                    >
                        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] p-8 mb-6 overflow-hidden relative">
                            <div className="flex items-center gap-6">
                                <div className="h-20 w-20 rounded-2xl bg-white/10 overflow-hidden">
                                    <img src={eventData?.image} alt="" className="w-full h-full object-cover opacity-50" />
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-xl font-black text-white uppercase tracking-tight line-clamp-1">{eventData?.title}</h2>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">{eventData?.date}</span>
                                        <span className="w-1 h-1 rounded-full bg-white/20" />
                                        <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">{eventData?.location}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[40px] p-10 text-center shadow-2xl">
                            <div className="mb-10 flex flex-col items-center">
                                <div className="px-6 py-2 rounded-full bg-white/5 border border-white/10 text-iris font-black text-[10px] uppercase tracking-widest mb-6 flex items-center gap-3">
                                    <Fingerprint className="w-3 h-3" />
                                    {queueData?.tier === 'loyal' ? 'Prioritized Access Lane' : 'Fair Admission Active'}
                                </div>
                                <h1 className="text-5xl font-black uppercase tracking-tighter text-white mb-4">You're in line</h1>
                                <p className="text-white/40 font-medium text-sm max-w-sm">We are processing attendees in cohorts to ensure server stability. Please keep this tab active.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-6 mb-10">
                                <div className="bg-white/5 rounded-3xl p-8 border border-white/5 group hover:border-white/10 transition-all">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-3 text-left">Lane Rank</div>
                                    <div className="text-5xl font-black text-white text-left tracking-tighter">#{queueData?.lanePosition || "..."}</div>
                                </div>
                                <div className="bg-white/5 rounded-3xl p-8 border border-white/5 group hover:border-white/10 transition-all">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-3 text-left">Est. Wait</div>
                                    <div className="text-5xl font-black text-white text-left tracking-tighter">{waitTime || "..."}<span className="text-sm ml-1 opacity-20">MIN</span></div>
                                </div>
                            </div>

                            <div className="bg-iris/5 border border-iris/20 rounded-3xl p-6 mb-10 flex items-start gap-4 text-left">
                                <div className="mt-1"><ShieldCheck className="w-5 h-5 text-iris" /></div>
                                <div>
                                    <div className="text-white font-black text-xs uppercase tracking-widest mb-1">Fee Rules Locked</div>
                                    <p className="text-white/40 text-[10px] leading-relaxed">
                                        Base starting price <span className="text-white font-bold">₹{lowestPrice}</span>.
                                        Standard fees & taxes (+ ~9%) will be calculated at checkout based on chosen tier. No bot scalp-markup.
                                    </p>
                                </div>
                            </div>

                            <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden mb-12">
                                <motion.div
                                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-iris via-orange to-red-500"
                                    initial={{ width: "0%" }}
                                    animate={{ width: `${Math.max(5, 100 - (queueData?.lanePosition || 100))}%` }}
                                    transition={{ type: "spring", stiffness: 30 }}
                                />
                            </div>

                            <div className="flex items-center justify-center gap-8 text-white/20">
                                <div className="flex items-center gap-2"><Clock className="w-4 h-4" /><span className="text-[9px] font-black uppercase tracking-widest">Fairness Verified</span></div>
                                <div className="flex items-center gap-2"><Ticket className="w-4 h-4" /><span className="text-[9px] font-black uppercase tracking-widest">Single-Seat Admission</span></div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {status === "admitted" && (
                    <motion.div key="admitted" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center z-10">
                        <div className="w-32 h-32 bg-iris/10 rounded-full flex items-center justify-center mx-auto mb-10 relative">
                            <div className="absolute inset-0 rounded-full border-4 border-iris border-t-transparent animate-spin" />
                            <ShieldCheck className="w-16 h-16 text-iris" />
                        </div>
                        <h1 className="text-6xl font-black uppercase tracking-tighter text-white mb-4">Admitted!</h1>
                        <p className="text-white/50 text-sm font-medium tracking-wide max-w-xs mx-auto">
                            {queueData?.status === "payment_failed" ? "Payment Failure Detected. Retry window restored for 3 minutes." : "Your unique admission key is active. Redirecting to checkout..."}
                        </p>
                    </motion.div>
                )}

                {status === "expired" && (
                    <motion.div key="expired" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center z-10 max-w-sm">
                        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
                            <AlertTriangle className="w-10 h-10 text-red-500" />
                        </div>
                        <h1 className="text-white text-3xl font-black uppercase tracking-tight mb-4">Session Expired</h1>
                        <p className="text-white/40 text-sm mb-12 leading-relaxed">
                            {queueData?.status === "abandoned"
                                ? "Inactivity detected. To keep the queue moving, inactive admitted sessions are automatically recycled."
                                : "Your queue session has timed out. Please re-join if you still wish to purchase."}
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-iris hover:text-white transition-all shadow-xl"
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
