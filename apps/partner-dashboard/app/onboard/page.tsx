"use client";

import { useState, useEffect, Suspense } from "react";
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
    Sparkles
} from "lucide-react";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

type OnboardingStep = "role" | "details" | "success";
type PartnerType = "venue" | "host" | "promoter";

function OnboardingContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user: authUser } = useDashboardAuth();
    const [step, setStep] = useState<OnboardingStep>("role");
    const [partnerType, setPartnerType] = useState<PartnerType>("venue");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        name: "",
        contactPerson: "",
        phone: "",
        city: "",
        area: "",
        capacity: "",
        plan: "silver",
        role: "organizer",
        association: "",
        associatedHostId: "",
        instagram: "",
        bio: ""
    });

    useEffect(() => {
        const type = searchParams.get("type") as PartnerType;
        const email = searchParams.get("email");
        const hostId = searchParams.get("hostId");

        if (type) {
            setPartnerType(type);
            setStep("details");
        }
        if (email) {
            setFormData(prev => ({ ...prev, email }));
        }
        if (hostId) {
            setFormData(prev => ({ ...prev, associatedHostId: hostId }));
        }
    }, [searchParams]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleOnboard = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const auth = getFirebaseAuth();
            const db = getFirebaseDb();

            let uid;
            const effectiveEmail = authUser?.email || formData.email;

            if (authUser && authUser.email === effectiveEmail) {
                uid = authUser.uid;
            } else {
                if (!formData.email || !formData.password) {
                    setError("Please provide both email and password for your new account.");
                    setLoading(false);
                    return;
                }
                try {
                    const credential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
                    uid = credential.user.uid;
                } catch (err: any) {
                    if (err.code === 'auth/email-already-in-use') {
                        setError("This email is already registered. Please log in first, then return to complete your registry.");
                        setLoading(false);
                        return;
                    }
                    throw err;
                }
            }

            await setDoc(doc(db, "users", uid), {
                uid,
                email: effectiveEmail,
                displayName: formData.name,
                role: 'onboarding',
                isApproved: false,
                updatedAt: serverTimestamp()
            }, { merge: true });

            const requestId = `req_${Date.now()}_${uid.substring(0, 5)}`;
            await setDoc(doc(db, "onboarding_requests", requestId), {
                id: requestId,
                uid,
                type: partnerType,
                status: "pending",
                data: {
                    ...formData,
                    email: effectiveEmail,
                    password: "[REDACTED]"
                },
                submittedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            setStep("success");
        } catch (err: any) {
            console.error("Onboarding error:", err);
            setError(err.message || "Failed to submit request. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const roleIcons = {
        venue: Building2,
        host: Users,
        promoter: Zap
    };

    return (
        <div className="min-h-screen bg-[var(--surface-base)]">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[var(--surface-base)]/80 backdrop-blur-xl border-b border-[var(--border-subtle)]">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <button
                        onClick={() => step === "role" ? router.push('/login') : setStep("role")}
                        className="flex items-center gap-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors text-[11px] font-semibold uppercase tracking-wider"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        {step === "role" ? "Back to Login" : "Change Role"}
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-[var(--text-primary)] flex items-center justify-center">
                            <span className="text-[var(--text-inverse)] font-bold text-sm">C</span>
                        </div>
                        <span className="text-[15px] font-bold text-[var(--text-primary)] tracking-tight">THE C1RCLE</span>
                    </div>
                </div>
            </header>

            {/* Progress Indicator */}
            <div className="max-w-5xl mx-auto px-6 py-6">
                <div className="flex items-center gap-4">
                    {["role", "details", "success"].map((s, i) => (
                        <div key={s} className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-all ${step === s
                                    ? "bg-[var(--c1rcle-orange)] text-white"
                                    : ["role", "details", "success"].indexOf(step) > i
                                        ? "bg-[var(--state-success)] text-white"
                                        : "bg-[var(--surface-tertiary)] text-[var(--text-tertiary)]"
                                }`}>
                                {["role", "details", "success"].indexOf(step) > i ? "✓" : i + 1}
                            </div>
                            {i < 2 && (
                                <div className={`w-16 sm:w-24 h-1 rounded-full transition-all ${["role", "details", "success"].indexOf(step) > i
                                        ? "bg-[var(--state-success)]"
                                        : "bg-[var(--surface-tertiary)]"
                                    }`} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <main className="max-w-xl mx-auto px-6 pb-24">
                <AnimatePresence mode="wait">
                    {step === "role" && (
                        <motion.div
                            key="role"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="mb-10">
                                <p className="text-label text-[var(--c1rcle-orange)] mb-2">STEP 01 — SELECT ROLE</p>
                                <h1 className="text-display-sm text-[var(--text-primary)] mb-3">Join the Network</h1>
                                <p className="text-body text-[var(--text-secondary)]">
                                    Select your operational role to begin the onboarding process.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 mb-10">
                                <RoleCard
                                    icon={Building2}
                                    title="Venue Partner"
                                    description="Direct management for nightlife venues, clubs, and lounge spaces."
                                    active={partnerType === 'venue'}
                                    onClick={() => setPartnerType('venue')}
                                />
                                <RoleCard
                                    icon={Users}
                                    title="Event Host"
                                    description="For organizers, DJs, and collectives hosting independent events."
                                    active={partnerType === 'host'}
                                    onClick={() => setPartnerType('host')}
                                />
                                <RoleCard
                                    icon={Zap}
                                    title="Promoter"
                                    description="Access tools for ticket distribution and guestlist management."
                                    active={partnerType === 'promoter'}
                                    onClick={() => setPartnerType('promoter')}
                                />
                            </div>

                            <button
                                onClick={() => setStep("details")}
                                className="w-full bg-[var(--c1rcle-orange)] text-white h-14 rounded-2xl font-semibold text-[14px] hover:brightness-110 transition-all flex items-center justify-center gap-3 shadow-lg shadow-[var(--c1rcle-orange)]/20"
                            >
                                Continue to Details
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </motion.div>
                    )}

                    {step === "details" && (
                        <motion.div
                            key="details"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="mb-10">
                                <p className="text-label text-[var(--c1rcle-orange)] mb-2">STEP 02 — YOUR DETAILS</p>
                                <h1 className="text-display-sm text-[var(--text-primary)] mb-3">
                                    {partnerType === 'venue' ? 'Venue Registration' :
                                        partnerType === 'host' ? 'Host Profile' : 'Promoter Enrollment'}
                                </h1>
                                <p className="text-body text-[var(--text-secondary)]">
                                    Submit your information for verification and approval.
                                </p>
                            </div>

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mb-8 p-5 bg-[var(--state-error-bg)] border border-[var(--state-error)]/20 rounded-2xl"
                                >
                                    <div className="flex items-start gap-4">
                                        <AlertCircle className="h-5 w-5 text-[var(--state-error)] flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-[14px] font-semibold text-[var(--state-error)] mb-2">{error}</p>
                                            {error.includes("log in") && (
                                                <button
                                                    onClick={() => router.push('/login')}
                                                    className="text-[12px] font-semibold text-[var(--state-error)] underline hover:no-underline"
                                                >
                                                    Go to Login →
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            <form onSubmit={handleOnboard} className="space-y-8">
                                {/* Account Credentials */}
                                {!authUser ? (
                                    <div className="space-y-5">
                                        <SectionTitle title="Account Credentials" />
                                        <FormInput
                                            label="Email Address"
                                            icon={Mail}
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            required
                                            placeholder="you@company.com"
                                        />
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
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-[42px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                                            >
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
                                    <SectionTitle title={partnerType === 'promoter' ? 'Your Profile' : 'Entity Information'} />

                                    <FormInput
                                        label={partnerType === 'venue' ? 'Venue Name' : partnerType === 'host' ? 'Brand / Collective Name' : 'Your Full Name'}
                                        icon={partnerType === 'venue' ? Building2 : User}
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        required
                                        placeholder={partnerType === 'venue' ? 'e.g. Club Eclipse' : partnerType === 'host' ? 'e.g. Midnight Collective' : 'Your name'}
                                    />

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormInput
                                            label="Contact Person"
                                            icon={Briefcase}
                                            name="contactPerson"
                                            value={formData.contactPerson}
                                            onChange={handleInputChange}
                                            required
                                            placeholder="Primary contact"
                                        />
                                        <FormInput
                                            label="Phone Number"
                                            icon={Phone}
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleInputChange}
                                            required
                                            placeholder="+91 XXXXX XXXXX"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormInput
                                            label="City"
                                            icon={MapPin}
                                            name="city"
                                            value={formData.city}
                                            onChange={handleInputChange}
                                            required
                                            placeholder="e.g. Mumbai"
                                        />
                                        <FormInput
                                            label="Area / Locality"
                                            icon={MapPin}
                                            name="area"
                                            value={formData.area}
                                            onChange={handleInputChange}
                                            required
                                            placeholder="e.g. Bandra"
                                        />
                                    </div>

                                    {/* Venue-specific fields */}
                                    {partnerType === 'venue' && (
                                        <>
                                            <FormInput
                                                label="Approximate Capacity"
                                                icon={Users}
                                                name="capacity"
                                                value={formData.capacity}
                                                onChange={handleInputChange}
                                                required
                                                placeholder="e.g. 500"
                                            />
                                            <FormSelect
                                                label="Subscription Tier"
                                                name="plan"
                                                value={formData.plan}
                                                onChange={handleInputChange}
                                                options={[
                                                    { value: "basic", label: "Basic Access" },
                                                    { value: "silver", label: "Silver Tier" },
                                                    { value: "gold", label: "Gold Premium" },
                                                    { value: "diamond", label: "Diamond Private" },
                                                ]}
                                            />
                                        </>
                                    )}

                                    {/* Host-specific fields */}
                                    {partnerType === 'host' && (
                                        <FormSelect
                                            label="Host Category"
                                            name="role"
                                            value={formData.role}
                                            onChange={handleInputChange}
                                            options={[
                                                { value: "dj", label: "Individual DJ / Artist" },
                                                { value: "organizer", label: "Event Organizer" },
                                                { value: "collective", label: "Collective / Label" },
                                            ]}
                                        />
                                    )}

                                    {/* Promoter-specific fields */}
                                    {partnerType === 'promoter' && (
                                        <>
                                            <FormInput
                                                label="Instagram Handle"
                                                icon={Instagram}
                                                name="instagram"
                                                value={formData.instagram}
                                                onChange={handleInputChange}
                                                required
                                                placeholder="@yourusername"
                                            />
                                            <div className="space-y-2">
                                                <label className="input-label">Short Bio</label>
                                                <textarea
                                                    name="bio"
                                                    value={formData.bio}
                                                    onChange={handleInputChange}
                                                    placeholder="Tell us about your reach, experience, and what you're looking for..."
                                                    className="w-full bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:bg-[var(--surface-base)] focus:border-[var(--c1rcle-orange)] focus:ring-3 focus:ring-[var(--c1rcle-orange-glow)] transition-all outline-none min-h-[120px] resize-none"
                                                    required
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-[var(--c1rcle-orange)] text-white h-14 rounded-2xl font-semibold text-[14px] hover:brightness-110 transition-all flex items-center justify-center gap-3 shadow-lg shadow-[var(--c1rcle-orange)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            Submit Application
                                            <ChevronRight className="h-5 w-5" />
                                        </>
                                    )}
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {step === "success" && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4 }}
                            className="text-center pt-8"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", delay: 0.2 }}
                                className="h-24 w-24 rounded-3xl bg-[var(--state-success-bg)] text-[var(--state-success)] flex items-center justify-center mx-auto mb-8"
                            >
                                <CheckCircle2 className="h-12 w-12" />
                            </motion.div>

                            <h1 className="text-display-sm text-[var(--text-primary)] mb-4">Application Submitted</h1>
                            <p className="text-body text-[var(--text-secondary)] mb-10 max-w-md mx-auto">
                                Your application for <span className="font-semibold text-[var(--text-primary)]">{formData.name}</span> has been received.
                                We'll review your details and send access credentials via email once approved.
                            </p>

                            <div className="p-6 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] mb-10 flex items-start gap-4 text-left">
                                <ShieldCheck className="h-6 w-6 text-[var(--c1rcle-orange)] flex-shrink-0" />
                                <div>
                                    <p className="text-[13px] font-semibold text-[var(--text-primary)] mb-1">What Happens Next?</p>
                                    <p className="text-[13px] text-[var(--text-tertiary)] leading-relaxed">
                                        Our team typically reviews applications within 24-48 hours. You'll receive an email notification once your account is activated.
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => router.push('/login')}
                                className="inline-flex items-center gap-2 text-[var(--c1rcle-orange)] font-semibold text-[14px] hover:underline"
                            >
                                Return to Login
                                <ChevronRight className="h-4 w-4" />
                            </button>
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
                    <div className="h-10 w-10 border-3 border-[var(--c1rcle-orange)]/30 border-t-[var(--c1rcle-orange)] rounded-full animate-spin" />
                    <p className="text-[14px] font-medium text-[var(--text-tertiary)]">Loading...</p>
                </div>
            </div>
        }>
            <OnboardingContent />
        </Suspense>
    );
}

// Role Selection Card
function RoleCard({ icon: Icon, title, description, active, onClick }: {
    icon: any;
    title: string;
    description: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <motion.button
            onClick={onClick}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`p-6 rounded-2xl border-2 text-left transition-all duration-300 group ${active
                    ? 'bg-[var(--text-primary)] border-[var(--text-primary)] shadow-xl'
                    : 'bg-[var(--surface-elevated)] border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                }`}
        >
            <div className="flex items-start gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all ${active
                        ? 'bg-white/10 text-white'
                        : 'bg-[var(--surface-tertiary)] text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'
                    }`}>
                    <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                    <h3 className={`text-[16px] font-semibold mb-1 ${active ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                        {title}
                    </h3>
                    <p className={`text-[13px] leading-relaxed ${active ? 'text-white/60' : 'text-[var(--text-tertiary)]'}`}>
                        {description}
                    </p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${active
                        ? 'border-[var(--c1rcle-orange)] bg-[var(--c1rcle-orange)]'
                        : 'border-[var(--border-default)]'
                    }`}>
                    {active && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
            </div>
        </motion.button>
    );
}

// Form Input Component
function FormInput({ label, icon: Icon, ...props }: any) {
    return (
        <div className="space-y-2">
            <label className="input-label">{label}</label>
            <div className="relative group">
                {Icon && (
                    <Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-placeholder)] group-focus-within:text-[var(--c1rcle-orange)] transition-colors" />
                )}
                <input
                    className={`w-full bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] transition-all outline-none ${Icon ? 'pl-12 pr-4' : 'px-4'
                        } py-3.5 hover:border-[var(--border-default)] focus:bg-[var(--surface-base)] focus:border-[var(--c1rcle-orange)] focus:ring-3 focus:ring-[var(--c1rcle-orange-glow)]`}
                    {...props}
                />
            </div>
        </div>
    );
}

// Form Select Component
function FormSelect({ label, options, ...props }: any) {
    return (
        <div className="space-y-2">
            <label className="input-label">{label}</label>
            <div className="relative">
                <select
                    className="w-full bg-[var(--surface-secondary)] border border-[var(--border-subtle)] rounded-xl px-4 py-3.5 text-[14px] text-[var(--text-primary)] appearance-none cursor-pointer transition-all outline-none hover:border-[var(--border-default)] focus:bg-[var(--surface-base)] focus:border-[var(--c1rcle-orange)] focus:ring-3 focus:ring-[var(--c1rcle-orange-glow)]"
                    {...props}
                >
                    {options.map((opt: { value: string; label: string }) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-tertiary)] rotate-90 pointer-events-none" />
            </div>
        </div>
    );
}

// Section Title Component
function SectionTitle({ title }: { title: string }) {
    return (
        <div className="flex items-center gap-4">
            <span className="text-label text-[var(--text-tertiary)] whitespace-nowrap">{title}</span>
            <div className="h-px bg-[var(--border-subtle)] flex-1" />
        </div>
    );
}
