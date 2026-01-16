"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getFirebaseAuth } from "../../lib/firebase/client";
import { sendPasswordResetEmail } from "firebase/auth";
import FunnelShell from "../../components/FunnelShell";
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
        <FunnelShell title="Recovery Protocol" showLogo={true} backHref="/login">
            <div className="flex-1 flex flex-col justify-center items-center">
                <div className="w-full max-w-[420px]">
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
                            <div className="glass-panel p-10 rounded-[48px] border border-white/10 bg-white/[0.03] backdrop-blur-3xl shadow-3xl space-y-8">
                                <div className="text-center space-y-4">
                                    <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">Recover <span className="text-orange shadow-orange/30 shadow-2xl">Access.</span></h2>
                                    <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.4em]">Establish link to credentials.</p>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-8">
                                    <div className="group relative">
                                        <div className="absolute left-0 bottom-0 h-0.5 w-0 bg-orange group-focus-within:w-full transition-all duration-700" />
                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2 block">Electronic Mail</label>
                                        <input
                                            type="email"
                                            autoFocus
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="NAME@THEC1RCLE.COM"
                                            className="w-full bg-transparent border-b border-white/10 py-4 text-sm font-bold tracking-widest text-white placeholder:text-white/10 focus:outline-none"
                                        />
                                    </div>

                                    {error && (
                                        <p className="text-[10px] font-black text-orange uppercase tracking-widest text-center animate-pulse">{error}</p>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="group relative w-full h-16 flex items-center justify-center rounded-full bg-white text-black font-black uppercase tracking-[0.4em] text-xs transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 overflow-hidden shadow-2xl"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-orange to-gold opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                        <span className="relative z-10 flex items-center gap-3 group-hover:text-white transition-colors">
                                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                                                <>
                                                    Transmit Reset Link
                                                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                                </>
                                            )}
                                        </span>
                                    </button>
                                </form>

                                <div className="text-center">
                                    <Link href="/login" className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 hover:text-orange transition-colors">
                                        Know your secret? Access
                                    </Link>
                                </div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </FunnelShell>
    );
}
