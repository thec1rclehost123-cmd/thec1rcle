"use client";

import { motion } from "framer-motion";
import KineticCardFlow from "./KineticCardFlow";

export default function HeroCarousel({ cards = [] }) {
    return (
        <section className="relative w-full min-h-[420px] md:min-h-[620px] lg:min-h-[720px] bg-[#050505] flex flex-col items-center pt-8 pb-8 md:pt-14 md:pb-14 overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#ff4b1f]/5 blur-[140px] rounded-full mix-blend-plus-lighter animate-pulse" />
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full" />
            </div>

            {/* Heading Block */}
            <div className="flex flex-col items-center justify-center text-center z-20 mb-10 md:mb-16 relative px-4">
                <motion.span
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-[10px] tracking-[0.3em] text-[#ff4b1f] font-black uppercase mb-6 shadow-2xl"
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff4b1f] animate-ping" />
                    Now Dropping
                </motion.span>
                <motion.h1
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8 }}
                    className="text-[34px] md:text-[56px] lg:text-[76px] leading-[0.9] font-black uppercase tracking-tighter text-white mb-4"
                >
                    Featured <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff4b1f] via-[#ff9068] to-[#ff4b1f] bg-[length:200%_auto] animate-gradient-x">Drops</span>
                </motion.h1>
                <div className="w-32 h-1 bg-gradient-to-r from-transparent via-[#ff4b1f] to-transparent opacity-40" />
            </div>

            <KineticCardFlow events={cards} />

            <style jsx global>{`
                @keyframes gradient-x {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .animate-gradient-x {
                    animation: gradient-x 3s ease infinite;
                }
            `}</style>
        </section>
    );
}
