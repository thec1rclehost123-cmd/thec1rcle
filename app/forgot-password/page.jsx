"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { getFirebaseAuth } from "../../lib/firebase/client";
import { sendPasswordResetEmail } from "firebase/auth";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!email) {
            setError("Please enter your email address");
            return;
        }

        setLoading(true);
        setError("");
        setSuccess(false);

        try {
            const auth = getFirebaseAuth();
            await sendPasswordResetEmail(auth, email);
            setSuccess(true);
        } catch (err) {
            console.error("Password reset error:", err);
            if (err.code === "auth/user-not-found") {
                setError("No account found with this email address");
            } else if (err.code === "auth/invalid-email") {
                setError("Invalid email address");
            } else if (err.code === "auth/too-many-requests") {
                setError("Too many requests. Please try again later");
            } else {
                setError("Failed to send reset email. Please try again");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="glass-panel rounded-[32px] border border-white/10 bg-black/60 p-8 shadow-glow">
                    <div className="mb-8 text-center">
                        <Link href="/" className="inline-flex items-center gap-2 mb-6">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-gold/20 via-gold-dark/10 to-transparent border border-gold/20">
                                <span className="text-sm font-bold bg-gradient-to-br from-gold to-gold-dark bg-clip-text text-transparent">C1</span>
                            </div>
                            <span className="text-sm font-bold tracking-widest uppercase text-white/90">The C1rcle</span>
                        </Link>
                        <h1 className="mt-6 text-2xl font-heading font-bold uppercase tracking-widest text-white">
                            Reset Password
                        </h1>
                        <p className="mt-3 text-sm text-white/60">
                            Enter your email and we'll send you a reset link
                        </p>
                    </div>

                    {success ? (
                        <div className="space-y-6 text-center">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/40">
                                <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">Check your email</h2>
                                <p className="mt-2 text-sm text-white/60">
                                    We've sent a password reset link to <span className="text-white">{email}</span>
                                </p>
                                <p className="mt-4 text-xs text-white/40">
                                    Didn't receive the email? Check your spam folder or try again in a few minutes.
                                </p>
                            </div>
                            <div className="flex flex-col gap-3">
                                <Link
                                    href="/login"
                                    className="w-full rounded-full bg-white px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-black transition hover:bg-white/90"
                                >
                                    Back to Login
                                </Link>
                                <button
                                    onClick={() => {
                                        setSuccess(false);
                                        setEmail("");
                                    }}
                                    className="w-full rounded-full border border-white/20 px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white/80 transition hover:border-white/60"
                                >
                                    Send Again
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/60">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/20 focus:border-white/30 focus:outline-none focus:ring-0"
                                    placeholder="your@email.com"
                                    required
                                />
                            </div>

                            {error && (
                                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full rounded-full bg-white px-6 py-4 text-xs font-bold uppercase tracking-[0.2em] text-black transition hover:bg-white/90 disabled:opacity-50"
                            >
                                {loading ? "Sending..." : "Send Reset Link"}
                            </button>

                            <div className="text-center">
                                <Link
                                    href="/login"
                                    className="text-xs text-white/60 hover:text-white transition-colors"
                                >
                                    Back to Login
                                </Link>
                            </div>
                        </form>
                    )}
                </div>

                <p className="mt-6 text-center text-xs text-white/40">
                    New to The C1rcle?{" "}
                    <Link href="/register" className="text-white/80 hover:text-white transition-colors font-semibold">
                        Create an account
                    </Link>
                </p>
            </motion.div>
        </main>
    );
}
