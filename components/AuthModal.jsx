"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Github, Chrome, Loader2 } from "lucide-react";
import { useAuth } from "./providers/AuthProvider";
import { getIntent, clearIntent } from "../lib/utils/intentStore";
import { useRouter } from "next/navigation";

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
    const { login, register, loginWithGoogle } = useAuth();
    const [mode, setMode] = useState("login"); // "login" | "register" | "email_otp"
    const [form, setForm] = useState({ email: "", password: "", name: "" });
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
                await register(form.email, form.password, form.name);
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
                    className="absolute right-6 top-6 rounded-full p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
                >
                    <X size={20} />
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
                            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-4 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <Chrome size={20} />}
                            Continue with Google
                        </button>

                        <div className="relative my-8 flex items-center py-2">
                            <div className="flex-grow border-t border-white/5"></div>
                            <span className="mx-4 flex-shrink text-xs uppercase tracking-widest text-white/20">or</span>
                            <div className="flex-grow border-t border-white/5"></div>
                        </div>

                        <form onSubmit={handleEmailAuth} className="space-y-4">
                            {mode === "register" && (
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

                        <div className="mt-6 text-center">
                            <button
                                onClick={() => setMode(mode === "login" ? "register" : "login")}
                                className="text-xs text-white/40 transition hover:text-white"
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
