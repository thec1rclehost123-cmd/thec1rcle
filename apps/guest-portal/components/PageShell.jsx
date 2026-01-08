"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PageShell({ children, title, backHref, showLogo = true }) {
    const router = useRouter();

    return (
        <div className="relative min-h-screen bg-white dark:bg-black text-black dark:text-white transition-colors duration-300">
            {/* Background Glows */}
            <div className="pointer-events-none fixed inset-0 -z-10">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[60vh] bg-[radial-gradient(circle_at_top,_rgba(244,74,34,0.08),transparent_70%)] blur-[100px] dark:opacity-80 opacity-50" />
                <div className="absolute bottom-0 right-0 w-[40vw] h-[40vh] bg-[radial-gradient(circle_at_bottom_right,_rgba(244,74,34,0.05),transparent_70%)] blur-[80px]" />
            </div>

            {/* Header - Adjusted for Global Navbar */}
            <header className="sticky top-[72px] sm:top-[88px] z-40 w-full border-b border-black/[0.03] dark:border-white/[0.05] bg-white/40 dark:bg-black/40 backdrop-blur-xl">
                <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
                    <div className="flex items-center gap-4">
                        {backHref ? (
                            <Link
                                href={backHref}
                                className="group flex h-9 w-9 items-center justify-center rounded-full border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 transition-all hover:bg-black/[0.05] dark:hover:bg-white/10"
                            >
                                <ArrowLeft className="h-4 w-4 text-black/60 dark:text-white/60 transition-colors group-hover:text-black dark:group-hover:text-white" />
                            </Link>
                        ) : (
                            <button
                                onClick={() => router.back()}
                                className="group flex h-9 w-9 items-center justify-center rounded-full border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 transition-all hover:bg-black/[0.05] dark:hover:bg-white/10"
                            >
                                <ArrowLeft className="h-4 w-4 text-black/60 dark:text-white/60 transition-colors group-hover:text-black dark:group-hover:text-white" />
                            </button>
                        )}

                        {title && (
                            <h1 className="text-[10px] font-black uppercase tracking-[0.2em] text-black/80 dark:text-white/80">
                                {title}
                            </h1>
                        )}
                    </div>

                    <div className="w-9" />
                </div>
            </header>

            {/* Content */}
            <main className="mx-auto max-w-7xl px-4 pt-8 pb-20 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                >
                    {children}
                </motion.div>
            </main>

            {/* Footer */}
            <footer className="mt-auto py-12 border-t border-black/[0.03] dark:border-white/[0.05]">
                <div className="mx-auto max-w-7xl px-6 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-black/20 dark:text-white/20">
                        © <span suppressHydrationWarning>{new Date().getFullYear()}</span> THE C1RCLE. ALL RIGHTS RESERVED.
                    </p>
                </div>
            </footer>
        </div>
    );
}
