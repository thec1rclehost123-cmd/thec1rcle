"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Moon, Search } from "lucide-react";

export default function NotFound() {
    return (
        <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-black text-white">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-iris/20 blur-[120px]" />
                <div className="absolute bottom-0 left-0 right-0 h-[300px] bg-gradient-to-t from-black via-black/80 to-transparent" />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center px-6 text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="mb-8 relative"
                >
                    <h1 className="font-heading text-[12rem] font-black leading-none tracking-tighter text-transparent sm:text-[16rem]">
                        <span className="bg-gradient-to-b from-white to-white/10 bg-clip-text">4</span>
                        <span className="bg-gradient-to-b from-iris to-iris-dim bg-clip-text">0</span>
                        <span className="bg-gradient-to-b from-white to-white/10 bg-clip-text">4</span>
                    </h1>

                    {/* Floating Elements */}
                    <motion.div
                        animate={{ y: [-10, 10, -10] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute -right-12 top-1/2 hidden sm:block"
                    >
                        <Moon className="h-16 w-16 text-gold/50" />
                    </motion.div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                >
                    <h2 className="mb-4 text-2xl font-bold sm:text-3xl">
                        Lost in the Night?
                    </h2>
                    <p className="mb-8 max-w-md text-white/60">
                        The page you're looking for has either ended or never existed.
                        Let's get you back to the party.
                    </p>

                    <div className="flex flex-col gap-4 sm:flex-row">
                        <Link
                            href="/"
                            className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-white px-8 py-3 text-sm font-bold text-black transition-all hover:bg-gray-200 hover:scale-105"
                        >
                            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                            Return Home
                        </Link>

                        <Link
                            href="/explore"
                            className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-8 py-3 text-sm font-bold text-white backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/40"
                        >
                            <Search className="h-4 w-4" />
                            Explore Events
                        </Link>
                    </div>
                </motion.div>
            </div>

            {/* Noise Overlay */}
            <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "url('/noise.png')" }} />
        </div>
    );
}
