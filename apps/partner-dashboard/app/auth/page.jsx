"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDashboardAuth } from "../../components/providers/DashboardAuthProvider";
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
    const { signIn, signUp, signInWithGoogle, user, loading } = useDashboardAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnUrl = searchParams.get("returnUrl") || searchParams.get("next") || "/venue"; // Default to /venue

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
            await signInWithGoogle();
            // Auth state listener in RootLayout will handle redirect
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
                await signIn(form.email, form.password);
            } else {
                if (!form.name.trim()) throw new Error("Name is required");
                await signUp(form.email, form.password, form.name);
            }
            // Auth state listener in RootLayout will handle redirect
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
                        {mode === "login" ? "Welcome back." : "Create account."}
                    </h2>
                    <p className="mt-2 text-sm text-white/40">
                        {mode === "login"
                            ? "Sign in to manage your events and dashboard."
                            : "Join the platform for event organizers."}
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
                            className="group relative flex w-full items-center justify-center h-15 rounded-2xl bg-white text-black font-bold uppercase tracking-[0.2em] text-[11px] transition-all hover:bg-zinc-100 active:scale-95 disabled:opacity-50 overflow-hidden"
                        >
                            <div className="flex items-center gap-3">
                                {submitting ? (
                                    <Loader2 className="animate-spin" size={18} />
                                ) : (
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path
                                            fill="#4285F4"
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        />
                                        <path
                                            fill="#34A853"
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        />
                                        <path
                                            fill="#FBBC05"
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.27.81-.57z"
                                        />
                                        <path
                                            fill="#EA4335"
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        />
                                    </svg>
                                )}
                                Continue with Google
                            </div>
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
                                            autoCapitalize="words"
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 ml-4">Email</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="name@email.com"
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
                                            {mode === "login" ? "Sign In" : "Create Account"}
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
