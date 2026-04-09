"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Building2,
    Users,
    Zap,
    ChevronRight,
    CheckCircle2,
    ArrowLeft,
    Mail,
    Lock,
    User,
    MapPin,
    Phone,
    Briefcase,
    ShieldCheck,
    AlertCircle,
    Eye,
    EyeOff,
    Instagram,
    Sparkles,
    RefreshCw,
    Building,
    Globe,
    Loader2,
    Upload,
    X,
    ArrowRight,
} from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { signInWithCustomToken } from "firebase/auth";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

// ── Step type ─────────────────────────────────────────────────────────────────
type OnboardingStep =
    | "email_verify"
    | "phone_verify"
    | "entity_type"
    | "role"
    | "details"
    | "kyc_identity"
    | "kyc_business"
    | "kyc_signatory"
    | "bank_setup"
    | "success";

type PartnerType = "venue" | "host" | "promoter";
type EntityType = "individual" | "business";

// Dynamic sequence based on entity type (KYC steps vary)
function getStepSequence(et: EntityType): OnboardingStep[] {
    const kycSteps: OnboardingStep[] = et === "business"
        ? ["kyc_business", "kyc_signatory", "bank_setup"]
        : ["kyc_identity", "bank_setup"];
    return ["role", "email_verify", "phone_verify", "entity_type", "details", ...kycSteps, "success"];
}

const STEP_LABELS: Record<OnboardingStep, string> = {
    email_verify: "Email",
    phone_verify: "Phone",
    entity_type: "Entity",
    role: "Role",
    details: "Details",
    kyc_identity: "Identity",
    kyc_business: "Business",
    kyc_signatory: "Signatory",
    bank_setup: "Banking",
    success: "Done",
};

// ── OTP API helpers ───────────────────────────────────────────────────────────
async function apiSendOtp(type: "email" | "phone", recipient: string) {
    const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, recipient }),
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send code.");
    }
}

async function apiVerifyOtp(type: "email" | "phone", recipient: string, code: string) {
    const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, recipient, code }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Incorrect code.");
    return true;
}

