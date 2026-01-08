"use client";

import { useState, useEffect, Suspense } from "react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, AlertCircle, ChevronRight } from "lucide-react";
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { getFirebaseDb, getFirebaseAuth } from "@/lib/firebase/client";

type UserType = "venue" | "host" | "promoter";

function LoginForm() {
    const { signIn, user, loading: authLoading } = useDashboardAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [userType, setUserType] = useState<UserType>("venue");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
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
        <div className="min-h-screen flex bg-[#fbfbfd]">
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-white relative flex-col justify-between p-16 border-r border-black/[0.04]">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-[#1d1d1f] flex items-center justify-center text-white text-[15px] font-semibold">
                        C
                    </div>
                    <span className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight">C1RCLE</span>
                </div>

                <div>
                    <h2 className="text-display mb-6">
                        Partner<br />Dashboard
                    </h2>
                    <p className="text-body text-[#6e6e73] max-w-sm">
                        Manage events, track sales, and grow your network with a unified platform for venues, hosts, and promoters.
                    </p>
                </div>

                <p className="text-caption">
                    Secure access for authorized partners only.
                </p>
            </div>

            {/* Right Panel - Login Form */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-sm animate-slide-up">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center gap-3 mb-12">
                        <div className="h-10 w-10 rounded-xl bg-[#1d1d1f] flex items-center justify-center text-white text-[15px] font-semibold">
                            C
                        </div>
                        <span className="text-[17px] font-semibold text-[#1d1d1f]">C1RCLE</span>
                    </div>

                    <div className="mb-10">
                        <h3 className="text-headline mb-2">Sign in</h3>
                        <p className="text-body-sm">Access your partner dashboard.</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-[#ff3b30]/8 border border-[#ff3b30]/20 rounded-2xl flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-[#ff3b30] flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-[15px] text-[#ff3b30] font-medium">{error}</p>
                                {error.includes("not registered") && (
                                    <button
                                        onClick={() => router.push(`/onboard?email=${email}&type=${userType}`)}
                                        className="btn btn-ghost text-[13px] mt-2 px-0"
                                    >
                                        Apply for Access
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        {/* Workspace Selector */}
                        <div className="space-y-2">
                            <label className="input-label">Workspace</label>
                            <div className="flex p-1 bg-[#f5f5f7] rounded-xl">
                                <RoleTab active={userType === 'venue'} onClick={() => setUserType('venue')} label="Venue" />
                                <RoleTab active={userType === 'host'} onClick={() => setUserType('host')} label="Host" />
                                <RoleTab active={userType === 'promoter'} onClick={() => setUserType('promoter')} label="Promoter" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="input-label">Email</label>
                                <div className="relative group">
                                    <Mail
                                        className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#86868b] group-focus-within:text-[#007aff] transition-colors"
                                        strokeWidth={1.5}
                                    />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="input pl-12"
                                        placeholder="you@example.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="input-label">Password</label>
                                <div className="relative group">
                                    <Lock
                                        className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#86868b] group-focus-within:text-[#007aff] transition-colors"
                                        strokeWidth={1.5}
                                    />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="input pl-12"
                                        placeholder="Enter password"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || authLoading}
                            className="btn btn-primary w-full h-12 text-[15px] disabled:opacity-50"
                        >
                            {loading ? "Signing in..." : "Continue"}
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-black/[0.04] text-center">
                        <p className="text-caption mb-4">
                            Forgot password? <button className="text-accent">Reset</button>
                        </p>
                        <div className="card-flat p-4 rounded-xl">
                            <p className="text-body-sm mb-3">New to C1RCLE?</p>
                            <button
                                onClick={() => router.push('/onboard')}
                                className="btn btn-secondary w-full"
                            >
                                Apply for Access
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#fbfbfd]">Loading...</div>}>
            <LoginForm />
        </Suspense>
    );
}

function RoleTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex-1 py-2.5 rounded-lg text-[13px] font-medium transition-all ${active
                ? 'bg-white text-[#1d1d1f] shadow-sm'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
                }`}
        >
            {label}
        </button>
    );
}
