"use client";

import { motion } from "framer-motion";

export default function RitualBackground() {
    return (
        <div className="fixed inset-0 -z-10 overflow-hidden bg-black pointer-events-none">
            {/* Central Brand Symbol - THE C1RCLE */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vh] h-[120vh]">
                {/* Main Outer Ring */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8, rotate: 0 }}
                    animate={{ opacity: 1, scale: 1, rotate: 360 }}
                    transition={{
                        opacity: { duration: 2 },
                        scale: { duration: 2 },
                        rotate: { duration: 60, repeat: Infinity, ease: "linear" }
                    }}
                    className="absolute inset-0 rounded-full border border-orange/10 shadow-[inner_0_0_100px_rgba(255,165,0,0.05),0_0_80px_rgba(255,165,0,0.02)]"
                />

                {/* Secondary Inner Ring */}
                <motion.div
                    initial={{ opacity: 0, scale: 1.1, rotate: 0 }}
                    animate={{ opacity: 0.4, scale: 1, rotate: -360 }}
                    transition={{
                        opacity: { duration: 3 },
                        scale: { duration: 2 },
                        rotate: { duration: 90, repeat: Infinity, ease: "linear" }
                    }}
                    className="absolute inset-[10%] rounded-full border border-orange/5"
                />
            </div>

            {/* Shifting Glow Orbs */}
            <motion.div
                animate={{
                    x: [0, 100, -50, 0],
                    y: [0, -50, 50, 0],
                    scale: [1, 1.1, 0.9, 1]
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-orange/20 blur-[140px]"
            />
            <motion.div
                animate={{
                    x: [0, -80, 40, 0],
                    y: [0, 60, -60, 0],
                    scale: [1, 1.2, 0.8, 1]
                }}
                transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-orange/15 blur-[120px]"
            />

            {/* Floating Particles */}
            <div className="absolute inset-0">
                {[...Array(20)].map((_, i) => (
                    <motion.div
                        key={i}
                        initial={{
                            opacity: 0,
                            x: Math.random() * 100 + "%",
                            y: Math.random() * 100 + "%"
                        }}
                        animate={{
                            opacity: [0, 0.4, 0],
                            y: [null, (Math.random() - 0.5) * 200 + "px"],
                            x: [null, (Math.random() - 0.5) * 200 + "px"]
                        }}
                        transition={{
                            duration: 10 + Math.random() * 10,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                        className="absolute h-1 w-1 bg-white rounded-full blur-[1px]"
                    />
                ))}
            </div>

            {/* Global Noise Overlay */}
            <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />

            {/* Bottom Vignette */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
        </div>
    );
}
