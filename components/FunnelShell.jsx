"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import RitualBackground from "./RitualBackground";

export default function FunnelShell({ children, title, backHref, showLogo = true }) {
    const router = useRouter();

    return (
        <div className="relative h-screen bg-black text-white selection:bg-orange/30 selection:text-white overflow-hidden flex flex-col">
            {/* Cinematic Backgrounds */}
            <RitualBackground />

            {/* Absolute Minimal Header */}
            <header className="absolute top-0 z-50 w-full">
                <div className="mx-auto flex h-24 max-w-[1400px] items-center justify-between px-8 md:px-12">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => backHref ? router.push(backHref) : router.back()}
                            className="group flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 backdrop-blur-xl transition-all hover:border-orange hover:bg-orange/5"
                        >
                            <ArrowLeft className="h-5 w-5 text-white/40 transition-colors group-hover:text-orange" />
                        </button>

                        {title && (
                            <h1 className="text-[10px] font-black uppercase tracking-[0.5em] text-white/40">
                                {title}
                            </h1>
                        )}
                    </div>

                    {showLogo && (
                        <Link href="/" className="flex items-center gap-4">
                            <div className="h-10 w-10 overflow-hidden rounded-full border border-orange/40 shadow-[0_0_20px_rgba(255,165,0,0.2)]">
                                <img src="/logo-circle.jpg" alt="Logo" className="h-full w-full object-cover" />
                            </div>
                            <span className="font-heading text-sm font-black uppercase tracking-[0.2em] text-white">
                                THE C1RCLE
                            </span>
                        </Link>
                    )}

                    <div className="w-12 md:w-32" />
                </div>
            </header>

            {/* Content Area - Centered and Viewport Constrained */}
            <main className="flex-1 flex flex-col relative z-10 w-full max-w-[1400px] mx-auto px-8 md:px-12 pt-24">
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="flex-1 flex flex-col"
                >
                    {children}
                </motion.div>
            </main>

            {/* Bottom Accent */}
            <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-orange/20 to-transparent pointer-events-none" />
        </div>
    );
}
