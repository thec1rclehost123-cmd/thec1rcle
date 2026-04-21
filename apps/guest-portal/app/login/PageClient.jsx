"use client";

import { useEffect, useMemo, useState, useRef, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "../../components/providers/AuthProvider";
import { useToast } from "../../components/providers/ToastProvider";
import GenderSelector from "../../components/GenderSelector";
import dynamic from "next/dynamic";
const RitualBackground = dynamic(() => import("../../components/RitualBackground"), { ssr: false });
import CountrySelect from "../../components/ui/CountrySelect";
import PhoneInput from "../../components/ui/PhoneInput";
import VerifyPanel from "../../components/VerifyPanel";
import { authService } from "../../lib/authService";
import { buildAuthCallbackUrl, buildLoginUrl, buildSignupUrl, getReturnUrl } from "../../lib/auth/guestRouteAccess";
import { countries } from "../../lib/data/countries";

const CITIES = ["Mumbai", "Pune", "Bengaluru", "Goa"];

const SESSION_KEYS = {
    step: "c1_auth_step",
    form: "c1_auth_form",
    isNewUser: "c1_auth_isNewUser",
    isOnboarding: "c1_auth_isOnboarding"
};

function readSession(key, fallback) {
    if (typeof window === "undefined") return fallback;
    try {
        const val = sessionStorage.getItem(key);
        return val !== null ? val : fallback;
    } catch {
        return fallback;
    }
}

function clearSessionPersistence() {
    Object.values(SESSION_KEYS).forEach(k => {
        try { sessionStorage.removeItem(k); } catch { /* noop */ }
    });
}

function getPersistedForm(form) {
    return {
        ...form,
        password: "",
    };
}

function getLoginErrorMessage(error) {
    switch (error?.code) {
        case "auth/operation-not-allowed":
            return "Google sign-in is not enabled for this Firebase project.";
        case "auth/unauthorized-domain":
            return "This domain is not authorized for Google sign-in.";
        case "auth/invalid-credential":
        case "auth/wrong-password":
            return "Incorrect email or password.";
        case "auth/user-not-found":
            return "No account found for this email.";
        case "auth/too-many-requests":
            return "Too many login attempts. Please try again later.";
        case "auth/network-request-failed":
            return "Network error. Check your connection and try again.";
        default:
            return error?.message || "Unable to sign in right now.";
    }
}

const baseForm = {
    email: "",
    password: "",
    name: "",
    age: "",
    gender: "",
    phone: "",
    country: "IN",
    city: ""
};

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <div className="relative min-h-screen w-full bg-black overflow-x-hidden overflow-y-auto md:overflow-hidden flex flex-col md:flex-row selection:bg-orange/30 selection:text-white">
                <RitualBackground />
                <LoginForm />
            </div>
        </Suspense>
    );
}