// ── Main component ────────────────────────────────────────────────────────────
function OnboardingContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user: authUser, signOut } = useDashboardAuth();

    const [step, setStep] = useState<OnboardingStep>("role");
    const [partnerType, setPartnerType] = useState<PartnerType>("venue");
    const [entityType, setEntityType] = useState<EntityType>("individual");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [approvalStatus, setApprovalStatus] = useState<"pending" | "verified">("pending");
    const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);

    // KYC state — collected during onboarding, submitted with the application
    const [createdUid, setCreatedUid] = useState<string | null>(null);
    const [kycStepData, setKycStepData] = useState<Record<string, Record<string, unknown>>>({});
    const [kycSubmitting, setKycSubmitting] = useState(false);
    const [kycError, setKycError] = useState("");

    // Dynamic sequence depends on entity type chosen at step 4
    const stepSequence = getStepSequence(entityType);

    // OTP state — provider-agnostic; only verification.js changes per provider
    const [otpEmail, setOtpEmail] = useState("");
    const [otpEmailCode, setOtpEmailCode] = useState("");
    const [otpEmailSent, setOtpEmailSent] = useState(false);
    const [emailCooldown, setEmailCooldown] = useState(0);

    const [otpPhone, setOtpPhone] = useState("+91 ");
    const [otpPhoneCode, setOtpPhoneCode] = useState("");
    const [otpPhoneSent, setOtpPhoneSent] = useState(false);
    const [phoneCooldown, setPhoneCooldown] = useState(0);

    const emailCooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const phoneCooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Form data — all existing fields preserved exactly
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        name: "",
        contactPerson: "",
        phone: "",
        city: "",
        area: "",
        website: "",
        capacity: "",
        plan: "silver",
        role: "organizer",
        association: "",
        associatedHostId: "",
        instagram: "",
        bio: "",
        upcomingEventsText: "",
        pastEventsText: "",
        businessType: "pvt_ltd",
        registrationNumber: "",
    });

    // Pre-fill from URL params (existing behaviour kept)
    useEffect(() => {
        const type = searchParams.get("type") as PartnerType;
        const email = searchParams.get("email");
        const hostId = searchParams.get("hostId");
        if (type) setPartnerType(type);
        if (email) {
            setOtpEmail(email);
            setFormData(prev => ({ ...prev, email }));
        }
        if (hostId) setFormData(prev => ({ ...prev, associatedHostId: hostId }));
    }, [searchParams]);

    // If already signed in, skip role+email verify
    useEffect(() => {
        if (authUser && (step === "role" || step === "email_verify")) {
            setOtpEmail(authUser.email || "");
            setFormData(prev => ({ ...prev, email: authUser.email || "" }));
            setCreatedUid(authUser.uid);
            setStep("phone_verify");
        }
    }, [authUser]);

    // Approval polling (unchanged from original)
    useEffect(() => {
        if (step !== "success" || !submittedRequestId) return;
        const auth = getFirebaseAuth();
        const checkApproval = async () => {
            const currentUser = auth.currentUser;
            if (!currentUser) return;
            try {
                const token = await currentUser.getIdToken();
                const res = await fetch(
                    `/api/auth/onboard-status?requestId=${encodeURIComponent(submittedRequestId)}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (!res.ok) return;
                const data = await res.json();
                const status = (data.status as string | undefined)?.toLowerCase();
                if (status === "verified" || status === "approved") setApprovalStatus("verified");
            } catch { /* silent */ }
        };
        checkApproval();
        const interval = setInterval(checkApproval, 10_000);
        return () => clearInterval(interval);
    }, [step, submittedRequestId]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    function startCooldown(
        setter: React.Dispatch<React.SetStateAction<number>>,
        ref: React.MutableRefObject<ReturnType<typeof setInterval> | null>
    ) {
        setter(60);
        ref.current = setInterval(() => {
            setter(prev => {
                if (prev <= 1) { clearInterval(ref.current!); return 0; }
                return prev - 1;
            });
        }, 1000);
    }

    // ── Email OTP ─────────────────────────────────────────────────────────────
    const handleSendEmailOtp = async () => {
        setError("");
        if (!otpEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(otpEmail)) {
            setError("Please enter a valid email address.");
            return;
        }
        setLoading(true);
        try {
            await apiSendOtp("email", otpEmail);
            setOtpEmailSent(true);
            setFormData(prev => ({ ...prev, email: otpEmail }));
            startCooldown(setEmailCooldown, emailCooldownRef);
        } catch (err: any) { setError(err.message); }
        finally { setLoading(false); }
    };

    const handleVerifyEmailOtp = async () => {
        setError("");
        if (otpEmailCode.length !== 6) { setError("Enter the 6-digit code."); return; }
        setLoading(true);
        try {
            await apiVerifyOtp("email", otpEmail, otpEmailCode);
            setStep("phone_verify");
        } catch (err: any) { setError(err.message); }
        finally { setLoading(false); }
    };

    // ── Phone OTP ─────────────────────────────────────────────────────────────
    const handleSendPhoneOtp = async () => {
        setError("");
        const cleanPhone = otpPhone.replace(/\s/g, "");
        if (!cleanPhone || cleanPhone.length < 10) {
            setError("Please enter a valid phone number with country code.");
            return;
        }
        setLoading(true);
        try {
            await apiSendOtp("phone", cleanPhone);
            setOtpPhoneSent(true);
            setFormData(prev => ({ ...prev, phone: cleanPhone }));
            startCooldown(setPhoneCooldown, phoneCooldownRef);
        } catch (err: any) { setError(err.message); }
        finally { setLoading(false); }
    };

    const handleVerifyPhoneOtp = async () => {
        setError("");
        if (otpPhoneCode.length !== 6) { setError("Enter the 6-digit code."); return; }
        setLoading(true);
        try {
            const cleanPhone = otpPhone.replace(/\s/g, "");
            await apiVerifyOtp("phone", cleanPhone, otpPhoneCode);
            setStep("entity_type");
        } catch (err: any) { setError(err.message); }
        finally { setLoading(false); }
    };

    // ── Step 5: Create Firebase account, then advance to first KYC step ────────
    const handleCreateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const auth = getFirebaseAuth();
            let uid: string;
            const effectiveEmail = authUser?.email || formData.email;

            if (authUser && authUser.email === effectiveEmail) {
                uid = authUser.uid;
            } else {
                if (!formData.email || !formData.password) {
                    setError("Please provide both email and password.");
                    setLoading(false);
                    return;
                }
                // Create account server-side (Admin SDK) — avoids client Firebase Auth connectivity issues
                const res = await fetch("/api/auth/create-account", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: formData.email,
                        password: formData.password,
                        phone: formData.phone || otpPhone.replace(/\s/g, ""),
                    }),
                });
                const data = await res.json();
                if (!res.ok) {
                    if (res.status === 409) {
                        setError("This email is already registered. Please log in first, then return to complete your application.");
                        setLoading(false);
                        return;
                    }
                    throw new Error(data.error || "Failed to create account.");
                }
                // Sign the client in using the custom token returned by the server
                const { customToken, uid: newUid } = data;
                try {
                    await signInWithCustomToken(auth, customToken);
                } catch {
                    // signInWithCustomToken failed (rare — client can't reach Firebase)
                    // Still store the uid so KYC uploads can proceed via server route
                }
                uid = newUid;
            }

            setCreatedUid(uid);
            // Advance to the first KYC step in the sequence
            const seq = getStepSequence(entityType);
            const detailsIdx = seq.indexOf("details");
            setStep(seq[detailsIdx + 1]);
        } catch (err: any) {
            console.error("Account creation error:", err);
            setError(err.message || "Failed to create account. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // ── Intermediate KYC step: save data locally and advance ─────────────────
    const handleKycStep = useCallback((stepId: string, data: Record<string, unknown>) => {
        setKycStepData(prev => ({ ...prev, [stepId]: data }));
        const seq = getStepSequence(entityType);
        const idx = seq.indexOf(stepId as OnboardingStep);
        if (idx !== -1 && idx < seq.length - 1) {
            setStep(seq[idx + 1]);
        }
    }, [entityType]);

    // ── Final step (bank_setup): submit everything to the onboard API ─────────
    const handleBankSubmit = useCallback(async (bankData: Record<string, unknown>) => {
        const allKycData = { ...kycStepData, bank_setup: bankData };
        setKycSubmitting(true);
        setKycError("");
        try {
            const auth = getFirebaseAuth();
            const token = await auth.currentUser?.getIdToken();
            const effectiveEmail = authUser?.email || formData.email;
            const res = await fetch("/api/auth/onboard", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token && { Authorization: `Bearer ${token}` }),
                },
                body: JSON.stringify({
                    type: partnerType,
                    entityType,
                    ...formData,
                    email: effectiveEmail,
                    phone: formData.phone || otpPhone.replace(/\s/g, ""),
                    kycStepData: allKycData,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to submit application.");
            }
            const responseData = await res.json();
            if (responseData.requestId) setSubmittedRequestId(responseData.requestId);
            setStep("success");
        } catch (err: any) {
            console.error("Final submit error:", err);
            setKycError(err.message || "Failed to submit. Please try again.");
        } finally {
            setKycSubmitting(false);
        }
    }, [kycStepData, authUser, formData, partnerType, entityType, otpPhone]);

    const currentStepIndex = stepSequence.indexOf(step);
    // Effective UID for Firebase Storage uploads during KYC
    const effectiveUid = createdUid || authUser?.uid || "";

    return (
        <div className="min-h-screen bg-[var(--surface-base)]">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[var(--surface-base)]/80 backdrop-blur-xl border-b border-[var(--border-subtle)]">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <button
                        onClick={async () => {
                            if (currentStepIndex === 0) {
                                if (authUser) await signOut();
                                router.push("/login");
                            } else {
                                setError("");
                                setKycError("");
                                setStep(stepSequence[currentStepIndex - 1]);
                            }
                        }}
                        className="flex items-center gap-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors text-[11px] font-semibold uppercase tracking-wider"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        {currentStepIndex === 0 ? "Back to Login" : "Back"}
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-[var(--text-primary)] flex items-center justify-center">
                            <span className="text-[var(--text-inverse)] font-bold text-sm">C</span>
                        </div>
                        <span className="text-[15px] font-bold text-[var(--text-primary)] tracking-tight">THE C1RCLE</span>
                    </div>
                </div>
            </header>

            {/* Progress bar — auto-driven by stepSequence */}
            <div className="max-w-5xl mx-auto px-6 py-6">
                <div className="flex items-center">
                    {stepSequence.filter(s => s !== "success").map((s, i) => {
                        const isDone = currentStepIndex > i;
                        const isCurrent = currentStepIndex === i;
                        const isLast = i === stepSequence.filter(s => s !== "success").length - 1;
                        return (
                            <div key={s} className="flex items-center flex-1">
                                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                    <button
                                        type="button"
                                        disabled={!isDone}
                                        onClick={() => isDone && setStep(s)}
                                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${isCurrent ? "bg-[var(--accent-primary)] text-white" : isDone ? "bg-[var(--state-success)] text-white cursor-pointer hover:opacity-80" : "bg-[var(--surface-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed"}`}
                                    >
                                        {isDone ? "✓" : i + 1}
                                    </button>
                                    <span className={`text-[9px] font-semibold uppercase tracking-wider ${isCurrent ? "text-[var(--accent-primary)]" : isDone ? "text-[var(--state-success)]" : "text-[var(--text-tertiary)]"}`}>
                                        {STEP_LABELS[s]}
                                    </span>
                                </div>
                                {!isLast && (
                                    <div className={`flex-1 h-0.5 rounded-full mx-2 mb-4 transition-all ${isDone ? "bg-[var(--state-success)]" : "bg-[var(--surface-tertiary)]"}`} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <main className="max-w-xl mx-auto px-6 pb-24">
                <AnimatePresence mode="wait">

                    {/* ── Email Verification ── */}
                    {step === "email_verify" && (
                        <motion.div key="email_verify" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                            <StepHeader step="02" label="Verify Email" title="Confirm Your Email" description="Enter the email address you want to register with. We'll send a 6-digit verification code." />
                            <ErrorBanner error={error} />
                            <div className="space-y-5">
                                <FormInput label="Email Address" icon={Mail} type="email" value={otpEmail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOtpEmail(e.target.value)} placeholder="you@company.com" disabled={otpEmailSent} />
                                {!otpEmailSent ? (
                                    <ActionButton onClick={handleSendEmailOtp} loading={loading}>Send Verification Code <ChevronRight className="h-5 w-5" /></ActionButton>
                                ) : (
                                    <>
                                        <OtpInput label="Enter the 6-digit code sent to your email" value={otpEmailCode} onChange={setOtpEmailCode} />
                                        <ActionButton onClick={handleVerifyEmailOtp} loading={loading}>Verify Email <ChevronRight className="h-5 w-5" /></ActionButton>
                                        <ResendButton cooldown={emailCooldown} onClick={handleSendEmailOtp} loading={loading} />
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* ── Phone Verification ── */}
                    {step === "phone_verify" && (
                        <motion.div key="phone_verify" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                            <StepHeader step="03" label="Verify Phone" title="Confirm Your Number" description="We'll send an SMS code to confirm your mobile number. This becomes your verified contact on the platform." />
                            <ErrorBanner error={error} />
                            <div className="space-y-5">
                                <FormInput label="Mobile Number (with country code)" icon={Phone} type="tel" value={otpPhone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOtpPhone(e.target.value)} placeholder="+91 98765 43210" disabled={otpPhoneSent} />
                                {!otpPhoneSent ? (
                                    <ActionButton onClick={handleSendPhoneOtp} loading={loading}>Send SMS Code <ChevronRight className="h-5 w-5" /></ActionButton>
                                ) : (
                                    <>
                                        <OtpInput label="Enter the 6-digit SMS code" value={otpPhoneCode} onChange={setOtpPhoneCode} />
                                        <ActionButton onClick={handleVerifyPhoneOtp} loading={loading}>Verify Phone <ChevronRight className="h-5 w-5" /></ActionButton>
                                        <ResendButton cooldown={phoneCooldown} onClick={handleSendPhoneOtp} loading={loading} />
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* ── Entity Type ── */}
                    {step === "entity_type" && (
                        <motion.div key="entity_type" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                            <StepHeader step="04" label="Entity Type" title="Individual or Business?" description="This determines which verification documents you'll provide after approval." />
                            <div className="grid grid-cols-1 gap-4 mb-10">
                                <RoleCard icon={User} title="Individual" description="Freelancer, independent promoter, solo DJ, or individual host." active={entityType === "individual"} onClick={() => setEntityType("individual")} />
                                <RoleCard icon={Building} title="Business" description="Registered company, club, LLP, partnership firm, or trust." active={entityType === "business"} onClick={() => setEntityType("business")} />
                            </div>
                            <ActionButton onClick={() => { setError(""); setStep("details"); }}>Continue <ChevronRight className="h-5 w-5" /></ActionButton>
                        </motion.div>
                    )}

                    {/* ── Role Selection ── */}
                    {step === "role" && (
                        <motion.div key="role" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                            <StepHeader step="01" label="Select Role" title="Join the Network" description="Select your operational role to begin the onboarding process." />
                            <div className="grid grid-cols-1 gap-4 mb-10">
                                <RoleCard icon={Building2} title="Venue Partner" description="Direct management for nightlife venues, clubs, and lounge spaces." active={partnerType === "venue"} onClick={() => setPartnerType("venue")} />
                                <RoleCard icon={Users} title="Event Host" description="For organizers, DJs, and collectives hosting independent events." active={partnerType === "host"} onClick={() => setPartnerType("host")} />
                                <RoleCard icon={Zap} title="Promoter" description="Access tools for ticket distribution and guestlist management." active={partnerType === "promoter"} onClick={() => setPartnerType("promoter")} />
                            </div>
                            <ActionButton onClick={() => { setError(""); setStep("email_verify"); }}>Continue <ChevronRight className="h-5 w-5" /></ActionButton>
                        </motion.div>
                    )}

                    {/* ── Details Form ── */}
                    {step === "details" && (
                        <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                            <StepHeader
                                step={String(stepSequence.indexOf("details") + 1).padStart(2, "0")}
                                label="Your Details"
                                title={partnerType === "venue" ? "Venue Registration" : partnerType === "host" ? "Host Profile" : "Promoter Enrollment"}
                                description="Tell us about your business. You'll upload verification documents in the next steps."
                            />

                            <ErrorBanner error={error} onLoginClick={() => router.push("/login")} />

                            <form onSubmit={handleCreateAccount} className="space-y-8">
                                {/* Credentials section */}
                                {!authUser ? (
                                    <div className="space-y-5">
                                        <SectionTitle title="Account Credentials" />
                                        <div className="p-4 rounded-2xl bg-[var(--state-success-bg)] border border-[var(--state-success)]/20 flex items-center gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-[var(--state-success)] flex-shrink-0" />
                                            <div>
                                                <p className="text-[11px] font-semibold text-[var(--state-success)] uppercase tracking-wider">Verified Email</p>
                                                <p className="text-[13px] font-medium text-[var(--text-primary)]">{otpEmail}</p>
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <FormInput
                                                label="Create Password"
                                                icon={Lock}
                                                type={showPassword ? "text" : "password"}
                                                name="password"
                                                value={formData.password}
                                                onChange={handleInputChange}
                                                required
                                                placeholder="Minimum 8 characters"
                                            />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-[42px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-5 rounded-2xl bg-[var(--state-success-bg)] border border-[var(--state-success)]/20 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="h-11 w-11 rounded-xl bg-[var(--state-success)] flex items-center justify-center font-bold text-white text-lg">
                                                {authUser.email?.[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold text-[var(--state-success)] uppercase tracking-wider mb-0.5">Signed In As</p>
                                                <p className="text-[14px] font-semibold text-[var(--text-primary)]">{authUser.email}</p>
                                            </div>
                                        </div>
                                        <CheckCircle2 className="h-6 w-6 text-[var(--state-success)]" />
                                    </div>
                                )}

                                {/* Entity Information */}
                                <div className="space-y-5">
                                    <SectionTitle title={partnerType === "promoter" ? "Your Profile" : "Entity Information"} />

                                    {entityType === "business" ? (
                                        <>
                                            <FormInput label="Legal Business Name" icon={Building} name="name" value={formData.name} onChange={handleInputChange} required placeholder="e.g. Eclipse Nightlife Pvt. Ltd." />
                                            <FormSelect label="Business Type" name="businessType" value={formData.businessType} onChange={handleInputChange}
                                                options={[
                                                    { value: "pvt_ltd", label: "Private Limited" },
                                                    { value: "llp", label: "LLP" },
                                                    { value: "partnership", label: "Partnership Firm" },
                                                    { value: "sole_prop", label: "Sole Proprietorship" },
                                                    { value: "trust", label: "Trust / Society" },
                                                ]}
                                            />
                                            <FormInput label="Registration / CIN Number (optional)" icon={Briefcase} name="registrationNumber" value={formData.registrationNumber} onChange={handleInputChange} placeholder="e.g. U74999MH2020PTC123456" />
                                        </>
                                    ) : (
                                        <FormInput
                                            label={partnerType === "venue" ? "Venue Name" : partnerType === "host" ? "Brand / Collective Name" : "Your Full Name"}
                                            icon={partnerType === "venue" ? Building2 : User}
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            required
                                            placeholder={partnerType === "venue" ? "e.g. Club Eclipse" : partnerType === "host" ? "e.g. Midnight Collective" : "Your name"}
                                        />
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormInput
                                            label={entityType === "business" ? "Authorized Contact" : "Contact Person"}
                                            icon={Briefcase}
                                            name="contactPerson"
                                            value={formData.contactPerson}
                                            onChange={handleInputChange}
                                            required
                                            placeholder="Primary contact"
                                        />
                                        {/* Phone read-only — verified in step 2 */}
                                        <div className="space-y-2">
                                            <label className="input-label">Phone Number</label>
                                            <div className="relative">
                                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--state-success)]" />
                                                <input type="tel" value={formData.phone || otpPhone} readOnly className="w-full bg-[var(--state-success-bg)] border border-[var(--state-success)]/30 rounded-xl pl-12 pr-10 py-3.5 text-[14px] text-[var(--text-primary)] cursor-not-allowed" />
                                                <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--state-success)]" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormInput label="City" icon={MapPin} name="city" value={formData.city} onChange={handleInputChange} required placeholder="e.g. Mumbai" />
                                        <FormInput label="Area / Locality" icon={MapPin} name="area" value={formData.area} onChange={handleInputChange} required placeholder="e.g. Bandra" />
                                    </div>

                                    <FormInput
                                        label="Website (optional)"
                                        icon={Globe}
                                        name="website"
                                        value={formData.website}
                                        onChange={handleInputChange}
                                        placeholder="https://yourbrand.com"
                                    />

                                    {/* Role-specific fields — unchanged */}
                                    {partnerType === "venue" && (
                                        <>
                                            <FormInput label="Approximate Capacity" icon={Users} name="capacity" value={formData.capacity} onChange={handleInputChange} required placeholder="e.g. 500" />
                                            <FormSelect label="Subscription Tier" name="plan" value={formData.plan} onChange={handleInputChange}
                                                options={[
                                                    { value: "basic", label: "Basic Access" },
                                                    { value: "silver", label: "Silver Tier" },
                                                    { value: "gold", label: "Gold Premium" },
                                                    { value: "diamond", label: "Diamond Private" },
                                                ]}
                                            />
                                        </>
                                    )}
                                    {partnerType === "host" && (
                                        <FormSelect label="Host Category" name="role" value={formData.role} onChange={handleInputChange}
                                            options={[
                                                { value: "dj", label: "Individual DJ / Artist" },
                                                { value: "organizer", label: "Event Organizer" },
                                                { value: "collective", label: "Collective / Label" },
                                            ]}
                                        />
                                    )}
                                    {partnerType === "promoter" && (
                                        <>
                                            <FormInput label="Instagram Handle" icon={Instagram} name="instagram" value={formData.instagram} onChange={handleInputChange} required placeholder="@yourusername" />
                                            <div className="space-y-2">
                                                <label className="input-label">Short Bio</label>
                                                <textarea name="bio" value={formData.bio} onChange={handleInputChange} placeholder="Tell us about your reach, experience, and what you're looking for..." className="w-full bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:bg-[var(--surface-base)] focus:border-[var(--accent-primary)] focus:ring-3 focus:ring-[var(--accent-glow)] transition-all outline-none min-h-[120px] resize-none" required />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="input-label">Upcoming Events (optional)</label>
                                                <textarea
                                                    name="upcomingEventsText"
                                                    value={formData.upcomingEventsText}
                                                    onChange={handleInputChange}
                                                    placeholder={"One event per line\nSummer Fridays | Jun 14 2026 | Toy Room | Mumbai\nCampus Heatwave | Jul 05 2026 | Kitty Su | Delhi"}
                                                    className="w-full bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:bg-[var(--surface-base)] focus:border-[var(--accent-primary)] focus:ring-3 focus:ring-[var(--accent-glow)] transition-all outline-none min-h-[120px] resize-none"
                                                />
                                                <p className="text-[12px] leading-5 text-[var(--text-tertiary)]">
                                                    Format each line as: event name | date | venue | city
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="input-label">Past Event Highlights (optional)</label>
                                                <textarea
                                                    name="pastEventsText"
                                                    value={formData.pastEventsText}
                                                    onChange={handleInputChange}
                                                    placeholder={"One event per line\nNeon Saturdays | Jan 20 2026 | Soho House | Mumbai\nWarehouse Takeover | Dec 28 2025 | AntiSocial | Pune"}
                                                    className="w-full bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:bg-[var(--surface-base)] focus:border-[var(--accent-primary)] focus:ring-3 focus:ring-[var(--accent-glow)] transition-all outline-none min-h-[120px] resize-none"
                                                />
                                                <p className="text-[12px] leading-5 text-[var(--text-tertiary)]">
                                                    These appear on your partner profile until real event history is linked.
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <button type="submit" disabled={loading} className="w-full bg-[var(--accent-primary)] text-white h-14 rounded-2xl font-semibold text-[14px] hover:brightness-110 transition-all flex items-center justify-center gap-3 shadow-lg shadow-[var(--accent-primary)]/20 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {loading ? <><span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Setting up account…</> : <>Continue to Verification <ChevronRight className="h-5 w-5" /></>}
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {/* ── KYC: Identity Verification (Individual) ── */}
                    {step === "kyc_identity" && (
                        <motion.div key="kyc_identity" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                            <StepHeader
                                step={String(stepSequence.indexOf("kyc_identity") + 1).padStart(2, "0")}
                                label="Identity Check"
                                title="Verify Your Identity"
                                description="Upload a government-issued ID and a selfie to confirm your identity."
                            />
                            {kycError && <ErrorBanner error={kycError} />}
                            <KycIdentityForm
                                uid={effectiveUid}
                                initialData={{}}
                                onSubmit={(data) => handleKycStep("kyc_identity", data)}
                                submitting={false}
                                submitLabel="Continue"
                            />
                        </motion.div>
                    )}

                    {/* ── KYC: Business Documents (Business) ── */}
                    {step === "kyc_business" && (
                        <motion.div key="kyc_business" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                            <StepHeader
                                step={String(stepSequence.indexOf("kyc_business") + 1).padStart(2, "0")}
                                label="Business Documents"
                                title="Business Documents"
                                description="PAN, CIN/GST, and registration certificate for your business."
                            />
                            {kycError && <ErrorBanner error={kycError} />}
                            <KycBusinessForm
                                uid={effectiveUid}
                                initialData={{
                                    legalName: formData.name,
                                    businessType: formData.businessType,
                                    cin: formData.registrationNumber,
                                }}
                                onSubmit={(data) => handleKycStep("kyc_business", data)}
                                submitting={false}
                                submitLabel="Continue"
                            />
                        </motion.div>
                    )}

                    {/* ── KYC: Authorized Representative (Business) ── */}
                    {step === "kyc_signatory" && (
                        <motion.div key="kyc_signatory" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                            <StepHeader
                                step={String(stepSequence.indexOf("kyc_signatory") + 1).padStart(2, "0")}
                                label="Authorized Representative"
                                title="Authorized Representative"
                                description="Identity verification for the person representing the business."
                            />
                            {kycError && <ErrorBanner error={kycError} />}
                            <KycSignatoryForm
                                uid={effectiveUid}
                                initialData={{}}
                                onSubmit={(data) => handleKycStep("kyc_signatory", data)}
                                submitting={false}
                                submitLabel="Continue"
                            />
                        </motion.div>
                    )}

                    {/* ── KYC: Bank Account (All) ── */}
                    {step === "bank_setup" && (
                        <motion.div key="bank_setup" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                            <StepHeader
                                step={String(stepSequence.indexOf("bank_setup") + 1).padStart(2, "0")}
                                label="Bank Account"
                                title="Payout Bank Account"
                                description="Bank account details for receiving payouts once approved."
                            />
                            {kycError && <ErrorBanner error={kycError} />}
                            <BankSetupForm
                                uid={effectiveUid}
                                initialData={{}}
                                onSubmit={handleBankSubmit}
                                submitting={kycSubmitting}
                                submitLabel="Submit Application"
                            />
                        </motion.div>
                    )}

                    {/* ── Success ── */}
                    {step === "success" && (
                        <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="text-center pt-8">
                            {approvalStatus === "verified" ? (
                                <>
                                    <motion.div key="approved" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }} className="h-24 w-24 rounded-3xl bg-[var(--accent-glow)] text-[var(--accent-primary)] flex items-center justify-center mx-auto mb-8">
                                        <Sparkles className="h-12 w-12" />
                                    </motion.div>
                                    <h1 className="text-display-sm text-[var(--text-primary)] mb-4">You're Approved</h1>
                                    <p className="text-body text-[var(--text-secondary)] mb-10 max-w-md mx-auto">
                                        <span className="font-semibold text-[var(--text-primary)]">{formData.name}</span> has been approved. Log in to access your dashboard.
                                    </p>
                                    <button onClick={async () => { if (authUser) await signOut(); router.push("/login"); }} className="inline-flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-[var(--accent-primary)] text-white font-semibold text-[14px] hover:brightness-110 transition-all shadow-lg shadow-[var(--accent-primary)]/20">
                                        Go to Login <ChevronRight className="h-4 w-4" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <motion.div key="pending" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="h-24 w-24 rounded-3xl bg-[var(--state-success-bg)] text-[var(--state-success)] flex items-center justify-center mx-auto mb-8">
                                        <CheckCircle2 className="h-12 w-12" />
                                    </motion.div>
                                    <h1 className="text-display-sm text-[var(--text-primary)] mb-4">Application Submitted</h1>
                                    <p className="text-body text-[var(--text-secondary)] mb-10 max-w-md mx-auto">
                                        Your application and verification documents for <span className="font-semibold text-[var(--text-primary)]">{formData.name}</span> are under review. We'll email you once approved.
                                    </p>
                                    <div className="p-6 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] mb-10 flex items-start gap-4 text-left">
                                        <ShieldCheck className="h-6 w-6 text-[var(--accent-primary)] flex-shrink-0" />
                                        <div>
                                            <p className="text-[13px] font-semibold text-[var(--text-primary)] mb-1">What Happens Next?</p>
                                            <p className="text-[13px] text-[var(--text-tertiary)] leading-relaxed">
                                                Our team reviews applications and documents within 24–48 hours. Once approved, you'll receive an email to log in and access your full dashboard.
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={async () => { if (authUser) await signOut(); router.push("/login"); }} className="inline-flex items-center gap-2 text-[var(--accent-primary)] font-semibold text-[14px] hover:underline">
                                        Return to Login <ChevronRight className="h-4 w-4" />
                                    </button>
                                </>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}

export default function OnboardingPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[var(--surface-base)]">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 border-3 border-[var(--accent-primary)]/30 border-t-[var(--accent-primary)] rounded-full animate-spin" />
                    <p className="text-[14px] font-medium text-[var(--text-tertiary)]">Loading...</p>
                </div>
            </div>
        }>
            <OnboardingContent />
        </Suspense>
    );
}

// ── UI primitives (unchanged from original + new OTP/helper components) ───────

function StepHeader({ step, label, title, description }: { step: string; label: string; title: string; description: string }) {
    return (
        <div className="mb-10">
            <p className="text-label text-[var(--accent-primary)] mb-2">STEP {step} — {label.toUpperCase()}</p>
            <h1 className="text-display-sm text-[var(--text-primary)] mb-3">{title}</h1>
            <p className="text-body text-[var(--text-secondary)]">{description}</p>
        </div>
    );
}

function RoleCard({ icon: Icon, title, description, active, onClick }: {
    icon: any; title: string; description: string; active: boolean; onClick: () => void;
}) {
    return (
        <motion.button onClick={onClick} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
            className={`p-6 rounded-2xl border-2 text-left transition-all duration-300 group ${active ? "bg-[var(--surface-tertiary)] border-[var(--accent-primary)] shadow-lg" : "bg-[var(--surface-elevated)] border-[var(--border-subtle)] hover:border-[var(--border-default)]"}`}>
            <div className="flex items-start gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all ${active ? "bg-[var(--accent-primary)] text-white" : "bg-[var(--surface-tertiary)] text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]"}`}>
                    <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                    <h3 className={`text-[16px] font-semibold mb-1 text-[var(--text-primary)]`}>{title}</h3>
                    <p className={`text-[13px] leading-relaxed ${active ? "text-[var(--text-secondary)]" : "text-[var(--text-tertiary)]"}`}>{description}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${active ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]" : "border-[var(--border-default)]"}`}>
                    {active && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
            </div>
        </motion.button>
    );
}

function FormInput({ label, icon: Icon, ...props }: any) {
    return (
        <div className="space-y-2">
            <label className="input-label">{label}</label>
            <div className="relative group">
                {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-placeholder)] group-focus-within:text-[var(--accent-primary)] transition-colors" />}
                <input className={`w-full bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] transition-all outline-none ${Icon ? "pl-12 pr-4" : "px-4"} py-3.5 hover:border-[var(--border-default)] focus:bg-[var(--surface-base)] focus:border-[var(--accent-primary)] focus:ring-3 focus:ring-[var(--accent-glow)] disabled:opacity-60 disabled:cursor-not-allowed`} {...props} />
            </div>
        </div>
    );
}

function FormSelect({ label, options, ...props }: any) {
    return (
        <div className="space-y-2">
            <label className="input-label">{label}</label>
            <div className="relative">
                <select className="w-full bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl px-4 py-3.5 text-[14px] text-[var(--text-primary)] appearance-none cursor-pointer transition-all outline-none hover:border-[var(--border-default)] focus:bg-[var(--surface-base)] focus:border-[var(--accent-primary)] focus:ring-3 focus:ring-[var(--accent-glow)]" {...props}>
                    {options.map((opt: { value: string; label: string }) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-tertiary)] rotate-90 pointer-events-none" />
            </div>
        </div>
    );
}

function SectionTitle({ title }: { title: string }) {
    return (
        <div className="flex items-center gap-4">
            <span className="text-label text-[var(--text-tertiary)] whitespace-nowrap">{title}</span>
            <div className="h-px bg-[var(--border-subtle)] flex-1" />
        </div>
    );
}

function OtpInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="space-y-2">
            <label className="input-label">{label}</label>
            <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={value}
                onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-full bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl px-4 py-3.5 text-[24px] font-bold tracking-[0.5em] text-center text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] transition-all outline-none focus:bg-[var(--surface-base)] focus:border-[var(--accent-primary)] focus:ring-3 focus:ring-[var(--accent-glow)]"
            />
        </div>
    );
}

function ActionButton({ onClick, loading = false, children }: { onClick?: () => void; loading?: boolean; children: React.ReactNode }) {
    return (
        <button
            type={onClick ? "button" : "submit"}
            onClick={onClick}
            disabled={loading}
            className="w-full bg-[var(--accent-primary)] text-white h-14 rounded-2xl font-semibold text-[14px] hover:brightness-110 transition-all flex items-center justify-center gap-3 shadow-lg shadow-[var(--accent-primary)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {loading ? <><span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing...</> : children}
        </button>
    );
}

function ResendButton({ cooldown, onClick, loading }: { cooldown: number; onClick: () => void; loading: boolean }) {
    return (
        <button type="button" onClick={onClick} disabled={cooldown > 0 || loading}
            className="w-full flex items-center justify-center gap-2 text-[13px] font-semibold text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <RefreshCw className="h-4 w-4" />
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
        </button>
    );
}

function ErrorBanner({ error, onLoginClick }: { error: string; onLoginClick?: () => void }) {
    if (!error) return null;
    return (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 p-5 bg-[var(--state-error-bg)] border border-[var(--state-error)]/20 rounded-2xl">
            <div className="flex items-start gap-4">
                <AlertCircle className="h-5 w-5 text-[var(--state-error)] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <p className="text-[14px] font-semibold text-[var(--state-error)] mb-2">{error}</p>
                    {onLoginClick && error.includes("log in") && (
                        <button onClick={onLoginClick} className="text-[12px] font-semibold text-[var(--state-error)] underline hover:no-underline">Go to Login →</button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

// ── KYC form utilities (used during onboarding) ───────────────────────────────

function KycFileZone({
    label, fieldName, value, onChange, uid, stepId,
}: {
    label: string; fieldName: string;
    value: string | null;
    onChange: (url: string | null) => void;
    uid: string; stepId: string;
}) {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = async (file: File) => {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert("File must be under 5MB."); return; }

        // Get Firebase auth token — server route uses Admin SDK, bypassing Storage rules
        const auth = getFirebaseAuth();
        if (!auth.currentUser) { alert("You must be signed in to upload documents."); return; }
        const token = await auth.currentUser.getIdToken();

        setUploading(true);
        setProgress(0);
        try {
            const form = new FormData();
            form.append("file", file);
            form.append("stepId", stepId);
            form.append("fieldName", fieldName);

            const res = await fetch("/api/kyc/upload", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: form,
            });

            setProgress(100);

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as any).error || "Upload failed.");
            }

            const { url } = await res.json();
            onChange(url);
        } catch (e: any) {
            console.error("Upload error:", e);
            alert(e.message || "Upload failed. Please try again.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">{label}</label>
            {value ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-[12px] text-emerald-400 font-medium truncate flex-1">Uploaded</span>
                    <button type="button" onClick={() => onChange(null)}
                        className="p-1 rounded-lg hover:bg-red-500/20 text-[var(--text-tertiary)] hover:text-red-400 transition-colors">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            ) : uploading ? (
                <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)]">
                    <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />
                        <span className="text-[12px] text-[var(--text-tertiary)]">Uploading… {progress}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-[var(--surface-tertiary)] overflow-hidden">
                        <div className="h-full bg-[var(--accent-primary)] rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            ) : (
                <button type="button" onClick={() => inputRef.current?.click()}
                    className="w-full p-5 rounded-xl border-2 border-dashed border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] transition-all text-center group">
                    <Upload className="h-5 w-5 text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)] mx-auto mb-1.5 transition-colors" />
                    <p className="text-[11px] text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors">
                        Click to upload · JPG, PNG or PDF · Max 5MB
                    </p>
                </button>
            )}
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,application/pdf" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
    );
}

function KycInputField({ label, value, onChange, placeholder, type = "text" }: {
    label: string; value: string; onChange?: (v: string) => void;
    placeholder?: string; type?: string;
}) {
    return (
        <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">{label}</label>
            <input type={type} value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder}
                className="w-full h-12 px-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[14px] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]/50 transition-all" />
        </div>
    );
}

function KycSelectField({ label, value, onChange, options }: {
    label: string; value: string; onChange: (v: string) => void;
    options: { value: string; label: string }[];
}) {
    return (
        <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">{label}</label>
            <select value={value} onChange={(e) => onChange(e.target.value)}
                className="w-full h-12 px-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]/50 transition-all appearance-none">
                <option value="">Select…</option>
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    );
}

// ── KYC Forms ─────────────────────────────────────────────────────────────────

function KycIdentityForm({ uid, initialData, onSubmit, submitting, submitLabel = "Continue" }: {
    uid: string; initialData: Record<string, unknown>;
    onSubmit: (data: Record<string, unknown>) => void;
    submitting: boolean; submitLabel?: string;
}) {
    const [idType, setIdType]     = useState((initialData.idType as string) || "");
    const [idNumber, setIdNumber] = useState((initialData.idNumber as string) || "");
    const [docFront, setDocFront] = useState<string | null>((initialData.docFrontUrl as string) || null);
    const [docBack, setDocBack]   = useState<string | null>((initialData.docBackUrl as string) || null);
    const [selfie, setSelfie]     = useState<string | null>((initialData.selfieUrl as string) || null);
    const needsBack = ["aadhaar", "driving_licence", "voter_id"].includes(idType);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!idType || !idNumber || !docFront || !selfie) return;
        if (needsBack && !docBack) return;
        onSubmit({ idType, idNumber, docFrontUrl: docFront, docBackUrl: docBack, selfieUrl: selfie });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <KycSelectField label="ID Type" value={idType} onChange={setIdType}
                options={[
                    { value: "aadhaar", label: "Aadhaar Card" },
                    { value: "passport", label: "Passport" },
                    { value: "driving_licence", label: "Driving Licence" },
                    { value: "voter_id", label: "Voter ID" },
                ]} />
            <KycInputField label="ID Number" value={idNumber} onChange={setIdNumber} placeholder="Enter your ID number" />
            <div className={`grid gap-4 ${needsBack ? "sm:grid-cols-2" : "grid-cols-1"}`}>
                <KycFileZone label="Document Front" fieldName="doc_front" value={docFront} onChange={setDocFront} uid={uid} stepId="kyc_identity" />
                {needsBack && <KycFileZone label="Document Back" fieldName="doc_back" value={docBack} onChange={setDocBack} uid={uid} stepId="kyc_identity" />}
            </div>
            <KycFileZone label="Selfie Photo" fieldName="selfie" value={selfie} onChange={setSelfie} uid={uid} stepId="kyc_identity" />
            <button type="submit"
                disabled={submitting || !idType || !idNumber || !docFront || !selfie || (needsBack && !docBack)}
                className="w-full h-12 rounded-xl bg-[var(--accent-primary)] text-white font-black uppercase tracking-widest text-[11px] hover:brightness-110 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {submitting ? "Saving…" : submitLabel}
            </button>
        </form>
    );
}

function KycBusinessForm({ uid, initialData, onSubmit, submitting, submitLabel = "Continue" }: {
    uid: string; initialData: Record<string, unknown>;
    onSubmit: (data: Record<string, unknown>) => void;
    submitting: boolean; submitLabel?: string;
}) {
    // legalName, businessType, cin come pre-filled from the Details step — not asked again
    const legalName    = (initialData.legalName as string) || "";
    const businessType = (initialData.businessType as string) || "";
    const cin          = (initialData.cin as string) || "";

    const [pan, setPan]       = useState((initialData.pan as string) || "");
    const [gst, setGst]       = useState((initialData.gst as string) || "");
    const [address, setAddress] = useState((initialData.address as string) || "");
    const [regDoc, setRegDoc] = useState<string | null>((initialData.regDocUrl as string) || null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!pan || !address || !regDoc) return;
        onSubmit({ legalName, businessType, pan, cin, gst, address, regDocUrl: regDoc });
    };

    const BUSINESS_TYPE_LABELS: Record<string, string> = {
        pvt_ltd: "Private Limited", llp: "LLP", partnership: "Partnership Firm",
        sole_prop: "Sole Proprietorship", trust: "Trust / Society",
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {/* Confirmed details from the previous step — no need to re-enter */}
            <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-3">Confirmed from your details</p>
                <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[var(--text-tertiary)]">Business Name</span>
                    <span className="text-[13px] font-semibold text-[var(--text-primary)]">{legalName || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[var(--text-tertiary)]">Business Type</span>
                    <span className="text-[13px] font-semibold text-[var(--text-primary)]">{BUSINESS_TYPE_LABELS[businessType] || businessType || "—"}</span>
                </div>
                {cin && (
                    <div className="flex items-center justify-between">
                        <span className="text-[12px] text-[var(--text-tertiary)]">CIN / Reg. No.</span>
                        <span className="text-[13px] font-semibold text-[var(--text-primary)]">{cin}</span>
                    </div>
                )}
            </div>
            <KycInputField label="Business PAN" value={pan} onChange={setPan} placeholder="AAACB1234C" />
            <KycInputField label="GST Number (optional)" value={gst} onChange={setGst} placeholder="27AAACB1234C1Z5" />
            <KycInputField label="Registered Address" value={address} onChange={setAddress} placeholder="Full address as on documents" />
            <KycFileZone label="Registration Certificate" fieldName="reg_doc" value={regDoc} onChange={setRegDoc} uid={uid} stepId="kyc_business" />
            <button type="submit"
                disabled={submitting || !pan || !address || !regDoc}
                className="w-full h-12 rounded-xl bg-[var(--accent-primary)] text-white font-black uppercase tracking-widest text-[11px] hover:brightness-110 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {submitting ? "Saving…" : submitLabel}
            </button>
        </form>
    );
}

function KycSignatoryForm({ uid, initialData, onSubmit, submitting, submitLabel = "Continue" }: {
    uid: string; initialData: Record<string, unknown>;
    onSubmit: (data: Record<string, unknown>) => void;
    submitting: boolean; submitLabel?: string;
}) {
    const [fullName, setFullName]       = useState((initialData.fullName as string) || "");
    const [designation, setDesignation] = useState((initialData.designation as string) || "");
    const [email, setEmail]             = useState((initialData.email as string) || "");
    const [phone, setPhone]             = useState((initialData.phone as string) || "");
    const [idType, setIdType]           = useState((initialData.idType as string) || "");
    const [idNumber, setIdNumber]       = useState((initialData.idNumber as string) || "");
    const [docFront, setDocFront]       = useState<string | null>((initialData.docFrontUrl as string) || null);
    const [docBack, setDocBack]         = useState<string | null>((initialData.docBackUrl as string) || null);
    const [selfie, setSelfie]           = useState<string | null>((initialData.selfieUrl as string) || null);
    const [declared, setDeclared]       = useState(false);
    const needsBack = ["aadhaar", "driving_licence", "voter_id"].includes(idType);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName || !designation || !email || !idType || !idNumber || !docFront || !selfie || !declared) return;
        if (needsBack && !docBack) return;
        onSubmit({ fullName, designation, email, phone, idType, idNumber, docFrontUrl: docFront, docBackUrl: docBack, selfieUrl: selfie, declared });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)]">
                <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">
                    Provide identity details for the person who is authorized to represent this business on C1RCLE.
                </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
                <KycInputField label="Full Legal Name" value={fullName} onChange={setFullName} placeholder="As on government ID" />
                <KycSelectField label="Designation" value={designation} onChange={setDesignation}
                    options={[
                        { value: "director", label: "Director" },
                        { value: "partner", label: "Partner" },
                        { value: "proprietor", label: "Proprietor" },
                        { value: "authorized_signatory", label: "Authorized Signatory" },
                    ]} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
                <KycInputField label="Email" value={email} onChange={setEmail} type="email" placeholder="representative@company.com" />
                <KycInputField label="Phone" value={phone} onChange={setPhone} placeholder="+91 9876543210" />
            </div>
            <KycSelectField label="ID Type" value={idType} onChange={setIdType}
                options={[
                    { value: "aadhaar", label: "Aadhaar Card" },
                    { value: "passport", label: "Passport" },
                    { value: "driving_licence", label: "Driving Licence" },
                    { value: "voter_id", label: "Voter ID" },
                ]} />
            <KycInputField label="ID Number" value={idNumber} onChange={setIdNumber} placeholder="Enter ID number" />
            <div className={`grid gap-4 ${needsBack ? "sm:grid-cols-2" : "grid-cols-1"}`}>
                <KycFileZone label="Document Front" fieldName="sig_doc_front" value={docFront} onChange={setDocFront} uid={uid} stepId="kyc_signatory" />
                {needsBack && <KycFileZone label="Document Back" fieldName="sig_doc_back" value={docBack} onChange={setDocBack} uid={uid} stepId="kyc_signatory" />}
            </div>
            <KycFileZone label="Selfie Photo" fieldName="sig_selfie" value={selfie} onChange={setSelfie} uid={uid} stepId="kyc_signatory" />
            <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-[var(--border-subtle)] accent-[var(--accent-primary)]" />
                <span className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                    I confirm that I am authorized to represent this business and the information provided is accurate.
                </span>
            </label>
            <button type="submit"
                disabled={submitting || !fullName || !designation || !email || !idType || !idNumber || !docFront || !selfie || !declared || (needsBack && !docBack)}
                className="w-full h-12 rounded-xl bg-[var(--accent-primary)] text-white font-black uppercase tracking-widest text-[11px] hover:brightness-110 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {submitting ? "Saving…" : submitLabel}
            </button>
        </form>
    );
}

function BankSetupForm({ uid, initialData, onSubmit, submitting, submitLabel = "Submit Application" }: {
    uid: string; initialData: Record<string, unknown>;
    onSubmit: (data: Record<string, unknown>) => void;
    submitting: boolean; submitLabel?: string;
}) {
    const [accountHolder, setAccountHolder] = useState((initialData.accountHolder as string) || "");
    const [accountNumber, setAccountNumber] = useState("");
    const [confirmNumber, setConfirmNumber] = useState("");
    const [ifsc, setIfsc]                   = useState((initialData.ifsc as string) || "");
    const [bankName, setBankName]           = useState((initialData.bankName as string) || "");
    const [branch, setBranch]               = useState((initialData.branch as string) || "");
    const [accountType, setAccountType]     = useState((initialData.accountType as string) || "");
    const [chequeDoc, setChequeDoc]         = useState<string | null>((initialData.chequeDocUrl as string) || null);

    const lookupIfsc = useCallback(async () => {
        if (ifsc.length !== 11) return;
        try {
            const res = await fetch(`https://ifsc.razorpay.com/${ifsc.toUpperCase()}`);
            if (res.ok) {
                const data = await res.json();
                setBankName(data.BANK || "");
                setBranch(data.BRANCH || "");
            }
        } catch { /* silent */ }
    }, [ifsc]);

    useEffect(() => { if (ifsc.length === 11) lookupIfsc(); }, [ifsc, lookupIfsc]);

    const numbersMismatch = confirmNumber.length > 0 && accountNumber !== confirmNumber;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!accountHolder || !accountNumber || accountNumber !== confirmNumber || !ifsc || !accountType || !chequeDoc) return;
        onSubmit({
            accountHolder,
            accountNumberLast4: accountNumber.slice(-4),
            accountNumberMasked: "*".repeat(accountNumber.length - 4) + accountNumber.slice(-4),
            ifsc: ifsc.toUpperCase(),
            bankName, branch, accountType,
            chequeDocUrl: chequeDoc,
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <KycInputField label="Account Holder Name" value={accountHolder} onChange={setAccountHolder} placeholder="Exactly as on passbook" />
            <div className="grid sm:grid-cols-2 gap-4">
                <KycInputField label="Account Number" value={accountNumber} onChange={setAccountNumber} type="password" placeholder="Enter account number" />
                <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">Confirm Account Number</label>
                    <input type="text" value={confirmNumber} onChange={(e) => setConfirmNumber(e.target.value)}
                        placeholder="Re-enter account number"
                        className={`w-full h-12 px-4 rounded-xl bg-[var(--surface-secondary)] border text-[var(--text-primary)] text-[14px] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 transition-all ${numbersMismatch ? "border-red-500/50 focus:ring-red-500/20" : "border-[var(--border-subtle)] focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]/50"}`} />
                    {numbersMismatch && <p className="text-[11px] text-red-400">Account numbers don't match</p>}
                </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
                <KycInputField label="IFSC Code" value={ifsc} onChange={setIfsc} placeholder="SBIN0001234" />
                <KycSelectField label="Account Type" value={accountType} onChange={setAccountType}
                    options={[{ value: "savings", label: "Savings" }, { value: "current", label: "Current" }]} />
            </div>
            {bankName && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-[12px] text-emerald-400 font-medium">{bankName} — {branch}</span>
                </div>
            )}
            <KycFileZone label="Cancelled Cheque or Passbook Front" fieldName="cheque_doc" value={chequeDoc} onChange={setChequeDoc} uid={uid} stepId="bank_setup" />
            <button type="submit"
                disabled={submitting || !accountHolder || !accountNumber || accountNumber !== confirmNumber || !ifsc || !accountType || !chequeDoc}
                className="w-full h-14 rounded-2xl bg-[var(--accent-primary)] text-white font-black uppercase tracking-widest text-[11px] hover:brightness-110 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--accent-primary)]/20">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {submitting ? "Submitting…" : submitLabel}
            </button>
        </form>
    );
}

