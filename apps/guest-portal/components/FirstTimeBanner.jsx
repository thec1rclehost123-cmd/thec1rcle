"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import { useAuth } from "./providers/AuthProvider";

export default function FirstTimeBanner() {
    const { user } = useAuth();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Show only if not logged in and not dismissed
        const isDismissed = localStorage.getItem("posh_banner_dismissed");
        if (!user && !isDismissed) {
            // Small delay for better UX
            const timer = setTimeout(() => setIsVisible(true), 2000);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [user]);

    const handleDismiss = () => {
        setIsVisible(false);
        localStorage.setItem("posh_banner_dismissed", "true");
    };

    const handleSignIn = () => {
        window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL'));
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    className="fixed top-20 left-1/2 z-40 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl"
                >
                    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-4 shadow-2xl backdrop-blur-xl">
                        {/* Ambient glow */}
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-transparent to-emerald-500/10" />

                        <div className="relative flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white">
                                    <Sparkles size={16} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-white">
                                        Experience more with The Circle
                                    </p>
                                    <p className="text-[10px] text-white/50">
                                        Sign in to like, RSVP, and book tickets for exclusive events.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleSignIn}
                                    className="rounded-full bg-white px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-black transition hover:bg-zinc-200"
                                >
                                    Sign In
                                </button>
                                <button
                                    onClick={handleDismiss}
                                    className="rounded-full p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
