"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../components/providers/AuthProvider";
import { Chrome, Mail, Loader2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export default function AuthPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-black text-white">Loading...</div>}>
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
            router.replace(returnUrl);
        }
    }, [user, loading, router, returnUrl]);

    const handleGoogleLogin = async () => {
        setSubmitting(true);
        setStatus({ type: "", message: "" });
        try {
            await loginWithGoogle();
            router.replace(returnUrl);
        } catch (err) {
            setStatus({ type: "error", message: err.message });
        } finally {
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
            router.replace(returnUrl);
        } catch (err) {
            setStatus({ type: "error", message: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="relative min-h-screen w-full overflow-hidden bg-black flex items-center justify-center px-4 py-20">
            {/* Background aesthetic */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full" />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 w-full max-w-md"
            >
                <div className="mb-10 text-center">
                    <Link href="/" className="inline-block mb-6">
                        <h1 className="text-3xl font-display uppercase tracking-[0.3em] text-white">
                            The C1rcle
                        </h1>
                    </Link>
                    <h2 className="text-xl font-medium text-white/90">
                        {mode === "login" ? "Welcome Back" : "Start Your Journey"}
                    </h2>
                    <p className="mt-2 text-sm text-white/40">
                        {mode === "login"
                            ? "Sign in to access exclusive events and your circle."
                            : "Join a community of the most influential people."}
                    </p>
                </div>

                {status.message && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className={`mb-6 overflow-hidden rounded-2xl border ${status.type === "error" ? "border-red-500/20 bg-red-500/10 text-red-400" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            } px-4 py-3 text-sm text-center`}
                    >
                        {status.message}
                    </motion.div>
                )}

                <div className="glass-panel overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-2xl shadow-2xl">
                    <div className="space-y-4">
                        <button
                            onClick={handleGoogleLogin}
                            disabled={submitting}
                            className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 py-4 text-sm font-medium text-white transition-all hover:bg-white/10 active:scale-95 disabled:opacity-50"
                        >
                            <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-500 group-hover:translate-x-[100%]" />
                            {submitting ? <Loader2 className="animate-spin" size={20} /> : <Chrome size={20} />}
                            Continue with Google
                        </button>

                        <div className="relative my-8 flex items-center py-2">
                            <div className="flex-grow border-t border-white/5"></div>
                            <span className="mx-4 flex-shrink text-[10px] uppercase tracking-[0.3em] text-white/20 font-bold">or</span>
                            <div className="flex-grow border-t border-white/5"></div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <AnimatePresence mode="wait">
                                {mode === "register" && (
                                    <motion.div
                                        key="name"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="space-y-2"
                                    >
                                        <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 ml-4">Full Name</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Alexander Pierce"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all outline-none"
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 ml-4">Email</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="name@exclusive.com"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 ml-4">Password</label>
                                <input
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all outline-none"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="mt-6 group relative w-full overflow-hidden rounded-2xl bg-white py-4 text-sm font-bold uppercase tracking-widest text-black transition-all hover:bg-zinc-200 active:scale-95 disabled:opacity-50"
                            >
                                <span className="relative z-10 flex items-center justify-center gap-2">
                                    {submitting ? <Loader2 className="animate-spin" size={20} /> : (
                                        <>
                                            {mode === "login" ? "Enter The Circle" : "Create Account"}
                                            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                                        </>
                                    )}
                                </span>
                            </button>
                        </form>

                        <div className="mt-8 text-center">
                            <button
                                onClick={() => setMode(mode === "login" ? "register" : "login")}
                                className="text-xs text-white/40 transition-colors hover:text-white"
                            >
                                {mode === "login"
                                    ? "New here? Create an account"
                                    : "Already a member? Sign in"}
                            </button>
                        </div>
                    </div>
                </div>

                <p className="mt-8 text-center text-[10px] uppercase tracking-[0.2em] text-white/20 leading-relaxed">
                    By entering, you agree to our <br />
                    <Link href="/terms" className="text-white/40 hover:text-white transition-colors underline underline-offset-4">Terms of Service</Link> and <Link href="/privacy" className="text-white/40 hover:text-white transition-colors underline underline-offset-4">Privacy Policy</Link>
                </p>
            </motion.div>
        </div>
    );
}
