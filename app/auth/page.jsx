"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Mail, Lock, User, ArrowRight, Chrome, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "../../components/providers/AuthProvider";
import PageShell from "../../components/PageShell";

export default function AuthPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <AuthContent />
        </Suspense>
    );
}

function AuthContent() {
    const { login, register, loginWithGoogle, user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnUrl = searchParams.get("returnUrl") || searchParams.get("next") || "/profile";

    const [mode, setMode] = useState("login");
    const [form, setForm] = useState({ email: "", password: "", name: "" });
    const [status, setStatus] = useState({ type: "", message: "" });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (user && !loading) {
            router.replace(`/auth/callback?returnUrl=${encodeURIComponent(returnUrl)}`);
        }
    }, [user, loading, router, returnUrl]);

    const handleGoogleLogin = async () => {
        setSubmitting(true);
        setStatus({ type: "", message: "" });
        try {
            await loginWithGoogle();
            router.replace(`/auth/callback?returnUrl=${encodeURIComponent(returnUrl)}`);
        } catch (err) {
            setStatus({ type: "error", message: err.message });
            setSubmitting(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setStatus({ type: "", message: "" });
        try {
            if (mode === "login") {
                await login(form.email, form.password);
            } else {
                if (!form.name.trim()) throw new Error("Name is required");
                await register(form.email, form.password, form.name);
            }
            router.replace(`/auth/callback?returnUrl=${encodeURIComponent(returnUrl)}`);
        } catch (err) {
            setStatus({ type: "error", message: err.message });
            setSubmitting(false);
        }
    };

    return (
        <PageShell title={mode === "login" ? "Identity" : "Citizenship"} showLogo={true} backHref="/explore">
            <div className="max-w-md mx-auto pb-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-center space-y-4 mb-10"
                >
                    <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-[-0.04em] leading-[0.9]">
                        {mode === "login" ? (
                            <>Authenticating <span className="text-orange">Access.</span></>
                        ) : (
                            <>Initialize your <span className="text-orange">Access.</span></>
                        )}
                    </h1>
                    <p className="text-sm font-medium text-black/40 dark:text-white/40 uppercase tracking-widest max-w-[280px] mx-auto">
                        {mode === "login"
                            ? "Verify your credentials to enter the circle."
                            : "Create your unique digital identity for the network."}
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="glass-panel p-8 rounded-[40px] border border-black/[0.05] dark:border-white/10 bg-white/50 dark:bg-white/[0.02] shadow-2xl space-y-8"
                >
                    <button
                        onClick={handleGoogleLogin}
                        disabled={submitting}
                        className="group relative w-full h-14 flex items-center justify-center gap-3 rounded-2xl bg-black/[0.03] dark:bg-white/5 border border-black/5 dark:border-white/10 text-sm font-bold uppercase tracking-widest transition-all hover:bg-black/[0.05] dark:hover:bg-white/10 active:scale-95 disabled:opacity-50"
                    >
                        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Chrome className="h-5 w-5" />}
                        Continue with Google
                    </button>

                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-black/[0.05] dark:border-white/5" /></div>
                        <div className="relative flex justify-center text-[10px]"><span className="bg-white dark:bg-[#121212] px-4 font-black uppercase tracking-[0.3em] text-black/20 dark:text-white/20">identity vault</span></div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <AnimatePresence mode="wait">
                            {mode === "register" && (
                                <motion.div
                                    key="full-name"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="space-y-2 overflow-hidden"
                                >
                                    <label className="text-[10px] uppercase tracking-widest text-black/60 dark:text-white/60 ml-4 font-bold">Display Name</label>
                                    <div className="relative">
                                        <User className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-black/20 dark:text-white/20" />
                                        <input
                                            type="text"
                                            required
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            placeholder="Alexander P."
                                            className="w-full h-14 pl-14 pr-6 rounded-2xl bg-black/[0.03] dark:bg-white/5 border border-black/5 dark:border-white/10 focus:border-orange/50 focus:outline-none transition-all"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-black/60 dark:text-white/60 ml-4 font-bold">Access Email</label>
                            <div className="relative">
                                <Mail className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-black/20 dark:text-white/20" />
                                <input
                                    type="email"
                                    required
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="vault@thecircle.com"
                                    className="w-full h-14 pl-14 pr-6 rounded-2xl bg-black/[0.03] dark:bg-white/5 border border-black/5 dark:border-white/10 focus:border-orange/50 focus:outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-4">
                                <label className="text-[10px] uppercase tracking-widest text-black/60 dark:text-white/60 font-bold">Passkey</label>
                                {mode === "login" && (
                                    <Link href="/forgot-password" core-link="true" className="text-[10px] uppercase tracking-widest text-orange/60 hover:text-orange font-bold transition-colors">
                                        Reset
                                    </Link>
                                )}
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-black/20 dark:text-white/20" />
                                <input
                                    type="password"
                                    required
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    placeholder="••••••••"
                                    className="w-full h-14 pl-14 pr-6 rounded-2xl bg-black/[0.03] dark:bg-white/5 border border-black/5 dark:border-white/10 focus:border-orange/50 focus:outline-none transition-all"
                                />
                            </div>
                        </div>

                        {status.message && (
                            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-red-500">
                                <AlertCircle className="h-4 w-4" />
                                <p className="text-[10px] font-bold uppercase tracking-widest">{status.message}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={submitting}
                            className="group relative w-full h-16 flex items-center justify-center rounded-full bg-black dark:bg-white text-white dark:text-black font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 shadow-xl"
                        >
                            {submitting ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                                <>
                                    {mode === "login" ? "Verify Access" : "Secure Identity"}
                                    <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
                                </>
                            )}
                        </button>
                    </form>

                    <button
                        onClick={() => setMode(mode === "login" ? "register" : "login")}
                        className="w-full text-[10px] font-black uppercase tracking-[0.4em] text-black/30 dark:text-white/30 hover:text-orange transition-colors"
                    >
                        {mode === "login" ? "New Citizen? Register" : "Existing Member? Verify"}
                    </button>
                </motion.div>
            </div>
        </PageShell>
    );
}
