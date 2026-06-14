"use client";


import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Ticket } from "lucide-react";
import Link from "next/link";

export default function AccessGranted() {
    return (
        <div className="flex w-full max-w-[360px] flex-col items-center justify-center text-center space-y-8 px-4">
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
                    Your access is verified.
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
                    className="group relative flex h-14 w-full items-center justify-center rounded-2xl bg-white px-4 text-black font-black uppercase tracking-[0.28em] text-[10px] transition-all hover:scale-[1.02] active:scale-95"
                >
                    <span className="relative z-10 flex items-center justify-center gap-2 text-center">
                        Continue to Explore
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                </Link>
                <Link
                    href="/tickets"
                    className="group flex h-14 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-white/60 font-black uppercase tracking-[0.28em] text-[10px] transition-all hover:bg-white/10 hover:text-white"
                >
                    <span className="flex items-center justify-center gap-2 text-center">
                        Go to Tickets
                        <Ticket className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                    </span>
                </Link>
            </motion.div>
        </div>
    );
}
