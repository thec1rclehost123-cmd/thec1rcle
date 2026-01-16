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
            <div className="relative h-screen w-full bg-black overflow-hidden flex flex-col md:flex-row selection:bg-orange/30 selection:text-white">
                <RitualBackground />
                <LoginForm />
            </div>
        </Suspense>
    );
}

function LoginForm() {
    const { user, profile, loading, login, loginWithGoogle, updateUserProfile, error: authError } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [form, setForm] = useState(initialForm);
    const [step, setStep] = useState(1);
    const [status, setStatus] = useState({ type: "", message: "" });
    const [submitting, setSubmitting] = useState(false);
    const [isNewUser, setIsNewUser] = useState(false); // Email/Pass registration flow
    const [isOnboarding, setIsOnboarding] = useState(false); // Google login missing info
    const [emailVerified, setEmailVerified] = useState(false);
    const [phoneVerified, setPhoneVerified] = useState(false);

    const redirectUrl = useMemo(() => searchParams.get("next") || "/profile", [searchParams]);

    const handleGoogleLogin = async () => {
        setSubmitting(true);
        setStatus({ type: "", message: "" });
        try {
            const { user, profile: userProfile } = await loginWithGoogle();

            // Check if profile is complete (needs phone and gender)
            if (!userProfile?.phone || !userProfile?.gender) {
                setIsOnboarding(true);
                setStep(3); // Jump to Phone onboarding
                if (user?.displayName && !form.name) {
                    setForm(prev => ({ ...prev, name: user.displayName }));
                }
            } else {
                toast.success("Welcome back");
                router.push(redirectUrl);
            }
        } catch (err) {
            console.error("Google Auth error:", err);
            setStatus({ type: "error", message: "Failed to sign in with Google." });
        } finally {
            setSubmitting(false);
        }
    };

    // Cleanup phone and email
    const cleanForm = useMemo(() => ({
        ...form,
        email: form.email.toLowerCase().trim(),
        phone: `${countries.find(c => c.code === form.country)?.dialCode}${form.phone.trim()}`
    }), [form]);

    useEffect(() => {
        // Only redirect if NOT in the middle of onboarding
        if (user && !loading && !isNewUser && !isOnboarding && step < 5) {
            router.replace(`/auth/callback?returnUrl=${encodeURIComponent(redirectUrl)}`);
        }
    }, [user, loading, router, redirectUrl, step, isNewUser, isOnboarding]);

    useEffect(() => {
        if (authError && step < 3) {
            setStatus({ type: "error", message: authError });
        }
    }, [authError, step]);

    const handleChange = (field) => (event) => {
        setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

    const nextStep = async () => {
        setStatus({ type: "", message: "" });

        if (step === 1 && form.email) {
            setStep(2);
        } else if (step === 2 && form.password) {
            handleInitialAuth();
        } else if (step === 3 && form.phone) {
            setStep(4);
        } else if (step === 4 && form.name) {
            setStep(5);
        } else if (step === 5 && form.gender) {
            if (isNewUser) handleStartRegistration();
            else handleCompleteOnboarding();
        }
    };

    const handleInitialAuth = async () => {
        setSubmitting(true);
        try {
            await login(cleanForm.email, form.password, true);
            // If we reach here, user exists and logged in. Profile check will happen in useEffect or handled below.
        } catch (err) {
            // Firebase error code for user not found
            if (err.code === 'auth/user-not-found' || err.message.includes('not-found')) {
                setIsNewUser(true);
                setStep(3);
                setStatus({ type: "info", message: "Creating your new account..." });
            } else {
                setStatus({ type: "error", message: err.message });
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleCompleteOnboarding = async () => {
        setSubmitting(true);
        try {
            await updateUserProfile({
                phone: cleanForm.phone,
                gender: form.gender,
                displayName: form.name || user?.displayName || "Member"
            });
            setIsOnboarding(false);
            router.push(redirectUrl);
        } catch (err) {
            setStatus({ type: "error", message: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const prevStep = () => {
        if (step > 1 && step < 6) setStep(step - 1);
        else router.back();
    };

    const handleStartRegistration = async () => {
        setSubmitting(true);
        setStatus({ type: "", message: "" });
        try {
            await authService.sendOtp("email", cleanForm.email);
            await authService.sendOtp("phone", cleanForm.phone);
            setStep(6);
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
            toast?.({ title: "Code sent", description: "Check your devices." });
        } catch (err) {
            toast?.({ title: "Send failed", description: err.message, variant: "destructive" });
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
            setStep(7);
        } catch (err) {
            setStatus({ type: "error", message: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const totalSteps = (isNewUser || isOnboarding) ? 5 : 2;

    return (
        <div className="flex flex-col md:flex-row w-full h-full">
            {/* Cinematic Left Panel (Desktop only) */}
            <div className="hidden md:flex md:w-1/2 lg:w-3/5 h-full relative overflow-hidden bg-[#FF4D22] items-center justify-center p-12 flex-col">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    className="relative z-10 w-full text-center"
                >
                    <h2 className="text-[10vw] font-black uppercase tracking-tight leading-[0.9] text-black text-center">
                        GET IN <br /> THE C1RCLE
                    </h2>
                </motion.div>

                {/* Decorative Bottom Tag or Logo */}
                <div className="absolute bottom-12 flex items-center gap-4 opacity-50">
                    <div className="h-px w-10 bg-black" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-black">Discover Life Offline</span>
                    <div className="h-px w-10 bg-black" />
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

                <div className="w-full max-w-[380px] py-12 flex flex-col gap-8">
                    {step < 6 && (
                        <div className="text-center md:text-left">
                            <motion.div
                                key={step + isNewUser}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-4"
                            >
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-orange mb-3">
                                    {(isNewUser || isOnboarding) ? "Identity" : "Member Access"}
                                </p>
                                <h1 className="text-4xl md:text-5xl lg:text-5xl font-black uppercase tracking-tighter leading-[0.9] text-white">
                                    {step === 1 ? <>What's your <br /><span className="text-orange">Email?</span></> :
                                        step === 2 ? <>And your <br /><span className="text-orange">Password?</span></> :
                                            step === 3 ? <>Verify your <br /><span className="text-orange">Phone.</span></> :
                                                step === 4 ? <>What's your <br /><span className="text-orange">Name?</span></> :
                                                    <>Almost <br /><span className="text-orange">Done.</span></>}
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
                                    className="relative glass-panel bg-white/[0.03] border border-white/10 backdrop-blur-2xl rounded-[32px] p-8 md:p-8 shadow-2xl overflow-hidden"
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
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70 block">Email address</label>
                                                            <input
                                                                type="email"
                                                                autoFocus
                                                                required
                                                                value={form.email}
                                                                onChange={handleChange("email")}
                                                                placeholder="NAME@EMAIL.COM"
                                                                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold tracking-widest text-white placeholder:text-white/40 focus:outline-none focus:border-orange/50 transition-all"
                                                            />
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={handleGoogleLogin}
                                                            disabled={submitting}
                                                            className="w-full relative group h-12 rounded-xl bg-white text-black font-black uppercase tracking-[0.3em] text-[10px] transition-all flex items-center justify-center shadow-lg overflow-hidden hover:shadow-[0_0_20px_rgba(255,107,0,0.15)] hover:scale-[1.01] active:scale-[0.99] border border-white/10"
                                                        >
                                                            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-orange/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                                            <div className="flex items-center gap-3 px-6 relative z-10">
                                                                {submitting ? (
                                                                    <Loader2 className="animate-spin" size={16} />
                                                                ) : (
                                                                    <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                                                    </div>
                                                )}

                                                {step === 2 && (
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70 block">Password</label>
                                                        <input
                                                            type="password"
                                                            autoFocus
                                                            required
                                                            value={form.password}
                                                            onChange={handleChange("password")}
                                                            placeholder="••••••••"
                                                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold tracking-widest text-white placeholder:text-white/40 focus:outline-none focus:border-orange/50 transition-all"
                                                        />
                                                    </div>
                                                )}

                                                {(isNewUser || isOnboarding) && step === 3 && (
                                                    <div className="space-y-6 pt-4">
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

                                                {(isNewUser || isOnboarding) && step === 4 && (
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70 block">What's your full name?</label>
                                                        <input
                                                            type="text"
                                                            autoFocus
                                                            required
                                                            value={form.name}
                                                            onChange={handleChange("name")}
                                                            placeholder="YOUR NAME"
                                                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold tracking-widest text-white placeholder:text-white/40 focus:outline-none focus:border-orange/50 transition-all"
                                                        />
                                                    </div>
                                                )}

                                                {(isNewUser || isOnboarding) && step === 5 && (
                                                    <div className="space-y-4">
                                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70 block">How do you identify?</label>
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
                                                className="text-[10px] font-black text-orange text-center md:text-left uppercase tracking-[0.2em] bg-orange/5 py-4 px-6 rounded-2xl border border-orange/20"
                                            >
                                                {status.message}
                                            </motion.p>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="group relative w-full h-12 flex items-center justify-center rounded-xl bg-white text-black font-black uppercase tracking-[0.4em] text-[10px] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 overflow-hidden shadow-lg"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-orange to-gold opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                            <span className="relative z-10 flex items-center gap-3 group-hover:text-white transition-colors">
                                                {submitting ? (
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                ) : (
                                                    <>
                                                        {step === totalSteps ? "Finish" : "Continue"}
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
                                                className={`h-1 transition-all duration-500 rounded-full ${i + 1 === step ? "w-8 bg-orange" : "w-1.5 bg-white/10"}`}
                                            />
                                        ))}
                                    </div>
                                </motion.div>
                            ) : step === 6 ? (
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

                    {/* Footer Toggle Link Removed */}
                </div>
            </div>
        </div >
    );
}
