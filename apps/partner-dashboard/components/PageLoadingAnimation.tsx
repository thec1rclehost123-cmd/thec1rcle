"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export default function PageLoadingAnimation() {
    const [isLoading, setIsLoading] = useState(true);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (isLoading) {
            document.body.style.overflow = 'hidden';

            // Smooth progress simulation
            const interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 90) return prev;
                    return prev + Math.random() * 10;
                });
            }, 100);

            const timer = setTimeout(() => {
                setProgress(100);
                setTimeout(() => setIsLoading(false), 500);
            }, 1500);

            // Safety fallback
            const safetyTimer = setTimeout(() => {
                setIsLoading(false);
            }, 4000);

            return () => {
                clearInterval(interval);
                clearTimeout(timer);
                clearTimeout(safetyTimer);
                document.body.style.overflow = '';
            };
        }
    }, [isLoading]);

    return (
        <AnimatePresence mode="wait">
            {isLoading && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, filter: "blur(20px)" }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    className="fixed inset-0 z-[9999] bg-black overflow-hidden flex items-center justify-center"
                >
                    {/* CSS-based Scanlines (High Performance) */}
                    <div
                        className="absolute inset-0 opacity-20 pointer-events-none"
                        style={{
                            backgroundImage: 'linear-gradient(transparent 50%, rgba(0, 255, 255, 0.05) 50%)',
                            backgroundSize: '100% 4px',
                            animation: 'scanline 10s linear infinite'
                        }}
                    />

                    {/* Hex Grid Background */}
                    <div className="absolute inset-0 opacity-10">
                        <svg width="100%" height="100%">
                            <defs>
                                <pattern id="hexagons" width="50" height="43.4" patternUnits="userSpaceOnUse" patternTransform="scale(2)">
                                    <polygon points="24.8,22 37.3,29.2 37.3,43.7 24.8,50.9 12.3,43.7 12.3,29.2" fill="none" stroke="rgba(0,255,255,0.3)" strokeWidth="0.5" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#hexagons)" />
                        </svg>
                    </div>

                    {/* Central Holographic Core */}
                    <div className="relative z-10 flex flex-col items-center justify-center">
                        <div className="relative w-64 h-64 flex items-center justify-center">
                            {/* Spinning Rings (CSS Animation) */}
                            <div className="absolute inset-0 border border-cyan-500/30 rounded-full animate-[spin_4s_linear_infinite]" />
                            <div className="absolute inset-4 border border-purple-500/30 rounded-full animate-[spin_6s_linear_infinite_reverse]" />
                            <div className="absolute inset-8 border border-white/20 rounded-full animate-[spin_8s_linear_infinite]" />

                            {/* Core Logo */}
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.5 }}
                                className="relative z-20 text-center"
                            >
                                <h1 className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-white filter drop-shadow-[0_0_10px_rgba(0,255,255,0.5)]">
                                    C1
                                </h1>
                                <p className="text-[10px] font-mono text-cyan-400/80 tracking-[0.5em] mt-2 animate-pulse">
                                    SYSTEM LOADING
                                </p>
                            </motion.div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-64 h-1 bg-white/10 rounded-full mt-8 overflow-hidden relative">
                            <motion.div
                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400 to-purple-500"
                                style={{ width: `${progress}%` }}
                                layoutId="progress"
                            />
                        </div>
                        <div className="flex justify-between w-64 mt-2 text-[9px] font-mono text-white/40">
                            <span>INITIALIZING...</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                    </div>

                    {/* Corner HUD Elements */}
                    <div className="absolute top-8 left-8 w-8 h-8 border-t-2 border-l-2 border-cyan-500/50" />
                    <div className="absolute top-8 right-8 w-8 h-8 border-t-2 border-r-2 border-cyan-500/50" />
                    <div className="absolute bottom-8 left-8 w-8 h-8 border-b-2 border-l-2 border-cyan-500/50" />
                    <div className="absolute bottom-8 right-8 w-8 h-8 border-b-2 border-r-2 border-cyan-500/50" />

                    <style jsx>{`
                        @keyframes scanline {
                            0% { background-position: 0 0; }
                            100% { background-position: 0 100%; }
                        }
                    `}</style>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
