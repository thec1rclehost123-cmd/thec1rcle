"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getFirebaseAuth } from "../../lib/firebase/client";
import { sendPasswordResetEmail } from "firebase/auth";
import PageShell from "../../components/PageShell";
import { Mail, CheckCircle, ArrowRight, AlertCircle, Loader2 } from "lucide-react";

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
            // Generic error to avoid account enumeration
            setError("Something went wrong. If that account exists, we sent a link.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageShell title="Recovery" showLogo={true} backHref="/login">
            <div className="max-w-md mx-auto py-12">
                <AnimatePresence mode="wait">
                    {success ? (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="glass-panel p-8 rounded-[40px] border border-emerald-500/20 bg-emerald-500/5 text-center space-y-6"
                        >
                            <div className="mx-auto h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                <CheckCircle className="h-10 w-10 text-emerald-500" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black uppercase tracking-tight">Check your inbox</h2>
                                <p className="text-sm text-black/60 dark:text-white/60 font-medium">
                                    A recovery link has been sent to <span className="text-black dark:text-white font-bold">{email}</span>.
                                </p>
                            </div>
                            <div className="pt-4 space-y-4">
                                <Link
                                    href="/login"
                                    className="block w-full h-14 rounded-full bg-black dark:bg-white text-white dark:text-black font-black uppercase tracking-widest flex items-center justify-center transition-transform hover:scale-[1.02]"
                                >
                                    Return to Login
                                </Link>
                                <button
                                    onClick={() => setSuccess(false)}
                                    className="text-[10px] font-black uppercase tracking-[0.3em] text-black/40 dark:text-white/40 hover:text-orange transition-colors"
                                >
                                    Try another email
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-8"
                        >
                            <div className="text-center space-y-2">
                                <h2 className="text-4xl font-black uppercase tracking-tight leading-none">Recover <span className="text-orange">Access.</span></h2>
                                <p className="text-sm text-black/40 dark:text-white/40 font-medium uppercase tracking-widest">Enter your email to reset your circle credentials.</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-widest text-black/60 dark:text-white/60 ml-4 font-bold">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-black/20 dark:text-white/20" />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="alex@thecircle.com"
                                            className="w-full h-14 pl-14 pr-6 rounded-2xl bg-black/[0.03] dark:bg-white/5 border border-black/5 dark:border-white/10 focus:border-orange/50 focus:outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-orange/5 border border-orange/10 text-orange">
                                        <AlertCircle className="h-4 w-4" />
                                        <p className="text-[10px] font-bold uppercase tracking-widest">{error}</p>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="group relative w-full h-16 flex items-center justify-center rounded-full bg-black dark:bg-white text-white dark:text-black font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 overflow-hidden"
                                >
                                    {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                                        <>
                                            Send Recovery Link
                                            <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
                                        </>
                                    )}
                                </button>
                            </form>

                            <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-black/20 dark:text-white/20">
                                Remembered your password? <Link href="/login" className="text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white underline underline-offset-4">Sign in</Link>
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </PageShell>
    );
}
