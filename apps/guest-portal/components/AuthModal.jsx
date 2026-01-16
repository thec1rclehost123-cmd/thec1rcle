"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Github, Chrome, Loader2 } from "lucide-react";
import { useAuth } from "./providers/AuthProvider";
import { getIntent, clearIntent } from "../lib/utils/intentStore";
import { useRouter } from "next/navigation";
import GenderSelector from "./GenderSelector";
import { useToast } from "./providers/ToastProvider";

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
    const { login, register, loginWithGoogle } = useAuth();
    const [mode, setMode] = useState("login"); // "login" | "register" | "email_otp"
    const [form, setForm] = useState({ email: "", password: "", name: "", gender: "" });
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError("");
        try {
            await loginWithGoogle();
            handleSuccess();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            if (mode === "login") {
                await login(form.email, form.password);
            } else {
                if (!form.name.trim()) throw new Error("Name is required");
                if (!form.gender) {
                    toast({
                        type: "error",
                        message: "Select a gender to continue."
                    });
                    throw new Error("Select a gender to continue.");
                }
                await register(form.email, form.password, form.name, form.gender);
            }
            handleSuccess();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSuccess = () => {
        onClose();
        if (onAuthSuccess) onAuthSuccess();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />

            {/* Modal */}
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-white/10 bg-black/40 p-8 shadow-2xl backdrop-blur-xl"
            >
                {/* Glow effect */}
                <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-purple-500/20 blur-[80px]" />
                <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-emerald-500/10 blur-[80px]" />

                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 p-4 text-white/40 transition hover:bg-white/5 rounded-full hover:text-white"
                    aria-label="Close"
                >
                    <X size={24} />
                </button>

                <div className="relative z-10">
                    <div className="mb-8 text-center">
                        <h2 className="text-2xl font-display uppercase tracking-widest text-white">
                            Sign In To Continue
                        </h2>
                        <p className="mt-2 text-sm text-white/50">
                            Like, RSVP, and book tickets.
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-center text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="flex w-full items-center justify-center gap-4 h-14 rounded-2xl bg-white text-black font-black uppercase tracking-[0.2em] text-[10px] hover:bg-zinc-100 active:scale-[0.98] transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                        >
                            {loading ? (
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
                        </button>

                        <div className="relative my-8 flex items-center py-2">
                            <div className="flex-grow border-t border-white/5"></div>
                            <span className="mx-4 flex-shrink text-xs uppercase tracking-widest text-white/20">or</span>
                            <div className="flex-grow border-t border-white/5"></div>
                        </div>

                        <form onSubmit={handleEmailAuth} className="space-y-4">
                            {mode === "register" && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 ml-4">Full Name</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="John Doe"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                                        />
                                    </div>
                                    <GenderSelector
                                        value={form.gender}
                                        onChange={(val) => setForm({ ...form, gender: val })}
                                        disabled={loading}
                                        error={error && !form.gender ? "Selection Required" : null}
                                    />
                                </>
                            )}
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 ml-4">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="name@example.com"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
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
                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="mt-6 w-full rounded-2xl bg-white py-4 text-sm font-bold uppercase tracking-widest text-black transition hover:bg-zinc-200 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : (mode === "login" ? "Sign In" : "Create Account")}
                            </button>
                        </form>

                        <div className="mt-8 text-center">
                            <button
                                onClick={() => setMode(mode === "login" ? "register" : "login")}
                                className="text-xs font-medium text-white/40 transition hover:text-white py-3 px-6 rounded-xl hover:bg-white/5"
                            >
                                {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