function LoginForm() {
    const { user, loading, login, register, loginWithGoogle, updateUserProfile, error: authError } = useAuth();
    const { toast } = useToast();
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const forceOnboarding = searchParams.get("onboarding") === "1";
    const forceSignup = pathname === "/signup" || searchParams.get("mode") === "signup" || searchParams.get("mode") === "register";

    const [isLoginMode, setIsLoginMode] = useState(() => !forceOnboarding && !forceSignup); // Toggle between traditional Login vs Signup

    // ── Restore from sessionStorage on mount ──────────────────────────────
    const [form, setForm] = useState(() => {
        const saved = readSession(SESSION_KEYS.form, null);
        if (saved) {
            try { return { ...baseForm, ...JSON.parse(saved), password: "" }; } catch { /* noop */ }
        }
        return baseForm;
    });
    const [step, setStep] = useState(() => {
        const s = parseInt(readSession(SESSION_KEYS.step, "1"), 10);
        if (forceOnboarding) {
            if (isNaN(s) || s < 3) return 3;
            return s;
        }
        return isNaN(s) ? 1 : s;
    });
    const [isNewUser, setIsNewUser] = useState(
        () => readSession(SESSION_KEYS.isNewUser, "false") === "true"
    );
    const [isOnboarding, setIsOnboarding] = useState(
        () => forceOnboarding || readSession(SESSION_KEYS.isOnboarding, "false") === "true"
    );

    const [status, setStatus] = useState({ type: "", message: "" });
    const [mounted, setMounted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [phoneVerified, setPhoneVerified] = useState(false);
    const formRef = useRef(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const redirectUrl = useMemo(() => getReturnUrl(searchParams), [searchParams]);

    useEffect(() => {
        if (!forceOnboarding) return;
        setIsLoginMode(false);
        setIsNewUser(false);
        setIsOnboarding(true);
        setStep((current) => (current < 3 ? 3 : current));
    }, [forceOnboarding]);

    useEffect(() => {
        if (forceOnboarding || !forceSignup) return;
        setIsLoginMode(false);
    }, [forceOnboarding, forceSignup]);

    // ── Persist step/form/flags to sessionStorage ─────────────────────────
    useEffect(() => {
        if (step > 2 && (isNewUser || isOnboarding)) {
            try {
                sessionStorage.setItem(SESSION_KEYS.step, String(step));
                sessionStorage.setItem(SESSION_KEYS.isNewUser, String(isNewUser));
                sessionStorage.setItem(SESSION_KEYS.isOnboarding, String(isOnboarding));
                sessionStorage.setItem(SESSION_KEYS.form, JSON.stringify(getPersistedForm(form)));
            } catch { /* noop */ }
        }
    }, [step, form, isNewUser, isOnboarding]);

    // ── Redirect already-logged-in users (not mid-onboarding) ─────────────
    useEffect(() => {
        if (user && !loading && !isNewUser && !isOnboarding && step < 7) {
            router.replace(buildAuthCallbackUrl(redirectUrl));
        }
    }, [user, loading, router, redirectUrl, step, isNewUser, isOnboarding]);

    useEffect(() => {
        if (authError && step < 3) {
            setStatus({ type: "error", message: authError });
        }
    }, [authError, step]);

    // ── Computed values ───────────────────────────────────────────────────
    const cleanForm = useMemo(() => ({
        ...form,
        email: form.email.toLowerCase().trim(),
        phone: `${countries.find(c => c.code === form.country)?.dialCode || ""}${form.phone.trim().replace(/^0+/, "")}`
    }), [form]);

    const handleChange = (field) => (event) => {
        setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

    // ── Google Login ──────────────────────────────────────────────────────
    const handleGoogleLogin = async () => {
        setSubmitting(true);
        setStatus({ type: "", message: "" });
        try {
            const { user: googleUser, profile: googleProfile } = await loginWithGoogle();

            if (googleProfile?.onboardingComplete !== true) {
                setIsLoginMode(false);
                setIsOnboarding(true);
                setStep(3);
                if (googleUser?.displayName && !form.name) {
                    setForm(prev => ({ ...prev, name: googleUser.displayName }));
                }
            } else {
                toast.success("Welcome back");
                router.push(redirectUrl);
            }
        } catch (err) {
            console.error("Google Auth error:", err);
            setStatus({ type: "error", message: getLoginErrorMessage(err) });
        } finally {
            setSubmitting(false);
        }
    };

    const toggleMode = () => {
        setStatus({ type: "", message: "" });
        clearSessionPersistence();
        if (isLoginMode) {
            router.push(buildSignupUrl(redirectUrl));
            return;
        }
        router.push(buildLoginUrl(redirectUrl));
    };
    // ── Email / Password Auth ─────────────────────────────────────────────
    const handleInitialAuth = async () => {
        setSubmitting(true);
        try {
            const { profile: loadedProfile } = await login(cleanForm.email, form.password, true);
            // Existing user who never finished onboarding → force them through
            if (loadedProfile?.onboardingComplete !== true) {
                setIsLoginMode(false);
                setIsNewUser(false);
                setIsOnboarding(true);
                setStep(3);
            }
            // Otherwise the redirect useEffect handles navigation
        } catch (err) {
            if (err?.code === "auth/user-not-found") {
                setIsLoginMode(false);
                setIsNewUser(true);
                setStep(3);
                setStatus({ type: "info", message: "Creating your new account..." });
            } else {
                setStatus({ type: "error", message: getLoginErrorMessage(err) });
            }
        } finally {
            setSubmitting(false);
        }
    };

    // ── Step navigation ───────────────────────────────────────────────────
    const nextStep = async () => {
        setStatus({ type: "", message: "" });

        if (step === 1 && form.email && form.password && !isLoginMode) {
            setIsNewUser(true);
            setStep(3);
            return;
        }

        if (step === 1 && form.email && form.password && isLoginMode) {
            setSubmitting(true);
            try {
                const res = await fetch("/api/auth/check", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: form.email })
                });
                const data = await res.json();
                
                if (data.exists) {
                    setIsLoginMode(true);
                    // Since they already typed the password, attempt immediate login
                    return handleInitialAuth();
                } else {
                    setIsLoginMode(false);
                    setIsNewUser(true);
                    setStep(3); // Skip step 2 as requested, move to Phone
                    return;
                }
            } catch (err) {
                console.error("Check protocol failed:", err);
                // Fallback to mode-specific behavior
                if (isLoginMode) return handleInitialAuth();
                setStep(3);
            } finally {
                setSubmitting(false);
            }
            return;
        }

        if (isLoginMode) {
            // Should not be reachable on step 1 due to the logic above
            return;
        }

        if (step === 3 && form.phone) {
            setStep(4);
        } else if (step === 4 && form.name) {
            setStep(5);
        } else if (step === 5 && form.age) {
            setStep(6);
        } else if (step === 6 && form.gender) {
            setStep(7);
        } else if (step === 7 && form.city) {
            if (isNewUser) handleStartRegistration();
            else handleCompleteOnboarding(form.city);
        }
    };

    const prevStep = () => {
        if (step === 1) {
            router.back();
            return;
        }
        const next = (step === 3) ? 1 : step - 1;
        setStep(next);
        try { sessionStorage.setItem(SESSION_KEYS.step, String(next)); } catch { /* noop */ }
    };

    // ── Registration flow ─────────────────────────────────────────────────
    const handleStartRegistration = async () => {
        console.log(`[AUTH-TRACE] handleStartRegistration triggered. Password length: ${form.password?.length || 0}`);
        setSubmitting(true);
        setStatus({ type: "", message: "" });
        try {
            if (!form.password || form.password.length < 6) {
                throw new Error("Password lost in ritual. Please go back to step 1 and re-enter.");
            }
            await authService.sendOtp("phone", cleanForm.phone);
            setStep(8); // push OTP to step 8
        } catch (err) {
            setStatus({ type: "error", message: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const handleFinalizeRegistration = async () => {
        console.log(`[AUTH-TRACE] handleFinalizeRegistration triggered. Password length: ${form.password?.length || 0}`);
        setSubmitting(true);
        if (!form.password || form.password.length < 8) {
            setStatus({ type: "error", message: "Security ritual requires at least 8 characters for your password. Please go back to step 1." });
            setSubmitting(false);
            return;
        }

        try {
            await register(cleanForm.email, form.password, {
                displayName: form.name.trim(),
                age: parseInt(form.age, 10),
                gender: form.gender,
                phone: cleanForm.phone,
                city: form.city,
                onboardingComplete: true
            });
            clearSessionPersistence();
            router.push("/");
        } catch (err) {
            setStatus({ type: "error", message: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    // ── Google onboarding completion ──────────────────────────────────────
    const handleCompleteOnboarding = async (cityOverride) => {
        setSubmitting(true);
        try {
            await updateUserProfile({
                phone: cleanForm.phone,
                gender: form.gender,
                age: form.age,
                displayName: form.name || user?.displayName || "Member",
                city: cityOverride ?? form.city,
                onboardingComplete: true
            });
            clearSessionPersistence();
            setIsOnboarding(false);
            router.push(redirectUrl);
        } catch (err) {
            setStatus({ type: "error", message: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    // ── City auto-transition ──────────────────────────────────────────────────
    const handleCitySelect = (city) => {
        setForm(prev => ({ ...prev, city }));
        if (isOnboarding) {
            setTimeout(() => handleCompleteOnboarding(city), 150);
            return;
        }
        if (isNewUser) {
            setTimeout(() => handleStartRegistration(), 150);
        }
    };

    // ── OTP verify / resend ───────────────────────────────────────────────
    const handleVerify = async (type, code) => {
        if (type === "final") return handleFinalizeRegistration();

        const success = await authService.verifyOtp("phone", cleanForm.phone, code);
        if (success) {
            setPhoneVerified(true);
            return true;
        }
        return false;
    };

    const handleResend = async (type) => {
        try {
            const recipient = type === "phone" ? cleanForm.phone : cleanForm.email;
            await authService.sendOtp(type, recipient);
            toast?.({ title: "Code sent", description: "Check your phone." });
        } catch (err) {
            toast?.({ title: "Send failed", description: err.message, variant: "destructive" });
        }
    };

    // ── UI helpers ────────────────────────────────────────────────────────
    const totalSteps = 7;
    const currentProgressStep = isLoginMode ? 1 : Math.min(step - 1, totalSteps);
    const headingEyebrow = step >= 3 ? "Identity" : (isLoginMode ? "Member Access" : "Create Account");
    const primaryActionLabel = step === 1 ? "Continue" : "Continue";
    const googleCtaLabel = step === 1 ? "Continue with Google" : "Use Google";

    const stepHeading = () => {
        if (step === 1) return <>{isLoginMode ? "Welcome" : "Join the"} <br /><span className="text-orange">{isLoginMode ? "Back." : "Circle."}</span></>;
        if (step === 3) return <>Your <br /><span className="text-orange">Phone?</span></>;
        if (step === 4) return <>What's your <br /><span className="text-orange">Name?</span></>;
        if (step === 5) return <>What's your <br /><span className="text-orange">Age?</span></>;
        if (step === 6) return <>How do you <br /><span className="text-orange">Identify?</span></>;
        if (step === 7) return <>Your <br /><span className="text-orange">City?</span></>;
        if (step === 8) return <>Verify your <br /><span className="text-orange">Phone.</span></>;
        return <>Final <br /><span className="text-orange">Step.</span></>;
    };

    if (!mounted) {
        return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-orange" /></div>;
    }

    return (
        <div className="flex flex-col md:flex-row w-full h-full relative">
            <header className="fixed top-8 left-8 right-8 flex justify-between items-center z-[100]">
                <button
                    onClick={prevStep}
                    className="h-10 w-10 flex items-center justify-center rounded-full border border-white/20 bg-white/5 backdrop-blur-2xl hover:border-orange hover:bg-white/10 transition-all group"
                >
                    <ArrowLeft size={18} className="text-white group-hover:text-orange transition-colors" />
                </button>
            </header>

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
                <div className="absolute bottom-12 flex items-center gap-4 opacity-50">
                    <div className="h-px w-10 bg-black" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-black">Discover Life Offline</span>
                    <div className="h-px w-10 bg-black" />
                </div>
            </div>

            {/* Right Panel / Form */}
            <div className="flex-1 flex flex-col justify-start md:justify-center items-center px-4 md:px-12 relative z-10 w-full min-h-screen bg-black/50 md:bg-transparent backdrop-blur-xl md:backdrop-blur-none">
                <div className="mx-auto flex w-full max-w-[380px] flex-col gap-8 pt-24 pb-10 md:py-12">
                    {/* Step heading — hidden during success screen */}
                    {step < 9 && (
                        <div className="text-center md:text-left">
                            <motion.div
                                key={`${step}-${isLoginMode}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-4"
                            >
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-orange mb-3">
                                    {headingEyebrow}
                                </p>
                                <h1 className="text-4xl md:text-5xl lg:text-5xl font-black uppercase tracking-tighter leading-[0.9] text-white">
                                    {stepHeading()}
                                </h1>
                            </motion.div>
                        </div>
                    )}

                    <div className="relative w-full">
                        <AnimatePresence mode="wait">
                            {step <= 7 ? (
                                <motion.div
                                    key={`form-${isLoginMode}`}
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                    className="relative flex min-h-[430px] w-full flex-col overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03] px-8 pt-8 pb-10 shadow-2xl backdrop-blur-2xl glass-panel"
                                >
                                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                                    <form
                                        ref={formRef}
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            if (!formRef.current?.reportValidity()) return;
                                            nextStep();
                                        }}
                                        className="flex flex-1 flex-col space-y-8"
                                    >
                                        <AnimatePresence mode="wait">
                                            <motion.div
                                                key={`${step}-${isLoginMode}`}
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                                className="flex-1"
                                            >
                                                {/* ---- STEP 1: EMAIL & PASSWORD (UNIFIED) ---- */}
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
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70 block">Password</label>
                                                            <input
                                                                type="password"
                                                                required
                                                                minLength={8}
                                                                value={form.password}
                                                                onChange={handleChange("password")}
                                                                placeholder="••••••••"
                                                                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold tracking-widest text-white placeholder:text-white/40 focus:outline-none focus:border-orange/50 transition-all"
                                                            />
                                                            <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest pl-1">At least 8 characters</p>
                                                        </div>

                                                        <div className="pt-2 border-t border-white/5 space-y-4">
                                                            <button
                                                                type="button"
                                                                onClick={handleGoogleLogin}
                                                                disabled={submitting}
                                                                className="w-full relative group h-12 rounded-xl bg-white/5 text-white font-black uppercase tracking-[0.3em] text-[10px] transition-all flex items-center justify-center overflow-hidden hover:bg-white/10 border border-white/10"
                                                            >
                                                                <div className="flex items-center gap-3 px-6 relative z-10">
                                                                    {submitting ? (
                                                                        <Loader2 className="animate-spin" size={16} />
                                                                    ) : (
                                                                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                                                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.27.81-.57z" />
                                                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                                                        </svg>
                                                                    )}
                                                                    {googleCtaLabel}
                                                                </div>
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}



                                                {!isLoginMode && step === 3 && (
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

                                                {!isLoginMode && step === 4 && (
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

                                                {!isLoginMode && step === 5 && (
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70 block">What's your age?</label>
                                                        <input
                                                            type="number"
                                                            autoFocus
                                                            required
                                                            min="18"
                                                            max="100"
                                                            value={form.age}
                                                            onChange={handleChange("age")}
                                                            placeholder="e.g. 24"
                                                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold tracking-widest text-white placeholder:text-white/40 focus:outline-none focus:border-orange/50 transition-all"
                                                        />
                                                    </div>
                                                )}

                                                {!isLoginMode && step === 6 && (
                                                    <div className="space-y-4">
                                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70 block">How do you identify?</label>
                                                        <GenderSelector
                                                            value={form.gender}
                                                            onChange={(val) => setForm(prev => ({ ...prev, gender: val }))}
                                                            disabled={submitting}
                                                        />
                                                    </div>
                                                )}

                                                {!isLoginMode && step === 7 && (
                                                    <div className="space-y-4">
                                                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70 block">Where are you based?</label>
                                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                                                            Choose your city to complete setup.
                                                        </p>
                                                        <div className="grid grid-cols-2 gap-3 rounded-[24px] border border-white/8 bg-white/[0.02] p-3">
                                                            {CITIES.map(city => (
                                                                <button
                                                                    type="button"
                                                                    key={city}
                                                                    disabled={submitting}
                                                                    onClick={() => handleCitySelect(city)}
                                                                    className={`flex h-16 items-center justify-center rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all border disabled:opacity-50 ${form.city === city
                                                                        ? "bg-orange text-white border-orange shadow-[0_12px_24px_rgba(255,90,0,0.25)]"
                                                                        : "bg-white/[0.06] text-white/75 border-white/12 hover:border-orange/30 hover:bg-white/[0.1] hover:text-white"
                                                                        }`}
                                                                >
                                                                    {submitting && form.city === city
                                                                        ? <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                                                        : city
                                                                    }
                                                                </button>
                                                            ))}
                                                        </div>
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

                                        <div className="mt-auto space-y-6">
                                            {(isLoginMode || step <= 7) && (
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
                                                                {primaryActionLabel}
                                                                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                                            </>
                                                        )}
                                                    </span>
                                                </button>
                                            )}

                                            <div className="flex min-h-2 items-center justify-center gap-3 px-1">
                                                {Array.from({ length: totalSteps }).map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={`h-1 transition-all duration-500 rounded-full ${i + 1 === currentProgressStep ? "w-8 bg-orange" : "w-1.5 bg-white/10"}`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </form>
                                </motion.div>
                            ) : step === 8 ? (
                                <motion.div
                                    key="verify"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="w-full flex justify-center"
                                >
                                    <VerifyPanel
                                        phone={cleanForm.phone}
                                        onVerify={handleVerify}
                                        onResend={handleResend}
                                        onEdit={() => setStep(3)}
                                        loading={submitting}
                                        error={status.message}
                                    />
                                </motion.div>
                            ) : null}
                        </AnimatePresence>
                    </div>

                    {step === 1 && !isOnboarding && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                            className="text-center w-full mt-4"
                        >
                            <button
                                onClick={toggleMode}
                                disabled={submitting}
                                className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 hover:text-white transition-colors"
                            >
                                {isLoginMode ? (
                                    <>New here? <span className="text-orange underline underline-offset-4">Create account</span></>
                                ) : (
                                    <>Already have an account? <span className="text-orange underline underline-offset-4">Log in</span></>
                                )}
                            </button>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}
