
"use client";

import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Ticket } from "lucide-react";
import Link from "next/link";

export default function AccessGranted() {
    return (
        <div className="flex flex-col items-center justify-center text-center space-y-8 max-w-[400px]">
            <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 12, stiffness: 100 }}
                className="w-24 h-24 rounded-full bg-orange/20 flex items-center justify-center border border-orange/40 relative"
            >
                <div className="absolute inset-0 rounded-full bg-orange/20 animate-ping" />
                <CheckCircle className="w-12 h-12 text-orange " />
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-4"
            >
                <h1 className="text-5xl font-black uppercase tracking-tighter text-white leading-none">
                    Access <br /> <span className="text-orange">Granted</span>
                </h1>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.4em]">
                    Your rituals are verified.
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="grid grid-cols-1 gap-4 w-full"
            >
                <Link
                    href="/explore"
                    className="group relative h-16 flex items-center justify-center rounded-3xl bg-white text-black font-black uppercase tracking-[0.5em] text-xs transition-all hover:scale-[1.02] active:scale-95"
                >
                    <span className="relative z-10 flex items-center gap-3">
                        Continue to Explore
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                </Link>
                <Link
                    href="/tickets"
                    className="group h-16 flex items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-white/60 font-black uppercase tracking-[0.5em] text-xs transition-all hover:bg-white/10 hover:text-white"
                >
                    <span className="flex items-center gap-3">
                        Go to Tickets
                        <Ticket className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                    </span>
                </Link>
            </motion.div>
        </div>
    );
}
