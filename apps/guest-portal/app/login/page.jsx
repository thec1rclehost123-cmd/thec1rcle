"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, ArrowLeft, ArrowRight, Chrome, Loader2, Smartphone } from "lucide-react";
import { useAuth } from "../../components/providers/AuthProvider";
import { useToast } from "../../components/providers/ToastProvider";
import GenderSelector from "../../components/GenderSelector";
import RitualBackground from "../../components/RitualBackground";
import CountrySelect from "../../components/ui/CountrySelect";
import PhoneInput from "../../components/ui/PhoneInput";
import VerifyPanel from "../../components/VerifyPanel";
import AccessGranted from "../../components/ui/AccessGranted";
import { authService } from "../../lib/authService";
import { countries } from "../../lib/data/countries";

const initialForm = {
    email: "",
    password: "",
    name: "",
    gender: "",
    phone: "",
    country: "IN"
};

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <div className="relative h-screen min-h-[600px] bg-black overflow-hidden flex flex-col md:flex-row selection:bg-orange/30 selection:text-white">
                <RitualBackground />
                <LoginForm />
            </div>
        </Suspense>
    );
}

function LoginForm() {
    const { user, loading, login, loginWithGoogle, error: authError } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [form, setForm] = useState(initialForm);
    const [mode, setMode] = useState(searchParams.get("mode") === "register" ? "register" : "login");
    const [step, setStep] = useState(1);
    const [status, setStatus] = useState({ type: "", message: "" });
    const [submitting, setSubmitting] = useState(false);
    const [emailVerified, setEmailVerified] = useState(false);
    const [phoneVerified, setPhoneVerified] = useState(false);

    const redirectUrl = useMemo(() => searchParams.get("next") || "/profile", [searchParams]);

    // Cleanup phone and email
    const cleanForm = useMemo(() => ({
        ...form,
        email: form.email.toLowerCase().trim(),
        phone: `${countries.find(c => c.code === form.country)?.dialCode}${form.phone.trim()}`
    }), [form]);

    useEffect(() => {
        if (user && !loading && step !== 6) {
            router.replace(`/auth/callback?returnUrl=${encodeURIComponent(redirectUrl)}`);
        }
    }, [user, loading, router, redirectUrl, step]);

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

    const nextStep = async () => {
        setStatus({ type: "", message: "" });
        if (mode === "login") {
            if (step === 1 && form.email) setStep(2);
            else if (step === 2 && form.password) handleLogin();
        } else {
            if (step === 1) {
                if (form.email && form.phone) setStep(2);
                else setStatus({ type: "error", message: "Identification required." });
            }
            else if (step === 2 && form.password) setStep(3);
            else if (step === 3 && form.name) setStep(4);
            else if (step === 4 && form.gender) handleStartRegistration();
        }
    };

    const prevStep = () => {
        if (step > 1 && step < 6) setStep(step - 1);
        else router.back();
    };

    const handleLogin = async () => {
        setSubmitting(true);
        try {
            await login(cleanForm.email, form.password, true);
        } catch (err) {
            setStatus({ type: "error", message: err.message });
            setSubmitting(false);
        }
    };

    const handleStartRegistration = async () => {
        setSubmitting(true);
        setStatus({ type: "", message: "" });
        try {
            await authService.sendOtp("email", cleanForm.email);
            await authService.sendOtp("phone", cleanForm.phone);
            setStep(5);
        } catch (err) {
            setStatus({ type: "error", message: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const handleVerify = async (type, code) => {
        if (type === "final") {
            return handleFinalizeRegistration();
        }

        try {
            const recipient = type === "email" ? cleanForm.email : cleanForm.phone;
            const success = await authService.verifyOtp(type, recipient, code);
            if (success) {
                if (type === "email") setEmailVerified(true);
                else setPhoneVerified(true);
                return true;
            }
        } catch (err) {
            throw err;
        }
        return false;
    };

    const handleResend = async (type) => {
        try {
            const recipient = type === "email" ? cleanForm.email : cleanForm.phone;
            await authService.sendOtp(type, recipient);
            toast?.({ title: "Secret Dispatched", description: "Check your devices." });
        } catch (err) {
            toast?.({ title: "Resend Failed", description: err.message, variant: "destructive" });
        }
    };

    const handleFinalizeRegistration = async () => {
        setSubmitting(true);
        try {
            await authService.finalizeSignup({
                ...cleanForm,
                password: form.password,
                name: form.name.trim(),
                gender: form.gender
            });
            // Login manually after creation to establish session
            await login(cleanForm.email, form.password, true);
            setStep(6);
        } catch (err) {
            setStatus({ type: "error", message: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const totalSteps = mode === "login" ? 2 : 4; // Step 5 and 6 are verify and success

    return (
        <div className="flex flex-col md:flex-row w-full h-full min-h-screen">
            {/* Cinematic Left Panel (Desktop only) */}
            <div className="hidden md:flex md:w-1/2 lg:w-3/5 h-full relative overflow-hidden bg-[#050505] items-center justify-center p-20 flex-col">
                <div className="absolute inset-0 bg-gradient-to-tr from-orange/20 via-transparent to-gold/10 opacity-30" />
                <div
                    className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E")` }}
                />

                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    className="relative z-10 max-w-xl space-y-8"
                >
                    <div className="h-20 w-20 overflow-hidden rounded-3xl border border-orange/40 mb-12 shadow-[0_0_40px_rgba(255,165,0,0.2)]">
                        <img src="/logo-circle.jpg" alt="Logo" className="h-full w-full object-cover" />
                    </div>
                    <h2 className="text-7xl font-black uppercase tracking-tighter leading-[0.8] text-white">
                        Enter the <br /> <span className="text-orange">Sanctuary.</span>
                    </h2>
                    <p className="text-sm font-medium text-white/40 uppercase tracking-[0.4em] leading-relaxed max-w-md">
                        A curated collective for those who seek depth, ritual, and the extraordinary.
                    </p>
                </motion.div>

                {/* Decorative Elements */}
                <div className="absolute bottom-20 left-20 flex gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-0.5 w-12 bg-white/10 overflow-hidden">
                            <motion.div
                                className="h-full bg-orange/40"
                                animate={{ x: ["-100%", "100%"] }}
                                transition={{ duration: 3, repeat: Infinity, delay: i * 0.5, ease: "easeInOut" }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Panel / Form Content */}
            <div className="flex-1 flex flex-col justify-center items-center px-4 md:px-12 relative z-10 w-full h-full min-h-screen bg-black/50 md:bg-transparent backdrop-blur-xl md:backdrop-blur-none">
                {/* Fixed Header */}
                <header className="absolute top-8 left-8 right-8 flex justify-between items-center z-50">
                    <button
                        onClick={prevStep}
                        className="h-10 w-10 flex items-center justify-center rounded-full border border-white/5 bg-white/[0.02] backdrop-blur-xl hover:border-orange/50 transition-colors group"
                    >
                        <ArrowLeft className="h-5 w-5 text-white/40 group-hover:text-orange transition-colors" />
                    </button>
                    <Link href="/" className="md:hidden flex items-center gap-3">
                        <div className="h-8 w-8 overflow-hidden rounded-full border border-orange/40">
                            <img src="/logo-circle.jpg" alt="Logo" className="h-full w-full object-cover" />
                        </div>
                        <span className="font-heading text-[10px] font-black uppercase tracking-widest text-white">THE C1RCLE</span>
                    </Link>
                </header>

                <div className="w-full max-w-[420px] py-12">
                    {step < 5 && (
                        <div className="mb-10 text-center md:text-left">
                            <motion.div
                                key={mode + step}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-4"
                            >
                                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-orange">
                                    {mode === "login" ? "Identity Authorization" : "Initiate Onboarding"}
                                </p>
                                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter leading-[0.8] text-white">
                                    {mode === "login" ? (
                                        step === 1 ? <>Enter your <br /><span className="text-orange">Access Key</span></> : <>Verify your <br /><span className="text-orange">Secret.</span></>
                                    ) : (
                                        step === 1 ? <>Identity <br /><span className="text-orange">Vault.</span></> :
                                            step === 2 ? <>Secure your <br /><span className="text-orange">Passcode.</span></> :
                                                step === 3 ? <>Declare your <br /><span className="text-orange">Alias.</span></> :
                                                    <>Select your <br /><span className="text-orange">Essence.</span></>
                                    )}
                                </h1>
                            </motion.div>
                        </div>
                    )}

                    <div className="relative">
                        <AnimatePresence mode="wait">
                            {step < 5 ? (
                                <motion.div
                                    key="form"
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="relative glass-panel bg-white/[0.02] border border-white/10 backdrop-blur-2xl rounded-[40px] p-8 md:p-10 shadow-2xl overflow-hidden"
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

                                                        {mode === "register" && (
                                                            <div className="space-y-6 pt-4 border-t border-white/5">
                                                                <CountrySelect
                                                                    value={form.country}
                                                                    onChange={(val) => setForm(prev => ({ ...prev, country: val }))}
                                                                />
                                                                <PhoneInput
                                                                    value={form.phone}
                                                                    onChange={(val) => setForm(prev => ({ ...prev, phone: val }))}
                                                                    countryCode={form.country}
                                                                    onCountryChange={(val) => setForm(prev => ({ ...prev, country: val }))}
                                                                    errorText={status.type === "error" && status.message.includes("phone") ? status.message : ""}
                                                                />
                                                            </div>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={loginWithGoogle}
                                                            disabled={submitting}
                                                            className="w-full group flex items-center justify-center gap-3 py-4 bg-white/[0.03] rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] text-white/30 hover:bg-white hover:text-black transition-all"
                                                        >
                                                            <Chrome className="w-4 h-4" />
                                                            Google Fast-Access
                                                        </button>
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
                                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2 block">Legal Identity (Alias)</label>
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
                                                    <div className="space-y-4">
                                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 block">Select Essence</label>
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
                                                className="text-[10px] font-bold text-orange text-center md:text-left uppercase tracking-widest"
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

                                    {/* Progress Dots */}
                                    <div className="mt-8 flex justify-center md:justify-start gap-3">
                                        {Array.from({ length: totalSteps }).map((_, i) => (
                                            <div
                                                key={i}
                                                className={`h-0.5 transition-all duration-500 rounded-full ${i + 1 === step ? "w-8 bg-orange shadow-[0_0_10px_rgba(255,165,0,0.5)]" : "w-2 bg-white/10"}`}
                                            />
                                        ))}
                                    </div>
                                </motion.div>
                            ) : step === 5 ? (
                                <motion.div
                                    key="verify"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="w-full flex justify-center"
                                >
                                    <VerifyPanel
                                        email={cleanForm.email}
                                        phone={cleanForm.phone}
                                        onVerify={handleVerify}
                                        onResend={handleResend}
                                        onEdit={() => setStep(1)}
                                        loading={submitting}
                                        error={status.message}
                                    />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="granted"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="w-full flex justify-center"
                                >
                                    <AccessGranted />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {step < 5 && (
                        <div className="mt-12 text-center md:text-left">
                            <button
                                onClick={toggleMode}
                                className="text-[11px] font-black uppercase tracking-[0.4em] text-white/20 hover:text-orange transition-colors"
                            >
                                {mode === "login" ? "No Identity? Signup" : "Already Identified? Access"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
