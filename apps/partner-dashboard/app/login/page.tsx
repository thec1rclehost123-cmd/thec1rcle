"use client";

import { useState, useEffect, Suspense } from "react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, AlertCircle, ChevronRight, Building2, Users, Zap, Eye, EyeOff } from "lucide-react";
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { getFirebaseDb, getFirebaseAuth } from "@/lib/firebase/client";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "@/components/ThemeToggle";

type UserType = "venue" | "host" | "promoter";

const roleConfig = {
    venue: {
        icon: Building2,
        label: "Venue",
        description: "Full venue operations",
        color: "from-orange-500/20 to-orange-600/10"
    },
    host: {
        icon: Users,
        label: "Host",
        description: "Event management",
        color: "from-indigo-500/20 to-indigo-600/10"
    },
    promoter: {
        icon: Zap,
        label: "Promoter",
        description: "Sales & outreach",
        color: "from-emerald-500/20 to-emerald-600/10"
    }
};

function LoginForm() {
    const { signIn, user, loading: authLoading } = useDashboardAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [userType, setUserType] = useState<UserType>("venue");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!authLoading && user) {
            const callback = searchParams.get("callbackUrl");
            if (callback) {
                router.replace(callback);
            } else {
                router.replace(`/${userType}`);
            }
        }
    }, [user, authLoading, router, userType, searchParams]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await signIn(email, password);

            const auth = getFirebaseAuth();
            const db = getFirebaseDb();
            const currentUser = auth.currentUser;

            if (currentUser) {
                const userDoc = await getDoc(doc(db, "users", currentUser.uid));
                const userData = userDoc.exists() ? userDoc.data() : {};

                let assignedType: string | null = null;

                if (userData.role === 'host') assignedType = 'host';
                else if (userData.role === 'promoter') assignedType = 'promoter';
                else if (userData.role === 'partner' || userData.venueId) assignedType = 'venue';

                if (!assignedType) {
                    const q = query(collection(db, "onboarding_requests"), where("uid", "==", currentUser.uid), limit(1));
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        assignedType = snap.docs[0].data().type;
                    }
                }

                if (!assignedType) {
                    setError("This account is not registered. Please apply for access.");
                    await auth.signOut();
                    setLoading(false);
                    return;
                }

                if (assignedType !== userType) {
                    const typeLabel = assignedType === 'venue' ? 'Venue' : assignedType === 'host' ? 'Host' : 'Promoter';
                    setError(`This account is registered as ${typeLabel}. Please select the correct workspace.`);
                    await auth.signOut();
                    setLoading(false);
                    return;
                }
            }

            router.push(`/${userType}`);
        } catch (err: any) {
            console.error("Login error:", err);
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
                setError("Account not found or invalid credentials.");
            } else {
                setError("An error occurred. Please try again.");
            }
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-[var(--surface-base)]">
            {/* Left Panel - Premium Branding */}
            <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-12 overflow-hidden bg-[var(--surface-secondary)]">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]">
                    <div className="absolute inset-0" style={{
                        backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
                        backgroundSize: '32px 32px'
                    }} />
                </div>

                {/* Gradient Orb */}
                <div className="absolute -bottom-1/2 -right-1/4 w-[800px] h-[800px] rounded-full bg-gradient-radial from-[var(--c1rcle-orange)]/20 via-transparent to-transparent blur-3xl" />
                <div className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-radial from-indigo-500/10 via-transparent to-transparent blur-3xl" />

                {/* Top - Logo & Theme Toggle */}
                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-[var(--text-primary)] flex items-center justify-center shadow-lg">
                            <span className="text-[var(--text-inverse)] text-xl font-bold">C</span>
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">THE C1RCLE</h1>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Partner Dashboard</p>
                        </div>
                    </div>
                    <ThemeToggle variant="switch" />
                </div>

                {/* Middle - Hero Content */}
                <div className="relative z-10 max-w-lg">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <p className="text-label-sm text-[var(--c1rcle-orange)] mb-4">ENTERPRISE PLATFORM</p>
                        <h2 className="text-display text-[var(--text-primary)] mb-6 leading-tight">
                            Command Your<br />
                            <span className="text-[var(--c1rcle-orange)]">Nightlife Empire</span>
                        </h2>
                        <p className="text-body-lg text-[var(--text-secondary)] leading-relaxed max-w-md">
                            Real-time analytics, seamless operations, and complete control over your venue, events, and promoter network—all in one powerful platform.
                        </p>
                    </motion.div>
                </div>

                {/* Bottom - Footer */}
                <div className="relative z-10">
                    <p className="text-caption text-[var(--text-tertiary)]">
                        Secure access for authorized partners only. Protected by enterprise-grade encryption.
                    </p>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-md"
                >
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center justify-between mb-10">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-[var(--text-primary)] flex items-center justify-center">
                                <span className="text-[var(--text-inverse)] font-bold">C</span>
                            </div>
                            <span className="text-title font-bold text-[var(--text-primary)]">THE C1RCLE</span>
                        </div>
                        <ThemeToggle variant="switch" />
                    </div>

                    {/* Header */}
                    <div className="mb-10">
                        <h3 className="text-headline text-[var(--text-primary)] mb-2">Welcome back</h3>
                        <p className="text-body text-[var(--text-secondary)]">Sign in to access your partner dashboard.</p>
                    </div>

                    {/* Error Alert */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-6"
                            >
                                <div className="p-4 bg-[var(--state-error-bg)] border border-red-500/20 rounded-2xl flex items-start gap-3">
                                    <AlertCircle className="h-5 w-5 text-[var(--state-error)] flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-[14px] text-[var(--state-error)] font-medium">{error}</p>
                                        {error.includes("not registered") && (
                                            <button
                                                onClick={() => router.push(`/onboard?email=${email}&type=${userType}`)}
                                                className="text-[13px] font-semibold text-[var(--state-error)] underline mt-2 hover:no-underline"
                                            >
                                                Apply for Access →
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleLogin} className="space-y-6">
                        {/* Workspace Selector */}
                        <div className="space-y-3">
                            <label className="text-label text-[var(--text-tertiary)]">Workspace</label>
                            <div className="grid grid-cols-3 gap-3">
                                {(["venue", "host", "promoter"] as UserType[]).map((type) => {
                                    const config = roleConfig[type];
                                    const Icon = config.icon;
                                    const isActive = userType === type;

                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setUserType(type)}
                                            className={`relative p-4 rounded-2xl border-2 transition-all duration-200 text-center group ${isActive
                                                ? "border-[var(--c1rcle-orange)] bg-[var(--c1rcle-orange-glow)]"
                                                : "border-[var(--border-subtle)] bg-[var(--surface-secondary)] hover:border-[var(--border-default)]"
                                                }`}
                                        >
                                            <Icon className={`h-5 w-5 mx-auto mb-2 transition-colors ${isActive ? "text-[var(--c1rcle-orange)]" : "text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]"
                                                }`} />
                                            <p className={`text-[13px] font-semibold transition-colors ${isActive ? "text-[var(--c1rcle-orange)]" : "text-[var(--text-secondary)]"
                                                }`}>
                                                {config.label}
                                            </p>
                                            {isActive && (
                                                <motion.div
                                                    layoutId="workspace-indicator"
                                                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--c1rcle-orange)]"
                                                />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Email Input */}
                        <div className="space-y-2">
                            <label className="input-label">Email Address</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-placeholder)] group-focus-within:text-[var(--c1rcle-orange)] transition-colors" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="input input-lg pl-12"
                                    placeholder="you@company.com"
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="input-label">Password</label>
                                <button
                                    type="button"
                                    onClick={() => router.push('/forgot-password')}
                                    className="text-[12px] font-medium text-[var(--c1rcle-orange)] hover:underline"
                                >
                                    Forgot password?
                                </button>
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-placeholder)] group-focus-within:text-[var(--c1rcle-orange)] transition-colors" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="input input-lg pl-12 pr-12"
                                    placeholder="Enter your password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-placeholder)] hover:text-[var(--text-secondary)] transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading || authLoading}
                            className="btn btn-primary btn-xl w-full group"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Signing in...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    Continue to Dashboard
                                    <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                </span>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="my-8 flex items-center gap-4">
                        <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                        <span className="text-caption text-[var(--text-tertiary)]">New to C1RCLE?</span>
                        <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                    </div>

                    {/* Apply CTA */}
                    <div className="card p-6 text-center">
                        <p className="text-body-sm text-[var(--text-secondary)] mb-4">
                            Join our network of premium nightlife venues, hosts, and promoters.
                        </p>
                        <button
                            onClick={() => router.push('/onboard')}
                            className="btn btn-secondary w-full"
                        >
                            Apply for Partner Access
                        </button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

// Loading Skeleton
function LoginSkeleton() {
    return (
        <div className="min-h-screen flex bg-[var(--surface-base)]">
            <div className="hidden lg:block lg:w-[55%] bg-[var(--surface-secondary)]" />
            <div className="flex-1 flex items-center justify-center p-12">
                <div className="w-full max-w-md space-y-6">
                    <div className="skeleton h-10 w-48 rounded-lg" />
                    <div className="skeleton h-6 w-64 rounded-lg" />
                    <div className="skeleton h-14 w-full rounded-2xl" />
                    <div className="skeleton h-14 w-full rounded-2xl" />
                    <div className="skeleton h-16 w-full rounded-2xl" />
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<LoginSkeleton />}>
            <LoginForm />
        </Suspense>
    );
}
