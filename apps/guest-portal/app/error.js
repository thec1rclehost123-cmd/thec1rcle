"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";

export default function Error({ error, reset }) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="glass-panel max-w-md space-y-8 p-10 relative overflow-hidden"
            >
                {/* Decorative background glow */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-orange/20 blur-[100px] rounded-full pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-iris/20 blur-[100px] rounded-full pointer-events-none" />

                <div className="relative z-10">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-orange/10 mb-6 border border-orange/20">
                        <svg
                            className="h-10 w-10 text-orange"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>

                    <h2 className="text-2xl font-black tracking-tight text-white mb-3 uppercase">
                        Something went wrong
                    </h2>
                    <p className="text-white/60 mb-8 max-w-[280px] mx-auto text-sm leading-relaxed font-medium">
                        We've encountered an unexpected glitch. Our team has been alerted, but you can try reloading.
                    </p>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => reset()}
                            className="glass-button w-full rounded-full py-4 text-xs font-black uppercase tracking-[0.3em] hover:bg-orange hover:text-white hover:border-orange transition-all duration-500"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="text-white/40 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-[0.4em] pt-2"
                        >
                            Return Home
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
