"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, ArrowLeft, ArrowRight, Chrome, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useAuth } from "../../components/providers/AuthProvider";
import { useToast } from "../../components/providers/ToastProvider";
import GenderSelector from "../../components/GenderSelector";
import RitualBackground from "../../components/RitualBackground";

const initialForm = { email: "", password: "", name: "", gender: "" };

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <div className="relative h-screen min-h-[600px] bg-black overflow-hidden flex flex-col selection:bg-orange/30 selection:text-white">
                <RitualBackground />
                <LoginForm />
            </div>
        </Suspense>
    );
}

function LoginForm() {
    const { user, loading, login, register, loginWithGoogle, error: authError } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [form, setForm] = useState(initialForm);
    const [mode, setMode] = useState(searchParams.get("mode") === "register" ? "register" : "login");
    const [step, setStep] = useState(1);
    const [status, setStatus] = useState({ type: "", message: "" });
    const [submitting, setSubmitting] = useState(false);

    const redirectUrl = useMemo(() => searchParams.get("next") || "/profile", [searchParams]);

    useEffect(() => {
        if (user && !loading) {
            router.replace(`/auth/callback?returnUrl=${encodeURIComponent(redirectUrl)}`);
        }
    }, [user, loading, router, redirectUrl]);

    useEffect(() => {
        if (authError) {
            setStatus({ type: "error", message: authError });
        }
    }, [authError]);

    const handleChange = (field) => (event) => {
        setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

    const toggleMode = () => {
        setMode((prev) => (prev === "login" ? "register" : "login"));
        setStep(1);
        setForm(initialForm);
        setStatus({ type: "", message: "" });
    };

    const nextStep = () => {
        if (mode === "login") {
            if (step === 1 && form.email) setStep(2);
            else if (step === 2 && form.password) handleSubmit();
        } else {
            if (step === 1 && form.email) setStep(2);
            else if (step === 2 && form.password) setStep(3);
            else if (step === 3 && form.name) setStep(4);
            else if (step === 4 && form.gender) handleSubmit();
        }
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
        else router.back();
    };

    const handleGoogleLogin = async () => {
        setSubmitting(true);
        setStatus({ type: "", message: "" });
        try {
            await loginWithGoogle();
        } catch (err) {
            setStatus({ type: "error", message: err.message });
            setSubmitting(false);
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        setStatus({ type: "", message: "" });
        try {
            if (mode === "login") {
                await login(form.email, form.password, true);
            } else {
                await register(form.email, form.password, form.name.trim(), form.gender);
            }
        } catch (submitError) {
            setStatus({
                type: "error",
                message: submitError?.message || `Unable to ${mode === "login" ? "log in" : "create account"}`
            });
            setSubmitting(false);
        }
    };

    const totalSteps = mode === "login" ? 2 : 4;

    return (
        <div className="flex-1 flex flex-col justify-center items-center px-4 relative z-10 w-full max-w-[1200px] mx-auto">
            {/* Minimal Header */}
            <header className="absolute top-8 left-8 right-8 flex justify-between items-center pointer-events-none">
                <div className="flex items-center gap-4 pointer-events-auto cursor-pointer group" onClick={prevStep}>
                    <div className="h-10 w-10 flex items-center justify-center rounded-full border border-white/10 bg-white/5 backdrop-blur-xl group-hover:border-orange/50 transition-colors">
                        <ArrowLeft className="h-5 w-5 text-white/60 group-hover:text-orange transition-colors" />
                    </div>
                </div>
                <Link href="/" className="pointer-events-auto flex items-center gap-3">
                    <div className="h-8 w-8 overflow-hidden rounded-full border border-orange/40">
                        <img src="/logo-circle.jpg" alt="Logo" className="h-full w-full object-cover" />
                    </div>
                    <span className="font-heading text-xs font-black uppercase tracking-widest text-white">
                        THE C1RCLE
                    </span>
                </Link>
            </header>

            <div className="w-full max-w-[420px]">
                {/* Step Metadata */}
                <div className="mb-10 text-center">
                    <motion.div
                        key={mode + step}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-orange">
                            {mode === "login" ? "Identity Authorization" : "Initiate Onboarding"}
                        </p>
                        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-[0.8] text-white">
                            {mode === "login" ? (
                                step === 1 ? <>Enter your <br /><span className="text-orange">Access Key</span></> : <>Verify your <br /><span className="text-orange">Secret.</span></>
                            ) : (
                                step === 1 ? <>Begin your <br /><span className="text-orange">Ritual.</span></> :
                                    step === 2 ? <>Secure your <br /><span className="text-orange">Passcode.</span></> :
                                        step === 3 ? <>Declare your <br /><span className="text-orange">Alias.</span></> :
                                            <>Select your <br /><span className="text-orange">Essence.</span></>
                            )}
                        </h1>
                    </motion.div>
                </div>

                <div className="relative">
                    {/* Glass Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            y: [0, -10, 0]
                        }}
                        transition={{
                            opacity: { duration: 0.6 },
                            scale: { duration: 0.6 },
                            y: { duration: 6, repeat: Infinity, ease: "easeInOut" }
                        }}
                        className="relative glass-panel bg-white/[0.03] border border-white/10 backdrop-blur-[120px] rounded-[48px] p-8 md:p-12 shadow-2xl overflow-hidden"
                    >
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                        <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="space-y-8">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={step}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                >
                                    {step === 1 && (
                                        <div className="space-y-6">
                                            <div className="group relative">
                                                <div className="absolute left-0 bottom-0 h-0.5 w-0 bg-orange group-focus-within:w-full transition-all duration-700" />
                                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2 block">Electronic Mail</label>
                                                <input
                                                    type="email"
                                                    autoFocus
                                                    required
                                                    value={form.email}
                                                    onChange={handleChange("email")}
                                                    placeholder="NAME@THEC1RCLE.COM"
                                                    className="w-full bg-transparent border-b border-white/10 py-4 text-sm font-bold tracking-widest text-white placeholder:text-white/10 focus:outline-none"
                                                />
                                            </div>
                                            {step === 1 && (
                                                <button
                                                    type="button"
                                                    onClick={handleGoogleLogin}
                                                    disabled={submitting}
                                                    className="w-full group flex items-center justify-center gap-3 py-4 bg-white/5 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] text-white/40 hover:bg-white hover:text-black transition-all"
                                                >
                                                    <Chrome className="w-4 h-4" />
                                                    Google Fast-Access
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {step === 2 && (
                                        <div className="group relative">
                                            <div className="absolute left-0 bottom-0 h-0.5 w-0 bg-orange group-focus-within:w-full transition-all duration-700" />
                                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2 block">Security Passphrase</label>
                                            <input
                                                type="password"
                                                autoFocus
                                                required
                                                value={form.password}
                                                onChange={handleChange("password")}
                                                placeholder="••••••••"
                                                className="w-full bg-transparent border-b border-white/10 py-4 text-sm font-bold tracking-widest text-white placeholder:text-white/10 focus:outline-none"
                                            />
                                        </div>
                                    )}

                                    {step === 3 && (
                                        <div className="group relative">
                                            <div className="absolute left-0 bottom-0 h-0.5 w-0 bg-orange group-focus-within:w-full transition-all duration-700" />
                                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2 block">Legal Identity</label>
                                            <input
                                                type="text"
                                                autoFocus
                                                required
                                                value={form.name}
                                                onChange={handleChange("name")}
                                                placeholder="YOUR FULL NAME"
                                                className="w-full bg-transparent border-b border-white/10 py-4 text-sm font-bold tracking-widest text-white placeholder:text-white/10 focus:outline-none"
                                            />
                                        </div>
                                    )}

                                    {step === 4 && (
                                        <div>
                                            <GenderSelector
                                                value={form.gender}
                                                onChange={(val) => setForm(prev => ({ ...prev, gender: val }))}
                                                disabled={submitting}
                                            />
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>

                            {status.message && (
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-[10px] font-bold text-orange text-center uppercase tracking-widest"
                                >
                                    {status.message}
                                </motion.p>
                            )}

                            <button
                                type="submit"
                                disabled={submitting}
                                className="group relative w-full h-16 flex items-center justify-center rounded-full bg-white text-black font-black uppercase tracking-[0.5em] text-xs transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 overflow-hidden shadow-[0_20px_40px_rgba(255,165,0,0.15)]"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-orange to-gold opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <span className="relative z-10 flex items-center gap-3 group-hover:text-white transition-colors">
                                    {submitting ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <>
                                            {step === totalSteps ? (mode === "login" ? "Finalize Access" : "Enter the Circle") : "Continue"}
                                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </span>
                            </button>
                        </form>
                    </motion.div>

                    {/* Progress Dots */}
                    <div className="mt-8 flex justify-center gap-3">
                        {Array.from({ length: totalSteps }).map((_, i) => (
                            <div
                                key={i}
                                className={`h-1 transition-all duration-500 rounded-full ${i + 1 === step ? "w-8 bg-orange shadow-[0_0_10px_rgba(255,165,0,0.5)]" : "w-2 bg-white/20"}`}
                            />
                        ))}
                    </div>
                </div>

                <div className="mt-12 text-center">
                    <button
                        onClick={toggleMode}
                        className="text-[11px] font-black uppercase tracking-[0.4em] text-white/30 hover:text-orange transition-colors"
                    >
                        {mode === "login" ? "No Identity? Signup" : "Already Identified? Access"}
                    </button>
                </div>
            </div>
        </div>
    );
}
