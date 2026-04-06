"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";

export default function Error({ error, reset }) {
    useEffect(() => {
        console.error("[AppError]", error);
    }, [error]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center"
        >
            <div className="max-w-md w-full space-y-6">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                    <svg className="w-6 h-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>

                <div className="space-y-2">
                    <h2 className="text-2xl font-black text-white tracking-tight">Something went wrong</h2>
                    <p className="text-sm text-white/40 font-medium leading-relaxed">
                        {error?.digest
                            ? `Error ID: ${error.digest}`
                            : "An unexpected error occurred. Our team has been notified."}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="px-6 py-3 rounded-full bg-white text-black text-[11px] font-black uppercase tracking-widest hover:bg-white/90 transition-all"
                    >
                        Try Again
                    </button>
                    <a
                        href="/"
                        className="px-6 py-3 rounded-full bg-white/5 border border-white/10 text-white text-[11px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                        Go Home
                    </a>
                </div>
            </div>
        </motion.div>
    );
}
